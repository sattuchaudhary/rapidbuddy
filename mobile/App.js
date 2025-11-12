import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import axios from 'axios';
import { getBaseURL } from './utils/config';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { setupAuthInterceptor, setNavigationRef as setAuthInterceptorNavRef } from './utils/authInterceptor';
import { startForceLogoutChecker, stopForceLogoutChecker, setNavigationRef as setForceLogoutNavRef, setShowModalCallback, checkForceLogout } from './utils/forceLogoutChecker';
import ForceLogoutModal from './components/ForceLogoutModal';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import SearchResultsScreen from './screens/SearchResultsScreen';
import ProfileScreen from './screens/ProfileScreen';
import IDCardScreen from './screens/IDCardScreen';
import OfflineDataBrowser from './screens/OfflineDataBrowser';
import SyncScreen from './screens/SyncScreen';
import SettingsScreen from './screens/SettingsScreen';
import JSONExportScreen from './screens/JSONExportScreen';
import PaymentScreen from './screens/PaymentScreen';
import PaymentHistoryScreen from './screens/PaymentHistoryScreen';
import BulkOfflineDownloadScreen from './screens/BulkOfflineDownloadScreen';
import SuperAdminDashboardScreen from './screens/SuperAdminDashboardScreen';
import TenantDetailScreen from './screens/TenantDetailScreen';
import TenantFormScreen from './screens/TenantFormScreen';
import AllUsersScreen from './screens/AllUsersScreen';
import TenantAdminDashboardScreen from './screens/TenantAdminDashboardScreen';
import OfficeStaffDashboardScreen from './screens/OfficeStaffDashboardScreen';
import OfficeStaffListScreen from './screens/OfficeStaffListScreen';
import RepoAgentListScreen from './screens/RepoAgentListScreen';
import PendingApprovalsScreen from './screens/PendingApprovalsScreen';
import TwoWheelerDataScreen from './screens/TwoWheelerDataScreen';
import FourWheelerDataScreen from './screens/FourWheelerDataScreen';
import CVDataScreen from './screens/CVDataScreen';
import VehicleDataDetailsScreen from './screens/VehicleDataDetailsScreen';
import PaymentSettingsScreen from './screens/PaymentSettingsScreen';
import PaymentApprovalsScreen from './screens/PaymentApprovalsScreen';
import SubscriptionsScreen from './screens/SubscriptionsScreen';
import TenantSettingsScreen from './screens/TenantSettingsScreen';
import GlobalSyncOverlay from './components/GlobalSyncOverlay';
import UpdateNotification from './components/UpdateNotification';
import FastSplashScreen from './components/FastSplashScreen';
import ErrorBoundary from './components/ErrorBoundary';
import versionManager from './utils/versionManager';
import { startSmartBackgroundSync } from './utils/smartBackgroundSync';
import { initializeNotifications, setupNotificationListeners, unregisterDeviceToken, clearBadge } from './utils/notificationService';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userType, setUserType] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showForceLogoutModal, setShowForceLogoutModal] = useState(false);
  const [forceLogoutMessage, setForceLogoutMessage] = useState('');
  const appState = useRef(AppState.currentState);
  const sessionIdRef = useRef(null);
  const startedAtRef = useRef(null);
  const navigationRef = useRef(null);
  const forceLogoutOnOKRef = useRef(null);
  const notificationTokenRef = useRef(null);
  const notificationCleanupRef = useRef(null);

  // Helper function to determine dashboard screen based on user type and role
  const getDashboardScreenForRole = (userType, role) => {
    if (userType === 'main_user' && role === 'super_admin') {
      return 'SuperAdminDashboard';
    } else if (userType === 'main_user' && role === 'admin') {
      return 'TenantAdminDashboard';
    } else if (userType === 'office_staff') {
      return 'OfficeStaffDashboard';
    } else if (userType === 'repo_agent') {
      return 'Dashboard';
    }
    return 'Dashboard'; // Default fallback
  };

  // Setup axios interceptor for force logout
  useEffect(() => {
    setupAuthInterceptor();
    
    // Set modal callback for force logout
    setShowModalCallback((show, message, onOK) => {
      setForceLogoutMessage(message || 'You have been logged out by administrator. Please login again.');
      setShowForceLogoutModal(show);
      if (show && onOK) {
        // Store the onOK callback
        forceLogoutOnOKRef.current = onOK;
      }
    });
  }, []);
  
  const handleForceLogoutOK = () => {
    setShowForceLogoutModal(false);
    if (forceLogoutOnOKRef.current) {
      forceLogoutOnOKRef.current();
      forceLogoutOnOKRef.current = null;
    }
  };

  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});
    (async () => {
      try {
        // Fast token check - don't wait for other operations
        const token = await SecureStore.getItemAsync('token');
        setIsLoggedIn(!!token);

        // Read user data for role-based routing
        if (token) {
          try {
            const userDataStr = await SecureStore.getItemAsync('userData');
            if (userDataStr) {
              const userData = JSON.parse(userDataStr);
              setUserRole(userData.role);
              setUserType(userData.userType);
            } else {
              // Backward compatibility: fall back to 'agent' key
              const agentDataStr = await SecureStore.getItemAsync('agent');
              if (agentDataStr) {
                const agentData = JSON.parse(agentDataStr);
                setUserRole(agentData.role);
                setUserType(agentData.userType);
              }
            }
          } catch (error) {
            console.error('Error reading user data:', error);
          }
        }
        
        // Hide native splash screen immediately
        SplashScreen.hideAsync().catch(() => {});
        setIsBootstrapping(false);
        
        // Hide custom splash screen after minimum time
        setTimeout(() => {
          setShowSplash(false);
        }, 800);
      } catch (error) {
        console.error('Startup error:', error);
        SplashScreen.hideAsync().catch(() => {});
        setIsBootstrapping(false);
        setShowSplash(false);
      }
    })();
  }, []);

  // App usage session tracking - delayed to not block startup
  useEffect(() => {
    let isActive = true;

    const startSession = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) return;
        // Add timeout to prevent blocking
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        // Include userType and role in session metadata
        const metadata = {
          appState: appState.current,
          userType: userType,
          userRole: userRole
        };

        const res = await axios.post(`${getBaseURL()}/api/history/usage/start`, {
          platform: 'mobile',
          metadata
        }, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 3000
        });
        clearTimeout(timeoutId);
        sessionIdRef.current = res.data?.data?.sessionId || null;
        startedAtRef.current = Date.now();
      } catch (_) {
        // Silently fail - don't block app startup
      }
    };

    const endSession = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) return;
        const sid = sessionIdRef.current;
        if (!sid) return;
        await axios.post(`${getBaseURL()}/api/history/usage/end`, {
          sessionId: sid,
          endedAt: new Date().toISOString()
        }, { headers: { Authorization: `Bearer ${token}` } });
        sessionIdRef.current = null;
        startedAtRef.current = null;
      } catch (_) {}
    };

    const handleAppStateChange = async (nextState) => {
      const prev = appState.current;
      appState.current = nextState;
      // Move to active -> start session; move away from active -> end session
      if (prev.match(/inactive|background/) && nextState === 'active') {
        await startSession();
        // Check for force logout when app comes to foreground
        if (isLoggedIn) {
          checkForceLogout();
        }
      } else if (prev === 'active' && nextState.match(/inactive|background/)) {
        await endSession();
      }
    };

    // On mount, start session if logged in - with delay to not block startup
    if (isLoggedIn) {
      // Delay session start to not block app startup
      setTimeout(() => {
        startSession();
      }, 1000);
      
      // Start force logout checker
      startForceLogoutChecker(10000); // Check every 10 seconds
    } else {
      // Stop force logout checker if not logged in
      stopForceLogoutChecker();
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      isActive = false;
      sub && sub.remove && sub.remove();
      // End any ongoing session
      endSession();
      // Stop force logout checker
      stopForceLogoutChecker();
    };
  }, [isLoggedIn, userType, userRole]);

  // Check for updates when app starts or user logs in - delayed to not block startup
  useEffect(() => {
    const checkForUpdates = async () => {
      if (!isLoggedIn) return;
      
      try {
        const updateData = await versionManager.getUpdateInfo();
        if (updateData) {
          setUpdateInfo(updateData);
          setShowUpdateModal(true);
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };

    // Check for updates after a longer delay to allow app to fully load
    const timer = setTimeout(checkForUpdates, 5000);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  // Start smart background sync when user logs in - delayed to not block startup
  useEffect(() => {
    if (isLoggedIn) {
      // Delay background sync to not block app startup
      setTimeout(() => {
        console.log('🚀 Starting smart background sync...');
        startSmartBackgroundSync();
      }, 3000);
    }
  }, [isLoggedIn]);

  // Initialize push notifications when user logs in
  useEffect(() => {
    const initNotifications = async () => {
      if (isLoggedIn) {
        try {
          // Initialize notifications (request permissions, get token, register)
          const token = await initializeNotifications();
          if (token) {
            notificationTokenRef.current = token;
            console.log('✅ Notifications initialized');

            // Setup notification listeners
            const cleanup = setupNotificationListeners((notification, isResponse = false) => {
              console.log('📲 Notification received:', notification);
              
              // Handle file upload notifications
              const data = notification.request?.content?.data || notification.data || {};
              if (data.type === 'file_upload') {
                // Clear badge when notification is received
                clearBadge();
                
                // Navigate to sync screen if app is open
                if (navigationRef.current && isResponse) {
                  setTimeout(() => {
                    navigationRef.current?.navigate('Sync');
                  }, 500);
                }
              }
            });
            
            notificationCleanupRef.current = cleanup;
          }
        } catch (error) {
          console.error('❌ Error initializing notifications:', error);
        }
      } else {
        // Unregister device token on logout
        if (notificationTokenRef.current) {
          await unregisterDeviceToken(notificationTokenRef.current);
          notificationTokenRef.current = null;
        }
        
        // Cleanup notification listeners
        if (notificationCleanupRef.current) {
          notificationCleanupRef.current();
          notificationCleanupRef.current = null;
        }
        
        // Clear badge on logout
        clearBadge();
      }
    };

    // Delay notification initialization to not block app startup
    const timer = setTimeout(() => {
      initNotifications();
    }, 2000);

    return () => {
      clearTimeout(timer);
      // Cleanup on unmount
      if (notificationCleanupRef.current) {
        notificationCleanupRef.current();
      }
    };
  }, [isLoggedIn]);

  const handleUpdateModalClose = () => {
    setShowUpdateModal(false);
    setUpdateInfo(null);
  };

  // Show custom splash screen while app is loading
  if (showSplash) {
    return <FastSplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
  <ErrorBoundary>
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        // Set navigation ref for auth interceptor and force logout checker
        setAuthInterceptorNavRef(navigationRef);
        setForceLogoutNavRef(navigationRef);
      }}
      onStateChange={async () => {
        try {
          const token = await SecureStore.getItemAsync('token');
          setIsLoggedIn(!!token);
          if (token) {
            const userDataStr = await SecureStore.getItemAsync('userData');
            if (userDataStr) {
              const userData = JSON.parse(userDataStr);
              setUserRole(userData.role || null);
              setUserType(userData.userType || null);
            } else {
              const agentDataStr = await SecureStore.getItemAsync('agent');
              if (agentDataStr) {
                const agentData = JSON.parse(agentDataStr);
                setUserRole(agentData.role || null);
                setUserType(agentData.userType || null);
              }
            }
          } else {
            setUserRole(null);
            setUserType(null);
          }
        } catch (err) {
          console.error('onStateChange auth refresh error:', err);
        }
      }}
    >
      {!isBootstrapping && (
        <Stack.Navigator
          initialRouteName={isLoggedIn ? getDashboardScreenForRole(userType, userRole) : 'Login'}
          screenOptions={{
            animation: 'slide_from_right',
            animationDuration: 200,
            gestureEnabled: true,
            gestureDirection: 'horizontal'
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          {/* Dashboard screens are registered unconditionally to keep navigation stable */}
          <Stack.Screen name="SuperAdminDashboard" component={SuperAdminDashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TenantDetail" component={TenantDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TenantForm" component={TenantFormScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AllUsers" component={AllUsersScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TenantAdminDashboard" component={TenantAdminDashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OfficeStaffList" component={OfficeStaffListScreen} options={{ headerShown: false }} />
          <Stack.Screen name="RepoAgentList" component={RepoAgentListScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PendingApprovals" component={PendingApprovalsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TwoWheelerData" component={TwoWheelerDataScreen} options={{ headerShown: false }} />
          <Stack.Screen name="FourWheelerData" component={FourWheelerDataScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CVData" component={CVDataScreen} options={{ headerShown: false }} />
          <Stack.Screen name="VehicleDataDetails" component={VehicleDataDetailsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentSettings" component={PaymentSettingsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentApprovals" component={PaymentApprovalsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TenantSettings" component={TenantSettingsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OfficeStaffDashboard" component={OfficeStaffDashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
          {/* Common screens for all authenticated users */}
          <Stack.Screen name="SearchResults" component={SearchResultsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="IDCard" component={IDCardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Sync" component={SyncScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Sync Settings' }} />
          <Stack.Screen name="OfflineData" component={OfflineDataBrowser} options={{ headerShown: true, title: 'Offline Data' }} />
          <Stack.Screen name="JSONExport" component={JSONExportScreen} options={{ headerShown: true, title: 'Export JSON' }} />
          <Stack.Screen name="BulkDownload" component={BulkOfflineDownloadScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Payment" component={PaymentScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      )}
      <GlobalSyncOverlay />
      <UpdateNotification
        visible={showUpdateModal}
        onClose={handleUpdateModalClose}
        updateInfo={updateInfo}
      />
      <ForceLogoutModal
        visible={showForceLogoutModal}
        message={forceLogoutMessage}
        onOK={handleForceLogoutOK}
      />
      <StatusBar style="light" />
    </NavigationContainer>
  </ErrorBoundary>
);
}
