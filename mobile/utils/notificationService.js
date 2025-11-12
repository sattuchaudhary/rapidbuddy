import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { getBaseURL } from './config';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions
 * @returns {Promise<boolean>} True if permissions granted
 */
export async function requestNotificationPermissions() {
  try {
    if (!Device.isDevice) {
      console.log('⚠️ Notifications work on physical devices only');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Notification permissions not granted');
      return false;
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('file_uploads', {
        name: 'File Uploads',
        description: 'Notifications when new data files are uploaded',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10121A',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    console.log('✅ Notification permissions granted');
    return true;
  } catch (error) {
    console.error('❌ Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get Expo push token
 * @returns {Promise<string|null>} Expo push token or null
 */
export async function getExpoPushToken() {
  try {
    if (!Device.isDevice) {
      console.log('⚠️ Expo push token is only available on physical devices');
      return null;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'e830db89-f4a2-47b6-a103-a23257f8fded', // From app.json
    });

    // Handle both old and new API formats
    const token = typeof tokenData === 'string' ? tokenData : (tokenData?.data || tokenData?.token || null);
    if (!token) {
      console.error('❌ Invalid token format received:', tokenData);
      return null;
    }
    
    console.log('✅ Expo push token obtained:', token);
    return token;
  } catch (error) {
    console.error('❌ Error getting Expo push token:', error);
    return null;
  }
}

/**
 * Register device token with server
 * @param {string} token - Expo push token
 * @returns {Promise<boolean>} True if registration successful
 */
export async function registerDeviceToken(token) {
  try {
    const authToken = await SecureStore.getItemAsync('token');
    if (!authToken) {
      console.log('⚠️ No auth token found, skipping device registration');
      return false;
    }

    const platform = Platform.OS;
    const deviceName = Device.deviceName || Device.modelName || 'Unknown Device';
    const appVersion = Device.osVersion || 'Unknown';

    const response = await axios.post(
      `${getBaseURL()}/api/mobile/register-device`,
      {
        token,
        platform,
        deviceId: Device.modelId || '',
        deviceName,
        appVersion,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data?.success) {
      console.log('✅ Device token registered successfully');
      return true;
    } else {
      console.error('❌ Device token registration failed:', response.data?.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Error registering device token:', error.message);
    return false;
  }
}

/**
 * Unregister device token (on logout)
 * @param {string} token - Expo push token
 * @returns {Promise<boolean>} True if unregistration successful
 */
export async function unregisterDeviceToken(token) {
  try {
    const authToken = await SecureStore.getItemAsync('token');
    if (!authToken || !token) {
      return false;
    }

    await axios.post(
      `${getBaseURL()}/api/mobile/unregister-device`,
      { token },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log('✅ Device token unregistered');
    return true;
  } catch (error) {
    console.error('❌ Error unregistering device token:', error.message);
    return false;
  }
}

/**
 * Setup notification listeners
 * @param {Function} onNotificationReceived - Callback when notification is received
 * @returns {Function} Cleanup function
 */
export function setupNotificationListeners(onNotificationReceived) {
  // Listener for notifications received while app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📲 Notification received in foreground:', notification);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Listener for notification responses (when user taps notification)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('📲 Notification response:', response);
    const data = response.notification.request.content.data;
    
    // Handle notification tap
    if (data?.type === 'file_upload') {
      // Navigate to sync screen or relevant screen
      if (onNotificationReceived) {
        onNotificationReceived(response.notification, true);
      }
    }
  });

  // Return cleanup function
  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Initialize notifications (request permissions, get token, register)
 * @returns {Promise<string|null>} Expo push token or null
 */
export async function initializeNotifications() {
  try {
    // Request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return null;
    }

    // Get Expo push token
    const token = await getExpoPushToken();
    if (!token) {
      return null;
    }

    // Register token with server
    await registerDeviceToken(token);

    return token;
  } catch (error) {
    console.error('❌ Error initializing notifications:', error);
    return null;
  }
}

/**
 * Clear notification badge
 */
export async function clearBadge() {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('❌ Error clearing badge:', error);
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('❌ Error canceling notifications:', error);
  }
}

