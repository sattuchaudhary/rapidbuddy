const mongoose = require('mongoose');

const usageHistorySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  mobileUserId: { type: String, required: true, index: true },
  userType: { type: String, required: true, enum: ['repo_agent', 'office_staff', 'other'] },
  eventType: { type: String, required: true, enum: ['download', 'api_call', 'reset', 'alert', 'limit_exceeded'], index: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  usageSnapshot: {
    dataDownloaded: Number,
    apiCallsCount: Number,
    dataLimit: Number,
    apiLimit: Number
  },
  timestamp: { type: Date, default: Date.now, expires: 7776000, index: true }
}, { timestamps: true, collection: 'usage_history' });

// Additional indexes
usageHistorySchema.index({ tenantId: 1, timestamp: -1 });
usageHistorySchema.index({ tenantId: 1, mobileUserId: 1, timestamp: -1 });
usageHistorySchema.index({ eventType: 1, timestamp: -1 });

usageHistorySchema.statics.getUsageByTenant = async function(tenantId, startDate, endDate) {
  const match = { tenantId };
  if (startDate && endDate) {
    match.timestamp = { $gte: startDate, $lte: endDate };
  }
  const result = await this.aggregate([
    { $match: match },
    { $group: {
      _id: '$eventType',
      count: { $sum: 1 },
      totalRecords: { $sum: { $cond: { if: { $eq: ['$eventType', 'download'] }, then: '$metadata.recordCount', else: 0 } } }
    } }
  ]);
  const summary = { downloads: 0, apiCalls: 0, alerts: 0, totalRecords: 0 };
  result.forEach(item => {
    if (item._id === 'download') summary.downloads = item.count;
    else if (item._id === 'api_call') summary.apiCalls = item.count;
    else if (item._id === 'alert') summary.alerts = item.count;
    summary.totalRecords += item.totalRecords;
  });
  return summary;
};

usageHistorySchema.statics.getUsageByUser = async function(tenantId, mobileUserId, startDate, endDate) {
  const query = { tenantId, mobileUserId };
  if (startDate && endDate) {
    query.timestamp = { $gte: startDate, $lte: endDate };
  }
  return await this.find(query).sort({ timestamp: -1 });
};

usageHistorySchema.statics.getAlertHistory = async function(tenantId, limitType, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query = { tenantId, eventType: 'alert', timestamp: { $gte: startDate } };
  if (limitType) {
    query['metadata.limitType'] = limitType;
  }
  return await this.find(query).populate('tenantId', 'name').sort({ timestamp: -1 });
};

usageHistorySchema.pre('save', function(next) {
  if (!this.timestamp) {
    this.timestamp = new Date();
  }
  const requiredMetadata = {
    download: ['recordCount', 'endpoint'],
    api_call: ['endpoint'],
    reset: ['previousDataDownloaded', 'previousApiCallsCount'],
    alert: ['limitType', 'percentage', 'level'],
    limit_exceeded: ['limitType', 'requested', 'limit', 'current']
  };
  const required = requiredMetadata[this.eventType];
  if (required) {
    for (const field of required) {
      if (!this.metadata || !this.metadata[field]) {
        return next(new Error(`Missing required metadata field: ${field} for eventType: ${this.eventType}`));
      }
    }
  }
  next();
});

module.exports = mongoose.model('UsageHistory', usageHistorySchema);