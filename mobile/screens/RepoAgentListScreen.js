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

export default function RepoAgentListScreen({ navigation }) {
  const [agents, setAgents] = useState([]);
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

  // const fetchAgents = useCallback(async (page = 1, isLoadMore = false, isRefresh = false) => {
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

  //     const response = await axios.get(`${getBaseURL()}/api/tenant/users/agents`, {
  //       headers: { Authorization: `Bearer ${token}` },
  //       params: {
  //         page,
  //         limit: 20,
  //         search: searchQuery
  //       }
  //     });

  //     const { users, pagination } = response.data.data;

  //     if (isLoadMore) {
  //       setAgents(prev => [...prev, ...users]);
  //     } else {
  //       setAgents(users);
  //     }

  //     setCurrentPage(pagination.currentPage);
  //     setTotalPages(pagination.totalPages);
  //     setHasMore(pagination.hasNextPage);

  //   } catch (err) {
  //     logError(err, 'fetchAgents');
  //     const message = getErrorMessage(err, 'Failed to fetch repo agents');
  //     setError(message);
  //     showErrorAlert(message);
  //   } finally {
  //     setLoading(false);
  //     setRefreshing(false);
  //     setLoadingMore(false);
  //   }
  // }, [searchQuery]);


  const fetchAgents = useCallback(async (page = 1, isLoadMore = false, isRefresh = false) => {
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

    const response = await axios.get(`${getBaseURL()}/api/tenant/users/agents`, {
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
      setAgents(prev => [...prev, ...users]);
    } else {
      setAgents(users);
    }

    setCurrentPage(pagination.currentPage);
    setTotalPages(pagination.totalPages);
    setHasMore(pagination.hasNextPage);

  } catch (err) {
    logError(err, 'fetchAgents');
    const message = getErrorMessage(err, 'Failed to fetch repo agents');
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
      fetchAgents(1);
    }, 500);
  }, [fetchAgents]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      fetchAgents(currentPage + 1, true);
    }
  }, [hasMore, loadingMore, loading, currentPage, fetchAgents]);

  const handleRefresh = useCallback(() => {
    setCurrentPage(1);
    fetchAgents(1, false, true);
  }, [fetchAgents]);

  useEffect(() => {
    fetchAgents();
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const handleCreateAgent = () => {
    setSelectedUser(null);
    setShowUserModal(true);
  };

  const handleEditAgent = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleDeleteAgent = (userId) => {
    Alert.alert(
      'Delete Repo Agent',
      'Are you sure you want to delete this repo agent? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('token');
              await axios.delete(
                `${getBaseURL()}/api/tenant/users/agents/${userId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              handleRefresh();
              showErrorAlert('Repo agent deleted successfully', 'Success');
            } catch (err) {
              logError(err, 'deleteAgent');
              showErrorAlert(getErrorMessage(err, 'Failed to delete repo agent'));
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
        `${getBaseURL()}/api/tenant/users/agents/${userId}/status`,
        { status: currentStatus === 'active' ? 'inactive' : 'active' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      handleRefresh();
    } catch (err) {
      logError(err, 'toggleAgentStatus');
      showErrorAlert(getErrorMessage(err, 'Failed to update agent status'));
    }
  };

  const handleSubmitUser = async (formData) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (selectedUser) {
        await axios.put(
          `${getBaseURL()}/api/tenant/users/agents/${selectedUser._id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${getBaseURL()}/api/tenant/users/agents`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      setShowUserModal(false);
      handleRefresh();
      showErrorAlert(
        `Repo agent ${selectedUser ? 'updated' : 'created'} successfully`,
        'Success'
      );
    } catch (err) {
      logError(err, 'submitAgent');
      showErrorAlert(getErrorMessage(err, `Failed to ${selectedUser ? 'update' : 'create'} repo agent`));
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
        <Text style={styles.title}>Repo Agents</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleCreateAgent}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search agents..."
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
        data={agents}
        renderItem={({ item }) => (
          <UserCard
            user={item}
            userType="agent"
            onPress={() => handleEditAgent(item)}
            onEdit={() => handleEditAgent(item)}
            onDelete={() => handleDeleteAgent(item._id)}
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
              {searchQuery ? 'No repo agents found' : 'No repo agents added yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Add your first repo agent'}
            </Text>
          </View>
        )}
      />

      <UserFormModal
        visible={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSubmit={handleSubmitUser}
        initialData={selectedUser}
        userType="agent"
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