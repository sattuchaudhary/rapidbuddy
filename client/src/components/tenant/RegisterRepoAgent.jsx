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
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Chip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Save as SaveIcon,
  AccountCircle as AccountIcon,
  Lock as LockIcon,
  Description as DocumentIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const steps = ['Basic Information', 'Security Details', 'Documents'];

const RegisterRepoAgent = () => {
  const navigate = useNavigate();
  const nameInputRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
    if (error) setError('');
  };

  const handleFileChange = (field, file) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  const validateStep = (step) => {
    const errors = {};
    
    if (step === 0) {
      if (!formData.name.trim()) errors.name = 'Name is required';
      if (!formData.email.trim()) errors.email = 'Email is required';
      if (formData.email && !/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(formData.email)) {
        errors.email = 'Invalid email format';
      }
      if (!formData.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required';
      if (formData.phoneNumber && !/^\d{10}$/.test(formData.phoneNumber)) {
        errors.phoneNumber = 'Please enter a valid 10-digit mobile number';
      }
      if (!formData.address.trim()) errors.address = 'Address is required';
      if (!formData.city.trim()) errors.city = 'City is required';
      if (!formData.state.trim()) errors.state = 'State is required';
      if (!formData.zipCode.trim()) errors.zipCode = 'Zip code is required';
    } else if (step === 1) {
      if (!formData.password) errors.password = 'Password is required';
      if (!formData.confirmPassword) errors.confirmPassword = 'Please enter confirm password';
      if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
      if (formData.password && formData.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
      if (formData.panCardNo && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panCardNo)) {
        errors.panCardNo = 'Please enter a valid PAN card number';
      }
      if (formData.aadhaarNumber && !/^\d{12}$/.test(formData.aadhaarNumber)) {
        errors.aadhaarNumber = 'Please enter a valid 12-digit Aadhaar number';
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
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        password: formData.password,
        panCardNo: formData.panCardNo,
        aadhaarNumber: formData.aadhaarNumber,
        role: 'Repo Agent'
      };
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/tenant/users/agents', submitData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setSuccess('Repo agent registered successfully!');
        setTimeout(() => {
          navigate('/app/tenant/users/agents');
        }, 1500);
      }
    } catch (error) {
      console.error('Error registering repo agent:', error);
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMessages = error.response.data.errors.join(', ');
        setError(`Validation errors: ${errorMessages}`);
      } else {
        setError(error.response?.data?.message || error.message || 'Failed to register repo agent');
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
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={!!formErrors.name}
                helperText={formErrors.name}
                autoFocus
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Email Address *"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                error={!!formErrors.email}
                helperText={formErrors.email}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Phone Number *"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                error={!!formErrors.phoneNumber}
                helperText={formErrors.phoneNumber || 'Enter 10-digit mobile number'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Address *"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
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
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                error={!!formErrors.city}
                helperText={formErrors.city}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="State *"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                error={!!formErrors.state}
                helperText={formErrors.state}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Zip Code *"
                value={formData.zipCode}
                onChange={(e) => handleInputChange('zipCode', e.target.value)}
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
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                error={!!formErrors.password}
                helperText={formErrors.password || 'Minimum 6 characters'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Confirm Password *"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
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
                value={formData.panCardNo}
                onChange={(e) => handleInputChange('panCardNo', e.target.value.toUpperCase())}
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
                value={formData.aadhaarNumber}
                onChange={(e) => handleInputChange('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
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
                    borderColor: '#6366f1',
                    bgcolor: '#f0f4ff'
                  }
                }}>
                  <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600, display: 'block', fontSize: '0.7rem' }}>
                    {doc.label}
                  </Typography>
                  <input
                    type="file"
                    accept={doc.accept}
                    onChange={(e) => handleFileChange(doc.field, e.target.files[0])}
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
              onClick={() => navigate('/app/tenant/users/agents')}
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
                Register Repo Agent
              </Typography>
              <Breadcrumbs separator="›" sx={{ fontSize: '0.875rem' }}>
                <Link
                  color="inherit"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/app/tenant/users/agents');
                  }}
                  sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  Repo Agents
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <PersonIcon sx={{ fontSize: 20 }} />
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
                  onClick={() => navigate('/app/tenant/users/agents')}
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
                      bgcolor: '#6366f1',
                      '&:hover': { bgcolor: '#4f46e5' },
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

export default RegisterRepoAgent;
