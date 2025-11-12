// Fast initialization utilities to speed up app startup
import * as SecureStore from 'expo-secure-store';

// Cache for frequently accessed data
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fast token check without blocking
export const getCachedToken = async () => {
  const cacheKey = 'cached_token';
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value;
  }
  
  try {
    const token = await SecureStore.getItemAsync('token');
    cache.set(cacheKey, { value: token, timestamp: Date.now() });
    return token;
  } catch (error) {
    console.error('Error getting cached token:', error);
    return null;
  }
};

/**
 * Retrieves cached unified user data from SecureStore.
 * @returns {Promise<Object|null>} User object with fields: id, name, email, role, userType, tenantId, tenantName, or null if not found/error.
 */
export const getCachedUserData = async () => {
  const cacheKey = 'cached_user_data';
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value;
  }
  
  try {
    const userData = await SecureStore.getItemAsync('userData');
    const user = userData ? JSON.parse(userData) : null;
    cache.set(cacheKey, { value: user, timestamp: Date.now() });
    return user;
  } catch (error) {
    console.error('Error getting cached user data:', error);
    return null;
  }
};

/**
 * Retrieves cached user role and type for quick routing decisions.
 * @returns {Promise<Object|null>} Object with { role, userType }, or null if not found/error.
 */
export const getCachedUserRole = async () => {
  const cacheKey = 'cached_user_role';
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value;
  }
  
  try {
    const userData = await getCachedUserData();
    if (userData) {
      const roleData = { role: userData.role, userType: userData.userType };
      cache.set(cacheKey, { value: roleData, timestamp: Date.now() });
      return roleData;
    }
    return null;
  } catch (error) {
    console.error('Error getting cached user role:', error);
    return null;
  }
};

// Fast agent data retrieval with backward compatibility
export const getCachedAgent = async () => {
  const cacheKey = 'cached_agent';
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value;
  }
  
  try {
    let agentData = await SecureStore.getItemAsync('agent');
    if (!agentData) {
      // Fallback to 'userData' for backward compatibility
      const userData = await SecureStore.getItemAsync('userData');
      if (userData) {
        const user = JSON.parse(userData);
        agentData = JSON.stringify({
          id: user.id,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          userType: user.userType,
          tenantId: user.tenantId,
          tenantName: user.tenantName,
          status: 'active' // Assuming active
        });
      }
    }
    const agent = agentData ? JSON.parse(agentData) : null;
    cache.set(cacheKey, { value: agent, timestamp: Date.now() });
    return agent;
  } catch (error) {
    console.error('Error getting cached agent:', error);
    return null;
  }
};

// Fast settings retrieval
export const getCachedSettings = async () => {
  const cacheKey = 'cached_settings';
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value;
  }
  
  try {
    const settings = {
      syncComplete: await SecureStore.getItemAsync('sync_complete_flag') === 'true',
      lastSyncTime: await SecureStore.getItemAsync('lastSyncTime'),
      syncProgress: await SecureStore.getItemAsync('sync_progress')
    };
    
    cache.set(cacheKey, { value: settings, timestamp: Date.now() });
    return settings;
  } catch (error) {
    console.error('Error getting cached settings:', error);
    return {
      syncComplete: false,
      lastSyncTime: null,
      syncProgress: null
    };
  }
};

// Clear cache when needed
export const clearCache = () => {
  cache.clear();
};

// Preload critical data in background
export const preloadCriticalData = async () => {
  try {
    // Preload in parallel without blocking
    const [token, agent, settings, userData, userRole] = await Promise.allSettled([
      getCachedToken(),
      getCachedAgent(),
      getCachedSettings(),
      getCachedUserData(),
      getCachedUserRole()
    ]);
    
    console.log('✅ Critical data preloaded');
    return {
      token: token.status === 'fulfilled' ? token.value : null,
      agent: agent.status === 'fulfilled' ? agent.value : null,
      settings: settings.status === 'fulfilled' ? settings.value : null,
      userData: userData.status === 'fulfilled' ? userData.value : null,
      userRole: userRole.status === 'fulfilled' ? userRole.value : null
    };
  } catch (error) {
    console.error('Error preloading critical data:', error);
    return { token: null, agent: null, settings: null, userData: null, userRole: null };
  }
};