const express = require('express');
const router = express.Router();
const UserSubscription = require('../models/UserSubscription');
const Payment = require('../models/Payment');
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');
const { authenticateToken } = require('../middleware/auth');

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
    // Get tenant DB connection
    const { getTenantDB } = require('../config/database');
    const conn = await getTenantDB(tenantName);
    // Get dynamic models
  const { getRepoAgentModel, getOfficeStaffModel } = require('./tenantUsers');
    const RepoAgent = getRepoAgentModel(conn);
    const OfficeStaff = getOfficeStaffModel(conn);

    // Enhance each subscription with user name and mobile
    const enhancedList = await Promise.all(list.map(async (sub) => {
      let user = null;
      try {
        const userId = String(sub.mobileUserId);
        if (sub.userType === 'repo_agent') {
          user = await RepoAgent.findOne({ $or: [
            { _id: userId },
            { agentId: userId }
          ] }).lean();
        } else if (sub.userType === 'office_staff') {
          user = await OfficeStaff.findOne({ $or: [
            { _id: userId },
            { staffId: userId }
          ] }).lean();
        }
      } catch (lookupErr) {
        console.error('User lookup failed for subscription:', sub, lookupErr);
      }
      return {
        ...sub,
        userName: user?.name || '',
        userMobile: user?.phoneNumber || '',
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

module.exports = router;


