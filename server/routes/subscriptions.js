const express = require('express');
const router = express.Router();
const UserSubscription = require('../models/UserSubscription');
const Payment = require('../models/Payment');
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');
const { authenticateToken } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');
const { requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');

// Helper to get tenantId from either unified/mobile token or web admin token
function getTenantContext(req) {
  const tenantId = req.user?.tenantId || req.query.tenantId || req.body.tenantId;
  return tenantId || null;
}

// Middleware that accepts either auth style
async function tenantAuth(req, res, next) {
  // If already authenticated from previous middleware, continue
  if (req.user) return next();
  // Try unified then web auth
  try { await authenticateUnifiedToken(req, res, () => {}); } catch (_) {}
  if (!req.user) {
    try { await authenticateToken(req, res, () => {}); } catch (_) {}
  }
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const tenantId = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
  next();
}

// Audit logging helper function
function logAdminAction(action, req, subscription, details = {}) {
  const adminId = req.user._id;
  const adminEmail = req.user.email;
  const adminRole = req.user.role;
  const adminName = req.user.getFullName();
  const subscriptionId = subscription ? subscription._id : null;
  const tenantId = subscription ? subscription.tenantId : null;
  const mobileUserId = subscription ? subscription.mobileUserId : null;
  const status = subscription ? subscription.status : null;
  const planId = subscription ? subscription.planId : null;
  const timestamp = new Date().toISOString();
  console.info(`[ADMIN_ACTION][${action}] Admin ${adminEmail} performed ${action} on subscription ${subscriptionId}`, {
    timestamp,
    action,
    admin: { id: adminId, email: adminEmail, role: adminRole, name: adminName },
    subscription: { id: subscriptionId, tenantId, mobileUserId, status, planId },
    details
  });
}

// Tenant authorization helper
function checkTenantAuthorization(req, targetTenantId) {
  if (req.user.role === 'super_admin') {
    return true;
  }
  if (req.user.role === 'admin') {
    return req.user.tenantId.toString() === targetTenantId.toString();
  }
  return false;
}

// Validation helper
function validateAdminRequest(req, requiredFields) {
  const missing = [];
  for (const field of requiredFields) {
    if (!req.body[field]) {
      missing.push(field);
    }
  }
  return { valid: missing.length === 0, missing };
}

// List subscriptions for current tenant
router.get('/', tenantAuth, async (req, res) => {
  try {
    const tenantId = getTenantContext(req);
    const list = await UserSubscription.find({ tenantId }).sort({ updatedAt: -1 }).lean();

    // Get tenant name
    let tenantName = req.user?.tenantName;
    if (!tenantName && tenantId) {
      const Tenant = require('../models/Tenant');
      const tenantDoc = await Tenant.findById(tenantId);
      tenantName = tenantDoc?.name;
    }

    let conn = null;
    let RepoAgent = null;
    let OfficeStaff = null;

    try {
      // Get tenant DB connection
      const { getTenantDB } = require('../config/database');
      conn = await getTenantDB(tenantName);
    } catch (dbErr) {
      console.error('Tenant DB connection failed:', { tenantName, error: dbErr.message });
      // Return subscriptions without user details
      const enhancedList = list.map(sub => ({
        ...sub,
        userName: 'N/A',
        userMobile: 'N/A'
      }));
      return res.json({ success: true, data: enhancedList });
    }

    try {
      // Get dynamic models
      const { getRepoAgentModel, getOfficeStaffModel } = require('./tenantUsers');
      RepoAgent = getRepoAgentModel(conn);
      OfficeStaff = getOfficeStaffModel(conn);
    } catch (modelErr) {
      console.error('Model retrieval failed:', { tenantName, error: modelErr.message });
      // Return subscriptions without user details
      const enhancedList = list.map(sub => ({
        ...sub,
        userName: 'N/A',
        userMobile: 'N/A'
      }));
      return res.json({ success: true, data: enhancedList });
    }

    // Enhance each subscription with user name and mobile
    const enhancedList = await Promise.all(list.map(async (sub) => {
      if (!sub.mobileUserId) {
        return { ...sub, userName: 'N/A', userMobile: 'N/A' };
      }

      let user = null;
      try {
        const userId = String(sub.mobileUserId);
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;

        if (sub.userType === 'repo_agent') {
          user = await RepoAgent.findOne({ 
            $or: [
              ...(userObjectId ? [{ _id: userObjectId }] : []),
              { agentId: userId },
              { id: userId }
            ]
          });
        } else if (sub.userType === 'office_staff') {
          user = await OfficeStaff.findOne({
            $or: [
              ...(userObjectId ? [{ _id: userObjectId }] : []),
              { staffId: userId },
              { id: userId }
            ]
          });
        }

        // Optional success logging
        if (user) {
          console.log('User found for subscription:', { subscriptionId: sub._id, userName: user.fullName || user.name, userMobile: user.phoneNumber || user.mobile || user.phone });
        }
      } catch (lookupErr) {
        console.error('User lookup failed for subscription:', {
          subscriptionId: sub._id,
          userType: sub.userType,
          userId: sub.mobileUserId,
          userIdType: typeof sub.mobileUserId,
          isValidObjectId: mongoose.Types.ObjectId.isValid(String(sub.mobileUserId)),
          tenantName: tenantName,
          error: lookupErr.message
        });
      }

      const fullName = user?.fullName || user?.name || 'N/A';
      const mobile = user?.phoneNumber || user?.mobile || user?.phone || 'N/A';
      
      return {
        ...sub,
        userName: fullName,
        userMobile: mobile,
      };
    }));

    res.json({ success: true, data: enhancedList });
  } catch (err) {
    console.error('List subscriptions error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Pending payments for this tenant
router.get('/pending-payments', tenantAuth, async (req, res) => {
  try {
    const tenantId = getTenantContext(req);
    const items = await Payment.find({ tenantId, status: 'pending' }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('Pending payments error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get single user's subscription and payment history
router.get('/user/:mobileUserId', tenantAuth, async (req, res) => {
  try {
    const tenantId = getTenantContext(req);
    const mobileUserId = req.params.mobileUserId;
    const sub = await UserSubscription.findOne({ tenantId, mobileUserId }).lean();
    const payments = await Payment.find({ tenantId, submittedByMobileId: mobileUserId }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ success: true, data: { subscription: sub, payments } });
  } catch (err) {
    console.error('User sub details error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ENDPOINT 1: POST /admin/subscriptions (Create Subscription)
router.post('/admin/subscriptions', authenticateToken, requireAdmin, async (req, res) => {
  const requiredFields = ['tenantId', 'mobileUserId', 'userType', 'planCode', 'billingCycle'];
  const validation = validateAdminRequest(req, requiredFields);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: `Missing required fields: ${validation.missing.join(', ')}` });
  }
  if (!checkTenantAuthorization(req, req.body.tenantId)) {
    return res.status(403).json({ success: false, message: 'Access denied to this tenant' });
  }
  // Sanitize inputs
  req.body.planCode = req.body.planCode?.trim();
  req.body.userType = req.body.userType?.trim();
  req.body.billingCycle = req.body.billingCycle?.trim();
  if (req.body.startDate && isNaN(new Date(req.body.startDate))) {
    return res.status(400).json({ success: false, message: 'Invalid startDate format' });
  }
  if (!['repo_agent', 'office_staff', 'other'].includes(req.body.userType)) {
    return res.status(400).json({ success: false, message: 'Invalid userType' });
  }
  if (!['weekly', 'monthly', 'quarterly', 'yearly'].includes(req.body.billingCycle)) {
    return res.status(400).json({ success: false, message: 'Invalid billingCycle' });
  }
  const options = {
    isTrial: req.body.isTrial,
    trialDays: req.body.trialDays,
    startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
    paymentId: req.body.paymentId
  };
  const result = await subscriptionController.createSubscription(req.body.tenantId, req.body.mobileUserId, req.body.userType, req.body.planCode, req.body.billingCycle, options);
  if (!result.success) {
    const statusCode = result.code === 'VALIDATION_ERROR' ? 400 : result.code === 'INVALID_PLAN' ? 404 : 500;
    return res.status(statusCode).json({ success: false, message: result.error });
  }
  logAdminAction('SUBSCRIPTION_CREATED', req, result.subscription, { planCode: req.body.planCode, billingCycle: req.body.billingCycle, isTrial: req.body.isTrial });
  res.status(201).json({ success: true, data: result.subscription, message: result.message });
});

// ENDPOINT 2: PUT /admin/subscriptions/:id/extend (Extend Subscription)
router.put('/admin/subscriptions/:id/extend', authenticateToken, requireAdmin, async (req, res) => {
  if (!req.body.extensionDays && !req.body.newEndDate) {
    return res.status(400).json({ success: false, message: 'Either extensionDays or newEndDate is required' });
  }
  if (req.body.extensionDays && typeof req.body.extensionDays !== 'number') {
    return res.status(400).json({ success: false, message: 'extensionDays must be a number' });
  }
  if (req.body.newEndDate && isNaN(new Date(req.body.newEndDate))) {
    return res.status(400).json({ success: false, message: 'Invalid newEndDate format' });
  }
  req.body.reason = req.body.reason?.trim();
  try {
    const subscription = await UserSubscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    if (!checkTenantAuthorization(req, subscription.tenantId)) {
      return res.status(403).json({ success: false, message: 'Access denied to this tenant' });
    }
    let newEndDate;
    if (req.body.newEndDate) {
      newEndDate = new Date(req.body.newEndDate);
    } else {
      newEndDate = new Date(subscription.currentPeriodEnd.getTime() + req.body.extensionDays * 24 * 60 * 60 * 1000);
    }
    if (!req.body.override && !['active', 'trial', 'grace_period'].includes(subscription.status)) {
      return res.status(400).json({ success: false, message: 'Subscription cannot be extended. Use override flag to force.' });
    }
    subscription.currentPeriodEnd = newEndDate;
    subscription.endDate = newEndDate;
    await subscription.save();
    logAdminAction('SUBSCRIPTION_EXTENDED', req, subscription, { extensionDays: req.body.extensionDays, newEndDate: req.body.newEndDate, reason: req.body.reason, override: req.body.override });
    res.json({ success: true, data: subscription, message: 'Subscription extended successfully', newEndDate: subscription.currentPeriodEnd });
  } catch (err) {
    console.error('Extend subscription error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ENDPOINT 3: PUT /admin/subscriptions/:id/suspend (Suspend Subscription)
router.put('/admin/subscriptions/:id/suspend', authenticateToken, requireAdmin, async (req, res) => {
  const requiredFields = ['reason'];
  const validation = validateAdminRequest(req, requiredFields);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: `Missing required fields: ${validation.missing.join(', ')}` });
  }
  req.body.reason = req.body.reason.trim();
  if (req.body.reason.length > 500) {
    return res.status(400).json({ success: false, message: 'Reason must be 500 characters or less' });
  }
  try {
    const subscription = await UserSubscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    if (!checkTenantAuthorization(req, subscription.tenantId)) {
      return res.status(403).json({ success: false, message: 'Access denied to this tenant' });
    }
    let result = await subscriptionController.suspendSubscription(req.params.id, req.body.reason);
    if (!result.success && req.body.override) {
      subscription.status = 'suspended';
      subscription.metadata = subscription.metadata || {};
      subscription.metadata.suspensionReason = req.body.reason;
      subscription.metadata.suspendedAt = new Date();
      subscription.autoRenew = false;
      await subscription.save();
      result = { success: true, subscription, message: 'Subscription suspended (override)' };
    }
    if (!result.success) {
      const statusCode = result.code === 'INVALID_STATE' ? 400 : 500;
      return res.status(statusCode).json({ success: false, message: result.error });
    }
    logAdminAction('SUBSCRIPTION_SUSPENDED', req, result.subscription, { reason: req.body.reason, override: req.body.override });
    res.json({ success: true, data: result.subscription, message: result.message });
  } catch (err) {
    console.error('Suspend subscription error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ENDPOINT 4: PUT /admin/subscriptions/:id/cancel (Cancel Subscription)
router.put('/admin/subscriptions/:id/cancel', authenticateToken, requireAdmin, async (req, res) => {
  const requiredFields = ['reason'];
  const validation = validateAdminRequest(req, requiredFields);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: `Missing required fields: ${validation.missing.join(', ')}` });
  }
  req.body.reason = req.body.reason.trim();
  try {
    const subscription = await UserSubscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    if (!checkTenantAuthorization(req, subscription.tenantId)) {
      return res.status(403).json({ success: false, message: 'Access denied to this tenant' });
    }
    const options = {
      immediate: req.body.immediate || false,
      cancelAtPeriodEnd: req.body.cancelAtPeriodEnd !== false
    };
    const result = await subscriptionController.cancelSubscription(req.params.id, req.body.reason, options);
    if (!result.success) {
      const statusCode = result.code === 'INVALID_STATE' ? 400 : result.code === 'NOT_FOUND' ? 404 : 500;
      return res.status(statusCode).json({ success: false, message: result.error });
    }
    logAdminAction('SUBSCRIPTION_CANCELLED', req, result.subscription, { reason: req.body.reason, immediate: req.body.immediate, accessUntil: result.accessUntil });
    res.json({ success: true, data: result.subscription, message: result.message, accessUntil: result.accessUntil });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ENDPOINT 5: PUT /admin/subscriptions/:id/reactivate (Reactivate Subscription)
router.put('/admin/subscriptions/:id/reactivate', authenticateToken, requireAdmin, async (req, res) => {
  const requiredFields = ['planCode', 'billingCycle'];
  const validation = validateAdminRequest(req, requiredFields);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: `Missing required fields: ${validation.missing.join(', ')}` });
  }
  req.body.planCode = req.body.planCode.trim();
  req.body.billingCycle = req.body.billingCycle.trim();
  if (!['weekly', 'monthly', 'quarterly', 'yearly'].includes(req.body.billingCycle)) {
    return res.status(400).json({ success: false, message: 'Invalid billingCycle' });
  }
  if (req.body.startDate && isNaN(new Date(req.body.startDate))) {
    return res.status(400).json({ success: false, message: 'Invalid startDate format' });
  }
  if (req.body.paymentId && !require('mongoose').Types.ObjectId.isValid(req.body.paymentId)) {
    return res.status(400).json({ success: false, message: 'Invalid paymentId format' });
  }
  try {
    const subscription = await UserSubscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    if (!checkTenantAuthorization(req, subscription.tenantId)) {
      return res.status(403).json({ success: false, message: 'Access denied to this tenant' });
    }
    const options = {
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      paymentId: req.body.paymentId
    };
    const result = await subscriptionController.reactivateSubscription(req.params.id, req.body.planCode, req.body.billingCycle, options);
    if (!result.success) {
      const statusCode = result.code === 'INVALID_STATE' ? 400 : result.code === 'INVALID_PLAN' ? 404 : 500;
      return res.status(statusCode).json({ success: false, message: result.error });
    }
    logAdminAction('SUBSCRIPTION_REACTIVATED', req, result.subscription, { planCode: req.body.planCode, billingCycle: req.body.billingCycle });
    res.json({ success: true, data: result.subscription, message: result.message });
  } catch (err) {
    console.error('Reactivate subscription error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ENDPOINT 6: POST /admin/subscriptions/bulk-extend (Bulk Extend Subscriptions)
router.post('/admin/subscriptions/bulk-extend', authenticateToken, requireAdmin, async (req, res) => {
  const requiredFields = ['subscriptionIds', 'extensionDays'];
  const validation = validateAdminRequest(req, requiredFields);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: `Missing required fields: ${validation.missing.join(', ')}` });
  }
  if (!Array.isArray(req.body.subscriptionIds) || req.body.subscriptionIds.length === 0 || req.body.subscriptionIds.length > 100) {
    return res.status(400).json({ success: false, message: 'subscriptionIds must be an array with 1-100 items' });
  }
  if (typeof req.body.extensionDays !== 'number') {
    return res.status(400).json({ success: false, message: 'extensionDays must be a number' });
  }
  req.body.reason = req.body.reason?.trim();
  const unauthorizedIds = [];
  for (const id of req.body.subscriptionIds) {
    if (!require('mongoose').Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `Invalid subscription ID: ${id}` });
    }
    const sub = await UserSubscription.findById(id);
    if (sub && !checkTenantAuthorization(req, sub.tenantId)) {
      unauthorizedIds.push(id);
    }
  }
  if (unauthorizedIds.length > 0) {
    return res.status(403).json({ success: false, message: 'Access denied to some subscriptions', unauthorizedIds });
  }
  const results = [];
  let successful = 0;
  let failed = 0;
  for (const id of req.body.subscriptionIds) {
    try {
      const subscription = await UserSubscription.findById(id);
      if (!subscription) {
        results.push({ id, success: false, error: 'Not found' });
        failed++;
        continue;
      }
      if (!req.body.override && !['active', 'trial', 'grace_period'].includes(subscription.status)) {
        results.push({ id, success: false, error: 'Cannot extend this status without override' });
        failed++;
        continue;
      }
      const previousEndDate = subscription.currentPeriodEnd;
      const newEndDate = new Date(subscription.currentPeriodEnd.getTime() + req.body.extensionDays * 24 * 60 * 60 * 1000);
      subscription.currentPeriodEnd = newEndDate;
      subscription.endDate = newEndDate;
      await subscription.save();
      results.push({ id, success: true, newEndDate, previousEndDate });
      successful++;
      logAdminAction('SUBSCRIPTION_EXTENDED', req, subscription, { extensionDays: req.body.extensionDays, reason: req.body.reason, override: req.body.override });
    } catch (err) {
      results.push({ id, success: false, error: err.message });
      failed++;
    }
  }
  logAdminAction('BULK_EXTEND', req, null, { count: req.body.subscriptionIds.length, successful, failed, extensionDays: req.body.extensionDays, reason: req.body.reason });
  res.json({ success: true, message: `Extended ${successful} of ${req.body.subscriptionIds.length} subscriptions`, results, summary: { total: req.body.subscriptionIds.length, successful, failed } });
});

// ENDPOINT 7: POST /admin/subscriptions/bulk-suspend (Bulk Suspend Subscriptions)
router.post('/admin/subscriptions/bulk-suspend', authenticateToken, requireAdmin, async (req, res) => {
  const requiredFields = ['subscriptionIds', 'reason'];
  const validation = validateAdminRequest(req, requiredFields);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: `Missing required fields: ${validation.missing.join(', ')}` });
  }
  if (!Array.isArray(req.body.subscriptionIds) || req.body.subscriptionIds.length === 0 || req.body.subscriptionIds.length > 100) {
    return res.status(400).json({ success: false, message: 'subscriptionIds must be an array with 1-100 items' });
  }
  req.body.reason = req.body.reason.trim();
  if (req.body.reason.length > 500) {
    return res.status(400).json({ success: false, message: 'Reason must be 500 characters or less' });
  }
  const unauthorizedIds = [];
  for (const id of req.body.subscriptionIds) {
    if (!require('mongoose').Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `Invalid subscription ID: ${id}` });
    }
    const sub = await UserSubscription.findById(id);
    if (sub && !checkTenantAuthorization(req, sub.tenantId)) {
      unauthorizedIds.push(id);
    }
  }
  if (unauthorizedIds.length > 0) {
    return res.status(403).json({ success: false, message: 'Access denied to some subscriptions', unauthorizedIds });
  }
  const results = [];
  let successful = 0;
  let failed = 0;
  for (const id of req.body.subscriptionIds) {
    try {
      const subscription = await UserSubscription.findById(id);
      if (!subscription) {
        results.push({ id, success: false, error: 'Not found' });
        failed++;
        continue;
      }
      let result = await subscriptionController.suspendSubscription(id, req.body.reason);
      if (!result.success && req.body.override) {
        subscription.status = 'suspended';
        subscription.metadata = subscription.metadata || {};
        subscription.metadata.suspensionReason = req.body.reason;
        subscription.metadata.suspendedAt = new Date();
        subscription.autoRenew = false;
        await subscription.save();
        result = { success: true, subscription };
      }
      if (result.success) {
        results.push({ id, success: true, previousStatus: subscription.status });
        successful++;
        logAdminAction('SUBSCRIPTION_SUSPENDED', req, result.subscription, { reason: req.body.reason, override: req.body.override });
      } else {
        results.push({ id, success: false, error: result.error, previousStatus: subscription.status });
        failed++;
      }
    } catch (err) {
      results.push({ id, success: false, error: err.message });
      failed++;
    }
  }
  logAdminAction('BULK_SUSPEND', req, null, { count: req.body.subscriptionIds.length, successful, failed, reason: req.body.reason });
  res.json({ success: true, message: `Suspended ${successful} of ${req.body.subscriptionIds.length} subscriptions`, results, summary: { total: req.body.subscriptionIds.length, successful, failed } });
});

// Optional: GET /admin/subscriptions/stats
router.get('/admin/subscriptions/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'super_admin') {
      query.tenantId = req.user.tenantId;
    }
    const total = await UserSubscription.countDocuments(query);
    const byStatus = await UserSubscription.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const byPlan = await UserSubscription.aggregate([
      { $match: query },
      { $group: { _id: '$planId', count: { $sum: 1 } } }
    ]);
    const expiringSoon = await UserSubscription.countDocuments({
      ...query,
      status: { $in: ['active', 'trial'] },
      currentPeriodEnd: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    });
    res.json({ success: true, data: { total, byStatus, byPlan, expiringSoon } });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;