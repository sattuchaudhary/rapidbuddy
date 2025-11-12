import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Alert } from 'react-native';

let navigationRef = null;

// Set navigation reference for logout
export const setNavigationRef = (ref) => {
  navigationRef = ref;
  console.log('Navigation ref set for auth interceptor');
};

// Force logout function
const forceLogout = async (message = 'You have been logged out. Please login again.') => {
  try {
    // Clear all stored data
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('agent');
    await SecureStore.deleteItemAsync('userData');
    
    // Show alert
    Alert.alert(
      'Logged Out',
      message,
      [
        {
          text: 'OK',
          onPress: () => {
            // Navigate to login screen
            if (navigationRef?.current) {
              try {
                navigationRef.current.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              } catch (navError) {
                console.error('Navigation error during logout:', navError);
              }
            } else {
              console.warn('Navigation ref not available for logout');
            }
          }
        }
      ],
      { cancelable: false }
    );
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

// Setup axios interceptor
export const setupAuthInterceptor = () => {
  // Response interceptor
  axios.interceptors.response.use(
    (response) => {
      // If response is successful, just return it
      return response;
    },
    async (error) => {
      // Skip interceptor for login endpoints to avoid logout loops
      const requestUrl = error.config?.url || '';
      if (requestUrl.includes('/login') || requestUrl.includes('/unified-auth/login')) {
        return Promise.reject(error);
      }

      // Check if it's a 401 error
      if (error.response?.status === 401) {
        const responseData = error.response?.data;
        
        // Check if it's a force logout
        if (responseData?.forceLogout === true) {
          console.log('Force logout detected from server');
          const message = responseData?.message || 'You have been logged out by administrator. Please login again.';
          await forceLogout(message);
          // Return a rejected promise to stop the request chain
          return Promise.reject(new Error('Force logout'));
        }
        
        // For other 401 errors, check if token exists
        // If token exists but we got 401, it might be expired
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          // Token exists but got 401 - might be expired or invalid
          // Don't auto-logout for regular 401s, let the calling code handle it
          console.log('401 error with valid token - might be expired');
        }
      }
      
      // For all other errors, just pass them through
      return Promise.reject(error);
    }
  );
};

