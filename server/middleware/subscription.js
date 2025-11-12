const Tenant = require('../models/Tenant');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// Helper function to fetch user subscription
async function fetchUserSubscription(req) {
  try {
    const tenantId = req.user?.tenantId || req.query.tenantId || req.body.tenantId;
    const mobileUserId = req.user?.agentId || req.user?.staffId || req.user?.userId;
    
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

// Middleware to require active subscription
const requireActiveSubscription = async (req, res, next) => {
  try {
    const subscription = await fetchUserSubscription(req);
    
    if (!subscription) {
      if (req.user?.role === 'super_admin') {
        return next();
      }
      return res.status(404).json({ success: false, code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found for this user' });
    }
    
    if (!subscription.canAccess()) {
      let errorResponse;
      switch (subscription.status) {
        case 'expired':
          errorResponse = {
            success: false,
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Your subscription has expired',
            status: subscription.status,
            endDate: subscription.effectiveEndDate,
            remainingDays: subscription.getRemainingDays()
          };
          break;
        case 'suspended':
          errorResponse = {
            success: false,
            code: 'SUBSCRIPTION_SUSPENDED',
            message: 'Your subscription has been suspended',
            status: subscription.status
          };
          break;
        case 'cancelled':
          errorResponse = {
            success: false,
            code: 'SUBSCRIPTION_CANCELLED',
            message: 'Your subscription has been cancelled',
            status: subscription.status,
            cancelledAt: subscription.cancelledAt
          };
          break;
        case 'past_due':
          errorResponse = {
            success: false,
            code: 'SUBSCRIPTION_PAST_DUE',
            message: 'Your subscription payment is past due',
            status: subscription.status
          };
          break;
        default:
          errorResponse = {
            success: false,
            code: 'SUBSCRIPTION_INACTIVE',
            message: 'Your subscription is not active',
            status: subscription.status
          };
      }
      return res.status(402).json(errorResponse);
    }
    
    req.subscription = subscription;
    
    if (subscription.isInGracePeriod()) {
      res.set('X-Subscription-Warning', 'grace-period');
      res.set('X-Grace-Period-End', subscription.gracePeriodEnd.toISOString());
      res.set('X-Days-Until-Suspension', Math.ceil((new Date(subscription.gracePeriodEnd) - new Date()) / (1000 * 60 * 60 * 24)));
    }
    
    next();
  } catch (error) {
    console.error('Error in requireActiveSubscription:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Middleware to require grace period access
const requireGracePeriodAccess = async (req, res, next) => {
  try {
    const subscription = await fetchUserSubscription(req);
    
    if (!subscription) {
      return res.status(404).json({ success: false, code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found for this user' });
    }
    
    if (!subscription.canAccess()) {
      let errorResponse;
      switch (subscription.status) {
        case 'expired':
          errorResponse = {
            success: false,
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Your subscription has expired',
            status: subscription.status,
            endDate: subscription.effectiveEndDate,
            remainingDays: subscription.getRemainingDays()
          };
          break;
        case 'suspended':
          errorResponse = {
            success: false,
            code: 'SUBSCRIPTION_SUSPENDED',
            message: 'Your subscription has been suspended',
            status: subscription.status
          };
          break;
        case 'cancelled':
          errorResponse = {
            success: false,
            code: 'SUBSCRIPTION_CANCELLED',
            message: 'Your subscription has been cancelled',
            status: subscription.status,
            cancelledAt: subscription.cancelledAt
          };
          break;
        case 'past_due':
          errorResponse = {
            success: false,
            code: 'SUBSCRIPTION_PAST_DUE',
            message: 'Your subscription payment is past due',
            status: subscription.status
          };
          break;
        default:
          errorResponse = {
            success: false,
            code: 'SUBSCRIPTION_INACTIVE',
            message: 'Your subscription is not active',
            status: subscription.status
          };
      }
      return res.status(402).json(errorResponse);
    }
    
    req.subscription = subscription;
    
    res.set('X-Subscription-Status', subscription.status);
    res.set('X-Subscription-Days-Remaining', subscription.getRemainingDays());
    
    if (subscription.isInGracePeriod()) {
      res.set('X-Subscription-Warning', 'grace-period');
      res.set('X-Grace-Period-End', subscription.gracePeriodEnd.toISOString());
      res.set('X-Days-Until-Suspension', Math.ceil((new Date(subscription.gracePeriodEnd) - new Date()) / (1000 * 60 * 60 * 24)));
    }
    
    next();
  } catch (error) {
    console.error('Error in requireGracePeriodAccess:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Middleware factory to require a specific feature
const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const subscription = await fetchUserSubscription(req);
      
      if (!subscription) {
        return res.status(404).json({ success: false, code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found for this user' });
      }
      
      if (!subscription.canAccess()) {
        let errorResponse;
        switch (subscription.status) {
          case 'expired':
            errorResponse = {
              success: false,
              code: 'SUBSCRIPTION_EXPIRED',
              message: 'Your subscription has expired',
              status: subscription.status,
              endDate: subscription.effectiveEndDate,
              remainingDays: subscription.getRemainingDays()
            };
            break;
          case 'suspended':
            errorResponse = {
              success: false,
              code: 'SUBSCRIPTION_SUSPENDED',
              message: 'Your subscription has been suspended',
              status: subscription.status
            };
            break;
          case 'cancelled':
            errorResponse = {
              success: false,
              code: 'SUBSCRIPTION_CANCELLED',
              message: 'Your subscription has been cancelled',
              status: subscription.status,
              cancelledAt: subscription.cancelledAt
            };
            break;
          case 'past_due':
            errorResponse = {
              success: false,
              code: 'SUBSCRIPTION_PAST_DUE',
              message: 'Your subscription payment is past due',
              status: subscription.status
            };
            break;
          default:
            errorResponse = {
              success: false,
              code: 'SUBSCRIPTION_INACTIVE',
              message: 'Your subscription is not active',
              status: subscription.status
            };
        }
        return res.status(402).json(errorResponse);
      }
      
      if (!subscription.planId) {
        return res.status(403).json({ success: false, code: 'PLAN_NOT_FOUND', message: 'Subscription plan not found' });
      }
      
      const plan = subscription.planId;
      const hasFeature = plan.features.some(f => f.toLowerCase().includes(featureName.toLowerCase()));
      
      if (!hasFeature) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_NOT_AVAILABLE',
          message: `Feature '${featureName}' is not available in your plan`,
          currentPlan: plan.name,
          currentFeatures: plan.features,
          requiredFeature: featureName
        });
      }
      
      req.subscription = subscription;
      req.plan = plan;
      
      next();
    } catch (error) {
      console.error('Error in requireFeature:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
};

// Middleware factory to check usage limits
const checkUsageLimit = (limitType) => {
  return async (req, res, next) => {
    try {
      const subscription = await fetchUserSubscription(req);
      
      if (!subscription) {
        return res.status(404).json({ success: false, code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found for this user' });
      }
      
      if (!subscription.canAccess()) {
        let errorResponse;
        switch (subscription.status) {
          case 'expired':
            errorResponse = {
              success: false,
              code: 'SUBSCRIPTION_EXPIRED',
              message: 'Your subscription has expired',
              status: subscription.status,
              endDate: subscription.effectiveEndDate,
              remainingDays: subscription.getRemainingDays()
            };
            break;
          case 'suspended':
            errorResponse = {
              success: false,
              code: 'SUBSCRIPTION_SUSPENDED',
              message: 'Your subscription has been suspended',
              status: subscription.status
            };
            break;
          case 'cancelled':
            errorResponse = {
              success: false,
              code: 'SUBSCRIPTION_CANCELLED',
              message: 'Your subscription has been cancelled',
              status: subscription.status,
              cancelledAt: subscription.cancelledAt
            };
            break;
          case 'past_due':
            errorResponse = {
              success: false,
              code: 'SUBSCRIPTION_PAST_DUE',
              message: 'Your subscription payment is past due',
              status: subscription.status
            };
            break;
          default:
            errorResponse = {
              success: false,
              code: 'SUBSCRIPTION_INACTIVE',
              message: 'Your subscription is not active',
              status: subscription.status
            };
        }
        return res.status(402).json(errorResponse);
      }
      
      if (!subscription.planId) {
        req.subscription = subscription;
        return next();
      }
      
      const plan = subscription.planId;
      const limit = limitType === 'dataDownloads' ? plan.limits.maxDataDownloads : plan.limits.maxAPIcalls;
      
      if (limit === -1) {
        req.subscription = subscription;
        return next();
      }
      
      const current = limitType === 'dataDownloads' ? subscription.dataDownloaded : subscription.apiCallsCount;
      const remaining = limit - current;
      
      if (remaining <= 0) {
        return res.status(429).json({
          success: false,
          code: 'USAGE_LIMIT_EXCEEDED',
          message: `${limitType} limit exceeded`,
          limit,
          current,
          remaining: 0,
          limitType
        });
      }
      
      if (remaining > 0 && remaining < limit * 0.1) {
        res.set('X-Usage-Warning', 'approaching-limit');
        res.set('X-Usage-Remaining', remaining);
        res.set('X-Usage-Percentage', Math.round((current / limit) * 100));
      }
      
      req.subscription = subscription;
      
      next();
    } catch (error) {
      console.error('Error in checkUsageLimit:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
};

// Middleware to require trial access
const requireTrialAccess = async (req, res, next) => {
  try {
    const subscription = await fetchUserSubscription(req);
    
    if (!subscription) {
      return res.status(404).json({ success: false, code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found for this user' });
    }
    
    if (subscription.status !== 'trial') {
      return res.status(403).json({
        success: false,
        code: 'NOT_IN_TRIAL',
        message: 'This endpoint is only available during trial period',
        status: subscription.status
      });
    }
    
    const now = new Date();
    if (subscription.trialEnd && new Date(subscription.trialEnd) < now) {
      return res.status(402).json({
        success: false,
        code: 'TRIAL_EXPIRED',
        message: 'Your trial period has ended',
        trialEnd: subscription.trialEnd
      });
    }
    
    req.subscription = subscription;
    
    if (subscription.trialEnd) {
      res.set('X-Trial-Days-Remaining', Math.ceil((new Date(subscription.trialEnd) - now) / (1000 * 60 * 60 * 24)));
    }
    
    next();
  } catch (error) {
    console.error('Error in requireTrialAccess:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Enhanced getRemainingTime function
const getRemainingTime = async (req, res) => {
  try {
    const subscription = await fetchUserSubscription(req);
    
    if (!subscription) {
      console.log('[getRemainingTime] No subscription found for user:', { tenantId: req.user?.tenantId, mobileUserId: req.user?.agentId || req.user?.staffId, userType: req.user?.userType });
      return res.status(200).json({
        success: true,
        data: {
          endDate: null,
          remainingMs: 0,
          status: 'not_found',
          isInGracePeriod: false,
          gracePeriodEnd: null,
          daysRemaining: 0,
          message: 'No active subscription found. Please make a payment to activate your account.'
        }
      });
    }
    
    const now = new Date();
    const endDate = subscription.effectiveEndDate;
    const remainingMs = endDate ? Math.max(0, endDate - now) : 0;
    const daysRemaining = subscription.getRemainingDays();
    
    return res.json({
      success: true,
      data: {
        endDate,
        remainingMs,
        status: subscription.status,
        isInGracePeriod: subscription.isInGracePeriod(),
        gracePeriodEnd: subscription.gracePeriodEnd,
        daysRemaining
      }
    });
  } catch (error) {
    console.error('Error in getRemainingTime:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Function to get detailed subscription status
const getSubscriptionStatus = async (req, res) => {
  try {
    const subscription = await fetchUserSubscription(req);
    
    if (!subscription) {
      return res.status(404).json({ success: false, code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found for this user' });
    }
    
    const statusResponse = {
      status: subscription.status,
      isActive: subscription.isActive(),
      canAccess: subscription.canAccess(),
      isInGracePeriod: subscription.isInGracePeriod(),
      remainingDays: subscription.getRemainingDays(),
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      billingCycle: subscription.billingCycle,
      usage: {
        dataDownloaded: subscription.dataDownloaded,
        apiCallsCount: subscription.apiCallsCount,
        lastUsageReset: subscription.lastUsageReset
      }
    };
    
    if (subscription.gracePeriodEnd) {
      statusResponse.gracePeriodEnd = subscription.gracePeriodEnd;
    }
    
    if (subscription.trialEnd) {
      statusResponse.trialEnd = subscription.trialEnd;
    }
    
    if (subscription.planId) {
      statusResponse.plan = {
        name: subscription.planId.name,
        code: subscription.planId.code,
        features: subscription.planId.features,
        limits: subscription.planId.limits
      };
    }
    
    return res.status(200).json(statusResponse);
  } catch (error) {
    console.error('Error in getSubscriptionStatus:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  requireActiveSubscription,
  requireGracePeriodAccess,
  requireFeature,
  checkUsageLimit,
  requireTrialAccess,
  getRemainingTime,
  getSubscriptionStatus
};