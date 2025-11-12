import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { getBaseURL } from './config';
import { bulkInsertVehicles, upsertFileMeta, getFileMeta, listFileMeta, markFileCompleted, resetSeen, markSeenIds, deleteNotSeen } from './db';

// Enhanced rate limiter with retry logic
class RateLimiter {
  constructor({ capacity = 2, refillIntervalMs = 1000 }) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.queue = [];
    setInterval(() => this.refill(), refillIntervalMs);
  }
  refill() {
    this.tokens = this.capacity;
    this.drain();
  }
  drain() {
    while (this.tokens > 0 && this.queue.length > 0) {
      this.tokens--;
      const next = this.queue.shift();
      next();
    }
  }
  async schedule(fn) {
    return new Promise((resolve, reject) => {
      const run = async () => {
        try { resolve(await fn()); }
        catch (e) { reject(e); }
      };
      if (this.tokens > 0) {
        this.tokens--;
        run();
      } else {
        this.queue.push(run);
      }
    });
  }
}

// Retry helper with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isNetworkError = error.code === 'NETWORK_ERROR' || 
                           error.message?.includes('Network Error') ||
                           error.message?.includes('timeout') ||
                           error.response?.status >= 500;
      
      if (attempt === maxRetries || !isNetworkError) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

const limiter = new RateLimiter({ capacity: 1, refillIntervalMs: 600 });

export const listAllFiles = async () => {
  const token = await SecureStore.getItemAsync('token');
  if (!token) return [];
  const headers = { Authorization: `Bearer ${token}` };
  const base = getBaseURL();
  const endpoints = [
    `${base}/api/tenant/data/two-wheeler`,
    `${base}/api/tenant/data/four-wheeler`,
    `${base}/api/tenant/data/cv`
  ];
  const files = [];
  for (const url of endpoints) {
    let page = 1;
    let pages = 1;
    do {
      const { data } = await limiter.schedule(() => retryWithBackoff(() => 
        axios.get(url, { headers, params: { page, limit: 50 }, timeout: 15000 })
      ));
      if (data?.success && Array.isArray(data.data)) {
        for (const row of data.data) {
          const fileName = row.fileName || row._id || '';
          if (!fileName) continue;
          let vehicleType = row.vehicleType || '';
          if (!vehicleType) {
            if (url.includes('two-wheeler')) vehicleType = 'TwoWheeler';
            else if (url.includes('four-wheeler')) vehicleType = 'FourWheeler';
            else if (url.includes('cv')) vehicleType = 'Commercial';
          }
          let uploadDate = row.uploadDate || null;
          if (uploadDate && typeof uploadDate === 'string' && !uploadDate.includes('T')) {
            try { uploadDate = new Date(uploadDate).toISOString(); } catch { uploadDate = null; }
          }
          files.push({
            fileName,
            bankName: row.bankName || '',
            vehicleType,
            total: row.total || row.processedRecords || 0,
            uploadDate
          });
          // Upsert meta for quick resume
          await upsertFileMeta(fileName, {
            vehicleType,
            bankName: row.bankName || '',
            total: row.total || row.processedRecords || 0,
            serverUploadDate: uploadDate
          });
        }
        pages = data.pagination?.pages || 1;
      }
      page += 1;
    } while (page <= pages);
  }
  // Deduplicate by fileName
  const map = new Map();
  for (const f of files) map.set(f.fileName, f);
  return Array.from(map.values());
};

