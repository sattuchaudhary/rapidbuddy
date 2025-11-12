import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert, StatusBar, RefreshControl, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, getErrorMessage } from '../utils/errorHandler';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function VehicleDataDetailsScreen({ route, navigation }) {
  const { uploadId, vehicleType, fileName } = route.params || {};
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [uploadDetails, setUploadDetails] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchVehicles = useCallback(async (isRefresh = false, isLoadMore = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setPage(1);
      setHasMore(true);
    } else if (isLoadMore) {
      if (!hasMore) return;
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setError('Please login again');
        return;
      }

      const params = {
        page: isRefresh ? 1 : page,
        limit: 20,
        search: searchQuery,
        chassisNumber,
        registrationNumber
      };

      const response = await axios.get(`${getBaseURL()}/api/tenant/data/file/${uploadId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        const newVehicles = response.data.data;
        const newUploadDetails = response.data.uploadDetails;
        const pagination = response.data.pagination;

        if (isRefresh || !isLoadMore) {
          setVehicles(newVehicles);
        } else {
          setVehicles(prev => [...prev, ...newVehicles]);
        }

        setUploadDetails(newUploadDetails);
        setHasMore(pagination.page < pagination.pages);
        if (!isLoadMore) setPage(2);
      } else {
        setError(response.data.message || 'Failed to fetch vehicles');
      }
    } catch (err) {
      logError(err, 'fetchVehicles');
      const message = getErrorMessage(err, 'Failed to fetch vehicles');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uploadId, page, searchQuery, chassisNumber, registrationNumber, hasMore]);

  const loadMoreVehicles = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      fetchVehicles(false, true);
    }
  }, [loading, hasMore, fetchVehicles]);

  const handleRefresh = useCallback(() => {
    fetchVehicles(true);
  }, [fetchVehicles]);

  const handleSearch = useCallback(() => {
    setPage(1);
    fetchVehicles(true);
  }, [fetchVehicles]);

  const handleDeleteVehicle = useCallback(async (vehicleId) => {
    Alert.alert(
      'Delete Vehicle',
      'Are you sure you want to delete this vehicle record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('token');
              await axios.delete(`${getBaseURL()}/api/tenant/data/vehicle/${vehicleId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              Alert.alert('Success', 'Vehicle deleted successfully');
              handleRefresh();
            } catch (err) {
              logError(err, 'handleDeleteVehicle');
              Alert.alert('Error', 'Failed to delete vehicle');
            }
          }
        }
      ]
    );
  }, [handleRefresh]);

  const handleViewDetails = useCallback(async (vehicle) => {
    setDetailLoading(true);
    setSelectedVehicle(vehicle);
    setShowDetailModal(true);

    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await axios.get(`${getBaseURL()}/api/tenant/data/vehicle/${vehicle._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSelectedVehicle(response.data.data);
      }
    } catch (err) {
      logError(err, 'handleViewDetails');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleUpdateStatus = useCallback(async (vehicleId, newStatus) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      await axios.put(`${getBaseURL()}/api/tenant/data/vehicle/${vehicleId}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSelectedVehicle(prev => prev ? { ...prev, status: newStatus } : null);
      setVehicles(prev => prev.map(v => v._id === vehicleId ? { ...v, status: newStatus } : v));
      Alert.alert('Success', 'Status updated successfully');
    } catch (err) {
      logError(err, 'handleUpdateStatus');
      Alert.alert('Error', 'Failed to update status');
    }
  }, []);

  const handleExportCSV = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const params = {
        page: 1,
        limit: 100000,
        search: searchQuery,
        chassisNumber,
        registrationNumber
      };

      const response = await axios.get(`${getBaseURL()}/api/tenant/data/file/${uploadId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        const rows = response.data.data;
        const headers = ['Bank', 'Reg No', 'Loan No', 'Customer Name', 'Make', 'Chassis No', 'Engine No', 'Status'];
        const csvRows = [headers.join(',')];
        rows.forEach(v => {
          csvRows.push([
            `"${v.bank || ''}"`,
            `"${v.regNo || ''}"`,
            `"${v.loanNo || ''}"`,
            `"${v.customerName || ''}"`,
            `"${v.make || ''}"`,
            `"${v.chassisNo || ''}"`,
            `"${v.engineNo || ''}"`,
            `"${v.status || ''}"`
          ].join(','));
        });
        const csvContent = '\uFEFF' + csvRows.join('\n');
        const fileUri = FileSystem.documentDirectory + 'vehicle_export.csv';
        await FileSystem.writeAsStringAsync(fileUri, csvContent);
        await Sharing.shareAsync(fileUri);
      }
    } catch (err) {
      logError(err, 'handleExportCSV');
      Alert.alert('Error', 'Failed to export CSV');
    }
  }, [uploadId, searchQuery, chassisNumber, registrationNumber]);

  useEffect(() => {
    if (uploadId) {
      fetchVehicles();
    }
  }, [uploadId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, chassisNumber, registrationNumber]);

  const renderVehicleItem = useCallback(({ item }) => (
    <TouchableOpacity style={styles.vehicleCard} onPress={() => handleViewDetails(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.regNo}>{item.regNo}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status || 'Pending'}</Text>
        </View>
      </View>
      <Text style={styles.bankName}>{item.bank}</Text>
      <Text style={styles.loanNo}>{item.loanNo}</Text>
      <Text style={styles.customerName}>{item.customerName}</Text>
      <View style={styles.makeBadge}>
        <Text style={styles.makeText}>{item.make}</Text>
      </View>
      <Text style={styles.chassisNo}>{item.chassisNo}</Text>
      <Text style={styles.engineNo}>{item.engineNo}</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => handleViewDetails(item)}>
          <Ionicons name="eye" size={20} color="#4F46E5" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteVehicle(item._id)}>
          <Ionicons name="trash" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ), [handleViewDetails, handleDeleteVehicle]);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return '#FFA500';
      case 'hold': return '#F59E0B';
      case 'in yard': case 'inyard': return '#3B82F6';
      case 'released': return '#10B981';
      case 'cancelled': case 'canceled': return '#EF4444';
      default: return '#FFA500';
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{error ? '❌' : vehicles.length === 0 && !loading ? '📋' : '🔍'}</Text>
      <Text style={styles.emptyMessage}>
        {error ? 'Error loading data' : vehicles.length === 0 && !loading ? 'No vehicle data found' : 'No results found'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {error ? 'Please try again' : vehicles.length === 0 && !loading ? 'This file has no vehicle records' : 'Try different filters'}
      </Text>
      {error && (
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Vehicle Details</Text>
        <TouchableOpacity style={styles.exportButton} onPress={handleExportCSV}>
          <Ionicons name="download" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {uploadDetails && (
        <View style={styles.fileInfoCard}>
          <Text style={styles.fileName}>{uploadDetails.fileName}</Text>
          <Text style={styles.bankName}>{uploadDetails.bankName}</Text>
          <View style={styles.vehicleTypeBadge}>
            <Text style={styles.vehicleTypeText}>{uploadDetails.vehicleType}</Text>
          </View>
          <Text style={styles.totalRecords}>Total: {uploadDetails.totalRecords}</Text>
          <Text style={styles.uploadDate}>{uploadDetails.uploadDate ? new Date(uploadDetails.uploadDate).toLocaleDateString() : 'N/A'}</Text>
        </View>
      )}

      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Chassis Number"
          value={chassisNumber}
          onChangeText={setChassisNumber}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Registration Number"
          value={registrationNumber}
          onChangeText={setRegistrationNumber}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="General Search"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={vehicles}
        renderItem={renderVehicleItem}
        keyExtractor={(item) => item._id}
        onEndReached={loadMoreVehicles}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator size="large" color="#4F46E5" /> : null}
      />

      <Modal visible={showDetailModal} animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Vehicle Details</Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {detailLoading ? (
              <ActivityIndicator size="large" color="#4F46E5" />
            ) : selectedVehicle ? (
              <>
                <View style={styles.detailCard}>
                  <Text style={styles.cardTitle}>Basic Details</Text>
                  <View style={styles.detailGrid}>
                    {[
                      ['Registration Number', selectedVehicle.regNo],
                      ['Agreement Number', selectedVehicle.loanNo],
                      ['Make', selectedVehicle.make],
                      ['Engine Number', selectedVehicle.engineNo],
                      ['Product Name', selectedVehicle.productName],
                      ['EMI Amount', selectedVehicle.emiAmount],
                      ['Branch', selectedVehicle.branchName],
                      ['File Name', uploadDetails?.fileName],
                      ['Customer Name', selectedVehicle.customerName],
                      ['Bank Name', selectedVehicle.bank],
                      ['Chassis Number', selectedVehicle.chassisNo],
                      ['Model', selectedVehicle.model],
                      ['Upload Date', selectedVehicle.uploadDate ? new Date(selectedVehicle.uploadDate).toLocaleDateString() : 'N/A'],
                      ['Address', selectedVehicle.address],
                      ['POS', selectedVehicle.pos],
                      ['Season', selectedVehicle.season]
                    ].map(([label, value]) => (
                      <View key={label} style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{label}:</Text>
                        <Text style={styles.detailValue}>{value || 'N/A'}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                {(selectedVehicle.inYard || selectedVehicle.yardName || selectedVehicle.yardLocation) && (
                  <View style={styles.detailCard}>
                    <Text style={styles.cardTitle}>Yard Info</Text>
                    <View style={styles.detailGrid}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>In Yard:</Text>
                        <Text style={styles.detailValue}>{selectedVehicle.inYard || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Yard Name:</Text>
                        <Text style={styles.detailValue}>{selectedVehicle.yardName || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Yard Location:</Text>
                        <Text style={styles.detailValue}>{selectedVehicle.yardLocation || 'N/A'}</Text>
                      </View>
                    </View>
                  </View>
                )}
                {(selectedVehicle.firstConfirmerName || selectedVehicle.secondConfirmerName || selectedVehicle.thirdConfirmerName) && (
                  <View style={styles.detailCard}>
                    <Text style={styles.cardTitle}>Confirmer Details</Text>
                    <View style={styles.detailGrid}>
                      {selectedVehicle.firstConfirmerName && (
                        <>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>First Confirmer Name:</Text>
                            <Text style={styles.detailValue}>{selectedVehicle.firstConfirmerName}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>First Confirmer Phone:</Text>
                            <Text style={styles.detailValue}>{selectedVehicle.firstConfirmerPhone || 'N/A'}</Text>
                          </View>
                        </>
                      )}
                      {selectedVehicle.secondConfirmerName && (
                        <>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Second Confirmer Name:</Text>
                            <Text style={styles.detailValue}>{selectedVehicle.secondConfirmerName}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Second Confirmer Phone:</Text>
                            <Text style={styles.detailValue}>{selectedVehicle.secondConfirmerPhone || 'N/A'}</Text>
                          </View>
                        </>
                      )}
                      {selectedVehicle.thirdConfirmerName && (
                        <>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Third Confirmer Name:</Text>
                            <Text style={styles.detailValue}>{selectedVehicle.thirdConfirmerName}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Third Confirmer Phone:</Text>
                            <Text style={styles.detailValue}>{selectedVehicle.thirdConfirmerPhone || 'N/A'}</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                )}
                {selectedVehicle.raw && Object.keys(selectedVehicle.raw).length > 0 && (
                  <View style={styles.detailCard}>
                    <Text style={styles.cardTitle}>Additional Fields</Text>
                    <View style={styles.detailGrid}>
                      {Object.entries(selectedVehicle.raw)
                        .filter(([k]) => !['registrationNumber', 'chassisNumber', 'agreementNumber', 'bankName', 'vehicleMake', 'customerName', 'address', 'branchName', 'status', 'engineNumber', 'engineNo', 'productName', 'emiAmount', 'pos', 'POS', 'model', 'vehicleModel', 'uploadDate', 'createdAt', 'bucket', 'season', 'seasoning', 'fileName', 'inYard', 'yardName', 'yardLocation', 'firstConfirmerName', 'firstConfirmerPhone', 'secondConfirmerName', 'secondConfirmerPhone', 'thirdConfirmerName', 'thirdConfirmerPhone'].includes(k))
                        .map(([key, value]) => (
                          <View key={key} style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{key}:</Text>
                            <Text style={styles.detailValue}>{String(value || 'N/A')}</Text>
                          </View>
                        ))}
                    </View>
                  </View>
                )}
              </>
            ) : null}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.statusButton, { backgroundColor: '#FFA500' }]} onPress={() => handleUpdateStatus(selectedVehicle?._id, 'Pending')}>
              <Text style={styles.statusButtonText}>Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusButton, { backgroundColor: '#F59E0B' }]} onPress={() => handleUpdateStatus(selectedVehicle?._id, 'Hold')}>
              <Text style={styles.statusButtonText}>Hold</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusButton, { backgroundColor: '#3B82F6' }]} onPress={() => handleUpdateStatus(selectedVehicle?._id, 'In Yard')}>
              <Text style={styles.statusButtonText}>In Yard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusButton, { backgroundColor: '#10B981' }]} onPress={() => handleUpdateStatus(selectedVehicle?._id, 'Released')}>
              <Text style={styles.statusButtonText}>Released</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusButton, { backgroundColor: '#EF4444' }]} onPress={() => handleUpdateStatus(selectedVehicle?._id, 'Cancelled')}>
              <Text style={styles.statusButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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
  fileInfoCard: {
    backgroundColor: '#F9FAFB',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  fileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  bankName: {
    fontSize: 14,
    color: '#666',
  },
  vehicleTypeBadge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  vehicleTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  totalRecords: {
    fontSize: 14,
    color: '#000',
  },
  uploadDate: {
    fontSize: 12,
    color: '#666',
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  vehicleCard: {
    backgroundColor: '#fff',
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
  regNo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loanNo: {
    fontSize: 14,
    color: '#666',
  },
  customerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  makeBadge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  makeText: {
    color: '#fff',
    fontSize: 12,
  },
  chassisNo: {
    fontSize: 12,
    color: '#666',
  },
  engineNo: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
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
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailRow: {
    width: '50%',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  modalFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 4,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});