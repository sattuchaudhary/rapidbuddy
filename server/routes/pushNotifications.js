const express = require('express');
const router = express.Router();
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');
const DeviceToken = require('../models/DeviceToken');
const Tenant = require('../models/Tenant');

/**
 * POST /api/mobile/register-device
 * Register device token for push notifications
 */
router.post('/register-device', authenticateUnifiedToken, async (req, res) => {
  try {
    const { token, platform, deviceId, deviceName, appVersion } = req.body;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    // Validate required fields
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Device token is required'
      });
    }

    if (!platform || !['android', 'ios', 'web'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Valid platform is required (android, ios, web)'
      });
    }

    // Validate tenant exists
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Check if token already exists
    let deviceToken = await DeviceToken.findOne({ token });

    if (deviceToken) {
      // Update existing token
      deviceToken.userId = userId;
      deviceToken.tenantId = tenantId;
      deviceToken.platform = platform;
      deviceToken.deviceId = deviceId || deviceToken.deviceId;
      deviceToken.deviceName = deviceName || deviceToken.deviceName;
      deviceToken.appVersion = appVersion || deviceToken.appVersion;
      deviceToken.isActive = true;
      deviceToken.lastUsed = new Date();
      await deviceToken.save();

      console.log(`✅ Updated device token for user ${userId} (${platform})`);
    } else {
      // Create new token
      deviceToken = await DeviceToken.create({
        token,
        userId,
        tenantId,
        platform,
        deviceId: deviceId || '',
        deviceName: deviceName || '',
        appVersion: appVersion || '',
        isActive: true,
        lastUsed: new Date()
      });

      console.log(`✅ Registered new device token for user ${userId} (${platform})`);
    }

    res.json({
      success: true,
      message: 'Device token registered successfully',
      data: {
        id: deviceToken._id,
        platform: deviceToken.platform,
        deviceName: deviceToken.deviceName
      }
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register device token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/mobile/unregister-device
 * Unregister device token (logout or app uninstall)
 */
router.post('/unregister-device', authenticateUnifiedToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.userId;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Device token is required'
      });
    }

    // Deactivate token
    const deviceToken = await DeviceToken.findOneAndUpdate(
      { token, userId },
      { isActive: false },
      { new: true }
    );

    if (!deviceToken) {
      return res.status(404).json({
        success: false,
        message: 'Device token not found'
      });
    }

    console.log(`✅ Unregistered device token for user ${userId}`);

    res.json({
      success: true,
      message: 'Device token unregistered successfully'
    });
  } catch (error) {
    console.error('Error unregistering device token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unregister device token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/mobile/devices
 * Get all registered devices for current user
 */
router.get('/devices', authenticateUnifiedToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const devices = await DeviceToken.find({ userId, isActive: true })
      .select('platform deviceName appVersion lastUsed createdAt')
      .sort({ lastUsed: -1 })
      .lean();

    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch devices',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

