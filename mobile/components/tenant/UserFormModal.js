import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const UserFormModal = ({
  visible,
  onClose,
  onSubmit,
  initialData,
  userType,
  loading,
}) => {
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const nameInputRef = useRef(null);

  // Field configurations
  const fieldConfigs = useMemo(() => {
    const commonFields = [
      {
        fieldName: 'name',
        label: 'Name',
        placeholder: 'Enter full name',
        required: true,
        type: 'text',
        keyboardType: 'default',
      },
      {
        fieldName: 'email',
        label: 'Email',
        placeholder: 'Enter email address',
        required: true,
        type: 'email',
        keyboardType: 'email-address',
      },
      {
        fieldName: 'phoneNumber',
        label: 'Phone Number',
        placeholder: 'Enter 10-digit phone number',
        required: true,
        type: 'phone',
        keyboardType: 'phone-pad',
      },
      {
        fieldName: 'address',
        label: 'Address',
        placeholder: 'Enter address',
        required: true,
        type: 'multiline',
        keyboardType: 'default',
      },
      {
        fieldName: 'city',
        label: 'City',
        placeholder: 'Enter city',
        required: true,
        type: 'text',
        keyboardType: 'default',
      },
      {
        fieldName: 'state',
        label: 'State',
        placeholder: 'Enter state',
        required: true,
        type: 'text',
        keyboardType: 'default',
      },
      {
        fieldName: 'zipCode',
        label: 'Zip Code',
        placeholder: 'Enter zip code',
        required: true,
        type: 'text',
        keyboardType: 'numeric',
      },
    ];

    const staffSpecific = [
      {
        fieldName: 'role',
        label: 'Role',
        placeholder: 'Select role',
        required: true,
        type: 'picker',
        keyboardType: 'default',
      },
    ];

    const agentSpecific = [
      {
        fieldName: 'bankName',
        label: 'Bank Name',
        placeholder: 'Enter bank name',
        required: false,
        type: 'text',
        keyboardType: 'default',
      },
      {
        fieldName: 'vehicleNumber',
        label: 'Vehicle Number',
        placeholder: 'Enter vehicle number',
        required: false,
        type: 'text',
        keyboardType: 'default',
      },
    ];

    const passwordFields = [
      {
        fieldName: 'password',
        label: 'Password',
        placeholder: 'Enter password',
        required: true,
        type: 'password',
        keyboardType: 'default',
      },
      {
        fieldName: 'confirmPassword',
        label: 'Confirm Password',
        placeholder: 'Confirm password',
        required: true,
        type: 'password',
        keyboardType: 'default',
      },
    ];

    const optionalFields = [
      {
        fieldName: 'panCardNo',
        label: 'PAN Card No',
        placeholder: 'ABCDE1234F',
        required: false,
        type: 'text',
        keyboardType: 'default',
      },
      {
        fieldName: 'aadhaarNumber',
        label: 'Aadhaar Number',
        placeholder: '12-digit Aadhaar number',
        required: false,
        type: 'text',
        keyboardType: 'numeric',
      },
    ];

    let fields = [...commonFields];
    if (userType === 'staff') {
      fields = [...fields, ...staffSpecific];
    } else if (userType === 'agent') {
      fields = [...fields, ...agentSpecific];
    }
    if (!initialData) {
      fields = [...fields, ...passwordFields];
    }
    fields = [...fields, ...optionalFields];

    return fields;
  }, [userType, initialData]);

  // Validation functions
  const validateEmail = (email) => {
    const regex = /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/;
    return regex.test(email);
  };

  const validatePhone = (phone) => {
    const regex = /^[0-9]{10}$/;
    return regex.test(phone);
  };

  const validatePAN = (pan) => {
    const regex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return regex.test(pan.toUpperCase());
  };

  const validateAadhaar = (aadhaar) => {
    const regex = /^[0-9]{12}$/;
    return regex.test(aadhaar);
  };

  const validatePassword = (password) => {
    return password.length >= 6;
  };

  const validateForm = () => {
    const errors = {};
    fieldConfigs.forEach((field) => {
      const value = formData[field.fieldName] || '';
      if (field.required && !value.trim()) {
        errors[field.fieldName] = `${field.label} is required`;
      } else if (value.trim()) {
        switch (field.type) {
          case 'email':
            if (!validateEmail(value)) {
              errors[field.fieldName] = 'Invalid email format';
            }
            break;
          case 'phone':
            if (!validatePhone(value)) {
              errors[field.fieldName] = 'Phone number must be 10 digits';
            }
            break;
          case 'password':
            if (!validatePassword(value)) {
              errors[field.fieldName] = 'Password must be at least 6 characters';
            }
            break;
        }
        if (field.fieldName === 'panCardNo' && !validatePAN(value)) {
          errors[field.fieldName] = 'PAN format: ABCDE1234F';
        }
        if (field.fieldName === 'aadhaarNumber' && !validateAadhaar(value)) {
          errors[field.fieldName] = 'Aadhaar must be 12 digits';
        }
        if (field.fieldName === 'confirmPassword' && value !== formData.password) {
          errors[field.fieldName] = 'Passwords do not match';
        }
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Initialize form data
  useEffect(() => {
    if (visible) {
      const initialFormData = {};
      fieldConfigs.forEach((field) => {
        initialFormData[field.fieldName] = initialData ? initialData[field.fieldName] || '' : '';
      });
      setFormData(initialFormData);
      setFormErrors({});
      setShowPasswordFields(!initialData);
      // Auto-focus first field
      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      }, 100);
    }
  }, [visible, initialData, fieldConfigs]);

  const handleInputChange = (fieldName, value) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    if (formErrors[fieldName]) {
      setFormErrors((prev) => ({ ...prev, [fieldName]: '' }));
    }
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const renderFormField = (field) => {
    const value = formData[field.fieldName] || '';
    const error = formErrors[field.fieldName];
    const isPassword = field.type === 'password';

    return (
      <View key={field.fieldName} style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>
          {field.label} {field.required && <Text style={styles.required}>*</Text>}
        </Text>
        {field.type === 'picker' ? (
          <TouchableOpacity
            style={[styles.input, error && styles.inputError]}
            onPress={() => setShowRolePicker(true)}
          >
            <Text style={value ? styles.inputText : styles.placeholderText}>
              {value || field.placeholder}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              ref={field.fieldName === 'name' ? nameInputRef : null}
              style={[styles.input, error && styles.inputError]}
              placeholder={field.placeholder}
              value={value}
              onChangeText={(text) => handleInputChange(field.fieldName, text)}
              keyboardType={field.keyboardType}
              secureTextEntry={isPassword && !passwordVisible && field.fieldName === 'password'}
              secureTextEntry={isPassword && !confirmPasswordVisible && field.fieldName === 'confirmPassword'}
              multiline={field.type === 'multiline'}
              numberOfLines={field.type === 'multiline' ? 3 : 1}
              accessibilityLabel={field.label}
              accessibilityHint={`Enter ${field.label.toLowerCase()}`}
            />
            {isPassword && (
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => {
                  if (field.fieldName === 'password') {
                    setPasswordVisible(!passwordVisible);
                  } else {
                    setConfirmPasswordVisible(!confirmPasswordVisible);
                  }
                }}
              >
                <Ionicons
                  name={
                    (field.fieldName === 'password' ? passwordVisible : confirmPasswordVisible)
                      ? 'eye-off'
                      : 'eye'
                  }
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
          </View>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  };

  const roles = ['Sub Admin', 'Vehicle Confirmer', 'Manager', 'Supervisor', 'Staff'];

  const title = initialData ? `Edit ${userType === 'staff' ? 'Office Staff' : 'Repo Agent'}` : `Add ${userType === 'staff' ? 'Office Staff' : 'Repo Agent'}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#4F46E5" />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.formContainer}>
              {/* Basic Information */}
              <Text style={styles.sectionTitle}>Basic Information</Text>
              {fieldConfigs.slice(0, 3).map(renderFormField)}

              {/* Address Details */}
              <Text style={styles.sectionTitle}>Address Details</Text>
              {fieldConfigs.slice(3, 7).map(renderFormField)}

              {/* Role/Type */}
              <Text style={styles.sectionTitle}>
                {userType === 'staff' ? 'Role' : 'Additional Information'}
              </Text>
              {userType === 'staff' ? renderFormField(fieldConfigs[7]) : fieldConfigs.slice(7, 9).map(renderFormField)}

              {/* Security */}
              {!initialData && (
                <>
                  <Text style={styles.sectionTitle}>Security</Text>
                  {fieldConfigs.slice(userType === 'staff' ? 8 : 9, userType === 'staff' ? 10 : 11).map(renderFormField)}
                </>
              )}

              {/* Optional Information */}
              <Text style={styles.sectionTitle}>Optional Information</Text>
              {fieldConfigs.slice(userType === 'staff' ? (initialData ? 8 : 10) : (initialData ? 9 : 11)).map(renderFormField)}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>{initialData ? 'Save' : 'Create'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Role Picker Modal */}
        {showRolePicker && (
          <Modal visible={showRolePicker} transparent animationType="fade">
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerTitle}>Select Role</Text>
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.pickerOption,
                      formData.role === role && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      handleInputChange('role', role);
                      setShowRolePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        formData.role === role && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.pickerCloseButton}
                  onPress={() => setShowRolePicker(false)}
                >
                  <Text style={styles.pickerCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  closeButton: {
    padding: 8,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  formContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginTop: 20,
    marginBottom: 12,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: 4,
  },
  required: {
    color: '#EF4444',
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputText: {
    color: '#000000',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#6B7280',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  submitButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  pickerOptionSelected: {
    backgroundColor: '#4F46E5',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  pickerOptionTextSelected: {
    color: '#FFFFFF',
  },
  pickerCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerCloseText: {
    fontSize: 16,
    color: '#6B7280',
  },
});

export default UserFormModal;