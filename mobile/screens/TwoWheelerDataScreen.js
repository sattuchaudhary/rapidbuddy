import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, getErrorMessage } from '../utils/errorHandler';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function TwoWheelerDataScreen({ navigation }) {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedUploads, setSelectedUploads] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportColumns, setExportColumns] = useState({
    regNo: true,
    chassisNo: true,
    branch: false,
    engineNo: false,
    make: true,
    bank: true,
    loanNo: false,
    customerName: false,
    status: false,
  });

  const fetchUploads = useCallback(async (isLoadMore = false, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isLoadMore) {
      setLoading(true);
    }
    setError(null);

    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setError('Please login again');
        return;
      }

      const response = await axios.get(`${getBaseURL()}/api/tenant/data/two-wheeler?page=${page}&limit=20&search=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response.data?.data || [];
      const pagination = response.data?.pagination || {};

      if (isLoadMore) {
        setUploads(prev => [...prev, ...data]);
      } else {
        setUploads(data);
      }

      setHasMore(pagination.page < pagination.pages);
    } catch (err) {
      logError(err, 'fetchUploads');
      const message = getErrorMessage(err, 'Failed to fetch uploads');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, searchQuery]);

  const loadMoreUploads = useCallback(() => {
    if (hasMore && !loading) {
      setPage(prev => prev + 1);
    }
  }, [hasMore, loading]);

  const handleRefresh = useCallback(() => {
    setPage(1);
    setHasMore(true);
    fetchUploads(false, true);
  }, [fetchUploads]);

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
    setPage(1);
    setHasMore(true);
    // Debounce
    const timer = setTimeout(() => {
      fetchUploads();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchUploads]);

  const handleDeleteUpload = useCallback(async (uploadId) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this upload?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('token');
              await axios.delete(`${getBaseURL()}/api/tenant/data/file/${uploadId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              Alert.alert('Success', 'Upload deleted successfully');
              handleRefresh();
            } catch (err) {
              logError(err, 'handleDeleteUpload');
              Alert.alert('Error', getErrorMessage(err, 'Failed to delete upload'));
            }
          },
        },
      ]
    );
  }, [handleRefresh]);

  const handleExportCSV = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      let csvData = [];
      let headers = [];

      if (selectedUploads.length > 0) {
        // Fetch vehicles for selected uploads
        for (const uploadId of selectedUploads) {
          const response = await axios.get(`${getBaseURL()}/api/tenant/data/file/${uploadId}?page=1&limit=100000`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const vehicles = response.data?.data || [];
          csvData.push(...vehicles);
        }

        // Build headers based on selected columns
        if (exportColumns.regNo) headers.push('Registration No');
        if (exportColumns.chassisNo) headers.push('Chassis No');
        if (exportColumns.branch) headers.push('Branch');
        if (exportColumns.engineNo) headers.push('Engine No');
        if (exportColumns.make) headers.push('Make');
        if (exportColumns.bank) headers.push('Bank');
        if (exportColumns.loanNo) headers.push('Loan No');
        if (exportColumns.customerName) headers.push('Customer Name');
        if (exportColumns.status) headers.push('Status');

        // Build rows
        const rows = csvData.map(vehicle => {
          const row = [];
          if (exportColumns.regNo) row.push(vehicle.regNo || '');
          if (exportColumns.chassisNo) row.push(vehicle.chassisNo || '');
          if (exportColumns.branch) row.push(vehicle.branchName || '');
          if (exportColumns.engineNo) row.push(vehicle.engineNo || '');
          if (exportColumns.make) row.push(vehicle.make || '');
          if (exportColumns.bank) row.push(vehicle.bank || '');
          if (exportColumns.loanNo) row.push(vehicle.loanNo || '');
          if (exportColumns.customerName) row.push(vehicle.customerName || '');
          if (exportColumns.status) row.push(vehicle.status || '');
          return row.map(field => `"${field.replace(/"/g, '""')}"`).join(',');
        });

        csvData = [headers.join(','), ...rows];
      } else {
        // Export upload summary
        headers = ['Bank Name', 'Filename', 'User name', 'Upload date', 'Total Record', 'Hold', 'InYard', 'Release', 'Status'];
        csvData = uploads.map(upload => [
          `"${(upload.bankName || '').replace(/"/g, '""')}"`,
          `"${(upload.fileName || '').replace(/"/g, '""')}"`,
          `"${(upload.user || '').replace(/"/g, '""')}"`,
          `"${(upload.uploadDate || '').replace(/"/g, '""')}"`,
          upload.total || 0,
          upload.hold || 0,
          upload.inYard || 0,
          upload.release || 0,
          upload.status || '',
        ].join(','));
        csvData = [headers.join(','), ...csvData];
      }

      const csvContent = csvData.join('\n');
      const fileUri = FileSystem.documentDirectory + 'two_wheeler_export.csv';
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      await Sharing.shareAsync(fileUri);
    } catch (err) {
      logError(err, 'handleExportCSV');
      Alert.alert('Error', getErrorMessage(err, 'Failed to export CSV'));
    }
  }, [selectedUploads, exportColumns, uploads]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  useEffect(() => {
    if (page > 1) {
      fetchUploads(true);
    }
  }, [page, fetchUploads]);

  const renderUploadItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.uploadCard}
      onPress={() =>
        navigation.navigate('VehicleDataDetails', {
          uploadId: item._id,
          vehicleType: 'TwoWheeler',
          fileName: item.fileName,
        })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.bankName}>{item.bankName}</Text>
        <Ionicons name={item.status === 'ok' ? 'checkmark-circle' : 'close-circle'} size={20} color={item.status === 'ok' ? '#10b981' : '#EF4444'} />
      </View>
      <Text style={styles.fileName}>{item.fileName}</Text>
      <Text style={styles.uploadDate}>{item.uploadDate}</Text>
      <View style={styles.statsRow}>
        <View style={styles.totalBadge}>
          <Text style={styles.totalText}>{item.total} records</Text>
        </View>
        <Text style={styles.userName}>{item.user}</Text>
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="eye" size={16} color="#4F46E5" />
          <Text style={styles.actionText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteUpload(item._id)}>
          <Ionicons name="trash" size={16} color="#EF4444" />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ), [navigation, handleDeleteUpload]);

  const renderEmpty = () => {
    if (loading) return null;
    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (uploads.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏍️</Text>
          <Text style={styles.emptyMessage}>No two wheeler data found</Text>
          <Text style={styles.emptySubtitle}>Upload files through Mobile Upload</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyMessage}>No results found</Text>
        <Text style={styles.emptySubtitle}>Try different keywords</Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading || !hasMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#4F46E5" />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Two Wheeler Data</Text>
        <TouchableOpacity style={styles.exportButton} onPress={() => setShowExportModal(true)}>
          <Ionicons name="download" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by file name, bank, customer..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={uploads}
        keyExtractor={(item) => item._id}
        renderItem={renderUploadItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        onEndReached={loadMoreUploads}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={uploads.length === 0 ? styles.emptyList : null}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        getItemLayout={(data, index) => ({ length: 120, offset: 120 * index, index })}
      />

      <Modal visible={showExportModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Columns to Export</Text>
            <ScrollView>
              {Object.keys(exportColumns).map(key => (
                <TouchableOpacity
                  key={key}
                  style={styles.checkboxRow}
                  onPress={() => setExportColumns(prev => ({ ...prev, [key]: !prev[key] }))}
                >
                  <Ionicons
                    name={exportColumns[key] ? 'checkbox' : 'square-outline'}
                    size={20}
                    color="#4F46E5"
                  />
                  <Text style={styles.checkboxLabel}>
                    {key === 'regNo' ? 'Registration No' :
                     key === 'chassisNo' ? 'Chassis No' :
                     key === 'branch' ? 'Branch' :
                     key === 'engineNo' ? 'Engine No' :
                     key === 'make' ? 'Make' :
                     key === 'bank' ? 'Bank' :
                     key === 'loanNo' ? 'Loan No' :
                     key === 'customerName' ? 'Customer Name' :
                     'Status'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowExportModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportModalButton, !Object.values(exportColumns).some(v => v) && styles.disabledButton]}
                onPress={() => {
                  setShowExportModal(false);
                  handleExportCSV();
                }}
                disabled={!Object.values(exportColumns).some(v => v)}
              >
                <Text style={styles.exportModalButtonText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  fileName: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  uploadDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  totalBadge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  totalText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#4F46E5',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 5,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    marginRight: 10,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  exportModalButton: {
    flex: 1,
    marginLeft: 10,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  exportModalButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  emptyList: {
    flexGrow: 1,
  },
});