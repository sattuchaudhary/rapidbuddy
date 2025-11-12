

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { initDatabase, countVehicles } from '../utils/db';
import { smartSync, getPerFileSyncStatus } from '../utils/fileSync';
import { getBaseURL, setBaseURLOverride } from '../utils/config';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';


export default function BulkOfflineDownloadScreen() {
  const insets = useSafeAreaInsets();
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [inserted, setInserted] = useState(0);
  const [localCount, setLocalCount] = useState(0);
  const [serverTotal, setServerTotal] = useState(0);
  const [localDownloaded, setLocalDownloaded] = useState(0);
  const [filesInfo, setFilesInfo] = useState({ serverFileCount: 0, localFileCount: 0 });
  const isMountedRef = useRef(true);
  const [offlineRecords, setOfflineRecords] = useState([]);
  const [multiplier, setMultiplier] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    isMountedRef.current = true;
    (async () => {
      try {
        await initDatabase();
        const cnt = await countVehicles();
        if (isMountedRef.current) setLocalCount(cnt || 0);
        await refreshServerStats();
      } catch (e) {}
    })();
    return () => { isMountedRef.current = false; };
  }, []);

  const loadMultiplierFromServer = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        console.log('📊 No token found, using default multiplier');
        if (isMountedRef.current) setMultiplier(1);
        return;
      }

      const res = await axios.get(`${getBaseURL()}/api/tenants/settings`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (res.data?.success && res.data.data?.dataMultiplier) {
        const multiplierValue = res.data.data.dataMultiplier;
        if (isMountedRef.current) {
          setMultiplier(multiplierValue);
          // Also save to AsyncStorage for quick access
          await AsyncStorage.setItem('tenantMultiplier', String(multiplierValue));
        }
        console.log(`📊 Loaded sync multiplier from server: ${multiplierValue}x`);
      } else {
        console.log('📊 No multiplier setting found, using default');
        if (isMountedRef.current) setMultiplier(1);
      }
    } catch (error) {
      console.error('📊 Error loading multiplier from server:', error.response?.status, error.response?.data || error.message);
      // Fallback to AsyncStorage if server fails
      try {
        const m = await AsyncStorage.getItem('tenantMultiplier');
        if (isMountedRef.current) setMultiplier(m ? Number(m) : 1);
      } catch (e) {
        if (isMountedRef.current) setMultiplier(1);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    (async () => {
      // Load multiplier from server (same as DashboardScreen)
      await loadMultiplierFromServer();

      // existing local data load: if you already have a loader function, it will run here.
      // If you have an existing fetch/refresh logic in this component, merge it here.
      try {
        // try common loader names if present in this file/scope
        if (typeof fetchLocalRecords === 'function') {
          const recs = await fetchLocalRecords();
          if (isMountedRef.current) setOfflineRecords(recs || []);
        } else if (typeof loadLocalRecords === 'function') {
          const recs = await loadLocalRecords();
          if (isMountedRef.current) setOfflineRecords(recs || []);
        } else {
          // fallback: set counts from existing states if already managed elsewhere
          if (isMountedRef.current) {
            // keep existing localCount/localDownloaded if they are set elsewhere
            // otherwise try to infer from offlineRecords (if that gets set later)
            setOfflineRecords((prev) => prev || []);
          }
        }
      } catch (e) {
        if (isMountedRef.current) setOfflineRecords([]);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    })();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshServerStats = useCallback(async () => {
    try {
      const s = await getPerFileSyncStatus();
      if (!isMountedRef.current) return;
      setServerTotal(s?.totalServer || 0);
      setLocalDownloaded(s?.totalLocal || 0);
      setFilesInfo({ serverFileCount: s?.serverFileCount || 0, localFileCount: s?.localFileCount || 0 });
      // Also refresh multiplier in case it was changed on server
      await loadMultiplierFromServer();
    } catch (_) {}
  }, [loadMultiplierFromServer]);

  const handleSmartSync = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setProgressPct(0);
    setStatusText('Starting sync...');

    try {
      const syncResult = await smartSync((p) => {
        if (!isMountedRef.current) return;
        setProgressPct(p.progress);
        setStatusText(p.status);
      });

      // Wait a bit to ensure all transactions are committed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh stats and count
      await refreshServerStats();
      // Reload multiplier from server in case it was changed
      await loadMultiplierFromServer();
      const cnt = await countVehicles();
      if (isMountedRef.current) {
        setLocalCount(cnt || 0);
        console.log(`📊 Updated local count after sync: ${cnt}`);
        if (syncResult?.inserted) {
          console.log(`✅ Sync inserted ${syncResult.inserted} records`);
        }
      }

    } catch (error) {
      if (isMountedRef.current) {
        const msg = error?.message || 'An unknown error occurred.';
        setStatusText(`Error: ${msg}`);
        Alert.alert('Sync Failed', msg);
      }
    } finally {
      if (isMountedRef.current) {
        setIsDownloading(false);
      }
    }
  }, [isDownloading, refreshServerStats, loadMultiplierFromServer]);

  const Stat = ({ label, value }) => {
    // Apply multiplier for all stats except "Files" count
    // This includes: Local Records, Server Total, Downloaded (server calc)
    const l = String(label || '').toLowerCase();
    // Don't multiply "Files" count, but multiply everything else
    const shouldMultiply = !l.includes('files');
    const baseVal = Number(value || 0);
    const displayVal = shouldMultiply ? baseVal * (Number(multiplier) || 1) : baseVal;

    return (
      <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{label}</Text>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 }}>{(displayVal || 0).toLocaleString()}</Text>
      </View>
    );
  };

  const Progress = () => (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>Downloading</Text>
        <Text style={{ color: '#fff', fontWeight: '800' }}>{Math.round(progressPct)}%</Text>
      </View>
      <View style={{ height: 10, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(0, Math.min(100, progressPct))}%`, backgroundColor: '#22C55E', height: 10 }} />
      </View>
      {!!statusText && (
        <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>{statusText}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#10121A', paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8 }}>Bulk Offline Download</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>Saare records offline save karne ke liye yeh process run karein. Isse fast offline search possible hoga.</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Stat label="Local Records" value={localCount} />
          <Stat label="Server Total" value={serverTotal} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Stat label="Downloaded (server calc)" value={localDownloaded} />
          <Stat label="Files (local/server)" value={`${filesInfo.localFileCount}/${filesInfo.serverFileCount}`} />
        </View>

        <View style={{ marginTop: 18 }}>
          {!isDownloading ? (
            <TouchableOpacity onPress={handleSmartSync} style={{ backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Start Smart Sync</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 14, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
              <ActivityIndicator color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800' }}>Syncing...</Text>
            </View>
          )}
          <Progress />
        </View>

        <TouchableOpacity onPress={refreshServerStats} style={{ marginTop: 12, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Refresh Stats</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
