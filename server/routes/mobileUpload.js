const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/database');
const fileManagementRouter = require('./fileManagement');
const { sendNotificationToTenant, createFileUploadNotification } = require('../utils/pushNotificationService');

// In-memory progress store for upload tracking
// Format: { uploadId: { progress: 0-100, message: string, totalRows: number, processedRows: number } }
const uploadProgressStore = new Map();

// Generate unique upload ID
const generateUploadId = () => {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Clean up old progress entries (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, data] of uploadProgressStore.entries()) {
    if (data.timestamp && data.timestamp < oneHourAgo) {
      uploadProgressStore.delete(id);
    }
  }
}, 10 * 60 * 1000); // Clean every 10 minutes

// Auth middleware
router.use(authenticateToken, requireAdmin);

// Progress polling endpoint
router.get('/upload-progress/:uploadId', (req, res) => {
  const { uploadId } = req.params;
  const progress = uploadProgressStore.get(uploadId);
  
  if (!progress) {
    return res.json({ 
      success: false, 
      message: 'Upload progress not found',
      progress: 0 
    });
  }
  
  res.json({
    success: true,
    progress: progress.progress || 0,
    message: progress.message || '',
    totalRows: progress.totalRows || 0,
    processedRows: progress.processedRows || 0,
    inserted: progress.inserted || 0,
    failed: progress.failed || 0
  });
});

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 50MB practical limit
    files: 1,
    fieldSize: 100 * 1024 * 1024, // 10MB field size
    fieldNameSize: 200 // 200B field name size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'application/vnd.ms-excel.sheet.macroEnabled.12', // xlsm
      'text/csv',
      'application/csv',
      'text/plain'
    ]);

    if (allowedMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }

    // Fallback to extension check when mimetype is unreliable (common on Windows)
    const name = (file.originalname || '').toLowerCase();
    const allowedExtensions = ['.xlsx', '.xls', '.xlsm', '.csv'];
    const hasAllowedExt = allowedExtensions.some(ext => name.endsWith(ext));
    if (hasAllowedExt) {
      return cb(null, true);
    }

    cb(new Error('Invalid file type. Only Excel (.xlsx/.xls/.xlsm) and CSV (.csv) files are allowed.'), false);
  }
});

// Using existing getTenantDB from config/database.js

// Field mapping for data extraction
const FIELD_MAPPING = {
  location: {
    aliases: ['location', 'city', 'place'],
    required: false,
    type: 'string'
  },
  bankName: {
    aliases: ['bank name', 'bank', 'lender', 'financier'],
    required: false,
    type: 'string'
  },
  agreementNumber: {
    aliases: ['agreement number', 'agreement no', 'agreement', 'loan number'],
    required: false,
    type: 'string'
  },
  customerName: {
    aliases: ['customer name', 'customer', 'borrower name', 'applicant name'],
    required: false,
    type: 'string'
  },
  vehicleMake: {
    aliases: ['vehicle make', 'make', 'brand', 'manufacturer'],
    required: false,
    type: 'string'
  },
  registrationNumber: {
    aliases: ['registration number', 'registration', 'reg no', 'reg number', 'vehicle number'],
    required: false,
    type: 'string'
  },
  engineNumber: {
    aliases: ['engine number', 'engine no', 'engine'],
    required: false,
    type: 'string'
  },
  chassisNumber: {
    aliases: ['chassis number', 'chassis no', 'chassis', 'vin'],
    required: false,
    type: 'string'
  },
  emiAmount: {
    aliases: ['emi amount', 'emi', 'monthly emi', 'installment'],
    required: false,
    type: 'number'
  },
  pos: {
    aliases: ['pos', 'point of sale'],
    required: false,
    type: 'string'
  },
  bucketStatus: {
    aliases: ['bucket status', 'bucket', 'dpd bucket'],
    required: false,
    type: 'string'
  },
  address: {
    aliases: ['address', 'customer address', 'borrower address'],
    required: false,
    type: 'string'
  },
  branchName: {
    aliases: ['branch name', 'branch', 'branch allocation'],
    required: false,
    type: 'string'
  },
  firstConfirmedName: {
    aliases: ['1st confirmed name', 'first confirmed name', 'confirmed name'],
    required: false,
    type: 'string'
  },
  firstConfirmerPhone: {
    aliases: ['1st confirmer phone number', 'first confirmer phone', 'confirmed phone'],
    required: false,
    type: 'string'
  },
  secondConfirmedName: {
    aliases: ['2nd confirmed name', 'second confirmed name'],
    required: false,
    type: 'string'
  },
  secondConfirmerPhone: {
    aliases: ['2nd confirmer phone number', 'second confirmer phone'],
    required: false,
    type: 'string'
  },
  thirdConfirmerName: {
    aliases: ['3rd confirmer name', 'third confirmer name'],
    required: false,
    type: 'string'
  },
  thirdConfirmerPhone: {
    aliases: ['3rd confirmer phone number', 'third confirmer phone'],
    required: false,
    type: 'string'
  },
  zone: {
    aliases: ['zone', 'area zone'],
    required: false,
    type: 'string'
  },
  areaOffice: {
    aliases: ['area office', 'office'],
    required: false,
    type: 'string'
  },
  region: {
    aliases: ['region', 'state'],
    required: false,
    type: 'string'
  },
  allocation: {
    aliases: ['allocation', 'branch allocation'],
    required: false,
    type: 'string'
  },
  vehicleModel: {
    aliases: ['vehicle model', 'model', 'variant'],
    required: false,
    type: 'string'
  },
  productName: {
    aliases: ['product name', 'product', 'loan product'],
    required: false,
    type: 'string'
  }
};