export const downloadNextForFile = async (fileName, options = {}) => {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No authentication token found');
  const headers = { Authorization: `Bearer ${token}` };
  const base = getBaseURL();

  // Ensure metadata row and resume info
  let meta = await upsertFileMeta(fileName, {});
  const currentDownloaded = parseInt(meta?.downloaded || 0);
  const total = parseInt(meta?.total || 0);
  const completed = !!meta?.completed;
  const lastOffset = parseInt(meta?.lastOffset || 0);

  if (completed || (total > 0 && currentDownloaded >= total)) {
    if (!meta?.completed) {
      await markFileCompleted(fileName);
    }
    return { fileName, downloaded: 0, inserted: 0, hasMore: false, total };
  }

  const limit = Math.max(1000, Math.min(50000, options.limit || 50000));
  const nextPage = Math.floor(lastOffset / limit) + 1;
  const id = encodeURIComponent(fileName);
  const { data } = await limiter.schedule(() => retryWithBackoff(() => 
    axios.get(`${base}/api/tenant/data/file/${id}`, {
      headers,
      params: { page: nextPage, limit },
      timeout: 45000
    }), 3, 2000
  ));
  if (!data?.success) throw new Error(data?.message || 'File page fetch failed');

  // Update meta with server-declared total if provided
  const serverTotal = data?.pagination?.total;
  meta = await upsertFileMeta(fileName, {
    total: typeof serverTotal === 'number' ? serverTotal : undefined,
    bankName: data?.uploadDetails?.bankName,
    vehicleType: data?.uploadDetails?.vehicleType,
    serverUploadDate: data?.uploadDetails?.uploadDate || meta?.serverUploadDate || null
  });

  const rows = Array.isArray(data?.data) ? data.data : [];
  if (rows.length === 0) {
    await markFileCompleted(fileName);
    return { fileName, downloaded: 0, inserted: 0, hasMore: false, total: meta?.total || 0 };
  }

  // Insert records into database
  let inserted = 0;
  try {
    inserted = await bulkInsertVehicles(rows, { chunkSize: 1500, reindex: false });
    console.log(`💾 File ${fileName}: Inserted ${inserted} out of ${rows.length} records`);
    
    if (rows.length > 0 && inserted === 0) {
      console.error(`❌ CRITICAL: bulkInsertVehicles returned 0 inserted for ${rows.length} rows from file ${fileName}!`);
    }
  } catch (insertError) {
    console.error(`❌ Error in bulkInsertVehicles for file ${fileName}:`, insertError?.message || insertError);
    throw insertError; // Re-throw to stop download if insert fails
  }
  
  // Mark these ids as seen to support mirror deletes later
  try {
    const ids = rows.map(r => r?._id).filter(Boolean);
    if (ids.length > 0) {
      await markSeenIds(ids);
    }
  } catch (markError) {
    console.error(`Error marking seen IDs for file ${fileName}:`, markError?.message || markError);
    // Don't fail if marking fails, but log it
  }
  const newDownloaded = currentDownloaded + rows.length;
  const newOffset = lastOffset + rows.length;
  await upsertFileMeta(fileName, {
    downloaded: newDownloaded,
    lastOffset: newOffset,
    localDownloadDate: new Date().toISOString()
  });

  const finalTotal = parseInt((meta?.total || serverTotal || 0));
  const stillHasMore = finalTotal > 0 ? newDownloaded < finalTotal : rows.length === limit;
  if (!stillHasMore) {
    await markFileCompleted(fileName);
  }
  return { fileName, downloaded: rows.length, inserted, hasMore: stillHasMore, total: finalTotal || newDownloaded };
};

export const singleClickPerFileSync = async (onProgress = null, limit = 50000) => {
  const files = await listAllFiles();
  const metas = await listFileMeta();
  const metaByName = new Map(metas.map(m => [m.fileName, m]));

  // Find the first file that is not completed
  const nextFileToDownload = files.find(f => {
    const meta = metaByName.get(f.fileName);
    return !(meta?.completed && meta?.total && meta?.downloaded >= meta?.total);
  });

  if (!nextFileToDownload) {
    return {
      success: false,
      message: 'All files are already downloaded.',
      fileId: null,
      remaining: 0
    };
  }

  // Download only one batch for the next incomplete file
  const res = await downloadNextForFile(nextFileToDownload.fileName, { limit });

  // Count remaining files
  let remainingFiles = 0;
  for (const f of files) {
    const meta = metaByName.get(f.fileName);
    if (!(meta?.completed && meta?.total && meta?.downloaded >= meta?.total)) {
      remainingFiles++;
    }
  }
  // If the current file is now complete, decrement the count
  if (!res.hasMore) {
    remainingFiles = Math.max(0, remainingFiles - 1);
  }

  return {
    success: true,
    fileId: nextFileToDownload.fileName,
    inserted: res.inserted,
    downloaded: res.downloaded,
    remaining: remainingFiles,
    hasMoreInFile: res.hasMore
  };
};

