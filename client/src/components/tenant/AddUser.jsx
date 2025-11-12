import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import imageCompression from 'browser-image-compression';

const AddUser = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = !!id;
  const userType = location.pathname.includes('staff') ? 'staff' : 'agent';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
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

  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isEditMode) {
      // Fetch user data for editing
      // This part will be implemented later
    }
  }, [id, isEditMode, userType]);

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
  };

  const handleFileChange = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      try {
        const options = {
          maxSizeMB: 0.4,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        };
        const compressedFile = await imageCompression(file, options);
        setFormData(prev => ({
          ...prev,
          [fieldName]: compressedFile
        }));
      } catch (error) {
        console.error('Error compressing image:', error);
        setFormData(prev => ({
          ...prev,
          [fieldName]: file
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [fieldName]: file
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) errors.name = 'Please enter name';
    if (!formData.email.trim()) errors.email = 'Please enter email';
    if (formData.email && !/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(formData.email)) errors.email = 'Invalid email';
    if (!formData.phoneNumber.trim()) errors.phoneNumber = 'Please enter phone number';
    if (userType === 'staff' && !formData.role) errors.role = 'Please select a role';
    if (!formData.address.trim()) errors.address = 'Please enter address';
    if (!formData.city.trim()) errors.city = 'Please enter city';
    if (!formData.state.trim()) errors.state = 'Please enter state';
    if (!formData.zipCode.trim()) errors.zipCode = 'Please enter zip code';
    if (!isEditMode && !formData.password) errors.password = 'Please enter password';
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const data = new FormData();
      for (const key in formData) {
        if (formData[key]) {
          data.append(key, formData[key]);
        }
      }
      
      const token = localStorage.getItem('token');
      const url = isEditMode
        ? `/api/tenant/users/${userType}/${id}`
        : `/api/tenant/users/${userType}`;
      const method = isEditMode ? 'put' : 'post';

      const response = await axios[method](url, data, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        setSuccess(`User ${isEditMode ? 'updated' : 'added'} successfully!`);
        setTimeout(() => {
          navigate(userType === 'staff' ? '/app/tenant/users/staff' : '/app/tenant/users/agents');
        }, 2000);
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} user:`, error);
      setError(error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'add'} user`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        {isEditMode ? 'Edit' : 'Add'} {userType === 'staff' ? 'Office Staff' : 'Repo Agent'}
      </Typography>

      <Paper sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Grid container spacing={3}>
          {/* Left Column */}
          <Grid item xs={12} md={6}>
            <TextField
              ref={nameInputRef}
              fullWidth
              label="Name *"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
              error={!!formErrors.name}
              helperText={formErrors.name}
              autoFocus
            />
            <TextField
              fullWidth
              label="Email *"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
              error={!!formErrors.email}
              helperText={formErrors.email}
            />
            <TextField
              fullWidth
              label="Phone Number *"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
              error={!!formErrors.phoneNumber}
              helperText={formErrors.phoneNumber}
            />
            {userType === 'staff' && (
              <FormControl fullWidth sx={{ mb: 2 }} error={!!formErrors.role}>
                <InputLabel>Role *</InputLabel>
                <Select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  label="Role *"
                >
                  <MenuItem value="Sub Admin">Sub Admin</MenuItem>
                  <MenuItem value="Vehicle Confirmer">Vehicle Confirmer</MenuItem>
                  <MenuItem value="Manager">Manager</MenuItem>
                  <MenuItem value="Supervisor">Supervisor</MenuItem>
                  <MenuItem value="Staff">Staff</MenuItem>
                </Select>
                {formErrors.role && <FormHelperText>{formErrors.role}</FormHelperText>}
              </FormControl>
            )}
            <TextField
              fullWidth
              label="Address *"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
              error={!!formErrors.address}
              helperText={formErrors.address}
            />
            <TextField
              fullWidth
              label="City *"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
              error={!!formErrors.city}
              helperText={formErrors.city}
            />
            <TextField
              fullWidth
              label="State *"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
              error={!!formErrors.state}
              helperText={formErrors.state}
            />
            <TextField
              fullWidth
              label="Zip Code *"
              name="zipCode"
              value={formData.zipCode}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
              error={!!formErrors.zipCode}
              helperText={formErrors.zipCode}
            />
          </Grid>

          {/* Right Column */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Password *"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
              error={!!formErrors.password}
              helperText={isEditMode ? 'Leave blank to keep unchanged' : formErrors.password}
            />
            <TextField
              fullWidth
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
              error={!!formErrors.confirmPassword}
              helperText={formErrors.confirmPassword}
            />
            <TextField
              fullWidth
              label="Pan Card No."
              name="panCardNo"
              value={formData.panCardNo}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Aadhaar Number"
              name="aadhaarNumber"
              value={formData.aadhaarNumber}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
            />
            
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Documents</Typography>
            <Button variant="outlined" component="label" fullWidth sx={{ mb: 1 }}>
              Upload Profile Photo
              <input type="file" hidden onChange={(e) => handleFileChange(e, 'profilePhoto')} />
            </Button>
            <Button variant="outlined" component="label" fullWidth sx={{ mb: 1 }}>
              Upload Aadhar Front
              <input type="file" hidden onChange={(e) => handleFileChange(e, 'aadharCardFront')} />
            </Button>
            <Button variant="outlined" component="label" fullWidth sx={{ mb: 1 }}>
              Upload Aadhar Back
              <input type="file" hidden onChange={(e) => handleFileChange(e, 'aadharCardBack')} />
            </Button>
            <Button variant="outlined" component="label" fullWidth sx={{ mb: 1 }}>
              Upload PAN Card
              <input type="file" hidden onChange={(e) => handleFileChange(e, 'panCardPhoto')} />
            </Button>
            <Button variant="outlined" component="label" fullWidth sx={{ mb: 1 }}>
              Upload Police Verification
              <input type="file" hidden onChange={(e) => handleFileChange(e, 'policeVerification')} />
            </Button>
            <Button variant="outlined" component="label" fullWidth>
              Upload DRA Certificate
              <input type="file" hidden onChange={(e) => handleFileChange(e, 'draCertificate')} />
            </Button>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Save'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default AddUser;
