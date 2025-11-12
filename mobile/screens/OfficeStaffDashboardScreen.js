import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  Image,
} from 'react-native';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

export default function OfficeStaffDashboardScreen({ navigation }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = {
    bg: isDark ? '#10121A' : '#f8fafc',
    textPrimary: isDark ? '#ffffff' : '#111827',
    textSecondary: isDark ? 'rgba(255,255,255,0.7)' : '#64748b',
    cardBg: isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
    cardBorder: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
    buttonBg: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
    buttonText: isDark ? '#FCA5A5' : '#B91C1C',
  };

  const [userData, setUserData] = useState(null);
  const [staffRole, setStaffRole] = useState('Staff');

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const data = await SecureStore.getItemAsync('userData');
        if (data) {
          const parsed = JSON.parse(data);
          setUserData(parsed);
          setStaffRole(parsed.role || 'Staff');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    loadUserData();
  }, []);

  const logout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync('token');
            await SecureStore.deleteItemAsync('userData');
            await SecureStore.deleteItemAsync('agent');
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Office Staff Dashboard</Text>
          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: theme.buttonBg }]} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={theme.buttonText} />
            <Text style={[styles.logoutText, { color: theme.buttonText }]}>Logout</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.userInfo}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.userName, { color: theme.textPrimary }]}> {
            (userData?.name || `${(userData?.firstName || '').trim()} ${(userData?.lastName || '').trim()}`.trim() || 'Staff Member')
          }</Text>
          <Text style={[styles.userRole, { color: theme.textSecondary }]}>
            Role: {staffRole}
          </Text>
          <Text style={[styles.tenantName, { color: theme.textSecondary }]}>
            {userData?.tenantName || 'Organization'}
          </Text>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        
        {/* Coming Soon Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Coming Soon</Text>
          <Text style={[styles.sectionText, { color: theme.textSecondary }]}>
            Full Office Staff features including data entry, approval workflows, and limited operations will be available in upcoming phases.
          </Text>
        </View>

        {/* Upcoming Features List */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Upcoming Features</Text>
          <Text style={[styles.featureItem, { color: theme.textSecondary }]}>• Data Entry Forms (vehicle information)</Text>
          <Text style={[styles.featureItem, { color: theme.textSecondary }]}>• Approval Workflows (pending tasks)</Text>
          <Text style={[styles.featureItem, { color: theme.textSecondary }]}>• Limited View Access (statistics)</Text>
          <Text style={[styles.featureItem, { color: theme.textSecondary }]}>• Task Management</Text>
        </View>

        {/* Placeholder Cards */}
        <View style={styles.cardsContainer}>
          <TouchableOpacity style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} disabled>
            <Ionicons name="document-text-outline" size={24} color={theme.textSecondary} />
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Data Entry</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Coming Soon</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} disabled>
            <Ionicons name="checkmark-circle-outline" size={24} color={theme.textSecondary} />
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Pending Approvals</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Coming Soon</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} disabled>
            <Ionicons name="bar-chart-outline" size={24} color={theme.textSecondary} />
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>View Statistics</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Coming Soon</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} disabled>
            <Ionicons name="list-outline" size={24} color={theme.textSecondary} />
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>My Tasks</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Coming Soon</Text>
          </TouchableOpacity>
        </View>

        {/* Permissions Note */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Permissions</Text>
          <Text style={[styles.sectionText, { color: theme.textSecondary }]}>
            Access is limited based on your role ({staffRole}). Full features will be unlocked as development progresses.
          </Text>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  userInfo: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 60,
    marginBottom: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userRole: {
    fontSize: 14,
    marginTop: 2,
  },
  tenantName: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  featureItem: {
    fontSize: 14,
    marginVertical: 2,
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  card: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});