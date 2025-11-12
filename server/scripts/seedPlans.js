/**
 * Seed script for populating default subscription plans in the database.
 * 
 * This script creates or updates three default subscription plans: Basic, Premium, and Enterprise.
 * It uses upsert logic to ensure idempotency - safe to run multiple times.
 * 
 * Usage:
 * - Run normally: node server/scripts/seedPlans.js
 * - Force reseed (delete existing): node server/scripts/seedPlans.js --force
 * - Dry run (preview only): node server/scripts/seedPlans.js --dry-run
 * 
 * Available flags:
 * - --force: Deletes all existing plans before seeding (use with caution)
 * - --dry-run: Logs what would be seeded without modifying the database
 * 
 * Data seeded:
 * - Basic Plan: Entry-level plan for small teams
 * - Premium Plan: Advanced features for growing teams
 * - Enterprise Plan: Full-featured plan for large organizations
 */

const mongoose = require('mongoose');
require('dotenv').config();
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { connectDB } = require('../config/database');

const defaultPlans = [
  {
    name: 'Basic Plan',
    code: 'basic',
    description: 'Perfect for small teams getting started with vehicle data management',
    pricing: { weekly: 100, monthly: 350, quarterly: 900, yearly: 3000 },
    features: ['Basic search functionality', 'Up to 10 users', 'Email support', 'Mobile app access', 'Data export (CSV)', 'Basic reporting'],
    limits: { maxUsers: 10, maxDataDownloads: 100, maxAPIcalls: 1000 },
    isActive: true,
    displayOrder: 1,
    metadata: { recommended: false, color: '#3B82F6' }
  },
  {
    name: 'Premium Plan',
    code: 'premium',
    description: 'Advanced features for growing teams with higher volume needs',
    pricing: { weekly: 200, monthly: 700, quarterly: 1800, yearly: 6000 },
    features: ['Advanced search with filters', 'Up to 50 users', 'Priority email support', 'Mobile app access', 'Bulk operations', 'Data export (CSV, Excel, JSON)', 'Advanced reporting & analytics', 'API access', 'Custom field mapping', 'Data validation rules'],
    limits: { maxUsers: 50, maxDataDownloads: 500, maxAPIcalls: 5000 },
    isActive: true,
    displayOrder: 2,
    metadata: { recommended: true, color: '#8B5CF6' }
  },
  {
    name: 'Enterprise Plan',
    code: 'enterprise',
    description: 'Complete solution for large organizations with unlimited access',
    pricing: { weekly: 400, monthly: 1400, quarterly: 3600, yearly: 12000 },
    features: ['All Premium features', 'Unlimited users', 'Dedicated account manager', '24/7 phone & email support', 'Unlimited bulk operations', 'All export formats', 'Custom integrations', 'White-label options', 'Advanced security features', 'SLA guarantee', 'Custom training', 'Priority feature requests'],
    limits: { maxUsers: -1, maxDataDownloads: -1, maxAPIcalls: -1 },
    isActive: true,
    displayOrder: 3,
    metadata: { recommended: false, color: '#F59E0B', badge: 'Most Popular' }
  }
];

async function seedPlans() {
  try {
    await connectDB();
    console.log(`[${new Date().toISOString()}] Starting subscription plans seed...`);

    const isForce = process.argv.includes('--force');
    const isDryRun = process.argv.includes('--dry-run');

    if (isForce) {
      console.warn(`[${new Date().toISOString()}] ⚠️ Force flag detected. Deleting all existing plans...`);
      if (!isDryRun) {
        await SubscriptionPlan.deleteMany({});
      }
    }

    if (isDryRun) {
      console.log(`[${new Date().toISOString()}] 🔍 Dry run mode. Logging plans that would be seeded...`);
      defaultPlans.forEach(plan => {
        console.log(`Plan: ${plan.name} (${plan.code})`);
        console.log(`  Pricing: ${JSON.stringify(plan.pricing)}`);
        console.log(`  Features: ${plan.features.join(', ')}`);
        console.log(`  Limits: ${JSON.stringify(plan.limits)}`);
        console.log('');
      });
      return;
    }

    // Upsert logic ensures idempotency - updates if exists, inserts if not
    for (const plan of defaultPlans) {
      await SubscriptionPlan.updateOne({ code: plan.code }, plan, { upsert: true });
      console.log(`[${new Date().toISOString()}] ✅ Seeded/Updated plan: ${plan.name}`);
    }

    const plans = await SubscriptionPlan.find().sort({ displayOrder: 1 });
    console.log(`[${new Date().toISOString()}] All plans: ${plans.map(p => p.name).join(', ')}`);

    console.log(`[${new Date().toISOString()}] Subscription plans seed completed successfully!`);
    const activeCount = await SubscriptionPlan.countDocuments({ isActive: true });
    console.log(`[${new Date().toISOString()}] Active plans: ${activeCount}`);

    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error seeding plans:`, error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log(`[${new Date().toISOString()}] Database connection closed`);
  }
}

seedPlans().catch(err => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, err);
  process.exit(1);
});