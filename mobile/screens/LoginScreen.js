import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Dimensions,
  Animated,
  Alert,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { useColorScheme, StatusBar } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError } from '../utils/errorHandler';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = {
    bg: isDark ? '#0a0a0a' : '#f0f2f5', // Darker background for dark mode, light grey for light mode
    cardBg: isDark ? '#1c1c1c' : '#ffffff', // Slightly lighter card for dark mode
    textPrimary: isDark ? '#e0e0e0' : '#1a1a1a', // Lighter text for dark mode
    textSecondary: isDark ? '#a0a0a0' : '#555555', // Adjusted secondary text
    inputBg: isDark ? '#2a2a2a' : '#f9f9f9', // Input background
    inputBorder: isDark ? '#3a3a3a' : '#e0e0e0', // Input border
    accent: '#4a90e2', // A more vibrant blue
    muted: isDark ? '#707070' : '#888888', // Muted text
    surfaceBorder: isDark ? '#333333' : '#e5e7eb', // Card border
    danger: '#e74c3c' // Red for errors
  };
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const errorAnim = useState(new Animated.Value(0))[0]; // For error message animation

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const passwordInputRef = useRef(null);
  const identifierInputRef = useRef(null);

  const showError = (message) => {
    setError(message);
    // Trigger error animation
    errorAnim.setValue(0);
    Animated.sequence([
      Animated.timing(errorAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(100),
      Animated.timing(errorAnim, { toValue: 0.8, duration: 200, useNativeDriver: true })
    ]).start();
  };

  const onLogin = async () => {
    if (!identifier || !password) { 
      showError('Email/phone aur password zaroori hai'); 
      return; 
    }
    setLoading(true); 
    setError('');
    try {
      const body = { identifier: identifier.trim(), password };
      const res = await axios.post(`${getBaseURL()}/api/unified-auth/login`, body);
      const payload = res?.data;
      if (!payload.success) {
        const errorMsg = payload?.message || 'Login failed';
        // Convert English error messages to user-friendly Hindi/English mix
        let userFriendlyMsg = errorMsg;
        if (errorMsg.includes('Invalid credentials') || errorMsg.includes('Invalid email or password')) {
          userFriendlyMsg = 'Galat email/phone ya password. Kripya dobara try karein.';
        } else if (errorMsg.includes('inactive')) {
          userFriendlyMsg = 'Aapka account inactive hai. Kripya apne administrator se contact karein.';
        } else if (errorMsg.includes('not verified')) {
          userFriendlyMsg = 'Aapka email verify nahi hua hai. Kripya apne email check karein.';
        } else if (errorMsg.includes('required')) {
          userFriendlyMsg = 'Email/phone aur password dono zaroori hain.';
        }
        throw new Error(userFriendlyMsg);
      }
      const { user, token, redirectTo } = payload.data;
      if (!token || !user) {
        throw new Error('Invalid response data');
      }
      // Store token
      await SecureStore.setItemAsync('token', token);
      // Store complete user data
      await SecureStore.setItemAsync('userData', JSON.stringify(user));
      // Backward compatibility: store in 'agent' key
      const agentData = {
        id: user.id,
        name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        userType: user.userType,
        tenantId: user.tenantId,
        tenantName: user.tenantName,
        status: 'active' // Assuming active
      };
      await SecureStore.setItemAsync('agent', JSON.stringify(agentData));
      // Role-based navigation
      if (user.userType === 'main_user' && user.role === 'super_admin') {
        navigation.replace('SuperAdminDashboard');
      } else if (user.userType === 'main_user' && user.role === 'admin') {
        navigation.replace('TenantAdminDashboard');
      } else if (user.userType === 'office_staff') {
        navigation.replace('OfficeStaffDashboard');
      } else if (user.userType === 'repo_agent') {
        navigation.replace('Dashboard');
      } else {
        navigation.replace('Dashboard'); // Fallback
      }
    } catch (e) {
      let errorMessage = 'Login fail ho gaya. Kripya dobara try karein.';
      
      if (e.response) {
        // Server responded with error
        const serverMessage = e.response?.data?.message || e.message;
        if (serverMessage) {
          // Convert English error messages to user-friendly Hindi/English mix
          if (serverMessage.includes('Invalid credentials') || serverMessage.includes('Invalid email or password')) {
            errorMessage = 'Galat email/phone ya password. Kripya dobara try karein.';
          } else if (serverMessage.includes('inactive')) {
            errorMessage = 'Aapka account inactive hai. Kripya apne administrator se contact karein.';
          } else if (serverMessage.includes('not verified') || serverMessage.includes('Email is not verified')) {
            errorMessage = 'Aapka email verify nahi hua hai. Kripya apne email check karein.';
            Alert.alert(
              'Email Verification Required',
              'Aapka email address verify nahi hua hai. Kripya apne email check karein aur account verify karein.',
              [{ text: 'OK' }]
            );
          } else if (serverMessage.includes('required')) {
            errorMessage = 'Email/phone aur password dono zaroori hain.';
          } else {
            errorMessage = serverMessage;
          }
        } else if (e.response.status === 401) {
          errorMessage = 'Galat email/phone ya password. Kripya dobara try karein.';
        } else if (e.response.status === 400) {
          errorMessage = 'Invalid request. Kripya sahi details enter karein.';
        } else if (e.response.status >= 500) {
          errorMessage = 'Server error. Kripya thodi der baad try karein.';
        }
      } else if (e.message && e.message !== 'Login failed') {
        errorMessage = e.message;
      } else if (e.code === 'NETWORK_ERROR' || e.message?.includes('Network')) {
        errorMessage = 'Network error. Kripya internet connection check karein.';
      }
      
      showError(errorMessage);
      logError('Login error', e);
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <SafeAreaProvider>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              <Animated.View style={[styles.card, { backgroundColor: theme.cardBg, opacity: fadeAnim, transform: [{ translateY: slideAnim }], borderColor: theme.surfaceBorder }]}> 
                <Image source={require('../assets/logo.png')} style={styles.logo} />
                <Text style={[styles.title, { color: theme.textPrimary }]}>Welcome Back!</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sign in to your account</Text>

                {!!error && (
                  <Animated.View 
                    style={{ 
                      opacity: errorAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 0.8, 1]
                      }),
                      transform: [{
                        translateY: errorAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-10, 0]
                        })
                      }]
                    }}
                  >
                    <View style={[styles.errorContainer, { backgroundColor: isDark ? '#3a1f1f' : '#ffeaea', borderColor: theme.danger }]}>
                      <Ionicons name="alert-circle" size={20} color={theme.danger} style={{ marginRight: 8 }} />
                      <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
                    </View>
                  </Animated.View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.muted }]}>Email or Phone Number</Text>
                  <TextInput
                    ref={identifierInputRef}
                    placeholder="Enter your email or phone number"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={identifier}
                    onChangeText={(text) => {
                      setIdentifier(text);
                      if (error) setError(''); // Clear error when user types
                    }}
                    onFocus={() => setFocusedField('identifier')}
                    onBlur={() => setFocusedField(null)}
                    style={[
                      styles.input, 
                      { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary },
                      focusedField === 'identifier' && { borderColor: theme.accent, borderWidth: 2 }
                    ]}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.muted }]}>Password</Text>
                  <View style={[
                    styles.passwordRow, 
                    { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
                    focusedField === 'password' && { borderColor: theme.accent, borderWidth: 2 }
                  ]}>
                    <TextInput
                      ref={passwordInputRef}
                      placeholder="Your password"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (error) setError(''); // Clear error when user types
                      }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0, padding: 0 }]}
                      returnKeyType="done"
                      onSubmitEditing={onLogin}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showBtn}>
                      <Ionicons 
                        name={showPassword ? 'eye-off' : 'eye'} 
                        size={24} 
                        color={theme.accent} 
                      />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => Alert.alert('Forgot Password', 'Please contact support to reset your password.')} style={styles.forgotPasswordBtn}>
                    <Text style={[styles.forgotPasswordText, { color: theme.accent }]}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity disabled={loading} onPress={onLogin} style={[styles.primaryBtn, { backgroundColor: theme.accent }, loading && styles.primaryBtnDisabled]}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
                </TouchableOpacity>

                <Text style={[styles.helperText, { color: theme.muted }]}>Use your registered email or phone number</Text>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, // Background color handled by SafeAreaView
  scroll: { flexGrow: 1, alignItems: 'center', paddingVertical: 30 }, // Removed justifyContent: 'center'
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20, // Slightly less rounded corners
    padding: 30, // Reduced padding
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 }, // Softer shadow offset
    shadowOpacity: 0.1, // Softer shadow opacity
    shadowRadius: 10, // Softer shadow radius
    elevation: 5, // Softer elevation
    width: '90%', // Slightly narrower card
    maxWidth: 400, // Reduced max width
  },
  logo: {
    width: 100, // Reduced logo size
    height: 100,
    alignSelf: 'center',
    marginBottom: 20, // Reduced margin
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28, // Slightly smaller title font size
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10, // Adjusted margin
  },
  subtitle: {
    fontSize: 16, // Slightly smaller subtitle font size
    textAlign: 'center',
    marginBottom: 30, // Reduced margin
    lineHeight: 24, // Adjusted line height
  },
  inputGroup: {
    marginBottom: 20, // Reduced margin
  },
  inputLabel: {
    fontSize: 15, // Slightly smaller label font size
    fontWeight: '600',
    marginBottom: 8, // Reduced margin
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingVertical: 14, // Reduced padding
    paddingHorizontal: 18, // Reduced padding
    borderRadius: 12, // Slightly less rounded input
    fontSize: 16, // Slightly smaller input font size
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 18,
    height: 52, // Slightly reduced fixed height
  },
  showBtn: {
    paddingLeft: 10,
    paddingVertical: 8,
  },
  // showBtnText removed as it's replaced by Ionicons
  primaryBtn: {
    backgroundColor: '#4a90e2',
    paddingVertical: 16, // Reduced padding
    borderRadius: 14, // Slightly less rounded
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25, // Reduced margin
    borderWidth: 1,
    borderColor: '#3a7bd5',
  },
  primaryBtnDisabled: {
    backgroundColor: '#a0c8f0', // More distinct disabled background color
    opacity: 1, // Keep opacity at 1 since background color changes
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 18, // Slightly smaller button text
    fontWeight: '700',
  },
  helperText: {
    textAlign: 'center',
    marginTop: 20, // Reduced margin
    fontSize: 14, // Slightly smaller text
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 15,
  },
  error: {
    flex: 1,
    fontSize: 15, // Slightly smaller error text
    fontWeight: '500',
    lineHeight: 20,
  },
  forgotPasswordBtn: {
    marginTop: 12, // Reduced margin
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 15, // Slightly smaller text
    fontWeight: '600',
  },
});