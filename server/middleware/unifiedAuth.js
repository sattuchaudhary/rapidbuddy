const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/database');

// Verify JWT token for unified system
const authenticateUnifiedToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded JWT:', decoded); // Log decoded token

    // Normalize decoded fields
    const decodedUserId = decoded.userId || decoded.agentId || decoded.staffId || null;
    let decodedUserType = decoded.userType || decoded.type || null;
    let decodedRole = decoded.role || null;
    let decodedTenantId = decoded.tenantId || null;
    const decodedTenantName = decoded.tenantName || null;

    // Backward compatibility: tokens issued by /api/auth login don't include userType/role/tenantId
    // If we have a userId but no userType, treat as main user by loading from User
    if (!decodedUserType && decodedUserId) {
      const user = await User.findById(decodedUserId).select('-password');
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: 'Invalid token - user not found' });
      }
      decodedUserType = 'main_user';
      decodedRole = user.role;
      decodedTenantId = user.tenantId || null;
      req.user = { userId: decodedUserId, agentId: null, staffId: null, userType: decodedUserType, role: decodedRole, tenantId: decodedTenantId, tenantName: decodedTenantName, mainUser: user };
    } else {
      // Set user info in request directly from token
      req.user = {
        userId: decodedUserId,
        agentId: decoded.agentId || null,
        staffId: decoded.staffId || null,
        userType: decodedUserType,
        role: decodedRole || 'agent',
        tenantId: decodedTenantId,
        tenantName: decodedTenantName
      };

      if (decodedUserType === 'main_user') {
        // Verify main user still exists and is active
        const user = await User.findById(decodedUserId).select('-password');
        if (!user || !user.isActive) {
          return res.status(401).json({ success: false, message: 'Invalid token - user not found' });
        }
        req.user.mainUser = user;
      } else {
        // For mobile users (repo agents, office staff), ensure tenant context exists
        if (!decodedTenantId) {
          return res.status(401).json({ success: false, message: 'Invalid token - missing tenant information' });
        }
        
        // Check if repo agent has been force logged out
        if (decodedUserType === 'repo_agent' && (decoded.agentId || decoded.userId || decoded.agentDbId)) {
          try {
            const tenant = await Tenant.findById(decodedTenantId);
            if (tenant) {
              const tenantConnection = await getTenantDB(tenant.name);
              // Lazy require to avoid circular dependency
              const { getRepoAgentModel } = require('../routes/tenantUsers');
              const RepoAgent = getRepoAgentModel(tenantConnection);
              
              // Try to find agent by MongoDB _id first (userId or agentDbId), then by numeric agentId
              let agent = null;
              const mongoose = require('mongoose');
              
              // Check if we have a valid ObjectId (userId or agentDbId)
              const objectIdToTry = decoded.agentDbId || decoded.userId;
              if (objectIdToTry && mongoose.Types.ObjectId.isValid(objectIdToTry)) {
                agent = await RepoAgent.findById(objectIdToTry).select('forceLogoutAt status');
              }
              
              // If not found by _id, try by numeric agentId field
              if (!agent && decoded.agentId && typeof decoded.agentId === 'number') {
                agent = await RepoAgent.findOne({ agentId: decoded.agentId }).select('forceLogoutAt status');
              }
              
              // If agent doesn't exist (was deleted), force logout
              if (!agent) {
                return res.status(401).json({ 
                  success: false, 
                  message: 'Your account has been deleted. Please contact administrator.',
                  forceLogout: true
                });
              }
              
              // Check if agent is inactive
              if (agent.status !== 'active') {
                return res.status(401).json({ 
                  success: false, 
                  message: 'Your account has been deactivated. Please contact administrator.',
                  forceLogout: true
                });
              }
              
              // Check if agent has been force logged out
              if (agent.forceLogoutAt) {
                // Check if forceLogoutAt is after token issued time (or just check if it exists for immediate logout)
                // For immediate effect, we'll logout if forceLogoutAt is set
                return res.status(401).json({ 
                  success: false, 
                  message: 'You have been logged out. Please login again.',
                  forceLogout: true
                });
              }
            }
          } catch (error) {
            console.error('Error checking force logout:', error);
            // Continue with authentication if check fails
          }
        }
        
        // Check if office staff has been deleted or force logged out
        if (decodedUserType === 'office_staff' && decodedUserId) {
          try {
            const tenant = await Tenant.findById(decodedTenantId);
            if (tenant) {
              const tenantConnection = await getTenantDB(tenant.name);
              // Lazy require to avoid circular dependency
              const { getOfficeStaffModel } = require('../routes/tenantUsers');
              const OfficeStaff = getOfficeStaffModel(tenantConnection);
              
              const mongoose = require('mongoose');
              let staff = null;
              
              // Check if we have a valid ObjectId
              if (decodedUserId && mongoose.Types.ObjectId.isValid(decodedUserId)) {
                staff = await OfficeStaff.findById(decodedUserId).select('forceLogoutAt status');
              }
              
              // If staff doesn't exist (was deleted), force logout
              if (!staff) {
                return res.status(401).json({ 
                  success: false, 
                  message: 'Your account has been deleted. Please contact administrator.',
                  forceLogout: true
                });
              }
              
              // Check if staff is inactive
              if (staff.status !== 'active') {
                return res.status(401).json({ 
                  success: false, 
                  message: 'Your account has been deactivated. Please contact administrator.',
                  forceLogout: true
                });
              }
              
              // Check if staff has been force logged out
              if (staff.forceLogoutAt) {
                return res.status(401).json({ 
                  success: false, 
                  message: 'You have been logged out. Please login again.',
                  forceLogout: true
                });
              }
            }
          } catch (error) {
            console.error('Error checking office staff force logout:', error);
            // Continue with authentication if check fails
          }
        }
      }
    }
    console.log('req.user after auth:', req.user); // Log req.user
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    console.error('Unified auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Check if user is super admin
const requireSuperAdmin = (req, res, next) => {
  if (req.user.userType !== 'main_user' || req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required'
    });
  }
  next();
};

