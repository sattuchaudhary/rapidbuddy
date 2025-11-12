const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UsageHistory = require('../models/UsageHistory');

async function trackDataDownload(subscription, recordCount) {
  try {
    const updatedSub = await UserSubscription.findByIdAndUpdate(
      subscription._id,
      { $inc: { dataDownloaded: recordCount } },
      { new: true }
    ).populate('planId');
    logUsageEvent(updatedSub, 'download', { recordCount });
    await checkAndAlert(updatedSub, 'dataDownloads');
    console.info(`Tracked data download: ${recordCount} records for tenant ${subscription.tenantId}, user ${subscription.mobileUserId}`);
    return updatedSub;
  } catch (error) {
    console.error(`Error tracking data download for subscription ${subscription._id}:`, error);
    return subscription;
  }
}

async function trackAPICall(subscription) {
  try {
    const updatedSub = await UserSubscription.findByIdAndUpdate(
      subscription._id,
      { $inc: { apiCallsCount: 1 } },
      { new: true }
    ).populate('planId');
    logUsageEvent(updatedSub, 'api_call', {});
    await checkAndAlert(updatedSub, 'apiCalls');
    console.info(`Tracked API call for tenant ${subscription.tenantId}, user ${subscription.mobileUserId}`);
    return updatedSub;
  } catch (error) {
    console.error(`Error tracking API call for subscription ${subscription._id}:`, error);
    return subscription;
  }
}

function checkLimit(subscription, limitType, requestedAmount = 1) {
  try {
    if (!subscription.planId || !subscription.populated('planId')) {
      return { allowed: true, reason: 'no_plan' };
    }
    const plan = subscription.planId;
    const limit = limitType === 'dataDownloads' ? plan.limits.maxDataDownloads : plan.limits.maxAPIcalls;
    if (limit === -1) {
      return { allowed: true, unlimited: true, limit: -1, current: subscription.dataDownloaded, remaining: -1, requested: requestedAmount, reason: 'unlimited' };
    }
    const current = limitType === 'dataDownloads' ? subscription.dataDownloaded : subscription.apiCallsCount;
    const remaining = limit - current;
    const allowed = requestedAmount <= remaining;
    const reason = allowed ? 'within_limit' : 'limit_exceeded';
    return { allowed, limit, current, remaining, requested: requestedAmount, reason };
  } catch (error) {
    console.error(`Error checking limit for subscription ${subscription._id}:`, error);
    return { allowed: true, reason: 'error' };
  }
}

async function resetUsage(subscription) {
  try {
    const previousDataDownloaded = subscription.dataDownloaded;
    const previousApiCallsCount = subscription.apiCallsCount;
    subscription.dataDownloaded = 0;
    subscription.apiCallsCount = 0;
    subscription.lastUsageReset = new Date();
    await subscription.save();
    logUsageEvent(subscription, 'reset', { previousDataDownloaded, previousApiCallsCount });
    console.info(`Reset usage for tenant ${subscription.tenantId}, user ${subscription.mobileUserId}`);
    return subscription;
  } catch (error) {
    console.error(`Error resetting usage for subscription ${subscription._id}:`, error);
    return subscription;
  }
}