// Normalize string for comparison
const normalizeString = (str) => {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Validate data against field mapping
const validateData = (data, fieldMapping) => {
  const errors = [];
  const warnings = [];

  for (const [field, config] of Object.entries(fieldMapping)) {
    if (config.required && (!data[field] || data[field].toString().trim() === '')) {
      errors.push(`Required field '${field}' is missing or empty`);
    }

    if (data[field] && config.type === 'number') {
      const numValue = parseFloat(data[field]);
      if (isNaN(numValue)) {
        warnings.push(`Field '${field}' should be a number, got: ${data[field]}`);
      }
    }

    if (data[field] && config.type === 'string' && data[field].length > 255) {
      warnings.push(`Field '${field}' is too long (${data[field].length} characters)`);
    }

    // Special validation for registration number
    if (field === 'registrationNumber' && data[field]) {
      const regNumber = data[field];
      // Check if it's a valid format after formatting (should be alphanumeric)
      if (!/^[A-Z0-9]+$/.test(regNumber)) {
        warnings.push(`Registration number '${regNumber}' contains invalid characters after formatting`);
      }
      // Check reasonable length (typically 8-15 characters for Indian registration numbers)
      if (regNumber.length < 6 || regNumber.length > 15) {
        warnings.push(`Registration number '${regNumber}' has unusual length (${regNumber.length} characters)`);
      }
    }
  }

  return { errors, warnings };
};

// Format registration number by removing hyphens and spaces
const formatRegistrationNumber = (regNumber) => {
  if (!regNumber || typeof regNumber !== 'string') return regNumber;
  
  const original = regNumber;
  // Remove hyphens, spaces, and convert to uppercase
  const formatted = regNumber.replace(/[-\s]/g, '').toUpperCase();
  
  // Log formatting if there was a change
  if (original !== formatted) {
    console.log(`Registration number formatted: "${original}" → "${formatted}"`);
  }
  
  return formatted;
};

// Format phone number by removing spaces, hyphens, and brackets
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') return phoneNumber;
  
  const original = phoneNumber;
  // Remove spaces, hyphens, brackets, and plus signs, keep only digits
  const formatted = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
  
  // Log formatting if there was a change
  if (original !== formatted && formatted !== '') {
    console.log(`Phone number formatted: "${original}" → "${formatted}"`);
  }
  
  return formatted;
};

// Apply field-specific formatting
const applyFieldFormatting = (field, value) => {
  if (!value || value === '') return value;
  
  switch (field) {
    case 'registrationNumber':
      return formatRegistrationNumber(value);
    case 'firstConfirmerPhone':
    case 'secondConfirmerPhone':
    case 'thirdConfirmerPhone':
      return formatPhoneNumber(value);
    case 'engineNumber':
    case 'chassisNumber':
      // Remove spaces and hyphens from engine/chassis numbers and convert to uppercase
      return value.replace(/[\s\-]/g, '').toUpperCase();
    default:
      return value;
  }
};

