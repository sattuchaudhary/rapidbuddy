const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const UserSubscription = require('../models/UserSubscription');
const subscriptionController = require('./subscriptionController');
require('../models/SubscriptionPlan');
const { getTenantDB } = require('../config/database');
const { getRepoAgentModel, getOfficeStaffModel } = require('../routes/tenantUsers');

// Helper function for plan resolution
function resolvePlanForPayment(tenant, payment) {
  // Primary strategy: Use tenant.subscription.plan if it exists and is valid
  if (tenant.subscription && tenant.subscription.plan && ['basic', 'premium', 'enterprise'].includes(tenant.subscription.plan)) {
    return tenant.subscription.plan;
  }

  // Default fallback
  return 'basic';
}

// Helper function for invoice generation
async function generateInvoiceForPayment(payment) {
  try {
    const invoiceNumber = await Payment.generateInvoiceNumber();
    return { invoiceNumber, invoiceGeneratedAt: new Date() };
  } catch (error) {
    console.error('Invoice generation failed for payment:', payment._id, error);
    return null; // Invoice generation is non-critical
  }
}

// User submits a payment proof (repo agent / office staff / admin)
const submitPayment = async (req, res) => {
  try {
    const { planPeriod, amount, transactionId, notes, screenshotUrl } = req.body;
    const tenantId = req.user?.tenantId || req.body.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'tenantId required' });
    }

    // Extract user information from token
    const userType = req.user?.userType;
    const agentId = req.user?.agentId;
    const staffId = req.user?.staffId;
    const tenantNameFromToken = req.user?.tenantName;

    // Validate user type
    if (!['repo_agent', 'office_staff'].includes(userType)) {
      return res.status(400).json({ success: false, message: 'Only repo agents and office staff can submit payments through this endpoint' });
    }

    // Determine mobile user ID
    const mobileUserId = userType === 'repo_agent' ? agentId : staffId;
    if (!mobileUserId) {
      return res.status(400).json({ success: false, message: 'Mobile user ID not available in token' });
    }

    // Get tenant name
    let tenantName = tenantNameFromToken;
    if (!tenantName) {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      tenantName = tenant.name;
    }

    // Connect to tenant database
    let tenantConnection;
    try {
      tenantConnection = await getTenantDB(tenantName);
    } catch (error) {
      console.error('Tenant DB connection error:', error);
      return res.status(500).json({ success: false, message: 'Failed to connect to tenant database' });
    }

    // Get appropriate model
    let UserModel;
    try {
      UserModel = userType === 'repo_agent' ? getRepoAgentModel(tenantConnection) : getOfficeStaffModel(tenantConnection);
    } catch (error) {
      console.error('Model retrieval error:', error);
      return res.status(500).json({ success: false, message: 'Failed to retrieve user model' });
    }

    // Fetch user details
    let user;
    try {
      const queryField = userType === 'repo_agent' ? 'agentId' : 'staffId';
      // Defensive: if mobileUserId is a 24-char hex string, try findById, else use numeric field
      if (typeof mobileUserId === 'string' && /^[a-fA-F0-9]{24}$/.test(mobileUserId)) {
        user = await UserModel.findById(mobileUserId).select('name phoneNumber email role status');
      }
      if (!user) {
        user = await UserModel.findOne({ [queryField]: mobileUserId }).select('name phoneNumber email role status');
      }
    } catch (error) {
      console.error('User fetch error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch user details' });
    }

    // Validate user exists
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found in tenant database' });
    }

    // Validate user is active
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Only active users can submit payments' });
    }

    if (!['weekly', 'monthly', 'quarterly', 'yearly'].includes(planPeriod)) {
      return res.status(400).json({ success: false, message: 'Invalid planPeriod' });
    }

    // Validate transactionId format: alphanumeric and at least 6 characters
    const txn = (transactionId || '').trim();
    const txnRegex = /^[a-zA-Z0-9]{6,}$/;
    if (!txnRegex.test(txn)) {
      return res.status(400).json({ success: false, message: 'Transaction ID must be alphanumeric and at least 6 characters long' });
    }

    // Check for duplicate transactionId before creating (application-level guard)
    const existing = await Payment.findOne({ transactionId: txn });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This transaction ID has already been submitted. Please check your payment history or use a different transaction ID' });
    }

    // Fetch tenant's payment configuration
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Extract configured plan price
    const expectedAmount = tenant.settings?.paymentConfig?.planPrices?.[planPeriod];

    // Validate amount against configured price
    if (expectedAmount && expectedAmount > 0) {
      const tolerance = Math.max(5, expectedAmount * 0.02); // ±5 rupees or 2%, whichever is larger
      const minAmount = expectedAmount - tolerance;
      const maxAmount = expectedAmount + tolerance;
      if (amount < minAmount || amount > maxAmount) {
        return res.status(400).json({ success: false, message: `Invalid amount for ${planPeriod} plan. Expected: ₹${expectedAmount}, Submitted: ₹${amount}. Please verify the amount or contact support.` });
      }
    } else {
      console.warn(`No price configured for ${planPeriod} plan in tenant ${tenantId}. Allowing payment to proceed.`);
    }

    const payment = await Payment.create({
      tenantId,
      submittedByUserId: req.user?.userId || req.user?._id || undefined,
      submittedByMobileId: mobileUserId,
      submittedByName: user.name,
      submittedByPhone: user.phoneNumber,
      submittedByEmail: user.email,
      submittedByRole: user.role,
      submittedByUserType: userType,
      planPeriod,
      amount,
      transactionId: txn,
      notes,
      screenshotUrl: screenshotUrl || undefined,
      status: 'pending',
      amountValidated: expectedAmount && expectedAmount > 0 ? true : false,
      expectedAmount: expectedAmount || undefined
    });

    return res.json({ success: true, message: 'Payment submitted', data: payment });
  } catch (err) {
    console.error('submitPayment error:', err);
    // Handle Mongo duplicate key error (race condition)
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.transactionId) {
      return res.status(400).json({ success: false, message: 'This transaction ID is already in use. Please verify your transaction details' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin: list pending payments for tenant(s)
const listPayments = async (req, res) => {
  try {
    const { status = 'pending', tenantId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (tenantId) query.tenantId = tenantId;
    const items = await Payment.find(query).sort({ createdAt: -1 }).limit(200);
    return res.json({ success: true, data: items });
  } catch (err) {
    console.error('listPayments error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin approves payment: extend tenant subscription
const approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Payment already processed' });
    }

    // Fetch tenant early for user validation
    const tenant = await Tenant.findById(payment.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    // Check for user detail fields in payment (backward compatibility)
    if (!payment.submittedByUserType || !payment.submittedByMobileId) {
      console.warn(`Payment ${payment._id} missing user detail fields. Proceeding without user validation for backward compatibility.`);
    } else {
      // User validation block
      const submittedByUserType = payment.submittedByUserType;
      const submittedByMobileId = payment.submittedByMobileId;
      const tenantName = tenant.name;

      try {
        const tenantConnection = await getTenantDB(tenantName);
        const UserModel = submittedByUserType === 'repo_agent' ? getRepoAgentModel(tenantConnection) : getOfficeStaffModel(tenantConnection);
        const queryField = submittedByUserType === 'repo_agent' ? 'agentId' : 'staffId';
        const user = await UserModel.findOne({ [queryField]: submittedByMobileId });

        if (!user) {
          return res.status(404).json({ success: false, message: `Cannot approve payment: User ${payment.submittedByName || 'Unknown'} (${submittedByMobileId}) not found in tenant database. The user may have been deleted.` });
        }

        if (user.status !== 'active') {
          return res.status(403).json({ success: false, message: `Cannot approve payment: User ${payment.submittedByName || 'Unknown'} (${submittedByMobileId}) is not active (current status: ${user.status}). Only active users can have their payments approved.` });
        }
      } catch (validationError) {
        console.error(`User validation failed for payment ${payment._id}:`, validationError);
        console.warn(`Proceeding with approval despite validation error for backward compatibility.`);
      }
    }

    // Phase 2: Plan Resolution
    const planCode = resolvePlanForPayment(tenant, payment);
    if (!planCode) {
      console.error(`Unable to determine subscription plan for payment ${payment._id}`);
      return res.status(400).json({ success: false, message: 'Unable to determine plan code. Please ensure tenant subscription plan is configured.' });
    }

    // Phase 3: Subscription Lookup and Decision
    const bodyMobileUserId = req.body?.mobileUserId !== undefined ? String(req.body.mobileUserId).trim() : null;
    const mobileUserId = bodyMobileUserId || payment.submittedByMobileId || null;

    if (!mobileUserId) {
      console.warn('Mobile user ID inference failed for payment:', payment._id, 'Sources checked:', { submittedByMobileId: payment.submittedByMobileId, bodyMobileUserId: req.body?.mobileUserId });
      return res.status(400).json({
        success: false,
        message: `Unable to determine mobile user ID for subscription. Attempted sources: payment submission (${payment.submittedByMobileId || 'not available'}), request body (${req.body?.mobileUserId || 'not provided'}). Please include mobileUserId in the approval request body.`
      });
    }

    const rawUserType =
      payment.submittedByUserType ||
      (req.body?.userType ? String(req.body.userType).toLowerCase() : null) ||
      (['repo_agent', 'office_staff'].includes(req.user?.userType) ? req.user.userType : null);
    const userType = ['repo_agent', 'office_staff'].includes(rawUserType) ? rawUserType : 'repo_agent';

    const existingSub = await UserSubscription.findOne({ tenantId: payment.tenantId, mobileUserId }).populate('planId');

    let action = 'RENEW'; // default
    if (!existingSub) {
      action = 'CREATE';
    } else if (existingSub.status === 'active' || existingSub.status === 'grace_period') {
      action = 'RENEW';
    } else if (['expired', 'cancelled', 'suspended'].includes(existingSub.status)) {
      action = 'REACTIVATE';
    }

    let subscription = null;
    let subscriptionUpdateSuccess = true;
    let subscriptionError = null;

    try {
      if (action === 'CREATE') {
        const result = await subscriptionController.createSubscription(payment.tenantId, mobileUserId, userType, planCode, payment.planPeriod, { paymentId: payment._id });
        if (result.success) {
          subscription = result.subscription;
        } else {
          subscriptionUpdateSuccess = false;
          subscriptionError = result.error;
        }
      } else if (action === 'RENEW') {
        const result = await subscriptionController.renewSubscription(existingSub._id, { paymentId: payment._id, newBillingCycle: payment.planPeriod });
        if (result.success) {
          subscription = result.subscription;
        } else {
          subscriptionUpdateSuccess = false;
          subscriptionError = result.error;
        }
      } else if (action === 'REACTIVATE') {
        const result = await subscriptionController.reactivateSubscription(existingSub._id, planCode, payment.planPeriod, { paymentId: payment._id });
        if (result.success) {
          subscription = result.subscription;
        } else {
          subscriptionUpdateSuccess = false;
          subscriptionError = result.error;
        }
      }
    } catch (error) {
      console.error(`Subscription controller error for payment ${payment._id}:`, error);
      subscriptionUpdateSuccess = false;
      subscriptionError = error.message;
    }

    if (!subscriptionUpdateSuccess) {
      console.error(`Subscription update failed for payment ${payment._id}:`, subscriptionError);
      payment.metadata = { subscriptionUpdateError: subscriptionError, subscriptionUpdateCode: 'CONTROLLER_FAILURE' };
      payment.retryCount = 0;
      payment.nextRetryAt = new Date(Date.now() + 5 * 60 * 1000);
      payment.retryReason = subscriptionError;
    }

    // Phase 4: Invoice Generation
    const invoiceResult = await generateInvoiceForPayment(payment);
    if (invoiceResult) {
      payment.invoiceNumber = invoiceResult.invoiceNumber;
      payment.invoiceGeneratedAt = invoiceResult.invoiceGeneratedAt;
    } else {
      console.warn(`Invoice generation failed for payment ${payment._id}`);
    }

    // Phase 5: Update Payment Document
    if (!payment.submittedByMobileId) {
      payment.submittedByMobileId = mobileUserId;
    }
    if (!payment.submittedByUserType && userType) {
      payment.submittedByUserType = userType;
    }
    payment.status = 'approved';
    payment.approvedBy = req.user?._id || req.user?.userId;
    payment.approvedAt = new Date();
    payment.processedByRole = req.user?.role;
    payment.processedByEmail = req.user?.email;
    if (req.body.approvalNotes) {
      payment.approvalNotes = req.body.approvalNotes;
    }
    payment.subscriptionId = subscription?._id;
    payment.effectiveStart = subscription?.currentPeriodStart || subscription?.startDate;
    payment.effectiveEnd = subscription?.currentPeriodEnd || subscription?.endDate;
    
    // Schedule screenshot deletion 2 days after approval
    if (payment.screenshotUrl) {
      const deleteDate = new Date();
      deleteDate.setDate(deleteDate.getDate() + 2);
      payment.screenshotDeleteAt = deleteDate;
    }
    
    await payment.save();

    // Phase 6: Update Response
    const responseData = {
      payment,
      subscription,
      plan: { code: planCode, period: payment.planPeriod, amount: payment.amount },
      user: { id: mobileUserId, endDate: subscription?.currentPeriodEnd || subscription?.endDate }
    };
    if (payment.submittedByName) {
      responseData.submittedBy = {
        name: payment.submittedByName,
        phone: payment.submittedByPhone,
        email: payment.submittedByEmail,
        role: payment.submittedByRole,
        userType: payment.submittedByUserType
      };
    }
    if (invoiceResult) {
      responseData.invoice = { number: payment.invoiceNumber, generatedAt: payment.invoiceGeneratedAt, url: payment.invoiceUrl };
    }
    responseData.subscriptionStatus = subscription?.status;
    responseData.billingCycle = subscription?.billingCycle;
    responseData.remainingDays = subscription?.getRemainingDays();

    const message = subscriptionUpdateSuccess ? 'Payment approved and subscription updated' : 'Payment approved but subscription update failed (will retry)';

    // Phase 7: Update Console Logging
    console.info('Payment approved:', {
      paymentId: payment._id,
      tenantId: payment.tenantId,
      amount: payment.amount,
      planPeriod: payment.planPeriod,
      approvedBy: req.user?.email,
      approvedByRole: req.user?.role,
      mobileUserId,
      subscriptionExtendedTo: subscription?.currentPeriodEnd,
      submittedByName: payment.submittedByName,
      submittedByPhone: payment.submittedByPhone,
      submittedByRole: payment.submittedByRole,
      subscriptionId: subscription?._id,
      subscriptionStatus: subscription?.status,
      billingCycle: subscription?.billingCycle,
      planCode,
      invoiceNumber: payment.invoiceNumber
    });

    return res.json({ success: true, message, data: responseData });
  } catch (err) {
    console.error('approvePayment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin rejects payment
const rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ success: false, message: `Payment not found: ${id}` });
    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Payment already processed' });
    }

    if (!req.body.rejectionReason || req.body.rejectionReason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Rejection reason is required. Please provide a reason for rejecting this payment.' });
    }

    payment.status = 'rejected';
    payment.approvedBy = req.user?._id || req.user?.userId;
    payment.approvedAt = new Date();
    payment.processedByRole = req.user?.role;
    payment.processedByEmail = req.user?.email;
    payment.rejectionReason = req.body.rejectionReason;
    await payment.save();

    console.info('Payment rejected:', { paymentId: payment._id, tenantId: payment.tenantId, amount: payment.amount, planPeriod: payment.planPeriod, rejectedBy: req.user?.email, rejectedByRole: req.user?.role, reason: payment.rejectionReason, submittedByName: payment.submittedByName, submittedByPhone: payment.submittedByPhone, submittedByRole: payment.submittedByRole });

    const responseData = payment;
    if (payment.submittedByName) {
      responseData.submittedBy = {
        name: payment.submittedByName,
        phone: payment.submittedByPhone,
        email: payment.submittedByEmail,
        role: payment.submittedByRole,
        userType: payment.submittedByUserType
      };
    }
    return res.json({ success: true, message: 'Payment rejected', data: responseData });
  } catch (err) {
    console.error('rejectPayment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get payments for the current user
const getMyPayments = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'tenantId required' });
    }

    const payments = await Payment.find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ success: true, data: payments });
  } catch (err) {
    console.error('getMyPayments error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  submitPayment,
  listPayments,
  approvePayment,
  rejectPayment,
  getMyPayments
};