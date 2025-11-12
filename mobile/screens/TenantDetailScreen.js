import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError } from '../utils/errorHandler';

export default function TenantDetailScreen({ navigation, route }) {
  const { tenantId } = route.params;
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    fetchTenantDetails();
  }, []);

  const fetchTenantDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await axios.get(`${getBaseURL()}/api/tenants/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setTenant(response.data.data.tenant);
        setAdminUser(response.data.data.tenant.adminUser);
      } else {
        setError('Failed to fetch tenant details');
      }
    } catch (err) {
      logError(err, 'fetchTenantDetails');
      setError('Failed to fetch tenant details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = () => {
    Alert.alert(
      'Delete Tenant',
      'Are you sure you want to delete this tenant? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete }
      ]
    );
  };

  const confirmDelete = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      await axios.delete(`${getBaseURL()}/api/tenants/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Success', 'Tenant deleted successfully');
      navigation.goBack();
    } catch (err) {
      logError(err, 'deleteTenant');
      Alert.alert('Error', 'Failed to delete tenant');
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'agency': return '#FF9800';
      case 'nbfc': return '#2196F3';
      case 'bank': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getPlanColor = (plan) => {
    switch (plan) {
      case 'basic': return '#9E9E9E';
      case 'premium': return '#9C27B0';
      case 'enterprise': return '#FFD700';
      default: return '#9E9E9E';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading tenant details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTenantDetails}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!tenant) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Tenant not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Tenant Details</Text>
        <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('TenantForm', { tenantId, mode: 'edit' })}>
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
      </LinearGradient>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Basic Info Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <Text style={styles.tenantName}>{tenant.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: getTypeColor(tenant.type) }]}>
              <Text style={styles.badgeText}>{tenant.type}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: tenant.isActive ? '#4CAF50' : '#F44336' }]}>
              <Text style={styles.badgeText}>{tenant.isActive ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>
          <Text style={styles.detailText}>Created: {new Date(tenant.createdAt).toLocaleDateString()}</Text>
          <Text style={styles.detailText}>Created by: {tenant.createdBy?.firstName} {tenant.createdBy?.lastName}</Text>
        </View>
        {/* Subscription Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: getPlanColor(tenant.subscription?.plan) }]}>
              <Text style={styles.badgeText}>{tenant.subscription?.plan}</Text>
            </View>
          </View>
          <Text style={styles.detailText}>Max Users: {tenant.subscription?.maxUsers}</Text>
          <Text style={styles.detailText}>Current Users: {tenant.subscription?.currentUsers || 0}</Text>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${((tenant.subscription?.currentUsers || 0) / tenant.subscription?.maxUsers) * 100}%` }]} />
          </View>
          <Text style={styles.detailText}>Start Date: {tenant.subscription?.startDate ? new Date(tenant.subscription.startDate).toLocaleDateString() : 'N/A'}</Text>
          <Text style={styles.detailText}>End Date: {tenant.subscription?.endDate ? new Date(tenant.subscription.endDate).toLocaleDateString() : 'N/A'}</Text>
        </View>
        {/* Admin Account Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Admin Account</Text>
          <Text style={styles.detailText}>Name: {adminUser?.firstName} {adminUser?.lastName}</Text>
          <Text style={styles.detailText}>Email: {adminUser?.email}</Text>
          <Text style={styles.detailText}>Role: {adminUser?.role}</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Coming Soon', 'View Admin Profile feature coming soon')}>
            <Text style={styles.actionButtonText}>View Admin Profile</Text>
          </TouchableOpacity>
        </View>
        {/* Settings Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Text style={styles.detailText}>Data Multiplier: {tenant.settings?.dataMultiplier || 1}</Text>
          <Text style={styles.detailText}>Max File Size: {tenant.settings?.maxFileSize || 'N/A'}</Text>
          <Text style={styles.detailText}>Allow User Registration: {tenant.settings?.allowUserRegistration ? 'Yes' : 'No'}</Text>
          <Text style={styles.detailText}>Require Email Verification: {tenant.settings?.requireEmailVerification ? 'Yes' : 'No'}</Text>
        </View>
        {/* Statistics Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <Text style={styles.detailText}>Total Users: {tenant.userCount || 0}</Text>
          <Text style={styles.detailText}>Total Files: {tenant.fileCount || 0}</Text>
          <Text style={styles.detailText}>Active Users: {tenant.activeUserCount || 0}</Text>
        </View>
        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TenantForm', { tenantId, mode: 'edit' })}>
            <Text style={styles.primaryButtonText}>Edit Tenant</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('AllUsers', { tenantId })}>
            <Text style={styles.secondaryButtonText}>View Users</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => Alert.alert('Coming Soon', 'Manage Subscription feature coming soon')}>
            <Text style={styles.secondaryButtonText}>Manage Subscription</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteTenant}>
            <Text style={styles.dangerButtonText}>Delete Tenant</Text>
          </TouchableOpacity>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
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
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIcon: {
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  card: {
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
  sectionTitle: {
    color: '#4F46E5',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  tenantName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  actionButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  actionsContainer: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 16,
  },
  dangerButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});