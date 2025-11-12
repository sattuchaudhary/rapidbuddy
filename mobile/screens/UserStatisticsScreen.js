import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StatusBar, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, showErrorAlert, getErrorMessage } from '../utils/errorHandler';
import { BarChart } from 'react-native-gifted-charts';

const { width: screenWidth } = Dimensions.get('window');

export default function UserStatisticsScreen({ navigation }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('searches');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const fetchUserStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
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

      const response = await axios.get(`${getBaseURL()}/api/tenant/users/agents/stats/search`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const statsData = response.data?.data || [];
      setStats(statsData);
    } catch (err) {
      logError(err, 'fetchUserStats');
      const message = getErrorMessage(err, 'Failed to fetch user statistics');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUserStats();
  }, [fetchUserStats]);

  const handleRefresh = useCallback(() => {
    fetchUserStats(true);
  }, [fetchUserStats]);

  const getMetricKey = (metric) => {
    switch (metric) {
      case 'searches': return 'vehiclesSearched';
      case 'hours': return 'totalHours';
      case 'whatsapp': return 'whatsappCount';
      default: return 'vehiclesSearched';
    }
  };

  const getChartTitle = (metric) => {
    switch (metric) {
      case 'searches': return 'Top Users by Vehicle Searches';
      case 'hours': return 'App Usage Hours';
      case 'whatsapp': return 'WhatsApp Share Count';
      default: return 'Top Users by Vehicle Searches';
    }
  };

  const chartData = useMemo(() => {
    const metricKey = getMetricKey(selectedMetric);
    return stats.slice(0, 10).map(s => ({
      value: s[metricKey] || 0,
      label: s.name.substring(0, 8)
    }));
  }, [stats, selectedMetric]);

  const totalUsers = stats.length;
  const totalSearches = stats.reduce((sum, s) => sum + (s.vehiclesSearched || 0), 0);
  const totalWhatsApp = stats.reduce((sum, s) => sum + (s.whatsappCount || 0), 0);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>User Statistics</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {!bannerDismissed && (
          <View style={styles.banner}>
            <Text style={styles.bannerIcon}>ℹ️</Text>
            <Text style={styles.bannerText}>
              Note: Hours, Logins, and Syncs data will be available in a future update. Currently showing vehicle searches and WhatsApp shares.
            </Text>
            <TouchableOpacity onPress={() => setBannerDismissed(true)}>
              <Text style={styles.bannerClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, selectedMetric === 'searches' ? styles.toggleSelected : styles.toggleUnselected]}
            onPress={() => setSelectedMetric('searches')}
          >
            <Text style={[styles.toggleText, selectedMetric === 'searches' ? styles.toggleTextSelected : styles.toggleTextUnselected]}>
              Vehicle Searches
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, selectedMetric === 'hours' ? styles.toggleSelected : styles.toggleUnselected]}
            onPress={() => setSelectedMetric('hours')}
          >
            <Text style={[styles.toggleText, selectedMetric === 'hours' ? styles.toggleTextSelected : styles.toggleTextUnselected]}>
              App Usage Hours
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, selectedMetric === 'whatsapp' ? styles.toggleSelected : styles.toggleUnselected]}
            onPress={() => setSelectedMetric('whatsapp')}
          >
            <Text style={[styles.toggleText, selectedMetric === 'whatsapp' ? styles.toggleTextSelected : styles.toggleTextUnselected]}>
              WhatsApp Shares
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{getChartTitle(selectedMetric)}</Text>
          {chartData.length > 0 ? (
            <BarChart
              data={chartData}
              barWidth={30}
              barBorderRadius={4}
              frontColor="#4F46E5"
              yAxisThickness={1}
              xAxisThickness={1}
              xAxisLabelTextStyle={{ fontSize: 10, color: '#666' }}
              yAxisTextStyle={{ fontSize: 10, color: '#666' }}
              noOfSections={5}
              spacing={20}
              height={200}
              width={screenWidth - 64}
            />
          ) : (
            <Text style={styles.noDataText}>No data available</Text>
          )}
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>👥</Text>
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Total Users</Text>
              <Text style={styles.summaryValue}>{totalUsers}</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>🔍</Text>
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Total Searches</Text>
              <Text style={styles.summaryValue}>{totalSearches}</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>📱</Text>
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Total WhatsApp Shares</Text>
              <Text style={styles.summaryValue}>{totalWhatsApp}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.tableTitle}>Detailed Statistics</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: 120 }]}>Name</Text>
              <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Searches</Text>
              <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Hours</Text>
              <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Logins</Text>
              <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Syncs</Text>
              <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>WhatsApp</Text>
              <Text style={[styles.tableHeaderText, { width: 150 }]}>Last Search</Text>
            </View>
            {stats.map((user, index) => (
              <View key={user.userId || index} style={[styles.tableRow, index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                <Text style={[styles.tableCell, styles.tableCellName, { width: 120 }]}>{user.name}</Text>
                <Text style={[styles.tableCell, { width: 80, textAlign: 'right' }]}>{user.vehiclesSearched || 0}</Text>
                <Text style={[styles.tableCell, { width: 80, textAlign: 'right' }]}>{user.totalHours || 0}</Text>
                <Text style={[styles.tableCell, { width: 80, textAlign: 'right' }]}>{user.loginCount || 0}</Text>
                <Text style={[styles.tableCell, { width: 80, textAlign: 'right' }]}>{user.dataSyncs || 0}</Text>
                <Text style={[styles.tableCell, { width: 80, textAlign: 'right' }]}>{user.whatsappCount || 0}</Text>
                <Text style={[styles.tableCell, { width: 150 }]}>{formatDate(user.lastSearchedAt)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchUserStats()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {stats.length === 0 && !error && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyMessage}>No statistics available</Text>
            <Text style={styles.emptySubtitle}>User activity will appear here</Text>
          </View>
        )}
      </ScrollView>
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
  refreshIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  banner: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: '#000',
  },
  bannerClose: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginTop: 16,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleSelected: {
    backgroundColor: '#4F46E5',
  },
  toggleUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextSelected: {
    color: '#FFFFFF',
  },
  toggleTextUnselected: {
    color: '#4F46E5',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  summaryIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginHorizontal: 16,
    marginTop: 16,
  },
  table: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableRowEven: {
    backgroundColor: '#FFFFFF',
  },
  tableRowOdd: {
    backgroundColor: '#F9FAFB',
  },
  tableCell: {
    fontSize: 14,
    color: '#666',
  },
  tableCellName: {
    fontWeight: 'bold',
    color: '#000',
  },
  errorContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FEE',
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
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
});