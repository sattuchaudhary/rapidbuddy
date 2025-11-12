import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, showErrorAlert, getErrorMessage } from '../utils/errorHandler';
import UserCard from '../components/tenant/UserCard';
import UserFormModal from '../components/tenant/UserFormModal';

export default function OfficeStaffListScreen({ navigation }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const searchTimerRef = useRef(null);

  // const fetchStaff = useCallback(async (page = 1, isLoadMore = false, isRefresh = false) => {
  //   if (isLoadMore) {
  //     setLoadingMore(true);
  //   } else if (isRefresh) {
  //     setRefreshing(true);
  //   } else {
  //     setLoading(true);
  //   }
  //   setError(null);

  //   try {
  //     const token = await SecureStore.getItemAsync('token');
  //     if (!token) throw new Error('Authentication required');

  //     const response = await axios.get(`${getBaseURL()}/api/tenant/users/staff`, {
  //       headers: { Authorization: `Bearer ${token}` },
  //       params: {
  //         page,
  //         limit: 20,
  //         search: searchQuery
  //       }
  //     });

  //     const { users, pagination } = response.data.data;

  //     if (isLoadMore) {
  //       setStaff(prev => [...prev, ...users]);
  //     } else {
  //       setStaff(users);
  //     }

  //     setCurrentPage(pagination.currentPage);
  //     setTotalPages(pagination.totalPages);
  //     setHasMore(pagination.hasNextPage);

  //   } catch (err) {
  //     logError(err, 'fetchStaff');
  //     const message = getErrorMessage(err, 'Failed to fetch staff members');
  //     setError(message);
  //     showErrorAlert(message);
  //   } finally {
  //     setLoading(false);
  //     setRefreshing(false);
  //     setLoadingMore(false);
  //   }
  // }, [searchQuery]);



  const fetchStaff = useCallback(async (page = 1, isLoadMore = false, isRefresh = false) => {
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
    if (!token) throw new Error('Authentication required');

    const response = await axios.get(`${getBaseURL()}/api/tenant/users/staff`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        page,
        limit: 20,
        search: searchQuery
      }
    });

    // ✅ FIXED: Handle both response structures
    const users = response.data.data || [];
    const pagination = response.data.pagination || {
      currentPage: page,
      totalPages: 1,
      hasNextPage: false
    };

    if (isLoadMore) {
      setStaff(prev => [...prev, ...users]);
    } else {
      setStaff(users);
    }

    setCurrentPage(pagination.currentPage);
    setTotalPages(pagination.totalPages);
    setHasMore(pagination.hasNextPage);

  } catch (err) {
    logError(err, 'fetchStaff');
    const message = getErrorMessage(err, 'Failed to fetch staff members');
    setError(message);
    showErrorAlert('Error', message);
  } finally {
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }
}, [searchQuery]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchStaff(1);
    }, 500);
  }, [fetchStaff]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      fetchStaff(currentPage + 1, true);
    }
  }, [hasMore, loadingMore, loading, currentPage, fetchStaff]);

  const handleRefresh = useCallback(() => {
    setCurrentPage(1);
    fetchStaff(1, false, true);
  }, [fetchStaff]);

  useEffect(() => {
    fetchStaff();
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const handleCreateStaff = () => {
    setSelectedUser(null);
    setShowUserModal(true);
  };

  const handleEditStaff = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleDeleteStaff = (userId) => {
    Alert.alert(
      'Delete Staff Member',
      'Are you sure you want to delete this staff member? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('token');
              await axios.delete(
                `${getBaseURL()}/api/tenant/users/staff/${userId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              handleRefresh();
              showErrorAlert('Staff member deleted successfully', 'Success');
            } catch (err) {
              logError(err, 'deleteStaff');
              showErrorAlert(getErrorMessage(err, 'Failed to delete staff member'));
            }
          }
        }
      ]
    );
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      await axios.put(
        `${getBaseURL()}/api/tenant/users/staff/${userId}/status`,
        { status: currentStatus === 'active' ? 'inactive' : 'active' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      handleRefresh();
    } catch (err) {
      logError(err, 'toggleStaffStatus');
      showErrorAlert(getErrorMessage(err, 'Failed to update staff status'));
    }
  };

  const handleSubmitUser = async (formData) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (selectedUser) {
        await axios.put(
          `${getBaseURL()}/api/tenant/users/staff/${selectedUser._id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${getBaseURL()}/api/tenant/users/staff`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      setShowUserModal(false);
      handleRefresh();
      showErrorAlert(
        `Staff member ${selectedUser ? 'updated' : 'created'} successfully`,
        'Success'
      );
    } catch (err) {
      logError(err, 'submitStaff');
      showErrorAlert(getErrorMessage(err, `Failed to ${selectedUser ? 'update' : 'create'} staff member`));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Office Staff</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleCreateStaff}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search staff..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => handleSearch('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={staff}
        renderItem={({ item }) => (
          <UserCard
            user={item}
            userType="staff"
            onPress={() => handleEditStaff(item)}
            onEdit={() => handleEditStaff(item)}
            onDelete={() => handleDeleteStaff(item._id)}
            onToggleStatus={() => handleToggleStatus(item._id, item.status)}
          />
        )}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => loadingMore ? (
          <ActivityIndicator style={styles.loadingMore} color="#4F46E5" />
        ) : null}
        ListEmptyComponent={() => !loading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No staff members found' : 'No staff members added yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Add your first staff member'}
            </Text>
          </View>
        )}
      />

      <UserFormModal
        visible={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSubmit={handleSubmitUser}
        initialData={selectedUser}
        userType="staff"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    marginLeft: -2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  clearButton: {
    position: 'absolute',
    right: 24,
    top: 24,
    padding: 8,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  list: {
    padding: 16,
  },
  loadingMore: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});