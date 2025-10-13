const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 20, // Maximum number of connections (reduced for VPS)
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      minPoolSize: 2, // Minimum number of connections (reduced for VPS)
      connectTimeoutMS: 10000, // Connection timeout
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    process.exit(1);
  }
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

module.exports = { connectDB, getTenantDB };


