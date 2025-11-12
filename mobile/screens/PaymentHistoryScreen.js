import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, showErrorAlert, getErrorMessage } from '../utils/errorHandler';

export default function PaymentHistoryScreen({ navigation }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const PAYMENT_STATUS_KEY = 'payment_status_cache';

  const checkForStatusChanges = async (newPayments) => {
    try {
      const stored = await SecureStore.getItemAsync(PAYMENT_STATUS_KEY);
      let oldStatusMap = {};
      if (stored) {
        try {
          oldStatusMap = JSON.parse(stored);
        } catch (parseErr) {
          logError(parseErr, 'checkForStatusChanges parse');
        }
      }

      const changes = [];
      newPayments.forEach(payment => {
        const oldStatus = oldStatusMap[payment.transactionId];
        if (oldStatus === 'pending' && (payment.status === 'approved' || payment.status === 'rejected')) {
          changes.push(`${payment.transactionId}: ${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}`);
        }
      });

      if (changes.length > 0) {
        Alert.alert(
          'Payment Status Update',
          changes.join('\n')
        );
      }

      const newStatusMap = {};
      newPayments.forEach(payment => {
        newStatusMap[payment.transactionId] = payment.status;
      });

      await SecureStore.setItemAsync(PAYMENT_STATUS_KEY, JSON.stringify(newStatusMap));
    } catch (err) {
      logError(err, 'checkForStatusChanges');
    }
  };

  const fetchPaymentHistory = async (isRefresh = false) => {
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

      const response = await axios.get(`${getBaseURL()}/api/payments/my-payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const paymentsData = response.data?.data || [];
      setPayments(paymentsData);
      await checkForStatusChanges(paymentsData);
    } catch (err) {
      logError(err, 'fetchPaymentHistory');
      const message = getErrorMessage(err, 'Failed to fetch payment history');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  const StatusBadge = ({ status }) => {
    let backgroundColor, text;
    switch (status) {
      case 'pending':
        backgroundColor = '#FFA500';
        text = 'Pending';
        break;
      case 'approved':
        backgroundColor = '#4CAF50';
        text = 'Approved';
        break;
      case 'rejected':
        backgroundColor = '#F44336';
        text = 'Rejected';
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

  const renderPaymentItem = (payment) => {
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    };

    return (
      <TouchableOpacity key={payment._id || payment.transactionId} style={styles.paymentCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.transactionId}>{payment.transactionId}</Text>
          <StatusBadge status={payment.status} />
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📅</Text>
          <Text style={styles.detailText}>Plan Period:</Text>
          <Text style={styles.detailValue}>{payment.planPeriod ? payment.planPeriod.charAt(0).toUpperCase() + payment.planPeriod.slice(1) : 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>💰</Text>
          <Text style={styles.detailText}>Amount:</Text>
          <Text style={styles.detailValue}>₹{payment.amount}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>🕒</Text>
          <Text style={styles.detailText}>Date:</Text>
          <Text style={styles.detailValue}>{formatDate(payment.createdAt)}</Text>
        </View>
        {payment.status === 'approved' && payment.effectiveEnd && (
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>✅</Text>
            <Text style={styles.detailText}>Effective End:</Text>
            <Text style={styles.detailValue}>{new Date(payment.effectiveEnd).toLocaleDateString()}</Text>
          </View>
        )}
        {payment.status === 'rejected' && payment.rejectionReason && (
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>❌</Text>
            <Text style={styles.detailText}>Rejection Reason:</Text>
            <Text style={styles.detailValue}>{payment.rejectionReason}</Text>
          </View>
        )}
        {payment.notes && (
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📝</Text>
            <Text style={styles.detailText}>Notes:</Text>
            <Text style={styles.detailValue}>{payment.notes}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Payment History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading payment history...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchPaymentHistory()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : payments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyMessage}>No payment history found</Text>
          <Text style={styles.emptySubtitle}>Submit a payment to see it here</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchPaymentHistory(true)} />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {payments.map(renderPaymentItem)}
        </ScrollView>
      )}
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
  headerSpacer: {
    width: 40,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
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
});