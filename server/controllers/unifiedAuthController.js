const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/database');
const mongoose = require('mongoose');
const { getOfficeStaffModel, getRepoAgentModel } = require('../routes/tenantUsers');

// Controlled logging function
const log = (message, ...args) => {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
    console.log(message, ...args);
  }
};

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Unified Login Controller
const unifiedLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or phone
    
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Identifier (email/phone) and password are required'
      });
    }

    // Avoid logging raw identifiers to prevent sensitive data exposure
    const redactedId = typeof identifier === 'string' ? identifier.replace(/.(?=.{3})/g, '*') : '***';
    log('[UnifiedLogin] Attempting login');
    log('[UnifiedLogin] Checking main system users first');

    // Step 1: Check main system users (Super Admin, Tenant Admin, Regular Users)
    const mainUser = await User.findOne({ 
      email: identifier.toLowerCase().trim() 
    }).select('+password');

    if (mainUser && mainUser.isActive) {
      const isPasswordValid = await mainUser.comparePassword(password);
      
      if (isPasswordValid) {
        // Update last login
        mainUser.lastLogin = new Date();
        await mainUser.save();

        const token = generateToken({
          userId: mainUser._id,
          userType: 'main_user',
          role: mainUser.role,
          tenantId: mainUser.tenantId
        });

        console.log('[UnifiedLogin] Main user login successful');

        return res.json({
          success: true,
          message: 'Login successful',
          data: {
            user: {
              id: mainUser._id,
              firstName: mainUser.firstName,
              lastName: mainUser.lastName,
              email: mainUser.email,
              role: mainUser.role,
              tenantId: mainUser.tenantId,
              userType: 'main_user'
            },
            token,
            redirectTo: mainUser.role === 'super_admin' ? '/admin' : 
                      mainUser.role === 'admin' ? '/tenant' : '/dashboard'
          }
        });
      }
    }

    // Step 2: Check tenant users (Office Staff and Repo Agents)
    log('[UnifiedLogin] Main user not found, checking tenant users');
    
    const tenants = await Tenant.find({ isActive: true }).lean();
    log(`[UnifiedLogin] Found ${tenants.length} active tenants to check`);
    
    let foundTenantUser = null;
    let foundInactiveTenant = null;
    let foundInvalidPassword = false;

    for (const tenant of tenants) {
      try {
        const conn = await getTenantDB(tenant.name);
        log(`[UnifiedLogin] Checking tenant: ${tenant.name}`);
        
        // Check Office Staff (allow raw or digits-only phone)
        const OfficeStaff = getOfficeStaffModel(conn);
        log('[UnifiedLogin] Using OfficeStaff model with schema fields:', Object.keys(OfficeStaff.schema.paths));
        
        const raw = String(identifier || '').trim();
        const digits = raw.replace(/\D/g, '');
        const staff = await OfficeStaff.findOne({
          $or: [
            { phoneNumber: raw },
            { phoneNumber: digits }
          ]
        }).select('+password');

        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
          console.log(`[UnifiedLogin][${tenant.name}][OfficeStaff] Query result:`, staff ? 'Found' : 'Not found');
        }

        if (staff) {
          if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
            console.log(`[UnifiedLogin][${tenant.name}][OfficeStaff] Status:`, staff?.status);
          }

          if (staff.status !== 'active') {
            log(`[UnifiedLogin][${tenant.name}][OfficeStaff] Account inactive`);
            log(`[UnifiedLogin] Tenant ${tenant.name} check complete: account_inactive`);
            foundInactiveTenant = { tenant, userType: 'office_staff' };
            continue;
          }

          if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
            console.log(`[UnifiedLogin][${tenant.name}][OfficeStaff] Found and active, verifying password`);
          }

          const isPasswordValid = await bcrypt.compare(password, staff.password);

          if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
            console.log(`[UnifiedLogin][${tenant.name}][OfficeStaff] Password valid:`, isPasswordValid);
          }

          if (!isPasswordValid) {
            console.log(`[UnifiedLogin][${tenant.name}][OfficeStaff] Password verification failed`);
            console.log(`[UnifiedLogin] Tenant ${tenant.name} check complete: password_invalid`);
            return res.status(401).json({
              success: false,
              message: 'Invalid credentials'
            });
          }

          foundTenantUser = {
            user: staff,
            tenant: tenant,
            userType: 'office_staff'
          };
          console.log(`[UnifiedLogin] Tenant ${tenant.name} check complete: success`);
          break;
        }

        // Check Repo Agents
        const RepoAgent = getRepoAgentModel(conn);
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
          console.log('[UnifiedLogin] Using RepoAgent model with schema fields:', Object.keys(RepoAgent.schema.paths));
        }
        const agentRaw = String(identifier || '').trim();
        const agentDigits = agentRaw.replace(/\D/g, '');
        const emailId = String(identifier || '').toLowerCase().trim();
        
        // Query for agent - explicitly select password field to ensure it's included
        // Try with select first, if that fails (field doesn't have select: false), try without
        let agent = null;
        try {
          agent = await RepoAgent.findOne({
            $or: [
              { email: emailId },
              { phoneNumber: agentRaw },
              { phoneNumber: agentDigits }
            ]
          }).select('+password');
        } catch (selectError) {
          // If select('+password') fails, try without it (password might not have select: false)
          console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Select +password failed, trying without select`);
          agent = await RepoAgent.findOne({
            $or: [
              { email: emailId },
              { phoneNumber: agentRaw },
              { phoneNumber: agentDigits }
            ]
          });
        }

        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
          console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Query result:`, agent ? 'Found' : 'Not found');
          if (agent) {
            console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Agent email:`, agent.email);
            console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Agent phone:`, agent.phoneNumber);
            console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Password exists:`, !!agent.password);
            console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Password length:`, agent.password ? agent.password.length : 0);
          }
        }

        if (agent) {
          if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
            console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Status:`, agent?.status);
          }

          if (agent.status !== 'active') {
            log(`[UnifiedLogin][${tenant.name}][RepoAgent] Account inactive`);
            log(`[UnifiedLogin] Tenant ${tenant.name} check complete: account_inactive`);
            foundInactiveTenant = { tenant, userType: 'repo_agent' };
            continue;
          }

          if (!agent.password) {
            console.error(`[UnifiedLogin][${tenant.name}][RepoAgent] Password field is missing or null`);
            console.log(`[UnifiedLogin] Tenant ${tenant.name} check complete: password_missing`);
            continue;
          }

          if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
            console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Found and active, verifying password`);
          }

          const provided = String(password || '').trim();
          const stored = String(agent.password || '').trim();
          let isPasswordValid = false;

          // Try bcrypt comparison first
          try {
            isPasswordValid = await bcrypt.compare(provided, stored);
          } catch (err) {
            console.error(`[UnifiedLogin][${tenant.name}][RepoAgent] Bcrypt compare error:`, err.message);
            isPasswordValid = false;
          }

          // Backward compatibility: if stored password is plaintext and matches, migrate to hashed
          if (!isPasswordValid && stored === provided) {
            try {
              console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Plaintext password detected, migrating to hash`);
              const salt = await bcrypt.genSalt(12);
              agent.password = await bcrypt.hash(provided, salt);
              await agent.save();
              isPasswordValid = true;
              console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Password migrated successfully`);
            } catch (err) {
              console.error(`[UnifiedLogin][${tenant.name}][RepoAgent] Password migration error:`, err.message);
              isPasswordValid = false;
            }
          }

          if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
            console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Password valid:`, isPasswordValid);
            if (!isPasswordValid) {
              console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Password comparison failed`);
              console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Provided password length:`, provided.length);
              console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Stored password length:`, stored.length);
              console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Stored password starts with $2b$ (bcrypt):`, stored.startsWith('$2b$'));
            }
          }

          if (!isPasswordValid) {
            console.log(`[UnifiedLogin][${tenant.name}][RepoAgent] Password verification failed`);
            console.log(`[UnifiedLogin] Tenant ${tenant.name} check complete: password_invalid`);
            foundInvalidPassword = true;
            continue; // Continue checking other tenants instead of returning immediately
          }

          foundTenantUser = {
            user: agent,
            tenant: tenant,
            userType: 'repo_agent'
          };
          console.log(`[UnifiedLogin] Tenant ${tenant.name} check complete: success`);
          break;
        }

        if (!foundTenantUser) {
          console.log(`[UnifiedLogin] Tenant ${tenant.name} check complete: user_not_found`);
        }

      } catch (error) {
        console.error(`Error checking tenant ${tenant.name}:`, error.message);
        continue;
      }
    }

    // Add a small constant-time delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 100));

    // Handle inactive account case first
    if (foundInactiveTenant && !foundTenantUser) {
      return res.status(401).json({
        success: false,
        message: 'Your account is inactive. Please contact your administrator.'
      });
    }

    // Handle invalid password case
    if (foundInvalidPassword && !foundTenantUser) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (foundTenantUser) {
      const { user, tenant, userType } = foundTenantUser;

      // Clear forceLogoutAt on successful login for repo agents
      if (userType === 'repo_agent' && user.forceLogoutAt) {
        user.forceLogoutAt = null;
        await user.save();
      }

      // Build token payload with conditional fields
      const tokenPayload = {
        userId: user._id,
        userType: userType,
        tenantId: tenant._id,
        tenantName: tenant.name,
        role: user.role || userType
      };

      // Add user-type-specific numeric ID field and also Mongo _id under a distinct key
      if (userType === 'repo_agent') {
        tokenPayload.agentId = user.agentId || user._id; // numeric field or Mongo _id fallback
        tokenPayload.agentDbId = user._id; // always include Mongo _id
      } else if (userType === 'office_staff') {
        tokenPayload.staffId = user.staffId || user._id; // numeric field or Mongo _id fallback
        tokenPayload.staffDbId = user._id; // always include Mongo _id
      }

      const token = generateToken(tokenPayload);

      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
        console.log('[UnifiedLogin] Tenant user login successful');
      }

      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email || null,
            phoneNumber: user.phoneNumber || null,
            role: user.role || userType,
            tenantId: tenant._id,
            tenantName: tenant.name,
            userType: userType
          },
          token,
          redirectTo: userType === 'office_staff' ? '/staff-dashboard' : '/agent-dashboard'
        }
      });
    }

    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_AUTH === 'true') {
      console.log('[UnifiedLogin] No matching user found in any tenant');
    }
    // If no user found
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });

  } catch (error) {
    console.error('Unified login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get user profile (works for all user types)
const getUnifiedProfile = async (req, res) => {
  try {
    const { userId, userType, tenantId, tenantName } = req.user;
    console.log(`[UnifiedProfile] Fetching profile for userType: ${userType}, userId: ${userId}`);

    if (userType === 'main_user') {
      // Get main user profile
      const user = await User.findById(userId).populate('tenantId');
      
      return res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            userType: 'main_user'
          }
        }
      });
    } else {
      // Get tenant user profile
      const conn = await getTenantDB(tenantName);
      let user = null;

      if (userType === 'office_staff') {
        const OfficeStaff = getOfficeStaffModel(conn);
        console.log(`[UnifiedProfile] Using OfficeStaff model for tenant: ${tenantName}`);
        user = await OfficeStaff.findById(userId);
      } else if (userType === 'repo_agent') {
        const RepoAgent = getRepoAgentModel(conn);
        console.log(`[UnifiedProfile] Using RepoAgent model for tenant: ${tenantName}`);
        user = await RepoAgent.findById(userId);
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      return res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email || null,
            phoneNumber: user.phoneNumber || null,
            role: user.role || userType,
            tenantId: tenantId,
            tenantName: tenantName,
            userType: userType
          }
        }
      });
    }

  } catch (error) {
    console.error('Get unified profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  unifiedLogin,
  getUnifiedProfile
};
