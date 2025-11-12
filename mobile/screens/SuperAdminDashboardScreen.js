import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, getErrorMessage } from '../utils/errorHandler';

export default function SuperAdminDashboardScreen({ navigation }) {
  // State Management
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTenants: 0,
    activeUsers: 0,
    activeTenants: 0,
    usersByRole: [],
    tenantsByPlan: []
  });
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // API Integration Functions
  const fetchDashboardStats = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) throw new Error('No token found');

      const response = await axios.get(`${getBaseURL()}/api/admin/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data?.success) {
        setStats(response.data.data.stats);
      }
    } catch (err) {
      logError(err, 'fetchDashboardStats');
      throw err;
    }
  }, []);

  const fetchTenants = useCallback(async (page = 1, search = '', isLoadMore = false) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) throw new Error('No token found');

      const response = await axios.get(`${getBaseURL()}/api/admin/tenants?page=${page}&limit=10&search=${search}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data?.success) {
        const newTenants = response.data.data.tenants;
        const pagination = response.data.data.pagination;

        if (isLoadMore) {
          setTenants(prev => [...prev, ...newTenants]);
        } else {
          setTenants(newTenants);
        }

        setCurrentPage(pagination.currentPage);
        setHasMore(pagination.hasNextPage);
      }
    } catch (err) {
      logError(err, 'fetchTenants');
      throw err;
    }
  }, []);

  const loadMoreTenants = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchTenants(currentPage + 1, searchQuery, true);
    } catch (err) {
      Alert.alert('Error', 'Failed to load more tenants');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, currentPage, searchQuery, fetchTenants]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await Promise.all([
        fetchDashboardStats(),
        fetchTenants(1, searchQuery)
      ]);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to refresh data'));
    } finally {
      setRefreshing(false);
    }
  }, [fetchDashboardStats, fetchTenants, searchQuery]);

  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    setCurrentPage(1);
    try {
      await fetchTenants(1, query);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to search tenants'));
    }
  }, [fetchTenants]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      try {
        const storedUserData = await SecureStore.getItemAsync('userData');
        if (storedUserData) setUserData(JSON.parse(storedUserData));

        await Promise.all([
          fetchDashboardStats(),
          fetchTenants()
        ]);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load dashboard'));
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [fetchDashboardStats, fetchTenants]);

  // Logout Function
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync('token');
              await SecureStore.deleteItemAsync('userData');
              await SecureStore.deleteItemAsync('agent');
              navigation.replace('Login');
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  // Delete tenant (confirmation + API call)
  const handleDeleteTenant = async (tenantId) => {
    Alert.alert(
      'Delete Tenant',
      'Are you sure you want to delete this tenant? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync('token');
            await axios.delete(`${getBaseURL()}/api/tenants/${tenantId}`, { headers: { Authorization: `Bearer ${token}` } });
            // Refresh first page after delete
            await fetchTenants(1, searchQuery);
          } catch (err) {
            logError(err, 'handleDeleteTenant');
            Alert.alert('Error', getErrorMessage(err, 'Failed to delete tenant'));
          }
        } }
      ]
    );
  };

  // Inline StatCard Component
  const StatCard = ({ title, value, icon, onPress, loading }) => (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: loading ? '#E0E7FF' : undefined }]}
      onPress={onPress}
      disabled={loading}
    >
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{loading ? '---' : value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statIcon}>{icon}</Text>
    </TouchableOpacity>
  );

  // Render Tenant Item
  const renderTenantItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.tenantCard}
      onPress={() => navigation.navigate('TenantDetail', { tenantId: item._id })}
    >
      <View style={styles.tenantHeader}>
        <Text style={styles.tenantName}>{item.name}</Text>
        <View style={[styles.badge, { backgroundColor: item.isActive ? '#4CAF50' : '#9CA3AF' }]}>
          <Text style={styles.badgeText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>
      <View style={styles.tenantInfo}>
        <View style={[styles.badge, { backgroundColor: item.type === 'Agency' ? '#2196F3' : item.type === 'NBFC' ? '#FF9800' : '#F44336' }]}>
          <Text style={styles.badgeText}>{item.type}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: item.subscription?.plan === 'Basic' ? '#9CA3AF' : item.subscription?.plan === 'Premium' ? '#9C27B0' : '#FFD700' }]}>
          <Text style={styles.badgeText}>{item.subscription?.plan || 'Basic'}</Text>
        </View>
      </View>
      <Text style={styles.tenantDetail}>Created: {new Date(item.createdAt).toLocaleDateString()}</Text>
      <Text style={styles.tenantDetail}>Admin: {item.createdBy?.firstName} {item.createdBy?.lastName}</Text>
      <View style={styles.tenantActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('TenantForm', { tenantId: item._id, mode: 'edit' })}>
          <Text>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteTenant(item._id)}>
          <Text>🗑️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AllUsers', { tenantId: item._id })}>
          <Text>👁️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ), [navigation]);

  // Loading state check
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Super Admin Dashboard</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Welcome Message */}
        <Text style={styles.welcomeText}>Welcome back, {userData?.firstName || 'Super Admin'}!</Text>

        {/* Statistics Cards */}
        <View style={styles.statsGrid}>
          <StatCard title="Total Users" value={stats.totalUsers} icon="👥" loading={loading} />
          <StatCard title="Total Tenants" value={stats.totalTenants} icon="🏢" loading={loading} />
          <StatCard title="Active Tenants" value={stats.activeTenants} icon="📈" loading={loading} />
          <StatCard title="Active Users" value={stats.activeUsers} icon="✅" loading={loading} />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TenantForm', { mode: 'create' })}>
            <Text style={styles.buttonIcon}>➕</Text>
            <Text style={styles.buttonText}>Add Tenant</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('AllUsers')}>
            <Text style={styles.buttonIcon}>👥</Text>
            <Text style={styles.buttonText}>View All Users</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => Alert.alert('Coming Soon', 'System Settings will be available soon')}>
            <Text style={styles.buttonIcon}>⚙️</Text>
            <Text style={styles.buttonText}>System Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search tenants..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearButton}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tenant List */}
        <View style={styles.tenantSection}>
          <Text style={styles.sectionTitle}>Tenants ({tenants.length})</Text>
          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : tenants.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{searchQuery ? '🔍' : '🏢'}</Text>
              <Text style={styles.emptyMessage}>{searchQuery ? 'No results' : 'No tenants found'}</Text>
              <Text style={styles.emptySubtitle}>{searchQuery ? 'Try different keywords' : 'Create your first tenant'}</Text>
            </View>
          ) : (
            <FlatList
              data={tenants}
              renderItem={renderTenantItem}
              keyExtractor={(item) => item._id}
              onEndReached={loadMoreTenants}
              onEndReachedThreshold={0.5}
              ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#4F46E5" /> : null}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
    marginTop: 10,
    color: '#666',
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
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  welcomeText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    color: '#4F46E5',
    fontSize: 24,
    fontWeight: '700',
  },
  statTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  statIcon: {
    fontSize: 32,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    fontSize: 18,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  tenantSection: {
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: '#4F46E5',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 16,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  tenantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tenantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tenantName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  tenantInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tenantDetail: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  tenantActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});