/**
 * Smart Sync - Mirrors server data to offline database
 * 
 * Strategy:
 * 1. Reset sync_seen table to track which records exist on server
 * 2. Delete metadata for files removed from server (records deleted later)
 * 3. Download all files from server, marking each record ID as "seen"
 * 4. Delete any records not marked as "seen" (these were deleted from server)
 * 
 * This ensures offline database is an exact mirror of server:
 * - New records from server → Added to offline
 * - Updated records from server → Replaced in offline (INSERT OR REPLACE)
 * - Deleted files from server → Records removed from offline
 * - Individual deleted records → Removed from offline
 */
export const smartSync = async (onProgress) => {
  onProgress({ status: 'Starting sync...', progress: 0 });

  // 1. Get server files and local metadata
  const serverFiles = await listAllFiles();
  const localMetas = await listFileMeta();
  const localMetaMap = new Map(localMetas.map(m => [m.fileName, m]));
  onProgress({ status: 'Comparing local and server files...', progress: 5 });

  // Prepare mirror set for deletions: clear seen ids at start of full sync
  // This table tracks which records exist on server in current sync
  try { await resetSeen(); } catch (_) {}

  // 2. Identify new, incomplete, and deleted files
  const filesToDownload = [];
  const completedFiles = [];
  const serverFileNames = new Set(serverFiles.map(f => f.fileName));

  for (const serverFile of serverFiles) {
    const localMeta = localMetaMap.get(serverFile.fileName);
    if (!localMeta || !localMeta.completed) {
      filesToDownload.push(serverFile);
    } else {
      // File is marked as completed - verify records actually exist in database
      // If not, we need to re-download it
      try {
        const { countVehicles } = await import('./db');
        const currentCount = await countVehicles();
        const expectedRecords = parseInt(localMeta.downloaded || 0);
        
        // If database is empty or has very few records compared to what we expect,
        // treat the file as incomplete and re-download
        if (currentCount === 0 || (expectedRecords > 100 && currentCount < expectedRecords * 0.1)) {
          console.warn(`⚠️ File ${serverFile.fileName} marked completed but database has ${currentCount} records (expected ~${expectedRecords}). Re-downloading...`);
          filesToDownload.push(serverFile);
          // Mark file as incomplete so it gets re-downloaded
          const { upsertFileMeta } = await import('./db');
          await upsertFileMeta(serverFile.fileName, { completed: 0, downloaded: 0, lastOffset: 0 });
        } else {
          // File is truly completed - mark its records as seen
          completedFiles.push(serverFile);
        }
      } catch (verifyError) {
        console.error(`Error verifying file ${serverFile.fileName}:`, verifyError);
        // On error, treat as incomplete and re-download
        filesToDownload.push(serverFile);
      }
    }
  }

  // 2.5. Mark existing records from completed files as "seen"
  // This prevents them from being deleted when we sync new files
  // We fetch first page of each completed file to get their record IDs
  // NOTE: Skip this if there are no completed files to avoid unnecessary API calls
  if (completedFiles.length > 0) {
    onProgress({ status: `Marking ${completedFiles.length} completed files as seen...`, progress: 6 });
    try {
      const { markCompletedFileRecordsAsSeen } = await import('./db');
      let totalMarked = 0;
      for (let idx = 0; idx < completedFiles.length; idx++) {
        const completedFile = completedFiles[idx];
        try {
          const marked = await markCompletedFileRecordsAsSeen(completedFile.fileName);
          totalMarked += marked || 0;
          console.log(`✅ Marked ${marked || 0} records from file ${idx + 1}/${completedFiles.length}: ${completedFile.fileName}`);
        } catch (fileError) {
          console.error(`Error marking file ${completedFile.fileName}:`, fileError?.message || fileError);
          // Continue with next file instead of failing entire sync
        }
      }
      console.log(`✅ Total marked ${totalMarked} records from ${completedFiles.length} completed files as seen`);
    } catch (e) {
      console.error('Error marking completed files as seen:', e);
      // Don't fail the entire sync if marking fails - continue with download
    }
  }

  const filesToDelete = localMetas.filter(m => !serverFileNames.has(m.fileName));
  onProgress({ status: `Found ${filesToDownload.length} new/incomplete files and ${filesToDelete.length} files to delete.`, progress: 10 });

  // 3. First, handle deleted files - remove their records from offline database
  let totalDeleted = 0;
  if (filesToDelete.length > 0) {
    onProgress({ status: `Deleting ${filesToDelete.length} removed files from offline database...`, progress: 12 });
    try {
      const { deleteFileRecords } = await import('./db');
      for (const deletedFile of filesToDelete) {
        const deletedCount = await deleteFileRecords(deletedFile.fileName);
        totalDeleted += deletedCount || 0;
        console.log(`🗑️ Deleted file ${deletedFile.fileName}: ${deletedCount || 0} records removed`);
      }
      console.log(`🗑️ Total records deleted from removed files: ${totalDeleted}`);
    } catch (e) {
      console.error('Error deleting removed files:', e);
    }
  }

  // 4. Download new/incomplete files one by one
  let totalInserted = 0;
  const downloadProgressStart = filesToDelete.length > 0 ? 15 : 10;
  for (let i = 0; i < filesToDownload.length; i++) {
    const file = filesToDownload[i];
    const progress = downloadProgressStart + Math.round(((i + 1) / filesToDownload.length) * 75);
    onProgress({
      status: `Downloading file ${i + 1}/${filesToDownload.length}: ${file.fileName}`,
      progress
    });

    let hasMore = true;
    let fileInserted = 0;
    let fileDownloaded = 0;
    while (hasMore) {
      try {
        const res = await downloadNextForFile(file.fileName, { limit: 50000 });
        hasMore = res.hasMore;
        fileInserted += res.inserted || 0;
        fileDownloaded += res.downloaded || 0;
        totalInserted += res.inserted || 0;
        console.log(`📥 File ${file.fileName}: downloaded ${res.downloaded || 0}, inserted ${res.inserted || 0} records (total for file: ${fileInserted})`);
        
        // Verify insertion worked
        if (res.downloaded > 0 && res.inserted === 0) {
          console.warn(`⚠️ WARNING: Downloaded ${res.downloaded} records but inserted 0! Check bulkInsertVehicles`);
        }
      } catch (downloadError) {
        console.error(`Error downloading file ${file.fileName}:`, downloadError?.message || downloadError);
        // Continue with next file instead of failing entire sync
        hasMore = false;
      }
    }
    console.log(`✅ Completed file ${file.fileName}: ${fileDownloaded} downloaded, ${fileInserted} inserted`);
  }
  console.log(`📊 Total records inserted during sync: ${totalInserted}`);

  // 5. Mirror deletions: remove any records not seen this run (server-deleted individual records)
  onProgress({ status: `Applying deletions to mirror server...`, progress: 95 });
  let mirrorDeleted = 0;
  try {
    const result = await deleteNotSeen();
    mirrorDeleted = result?.deleted || 0;
    console.log(`🗑️ Mirror deletion: ${mirrorDeleted} records deleted (not found on server)`);
  } catch (e) {
    console.error('Mirror delete error:', e?.message || e);
  }

  onProgress({ status: 'Sync complete!', progress: 100 });
  const totalDeletedRecords = totalDeleted + mirrorDeleted;
  console.log(`🎉 Sync completed: ${filesToDownload.length} files downloaded, ${totalInserted} records inserted, ${totalDeletedRecords} records deleted`);
  return { 
    success: true, 
    downloaded: filesToDownload.length, 
    deletedFiles: filesToDelete.length, 
    deletedRecords: totalDeletedRecords,
    inserted: totalInserted 
  };
};