// Extract data from row using field mapping
// If providedFieldMap is passed as { standardField: fileColumnName }, it takes precedence.
// Only extracts data for fields that are explicitly mapped when providedFieldMap is provided
const extractDataFromRow = (row, headerMap, providedFieldMap) => {
  const extractedData = {};
  
  // If explicit mapping is provided, ONLY process mapped fields
  if (providedFieldMap && Object.keys(providedFieldMap).length > 0) {
    for (const [field, mappedHeader] of Object.entries(providedFieldMap)) {
      // Only process if this field exists in FIELD_MAPPING and has a valid mapping
      if (FIELD_MAPPING[field] && mappedHeader && mappedHeader.trim() !== '') {
        let value = '';
        if (row[mappedHeader] !== undefined && row[mappedHeader] !== null && row[mappedHeader] !== '') {
          value = String(row[mappedHeader]).trim();
          // Apply field-specific formatting
          value = applyFieldFormatting(field, value);
        }
        extractedData[field] = value;
      }
    }
  } else {
    // Fallback: use automatic mapping with aliases (existing behavior)
    for (const [field, config] of Object.entries(FIELD_MAPPING)) {
      let value = '';
      
      // Try aliases for automatic mapping
      for (const alias of config.aliases) {
        const normalizedAlias = normalizeString(alias);
        const header = headerMap[normalizedAlias];
        if (header && row[header] !== undefined && row[header] !== null && row[header] !== '') {
          value = String(row[header]).trim();
          // Apply field-specific formatting
          value = applyFieldFormatting(field, value);
          break;
        }
      }
      
      extractedData[field] = value;
    }
  }
  
  return extractedData;
};

// Save/load header mappings per tenant + vehicleType + bank
router.get('/mappings', async (req, res) => {
  try {
    const { vehicleType = '', bankId = '' } = req.query;
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const conn = await getTenantDB(tenant.name);
    const Mapping = conn.model('HeaderMapping', new mongoose.Schema({
      vehicleType: String,
      bankId: String,
      bankName: String,
      mapping: Object,
      updatedAt: { type: Date, default: Date.now }
    }, { strict: false }), 'header_mappings');

    const doc = await Mapping.findOne({ vehicleType, bankId }).lean();
    res.json({ success: true, data: doc?.mapping || {} });
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ success: false, message: 'Failed to load mappings' });
  }
});

router.post('/mappings', async (req, res) => {
  try {
    const { vehicleType = '', bankId = '', bankName = '', mapping = {} } = req.body || {};
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const conn = await getTenantDB(tenant.name);
    const Mapping = conn.model('HeaderMapping', new mongoose.Schema({
      vehicleType: String,
      bankId: String,
      bankName: String,
      mapping: Object,
      updatedAt: { type: Date, default: Date.now }
    }, { strict: false }), 'header_mappings');

    const doc = await Mapping.findOneAndUpdate(
      { vehicleType, bankId },
      { $set: { vehicleType, bankId, bankName, mapping, updatedAt: new Date() } },
      { new: true, upsert: true }
    ).lean();
    res.json({ success: true, message: 'Mapping saved', data: doc.mapping });
  } catch (error) {
    console.error('Save mappings error:', error);
    res.status(500).json({ success: false, message: 'Failed to save mappings' });
  }
});

// Get banks/clients for dropdown
router.get('/banks', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);
    const Client = conn.model('Client', new mongoose.Schema({}, { strict: false }), 'clients');
    
    const clients = await Client.find({}, { name: 1, status: 1 })
      .sort({ name: 1 })
      .lean();

    const banks = clients.map(client => ({
      id: String(client._id),
      name: client.name || 'Unnamed Client',
      status: client.status || 'active'
    }));

    res.json({ success: true, data: banks });
  } catch (error) {
    console.error('Error fetching banks:', error);
    res.status(500).json({ success: false, message: 'Failed to load banks' });
  }
});

