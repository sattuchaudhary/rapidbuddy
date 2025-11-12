/**
 * Subscription Controller for Tenant Users
 *
 * Purpose: Manage subscription lifecycle for tenant users (repo agents, office staff).
 * Simplified approach: Uses billing cycle only, no plan catalog dependencies.
 * Tenant pricing: Configured via tenant.settings.paymentConfig.planPrices.
 * Plan tiers: Managed at tenant level via tenant.subscription.plan field.
 */

const UserSubscription = require('../models/UserSubscription');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment'); // for reference only

// Helper Utilities

// Deprecated: Proration not needed for simple tenant subscriptions
/*
function calculateProratedAmount(currentPlan, newPlan, remainingDays, totalDays, billingCycle) {
  if (remainingDays <= 0 || totalDays <= 0) {
    const newPlanPrice = newPlan.getPriceForPeriod(billingCycle);
    return {
      unusedValue: 0,
      newPlanPrice: Math.round(newPlanPrice * 100) / 100,
      proratedCharge: Math.round(newPlanPrice * 100) / 100,
      creditApplied: 0
    };
  }
  const unusedValue = (remainingDays / totalDays) * currentPlan.getPriceForPeriod(billingCycle);
  const newPlanPrice = newPlan.getPriceForPeriod(billingCycle);
  const proratedCharge = Math.max(0, newPlanPrice - unusedValue);
  return {
    unusedValue: Math.round(unusedValue * 100) / 100,
    newPlanPrice: Math.round(newPlanPrice * 100) / 100,
    proratedCharge: Math.round(proratedCharge * 100) / 100,
    creditApplied: Math.round(unusedValue * 100) / 100
  };
}
*/

function calculateNextPeriodEnd(startDate, billingCycle) {
  const start = new Date(startDate);
  let end;
  switch (billingCycle) {
    case 'weekly':
      end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
      // Simple handling for month-end: if start day > 28, set to 28th of next month
      if (start.getDate() > 28) {
        end.setDate(28);
      }
      break;
    case 'quarterly':
      end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
      break;
    case 'yearly':
      end = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      throw new Error('Invalid billing cycle');
  }
  return end;
}

function validateStatusTransition(currentStatus, newStatus) {
  const validTransitions = {
    trial: ['active', 'cancelled', 'expired'],
    active: ['grace_period', 'cancelled', 'suspended', 'expired'],
    grace_period: ['active', 'past_due', 'cancelled'],
    past_due: ['active', 'expired', 'suspended'],
    expired: ['active'],
    suspended: ['active'],
    cancelled: ['active']
  };
  const isValid = validTransitions[currentStatus] && validTransitions[currentStatus].includes(newStatus);
  const message = isValid ? '' : `Invalid transition from ${currentStatus} to ${newStatus}`;
  return { isValid, message };
}

function getDefaultGracePeriodDays() {
  return 7;
}

// Deprecated: Not needed for tenant user subscriptions
/*
async function resolvePlanReference(planCodeOrId) {
  try {
    if (/^[a-f\d]{24}$/i.test(planCodeOrId)) {
      return await SubscriptionPlan.findById(planCodeOrId);
    } else {
      return await SubscriptionPlan.findByCode(planCodeOrId);
    }
  } catch (error) {
    console.error('Error resolving plan reference:', error);
    return null;
  }
}
*/

// Core Controller Functions

