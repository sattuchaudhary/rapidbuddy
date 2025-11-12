import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StatusBar, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, showErrorAlert, getErrorMessage } from '../utils/errorHandler';
import * as ImagePicker from 'expo-image-picker';

export default function PaymentSettingsScreen({ navigation }) {
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [planPrices, setPlanPrices] = useState({ weekly: '', monthly: '', quarterly: '', yearly: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [qrPreviewVisible, setQrPreviewVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        showErrorAlert('Authentication Error', 'Please login again');
        return;
      }
      const response = await axios.get(`${getBaseURL()}/api/tenants/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const paymentConfig = response.data?.data?.paymentConfig || {};
      setUpiId(paymentConfig.upiId || '');
      setPayeeName(paymentConfig.payeeName || '');
      setQrCodeImageUrl(paymentConfig.qrCodeImageUrl || '');
      setInstructions(paymentConfig.instructions || '');
      setPlanPrices({
        weekly: paymentConfig.planPrices?.weekly?.toString() || '',
        monthly: paymentConfig.planPrices?.monthly?.toString() || '',
        quarterly: paymentConfig.planPrices?.quarterly?.toString() || '',
        yearly: paymentConfig.planPrices?.yearly?.toString() || ''
      });
    } catch (err) {
      logError(err, 'loadSettings');
      const message = getErrorMessage(err, 'Failed to load settings');
      setError(message);
      showErrorAlert('Load Error', message);
    } finally {
      setLoading(false);
    }
  };

  const validateFields = () => {
    const errors = {};
    if (upiId && !/^[a-zA-Z0-9]+@[a-zA-Z0-9]+$/.test(upiId)) {
      errors.upiId = 'UPI ID must be in format: user@bank';
    }
    if (payeeName && payeeName.length > 100) {
      errors.payeeName = 'Payee name must be less than 100 characters';
    }
    if (instructions && instructions.length > 500) {
      errors.instructions = 'Instructions must be less than 500 characters';
    }
    ['weekly', 'monthly', 'quarterly', 'yearly'].forEach(key => {
      const value = planPrices[key];
      if (value && (isNaN(Number(value)) || Number(value) < 0)) {
        errors[key] = 'Price must be a number >= 0';
      }
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveSettings = async () => {
    if (!validateFields()) {
      showErrorAlert('Validation Error', 'Please fix the errors below');
      return;
    }
    Alert.alert(
      'Save Settings',
      'Save payment settings?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            try {
              setSaving(true);
              setError('');
              setSuccess('');
              const token = await SecureStore.getItemAsync('token');
              if (!token) {
                showErrorAlert('Authentication Error', 'Please login again');
                return;
              }
              const payload = {
                paymentConfig: {
                  upiId,
                  payeeName,
                  qrCodeImageUrl,
                  instructions,
                  planPrices: {
                    weekly: Number(planPrices.weekly) || 0,
                    monthly: Number(planPrices.monthly) || 0,
                    quarterly: Number(planPrices.quarterly) || 0,
                    yearly: Number(planPrices.yearly) || 0
                  }
                }
              };
              await axios.put(`${getBaseURL()}/api/tenants/settings`, payload, {
                headers: { Authorization: `Bearer ${token}` }
              });
              setSuccess('Payment settings saved successfully');
              Alert.alert('Success', 'Payment settings saved successfully');
            } catch (err) {
              logError(err, 'saveSettings');
              const message = getErrorMessage(err, 'Failed to save settings');
              setError(message);
              showErrorAlert('Save Error', message);
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const uploadQRCode = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showErrorAlert('Permission Denied', 'Media library access is required to upload QR code');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      });
      if (!result.canceled) {
        setUploading(true);
        const token = await SecureStore.getItemAsync('token');
        if (!token) {
          showErrorAlert('Authentication Error', 'Please login again');
          return;
        }
        const formData = new FormData();
        const uri = result.assets[0].uri;
        const name = uri.split('/').pop();
        formData.append('file', {
          uri,
          name,
          type: 'image/jpeg'
        });
        const response = await axios.post(`${getBaseURL()}/api/uploads/tenant-qr`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        setQrCodeImageUrl(response.data?.url || '');
        setSuccess('QR code uploaded successfully');
        Alert.alert('Success', 'QR code uploaded successfully');
      }
    } catch (err) {
      logError(err, 'uploadQRCode');
      const message = getErrorMessage(err, 'Failed to upload QR code');
      showErrorAlert('Upload Error', message);
    } finally {
      setUploading(false);
    }
  };

  const removeQRCode = () => {
    Alert.alert(
      'Remove QR Code',
      'Are you sure you want to remove the QR code?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setQrCodeImageUrl('')
        }
      ]
    );
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Payment Settings</Text>
        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.7 }]}
          onPress={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>QR Code</Text>
          {qrCodeImageUrl ? (
            <TouchableOpacity onPress={() => setQrPreviewVisible(true)} style={styles.qrPreview}>
              <Image source={{ uri: qrCodeImageUrl }} style={styles.qrImage} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.outlinedButton} onPress={uploadQRCode}>
              <Text style={styles.outlinedButtonText}>Upload QR Code</Text>
            </TouchableOpacity>
            {qrCodeImageUrl ? (
              <TouchableOpacity style={[styles.outlinedButton, styles.redButton]} onPress={removeQRCode}>
                <Text style={[styles.outlinedButtonText, styles.redText]}>Remove QR Code</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.helperText}>Tap image to preview, or upload new QR code</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>UPI Details</Text>
          <TextInput
            style={styles.input}
            placeholder="Payee Name (e.g., ABC Finance Ltd.)"
            value={payeeName}
            onChangeText={setPayeeName}
          />
          {fieldErrors.payeeName && <Text style={styles.errorText}>{fieldErrors.payeeName}</Text>}
          <TextInput
            style={styles.input}
            placeholder="UPI ID (e.g., merchant@upi)"
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
          />
          {fieldErrors.upiId && <Text style={styles.errorText}>{fieldErrors.upiId}</Text>}
          <Text style={styles.helperText}>Users will see this UPI ID for payments</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Enter payment instructions for users..."
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={4}
          />
          {fieldErrors.instructions && <Text style={styles.errorText}>{fieldErrors.instructions}</Text>}
          <Text style={styles.helperText}>These instructions will be shown to users during payment</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Plan Prices</Text>
          <TextInput
            style={styles.input}
            placeholder="Weekly Price"
            value={planPrices.weekly}
            onChangeText={(value) => setPlanPrices({ ...planPrices, weekly: value })}
            keyboardType="numeric"
          />
          {fieldErrors.weekly && <Text style={styles.errorText}>{fieldErrors.weekly}</Text>}
          <TextInput
            style={styles.input}
            placeholder="Monthly Price"
            value={planPrices.monthly}
            onChangeText={(value) => setPlanPrices({ ...planPrices, monthly: value })}
            keyboardType="numeric"
          />
          {fieldErrors.monthly && <Text style={styles.errorText}>{fieldErrors.monthly}</Text>}
          <TextInput
            style={styles.input}
            placeholder="Quarterly Price"
            value={planPrices.quarterly}
            onChangeText={(value) => setPlanPrices({ ...planPrices, quarterly: value })}
            keyboardType="numeric"
          />
          {fieldErrors.quarterly && <Text style={styles.errorText}>{fieldErrors.quarterly}</Text>}
          <TextInput
            style={styles.input}
            placeholder="Yearly Price"
            value={planPrices.yearly}
            onChangeText={(value) => setPlanPrices({ ...planPrices, yearly: value })}
            keyboardType="numeric"
          />
          {fieldErrors.yearly && <Text style={styles.errorText}>{fieldErrors.yearly}</Text>}
          <Text style={styles.helperText}>Set to 0 to disable a plan</Text>
        </View>
      </ScrollView>

      <Modal visible={qrPreviewVisible} transparent animationType="fade" onRequestClose={() => setQrPreviewVisible(false)}>
        <View style={styles.modalBackdrop} onTouchEnd={() => setQrPreviewVisible(false)}>
          <View style={styles.modalContent}>
            {qrCodeImageUrl ? (
              <Image source={{ uri: qrCodeImageUrl }} style={styles.modalImage} />
            ) : null}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setQrPreviewVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
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
  backIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
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
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  uploadingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  card: {
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  qrPreview: {
    alignItems: 'center',
    marginBottom: 12,
  },
  qrImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  outlinedButton: {
    flex: 1,
    borderColor: '#4F46E5',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  outlinedButtonText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '600',
  },
  redButton: {
    borderColor: '#F44336',
  },
  redText: {
    color: '#F44336',
  },
  helperText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#EEEEEE',
    borderColor: '#BDBDBD',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginBottom: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    alignItems: 'center',
  },
  modalImage: {
    width: 280,
    height: 280,
    borderRadius: 16,
  },
  modalCloseButton: {
    marginTop: 20,
    borderColor: '#fff',
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});