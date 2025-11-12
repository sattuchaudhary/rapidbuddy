const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  mobileUserId: { type: String, required: true, index: true }, // repo agent id or staff id from token
  userType: { type: String, enum: ['repo_agent', 'office_staff', 'other'], default: 'repo_agent' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  lastPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  status: { type: String, enum: ['trial', 'active', 'grace_period', 'past_due', 'expired', 'suspended', 'cancelled'], default: 'active', index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', index: true },
  billingCycle: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'yearly'], default: 'monthly' },
  currentPeriodStart: { type: Date, index: true },
  currentPeriodEnd: { type: Date, index: true },
  autoRenew: { type: Boolean, default: true },
  cancelledAt: { type: Date },
  cancelReason: { type: String, trim: true, maxlength: 500 },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  gracePeriodEnd: { type: Date, index: true },
  trialEnd: { type: Date, index: true },
  dataDownloaded: { type: Number, default: 0, min: 0 },
  apiCallsCount: { type: Number, default: 0, min: 0 },
  lastUsageReset: { type: Date }
}, { timestamps: true });

userSubscriptionSchema.index({ tenantId: 1, mobileUserId: 1 }, { unique: true });
userSubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
userSubscriptionSchema.index({ status: 1, gracePeriodEnd: 1 });
userSubscriptionSchema.index({ tenantId: 1, status: 1 });
userSubscriptionSchema.index({ planId: 1 });
userSubscriptionSchema.index({ trialEnd: 1 }, { sparse: true });

userSubscriptionSchema.virtual('isTrialing').get(function() {
  return this.status === 'trial';
});

userSubscriptionSchema.virtual('isCancelled').get(function() {
  return this.status === 'cancelled';
});

userSubscriptionSchema.virtual('effectiveEndDate').get(function() {
  return this.currentPeriodEnd || this.endDate;
});

userSubscriptionSchema.methods.isActive = function() {
  return ['active', 'trial'].includes(this.status);
};

userSubscriptionSchema.methods.isInGracePeriod = function() {
  return this.status === 'grace_period' && this.gracePeriodEnd && new Date(this.gracePeriodEnd) > new Date();
};

userSubscriptionSchema.methods.canAccess = function() {
  return this.isActive() || this.isInGracePeriod();
};

userSubscriptionSchema.methods.getRemainingDays = function() {
  const endDate = this.currentPeriodEnd || this.endDate;
  if (!endDate) return 0;
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
};

userSubscriptionSchema.methods.isExpiringSoon = function(daysThreshold = 7) {
  return this.canAccess() && this.getRemainingDays() <= daysThreshold && this.getRemainingDays() > 0;
};

userSubscriptionSchema.methods.hasUsageLimit = function(limitType) {
  if (!this.planId || !this.populated('planId')) return false;
  const plan = this.planId;
  if (limitType === 'dataDownloads') {
    return plan.limits.maxDataDownloads !== -1;
  } else if (limitType === 'apiCalls') {
    return plan.limits.maxAPIcalls !== -1;
  }
  return false;
};

userSubscriptionSchema.statics.findExpiring = async function(daysThreshold = 7) {
  const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
  return await this.find({
    status: { $in: ['active', 'trial'] },
    currentPeriodEnd: { $gte: new Date(), $lte: thresholdDate }
  });
};

userSubscriptionSchema.statics.findInGracePeriod = async function() {
  return await this.find({
    status: 'grace_period',
    gracePeriodEnd: { $gte: new Date() }
  });
};

userSubscriptionSchema.statics.findExpiredGracePeriod = async function() {
  return await this.find({
    status: 'grace_period',
    gracePeriodEnd: { $lt: new Date() }
  });
};

userSubscriptionSchema.pre('save', function(next) {
  // Sync endDate with currentPeriodEnd
  if (this.currentPeriodEnd) {
    this.endDate = this.currentPeriodEnd;
  }
  // Clear cancellation fields if status changes from 'cancelled'
  if (this.isModified('status') && this.status !== 'cancelled') {
    this.cancelledAt = null;
    this.cancelReason = null;
    this.cancelAtPeriodEnd = false;
  }
  next();
});

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);