async function createSubscription(tenantId, mobileUserId, userType, planCode, billingCycle, options = {}) {
  // planCode parameter kept for backward compatibility but not used
  try {
    if (!tenantId || !mobileUserId || !userType || !billingCycle) {
      return { success: false, error: 'Missing required parameters', code: 'VALIDATION_ERROR' };
    }
    const existing = await UserSubscription.findOne({ tenantId, mobileUserId });
    if (existing) {
      return { success: false, error: 'Subscription already exists for this tenant and user', code: 'VALIDATION_ERROR' };
    }
    const currentPeriodStart = options.startDate || new Date();
    const currentPeriodEnd = calculateNextPeriodEnd(currentPeriodStart, billingCycle);
    let status = 'active';
    let trialEnd = null;
    if (options.isTrial) {
      status = 'trial';
      const trialDays = options.trialDays || 14;
      trialEnd = new Date(currentPeriodStart.getTime() + trialDays * 24 * 60 * 60 * 1000);
    }
    const subscription = new UserSubscription({
      tenantId,
      mobileUserId,
      userType,
      planId: null,
      billingCycle,
      status,
      startDate: currentPeriodStart,
      endDate: currentPeriodEnd,
      currentPeriodStart,
      currentPeriodEnd,
      autoRenew: true,
      trialEnd,
      lastPaymentId: options.paymentId,
      dataDownloaded: 0,
      apiCallsCount: 0,
      lastUsageReset: currentPeriodStart
    });
    await subscription.save();
    console.info(`Subscription created: ${subscription._id}, tenant: ${tenantId}, user: ${mobileUserId}, status: ${status}`);
    return { success: true, subscription, message: 'Subscription created successfully' };
  } catch (error) {
    console.error('Error creating subscription:', error);
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

// DEPRECATED: Upgrade/downgrade functions not used for tenant user subscriptions
/*
async function upgradeSubscription(subscriptionId, newPlanCode, options = {}) {
  try {
    if (!subscriptionId || !newPlanCode) {
      return { success: false, error: 'Missing required parameters', code: 'VALIDATION_ERROR' };
    }
    const subscription = await UserSubscription.findById(subscriptionId).populate('planId');
    if (!subscription) {
      return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' };
    }
    if (!['active', 'trial'].includes(subscription.status)) {
      return { success: false, error: 'Subscription is not in an upgradeable state', code: 'INVALID_STATE' };
    }
    const currentPlan = subscription.planId;
    if (!currentPlan) {
      return { success: false, error: 'Current plan not found', code: 'INVALID_PLAN' };
    }
    const newPlan = await resolvePlanReference(newPlanCode);
    if (!newPlan || !newPlan.isActive) {
      return { success: false, error: 'Invalid or inactive new plan', code: 'INVALID_PLAN' };
    }
    if (!currentPlan.canUpgradeTo(newPlan)) {
      return { success: false, error: 'Invalid upgrade path', code: 'VALIDATION_ERROR' };
    }
    const immediate = options.immediate !== false;
    let proration = null;
    if (immediate) {
      const remainingDays = subscription.getRemainingDays();
      const totalDays = Math.ceil((subscription.currentPeriodEnd - subscription.currentPeriodStart) / (1000 * 60 * 60 * 24));
      const billingCycle = options.billingCycle || subscription.billingCycle;
      proration = calculateProratedAmount(currentPlan, newPlan, remainingDays, totalDays, billingCycle);
    }
    subscription.planId = newPlan._id;
    if (immediate) {
      if (subscription.status === 'trial') subscription.status = 'active';
    } else {
      subscription.metadata = subscription.metadata || {};
      subscription.metadata.scheduledPlanChange = { planId: newPlan._id, effectiveDate: subscription.currentPeriodEnd };
    }
    if (options.billingCycle) subscription.billingCycle = options.billingCycle;
    if (options.paymentId) subscription.lastPaymentId = options.paymentId;
    subscription.cancelledAt = null;
    subscription.cancelReason = null;
    subscription.cancelAtPeriodEnd = false;
    await subscription.save();
    console.info(`Subscription upgraded: ${subscriptionId}, tenant: ${subscription.tenantId}, user: ${subscription.mobileUserId}, old status: ${subscription.status}, new plan: ${newPlanCode}`);
    return { success: true, subscription, proration, message: immediate ? 'Subscription upgraded successfully' : 'Subscription upgrade scheduled' };
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

async function downgradeSubscription(subscriptionId, newPlanCode, options = {}) {
  try {
    if (!subscriptionId || !newPlanCode) {
      return { success: false, error: 'Missing required parameters', code: 'VALIDATION_ERROR' };
    }
    const subscription = await UserSubscription.findById(subscriptionId).populate('planId');
    if (!subscription) {
      return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' };
    }
    if (subscription.status !== 'active') {
      return { success: false, error: 'Subscription is not in a downgradeable state', code: 'INVALID_STATE' };
    }
    const currentPlan = subscription.planId;
    if (!currentPlan) {
      return { success: false, error: 'Current plan not found', code: 'INVALID_PLAN' };
    }
    const newPlan = await resolvePlanReference(newPlanCode);
    if (!newPlan || !newPlan.isActive) {
      return { success: false, error: 'Invalid or inactive new plan', code: 'INVALID_PLAN' };
    }
    if (!currentPlan.canDowngradeTo(newPlan)) {
      return { success: false, error: 'Invalid downgrade path', code: 'VALIDATION_ERROR' };
    }
    const immediate = options.immediate || false;
    const effectiveDate = options.effectiveDate || subscription.currentPeriodEnd;
    if (immediate) {
      subscription.planId = newPlan._id;
      // Proration calculation if needed, but not returned
    } else {
      subscription.metadata = subscription.metadata || {};
      subscription.metadata.scheduledPlanChange = { planId: newPlan._id, effectiveDate };
    }
    if (options.billingCycle) subscription.billingCycle = options.billingCycle;
    await subscription.save();
    console.info(`Subscription downgraded: ${subscriptionId}, tenant: ${subscription.tenantId}, user: ${subscription.mobileUserId}, new plan: ${newPlanCode}`);
    return { success: true, subscription, scheduledFor: immediate ? null : effectiveDate, message: immediate ? 'Subscription downgraded successfully' : 'Subscription downgrade scheduled' };
  } catch (error) {
    console.error('Error downgrading subscription:', error);
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}
*/

async function cancelSubscription(subscriptionId, reason, options = {}) {
  try {
    if (!subscriptionId || !reason) {
      return { success: false, error: 'Missing required parameters', code: 'VALIDATION_ERROR' };
    }
    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' };
    }
    if (!['active', 'trial', 'grace_period'].includes(subscription.status)) {
      return { success: false, error: 'Subscription is not in a cancellable state', code: 'INVALID_STATE' };
    }
    const transition = validateStatusTransition(subscription.status, 'cancelled');
    if (!transition.isValid) {
      return { success: false, error: transition.message, code: 'INVALID_TRANSITION' };
    }
    const immediate = options.immediate || false;
    const cancelAtPeriodEnd = options.cancelAtPeriodEnd !== false;
    if (immediate) {
      subscription.status = 'cancelled';
      subscription.currentPeriodEnd = new Date();
      subscription.endDate = new Date();
    } else if (cancelAtPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
    }
    subscription.cancelledAt = new Date();
    subscription.cancelReason = reason.trim().substring(0, 500);
    subscription.autoRenew = false;
    await subscription.save();
    console.info(`Subscription cancelled: ${subscriptionId}, tenant: ${subscription.tenantId}, user: ${subscription.mobileUserId}, immediate: ${immediate}`);
    return { success: true, subscription, accessUntil: immediate ? new Date() : subscription.currentPeriodEnd, message: immediate ? 'Subscription cancelled' : 'Subscription will be cancelled at period end' };
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

async function reactivateSubscription(subscriptionId, planCode, billingCycle, options = {}) {
  // planCode parameter kept for backward compatibility but not used
  try {
    if (!subscriptionId || !billingCycle) {
      return { success: false, error: 'Missing required parameters', code: 'VALIDATION_ERROR' };
    }
    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' };
    }
    if (!['cancelled', 'expired', 'suspended'].includes(subscription.status)) {
      return { success: false, error: 'Subscription is not in a reactivatable state', code: 'INVALID_STATE' };
    }
    const transition = validateStatusTransition(subscription.status, 'active');
    if (!transition.isValid) {
      return { success: false, error: transition.message, code: 'INVALID_TRANSITION' };
    }
    const currentPeriodStart = options.startDate || new Date();
    const currentPeriodEnd = calculateNextPeriodEnd(currentPeriodStart, billingCycle);
    subscription.status = 'active';
    subscription.planId = null;
    subscription.billingCycle = billingCycle;
    subscription.currentPeriodStart = currentPeriodStart;
    subscription.currentPeriodEnd = currentPeriodEnd;
    subscription.endDate = currentPeriodEnd;
    subscription.autoRenew = true;
    subscription.cancelledAt = null;
    subscription.cancelReason = null;
    subscription.cancelAtPeriodEnd = false;
    subscription.gracePeriodEnd = null;
    if (options.paymentId) subscription.lastPaymentId = options.paymentId;
    subscription.dataDownloaded = 0;
    subscription.apiCallsCount = 0;
    subscription.lastUsageReset = currentPeriodStart;
    await subscription.save();
    console.info(`Subscription reactivated: ${subscriptionId}, tenant: ${subscription.tenantId}, user: ${subscription.mobileUserId}`);
    return { success: true, subscription, message: 'Subscription reactivated successfully' };
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

async function extendTrial(subscriptionId, additionalDays) {
  try {
    if (!subscriptionId || typeof additionalDays !== 'number' || additionalDays <= 0) {
      return { success: false, error: 'Invalid parameters', code: 'VALIDATION_ERROR' };
    }
    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' };
    }
    if (subscription.status !== 'trial') {
      return { success: false, error: 'Subscription is not in trial', code: 'INVALID_STATE' };
    }
    const baseDate = subscription.trialEnd || subscription.currentPeriodEnd;
    const newTrialEnd = new Date(baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);
    subscription.trialEnd = newTrialEnd;
    subscription.currentPeriodEnd = newTrialEnd;
    subscription.endDate = newTrialEnd;
    await subscription.save();
    console.info(`Trial extended: ${subscriptionId}, tenant: ${subscription.tenantId}, user: ${subscription.mobileUserId}, new end: ${newTrialEnd}`);
    return { success: true, subscription, newTrialEnd, message: 'Trial extended successfully' };
  } catch (error) {
    console.error('Error extending trial:', error);
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

async function suspendSubscription(subscriptionId, reason) {
  try {
    if (!subscriptionId || !reason) {
      return { success: false, error: 'Missing required parameters', code: 'VALIDATION_ERROR' };
    }
    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' };
    }
    if (!['active', 'grace_period', 'past_due'].includes(subscription.status)) {
      return { success: false, error: 'Subscription is not in a suspendable state', code: 'INVALID_STATE' };
    }
    const transition = validateStatusTransition(subscription.status, 'suspended');
    if (!transition.isValid) {
      return { success: false, error: transition.message, code: 'INVALID_TRANSITION' };
    }
    subscription.status = 'suspended';
    subscription.metadata = subscription.metadata || {};
    subscription.metadata.suspensionReason = reason;
    subscription.metadata.suspendedAt = new Date();
    subscription.autoRenew = false;
    await subscription.save();
    console.info(`Subscription suspended: ${subscriptionId}, tenant: ${subscription.tenantId}, user: ${subscription.mobileUserId}`);
    return { success: true, subscription, message: 'Subscription suspended' };
  } catch (error) {
    console.error('Error suspending subscription:', error);
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

// Additional Helper Functions

async function enterGracePeriod(subscriptionId, paymentFailureReason) {
  try {
    if (!subscriptionId) {
      return { success: false, error: 'Missing subscription ID', code: 'VALIDATION_ERROR' };
    }
    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' };
    }
    if (!['active', 'past_due'].includes(subscription.status)) {
      return { success: false, error: 'Subscription is not eligible for grace period', code: 'INVALID_STATE' };
    }
    const transition = validateStatusTransition(subscription.status, 'grace_period');
    if (!transition.isValid) {
      return { success: false, error: transition.message, code: 'INVALID_TRANSITION' };
    }
    const gracePeriodEnd = new Date(subscription.currentPeriodEnd.getTime() + getDefaultGracePeriodDays() * 24 * 60 * 60 * 1000);
    subscription.status = 'grace_period';
    subscription.gracePeriodEnd = gracePeriodEnd;
    subscription.metadata = subscription.metadata || {};
    subscription.metadata.paymentFailureReason = paymentFailureReason;
    subscription.metadata.gracePeriodStarted = new Date();
    await subscription.save();
    console.info(`Entered grace period: ${subscriptionId}, tenant: ${subscription.tenantId}, user: ${subscription.mobileUserId}, end: ${gracePeriodEnd}`);
    return { success: true, subscription, gracePeriodEnd, message: 'Subscription entered grace period' };
  } catch (error) {
    console.error('Error entering grace period:', error);
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

async function renewSubscription(subscriptionId, options = {}) {
  try {
    if (!subscriptionId) {
      return { success: false, error: 'Missing subscription ID', code: 'VALIDATION_ERROR' };
    }
    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' };
    }
    if (!['active', 'grace_period'].includes(subscription.status)) {
      return { success: false, error: 'Subscription is not renewable', code: 'INVALID_STATE' };
    }
    const newPeriodStart = subscription.currentPeriodEnd;
    const newBillingCycle = options.newBillingCycle || subscription.billingCycle;
    const newPeriodEnd = calculateNextPeriodEnd(newPeriodStart, newBillingCycle);
    subscription.currentPeriodStart = newPeriodStart;
    subscription.currentPeriodEnd = newPeriodEnd;
    subscription.endDate = newPeriodEnd;
    if (subscription.status === 'grace_period') subscription.status = 'active';
    subscription.gracePeriodEnd = null;
    if (options.paymentId) subscription.lastPaymentId = options.paymentId;
    subscription.dataDownloaded = 0;
    subscription.apiCallsCount = 0;
    subscription.lastUsageReset = newPeriodStart;
    if (options.newBillingCycle) subscription.billingCycle = options.newBillingCycle;
    await subscription.save();
    console.info(`Subscription renewed: ${subscriptionId}, tenant: ${subscription.tenantId}, user: ${subscription.mobileUserId}, new end: ${newPeriodEnd}`);
    return { success: true, subscription, newPeriodEnd, message: 'Subscription renewed successfully' };
  } catch (error) {
    console.error('Error renewing subscription:', error);
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

module.exports = {
  createSubscription,
  cancelSubscription,
  reactivateSubscription,
  extendTrial,
  suspendSubscription,
  enterGracePeriod,
  renewSubscription,
  validateStatusTransition
};
