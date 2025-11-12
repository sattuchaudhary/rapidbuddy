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
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, showErrorAlert, getErrorMessage } from '../utils/errorHandler';

export default function ClientManagementScreen({ navigation }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClients, setFilteredClients] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [formData, setFormData] = useState({ name: '' });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ totalClients: 0, activeClients: 0 });

  const nameInputRef = useRef(null);

  const fetchClients = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setError('Please login again');
        return;
      }

      const response = await axios.get(`${getBaseURL()}/api/clients?limit=all`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const clientData = response.data.data || [];
        setClients(clientData);
        setFilteredClients(clientData);
        setStats({
          totalClients: clientData.length,
          activeClients: clientData.filter(c => c.status === 'active').length
        });
      } else {
        setError('Failed to fetch clients');
      }
    } catch (err) {
      logError(err, 'fetchClients');
      const message = getErrorMessage(err, 'Failed to fetch clients');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleAddClient = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await axios.post(`${getBaseURL()}/api/clients`, {
        name: formData.name.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        Alert.alert('Success', 'Client added successfully');
        fetchClients();
        closeModal();
      } else {
        Alert.alert('Error', 'Failed to add client');
      }
    } catch (err) {
      logError(err, 'handleAddClient');
      const message = getErrorMessage(err, 'Failed to add client');
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClient = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await axios.put(`${getBaseURL()}/api/clients/${selectedClient._id}`, {
        name: formData.name.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        Alert.alert('Success', 'Client updated successfully');
        fetchClients();
        closeModal();
      } else {
        Alert.alert('Error', 'Failed to update client');
      }
    } catch (err) {
      logError(err, 'handleEditClient');
      const message = getErrorMessage(err, 'Failed to update client');
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId, clientName) => {
    Alert.alert(
      'Delete Client',
      `Are you sure you want to delete ${clientName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('token');
              const response = await axios.delete(`${getBaseURL()}/api/clients/${clientId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });

              if (response.data.success) {
                Alert.alert('Success', 'Client deleted successfully');
                fetchClients();
              } else {
                Alert.alert('Error', 'Failed to delete client');
              }
            } catch (err) {
              logError(err, 'handleDeleteClient');
              const message = getErrorMessage(err, 'Failed to delete client');
              Alert.alert('Error', message);
            }
          }
        }
      ]
    );
  };

  const handleRefresh = () => {
    fetchClients(true);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    const filtered = clients.filter(client =>
      client.name.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredClients(filtered);
  };

  const validateForm = () => {
    const errors = {};
    const name = formData.name.trim();

    if (!name) {
      errors.name = 'Client name is required';
    } else if (name.length < 2) {
      errors.name = 'Client name must be at least 2 characters';
    } else if (name.length > 100) {
      errors.name = 'Client name must be less than 100 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    setFormData({ name: '' });
    setFormErrors({});
    setShowAddModal(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  };

  const openEditModal = (client) => {
    setSelectedClient(client);
    setFormData({ name: client.name });
    setFormErrors({});
    setShowEditModal(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedClient(null);
    setFormData({ name: '' });
    setFormErrors({});
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const renderClientItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.clientCard}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.clientName}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? '#4CAF50' : '#9E9E9E' }]}>
            <Text style={styles.statusText}>{item.status === 'active' ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <Text style={styles.clientId}>{item._id}</Text>
          <View style={styles.dateRow}>
            <Text style={styles.dateIcon}>📅</Text>
            <Text style={styles.dateText}>{formatDate(item.createdOn)}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => openEditModal(item)}
          >
            <Ionicons name="pencil" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteClient(item._id, item.name)}
          >
            <Ionicons name="trash" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  ), []);

  const renderEmptyState = () => {
    if (loading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchClients()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (searchQuery && filteredClients.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyMessage}>No results found</Text>
          <Text style={styles.emptySubtitle}>Try different keywords</Text>
        </View>
      );
    }

    if (clients.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏢</Text>
          <Text style={styles.emptyMessage}>No clients found</Text>
          <Text style={styles.emptySubtitle}>Add your first client</Text>
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Text style={styles.addButtonText}>Add Client</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  const renderModal = () => {
    const isEdit = showEditModal;
    const isVisible = showAddModal || showEditModal;

    return (
      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEdit ? 'Edit Client' : 'Add Client'}
            </Text>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <TextInput
                ref={nameInputRef}
                style={[styles.textInput, formErrors.name && styles.inputError]}
                placeholder="e.g., ABC Finance Ltd."
                value={formData.name}
                onChangeText={(text) => {
                  setFormData({ name: text });
                  if (formErrors.name) {
                    setFormErrors({ ...formErrors, name: '' });
                  }
                }}
                onBlur={validateForm}
                editable={!submitting}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {formErrors.name && (
                <Text style={styles.errorText}>{formErrors.name}</Text>
              )}
            </View>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={closeModal}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, (!validateForm() || submitting) && styles.saveButtonDisabled]}
              onPress={isEdit ? handleEditClient : handleAddClient}
              disabled={!validateForm() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEdit ? 'Update Client' : 'Add Client'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Client Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients by name..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>🏢</Text>
          <Text style={styles.statValue}>{stats.totalClients}</Text>
          <Text style={styles.statLabel}>Total Clients</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>✅</Text>
          <Text style={styles.statValue}>{stats.activeClients}</Text>
          <Text style={styles.statLabel}>Active Clients</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading clients...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClients}
          renderItem={renderClientItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={filteredClients.length === 0 ? styles.emptyList : styles.listContainer}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {renderModal()}
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  listContainer: {
    paddingBottom: 20,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  clientCard: {
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
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardDetails: {
    marginBottom: 12,
  },
  clientId: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
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
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
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
  addButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: '#EEEEEE',
    borderColor: '#BDBDBD',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});