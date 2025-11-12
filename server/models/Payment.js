const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    submittedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedByMobileId: { type: String }, // repo agent or staff id from token when not in main User collection
    submittedByName: { type: String, trim: true },
    submittedByPhone: { type: String, trim: true },
    submittedByEmail: { type: String, trim: true },
    submittedByRole: { type: String, trim: true },
    submittedByUserType: { type: String, enum: ['repo_agent', 'office_staff'] },
    planPeriod: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'yearly'], required: true },
    amount: { type: Number, required: true, min: 0 },
    transactionId: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    screenshotUrl: { type: String, trim: true },
    screenshotDeleteAt: { type: Date, index: true }, // Auto-delete screenshot 2 days after approval
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    rejectionReason: { type: String, trim: true },
    approvalNotes: { type: String, trim: true },
    processedByRole: { type: String, enum: ['super_admin', 'admin'] },
    processedByEmail: { type: String },
    amountValidated: { type: Boolean, default: false },
    expectedAmount: { type: Number },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    effectiveStart: { type: Date },
    effectiveEnd: { type: Date },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserSubscription', index: true },
    retryCount: { type: Number, default: 0, min: 0 },
    lastRetryAt: { type: Date },
    nextRetryAt: { type: Date, index: true },
    retryReason: { type: String, trim: true, maxlength: 500 },
    invoiceNumber: { type: String, trim: true, unique: true, sparse: true },
    invoiceUrl: { type: String, trim: true },
    invoiceGeneratedAt: { type: Date }
  },
  { timestamps: true }
);

paymentSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

// Ensure transactionId is unique to prevent duplicate submissions
paymentSchema.index({ transactionId: 1 }, { unique: true });

paymentSchema.index({ status: 1, nextRetryAt: 1 });
paymentSchema.index({ tenantId: 1, invoiceNumber: 1 });

paymentSchema.statics.generateInvoiceNumber = async function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const pattern = `^INV-${year}-${month}-`;
  const lastInvoice = await this.find({ invoiceNumber: { $regex: pattern } })
    .sort({ invoiceNumber: -1 })
    .limit(1);
  let sequence = 1;
  if (lastInvoice.length > 0) {
    const lastNumber = lastInvoice[0].invoiceNumber;
    const match = lastNumber.match(/^INV-(\d{4})-(\d{2})-(\d{5})$/);
    if (match) {
      sequence = parseInt(match[3], 10) + 1;
    }
  }
  const invoiceNumber = `INV-${year}-${month}-${String(sequence).padStart(5, '0')}`;
  return invoiceNumber;
};

module.exports = mongoose.model('Payment', paymentSchema);