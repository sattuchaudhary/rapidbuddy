import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from './config';

let navigationRef = null;
let checkInterval = null;
let isChecking = false;
let showModalCallback = null;

// Set navigation reference
export const setNavigationRef = (ref) => {
  navigationRef = ref;
};

// Set callback to show modal
export const setShowModalCallback = (callback) => {
  showModalCallback = callback;
};

// Force logout function
export const performForceLogout = async (message = 'You have been logged out by administrator. Please login again.') => {
  try {
    // Clear all stored data
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('agent');
    await SecureStore.deleteItemAsync('userData');
    
    // Show custom modal if callback is set
    if (showModalCallback) {
      showModalCallback(true, message, () => {
        // Navigate to login screen on OK
        if (navigationRef?.current) {
          try {
            navigationRef.current.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          } catch (navError) {
            console.error('Navigation error during logout:', navError);
          }
        }
      });
    } else {
      // Fallback to navigation if modal callback not set
      if (navigationRef?.current) {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    }
  } catch (error) {
    console.error('Error during force logout:', error);
    // Even if there's an error, try to navigate to login
    if (navigationRef?.current) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }
};

// Check force logout status from server
export const checkForceLogout = async () => {
  if (isChecking) return; // Prevent concurrent checks
  
  try {
    isChecking = true;
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      isChecking = false;
      return;
    }

    const response = await axios.get(`${getBaseURL()}/api/tenant/users/check-force-logout`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });

    if (response.data?.success && response.data?.forceLogout === true) {
      const message = response.data?.message || 'You have been logged out by administrator. Please login again.';
      await performForceLogout(message);
      // Stop checking after logout
      stopForceLogoutChecker();
    }
  } catch (error) {
    // Silently fail - don't interrupt user experience
    console.log('Force logout check error:', error.message);
  } finally {
    isChecking = false;
  }
};

// Start periodic checking for force logout
export const startForceLogoutChecker = (intervalMs = 10000) => {
  // Clear existing interval if any
  stopForceLogoutChecker();
  
  // Check immediately
  checkForceLogout();
  
  // Then check periodically
  checkInterval = setInterval(() => {
    checkForceLogout();
  }, intervalMs);
  
  console.log('Force logout checker started with interval:', intervalMs, 'ms');
};

// Stop periodic checking
export const stopForceLogoutChecker = () => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('Force logout checker stopped');
  }
};

