import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image
} from 'react-native';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';

export default function TenantAdminDashboardScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState({
    totalRecords: 0,
    onHold: 0,
    inYard: 0,
    released: 0,
    twoWheeler: 0,
    fourWheeler: 0,
    cvData: 0,
    userStats: { officeStaff: 0, repoAgents: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = {
    bg: isDark ? '#10121A' : '#F5F5F5',
    textPrimary: isDark ? '#ffffff' : '#111827',
    textSecondary: isDark ? 'rgba(255,255,255,0.7)' : '#64748b',
    cardBg: isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
    cardBorder: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
    buttonBg: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
    comingSoonBg: isDark ? 'rgba(255,193,7,0.2)' : 'rgba(255,193,7,0.1)',
    comingSoonText: '#ff9800',
    gradientPurple: ['#667eea', '#764ba2'],
    gradientOrange: ['#f59e0b', '#fbbf24'],
    gradientBlue: ['#3b82f6', '#60a5fa'],
    gradientGreen: ['#10b981', '#34d399'],
  };

  const fetchDashboardStats = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) throw new Error('No token found');

      const response = await axios.get(`${getBaseURL()}/api/tenant/data/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data?.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      throw err;
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetchDashboardStats();
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, [fetchDashboardStats]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const data = await SecureStore.getItemAsync('userData');
        if (data) {
          const parsed = JSON.parse(data);
          setUserData(parsed);
        }
        await fetchDashboardStats();
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [fetchDashboardStats]);

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('userData');
      await SecureStore.deleteItemAsync('agent');
      navigation.replace('Login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };

  const StatCard = ({ title, value, icon, gradientColors, onPress }) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient colors={gradientColors} style={styles.statGradient}>
        <View style={styles.statContent}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
        <Text style={styles.statIcon}>{icon}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const navigationCards = [
    {
      title: 'Office Staff',
      subtitle: 'Manage staff members',
      icon: '👥',
      color: '#6366f1',
      screen: 'OfficeStaffList',
      comingSoon: false
    },
    {
      title: 'Repo Agents',
      subtitle: 'Manage repo agents',
      icon: '🚗',
      color: '#f59e0b',
      screen: 'RepoAgentList',
      comingSoon: false
    },
    {
      title: 'Pending Approvals',
      subtitle: 'Review new users',
      icon: '⏰',
      color: '#ef4444',
      screen: 'PendingApprovals',
      comingSoon: false
    },
    {
      title: 'Two Wheeler Data',
      subtitle: 'Manage two wheeler files',
      icon: '🏍️',
      color: '#8B5CF6',
      screen: 'TwoWheelerData',
      comingSoon: false
    },
    {
      title: 'Four Wheeler Data',
      subtitle: 'Manage four wheeler files',
      icon: '🚗',
      color: '#3B82F6',
      screen: 'FourWheelerData',
      comingSoon: false
    },
    {
      title: 'CV Data',
      subtitle: 'Manage commercial vehicles',
      icon: '🚚',
      color: '#F59E0B',
      screen: 'CVData',
      comingSoon: false
    },
    {
      title: 'Payment Settings',
      subtitle: 'Configure UPI & plan prices',
      icon: '💳',
      color: '#10B981',
      screen: 'PaymentSettings',
      comingSoon: false
    },
    {
      title: 'Payment Approvals',
      subtitle: 'Approve pending payments',
      icon: '✅',
      color: '#F59E0B',
      screen: 'PaymentApprovals',
      comingSoon: false,
      badge: 0
    },
    {
      title: 'Subscriptions',
      subtitle: 'View user subscriptions',
      icon: '📊',
      color: '#3B82F6',
      screen: 'Subscriptions',
      comingSoon: false
    },
    {
      title: 'Tenant Settings',
      subtitle: 'Configure tenant options',
      icon: '⚙️',
      color: '#6B7280',
      screen: 'TenantSettings',
      comingSoon: false
    },
    {
      title: 'User Statistics',
      subtitle: 'View user activity analytics',
      icon: '📊',
      color: '#8B5CF6',
      screen: 'UserStatistics',
      comingSoon: false
    },
    {
      title: 'Notifications',
      subtitle: 'View share activity',
      icon: '🔔',
      color: '#F59E0B',
      screen: 'Notifications',
      comingSoon: false
    },
    {
      title: 'Client Management',
      subtitle: 'Manage clients',
      icon: '🏢',
      color: '#10B981',
      screen: 'ClientManagement',
      comingSoon: false
    },
    {
      title: 'File Management',
      subtitle: 'Upload and manage data',
      icon: '📁',
      color: '#8b5cf6',
      screen: null,
      comingSoon: true
    },
    {
      title: 'Analytics',
      subtitle: 'View reports',
      icon: '📊',
      color: '#3b82f6',
      screen: null,
      comingSoon: true
    }
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="#4F46E5" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image 
              source={require('../assets/logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: '#fff' }]}>Tenant Admin Dashboard</Text>
            <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]}>
              {userData?.tenantName ? `Managing ${userData.tenantName}` : 'Tenant Management'}
            </Text>
            <Text style={[styles.welcome, { color: '#fff' }]}>
              Welcome back, {userData?.name || userData?.firstName || 'Admin'}!
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsGrid}>
          <StatCard title="Total Records" value={stats.totalRecords} icon="📊" gradientColors={theme.gradientPurple} />
          <StatCard title="On Hold" value={stats.onHold} icon="⏸️" gradientColors={theme.gradientOrange} />
          <StatCard title="In Yard" value={stats.inYard} icon="🚗" gradientColors={theme.gradientBlue} />
          <StatCard title="Released" value={stats.released} icon="✅" gradientColors={theme.gradientGreen} />
        </View>

        {/* Vehicle Data Summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: '#4F46E5' }]}>Vehicle Data Summary</Text>
          <View style={styles.vehicleGrid}>
            <View style={styles.vehicleItem}>
              <Text style={styles.vehicleIcon}>🏍️</Text>
              <Text style={styles.vehicleCount}>{stats.twoWheeler}</Text>
              <Text style={styles.vehicleLabel}>Two Wheeler</Text>
            </View>
            <View style={styles.vehicleItem}>
              <Text style={styles.vehicleIcon}>🚗</Text>
              <Text style={styles.vehicleCount}>{stats.fourWheeler}</Text>
              <Text style={styles.vehicleLabel}>Four Wheeler</Text>
            </View>
            <View style={styles.vehicleItem}>
              <Text style={styles.vehicleIcon}>🚚</Text>
              <Text style={styles.vehicleCount}>{stats.cvData}</Text>
              <Text style={styles.vehicleLabel}>CV Data</Text>
            </View>
          </View>
        </View>

        {/* User Statistics */}
        <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: '#4F46E5' }]}>User Statistics</Text>
          <View style={styles.userStats}>
            <View style={styles.userStatRow}>
              <Text style={styles.userStatLabel}>Office Staff</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '75%' }]} />
              </View>
              <Text style={styles.userStatCount}>{stats.userStats.officeStaff}</Text>
            </View>
            <View style={styles.userStatRow}>
              <Text style={styles.userStatLabel}>Repo Agents</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '60%' }]} />
              </View>
              <Text style={styles.userStatCount}>{stats.userStats.repoAgents}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.quickActionsTitle, { color: theme.textPrimary }]}>Quick Actions</Text>
        <View style={styles.navigationGrid}>
          {navigationCards.map((card, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.navCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onPress={() => card.screen ? navigation.navigate(card.screen) : Alert.alert('Coming Soon', `${card.title} will be available soon`)}
              activeOpacity={0.8}
            >
              <Text style={[styles.navIcon, { color: card.color }]}>{card.icon}</Text>
              <Text style={[styles.navTitle, { color: theme.textPrimary }]}>{card.title}</Text>
              <Text style={[styles.navSubtitle, { color: theme.textSecondary }]}>{card.subtitle}</Text>
              {card.comingSoon && <Text style={styles.comingSoonBadge}>Coming Soon</Text>}
              {card.badge > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{card.badge}</Text></View>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
  },
  logo: {
    width: 120,
    height: 60,
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  welcome: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statGradient: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  statTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  statIcon: {
    fontSize: 32,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  vehicleGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  vehicleItem: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  vehicleIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  vehicleCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: 4,
  },
  vehicleLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  userStats: {
    gap: 16,
  },
  userStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userStatLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  progressBar: {
    flex: 2,
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginHorizontal: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 3,
  },
  userStatCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  navigationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  navCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  navSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff9800',
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    textTransform: 'uppercase',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
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
});
