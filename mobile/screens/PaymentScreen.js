import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  StatusBar, 
  Image, 
  Modal, 
  Share, 
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions
} from 'react-native';
import { Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { logError, getErrorMessage, showErrorAlert } from '../utils/errorHandler';

const { width } = Dimensions.get('window');

const formatUserType = (userType) => {
  if (!userType) return 'N/A';
  return userType === 'repo_agent' ? 'Repo Agent' : userType === 'office_staff' ? 'Office Staff' : userType;
};

const PLAN_OPTIONS = [
  { value: 'weekly', label: 'Weekly', icon: '📅' },
  { value: 'monthly', label: 'Monthly', icon: '📆' },
  { value: 'quarterly', label: 'Quarterly', icon: '🗓️' },
  { value: 'yearly', label: 'Yearly', icon: '📅' }
];

const PAYMENT_MODES = [
  { id: 'qr', label: 'QR Code', icon: '📱', description: 'Scan QR code to pay' },
  { id: 'upi_id', label: 'UPI ID', icon: '💳', description: 'Copy UPI ID and pay' },
  { id: 'upi_app', label: 'Pay with UPI App', icon: '🚀', description: 'Open UPI app directly' }
];

export default function PaymentScreen({ navigation }) {
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [slideAnim] = useState(new Animated.Value(0));

  // Subscription data
  const [subRemaining, setSubRemaining] = useState(null);
  const [subEnd, setSubEnd] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [graceEnd, setGraceEnd] = useState(null);

  // Payment data
  const [planPeriod, setPlanPeriod] = useState('monthly');
  const [amount, setAmount] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState(null);
  const [transactionId, setTransactionId] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [notes, setNotes] = useState('');

  // Payment settings
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [planPrices, setPlanPrices] = useState({});

  // UI states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

  // Helper: retry API call with exponential backoff
  const retryApiCall = async (apiFn, maxRetries = 3, delay = 1000) => {
    let attempt = 0;
    let lastErr = null;
    while (attempt < maxRetries) {
      try {
        return await apiFn();
      } catch (err) {
        const status = err?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 408) {
          throw err;
        }
        lastErr = err;
        attempt += 1;
        const wait = delay * attempt;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastErr;
  };

  const fetchRemaining = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;
      const res = await retryApiCall(() => axios.get(`${getBaseURL()}/api/tenants/subscription/remaining`, {
        headers: { Authorization: `Bearer ${token}` }
      }));
      const data = res?.data?.data || {};
      const remainingMs = typeof data.remainingMs === 'number' ? data.remainingMs : 0;
      const endDate = data.endDate || null;
      const status = data.status || null;
      const gracePeriodEnd = data.gracePeriodEnd || null;
      setSubRemaining(remainingMs);
      setSubEnd(endDate ? new Date(endDate) : null);
      setSubStatus(status);
      setGraceEnd(gracePeriodEnd ? new Date(gracePeriodEnd) : null);
    } catch (err) {
      logError(err, 'fetchRemaining');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRemaining(true);
    (async () => {
      setLoading(true);
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) return;
        const res = await retryApiCall(() => axios.get(`${getBaseURL()}/api/tenants/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        }));
        const cfg = res?.data?.data?.paymentConfig || {};
        setUpiId(cfg.upiId || '');
        setPayeeName(cfg.payeeName || '');
        const rawQr = cfg.qrCodeImageUrl || '';
        const absoluteQr = normalizeQrUrl(rawQr);
        setQrUrl(absoluteQr);
        setInstructions(cfg.instructions || '');
        setPlanPrices(cfg.planPrices || {});
        const defaultPrice = cfg.planPrices?.[planPeriod];
        if (defaultPrice != null) setAmount(String(defaultPrice));
      } catch (err) {
        logError(err, 'fetchSettings');
        showErrorAlert('Settings Error', 'Could not load payment settings. Please try again.');
        setUpiId('');
        setPayeeName('');
        setQrUrl('');
        setInstructions('');
        setPlanPrices({});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const price = planPrices?.[planPeriod];
    if (price != null) setAmount(String(price));
  }, [planPeriod, planPrices]);

  // Animate step transitions
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: currentStep,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentStep]);

  const normalizeQrUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('/')) return `${getBaseURL()}${url}`;
    try {
      if (url.includes('drive.google.com')) {
        let id = '';
        const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        id = (m1 && m1[1]) || (m2 && m2[1]) || '';
        if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
      }
    } catch (err) {
      logError(err, 'normalizeQrUrl');
      return url;
    }
    return url;
  };

  const isSubscriptionExpired = () => {
    if (!subStatus) {
      return subRemaining != null ? subRemaining <= 0 : true;
    }
    if (['active', 'trial'].includes(subStatus)) return false;
    if (subStatus === 'grace_period') {
      if (graceEnd) return graceEnd <= new Date();
      if (subRemaining != null) return subRemaining <= 0;
      return false;
    }
    return true;
  };

  const formatRemaining = () => {
    if (subRemaining == null || subRemaining <= 0) return '';
    const days = Math.floor(subRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((subRemaining / (1000 * 60 * 60)) % 24);
    return `${days} days ${hours} hours`;
  };

  const formatStatus = () => {
    if (loading) return 'Loading...';
    if (!subStatus) {
      return subRemaining > 0 ? `Active${subEnd ? ` • ends ${subEnd.toLocaleDateString()}` : ''}` : 'No active subscription';
    }
    if (['active', 'trial'].includes(subStatus)) {
      const label = subStatus === 'trial' ? 'Trial' : 'Active';
      return `${label}${subEnd ? ` • ends ${subEnd.toLocaleDateString()}` : ''}${formatRemaining() ? ` (${formatRemaining()} left)` : ''}`;
    }
    if (subStatus === 'grace_period') {
      const graceLabel = graceEnd ? `until ${graceEnd.toLocaleDateString()}` : '';
      return `Grace Period ${graceLabel}`.trim();
    }
    return 'Expired';
  };

  const handleLogout = async () => {
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
              await SecureStore.deleteItemAsync('userData');
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

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!planPeriod || !amount) {
        showErrorAlert('Required', 'Please select a plan');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!selectedPaymentMode) {
        showErrorAlert('Required', 'Please select a payment mode');
        return;
      }
      // If QR is selected, show QR modal first, then user can proceed after closing
      if (selectedPaymentMode === 'qr' && !qrVisible) {
        setQrVisible(true);
        return;
      }
      // For all payment modes, advance to step 4
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (!transactionId.trim()) {
        showErrorAlert('Required', 'Please enter Transaction ID or UTR number');
        return;
      }
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePaymentModeSelect = (mode) => {
    setSelectedPaymentMode(mode);
    if (mode === 'qr') {
      setQrVisible(true);
    } else if (mode === 'upi_app') {
      openUpiIntent();
    }
  };

  const openUpiIntent = () => {
    if (!upiId) {
      Alert.alert('Missing UPI', 'UPI ID is not configured');
      return;
    }
    const amt = amount && Number(amount) > 0 ? Number(amount).toFixed(2) : '';
    const note = notes ? encodeURIComponent(notes) : encodeURIComponent('RapidRepo Subscription');
    const pn = encodeURIComponent(payeeName || '');
    const pa = encodeURIComponent(upiId);
    const url = `upi://pay?pa=${pa}&pn=${pn}${amt ? `&am=${amt}` : ''}&tn=${note}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('UPI App Not Found', 'Install any UPI app (GPay/PhonePe/Paytm) and try again.');
    });
  };

  const copyUpi = async () => {
    if (!upiId) return;
    try {
      await Share.share({ message: upiId });
    } catch (err) {
      logError(err, 'copyUpi');
      showErrorAlert('Share Failed', 'Could not share UPI ID. Please copy it manually.');
    }
  };

  const pickPaymentScreenshot = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showErrorAlert('Permission Denied', 'Media library access is required to upload payment screenshot');
        return;
      }

      // Use MediaType.Images for expo-image-picker v17
      // Try different possible enum values with fallback
      let mediaType;
      if (ImagePicker.MediaType?.Images) {
        mediaType = ImagePicker.MediaType.Images;
      } else if (ImagePicker.MediaType?.IMAGE) {
        mediaType = [ImagePicker.MediaType.IMAGE];
      } else if (ImagePicker.MediaTypeOptions?.Images) {
        mediaType = ImagePicker.MediaTypeOptions.Images;
      } else {
        mediaType = 'images';
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType,
        allowsEditing: false, // No cropping - upload full image
        quality: 0.9, // High quality, server will compress
        allowsMultiple: false
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setPaymentScreenshot(result.assets[0].uri);
      }
    } catch (err) {
      logError(err, 'pickPaymentScreenshot');
      const errorMessage = err?.message || 'Failed to pick image';
      console.error('Image picker error details:', err);
      showErrorAlert('Error', errorMessage);
    }
  };

  const uploadScreenshot = async (screenshotUri) => {
    try {
      setUploadingScreenshot(true);
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        showErrorAlert('Authentication Error', 'Please login again');
        return null;
      }

      if (!screenshotUri) {
        console.warn('No screenshot URI provided');
        return null;
      }

      const formData = new FormData();
      const uri = screenshotUri;
      const name = uri.split('/').pop() || 'payment_screenshot.jpg';
      
      // React Native FormData format
      formData.append('file', {
        uri: uri,
        name: name,
        type: 'image/jpeg'
      });

      const baseURL = getBaseURL();
      const uploadURL = `${baseURL}/api/uploads/payment-screenshot`;
      
      console.log('Uploading screenshot:', { 
        filename: name,
        uriPrefix: uri.substring(0, 30),
        baseURL,
        uploadURL
      });

      // Use fetch instead of axios for better React Native FormData support
      const response = await fetch(uploadURL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
          // Don't set Content-Type - React Native will set it with boundary
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: `Server error: ${response.status}` };
        }
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      
      if (result?.success && result?.url) {
        console.log('Screenshot uploaded successfully:', result.url);
        return result.url;
      } else {
        throw new Error(result?.message || 'Upload failed - no URL returned');
      }
    } catch (err) {
      logError(err, 'uploadScreenshot');
      
      // More detailed error logging
      console.error('Screenshot upload error:', {
        message: err?.message,
        stack: err?.stack
      });
      
      const errorMessage = err?.message || 'Failed to upload screenshot. Please check your network connection.';
      
      // Show error to user
      showErrorAlert('Screenshot Upload Failed', errorMessage);
      return null;
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const txn = (transactionId || '').trim();
      const txnRegex = /^[a-zA-Z0-9]{6,}$/;
      if (!txnRegex.test(txn)) {
        showErrorAlert('Invalid Transaction ID', 'Transaction ID must be alphanumeric and at least 6 characters long');
        setSubmitting(false);
        return;
      }

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        showErrorAlert('Invalid Amount', 'Please enter a valid amount greater than zero');
        setSubmitting(false);
        return;
      }

      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        showErrorAlert('Login required', 'Please login again');
        setSubmitting(false);
        return;
      }

      // Upload screenshot if available
      let screenshotUrl = null;
      if (paymentScreenshot) {
        console.log('Starting screenshot upload...');
        screenshotUrl = await uploadScreenshot(paymentScreenshot);
        // If upload fails, screenshotUrl will be null
        // User already saw error alert, we'll continue without screenshot
        if (!screenshotUrl) {
          console.warn('Screenshot upload failed, continuing without screenshot');
        }
      }

      const body = {
        planPeriod,
        amount: parsedAmount,
        transactionId: txn,
        notes: notes || (screenshotUrl ? 'Payment screenshot attached' : ''),
        screenshotUrl: screenshotUrl || undefined
      };

      const res = await axios.post(`${getBaseURL()}/api/payments/submit`, body, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        const paymentData = res.data?.data || {};
        Alert.alert(
          'Payment Submitted Successfully',
          `Your payment has been submitted for approval.\n\nTransaction ID: ${txn}\nAmount: ₹${parsedAmount}\nPlan: ${planPeriod}\n\nYou will be notified once it's processed.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        const msg = res.data?.message || 'Submission failed';
        showErrorAlert('Failed', msg);
      }
    } catch (e) {
      logError(e, 'submitPayment');
      const msg = getErrorMessage(e, 'Failed to submit payment');
      showErrorAlert('Payment Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = ['Plan', 'Payment', 'Details'];
    return (
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isActive = currentStep >= stepNum + 1;
          const isCurrent = currentStep === stepNum + 1;
          return (
            <View key={step} style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                isActive && styles.stepCircleActive,
                isCurrent && styles.stepCircleCurrent
              ]}>
                <Text style={[
                  styles.stepNumber,
                  isActive && styles.stepNumberActive
                ]}>
                  {isActive ? '✓' : stepNum}
                </Text>
              </View>
              <Text style={[
                styles.stepLabel,
                isActive && styles.stepLabelActive
              ]}>
                {step}
              </Text>
              {index < steps.length - 1 && (
                <View style={[
                  styles.stepLine,
                  isActive && styles.stepLineActive
                ]} />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderStep1 = () => {
    const expired = isSubscriptionExpired();
    return (
      <Animated.View style={[
        styles.stepContainer,
        {
          opacity: slideAnim.interpolate({
            inputRange: [1, 2],
            outputRange: [1, 0],
            extrapolate: 'clamp'
          }),
          transform: [{
            translateX: slideAnim.interpolate({
              inputRange: [1, 2],
              outputRange: [0, -width],
              extrapolate: 'clamp'
            })
          }]
        }
      ]}>
        <View style={styles.expiryCard}>
          <View style={styles.expiryIconContainer}>
            <Text style={styles.expiryIcon}>{expired ? '⚠️' : '⏰'}</Text>
          </View>
          <Text style={styles.expiryTitle}>
            {expired ? 'Subscription Expired' : 'Renew Your Subscription'}
          </Text>
          <Text style={styles.expirySubtitle}>
            {expired 
              ? 'Your subscription has expired. Please renew to continue using the app.'
              : 'Your subscription is about to expire. Renew now to continue uninterrupted service.'
            }
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{formatStatus()}</Text>
          </View>
          {subEnd && (
            <Text style={styles.expiryDate}>
              {expired ? 'Expired on' : 'Expires on'}: {subEnd.toLocaleDateString()}
            </Text>
          )}
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.nextButton]}
            onPress={handleNext}
          >
            <LinearGradient
              colors={['#6200EE', '#7B1FA2']}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.nextButtonText}>Continue to Payment</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderStep2 = () => {
    return (
      <Animated.View style={[
        styles.stepContainer,
        {
          opacity: slideAnim.interpolate({
            inputRange: [1, 2, 3],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp'
          }),
          transform: [{
            translateX: slideAnim.interpolate({
              inputRange: [1, 2, 3],
              outputRange: [width, 0, -width],
              extrapolate: 'clamp'
            })
          }]
        }
      ]}>
        <Text style={styles.stepTitle}>Choose Your Plan</Text>
        <Text style={styles.stepSubtitle}>Select a subscription plan that suits you</Text>
        
        <View style={styles.planGrid}>
          {PLAN_OPTIONS.map((plan) => {
            const price = planPrices[plan.value];
            const isSelected = planPeriod === plan.value;
            return (
              <TouchableOpacity
                key={plan.value}
                style={[
                  styles.planCard,
                  isSelected && styles.planCardSelected
                ]}
                onPress={() => setPlanPeriod(plan.value)}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}
                <Text style={styles.planIcon}>{plan.icon}</Text>
                <Text style={styles.planLabel}>{plan.label}</Text>
                {price ? (
                  <Text style={styles.planPrice}>₹{price}</Text>
                ) : (
                  <Text style={styles.planPricePlaceholder}>Price not set</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {amount && (
          <View style={styles.amountDisplay}>
            <Text style={styles.amountLabel}>Amount to Pay</Text>
            <Text style={styles.amountValue}>₹{amount}</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderStep3 = () => {
    return (
      <Animated.View style={[
        styles.stepContainer,
        {
          opacity: slideAnim.interpolate({
            inputRange: [2, 3, 4],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp'
          }),
          transform: [{
            translateX: slideAnim.interpolate({
              inputRange: [2, 3, 4],
              outputRange: [width, 0, -width],
              extrapolate: 'clamp'
            })
          }]
        }
      ]}>
        <Text style={styles.stepTitle}>Select Payment Method</Text>
        <Text style={styles.stepSubtitle}>Choose how you want to make the payment</Text>

        <View style={styles.paymentModes}>
          {PAYMENT_MODES.map((mode) => {
            const isSelected = selectedPaymentMode === mode.id;
            const isAvailable = mode.id === 'qr' ? !!qrUrl : mode.id === 'upi_id' || mode.id === 'upi_app' ? !!upiId : false;
            
            return (
              <TouchableOpacity
                key={mode.id}
                style={[
                  styles.paymentModeCard,
                  isSelected && styles.paymentModeCardSelected,
                  !isAvailable && styles.paymentModeCardDisabled
                ]}
                onPress={() => isAvailable && handlePaymentModeSelect(mode.id)}
                disabled={!isAvailable}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}
                <Text style={styles.paymentModeIcon}>{mode.icon}</Text>
                <Text style={styles.paymentModeLabel}>{mode.label}</Text>
                <Text style={styles.paymentModeDescription}>{mode.description}</Text>
                {!isAvailable && (
                  <Text style={styles.unavailableText}>Not available</Text>
                )}
                {mode.id === 'upi_id' && isSelected && upiId && (
                  <View style={styles.upiIdContainer}>
                    <Text style={styles.upiIdText}>{upiId}</Text>
                    <TouchableOpacity style={styles.copyButton} onPress={copyUpi}>
                      <Text style={styles.copyButtonText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedPaymentMode && (
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentInfoTitle}>Payment Details</Text>
            <View style={styles.paymentInfoRow}>
              <Text style={styles.paymentInfoLabel}>Plan:</Text>
              <Text style={styles.paymentInfoValue}>{planPeriod.charAt(0).toUpperCase() + planPeriod.slice(1)}</Text>
            </View>
            <View style={styles.paymentInfoRow}>
              <Text style={styles.paymentInfoLabel}>Amount:</Text>
              <Text style={styles.paymentInfoValue}>₹{amount}</Text>
            </View>
            {payeeName && (
              <View style={styles.paymentInfoRow}>
                <Text style={styles.paymentInfoLabel}>Payee:</Text>
                <Text style={styles.paymentInfoValue}>{payeeName}</Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    );
  };

  const renderStep4 = () => {
    return (
      <Animated.View style={[
        styles.stepContainer,
        {
          opacity: slideAnim.interpolate({
            inputRange: [3, 4],
            outputRange: [0, 1],
            extrapolate: 'clamp'
          }),
          transform: [{
            translateX: slideAnim.interpolate({
              inputRange: [3, 4],
              outputRange: [width, 0],
              extrapolate: 'clamp'
            })
          }]
        }
      ]}>
        <Text style={styles.stepTitle}>Payment Details</Text>
        <Text style={styles.stepSubtitle}>Enter your transaction details</Text>

        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>Transaction ID / UTR Number *</Text>
          <TextInput
            style={styles.input}
            value={transactionId}
            onChangeText={setTransactionId}
            placeholder="Enter transaction ID or UTR number"
            placeholderTextColor="#999"
            autoCapitalize="characters"
          />

          <Text style={styles.inputLabel}>Payment Screenshot</Text>
          <TouchableOpacity
            style={styles.screenshotButton}
            onPress={pickPaymentScreenshot}
            disabled={uploadingScreenshot}
          >
            {paymentScreenshot ? (
              <View style={styles.screenshotPreview}>
                <Image source={{ uri: paymentScreenshot }} style={styles.screenshotImage} />
                <TouchableOpacity
                  style={styles.removeScreenshot}
                  onPress={() => setPaymentScreenshot(null)}
                >
                  <Text style={styles.removeScreenshotText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.screenshotPlaceholder}>
                <Text style={styles.screenshotIcon}>📷</Text>
                <Text style={styles.screenshotText}>
                  {uploadingScreenshot ? 'Uploading...' : 'Tap to upload payment screenshot'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes for admin"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Payment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Plan:</Text>
            <Text style={styles.summaryValue}>{planPeriod.charAt(0).toUpperCase() + planPeriod.slice(1)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount:</Text>
            <Text style={styles.summaryValue}>₹{amount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Mode:</Text>
            <Text style={styles.summaryValue}>
              {PAYMENT_MODES.find(m => m.id === selectedPaymentMode)?.label || 'N/A'}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F111A" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backButton}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step Indicator */}
      {currentStep > 1 && renderStepIndicator()}

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6200EE" />
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </ScrollView>

      {/* Bottom Action Buttons */}
      {currentStep > 1 && (
        <View style={styles.bottomActions}>
          {currentStep > 2 && (
            <TouchableOpacity
              style={styles.backButtonBottom}
              onPress={handleBack}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextButtonBottom, submitting && styles.nextButtonBottomDisabled]}
            onPress={handleNext}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <LinearGradient
                colors={['#6200EE', '#7B1FA2']}
                style={styles.gradientButtonBottom}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.nextButtonTextBottom}>
                  {currentStep === 4 ? 'Submit Payment' : 'Next'}
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* QR Code Modal */}
      <Modal
        visible={qrVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setQrVisible(false);
          if (selectedPaymentMode === 'qr' && currentStep === 3) {
            setCurrentStep(4);
          }
        }}
      >
        <View style={styles.modalWrap}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => {
              setQrVisible(false);
              if (selectedPaymentMode === 'qr' && currentStep === 3) {
                setCurrentStep(4);
              }
            }}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Scan QR Code to Pay</Text>
            {qrUrl ? (
              <Image
                source={{ uri: qrUrl }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.qrErrorText}>QR code not available</Text>
            )}
            {payeeName && <Text style={styles.modalSubtitle}>Payee: {payeeName}</Text>}
            {amount && <Text style={styles.modalSubtitle}>Amount: ₹{amount}</Text>}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setQrVisible(false);
                if (selectedPaymentMode === 'qr' && currentStep === 3) {
                  setCurrentStep(4);
                }
              }}
            >
              <Text style={styles.modalCloseButtonText}>I've Paid</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#0F111A',
  },
  backButton: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  stepCircleActive: {
    backgroundColor: '#6200EE',
  },
  stepCircleCurrent: {
    borderWidth: 3,
    borderColor: '#7B1FA2',
  },
  stepNumber: {
    color: '#757575',
    fontSize: 14,
    fontWeight: '700',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    color: '#757575',
    fontSize: 12,
    marginLeft: 4,
  },
  stepLabelActive: {
    color: '#6200EE',
    fontWeight: '600',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#6200EE',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  stepContainer: {
    flex: 1,
  },
  expiryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  expiryIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  expiryIcon: {
    fontSize: 40,
  },
  expiryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
    textAlign: 'center',
  },
  expirySubtitle: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  statusBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  expiryDate: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  logoutButtonText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
  },
  nextButton: {
    flex: 2,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 24,
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#6200EE',
    backgroundColor: '#F3E5F5',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  planIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  planLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6200EE',
  },
  planPricePlaceholder: {
    fontSize: 12,
    color: '#9E9E9E',
    fontStyle: 'italic',
  },
  amountDisplay: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6200EE',
  },
  amountLabel: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#6200EE',
  },
  paymentModes: {
    gap: 12,
    marginBottom: 20,
  },
  paymentModeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  paymentModeCardSelected: {
    borderColor: '#6200EE',
    backgroundColor: '#F3E5F5',
  },
  paymentModeCardDisabled: {
    opacity: 0.5,
  },
  paymentModeIcon: {
    fontSize: 32,
    marginBottom: 8,
    textAlign: 'center',
  },
  paymentModeLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
    textAlign: 'center',
  },
  paymentModeDescription: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
  },
  unavailableText: {
    fontSize: 12,
    color: '#D32F2F',
    textAlign: 'center',
    marginTop: 8,
  },
  upiIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  upiIdText: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
    fontWeight: '600',
  },
  copyButton: {
    backgroundColor: '#6200EE',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  paymentInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
  },
  paymentInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentInfoLabel: {
    fontSize: 14,
    color: '#757575',
  },
  paymentInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  screenshotButton: {
    marginTop: 8,
  },
  screenshotPlaceholder: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  screenshotIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  screenshotText: {
    fontSize: 14,
    color: '#757575',
  },
  screenshotPreview: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  screenshotImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeScreenshot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeScreenshotText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#6200EE',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#757575',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  backButtonBottom: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonBottom: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nextButtonBottomDisabled: {
    opacity: 0.6,
  },
  gradientButtonBottom: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonTextBottom: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: width - 40,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginTop: 8,
  },
  qrImage: {
    width: 280,
    height: 280,
    borderRadius: 16,
    marginBottom: 16,
  },
  qrErrorText: {
    color: '#D32F2F',
    fontSize: 14,
    marginBottom: 16,
  },
  modalCloseButton: {
    backgroundColor: '#6200EE',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
