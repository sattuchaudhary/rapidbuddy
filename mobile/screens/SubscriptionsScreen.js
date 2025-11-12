import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, StatusBar, RefreshControl, Modal, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, showErrorAlert, getErrorMessage } from '../utils/errorHandler';

export default function SubscriptionsScreen({ navigation }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSubscriptions, setFilteredSubscriptions] = useState([]);

  const fetchSubscriptions = useCallback(async (isRefresh = false) => {
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

      const response = await axios.get(`${getBaseURL()}/api/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const subs = response.data?.data || [];
      setSubscriptions(subs);
      setFilteredSubscriptions(subs);
    } catch (err) {
      logError(err, 'fetchSubscriptions');
      const message = getErrorMessage(err, 'Failed to fetch subscriptions');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchSubscriptions(true);
  }, [fetchSubscriptions]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredSubscriptions(subscriptions);
      return;
    }

    const filtered = subscriptions.filter(sub =>
      (sub.userName && sub.userName.toLowerCase().includes(query.toLowerCase())) ||
      (sub.userMobile && sub.userMobile.includes(query)) ||
      (sub.mobileUserId && sub.mobileUserId.includes(query))
    );
    setFilteredSubscriptions(filtered);
  }, [subscriptions]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const getStatusInfo = (subscription) => {
    if (!subscription.endDate) return { status: 'Unknown', days: 0 };
    const now = new Date();
    const end = new Date(subscription.endDate);
    if (end > now) {
      const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      return { status: 'Active', days };
    } else {
      const days = Math.ceil((now - end) / (1000 * 60 * 60 * 24));
      return { status: 'Expired', days };
    }
  };

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(sub => getStatusInfo(sub).status === 'Active').length,
    expired: subscriptions.filter(sub => getStatusInfo(sub).status === 'Expired').length,
  };

  const renderSubscriptionItem = ({ item }) => {
    const { status, days } = getStatusInfo(item);
    return (
      <TouchableOpacity
        style={styles.subscriptionCard}
        onPress={() => {
          setSelectedSubscription(item);
          setShowDetailModal(true);
        }}
      >
        <View style={styles.cardRow}>
          <Text style={styles.userName}>{item.userName || 'N/A'}</Text>
          <View style={[styles.badge, { backgroundColor: status === 'Active' ? '#4CAF50' : '#F44336' }]}>
            <Text style={styles.badgeText}>{status}</Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.icon}>📱</Text>
          <Text style={styles.detailText}>{item.userMobile || 'N/A'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.detailLabel}>ID:</Text>
          <Text style={styles.detailValue}>{item.mobileUserId}</Text>
        </View>
        <View style={styles.cardRow}>
          <View style={[styles.userTypeBadge, { backgroundColor: item.userType === 'repo_agent' ? '#F59E0B' : '#3B82F6' }]}>
            <Text style={styles.badgeText}>{item.userType === 'repo_agent' ? 'Repo Agent' : 'Office Staff'}</Text>
          </View>
          <Text style={[styles.daysText, { color: status === 'Active' ? '#4CAF50' : '#F44336' }]}>
            {status === 'Active' ? `${days} days left` : `${days} days expired`}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.icon}>📅</Text>
          <Text style={styles.detailText}>Start: {item.startDate ? new Date(item.startDate).toLocaleDateString() : 'N/A'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.icon}>📅</Text>
          <Text style={styles.detailText}>End: {item.endDate ? new Date(item.endDate).toLocaleDateString() : 'N/A'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedSubscription) return null;
    const { status, days } = getStatusInfo(selectedSubscription);
    const startDate = selectedSubscription.startDate ? new Date(selectedSubscription.startDate) : null;
    const endDate = selectedSubscription.endDate ? new Date(selectedSubscription.endDate) : null;
    const duration = startDate && endDate ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) : null;
    const progress = startDate && endDate ? Math.min(100, Math.max(0, ((new Date() - startDate) / (endDate - startDate)) * 100)) : 0;

    return (
      <Modal visible={showDetailModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Subscription Details</Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>User Info</Text>
              <Text style={styles.userNameLarge}>{selectedSubscription.userName || 'N/A'}</Text>
              <TouchableOpacity style={styles.callButton}>
                <Text style={styles.callText}>📞 {selectedSubscription.userMobile || 'N/A'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Copied', 'User ID copied to clipboard')}>
                <Text style={styles.detailText}>ID: {selectedSubscription.mobileUserId}</Text>
              </TouchableOpacity>
              <View style={[styles.userTypeBadge, { backgroundColor: selectedSubscription.userType === 'repo_agent' ? '#F59E0B' : '#3B82F6' }]}>
                <Text style={styles.badgeText}>{selectedSubscription.userType === 'repo_agent' ? 'Repo Agent' : 'Office Staff'}</Text>
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subscription Info</Text>
              <View style={[styles.badge, { backgroundColor: status === 'Active' ? '#4CAF50' : '#F44336' }]}>
                <Text style={styles.badgeText}>{status}</Text>
              </View>
              <Text style={styles.detailText}>Start: {startDate ? startDate.toLocaleString() : 'N/A'}</Text>
              <Text style={styles.detailText}>End: {endDate ? endDate.toLocaleString() : 'N/A'}</Text>
              <Text style={styles.detailText}>Duration: {duration ? `${duration} days` : 'N/A'}</Text>
              <Text style={[styles.daysText, { color: status === 'Active' ? '#4CAF50' : '#F44336' }]}>
                {status === 'Active' ? `${days} days remaining` : `${days} days expired`}
              </Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              <View style={styles.timelineContainer}>
                <Text style={styles.timelineText}>Start</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.timelineText}>End</Text>
              </View>
            </View>
          </ScrollView>
          <TouchableOpacity style={styles.closeModalButton} onPress={() => setShowDetailModal(false)}>
            <Text style={styles.closeModalText}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>User Subscriptions</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, mobile, or user ID..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.searchIcon}>🔍</Text>
        )}
      </View>

      <Text style={styles.resultsText}>{filteredSubscriptions.length} results found</Text>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>📊</Text>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>✅</Text>
          <Text style={styles.statNumber}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>⏰</Text>
          <Text style={styles.statNumber}>{stats.expired}</Text>
          <Text style={styles.statLabel}>Expired</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading subscriptions...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchSubscriptions()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredSubscriptions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{searchQuery ? '🔍' : '📭'}</Text>
          <Text style={styles.emptyMessage}>{searchQuery ? 'No results found' : 'No subscriptions found'}</Text>
          <Text style={styles.emptySubtitle}>{searchQuery ? 'Try different keywords' : 'Users will appear here after payment approval'}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSubscriptions}
          renderItem={renderSubscriptionItem}
          keyExtractor={(item) => item.mobileUserId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {renderDetailModal()}
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
    fontSize: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchIcon: {
    fontSize: 18,
    marginLeft: 8,
  },
  clearIcon: {
    fontSize: 18,
    marginLeft: 8,
    color: '#666',
  },
  resultsText: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
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
  subscriptionCard: {
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  icon: {
    fontSize: 14,
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  detailValue: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'monospace',
  },
  userTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  daysText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  userNameLarge: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  callButton: {
    marginBottom: 8,
  },
  callText: {
    fontSize: 16,
    color: '#4F46E5',
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  timelineText: {
    fontSize: 12,
    color: '#666',
    width: 40,
    textAlign: 'center',
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginHorizontal: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 2,
  },
  closeModalButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    alignItems: 'center',
    margin: 16,
    borderRadius: 8,
  },
  closeModalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});