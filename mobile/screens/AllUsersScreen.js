import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, showErrorAlert, getErrorMessage } from '../utils/errorHandler';

// Inline UserCard component
const UserCard = ({ user, onPress, showTenant = true }) => {
  const getInitials = (firstName, lastName) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'super_admin': return '#764ba2';
      case 'admin': return '#4F46E5';
      case 'user': return '#43e97b';
      default: return '#9CA3AF';
    }
  };

  const getStatusColor = (isActive) => {
    return isActive ? '#10B981' : '#EF4444';
  };

  return (
    <TouchableOpacity
      style={styles.userCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.userCardContent}>
        <View style={[styles.avatarContainer, { backgroundColor: getRoleColor(user.role) }]}>
          <Text style={styles.avatarText}>{getInitials(user.firstName, user.lastName)}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {showTenant && user.tenantId && (
            <Text style={styles.userTenant}>{user.tenantId.name || 'Unknown Tenant'}</Text>
          )}
        </View>
        <View style={styles.userBadges}>
          <View style={[styles.badge, { backgroundColor: getRoleColor(user.role) }]}>
            <Text style={styles.badgeText}>
              {user.role === 'super_admin' ? 'Super Admin' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: getStatusColor(user.isActive) }]}>
            <Text style={styles.badgeText}>{user.isActive ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.userCreated}>
        Created: {new Date(user.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );
};

export default function AllUsersScreen({ navigation, route }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminCount: 0
  });
  const searchTimerRef = useRef(null);
  const tenantId = route?.params?.tenantId;

  const fetchUsers = useCallback(async (page = 1, isLoadMore = false, isRefresh = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else if (isRefresh) {
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

      const params = {
        page,
        limit: 20,
        search: searchQuery,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        isActive: statusFilter !== 'all' ? (statusFilter === 'active') : undefined
      };

      if (tenantId) {
        params.tenantId = tenantId;
      }

      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await axios.get(`${getBaseURL()}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      const { users: newUsers, pagination, stats: returnedStats } = response.data.data;

      if (isLoadMore) {
        setUsers(prev => [...prev, ...newUsers]);
      } else {
        setUsers(newUsers);
      }

      setCurrentPage(pagination.currentPage);
      setTotalPages(pagination.totalPages);
      setHasMore(pagination.hasNextPage);

      // Update stats: prefer server-provided stats, fallback to derive from response
      if (returnedStats) {
        setStats({
          totalUsers: returnedStats.totalUsers ?? pagination.totalUsers,
          activeUsers: returnedStats.activeUsers ?? 0,
          adminCount: returnedStats.adminCount ?? 0,
        });
      } else if (page === 1) {
        const totalUsers = pagination.totalUsers;
        const activeUsers = newUsers.filter(u => u.isActive).length;
        const adminCount = newUsers.filter(u => u.role === 'admin' || u.role === 'super_admin').length;
        setStats({ totalUsers, activeUsers, adminCount });
      }
    } catch (err) {
      logError(err, 'fetchUsers');
      const message = getErrorMessage(err, 'Failed to fetch users');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [searchQuery, roleFilter, statusFilter]);

  const loadMoreUsers = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      fetchUsers(currentPage + 1, true);
    }
  }, [hasMore, loadingMore, loading, currentPage, fetchUsers]);

  const handleRefresh = useCallback(() => {
    setCurrentPage(1);
    fetchUsers(1, false, true);
  }, [fetchUsers]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    // Debounced search - reset pagination and fetch
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchUsers(1);
    }, 500);
  }, [fetchUsers]);

  // cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const clearFilters = () => {
    setRoleFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
    fetchUsers(1);
  };

  const applyFilters = () => {
    setShowFilterModal(false);
    setCurrentPage(1);
    fetchUsers(1);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const renderUserItem = ({ item }) => (
    <UserCard
      user={item}
      onPress={() => {
        // Future: Navigate to user detail screen
        Alert.alert('User Detail', `View details for ${item.firstName} ${item.lastName}`);
      }}
      showTenant={true}
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#4F46E5" />
        <Text style={styles.footerText}>Loading more users...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    
    let icon = '👥';
    let message = 'No users found';
    let subtitle = 'Create your first user';

    if (searchQuery || roleFilter !== 'all' || statusFilter !== 'all') {
      icon = '🔍';
      message = 'No users match your search';
      subtitle = 'Try different keywords or filters';
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{icon}</Text>
        <Text style={styles.emptyMessage}>{message}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
      </View>
    );
  };

  const renderStatsSummary = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.totalUsers}</Text>
        <Text style={styles.statLabel}>Total Users</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.activeUsers}</Text>
        <Text style={styles.statLabel}>Active Users</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.adminCount}</Text>
        <Text style={styles.statLabel}>Admins</Text>
      </View>
    </View>
  );

  const renderFilterChips = () => {
    const chips = [];
    if (roleFilter !== 'all') {
      chips.push(
        <View key="role" style={styles.filterChip}>
          <Text style={styles.filterChipText}>
            Role: {roleFilter === 'super_admin' ? 'Super Admin' : roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}
          </Text>
        </View>
      );
    }
    if (statusFilter !== 'all') {
      chips.push(
        <View key="status" style={styles.filterChip}>
          <Text style={styles.filterChipText}>
            Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
          </Text>
        </View>
      );
    }
    return chips;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>All Users</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={styles.filterIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => handleSearch('')}
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Chips */}
      {(roleFilter !== 'all' || statusFilter !== 'all') && (
        <View style={styles.filterChipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderFilterChips()}
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>Clear All</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Stats Summary */}
      {renderStatsSummary()}

      {/* User List */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchUsers()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item._id}
          onEndReached={loadMoreUsers}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={users.length === 0 ? styles.emptyList : styles.listContainer}
          getItemLayout={(data, index) => ({
            length: 100,
            offset: 100 * index,
            index,
          })}
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Users</Text>

            <Text style={styles.filterLabel}>Role</Text>
            <View style={styles.radioGroup}>
              {['all', 'super_admin', 'admin', 'user'].map(role => (
                <TouchableOpacity
                  key={role}
                  style={styles.radioOption}
                  onPress={() => setRoleFilter(role)}
                >
                  <View style={[styles.radioButton, roleFilter === role && styles.radioSelected]} />
                  <Text style={styles.radioText}>
                    {role === 'all' ? 'All Roles' : role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.radioGroup}>
              {['all', 'active', 'inactive'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={styles.radioOption}
                  onPress={() => setStatusFilter(status)}
                >
                  <View style={[styles.radioButton, statusFilter === status && styles.radioSelected]} />
                  <Text style={styles.radioText}>
                    {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.applyButton]}
                onPress={applyFilters}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
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
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIcon: {
    fontSize: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  clearButton: {
    padding: 8,
  },
  clearText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  filterChipsContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  clearFiltersButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearFiltersText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4F46E5',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontWeight: '600',
    color: '#000',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  userTenant: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  userBadges: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  userCreated: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'right',
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    marginTop: 16,
  },
  radioGroup: {
    marginBottom: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
  },
  radioSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  radioText: {
    fontSize: 16,
    color: '#000',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: '#4F46E5',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});