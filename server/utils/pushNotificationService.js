const https = require('https');
const http = require('http');
const DeviceToken = require('../models/DeviceToken');

/**
 * Send push notification using Expo Push Notification Service
 * @param {Array} tokens - Array of Expo push tokens
 * @param {Object} notification - Notification object with title, body, data
 * @returns {Promise<Object>} Result of sending notifications
 */
async function sendPushNotification(tokens, notification) {
  if (!tokens || tokens.length === 0) {
    console.log('No tokens provided for push notification');
    return { success: false, message: 'No tokens provided' };
  }

  // Validate notification object
  if (!notification || !notification.title || !notification.body) {
    console.error('Invalid notification object:', notification);
    return { success: false, message: 'Invalid notification object' };
  }

  // Prepare messages for Expo Push API
  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    priority: notification.priority || 'high',
    channelId: notification.channelId || 'default',
    badge: notification.badge,
    ...(notification.image && { image: notification.image })
  }));

  try {
    // Use native https module to send to Expo Push Notification Service
    const postData = JSON.stringify(messages);
    
    const options = {
      hostname: 'exp.host',
      port: 443,
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const results = response?.data || [];
            const successCount = results.filter(r => r.status === 'ok').length;
            const errorCount = results.filter(r => r.status === 'error').length;

            console.log(`📲 Push notification sent: ${successCount} successful, ${errorCount} failed`);

            // Log errors if any
            results.forEach((result, index) => {
              if (result.status === 'error') {
                console.error(`❌ Push notification error for token ${tokens[index]}:`, result.message);
              }
            });

            resolve({
              success: successCount > 0,
              successCount,
              errorCount,
              results
            });
          } catch (parseError) {
            console.error('❌ Error parsing push notification response:', parseError);
            resolve({
              success: false,
              message: parseError.message,
              error: parseError.message
            });
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Error sending push notifications:', error.message);
        resolve({
          success: false,
          message: error.message,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        console.error('❌ Push notification request timeout');
        resolve({
          success: false,
          message: 'Request timeout',
          error: 'Request timeout'
        });
      });

      req.setTimeout(10000);
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('❌ Error sending push notifications:', error.message);
    return Promise.resolve({
      success: false,
      message: error.message,
      error: error.message
    });
  }
}

/**
 * Send push notification to all active devices for a tenant
 * @param {String} tenantId - Tenant ID
 * @param {Object} notification - Notification object
 * @returns {Promise<Object>} Result of sending notifications
 */
async function sendNotificationToTenant(tenantId, notification) {
  try {
    // Get all active device tokens for the tenant
    const devices = await DeviceToken.getActiveTokensForTenant(tenantId);
    
    if (devices.length === 0) {
      console.log(`No active devices found for tenant ${tenantId}`);
      return { success: false, message: 'No active devices found', count: 0 };
    }

    // Extract tokens
    const tokens = devices.map(device => device.token).filter(Boolean);
    
    if (tokens.length === 0) {
      console.log(`No valid tokens found for tenant ${tenantId}`);
      return { success: false, message: 'No valid tokens found', count: 0 };
    }

    console.log(`📤 Sending notification to ${tokens.length} devices for tenant ${tenantId}`);

    // Send notifications
    const result = await sendPushNotification(tokens, notification);
    
    return {
      ...result,
      deviceCount: tokens.length,
      tenantId
    };
  } catch (error) {
    console.error('Error sending notification to tenant:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
}

/**
 * Send push notification to a specific user
 * @param {String} userId - User ID
 * @param {Object} notification - Notification object
 * @returns {Promise<Object>} Result of sending notifications
 */
async function sendNotificationToUser(userId, notification) {
  try {
    // Get all active device tokens for the user
    const devices = await DeviceToken.getActiveTokensForUser(userId);
    
    if (devices.length === 0) {
      console.log(`No active devices found for user ${userId}`);
      return { success: false, message: 'No active devices found', count: 0 };
    }

    // Extract tokens
    const tokens = devices.map(device => device.token).filter(Boolean);
    
    if (tokens.length === 0) {
      console.log(`No valid tokens found for user ${userId}`);
      return { success: false, message: 'No valid tokens found', count: 0 };
    }

    console.log(`📤 Sending notification to ${tokens.length} devices for user ${userId}`);

    // Send notifications
    const result = await sendPushNotification(tokens, notification);
    
    return {
      ...result,
      deviceCount: tokens.length,
      userId
    };
  } catch (error) {
    console.error('Error sending notification to user:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
}

/**
 * Create notification object for file upload
 * @param {String} fileName - Name of uploaded file
 * @param {String} vehicleType - Type of vehicle data
 * @param {Number} recordCount - Number of records uploaded
 * @returns {Object} Notification object
 */
function createFileUploadNotification(fileName, vehicleType, recordCount) {
  const vehicleTypeMap = {
    'TwoWheeler': 'Two Wheeler',
    'FourWheeler': 'Four Wheeler',
    'Commercial': 'Commercial Vehicle'
  };

  const displayVehicleType = vehicleTypeMap[vehicleType] || vehicleType;
  
  return {
    title: `📁 New Data Uploaded`,
    body: `${fileName}\n${displayVehicleType} data uploaded (${recordCount} records)\n\nDownload in your app for fast access! 🚀`,
    data: {
      type: 'file_upload',
      fileName,
      vehicleType,
      recordCount,
      timestamp: new Date().toISOString()
    },
    priority: 'high',
    channelId: 'file_uploads',
    badge: 1
  };
}

module.exports = {
  sendPushNotification,
  sendNotificationToTenant,
  sendNotificationToUser,
  createFileUploadNotification
};

