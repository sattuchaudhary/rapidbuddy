import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, showErrorAlert, getErrorMessage } from '../utils/errorHandler';

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchNotifications = useCallback(async (pageNum = 1) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      }
      setError(null);

      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setError('Please login again');
        return;
      }

      const response = await axios.get(`${getBaseURL()}/api/history/notifications?page=${pageNum}&pageSize=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data?.data;
      if (response.data?.success && data) {
        const newItems = data.items || [];
        setNotifications(prev => pageNum === 1 ? newItems : [...prev, ...newItems]);
        setPage(data.page || pageNum);
        setTotalPages(data.totalPages || 1);
        setHasMore(data.page < data.totalPages);
      } else {
        throw new Error(response.data?.message || 'Failed to load notifications');
      }
    } catch (err) {
      logError(err, 'fetchNotifications');
      const message = getErrorMessage(err, 'Failed to load notifications');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMoreNotifications = useCallback(() => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage);
    }
  }, [hasMore, loading, page, fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchNotifications(1);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const getVehicleIcon = (vehicleType) => {
    switch (vehicleType) {
      case 'two_wheeler':
        return '🏍️';
      case 'four_wheeler':
        return '🚗';
      case 'cv':
        return '🚚';
      default:
        return '🚗';
    }
  };

  const getChannelColor = (channel) => {
    switch (channel?.toUpperCase()) {
      case 'WHATSAPP':
        return '#25D366';
      case 'SMS':
        return '#FFA500';
      case 'EMAIL':
        return '#4F46E5';
      default:
        return '#6B7280';
    }
  };

  const renderNotificationItem = useCallback(({ item }) => {
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    return (
      <View style={styles.notificationCard}>
        <View style={[styles.channelBadge, { backgroundColor: getChannelColor(item.channel) }]}>
          <Text style={styles.channelBadgeText}>{item.channel?.toUpperCase() || 'SHARE'}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.userName}>{item.displayName || 'User'}</Text>
          <Text style={styles.actionText}>verified details of vehicle no. <Text style={styles.vehicleNumber}>{item.vehicleNumber || 'N/A'}</Text></Text>
          <Text style={styles.loanDetails}>with loan no {item.loanNumber || 'N/A'} and bucket {item.bucket ?? 'N/A'}</Text>
          <View style={styles.vehicleTypeBadge}>
            <Text style={styles.vehicleIcon}>{getVehicleIcon(item.vehicleType)}</Text>
            <Text style={styles.vehicleTypeText}>{item.vehicleType?.replace('_', ' ') || 'other'}</Text>
          </View>
        </View>
        <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
      </View>
    );
  }, []);

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#4F46E5" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading || error) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔔</Text>
        <Text style={styles.emptyMessage}>No notifications</Text>
        <Text style={styles.emptySubtitle}>Share activity will appear here</Text>
      </View>
    );
  };

  const renderError = () => {
    if (!error) return null;
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotifications(1)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : error ? (
        renderError()
      ) : (
        <>
          <FlatList
            data={notifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item._id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            onEndReached={loadMoreNotifications}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={notifications.length === 0 ? styles.emptyList : null}
            getItemLayout={(data, index) => ({ length: 120, offset: 120 * index, index })}
          />
          {totalPages > 1 && (
            <View style={styles.paginationInfo}>
              <Text style={styles.paginationText}>Page {page} of {totalPages}</Text>
            </View>
          )}
        </>
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  channelBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  channelBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  cardContent: {
    marginTop: 20,
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  vehicleNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  loanDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  vehicleTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vehicleIcon: {
    fontSize: 16,
  },
  vehicleTypeText: {
    fontSize: 12,
    color: '#666',
  },
  timestamp: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    fontSize: 12,
    color: '#666',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  paginationInfo: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 12,
    color: '#666',
  },
});