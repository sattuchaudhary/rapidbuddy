import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Alert, Table, TableBody, TableCell, TableHead, TableRow, Chip, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Tooltip, Divider, Modal } from '@mui/material';
import { Clear as ClearIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import axios from 'axios';

const PaymentApprovals = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, payment: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [screenshotView, setScreenshotView] = useState({ open: false, url: null });

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/payments?status=pending', { headers: { Authorization: `Bearer ${token}` } });
      setItems(res?.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const formatUserType = (userType) => {
    if (!userType) return 'N/A';
    if (userType === 'repo_agent') return 'Repo Agent';
    if (userType === 'office_staff') return 'Office Staff';
    return userType;
  };

  const filteredItems = items.filter(item => {
    const nameMatch = !searchName || (item.submittedByName?.toLowerCase().includes(searchName.toLowerCase()));
    const phoneMatch = !searchPhone || (item.submittedByPhone?.includes(searchPhone));
    return nameMatch && phoneMatch;
  });

  const approve = async (payment) => {
    const token = localStorage.getItem('token');
    const payload = {};
    
    // Only include mobileUserId if it exists
    if (payment.submittedByMobileId) {
      payload.mobileUserId = payment.submittedByMobileId;
    }
    
    const response = await axios.post(
      `/api/payments/${payment._id}/approve`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response;
  };

  const reject = async (payment, reason) => {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `/api/payments/${payment._id}/reject`,
      { rejectionReason: reason },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response;
  };

  const openConfirmDialog = (type, payment) => {
    setConfirmDialog({ open: true, type, payment });
    setRejectionReason('');
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, type: null, payment: null });
    setRejectionReason('');
  };

  const handleConfirm = async () => {
    const { type, payment } = confirmDialog;
    const name = payment?.submittedByName || `ID: ${payment?.submittedByMobileId}` || 'user';
    
    try {
      setConfirmLoading(true);
      setSuccess('');
      setError('');

      if (type === 'approve') {
        await approve(payment);
        setSuccess(`Payment approved for ${name}. Subscription extended.`);
        closeConfirmDialog();
      } else if (type === 'reject') {
        if (!rejectionReason.trim()) {
          setError('Please provide a rejection reason');
          return;
        }
        await reject(payment, rejectionReason);
        setSuccess(`Payment rejected for ${name}.`);
        closeConfirmDialog();
      }
      
      // Reload the payment list after successful action
      await load();
    } catch (e) {
      const errorContext = `[${payment.transactionId}] ${name}`;
      setError(`Failed to ${type} payment for ${errorContext}: ${e?.response?.data?.message || e.message}`);
      // Keep dialog open on error for reject flow to allow correction
      if (type === 'approve') {
        closeConfirmDialog();
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>Payment Approvals</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Card>
        <CardContent>
          <Button variant="outlined" onClick={load} disabled={loading} sx={{ mb: 2 }}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Search by Name"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                size="small"
                variant="outlined"
                fullWidth
                InputProps={{
                  endAdornment: searchName && (
                    <Button onClick={() => setSearchName('')} size="small">
                      <ClearIcon />
                    </Button>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Search by Phone"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                size="small"
                variant="outlined"
                fullWidth
                InputProps={{
                  endAdornment: searchPhone && (
                    <Button onClick={() => setSearchPhone('')} size="small">
                      <ClearIcon />
                    </Button>
                  ),
                }}
              />
            </Grid>
          </Grid>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Showing {filteredItems.length} of {items.length} payments
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>User Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>User Type</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Txn ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.map(p => (
                  <TableRow key={p._id}>
                    <TableCell>{new Date(p.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {p.submittedByName ? (
                        <Tooltip title={`ID: ${p.submittedByMobileId || '-'}`}>
                          <span>{p.submittedByName}</span>
                        </Tooltip>
                      ) : p.submittedByMobileId ? `ID: ${p.submittedByMobileId}` : '-'}
                    </TableCell>
                    <TableCell>{p.submittedByPhone || '-'}</TableCell>
                    <TableCell>
                      <Tooltip title={p.submittedByEmail || '-'}>
                        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.submittedByEmail || '-'}
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{p.submittedByRole || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={formatUserType(p.submittedByUserType)}
                        color={p.submittedByUserType === 'repo_agent' ? 'primary' : p.submittedByUserType === 'office_staff' ? 'secondary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{p.planPeriod}</TableCell>
                    <TableCell>{p.amount}</TableCell>
                    <TableCell>{p.transactionId}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell>
                      {p.screenshotUrl && (
                        <Tooltip title="View Screenshot">
                          <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={() => setScreenshotView({ open: true, url: p.screenshotUrl })} 
                            sx={{ mr: 1 }}
                            startIcon={<VisibilityIcon />}
                          >
                            Screenshot
                          </Button>
                        </Tooltip>
                      )}
                      <Button size="small" variant="contained" color="success" onClick={() => openConfirmDialog('approve', p)} sx={{ mr: 1 }}>Approve</Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => openConfirmDialog('reject', p)}>Reject</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} align="center">No pending requests</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>
      <Dialog open={confirmDialog.open} onClose={closeConfirmDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {confirmDialog.type === 'approve' ? 'Confirm Payment Approval' : 'Confirm Payment Rejection'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Payment Details:</Typography>
          <Typography variant="body2"><strong>Transaction ID:</strong> {confirmDialog.payment?.transactionId}</Typography>
          <Typography variant="body2"><strong>Amount:</strong> ₹{confirmDialog.payment?.amount}</Typography>
          <Typography variant="body2"><strong>Plan:</strong> {confirmDialog.payment?.planPeriod}</Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Submitted By:</Typography>
          <Typography variant="body2"><strong>Name:</strong> {confirmDialog.payment?.submittedByName || `ID: ${confirmDialog.payment?.submittedByMobileId}` || '-'}</Typography>
          <Typography variant="body2"><strong>Phone:</strong> {confirmDialog.payment?.submittedByPhone || '-'}</Typography>
          <Typography variant="body2"><strong>Email:</strong> {confirmDialog.payment?.submittedByEmail || '-'}</Typography>
          <Typography variant="body2"><strong>Role:</strong> {confirmDialog.payment?.submittedByRole || '-'}</Typography>
          <Typography variant="body2"><strong>User Type:</strong> {formatUserType(confirmDialog.payment?.submittedByUserType)}</Typography>
          {confirmDialog.type === 'reject' && (
            <TextField
              label="Rejection Reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              fullWidth
              multiline
              rows={3}
              sx={{ mt: 2 }}
              required
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog} variant="outlined">Cancel</Button>
          <Button
            onClick={handleConfirm}
            color={confirmDialog.type === 'approve' ? 'success' : 'error'}
            disabled={confirmLoading || (confirmDialog.type === 'reject' && !rejectionReason.trim())}
          >
            {confirmLoading 
              ? (confirmDialog.type === 'approve' ? 'Approving...' : 'Rejecting...')
              : (confirmDialog.type === 'approve' ? 'Approve Payment' : 'Reject Payment')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Screenshot View Modal */}
      <Modal
        open={screenshotView.open}
        onClose={() => setScreenshotView({ open: false, url: null })}
        aria-labelledby="screenshot-modal-title"
        aria-describedby="screenshot-modal-description"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: 800,
            bgcolor: 'background.paper',
            border: '2px solid #000',
            boxShadow: 24,
            p: 2,
            maxHeight: '90vh',
            overflow: 'auto'
          }}
        >
          <DialogTitle id="screenshot-modal-title">
            Payment Screenshot
            <Button
              onClick={() => setScreenshotView({ open: false, url: null })}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <ClearIcon />
            </Button>
          </DialogTitle>
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            {screenshotView.url ? (
              <img
                src={screenshotView.url.startsWith('/') ? `${window.location.origin}${screenshotView.url}` : screenshotView.url}
                alt="Payment Screenshot"
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }}
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
                }}
              />
            ) : (
              <Typography>No screenshot available</Typography>
            )}
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

export default PaymentApprovals;