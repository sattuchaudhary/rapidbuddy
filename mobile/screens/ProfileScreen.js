import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, StatusBar, Alert, Linking, ActivityIndicator, Animated, RefreshControl, useColorScheme, Appearance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import VersionChecker from '../components/VersionChecker';
import UpdateNotification from '../components/UpdateNotification';
import { getBaseURL } from '../utils/config';
import axios from 'axios';
import { maskPhoneNumber } from '../utils/format';
import { logError } from '../utils/errorHandler';

export default function ProfileScreen({ navigation }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remainingMs, setRemainingMs] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [graceEnd, setGraceEnd] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [stats, setStats] = useState({
    totalSearches: 0,
    totalShares: 0,
    lastSync: null
  });
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  
  const theme = {
    bg: isDark ? '#0F111A' : '#F8FAFC',
    cardBg: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#F1F5F9' : '#1E293B',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
    iconBg: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF',
  };

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('agent');
        if (stored) setAgent(JSON.parse(stored));
        
        // Load user statistics
        await loadUserStats();
        await loadSubscriptionRemaining();
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
        // Animate entrance
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }
    })();
  }, []);

  // Listen for theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme: newColorScheme }) => {
      // Theme will update automatically via useColorScheme
    });
    return () => subscription?.remove();
  }, []);

  const loadUserStats = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;

      const response = await axios.get(`${getBaseURL()}/api/history/user-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data?.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadSubscriptionRemaining = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;
      const res = await axios.get(`${getBaseURL()}/api/tenants/subscription/remaining`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res?.data?.data || {};
      const remaining = typeof data.remainingMs === 'number' ? data.remainingMs : 0;
      const end = data.endDate || null;
      const status = data.status || null;
      const gracePeriodEnd = data.gracePeriodEnd || null;
      setRemainingMs(remaining);
      setEndDate(end ? new Date(end) : null);
      setSubStatus(status);
      setGraceEnd(gracePeriodEnd ? new Date(gracePeriodEnd) : null);
    } catch (error) {
      logError(error, 'loadSubscriptionRemaining', 'Failed to load subscription status');
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadUserStats(), loadSubscriptionRemaining()]);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const ProfileField = ({ icon, label, value, iconName, theme }) => (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldRow}>
        <View style={[styles.fieldIconContainer, { backgroundColor: theme.iconBg }]}>
          <Ionicons name={iconName || 'person-outline'} size={18} color="#6366F1" />
        </View>
        <View style={styles.fieldContent}>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
          <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>{value || 'Not available'}</Text>
        </View>
      </View>
    </View>
  );

  const PersonalInfoCard = ({ icon, label, value, gradient, theme }) => (
    <View style={styles.personalInfoCard}>
      <LinearGradient
        colors={gradient || ['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.personalInfoGradient}
      >
        <View style={styles.personalInfoIconContainer}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.personalInfoLabel}>{label}</Text>
        <Text style={styles.personalInfoValue} numberOfLines={1}>{value || '—'}</Text>
      </LinearGradient>
    </View>
  );

  const SubscriptionProgressBar = ({ remainingMs, endDate, theme }) => {
    if (!remainingMs || !endDate) return null;
    
    const totalMs = endDate.getTime() - (endDate.getTime() - remainingMs);
    const progress = Math.max(0, Math.min(1, remainingMs / (30 * 24 * 60 * 60 * 1000))); // Assuming 30 days subscription
    
    return (
      <View style={styles.progressContainer}>
        <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
          <LinearGradient
            colors={['#10B981', '#34D399']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
          />
        </View>
        <Text style={[styles.progressText, { color: theme.textSecondary }]}>
          {Math.round(progress * 100)}% remaining
        </Text>
      </View>
    );
  };

  const StatCard = ({ icon, value, label, gradient, style }) => (
    <LinearGradient
      colors={gradient || ['#667eea', '#764ba2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.statCard, style]}
    >
      <View style={styles.statIconContainer}>
        <Ionicons name={icon} size={28} color="#FFFFFF" />
      </View>
      <Text style={styles.statCardNumber}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </LinearGradient>
  );

  const ActionButton = ({ icon, title, subtitle, onPress, color = '#6366F1', isLast = false, theme }) => (
    <TouchableOpacity 
      style={[styles.modernActionButton, isLast && styles.lastActionButton, { borderBottomColor: theme.border }]} 
      activeOpacity={0.7} 
      onPress={onPress}
    >
      <View style={[styles.actionIconWrapper, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.modernActionContent}>
        <Text style={[styles.modernActionTitle, { color: theme.textPrimary }]}>{title}</Text>
        <Text style={[styles.modernActionSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  const QuickActionButton = ({ icon, title, onPress, gradient, theme }) => (
    <TouchableOpacity 
      style={styles.quickActionButton}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <LinearGradient
        colors={gradient || ['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.quickActionGradient}
      >
        <View style={styles.quickActionIconContainer}>
          <Ionicons name={icon} size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.quickActionTitle}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const SubscriptionInfoCard = ({ icon, title, value, gradient, theme }) => (
    <View style={styles.subscriptionInfoCard}>
      <LinearGradient
        colors={gradient || ['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.subscriptionInfoGradient}
      >
        <View style={styles.subscriptionInfoIconContainer}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.subscriptionInfoTitle}>{title}</Text>
        <Text style={styles.subscriptionInfoValue}>{value}</Text>
      </LinearGradient>
    </View>
  );

  const SubscriptionActionButton = ({ icon, title, onPress, gradient, theme }) => (
    <TouchableOpacity 
      style={styles.subscriptionActionButton}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <LinearGradient
        colors={gradient || ['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.subscriptionActionGradient}
      >
        <View style={styles.subscriptionActionIconContainer}>
          <Ionicons name={icon} size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.subscriptionActionTitle}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleUpdateAvailable = (updateData) => {
    setUpdateInfo(updateData);
    setShowUpdateModal(true);
  };

  const handleUpdateModalClose = () => {
    setShowUpdateModal(false);
    setUpdateInfo(null);
  };

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
              await SecureStore.deleteItemAsync('agent');
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all offline data and cached files. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              const offlineDataPath = `${FileSystem.documentDirectory}offline_data.json`;
              const exists = await FileSystem.getInfoAsync(offlineDataPath);
              if (exists.exists) {
                await FileSystem.deleteAsync(offlineDataPath);
              }
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              console.error('Clear cache error:', error);
              Alert.alert('Error', 'Failed to clear cache');
            }
          }
        }
      ]
    );
  };

  const handleSyncData = async () => {
    try {
      Alert.alert('Sync', 'Syncing data...');
      // Add sync logic here
      await loadUserStats();
      Alert.alert('Success', 'Data synced successfully');
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync data');
    }
  };

  const handleContactSupport = () => {
    const phoneNumber = '+91-9876543210'; // Replace with actual support number
    const url = `tel:${phoneNumber}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open phone dialer');
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      {/* Gradient Header */}
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <Animated.View 
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366F1"
              colors={['#6366F1']}
            />
          }
        >
        {/* Profile Avatar Section with Gradient */}
        <View style={styles.avatarSection}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.avatarGradient}
          >
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{getInitials(agent?.name)}</Text>
            </View>
          </LinearGradient>
          <Text style={[styles.welcomeText, { color: theme.textSecondary }]}>Welcome back!</Text>
          <Text style={[styles.nameText, { color: theme.textPrimary }]}>{agent?.name || 'User'}</Text>
          <View style={[styles.roleBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' }]}>
            <Text style={styles.roleText}>
              {agent?.role || agent?.designation || agent?.userType || 'User'}
            </Text>
          </View>
        </View>

        {/* Profile Information Card */}
        <View style={[styles.modernCard, { backgroundColor: theme.cardBg }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle-outline" size={24} color="#6366F1" />
            <Text style={[styles.modernSectionTitle, { color: theme.textPrimary }]}>Personal Information</Text>
          </View>
          
          <View style={styles.personalInfoGrid}>
            <PersonalInfoCard
              icon="person-outline"
              label="Full Name"
              value={agent?.name}
              gradient={['#667eea', '#764ba2']}
              theme={theme}
            />
            <PersonalInfoCard
              icon="mail-outline"
              label="Email"
              value={agent?.email}
              gradient={['#f093fb', '#f5576c']}
              theme={theme}
            />
            <PersonalInfoCard
              icon="call-outline"
              label="Phone"
              value={agent?.phoneNumber ? maskPhoneNumber(agent.phoneNumber) : undefined}
              gradient={['#3b82f6', '#60a5fa']}
              theme={theme}
            />
            <PersonalInfoCard
              icon="business-outline"
              label="Organization"
              value={agent?.tenantName}
              gradient={['#10b981', '#34d399']}
              theme={theme}
            />
          </View>
        </View>

        {/* Subscription Info */}
        <View style={[styles.modernCard, { backgroundColor: theme.cardBg }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="card-outline" size={24} color="#6366F1" />
              <Text style={[styles.modernSectionTitle, { color: theme.textPrimary }]}>Subscription</Text>
            </View>
            <View style={[styles.statusBadge, { 
              backgroundColor: (() => {
                if (subStatus === 'active' || (remainingMs != null && remainingMs > 0)) return isDark ? 'rgba(16, 185, 129, 0.2)' : '#F0FDF4';
                if (subStatus === 'trial' || subStatus === 'grace_period') return isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7';
                return isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2';
              })()
            }]}>
              <Ionicons 
                name={(() => {
                  if (subStatus === 'active' || (remainingMs != null && remainingMs > 0)) return 'checkmark-circle';
                  if (subStatus === 'trial') return 'time-outline';
                  if (subStatus === 'grace_period') return 'warning-outline';
                  return 'close-circle';
                })()} 
                size={16} 
                color={(() => {
                  if (subStatus === 'active' || (remainingMs != null && remainingMs > 0)) return '#10B981';
                  if (subStatus === 'trial') return '#F59E0B';
                  if (subStatus === 'grace_period') return '#F59E0B';
                  return '#EF4444';
                })()} 
              />
              <Text style={[styles.statusText, {
                color: (() => {
                  if (subStatus === 'active' || (remainingMs != null && remainingMs > 0)) return '#10B981';
                  if (subStatus === 'trial') return '#F59E0B';
                  if (subStatus === 'grace_period') return '#F59E0B';
                  return '#EF4444';
                })()
              }]}>
                {(() => {
                  if (subStatus) {
                    if (['active', 'trial'].includes(subStatus)) {
                      return subStatus === 'trial' ? 'Trial' : 'Active';
                    }
                    if (subStatus === 'grace_period') {
                      return 'Grace';
                    }
                    return subStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  }
                  if (remainingMs != null) {
                    return remainingMs > 0 ? 'Active' : 'Expired';
                  }
                  return 'Loading...';
                })()}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <SubscriptionProgressBar remainingMs={remainingMs} endDate={endDate} theme={theme} />

          {/* Subscription Info Cards Grid */}
          <View style={styles.subscriptionInfoGrid}>
            <SubscriptionInfoCard
              icon="time-outline"
              title="Time Remaining"
              value={remainingMs != null && remainingMs > 0 
                ? `${Math.floor(remainingMs / (1000*60*60*24))}d ${Math.floor((remainingMs/(1000*60*60))%24)}h`
                : (subStatus === 'grace_period' && graceEnd ? `Until ${graceEnd.toLocaleDateString()}` : '—')}
              gradient={['#667eea', '#764ba2']}
              theme={theme}
            />
            <SubscriptionInfoCard
              icon="calendar-outline"
              title="Ends On"
              value={endDate ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
              gradient={['#f093fb', '#f5576c']}
              theme={theme}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.subscriptionActionsRow}>
            <SubscriptionActionButton
              icon="card-outline"
              title="Renew Payment"
              onPress={() => navigation.navigate('Payment')}
              gradient={['#10b981', '#34d399']}
              theme={theme}
            />
            <SubscriptionActionButton
              icon="document-text-outline"
              title="Payment History"
              onPress={() => navigation.navigate('PaymentHistory')}
              gradient={['#3b82f6', '#60a5fa']}
              theme={theme}
            />
          </View>
        </View>

        {/* Statistics Card */}
        <View style={[styles.modernCard, { backgroundColor: theme.cardBg }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="stats-chart-outline" size={24} color="#6366F1" />
            <Text style={[styles.modernSectionTitle, { color: theme.textPrimary }]}>Activity Summary</Text>
          </View>
          
          <View style={styles.statsRow}>
            <StatCard
              icon="search-outline"
              value={stats.totalSearches || 0}
              label="Total Searches"
              gradient={['#667eea', '#764ba2']}
              style={{ marginRight: 6 }}
            />
            <StatCard
              icon="share-outline"
              value={stats.totalShares || 0}
              label="Total Shares"
              gradient={['#f093fb', '#f5576c']}
              style={{ marginLeft: 6 }}
            />
          </View>

          {stats.lastSync && (
            <View style={[styles.lastSyncContainer, { borderTopColor: theme.border }]}>
              <Ionicons name="sync-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.lastSyncLabel, { color: theme.textSecondary }]}>Last Sync: </Text>
              <Text style={[styles.lastSyncValue, { color: '#6366F1' }]}>
                {new Date(stats.lastSync).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={[styles.modernCard, { backgroundColor: theme.cardBg }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="flash-outline" size={24} color="#6366F1" />
            <Text style={[styles.modernSectionTitle, { color: theme.textPrimary }]}>Quick Actions</Text>
          </View>
          
          <View style={styles.quickActionsGrid}>
            <QuickActionButton
              icon="sync-outline"
              title="Sync Data"
              onPress={handleSyncData}
              gradient={['#667eea', '#764ba2']}
              theme={theme}
            />
            <QuickActionButton
              icon="trash-outline"
              title="Clear Cache"
              onPress={handleClearCache}
              gradient={['#f59e0b', '#fbbf24']}
              theme={theme}
            />
            <QuickActionButton
              icon="settings-outline"
              title="Settings"
              onPress={() => navigation.navigate('Settings')}
              gradient={['#3b82f6', '#60a5fa']}
              theme={theme}
            />
            <QuickActionButton
              icon="call-outline"
              title="Support"
              onPress={handleContactSupport}
              gradient={['#10b981', '#34d399']}
              theme={theme}
            />
          </View>
        </View>

        {/* Account Actions */}
        <View style={[styles.modernCard, { backgroundColor: theme.cardBg }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={24} color="#6366F1" />
            <Text style={[styles.modernSectionTitle, { color: theme.textPrimary }]}>Account</Text>
          </View>
          
          <ActionButton
            icon="log-out-outline"
            title="Logout"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            color="#EF4444"
            isLast={true}
            theme={theme}
          />
        </View>

        {/* Version Checker Section */}
        <View style={[styles.modernCard, { backgroundColor: theme.cardBg }]}>
          <VersionChecker onUpdateAvailable={handleUpdateAvailable} />
        </View>
      </ScrollView>
      </Animated.View>

      {/* Update Notification Modal */}
      <UpdateNotification
        visible={showUpdateModal}
        onClose={handleUpdateModalClose}
        updateInfo={updateInfo}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  headerGradient: {
    paddingTop: 4,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    marginTop: -20,
  },
  avatarGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#667eea',
    fontSize: 36,
    fontWeight: '700',
  },
  welcomeText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  nameText: {
    color: '#1E293B',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  roleText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '600',
  },
  modernCard: {
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  progressContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernSectionTitle: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: -0.3,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  fieldIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionStatusContainer: {
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  actionDivider: {
    height: 1,
    marginVertical: 16,
  },
  modernActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastActionButton: {
    borderBottomWidth: 0,
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modernActionContent: {
    flex: 1,
  },
  modernActionTitle: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modernActionSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statCardNumber: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  statCardLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9,
    textAlign: 'center',
  },
  lastSyncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 8,
  },
  lastSyncLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  lastSyncValue: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  quickActionButton: {
    width: '48%',
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  quickActionGradient: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 85,
  },
  quickActionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subscriptionInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  subscriptionInfoCard: {
    width: '48%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  subscriptionInfoGradient: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 95,
  },
  subscriptionInfoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionInfoTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    opacity: 0.9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  subscriptionInfoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  subscriptionActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  subscriptionActionButton: {
    width: '48%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  subscriptionActionGradient: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  subscriptionActionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionActionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  personalInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  personalInfoCard: {
    width: '48%',
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  personalInfoGradient: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 95,
  },
  personalInfoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  personalInfoLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    opacity: 0.9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  personalInfoValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
});