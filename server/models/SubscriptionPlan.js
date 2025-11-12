const mongoose = require('mongoose');

// Lightweight schema retained only to keep historical planId references working
// for legacy data. Tenant user billing no longer relies on this catalog, but
// the model must stay registered to avoid MissingSchemaError during populate.

const pricingSchema = new mongoose.Schema(
  {
    weekly: { type: Number, default: 0, min: 0 },
    monthly: { type: Number, default: 0, min: 0 },
    quarterly: { type: Number, default: 0, min: 0 },
    yearly: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const limitsSchema = new mongoose.Schema(
  {
    maxUsers: { type: Number, default: 0, min: 0 },
    maxDataDownloads: { type: Number, default: 0, min: 0 },
    maxAPIcalls: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, lowercase: true, index: true },
    description: { type: String, trim: true, default: '' },
    pricing: { type: pricingSchema, default: () => ({}) },
    features: { type: [String], default: [] },
    limits: { type: limitsSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 1 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SubscriptionPlan ||
  mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