// Check if user is admin (super admin or tenant admin)
const requireAdmin = (req, res, next) => {
  if (req.user.userType !== 'main_user' || !['super_admin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Check if user is a main_user and has tenant management access
const requireTenantUserManagementAccess = (req, res, next) => {
  console.log('Executing requireTenantUserManagementAccess. req.user:', req.user); // Added log
  // Only main_users can manage tenant users
  if (req.user.userType !== 'main_user') {
    console.log('Access denied: Not a main user'); // Added log
    return res.status(403).json({
      success: false,
      message: 'Access denied: Only main users can manage tenant users'
    });
  }

  // Super admins and main admins can manage all tenant users
  if (['super_admin', 'admin'].includes(req.user.role)) {
    console.log('Access granted: Super admin or admin role'); // Added log
    return next();
  }

  // For other main_user roles, they must have a tenantId and be managing their own tenant's users
  // The tenantId for the operation is implicitly from req.user.tenantId for creation
  // For specific user operations (GET /staff/:id), we'd need to verify req.user.tenantId matches the staff/agent's tenantId
  // For now, this middleware is for creation, so we just check if the main_user has a tenantId
  if (req.user.tenantId) {
    console.log('Access granted: Main user with tenantId'); // Added log
    return next();
  }

  console.log('Access denied: Insufficient privileges (fallback)'); // Added log
  return res.status(403).json({
    success: false,
    message: 'Access denied: Insufficient privileges to manage tenant users'
  });
};

// Check if user is tenant admin or has tenant access
const requireTenantAccess = (req, res, next) => {
  const { tenantId } = req.params;
  
  // Super admin can access all tenants
  if (req.user.userType === 'main_user' && req.user.role === 'super_admin') {
    return next();
  }
  
  // Tenant admin can access their own tenant
  if (req.user.userType === 'main_user' && req.user.role === 'admin' && req.user.tenantId.toString() === tenantId) {
    return next();
  }
  
  // Tenant users can access their own tenant
  if (req.user.userType !== 'main_user' && req.user.tenantId.toString() === tenantId) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Access denied to this tenant'
  });
};

// Check if user is office staff
const requireOfficeStaff = (req, res, next) => {
  if (req.user.userType !== 'office_staff') {
    return res.status(403).json({
      success: false,
      message: 'Office staff access required'
    });
  }
  next();
};

// Check if user is repo agent
const requireRepoAgent = (req, res, next) => {
  if (req.user.userType !== 'repo_agent') {
    return res.status(403).json({
      success: false,
      message: 'Repo agent access required'
    });
  }
  next();
};

// Optional authentication (for public routes that can work with or without auth)
const optionalUnifiedAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      req.user = {
        userId: decoded.userId,
        userType: decoded.userType,
        role: decoded.role,
        tenantId: decoded.tenantId,
        tenantName: decoded.tenantName
      };
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticateUnifiedToken,
  requireSuperAdmin,
  requireAdmin,
  requireTenantAccess,
  requireOfficeStaff,
  requireRepoAgent,
  optionalUnifiedAuth,
  requireTenantUserManagementAccess
};
