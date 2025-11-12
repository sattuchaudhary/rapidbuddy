const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: [true, 'Device token is required'],
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['android', 'ios', 'web'],
    required: true
  },
  deviceId: {
    type: String,
    default: ''
  },
  deviceName: {
    type: String,
    default: ''
  },
  appVersion: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
deviceTokenSchema.index({ tenantId: 1, isActive: 1 });
deviceTokenSchema.index({ userId: 1, isActive: 1 });

// Update lastUsed timestamp before saving
deviceTokenSchema.pre('save', function(next) {
  if (this.isModified('token') || this.isNew) {
    this.lastUsed = new Date();
  }
  next();
});

// Static method to get active tokens for a tenant
deviceTokenSchema.statics.getActiveTokensForTenant = async function(tenantId) {
  return this.find({ tenantId, isActive: true }).lean();
};

// Static method to get active tokens for a user
deviceTokenSchema.statics.getActiveTokensForUser = async function(userId) {
  return this.find({ userId, isActive: true }).lean();
};

// Static method to deactivate old tokens (cleanup)
deviceTokenSchema.statics.deactivateOldTokens = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.updateMany(
    { lastUsed: { $lt: cutoffDate }, isActive: true },
    { isActive: false }
  );
};

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);

