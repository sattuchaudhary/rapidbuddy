import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, StatusBar, RefreshControl, Modal, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, showErrorAlert, getErrorMessage } from '../utils/errorHandler';

const formatUserType = (userType) => {
  if (!userType) return 'N/A';
  return userType === 'repo_agent' ? 'Repo Agent' : userType === 'office_staff' ? 'Office Staff' : userType;
};

export default function PaymentApprovalsScreen({ navigation }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchPendingPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
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

      const response = await axios.get(`${getBaseURL()}/api/payments?status=pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const paymentsData = response.data?.data || [];
      setPayments(paymentsData);
    } catch (err) {
      logError(err, 'fetchPendingPayments');
      const message = getErrorMessage(err, 'Failed to fetch pending payments');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingPayments();
  }, [fetchPendingPayments]);

  const handleRefresh = useCallback(() => {
    fetchPendingPayments(true);
  }, [fetchPendingPayments]);

  const handleApprove = async (paymentId, mobileUserId) => {
    Alert.alert(
      'Approve Payment',
      `Approve payment of ₹${selectedPayment?.amount} for ${selectedPayment?.planPeriod} plan?\n\n${selectedPayment?.submittedByName ? `Submitted by: ${selectedPayment.submittedByName} (${selectedPayment.submittedByRole})\nPhone: ${selectedPayment.submittedByPhone}\n\n` : ''}This will extend the user's subscription.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessing(true);
            try {
              const token = await SecureStore.getItemAsync('token');
              await axios.post(`${getBaseURL()}/api/payments/${paymentId}/approve`, { mobileUserId }, {
                headers: { Authorization: `Bearer ${token}` }
              });

              Alert.alert('Payment Approved', `Payment approved for ${selectedPayment.submittedByName || 'user'}. Subscription has been extended.`);
              setPayments(prev => prev.filter(p => p._id !== paymentId));
              setShowDetailModal(false);
            } catch (err) {
              logError(err, 'handleApprove');
              const message = getErrorMessage(err, 'Failed to approve payment');
              Alert.alert('Error', message);
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handleReject = async (paymentId) => {
    if (!rejectionReason.trim() || rejectionReason.length < 10) {
      Alert.alert('Error', 'Rejection reason must be at least 10 characters long');
      return;
    }

    setProcessing(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      await axios.post(`${getBaseURL()}/api/payments/${paymentId}/reject`, { rejectionReason }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Payment Rejected', 'User has been notified');
      setPayments(prev => prev.filter(p => p._id !== paymentId));
      setShowRejectModal(false);
      setRejectionReason('');
      setShowDetailModal(false);
    } catch (err) {
      logError(err, 'handleReject');
      const message = getErrorMessage(err, 'Failed to reject payment');
      Alert.alert('Error', message);
    } finally {
      setProcessing(false);
    }
  };

  const StatusBadge = ({ status }) => {
    let backgroundColor, text;
    switch (status) {
      case 'pending':
        backgroundColor = '#FFA500';
        text = 'Pending';
        break;
      default:
        backgroundColor = '#222636';
        text = status || 'Unknown';
    }

    return (
      <View style={[styles.badge, { backgroundColor }]}>
        <Text style={styles.badgeText}>{text}</Text>
      </View>
    );
  };

  const renderPaymentItem = ({ item }) => {
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    };

    return (
      <TouchableOpacity style={styles.paymentCard} onPress={() => { setSelectedPayment(item); setShowDetailModal(true); }}>
        <View style={styles.cardHeader}>
          <Text style={styles.transactionId}>{item.transactionId}</Text>
          <StatusBadge status={item.status} />
        </View>
        {item.submittedByName ? (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>👤</Text>
              <Text style={styles.detailText}>Name:</Text>
              <Text style={styles.detailValue}>{item.submittedByName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>📱</Text>
              <Text style={styles.detailText}>Phone:</Text>
              <Text style={styles.detailValue}>{item.submittedByPhone}</Text>
            </View>
          </>
        ) : (
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>👤</Text>
            <Text style={styles.detailText}>Mobile User ID:</Text>
            <Text style={styles.detailValue}>{item.submittedByMobileId || 'N/A'}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📅</Text>
          <Text style={styles.detailText}>Plan Period:</Text>
          <Text style={styles.detailValue}>{item.planPeriod ? item.planPeriod.charAt(0).toUpperCase() + item.planPeriod.slice(1) : 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>₹</Text>
          <Text style={styles.detailText}>Amount:</Text>
          <Text style={styles.detailValue}>₹{item.amount}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>🕒</Text>
          <Text style={styles.detailText}>Date:</Text>
          <Text style={styles.detailValue}>{formatDate(item.createdAt)}</Text>
        </View>
        {item.notes && (
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📝</Text>
            <Text style={styles.detailText}>Notes:</Text>
            <Text style={styles.detailValue}>{item.notes}</Text>
          </View>
        )}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => handleApprove(item._id, item.submittedByMobileId)} disabled={processing}>
            <Text style={styles.actionButtonText}>✓ Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => { setSelectedPayment(item); setShowRejectModal(true); }} disabled={processing}>
            <Text style={styles.actionButtonText}>✗ Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.viewButton]} onPress={() => { setSelectedPayment(item); setShowDetailModal(true); }}>
            <Text style={styles.actionButtonText}>👁️ View</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSeparator = () => <View style={styles.separator} />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Payment Approvals</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading payments...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchPendingPayments()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : payments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyMessage}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>No pending payment approvals</Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          renderItem={renderPaymentItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Payment Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Payment Details</Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {selectedPayment && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Transaction Info</Text>
                  <Text style={styles.largeText}>{selectedPayment.transactionId}</Text>
                  <StatusBadge status={selectedPayment.status} />
                  <Text style={styles.detailText}>{new Date(selectedPayment.createdAt).toLocaleString()}</Text>
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>User Info</Text>
                  {selectedPayment.submittedByName ? (
                    <>
                      <Text style={styles.detailText}>Name: {selectedPayment.submittedByName}</Text>
                      <Text style={styles.detailText}>Phone: {selectedPayment.submittedByPhone}</Text>
                      {selectedPayment.submittedByEmail && <Text style={styles.detailText}>Email: {selectedPayment.submittedByEmail}</Text>}
                      <Text style={styles.detailText}>Role: {selectedPayment.submittedByRole}</Text>
                      <Text style={styles.detailText}>User Type: {formatUserType(selectedPayment.submittedByUserType)}</Text>
                      <Text style={styles.detailText}>Mobile ID: {selectedPayment.submittedByMobileId}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailText}>Mobile User ID: {selectedPayment.submittedByMobileId || 'N/A'}</Text>
                      <Text style={styles.detailText}>User Type: {selectedPayment.userType || 'N/A'}</Text>
                    </>
                  )}
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Payment Info</Text>
                  <Text style={styles.detailText}>Plan Period: {selectedPayment.planPeriod}</Text>
                  <Text style={styles.largeAmount}>₹{selectedPayment.amount}</Text>
                  {selectedPayment.expectedAmount && selectedPayment.expectedAmount !== selectedPayment.amount && (
                    <Text style={styles.warningText}>Expected: ₹{selectedPayment.expectedAmount}</Text>
                  )}
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Additional Info</Text>
                  {selectedPayment.notes && <Text style={styles.detailText}>Notes: {selectedPayment.notes}</Text>}
                  <Text style={styles.detailText}>Amount Validated: {selectedPayment.amountValidated ? 'Yes' : 'No'}</Text>
                </View>
              </>
            )}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.modalButton, styles.approveButton]} onPress={() => handleApprove(selectedPayment._id, selectedPayment.submittedByMobileId)} disabled={processing}>
              <Text style={styles.modalButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.rejectButton]} onPress={() => { setShowRejectModal(true); setShowDetailModal(false); }} disabled={processing}>
              <Text style={styles.modalButtonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.closeButton]} onPress={() => setShowDetailModal(false)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} animationType="fade" transparent={true} onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.rejectModalOverlay}>
          <View style={styles.rejectModal}>
            <Text style={styles.rejectTitle}>Reject Payment</Text>
            <Text style={styles.rejectSubtitle}>Please provide a reason for rejection</Text>
            <TextInput
              style={styles.rejectInput}
              multiline
              numberOfLines={4}
              placeholder="Enter reason..."
              value={rejectionReason}
              onChangeText={setRejectionReason}
              maxLength={500}
            />
            <Text style={styles.counter}>{rejectionReason.length}/500</Text>
            <View style={styles.rejectButtons}>
              <TouchableOpacity style={[styles.rejectButton, styles.cancelButton]} onPress={() => { setShowRejectModal(false); setRejectionReason(''); }}>
                <Text style={styles.rejectButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rejectButton, styles.submitButton]} onPress={() => handleReject(selectedPayment._id)} disabled={processing}>
                <Text style={styles.rejectButtonText}>Reject Payment</Text>
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
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginLeft: -2,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIcon: {
    color: '#fff',
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#F44336',
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
  listContent: {
    paddingBottom: 20,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
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
    marginBottom: 12,
  },
  transactionId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  viewButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeIcon: {
    fontSize: 24,
    color: '#666',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  largeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  largeAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginBottom: 8,
  },
  warningText: {
    color: '#F44336',
    fontSize: 14,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: '#666',
  },
  rejectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  rejectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 8,
  },
  rejectSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginBottom: 16,
  },
  rejectButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  submitButton: {
    backgroundColor: '#F44336',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
