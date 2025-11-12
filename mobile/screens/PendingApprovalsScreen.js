import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';

const PendingApprovalsScreen = ({ navigation }) => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setError(null);
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const response = await axios.get(`${getBaseURL()}/api/users/pending-approvals`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setPendingUsers(response.data.data || []);
      } else {
        setError('Failed to fetch pending approvals');
      }
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch pending approvals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (userId, userName) => {
    Alert.alert(
      'Approve User',
      `Are you sure you want to approve ${userName}? They will gain access to the system.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('token');
              const response = await axios.put(
                `${getBaseURL()}/api/users/${userId}/approve`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (response.data.success) {
                setSuccess('User approved successfully');
                // Optimistic update: remove from list
                setPendingUsers(prev => prev.filter(user => user._id !== userId));
                setTimeout(() => setSuccess(null), 2000);
              } else {
                Alert.alert('Error', 'Failed to approve user');
              }
            } catch (err) {
              console.error('Error approving user:', err);
              Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to approve user');
            }
          },
        },
      ]
    );
  };

  const handleReject = async (userId, userName) => {
    Alert.alert(
      'Reject User',
      `Are you sure you want to reject ${userName}? This action cannot be undone and they will need to register again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('token');
              const response = await axios.put(
                `${getBaseURL()}/api/users/${userId}/reject`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (response.data.success) {
                setSuccess('User rejected successfully');
                // Optimistic update: remove from list
                setPendingUsers(prev => prev.filter(user => user._id !== userId));
                setTimeout(() => setSuccess(null), 2000);
              } else {
                Alert.alert('Error', 'Failed to reject user');
              }
            } catch (err) {
              console.error('Error rejecting user:', err);
              Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to reject user');
            }
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPendingApprovals();
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const Badge = ({ type, status }) => {
    let backgroundColor, text, icon;
    if (type === 'otp') {
      if (status === 'Verified') {
        backgroundColor = '#10b981';
        text = 'Verified';
        icon = 'checkmark';
      } else {
        backgroundColor = '#f59e0b';
        text = 'Pending';
        icon = 'time';
      }
    } else if (type === 'payment') {
      if (status === 'Paid') {
        backgroundColor = '#10b981';
        text = 'Paid';
        icon = 'checkmark';
      } else if (status === 'Pending') {
        backgroundColor = '#f59e0b';
        text = 'Pending';
        icon = 'time';
      } else {
        backgroundColor = '#ef4444';
        text = 'Not Paid';
        icon = 'close';
      }
    } else if (type === 'userType') {
      if (status === 'Office Staff') {
        backgroundColor = '#3b82f6';
        text = 'Office Staff';
      } else {
        backgroundColor = '#f59e0b';
        text = 'Repo Agent';
      }
    }

    return (
      <View style={[styles.badge, { backgroundColor }]}>
        {icon && <Ionicons name={icon} size={12} color="#fff" />}
        <Text style={styles.badgeText}>{text}</Text>
      </View>
    );
  };

  const renderPendingUser = useCallback(({ item }) => (
    <View style={styles.pendingCard}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.fullName || item.name)}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.fullName || item.name || 'N/A'}</Text>
          <Text style={styles.userEmail}>{item.email || 'N/A'}</Text>
          <Text style={styles.userPhone}>{item.mobile || item.phoneNumber || 'N/A'}</Text>
        </View>
      </View>
      <View style={styles.cardDetails}>
        <Badge type="userType" status={item.role === 'Staff' ? 'Office Staff' : 'Repo Agent'} />
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={12} color="#9CA3AF" />
          <Text style={styles.detailText}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
        <Badge type="otp" status={item.otpVerified ? 'Verified' : 'Pending'} />
        <Badge type="payment" status={item.paymentStatus || 'Pending'} />
        <Text style={styles.addressText} numberOfLines={1}>
          {item.address || 'N/A'}
        </Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApprove(item._id || item.id, item.fullName || item.name)}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReject(item._id || item.id, item.fullName || item.name)}
        >
          <Ionicons name="close" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.viewButton]}>
          <Ionicons name="eye" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), []);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>✅</Text>
      <Text style={styles.emptyTitle}>All caught up!</Text>
      <Text style={styles.emptySubtitle}>No pending approvals at the moment</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={fetchPendingApprovals}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading pending approvals...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Pending Approvals</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {error ? (
        renderErrorState()
      ) : (
        <FlatList
          data={pendingUsers}
          keyExtractor={(item) => item._id || item.id}
          renderItem={renderPendingUser}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#4F46E5',
    fontSize: 16,
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
    letterSpacing: -0.5,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FEF3C7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  userEmail: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  userPhone: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  cardDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  addressText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  viewButton: {
    backgroundColor: '#3b82f6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PendingApprovalsScreen;