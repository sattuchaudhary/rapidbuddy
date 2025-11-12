import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { getBaseURL } from '../utils/config';
import { logError, getErrorMessage } from '../utils/errorHandler';

export default function TenantFormScreen({ navigation, route }) {
  const { tenantId, mode } = route.params || {};
  const isEdit = mode === 'edit';

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('agency');
  const [subscriptionPlan, setSubscriptionPlan] = useState('basic');
  const [maxUsers, setMaxUsers] = useState('10');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validation errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [maxUsersError, setMaxUsersError] = useState('');

  // UI state
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [planPickerVisible, setPlanPickerVisible] = useState(false);

  // Track initial state for dirty check
  const [initialState, setInitialState] = useState({});

  // Load tenant data for edit mode
  useEffect(() => {
    if (isEdit && tenantId) {
      loadTenantData();
    } else {
      // Set initial state for create mode
      const initState = {
        name: '',
        type: 'agency',
        subscriptionPlan: 'basic',
        maxUsers: '10',
        adminFirstName: '',
        adminLastName: '',
        adminEmail: '',
        adminPassword: ''
      };
      setInitialState(initState);
    }
  }, [isEdit, tenantId]);

  const loadTenantData = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) throw new Error('No token found');

      const response = await axios.get(`${getBaseURL()}/api/tenants/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const tenant = response.data.data.tenant;
      setName(tenant.name || '');
      setType(tenant.type || 'agency');
      setSubscriptionPlan(tenant.subscription?.plan || 'basic');
      setMaxUsers(String(tenant.subscription?.maxUsers || 10));

      // Set initial state for dirty check
      setInitialState({
        name: tenant.name || '',
        type: tenant.type || 'agency',
        subscriptionPlan: tenant.subscription?.plan || 'basic',
        maxUsers: String(tenant.subscription?.maxUsers || 10),
        adminFirstName: '',
        adminLastName: '',
        adminEmail: '',
        adminPassword: ''
      });
    } catch (error) {
      logError(error, 'loadTenantData');
      Alert.alert('Error', 'Failed to load tenant data');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Validation functions
  const validateName = (value) => {
    if (!value.trim()) return 'Tenant name is required';
    if (value.length < 2 || value.length > 100) return 'Name must be between 2 and 100 characters';
    return '';
  };

  const validateEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) return 'Email is required';
    if (!emailRegex.test(value)) return 'Please enter a valid email address';
    return '';
  };

  const validatePassword = (value) => {
    if (!value) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  const validateMaxUsers = (value) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 1 || num > 1000) return 'Max users must be between 1 and 1000';
    return '';
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate all fields
    const nameErr = validateName(name);
    const emailErr = !isEdit ? validateEmail(adminEmail) : '';
    const passwordErr = !isEdit ? validatePassword(adminPassword) : '';
    const maxUsersErr = validateMaxUsers(maxUsers);

    setNameError(nameErr);
    setEmailError(emailErr);
    setPasswordError(passwordErr);
    setMaxUsersError(maxUsersErr);

    if (nameErr || emailErr || passwordErr || maxUsersErr) return;

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) throw new Error('No token found');

      const data = {
        name: name.trim(),
        type,
        subscriptionPlan,
        maxUsers: parseInt(maxUsers)
      };

      if (!isEdit) {
        // Add admin data for create
        data.adminFirstName = adminFirstName.trim();
        data.adminLastName = adminLastName.trim();
        data.adminEmail = adminEmail.trim();
        data.adminPassword = adminPassword;
      }

      const url = isEdit ? `${getBaseURL()}/api/tenants/${tenantId}` : `${getBaseURL()}/api/tenants`;
      const method = isEdit ? 'put' : 'post';

      await axios[method](url, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `Tenant ${isEdit ? 'updated' : 'created'} successfully`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      logError(error, 'handleSubmit');
      const message = getErrorMessage(error, `Failed to ${isEdit ? 'update' : 'create'} tenant`);
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  // Check if form is dirty
  const isDirty = () => {
    return (
      name !== initialState.name ||
      type !== initialState.type ||
      subscriptionPlan !== initialState.subscriptionPlan ||
      maxUsers !== initialState.maxUsers ||
      adminFirstName !== initialState.adminFirstName ||
      adminLastName !== initialState.adminLastName ||
      adminEmail !== initialState.adminEmail ||
      adminPassword !== initialState.adminPassword
    );
  };

  // Handle back press
  const handleBack = () => {
    if (isDirty()) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // Picker options
  const typeOptions = [
    { label: 'Agency', value: 'agency' },
    { label: 'NBFC', value: 'nbfc' },
    { label: 'Bank', value: 'bank' }
  ];

  const planOptions = [
    { label: 'Basic', value: 'basic' },
    { label: 'Premium', value: 'premium' },
    { label: 'Enterprise', value: 'enterprise' }
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
      
      {/* Header */}
      <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Tenant' : 'Create Tenant'}</Text>
        <TouchableOpacity 
          onPress={handleSubmit} 
          disabled={submitting || !!nameError || !!emailError || !!passwordError || !!maxUsersError}
          style={[styles.saveButton, (submitting || !!nameError || !!emailError || !!passwordError || !!maxUsersError) && styles.saveButtonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Tenant Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tenant Details</Text>
            
            <Text style={styles.label}>Tenant Name *</Text>
            <TextInput
              style={[styles.input, nameError && styles.inputError]}
              value={name}
              onChangeText={setName}
              onBlur={() => setNameError(validateName(name))}
              placeholder="e.g., ABC Finance Ltd."
              autoCapitalize="words"
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

            <Text style={styles.label}>Tenant Type *</Text>
            <TouchableOpacity 
              style={styles.pickerButton} 
              onPress={() => setTypePickerVisible(true)}
            >
              <Text style={styles.pickerText}>
                {typeOptions.find(opt => opt.value === type)?.label || 'Select Type'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Subscription Plan *</Text>
            <TouchableOpacity 
              style={styles.pickerButton} 
              onPress={() => setPlanPickerVisible(true)}
            >
              <Text style={styles.pickerText}>
                {planOptions.find(opt => opt.value === subscriptionPlan)?.label || 'Select Plan'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Max Users *</Text>
            <TextInput
              style={[styles.input, maxUsersError && styles.inputError]}
              value={maxUsers}
              onChangeText={setMaxUsers}
              onBlur={() => setMaxUsersError(validateMaxUsers(maxUsers))}
              placeholder="10"
              keyboardType="numeric"
            />
            {maxUsersError ? <Text style={styles.errorText}>{maxUsersError}</Text> : null}
          </View>

          {/* Admin Account Section (Create only) */}
          {!isEdit && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tenant Admin Account</Text>
              <Text style={styles.subtitle}>This account will be created as the admin for this tenant</Text>
              
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={adminFirstName}
                onChangeText={setAdminFirstName}
                placeholder="Enter first name"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                value={adminLastName}
                onChangeText={setAdminLastName}
                placeholder="Enter last name"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={[styles.input, emailError && styles.inputError]}
                value={adminEmail}
                onChangeText={setAdminEmail}
                onBlur={() => setEmailError(validateEmail(adminEmail))}
                placeholder="admin@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, passwordError && styles.inputError]}
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  onBlur={() => setPasswordError(validatePassword(adminPassword))}
                  placeholder="Enter password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity 
                  style={styles.showPasswordButton} 
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !!nameError || !!emailError || !!passwordError || !!maxUsersError}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{isEdit ? 'Update Tenant' : 'Create Tenant'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Type Picker Modal */}
      <Modal visible={typePickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Tenant Type</Text>
            {typeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  setType(option.value);
                  setTypePickerVisible(false);
                }}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              style={styles.modalCancel} 
              onPress={() => setTypePickerVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Plan Picker Modal */}
      <Modal visible={planPickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Subscription Plan</Text>
            {planOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  setSubscriptionPlan(option.value);
                  setPlanPickerVisible(false);
                }}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              style={styles.modalCancel} 
              onPress={() => setPlanPickerVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#4F46E5', fontSize: 16 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 0 : 12
  },
  backButton: { padding: 8 },
  backText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  saveButton: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  saveButtonDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#4F46E5', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  label: { fontSize: 14, color: '#333', marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  inputError: { borderColor: '#D32F2F' },
  errorText: { color: '#D32F2F', fontSize: 12, marginTop: 4 },
  pickerButton: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontSize: 16, color: '#333' },
  dropdownArrow: { fontSize: 12, color: '#666' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, marginRight: 8 },
  showPasswordButton: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#E0E0E0', borderRadius: 8 },
  showPasswordText: { fontSize: 14, color: '#333' },
  submitButton: { backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%', maxWidth: 300 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  modalOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalOptionText: { fontSize: 16, textAlign: 'center' },
  modalCancel: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { color: '#4F46E5', fontSize: 16, fontWeight: 'bold' }
});