// Preview data before upload
router.post('/preview', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  const PREVIEW_TIMEOUT = 30000; // 30 seconds timeout for preview
  
  // Set response timeout
  req.setTimeout(PREVIEW_TIMEOUT);
  res.setTimeout(PREVIEW_TIMEOUT);
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    // Check file size before processing
    const fileSizeMB = req.file.size / (1024 * 1024);
    const MAX_PREVIEW_SIZE_MB = 50; // 50MB limit for preview
    
    if (fileSizeMB > MAX_PREVIEW_SIZE_MB) {
      console.warn(`⚠️ File too large for preview: ${fileSizeMB.toFixed(2)} MB`);
      return res.status(413).json({ 
        success: false, 
        message: `File is too large for preview (${fileSizeMB.toFixed(2)} MB). Maximum allowed: ${MAX_PREVIEW_SIZE_MB} MB. Please use a smaller file or proceed directly to upload.`,
        error: 'FILE_TOO_LARGE_FOR_PREVIEW' 
      });
    }

    console.log(`📂 Preview: Reading file ${req.file.originalname} (${fileSizeMB.toFixed(2)} MB)`);

    // Parse Excel/CSV file with timeout protection
    const password = req.body?.password || undefined;
    let workbook;
    try {
      // Use memory-efficient options
      workbook = XLSX.read(req.file.buffer, { 
        type: 'buffer', 
        password,
        cellStyles: false,
        cellDates: false,
        dense: false
      });
    } catch (err) {
      console.error('Preview read error:', err);
      const msg = String(err?.message || '').toLowerCase();
      const looksEncrypted = msg.includes('password') || msg.includes('encrypted') || msg.includes('decrypt') || msg.includes('protected');
      if (looksEncrypted && !password) {
        return res.status(400).json({ success: false, message: 'This file is password-protected. Please enter the password.', error: 'PASSWORD_REQUIRED' });
      }
      if (looksEncrypted && password) {
        return res.status(400).json({ success: false, message: 'Invalid password. Please try again.', error: 'INVALID_PASSWORD' });
      }
      if (msg.includes('out of memory') || msg.includes('memory')) {
        return res.status(413).json({ 
          success: false, 
          message: 'File is too large to preview. Please proceed directly to upload or split the file.',
          error: 'FILE_TOO_LARGE' 
        });
      }
      return res.status(400).json({ success: false, message: 'Unable to read file. Ensure it is a valid Excel/CSV.', error: 'READ_FAILED' });
    }
    
    const sheetName = workbook.SheetNames[0];
    let worksheet = workbook.Sheets[sheetName];
    
    // Check worksheet size before parsing
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const totalCells = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
    const maxPreviewCells = 2 * 1000 * 1000; // 2 million cells for preview
    
    if (totalCells > maxPreviewCells) {
      workbook = null;
      worksheet = null;
      return res.status(413).json({ 
        success: false, 
        message: `File is too large for preview (${totalCells.toLocaleString()} cells). Please proceed directly to upload.`,
        error: 'FILE_TOO_LARGE_FOR_PREVIEW' 
      });
    }
    
    console.log(`📊 Preview: File dimensions ${range.e.r + 1} rows × ${range.e.c + 1} columns`);
    
    // Parse with timeout protection and better options
    let rows;
    try {
      // Use sheet_to_json with options to handle large files better
      rows = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '',
        blankrows: false,  // Skip blank rows to save memory
        raw: false
      });
    } catch (parseError) {
      console.error('Preview parse error:', parseError);
      workbook = null;
      worksheet = null;
      return res.status(400).json({ 
        success: false, 
        message: `Error parsing file: ${parseError.message}. The file might be corrupted.`,
        error: 'PARSE_ERROR' 
      });
    }
    
    // Clear memory immediately
    workbook = null;
    worksheet = null;
    req.file.buffer = null;

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data found in file' });
    }
    
    // Limit preview processing - don't process more than 50k rows for preview
    const MAX_PREVIEW_ROWS = 50000;
    if (rows.length > MAX_PREVIEW_ROWS) {
      console.warn(`⚠️ Large file in preview: ${rows.length} rows. Limiting to first ${MAX_PREVIEW_ROWS} rows.`);
      rows = rows.slice(0, MAX_PREVIEW_ROWS);
    }

    // Create header mapping
    const headerKeys = Object.keys(rows[0]);
    const headerMap = {};
    for (const key of headerKeys) {
      headerMap[normalizeString(key)] = key;
    }

    // Optional: use provided mapping
    let providedFieldMap = {};
    try {
      if (req.body && req.body.mapping) {
        providedFieldMap = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping;
        console.log('Preview using explicit field mapping:', providedFieldMap);
        
        // Log which columns will be ignored in preview
        const mappedColumns = Object.values(providedFieldMap);
        const unmappedColumns = headerKeys.filter(header => !mappedColumns.includes(header));
        if (unmappedColumns.length > 0) {
          console.log('Preview - Unmapped columns (will be ignored):', unmappedColumns);
        }
      } else {
        console.log('Preview - No explicit mapping provided, using automatic field detection');
      }
    } catch (error) {
      console.error('Preview - Error parsing field mapping:', error);
    }

    // Process first 10 rows for normalized preview (with timeout check)
    const previewData = [];
    const maxPreviewRows = Math.min(10, rows.length);
    
    for (let i = 0; i < maxPreviewRows; i++) {
      // Check timeout
      if (Date.now() - startTime > PREVIEW_TIMEOUT - 5000) {
        console.warn('⚠️ Preview timeout approaching, limiting processing');
        break;
      }
      
      try {
        const row = rows[i];
        if (!row || typeof row !== 'object') continue;
        
        const extractedData = extractDataFromRow(row, headerMap, providedFieldMap);
        const validation = validateData(extractedData, FIELD_MAPPING);
        
        previewData.push({
          ...extractedData,
          status: validation.errors.length > 0 ? 'Error' : 'Valid',
          errors: validation.errors,
          warnings: validation.warnings
        });
      } catch (rowError) {
        console.error(`Error processing preview row ${i}:`, rowError.message);
        // Continue with next row
      }
    }

    // Limit raw rows to prevent memory issues
    const maxRawRows = Math.min(200, rows.length);
    const rawRows = rows.slice(0, maxRawRows);

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Preview completed in ${processingTime}s: ${previewData.length} preview rows, ${rows.length} total rows`);

    res.json({
      success: true,
      data: previewData,
      totalRows: rows.length,
      headers: headerKeys,
      rawRows: rawRows,
      processingTime: processingTime
    });

  } catch (error) {
    console.error('Preview error:', error);
    
    // Check if it's a timeout
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return res.status(408).json({ 
        success: false, 
        message: 'Preview timeout. File is too large or complex. Please proceed directly to upload.',
        error: 'PREVIEW_TIMEOUT' 
      });
    }
    
    // Check if response was already sent
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to preview data',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
});

// Upload file with enhanced processing
router.post('/upload', upload.single('file'), async (req, res) => {
  const uploadId = generateUploadId();
  
  try {
    const { vehicleType, bankId, bankName } = req.body;
    
    // Initialize progress
    uploadProgressStore.set(uploadId, {
      progress: 0,
      message: 'Starting upload...',
      totalRows: 0,
      processedRows: 0,
      inserted: 0,
      failed: 0,
      timestamp: Date.now()
    });
    
    // Send upload ID in response headers for progress tracking
    res.setHeader('X-Upload-Id', uploadId);
    
    if (!vehicleType || !req.file) {
      uploadProgressStore.set(uploadId, {
        progress: 0,
        message: 'Error: Vehicle type and file are required',
        totalRows: 0,
        processedRows: 0,
        inserted: 0,
        failed: 0,
        timestamp: Date.now()
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Vehicle type and file are required' 
      });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);

    // Determine collection name based on vehicle type
    const collectionName = vehicleType === 'FourWheeler' 
      ? 'four_wheeler_data' 
      : vehicleType === 'Commercial' 
        ? 'commercial_data' 
        : 'two_wheeler_data';

    // Create upload history schema
    const uploadSchema = new mongoose.Schema({
      bankName: String,
      bankId: String,
      vehicleType: String,
      fileName: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      uploadDate: { type: Date, default: Date.now },
      status: { type: String, default: 'Completed' },
      totalRecords: Number,
      processedRecords: Number,
      failedRecords: Number,
      errors: [String],
      warnings: [String]
    }, { timestamps: true });

    const UploadModel = conn.model('Upload', uploadSchema, `${collectionName}_uploads`);

    // Parse Excel/CSV file (support password if provided)
    // Add memory-efficient options for large files
    const password = req.body?.password || undefined;
    let workbook;
    try {
      console.log(`📂 Reading Excel file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // Use cellStyles: false and cellDates: false to reduce memory usage
      workbook = XLSX.read(req.file.buffer, { 
        type: 'buffer', 
        password,
        cellStyles: false, // Don't parse styles to save memory
        cellDates: false,  // Don't parse dates to save memory
        dense: false       // Use sparse mode for large files
      });
      
      console.log(`✅ File parsed successfully. Sheets: ${workbook.SheetNames.length}`);
    } catch (err) {
      console.error('Excel parsing error:', err);
      const msg = String(err?.message || '').toLowerCase();
      const looksEncrypted = msg.includes('password') || msg.includes('encrypted') || msg.includes('decrypt') || msg.includes('protected');
      if (looksEncrypted && !password) {
        return res.status(400).json({ success: false, message: 'This file is password-protected. Please enter the password.', error: 'PASSWORD_REQUIRED' });
      }
      if (looksEncrypted && password) {
        return res.status(400).json({ success: false, message: 'Invalid password. Please try again.', error: 'INVALID_PASSWORD' });
      }
      if (msg.includes('out of memory') || msg.includes('memory')) {
        return res.status(413).json({ success: false, message: 'File is too large to process. Please split it into smaller files.', error: 'FILE_TOO_LARGE' });
      }
      return res.status(400).json({ success: false, message: 'Unable to read file. Ensure it is a valid Excel/CSV.', error: 'READ_FAILED' });
    }
    
    const sheetName = workbook.SheetNames[0];
    let worksheet = workbook.Sheets[sheetName];
    
    // Check worksheet range to prevent processing extremely large files
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const totalCells = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
    const maxCells = 10 * 1000 * 1000; // 10 million cells limit
    
    if (totalCells > maxCells) {
      workbook = null;
      worksheet = null;
      return res.status(413).json({ 
        success: false, 
        message: `File is too large (${totalCells.toLocaleString()} cells). Maximum allowed: ${maxCells.toLocaleString()} cells. Please split the file.`,
        error: 'FILE_TOO_LARGE' 
      });
    }
    
    console.log(`📊 File dimensions: ${range.e.r + 1} rows × ${range.e.c + 1} columns (${totalCells.toLocaleString()} cells)`);
    
    // Update progress: Parsing file
    uploadProgressStore.set(uploadId, {
      progress: 5,
      message: 'Parsing Excel file...',
      totalRows: 0,
      processedRows: 0,
      inserted: 0,
      failed: 0,
      timestamp: Date.now()
    });
    
    // Parse with timeout protection and better options
    let rows;
    try {
      // Use sheet_to_json with options to handle large files better
      rows = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '',           // Default value for empty cells
        blankrows: false,     // Skip blank rows to save memory
        raw: false,           // Convert values to strings/numbers
        dateNF: 'yyyy-mm-dd'  // Date format
      });
    } catch (parseError) {
      console.error('Error parsing worksheet:', parseError);
      workbook = null;
      worksheet = null;
      req.file.buffer = null;
      return res.status(400).json({ 
        success: false, 
        message: `Error parsing file: ${parseError.message}. The file might be corrupted or too complex.`,
        error: 'PARSE_ERROR' 
      });
    }
    
    // Clear memory - help garbage collector
    workbook = null;
    worksheet = null;
    req.file.buffer = null; // Clear file buffer after parsing
    
    console.log(`📊 Extracted ${rows.length} rows from sheet "${sheetName}"`);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data found in file' });
    }
    
    // Check for extremely large row count
    const MAX_ROWS = 500000; // 500k rows limit
    if (rows.length > MAX_ROWS) {
      return res.status(413).json({ 
        success: false, 
        message: `File has too many rows (${rows.length.toLocaleString()}). Maximum allowed: ${MAX_ROWS.toLocaleString()} rows. Please split the file.`,
        error: 'TOO_MANY_ROWS' 
      });
    }

    // Warn if file is very large
    if (rows.length > 50000) {
      console.warn(`⚠️ Large file detected: ${rows.length} rows. Processing may take several minutes.`);
    }

    // Create header mapping with validation
    if (!rows[0] || typeof rows[0] !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid file format. First row should contain column headers.',
        error: 'INVALID_FORMAT' 
      });
    }
    
    const headerKeys = Object.keys(rows[0]);
    
    // Check for too many columns
    const MAX_COLUMNS = 500; // 500 columns limit
    if (headerKeys.length > MAX_COLUMNS) {
      return res.status(413).json({ 
        success: false, 
        message: `File has too many columns (${headerKeys.length}). Maximum allowed: ${MAX_COLUMNS} columns. Please reduce the number of columns.`,
        error: 'TOO_MANY_COLUMNS' 
      });
    }
    
    const headerMap = {};
    for (const key of headerKeys) {
      // Skip very long header names that might cause issues
      if (key && key.length < 500) {
        headerMap[normalizeString(key)] = key;
      }
    }
    
    if (Object.keys(headerMap).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid column headers found in file.',
        error: 'NO_HEADERS' 
      });
    }

    // Optional: mapping provided by client
    let providedFieldMap = {};
    try {
      if (req.body && req.body.mapping) {
        providedFieldMap = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping;
        console.log('Using explicit field mapping:', providedFieldMap);
        
        // Log which columns will be ignored
        const mappedColumns = Object.values(providedFieldMap);
        const unmappedColumns = headerKeys.filter(header => !mappedColumns.includes(header));
        if (unmappedColumns.length > 0) {
          console.log('Unmapped columns (will be ignored):', unmappedColumns);
        }
      } else {
        console.log('No explicit mapping provided, using automatic field detection');
      }
    } catch (error) {
      console.error('Error parsing field mapping:', error);
    }

    // Process rows in batches to prevent memory overflow
    const BATCH_SIZE = 1000; // Process 1000 rows at a time
    const INSERT_BATCH_SIZE = 500; // Insert 500 records at a time
    const allErrors = [];
    const allWarnings = [];
    let processedCount = 0;
    let failedCount = 0;
    let totalInserted = 0;

    const mainCollection = conn.collection(collectionName);
    
    // Create indexes for better performance (only once)
    try {
      await mainCollection.createIndex({ registrationNumber: 1 });
      await mainCollection.createIndex({ customerName: 1 });
      await mainCollection.createIndex({ bankName: 1 });
    } catch (indexError) {
      // Indexes might already exist, ignore error
      console.log('Index creation note:', indexError.message);
    }

    // Process rows in batches
    const totalRows = rows.length;
    console.log(`📊 Processing ${totalRows} rows in batches of ${BATCH_SIZE}...`);
    
    // Update progress: File parsed
    uploadProgressStore.set(uploadId, {
      progress: 10,
      message: `File parsed. Processing ${totalRows} rows...`,
      totalRows: totalRows,
      processedRows: 0,
      inserted: 0,
      failed: 0,
      timestamp: Date.now()
    });

    for (let batchStart = 0; batchStart < totalRows; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRows);
      const batch = rows.slice(batchStart, batchEnd);
      
      // Process this batch
      const batchProcessedData = [];
      
      for (let i = 0; i < batch.length; i++) {
        const rowIndex = batchStart + i;
        const row = batch[i];
        
        // Skip invalid rows
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          failedCount++;
          if (allErrors.length < 100) {
            allErrors.push(`Row ${rowIndex + 1}: Invalid row format`);
          }
          continue;
        }
        
        // Skip rows with too many properties (might be corrupted)
        const rowKeys = Object.keys(row);
        if (rowKeys.length > MAX_COLUMNS * 2) {
          failedCount++;
          if (allErrors.length < 100) {
            allErrors.push(`Row ${rowIndex + 1}: Row has too many columns (${rowKeys.length}), skipping`);
          }
          continue;
        }
        
        try {
          const extractedData = extractDataFromRow(row, headerMap, providedFieldMap);
          const validation = validateData(extractedData, FIELD_MAPPING);

          if (validation.errors.length > 0) {
            failedCount++;
            // Limit error messages to prevent memory issues
            if (allErrors.length < 100) {
              allErrors.push(`Row ${rowIndex + 1}: ${validation.errors.join(', ')}`);
            }
          } else {
            processedCount++;
            batchProcessedData.push({
              ...extractedData,
              bankName: bankName || '',
              bankId: bankId || '',
              vehicleType: vehicleType,
              fileName: req.file.originalname,
              uploadDate: new Date(),
              uploadedBy: req.user.userId,
              raw: row
            });
          }

          // Limit warnings to prevent memory issues
          if (allWarnings.length < 100) {
            allWarnings.push(...validation.warnings.map(w => `Row ${rowIndex + 1}: ${w}`));
          }
        } catch (rowError) {
          failedCount++;
          console.error(`Error processing row ${rowIndex + 1}:`, rowError.message);
          if (allErrors.length < 100) {
            allErrors.push(`Row ${rowIndex + 1}: Processing error - ${rowError.message}`);
          }
        }
      }

      // Insert this batch in smaller chunks
      if (batchProcessedData.length > 0) {
        for (let insertStart = 0; insertStart < batchProcessedData.length; insertStart += INSERT_BATCH_SIZE) {
          const insertBatch = batchProcessedData.slice(insertStart, insertStart + INSERT_BATCH_SIZE);
          
          try {
            const result = await mainCollection.insertMany(insertBatch, { ordered: false });
            totalInserted += result.insertedCount || insertBatch.length;
          } catch (insertError) {
            // Handle partial insertions
            if (insertError.writeErrors) {
              const inserted = insertError.result?.insertedCount || 0;
              totalInserted += inserted;
              failedCount += (insertBatch.length - inserted);
              console.error(`Partial batch insert: ${inserted}/${insertBatch.length} inserted`);
            } else {
              // If all failed, count them
              failedCount += insertBatch.length;
              console.error(`Batch insert failed:`, insertError.message);
            }
          }
        }
      }

      // Log progress
      const progressPercent = ((batchEnd / totalRows) * 100).toFixed(1);
      console.log(`✅ Processed ${batchEnd}/${totalRows} rows (${progressPercent}%) - Inserted: ${totalInserted}, Failed: ${failedCount}`);
      
      // Update progress store (10% for parsing, 90% for processing)
      const overallProgress = Math.min(10 + Math.round((batchEnd / totalRows) * 90), 95);
      uploadProgressStore.set(uploadId, {
        progress: overallProgress,
        message: `Processing rows: ${batchEnd}/${totalRows} (${progressPercent}%)`,
        totalRows: totalRows,
        processedRows: batchEnd,
        inserted: totalInserted,
        failed: failedCount,
        timestamp: Date.now()
      });

      // Allow event loop to breathe between batches
      if (batchEnd < totalRows) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    // Update progress: Processing complete, saving...
    uploadProgressStore.set(uploadId, {
      progress: 95,
      message: 'Processing complete. Saving to database...',
      totalRows: totalRows,
      processedRows: totalRows,
      inserted: totalInserted,
      failed: failedCount,
      timestamp: Date.now()
    });

    // Save upload record
    const uploadRecord = new UploadModel({
      bankName: bankName || '',
      bankId: bankId || '',
      vehicleType: vehicleType,
      fileName: req.file.originalname,
      uploadedBy: req.user.userId,
      totalRecords: totalRows,
      processedRecords: processedCount,
      failedRecords: failedCount,
      errors: allErrors.slice(0, 50), // Limit stored errors
      warnings: allWarnings.slice(0, 50) // Limit stored warnings
    });

    await uploadRecord.save();
    
    // Update progress: Complete
    uploadProgressStore.set(uploadId, {
      progress: 100,
      message: 'Upload completed successfully!',
      totalRows: totalRows,
      processedRows: totalRows,
      inserted: totalInserted,
      failed: failedCount,
      timestamp: Date.now()
    });
    
    console.log(`✅ Upload complete: ${totalInserted} inserted, ${failedCount} failed out of ${totalRows} total`);

    // Attempt to (asynchronously) rebuild the offline snapshot for instant mobile download
    try {
      const tenantName = tenant.name;
      if (fileManagementRouter && typeof fileManagementRouter.buildTenantSnapshot === 'function') {
        // Fire and forget
        fileManagementRouter.buildTenantSnapshot(tenantName).catch(() => {});
      }
    } catch (_) {}

    // Prepare summary information about mapping
    let mappingSummary = '';
    if (providedFieldMap && Object.keys(providedFieldMap).length > 0) {
      const mappedFields = Object.keys(providedFieldMap);
      const mappedColumns = Object.values(providedFieldMap);
      const unmappedColumns = headerKeys.filter(header => !mappedColumns.includes(header));
      
      mappingSummary = `Processed ${mappedFields.length} mapped fields. `;
      if (unmappedColumns.length > 0) {
        mappingSummary += `${unmappedColumns.length} columns were ignored (not mapped).`;
      }
    } else {
      mappingSummary = 'Used automatic field detection for all columns.';
    }

    // Send push notification to all devices in the tenant (non-blocking)
    // Only send if records were successfully inserted
    if (totalInserted > 0) {
      try {
        const fileName = req.file.originalname || 'data file';
        const notification = createFileUploadNotification(
          fileName,
          vehicleType,
          totalInserted
        );
        
        // Send notification asynchronously (don't block response)
        sendNotificationToTenant(req.user.tenantId, notification)
          .then(result => {
            if (result.success) {
              console.log(`✅ Push notification sent to ${result.deviceCount} devices`);
            } else {
              console.log(`⚠️ Push notification failed: ${result.message}`);
            }
          })
          .catch(err => {
            console.error('❌ Error sending push notification:', err.message);
          });
      } catch (notifError) {
        // Don't fail the upload if notification fails
        console.error('❌ Error preparing push notification:', notifError.message);
      }
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      inserted: totalInserted,
      failed: failedCount,
      total: totalRows,
      database: conn.name,
      collection: collectionName,
      mappingSummary: mappingSummary,
      processedFields: providedFieldMap ? Object.keys(providedFieldMap) : Object.keys(FIELD_MAPPING),
      errors: allErrors.slice(0, 10), // Return first 10 errors
      warnings: allWarnings.slice(0, 10), // Return first 10 warnings
      uploadId: uploadId // Return upload ID for progress tracking
    });

  } catch (error) {
    // Update progress: Error
    uploadProgressStore.set(uploadId, {
      progress: 0,
      message: `Error: ${error.message}`,
      totalRows: 0,
      processedRows: 0,
      inserted: 0,
      failed: 0,
      timestamp: Date.now()
    });
    
    console.error('Upload error:', error);
    
    // Handle specific error types
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        success: false, 
        message: 'File too large. Maximum size allowed is 10GB.',
        error: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        success: false, 
        message: 'Unexpected file field.',
        error: 'INVALID_FILE_FIELD'
      });
    }
    
    if (error.name === 'TimeoutError') {
      return res.status(408).json({ 
        success: false, 
        message: 'Upload timeout. Please try again with a smaller file or check your connection.',
        error: 'UPLOAD_TIMEOUT'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get upload history
router.get('/history', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);
    
    // Get all upload collections
    const collections = await conn.db.listCollections({ name: { $regex: /_uploads$/ } }).toArray();
    
    let allUploads = [];
    
    for (const collection of collections) {
      const UploadModel = conn.model('Upload', new mongoose.Schema({}, { strict: false }), collection.name);
      const uploads = await UploadModel.find({})
        .sort({ uploadDate: -1 })
        .limit(50)
        .lean();
      
      allUploads = allUploads.concat(uploads);
    }
    
    // Sort by upload date
    allUploads.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    res.json({ success: true, data: allUploads });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, message: 'Failed to load upload history' });
  }
});

module.exports = router;