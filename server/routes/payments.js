const express = require('express');
const router = express.Router();
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');
const { requireSuperAdmin, requireAdmin } = require('../middleware/auth');
const { submitPayment, listPayments, approvePayment, rejectPayment, getMyPayments } = require('../controllers/paymentController');

// Anyone logged-in (mobile/admin) can submit for their tenant
router.post('/submit', authenticateUnifiedToken, submitPayment);

// Admin views pending payments; allow admin or super_admin via standard auth middleware if needed
router.get('/', authenticateUnifiedToken, listPayments);

// Mobile users fetch their own payment history
router.get('/my-payments', authenticateUnifiedToken, getMyPayments);

// Approve / Reject by admin users only (admin or super_admin role required).
router.post('/:id/approve', authenticateUnifiedToken, requireAdmin, approvePayment);
router.post('/:id/reject', authenticateUnifiedToken, requireAdmin, rejectPayment);

module.exports = router;