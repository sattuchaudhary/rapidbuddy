const mongoose = require('mongoose');

// Database connection state
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const connectDB = async () => {
  try {
    // Set up connection event handlers BEFORE connecting
    mongoose.connection.on('connected', () => {
      console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
      isConnected = true;
      reconnectAttempts = 0;
    });

    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB connection error: ${err.message}`);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
      isConnected = false;
      
      // Auto-reconnect logic
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(() => {
          console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
          connectDB().catch(err => {
            console.error('❌ Reconnection failed:', err.message);
          });
        }, 5000 * reconnectAttempts); // Exponential backoff
      } else {
        console.error('❌ Max reconnection attempts reached. Please check MongoDB connection.');
      }
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
      isConnected = true;
      reconnectAttempts = 0;
    });

    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 20, // Maximum number of connections (reduced for VPS)
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      minPoolSize: 2, // Minimum number of connections (reduced for VPS)
      connectTimeoutMS: 10000, // Connection timeout
      retryWrites: true,
      retryReads: true,
    });

    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    isConnected = false;
    
    // Don't exit immediately - allow retry
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`🔄 Will retry connection in 5 seconds... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(() => {
        connectDB().catch(err => {
          console.error('❌ Retry failed:', err.message);
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('❌ Max connection attempts reached. Exiting...');
            process.exit(1);
          }
        });
      }, 5000);
    } else {
      console.error('❌ Max connection attempts reached. Exiting...');
      process.exit(1);
    }
  }
};

// Helper function to check if database is connected
const isDBConnected = () => {
  return isConnected && mongoose.connection.readyState === 1;
};

// Get tenant database connection (robust URI handling)
const getTenantDB = async (tenantName) => {
  const dbName = `tenants_${String(tenantName).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Reuse existing connection if available
  const existing = mongoose.connections.find(conn => conn && conn.name === dbName);
  if (existing) return existing;

  // Build tenant URI safely regardless of base DB name
  const baseUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rapidrepo';
  // Preserve query string (e.g., authSource) when deriving tenant URI
  const [baseWithoutQuery, queryString] = baseUri.split('?');
  // Replace the last path segment (db name) with tenant DB name
  const derivedBase = baseWithoutQuery.replace(/\/?[^/]+$/, '/') + dbName;
  const tenantUri = queryString ? `${derivedBase}?${queryString}` : derivedBase;

  const conn = mongoose.createConnection(tenantUri, {
    maxPoolSize: 10, // Smaller pool for tenant connections
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 10000,
  });

  await new Promise((resolve, reject) => {
    conn.once('connected', resolve);
    conn.once('error', reject);
    // Optional safety timeout
    setTimeout(() => reject(new Error(`Tenant DB connect timeout: ${dbName}`)), 8000);
  });

  return conn;
};

module.exports = { connectDB, getTenantDB, isDBConnected };