async function checkAndAlert(subscription, limitType) {
  try {
    if (!subscription.planId || !subscription.populated('planId')) {
      return { alerted: false, level: null, percentage: 0, message: 'No plan' };
    }
    const plan = subscription.planId;
    const limit = limitType === 'dataDownloads' ? plan.limits.maxDataDownloads : plan.limits.maxAPIcalls;
    if (limit === -1) {
      return { alerted: false, level: null, percentage: 0, message: 'Unlimited' };
    }
    const current = limitType === 'dataDownloads' ? subscription.dataDownloaded : subscription.apiCallsCount;
    const percentage = calculateUsagePercentage(current, limit);
    let level = null;
    let alerted = false;
    if (percentage >= 100) {
      level = 'exceeded';
      alerted = true;
    } else if (percentage >= 90) {
      level = 'critical';
      alerted = true;
    } else if (percentage >= 80) {
      level = 'warning';
      alerted = true;
    }
    if (alerted) {
      console.warn(`Usage alert for ${limitType}: ${percentage}% (${current}/${limit}) for tenant ${subscription.tenantId}, user ${subscription.mobileUserId}`);
      logUsageEvent(subscription, 'alert', { limitType, percentage, level, current, limit });
    }
    return { alerted, level, percentage, message: `Usage at ${percentage}% for ${limitType}` };
  } catch (error) {
    console.error(`Error checking alert for subscription ${subscription._id}:`, error);
    return { alerted: false, level: null, percentage: 0, message: 'Error' };
  }
}

function getUsageStats(subscription) {
  try {
    if (!subscription.planId || !subscription.populated('planId')) {
      return {
        dataDownloads: { current: subscription.dataDownloaded, limit: null, remaining: null, percentage: null, unlimited: false },
        apiCalls: { current: subscription.apiCallsCount, limit: null, remaining: null, percentage: null, unlimited: false },
        lastReset: subscription.lastUsageReset,
        periodEnd: subscription.currentPeriodEnd,
        daysRemaining: subscription.getRemainingDays()
      };
    }
    const plan = subscription.planId;
    const dataLimit = plan.limits.maxDataDownloads;
    const apiLimit = plan.limits.maxAPIcalls;
    const dataCurrent = subscription.dataDownloaded;
    const apiCurrent = subscription.apiCallsCount;
    return {
      dataDownloads: {
        current: dataCurrent,
        limit: dataLimit,
        remaining: dataLimit === -1 ? -1 : dataLimit - dataCurrent,
        percentage: calculateUsagePercentage(dataCurrent, dataLimit),
        unlimited: dataLimit === -1
      },
      apiCalls: {
        current: apiCurrent,
        limit: apiLimit,
        remaining: apiLimit === -1 ? -1 : apiLimit - apiCurrent,
        percentage: calculateUsagePercentage(apiCurrent, apiLimit),
        unlimited: apiLimit === -1
      },
      lastReset: subscription.lastUsageReset,
      periodEnd: subscription.currentPeriodEnd,
      daysRemaining: subscription.getRemainingDays()
    };
  } catch (error) {
    console.error(`Error getting usage stats for subscription ${subscription._id}:`, error);
    return {
      dataDownloads: { current: 0, limit: 0, remaining: 0, percentage: 0, unlimited: false },
      apiCalls: { current: 0, limit: 0, remaining: 0, percentage: 0, unlimited: false },
      lastReset: null,
      periodEnd: null,
      daysRemaining: 0
    };
  }
}

function logUsageEvent(subscription, eventType, metadata) {
  try {
    const usageSnapshot = {
      dataDownloaded: subscription.dataDownloaded,
      apiCallsCount: subscription.apiCallsCount,
      dataLimit: subscription.planId ? subscription.planId.limits.maxDataDownloads : null,
      apiLimit: subscription.planId ? subscription.planId.limits.maxAPIcalls : null
    };
    const historyDoc = new UsageHistory({
      tenantId: subscription.tenantId,
      mobileUserId: subscription.mobileUserId,
      userType: subscription.userType,
      eventType,
      metadata,
      usageSnapshot,
      timestamp: new Date()
    });
    historyDoc.save().catch(err => console.error('Error saving usage history:', err));
  } catch (error) {
    console.error('Error logging usage event:', error);
  }
}

function calculateUsagePercentage(current, limit) {
  if (limit === -1) return 0;
  if (limit === 0) return 100;
  return Math.min(100, (current / limit) * 100);
}

module.exports = { trackDataDownload, trackAPICall, checkLimit, resetUsage, checkAndAlert, getUsageStats };