export const debugFileComparison = async () => { return; };

export const getPerFileSyncStatus = async () => {
  const files = await listAllFiles();
  const metas = await listFileMeta();
  const byName = new Map(metas.map(m => [m.fileName, m]));
  let totalServer = 0;
  let totalLocal = 0;
  for (const f of files) {
    totalServer += parseInt(f.total || 0);
    const m = byName.get(f.fileName);
    if (m) totalLocal += parseInt(m.downloaded || 0);
  }
  const anyIncomplete = files.some(f => {
    const m = byName.get(f.fileName);
    return !(m && m.completed && m.total && m.downloaded >= m.total);
  });
  return {
    anyIncomplete,
    totalServer,
    totalLocal,
    serverFileCount: files.length,
    localFileCount: metas.length,
    cleanupResult: { deletedFiles: 0, deletedRecords: 0 }
  };
};

// --- New: Direct chunk-based download avoiding file listing ---
export const downloadAllViaChunks = async (onProgress = null, limit = 50000, options = {}) => {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No authentication token found');
  const headers = { Authorization: `Bearer ${token}` };
  const base = getBaseURL();

  const cols = ['two', 'four', 'comm'];
  let totalInserted = 0;
  let processed = 0;
  let currentCol = '';
  const pageLimit = Math.max(1000, Math.min(50000, limit || 50000));

  const mirror = options?.mirror === true;
  if (mirror) {
    try { await resetSeen(); } catch (_) {}
  }

  // Try to fetch total record counts for better progress reporting
  let totalRecords = 0;
  try {
    const { data: stats } = await axios.get(`${base}/api/tenant/data/offline-stats`, { headers, timeout: 15000 });
    if (stats?.success) {
      const counts = stats?.counts || {};
      // counts may be an object with values per collection; sum all numeric values
      totalRecords = Object.values(counts).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
    }
  } catch (_) {}

  for (const col of cols) {
    currentCol = col;
    let skip = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data } = await limiter.schedule(() => retryWithBackoff(() =>
        axios.get(`${base}/api/tenant/data/offline-chunk`, {
          headers,
          params: { col, skip, limit: pageLimit },
          timeout: 45000
        }), 3, 1500
      ));
      if (!data?.success) throw new Error(data?.message || 'Chunk fetch failed');
      const rows = Array.isArray(data?.data) ? data.data : [];
      if (rows.length === 0) break;
      const inserted = await bulkInsertVehicles(rows, { chunkSize: 1500, reindex: false });
      totalInserted += inserted;
      processed += rows.length;
      if (mirror) {
        try {
          const ids = rows.map(r => r?._id).filter(Boolean);
          await markSeenIds(ids);
        } catch (_) {}
      }
      skip += rows.length;
      if (onProgress) {
        try {
          const pct = totalRecords > 0 ? Math.min(99, Math.round((processed / totalRecords) * 100)) : 0;
          onProgress({ inserted: totalInserted, downloadedRecords: processed, totalRecords, percentage: pct, currentFile: `col:${currentCol} skip:${skip}` });
        } catch (_) {}
      }
      if (rows.length < pageLimit) break;
    }
  }

  if (mirror) {
    try {
      await deleteNotSeen();
    } catch (_) {}
  }

  if (onProgress) {
    try { onProgress({ inserted: totalInserted, downloadedRecords: processed, totalRecords, percentage: 100, currentFile: '' }); } catch (_) {}
  }

  return { success: true, inserted: totalInserted };
};
