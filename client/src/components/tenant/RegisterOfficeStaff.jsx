import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  Divider,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Stepper,
  Step,
  StepLabel,
  Chip,
  IconButton
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  Save as SaveIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const steps = ['Basic Information', 'Security Details', 'Documents'];

const RegisterOfficeStaff = () => {
  const navigate = useNavigate();
  const nameInputRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    role: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    password: '',
    confirmPassword: '',
    panCardNo: '',
    aadhaarNumber: '',
    aadharCardFront: null,
    aadharCardBack: null,
    policeVerification: null,
    panCardPhoto: null,
    draCertificate: null,
    profilePhoto: null
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    if (error) setError('');
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    setFormData(prev => ({
      ...prev,
      [fieldName]: file
    }));
  };

  const validateStep = (step) => {
    const errors = {};
    
    if (step === 0) {
      if (!formData.name.trim()) errors.name = 'Please enter name';
      if (!formData.email.trim()) errors.email = 'Please enter email';
      if (formData.email && !/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(formData.email)) {
        errors.email = 'Invalid email format';
      }
      if (!formData.phoneNumber.trim()) errors.phoneNumber = 'Please enter phone number';
      if (formData.phoneNumber && !/^\d{10}$/.test(formData.phoneNumber)) {
        errors.phoneNumber = 'Please enter a valid 10-digit mobile number';
      }
      if (!formData.role) errors.role = 'Please select a role';
      if (!formData.address.trim()) errors.address = 'Please enter address';
      if (!formData.city.trim()) errors.city = 'Please enter city';
      if (!formData.state.trim()) errors.state = 'Please enter state';
      if (!formData.zipCode.trim()) errors.zipCode = 'Please enter zip code';
    } else if (step === 1) {
      if (!formData.password) errors.password = 'Please enter password';
      if (!formData.confirmPassword) errors.confirmPassword = 'Please enter confirm password';
      if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
      if (formData.password && formData.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
      if (formData.panCardNo && formData.panCardNo.trim()) {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(formData.panCardNo.toUpperCase())) {
          errors.panCardNo = 'PAN should be in format: ABCDE1234F';
        }
      }
      if (formData.aadhaarNumber && formData.aadhaarNumber.trim()) {
        const aadhaarRegex = /^[0-9]{12}$/;
        if (!aadhaarRegex.test(formData.aadhaarNumber)) {
          errors.aadhaarNumber = 'Aadhaar should be 12 digits';
        }
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(activeStep)) return;
    if (activeStep < steps.length - 1) {
      handleNext();
      return;
    }
    
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      
      const submitData = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        role: formData.role,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        password: formData.password,
        panCardNo: formData.panCardNo,
        aadhaarNumber: formData.aadhaarNumber
      };
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/tenant/users/staff', submitData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setSuccess('Office staff registered successfully!');
        setTimeout(() => {
          navigate('/app/tenant/users/staff');
        }, 1500);
      }
    } catch (error) {
      console.error('Error registering office staff:', error);
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMessages = error.response.data.errors.join(', ');
        setError(`Validation errors: ${errorMessages}`);
      } else {
        setError(error.response?.data?.message || error.message || 'Failed to register office staff');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <TextField
                ref={nameInputRef}
                fullWidth
                size="small"
                label="Full Name *"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                error={!!formErrors.name}
                helperText={formErrors.name}
                autoFocus
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" error={!!formErrors.role}>
                <InputLabel>Role *</InputLabel>
                <Select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  label="Role *"
                >
                  <MenuItem value="">-Select a Role-</MenuItem>
                  <MenuItem value="Sub Admin">Sub Admin</MenuItem>
                  <MenuItem value="Vehicle Confirmer">Vehicle Confirmer</MenuItem>
                  <MenuItem value="Manager">Manager</MenuItem>
                  <MenuItem value="Supervisor">Supervisor</MenuItem>
                  <MenuItem value="Staff">Staff</MenuItem>
                </Select>
                {formErrors.role && <FormHelperText>{formErrors.role}</FormHelperText>}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Email Address *"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                error={!!formErrors.email}
                helperText={formErrors.email}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Phone Number *"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData(prev => ({ ...prev, phoneNumber: value }));
                  if (formErrors.phoneNumber) {
                    setFormErrors(prev => ({ ...prev, phoneNumber: '' }));
                  }
                  if (error) setError('');
                }}
                error={!!formErrors.phoneNumber}
                helperText={formErrors.phoneNumber || 'Enter 10-digit mobile number'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Address *"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                error={!!formErrors.address}
                helperText={formErrors.address}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="City *"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                error={!!formErrors.city}
                helperText={formErrors.city}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="State *"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                error={!!formErrors.state}
                helperText={formErrors.state}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Zip Code *"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleInputChange}
                error={!!formErrors.zipCode}
                helperText={formErrors.zipCode}
              />
            </Grid>
          </Grid>
        );
      
      case 1:
        return (
          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ mb: 1, color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}>
                Password Requirements: Minimum 6 characters
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Password *"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                error={!!formErrors.password}
                helperText={formErrors.password || 'Minimum 6 characters'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Confirm Password *"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                error={!!formErrors.confirmPassword}
                helperText={formErrors.confirmPassword}
              />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" sx={{ mb: 1, color: 'text.secondary', display: 'block', fontWeight: 600, fontSize: '0.75rem' }}>
                Identity Documents (Optional)
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="PAN Card Number"
                name="panCardNo"
                value={formData.panCardNo}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setFormData(prev => ({ ...prev, panCardNo: value }));
                  if (formErrors.panCardNo) {
                    setFormErrors(prev => ({ ...prev, panCardNo: '' }));
                  }
                  if (error) setError('');
                }}
                error={!!formErrors.panCardNo}
                helperText={formErrors.panCardNo || 'Format: ABCDE1234F'}
                placeholder="ABCDE1234F"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Aadhaar Number"
                name="aadhaarNumber"
                value={formData.aadhaarNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setFormData(prev => ({ ...prev, aadhaarNumber: value }));
                  if (formErrors.aadhaarNumber) {
                    setFormErrors(prev => ({ ...prev, aadhaarNumber: '' }));
                  }
                  if (error) setError('');
                }}
                error={!!formErrors.aadhaarNumber}
                helperText={formErrors.aadhaarNumber || '12 digits'}
                placeholder="1234 5678 9012"
              />
            </Grid>
          </Grid>
        );
      
      case 2:
        return (
          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ mb: 1.5, color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}>
                Upload supporting documents (All fields are optional)
              </Typography>
            </Grid>
            {[
              { field: 'aadharCardFront', label: 'Aadhar Card Front', accept: 'image/*,.pdf' },
              { field: 'aadharCardBack', label: 'Aadhar Card Back', accept: 'image/*,.pdf' },
              { field: 'policeVerification', label: 'Police Verification', accept: 'image/*,.pdf' },
              { field: 'panCardPhoto', label: 'PAN Card Photo', accept: 'image/*,.pdf' },
              { field: 'draCertificate', label: 'DRA Certificate', accept: 'image/*,.pdf' },
              { field: 'profilePhoto', label: 'Profile Photo', accept: 'image/*' }
            ].map((doc, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Box sx={{ 
                  p: 1, 
                  border: '1px dashed #e0e0e0', 
                  borderRadius: 1,
                  bgcolor: '#fafafa',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: '#f59e0b',
                    bgcolor: '#fffbeb'
                  }
                }}>
                  <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600, display: 'block', fontSize: '0.7rem' }}>
                    {doc.label}
                  </Typography>
                  <input
                    type="file"
                    accept={doc.accept}
                    onChange={(e) => handleFileChange(e, doc.field)}
                    style={{
                      width: '100%',
                      padding: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  />
                  {formData[doc.field] && (
                    <Chip
                      icon={<CheckIcon sx={{ fontSize: 12 }} />}
                      label={formData[doc.field].name || 'File selected'}
                      color="success"
                      size="small"
                      sx={{ mt: 0.5, height: 18, fontSize: '0.65rem' }}
                    />
                  )}
                </Box>
              </Grid>
            ))}
          </Grid>
        );
      
      default:
        return null;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', py: 1.5 }}>
      <Container maxWidth="lg">
        {/* Compact Header with Breadcrumbs */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              onClick={() => navigate('/app/tenant/users/staff')}
              sx={{ 
                bgcolor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                '&:hover': { bgcolor: 'grey.100' }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                Register Office Staff
              </Typography>
              <Breadcrumbs separator="›" sx={{ fontSize: '0.875rem' }}>
                <Link
                  color="inherit"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/app/tenant/users/staff');
                  }}
                  sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  Office Staff
                </Link>
                <Typography color="text.primary" sx={{ fontSize: '0.875rem' }}>Register</Typography>
              </Breadcrumbs>
            </Box>
          </Box>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white'
          }}>
            <BusinessIcon sx={{ fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              New Registration
            </Typography>
          </Box>
        </Box>

        {/* Form Card */}
        <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
          <CardContent sx={{ p: 2.5 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 1.5, borderRadius: 1.5, py: 0.5 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 1.5, borderRadius: 1.5, py: 0.5 }}>
                {success}
              </Alert>
            )}

            {/* Compact Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 2, '& .MuiStep-root': { px: 1 } }}>
              {steps.map((label, index) => (
                <Step key={label}>
                  <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.8rem' } }}>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <form onSubmit={handleSubmit}>
              <Box sx={{ minHeight: 300, mb: 2 }}>
                {renderStepContent(activeStep)}
              </Box>

              {/* Action Buttons */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                pt: 1.5, 
                borderTop: '1px solid', 
                borderColor: 'divider',
                gap: 1.5
              }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/app/tenant/users/staff')}
                  disabled={submitting}
                  size="small"
                >
                  Cancel
                </Button>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {activeStep > 0 && (
                    <Button
                      variant="outlined"
                      onClick={handleBack}
                      disabled={submitting}
                      size="small"
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={16} /> : activeStep === steps.length - 1 ? <SaveIcon /> : null}
                    size="small"
                    sx={{ 
                      bgcolor: '#f59e0b',
                      '&:hover': { bgcolor: '#d97706' },
                      minWidth: 120
                    }}
                  >
                    {submitting 
                      ? 'Saving...' 
                      : activeStep === steps.length - 1 
                        ? 'Register' 
                        : 'Next'}
                  </Button>
                </Box>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default RegisterOfficeStaff;
