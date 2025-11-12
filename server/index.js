
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');
const unifiedAuthRoutes = require('./routes/unifiedAuth');
const adminRoutes = require('./routes/admin');
const historyRoutes = require('./routes/history');
const userRoutes = require('./routes/user');
const tenantRoutes = require('./routes/tenant');
const paymentsRoutes = require('./routes/payments');
const { authenticateUnifiedToken } = require('./middleware/unifiedAuth');
const { requireActiveSubscription } = require('./middleware/subscription');
const { deleteOldScreenshots } = require('./utils/deleteOldScreenshots');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// GLOBAL ERROR HANDLERS - CRITICAL FOR STABILITY
// ============================================

// Handle uncaught exceptions (synchronous errors)
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error:', err.name, err.message);
  console.error('Stack:', err.stack);
  
  // Log to file or monitoring service in production
  // Give time for logging before exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle unhandled promise rejections (async errors)
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION! Shutting down...');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  
  // Log to file or monitoring service in production
  // Give time for logging before exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle warnings
process.on('warning', (warning) => {
  console.warn('⚠️ Warning:', warning.name);
  console.warn('Message:', warning.message);
  console.warn('Stack:', warning.stack);
});

// ============================================
// GRACEFUL SHUTDOWN HANDLING
// ============================================
let server;

const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed.');
    
    // Close MongoDB connections
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed.');
      console.log('👋 Process terminated gracefully.');
      process.exit(0);
    });
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// MEMORY MONITORING
// ============================================
const checkMemoryUsage = () => {
  const used = process.memoryUsage();
  const formatMB = (bytes) => Math.round(bytes / 1024 / 1024 * 100) / 100;
  
  const memoryInfo = {
    rss: `${formatMB(used.rss)} MB`,
    heapTotal: `${formatMB(used.heapTotal)} MB`,
    heapUsed: `${formatMB(used.heapUsed)} MB`,
    external: `${formatMB(used.external)} MB`
  };
  
  // Log if memory usage is high (> 80% of 2GB limit)
  if (used.heapUsed > 1600 * 1024 * 1024) {
    console.warn('⚠️ High memory usage detected:', memoryInfo);
  }
  
  return memoryInfo;
};

// Monitor memory every 5 minutes
setInterval(() => {
  const mem = checkMemoryUsage();
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Memory usage:', mem);
  }
}, 5 * 60 * 1000);

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'http://localhost:19006',
      'http://127.0.0.1:19006',
      'https://kanufox.com',
      'http://www.kanufox.com',
      'https://rapidrepo.cloud',
      'http://rapidrepo.cloud',
      'https://rapidbuddy.cloud',
      'http://rapidbuddy.cloud',
      'https://api.rapidbuddy.cloud',
      'http://api.rapidbuddy.cloud'
    ];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    // In production, reject unknown origins; in development, allow
    const isDev = (process.env.NODE_ENV !== 'production');
    return isDev ? callback(null, true) : callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Rate limiting - more generous for data operations
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for general API usage
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// More restrictive rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Strict limit for auth
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Body parser middleware with safer limits
app.use(express.json({ 
  limit: '50mb' // Reduced from 100mb to prevent memory issues
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '50mb' // Reduced from 100mb to prevent memory issues
}));

// Request timeout middleware - prevents hanging requests
const timeout = require('connect-timeout');
app.use(timeout('120s')); // 2 minutes timeout for requests

// Timeout handler
app.use((req, res, next) => {
  if (!req.timedout) next();
});

// Request timeout error handler
app.use((req, res, next) => {
  if (req.timedout) {
    return res.status(408).json({
      success: false,
      message: 'Request timeout. Please try again.',
      error: 'REQUEST_TIMEOUT'
    });
  }
  next();
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/unified-auth', authLimiter, unifiedAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/tenants', tenantRoutes);
// Tenant-specific routes (must come before /api/tenant to avoid conflicts)
app.use('/api/tenant/clients', require('./routes/client'));
app.use('/api/tenant/users', require('./routes/tenantUsers'));
app.use('/api/tenant/mobile', require('./routes/mobileUpload'));
app.use('/api/tenant/data', require('./routes/fileManagement'));
app.use('/api/tenant', tenantRoutes); // Add singular route for tenant-specific endpoints
app.use('/api/mobile', require('./routes/pushNotifications'));
app.use('/api/payments', paymentsRoutes);
app.use('/api/bulk-download', require('./routes/bulkDownload'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
// Static hosting for uploaded files
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Health check endpoint with detailed status
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const memory = checkMemoryUsage();
  
  res.json({ 
    status: dbStatus === 1 ? 'OK' : 'DEGRADED',
    message: 'RapidRepo API is running',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStates[dbStatus],
      connected: dbStatus === 1
    },
    memory: memory,
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Start server
server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💾 Memory limit: ~2GB`);
  console.log(`⏱️  Request timeout: 120s`);
  
  // Initial memory check
  const mem = checkMemoryUsage();
  console.log(`📊 Initial memory usage:`, mem);
  
  // Schedule screenshot deletion task (run every 6 hours)
  setInterval(async () => {
    try {
      await deleteOldScreenshots();
    } catch (err) {
      console.error('Error in scheduled screenshot deletion:', err);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours
  
  // Run immediately on startup (after a short delay to ensure DB is connected)
  setTimeout(async () => {
    try {
      await deleteOldScreenshots();
    } catch (err) {
      console.error('Error in initial screenshot deletion:', err);
    }
  }, 30000); // 30 seconds after startup
});

// Server error handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

// Handle server connection errors
server.on('clientError', (err, socket) => {
  console.error('❌ Client error:', err.message);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
