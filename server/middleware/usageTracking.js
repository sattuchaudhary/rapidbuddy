const UserSubscription = require('../models/UserSubscription');
const usageTracker = require('../utils/usageTracker');

// Helper function to get user subscription
async function getUserSubscription(req) {
  try {
    const tenantId = req.user.tenantId;
    const mobileUserId = req.user.agentId || req.user.staffId;
    
    if (!tenantId || !mobileUserId) {
      return null;
    }
    
    const subscription = await UserSubscription.findOne({ tenantId, mobileUserId }).populate('planId');
    return subscription;
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return null;
  }
}

// Middleware to track data downloads
function trackDataDownload(countExtractor) {
  return async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const mobileUserId = req.user.agentId || req.user.staffId;
      
      if (!tenantId || !mobileUserId) {
        console.warn('Skipping data download tracking: missing tenantId or mobileUserId');
        return next();
      }
      
      const subscription = await getUserSubscription(req);
      if (!subscription) {
        console.warn(`Skipping data download tracking: subscription not found for tenant ${tenantId}, user ${mobileUserId}`);
        return next();
      }
      
      // Intercept response to extract record count
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        const recordCount = countExtractor(data);
        // Track usage asynchronously
        setImmediate(() => {
          usageTracker.trackDataDownload(subscription, recordCount).catch(err => {
            console.error('Error tracking data download usage:', err);
          });
        });
        return originalJson(data);
      };
      
      next();
    } catch (error) {
      console.error('Error in trackDataDownload middleware:', error);
      next(); // Continue without tracking
    }
  };
}

// Middleware to track API calls
function trackAPICall() {
  return async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const mobileUserId = req.user.agentId || req.user.staffId;
      
      if (!tenantId || !mobileUserId) {
        return next();
      }
      
      const subscription = await getUserSubscription(req);
      if (!subscription) {
        console.warn(`Skipping API call tracking: subscription not found for tenant ${tenantId}, user ${mobileUserId}`);
        return next();
      }
      
      // Track after response is sent
      res.on('finish', () => {
        setImmediate(() => {
          usageTracker.trackAPICall(subscription).catch(err => {
            console.error('Error tracking API call usage:', err);
          });
        });
      });
      
      next();
    } catch (error) {
      console.error('Error in trackAPICall middleware:', error);
      next(); // Continue without tracking
    }
  };
}

// Middleware to enforce data download limits
function enforceDataDownloadLimit(amountExtractor) {
  return async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const mobileUserId = req.user.agentId || req.user.staffId;
      
      if (!tenantId || !mobileUserId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      const subscription = await getUserSubscription(req);
      if (!subscription) {
        return res.status(404).json({ success: false, message: 'Subscription not found' });
      }
      
      if (!subscription.canAccess()) {
        return res.status(402).json({ success: false, message: 'Subscription expired or suspended' });
      }
      
      const requestedAmount = amountExtractor(req);
      const limitCheck = usageTracker.checkLimit(subscription, 'dataDownloads', requestedAmount);
      
      if (!limitCheck.allowed) {
        return res.status(429).json({
          success: false,
          code: 'USAGE_LIMIT_EXCEEDED',
          message: 'Data download limit exceeded',
          limit: limitCheck.limit,
          current: limitCheck.current,
          remaining: limitCheck.remaining,
          requested: limitCheck.requested
        });
      }
      
      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('Error in enforceDataDownloadLimit middleware:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}

// Middleware to enforce API call limits
function enforceAPICallLimit() {
  return async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const mobileUserId = req.user.agentId || req.user.staffId;
      
      if (!tenantId || !mobileUserId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      const subscription = await getUserSubscription(req);
      if (!subscription) {
        return res.status(404).json({ success: false, message: 'Subscription not found' });
      }
      
      if (!subscription.canAccess()) {
        return res.status(402).json({ success: false, message: 'Subscription expired or suspended' });
      }
      
      const limitCheck = usageTracker.checkLimit(subscription, 'apiCalls', 1);
      
      if (!limitCheck.allowed) {
        return res.status(429).json({
          success: false,
          code: 'USAGE_LIMIT_EXCEEDED',
          message: 'API call limit exceeded',
          limit: limitCheck.limit,
          current: limitCheck.current,
          remaining: limitCheck.remaining,
          requested: 1
        });
      }
      
      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('Error in enforceAPICallLimit middleware:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}

// Middleware to require active subscription with usage stats
function requireActiveSubscriptionWithUsage() {
  return async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const mobileUserId = req.user.agentId || req.user.staffId;
      
      if (!tenantId || !mobileUserId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      const subscription = await getUserSubscription(req);
      if (!subscription) {
        return res.status(404).json({ success: false, message: 'Subscription not found' });
      }
      
      if (!subscription.canAccess()) {
        return res.status(402).json({ success: false, message: 'Subscription expired or suspended' });
      }
      
      const usageStats = usageTracker.getUsageStats(subscription);
      
      req.subscription = subscription;
      req.usageStats = usageStats;
      
      // Add usage info to response headers
      res.set('X-Usage-Data-Downloads', `${usageStats.dataDownloads.current}/${usageStats.dataDownloads.limit}`);
      res.set('X-Usage-API-Calls', `${usageStats.apiCalls.current}/${usageStats.apiCalls.limit}`);
      
      next();
    } catch (error) {
      console.error('Error in requireActiveSubscriptionWithUsage middleware:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}

module.exports = {
  trackDataDownload,
  trackAPICall,
  enforceDataDownloadLimit,
  enforceAPICallLimit,
  requireActiveSubscriptionWithUsage
};