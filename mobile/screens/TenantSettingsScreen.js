import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, showErrorAlert, getErrorMessage } from '../utils/errorHandler';
import { Picker } from '@react-native-picker/picker';

const TenantSettingsScreen = ({ navigation }) => {
  const [dataMultiplier, setDataMultiplier] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showMultiplierInfo, setShowMultiplierInfo] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await SecureStore.getItemAsync('token');
      if (!token) throw new Error('No authentication token found');

      const response = await axios.get(`${getBaseURL()}/api/tenants/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data?.success) {
        const settings = response.data.data || {};
        setDataMultiplier(settings.dataMultiplier || 1);
      } else {
        throw new Error(response.data?.message || 'Failed to load settings');
      }
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      setError(errorMsg);
      logError(e, 'loadSettings');
      showErrorAlert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Validate dataMultiplier
      if (dataMultiplier < 1 || dataMultiplier > 6) {
        Alert.alert('Invalid Multiplier', 'Please select a valid multiplier (1-6)');
        return;
      }

      // Confirmation alert
      Alert.alert(
        'Save Settings',
        `Update data multiplier to ${dataMultiplier}x?\n\nThis will affect how record counts are displayed in mobile apps.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: async () => {
              try {
                const token = await SecureStore.getItemAsync('token');
                if (!token) throw new Error('No authentication token found');

                const response = await axios.put(`${getBaseURL()}/api/tenants/settings`, {
                  dataMultiplier
                }, {
                  headers: { Authorization: `Bearer ${token}` }
                });

                if (response.data?.success) {
                  setSuccess('Settings saved successfully');
                  Alert.alert('Success', 'Settings saved successfully');
                  // Reload settings to confirm
                  await loadSettings();
                } else {
                  throw new Error(response.data?.message || 'Failed to save settings');
                }
              } catch (e) {
                const errorMsg = getErrorMessage(e);
                setError(errorMsg);
                logError(e, 'saveSettings');
                showErrorAlert('Error', errorMsg);
              }
            }
          }
        ]
      );
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      setError(errorMsg);
      logError(e, 'saveSettings');
      showErrorAlert('Error', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const toggleMultiplierInfo = () => {
    setShowMultiplierInfo(!showMultiplierInfo);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tenant Settings</Text>
        <TouchableOpacity
          onPress={saveSettings}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Data Multiplier Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Multiplier Label</Text>
          <Text style={styles.sectionDescription}>
            Configure how record counts are displayed in mobile apps
          </Text>

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={dataMultiplier}
              onValueChange={(itemValue) => setDataMultiplier(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="1x (Show actual count)" value={1} />
              <Picker.Item label="2x (Show double count)" value={2} />
              <Picker.Item label="3x (Show triple count)" value={3} />
              <Picker.Item label="4x (Show quadruple count)" value={4} />
              <Picker.Item label="5x (Show 5 times count)" value={5} />
              <Picker.Item label="6x (Show 6 times count)" value={6} />
            </Picker>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>
              Current Setting: {dataMultiplier}x multiplier
            </Text>
            <Text style={styles.infoCardText}>
              Mobile apps will show {dataMultiplier === 1 ? 'actual' : `${dataMultiplier} times the actual`} record count
            </Text>
          </View>

          <TouchableOpacity onPress={toggleMultiplierInfo} style={styles.infoToggle}>
            <Text style={styles.infoToggleText}>Why use multiplier?</Text>
          </TouchableOpacity>
        </View>

        {/* Multiplier Info Section */}
        {showMultiplierInfo && (
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>About Data Multiplier</Text>
            <Text style={styles.infoSectionText}>
              The data multiplier affects how record counts are displayed to mobile users.
            </Text>
            <Text style={styles.infoSectionText}>
              Example: If you have 1000 records and set multiplier to 3x, mobile users will see 3000 records.
            </Text>
            <Text style={styles.infoSectionText}>
              This setting does not affect actual data, only the display count.
            </Text>
            <Text style={styles.infoSectionSubtitle}>Use cases:</Text>
            <Text style={styles.infoSectionText}>• 1x: Show actual count (recommended for most cases)</Text>
            <Text style={styles.infoSectionText}>• 2x-6x: Show inflated count for business purposes</Text>
          </View>
        )}

        {/* Coming Soon Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Settings</Text>
          <View style={styles.comingSoonCard}>
            <Text style={styles.comingSoonIcon}>🚧</Text>
            <Text style={styles.comingSoonText}>
              More configuration options will be available in future updates
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

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
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
  backButtonText: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  saveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  pickerContainer: {
    backgroundColor: '#EEEEEE',
    borderColor: '#BDBDBD',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
  },
  picker: {
    height: 50,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  infoCardText: {
    fontSize: 14,
    color: '#1976D2',
  },
  infoToggle: {
    alignSelf: 'flex-start',
  },
  infoToggleText: {
    fontSize: 14,
    color: '#4F46E5',
    textDecorationLine: 'underline',
  },
  infoSection: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  infoSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  infoSectionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoSectionSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 8,
    marginBottom: 4,
  },
  comingSoonCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  comingSoonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default TenantSettingsScreen;