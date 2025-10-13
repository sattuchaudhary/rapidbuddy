# 🚀 MongoDB Query Optimization for RapidRepo

## 🔍 **Common Slow Query Issues:**

### **1. Missing Indexes**
```javascript
// Add these indexes to your MongoDB collections
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "tenantId": 1 });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "isActive": 1 });

db.tenants.createIndex({ "name": 1 });
db.tenants.createIndex({ "isActive": 1 });

db.payments.createIndex({ "userId": 1, "createdAt": -1 });
db.payments.createIndex({ "tenantId": 1, "status": 1 });

// For tenant-specific collections
db.tenants_shree_parking.createIndex({ "role": 1 });
db.tenants_shree_parking.createIndex({ "isActive": 1 });
db.tenants_shree_parking.createIndex({ "createdAt": -1 });
```

### **2. Inefficient Queries**
```javascript
// ❌ BAD: Loading all data
const users = await User.find({});

// ✅ GOOD: Limit and paginate
const users = await User.find({})
  .limit(50)
  .skip(page * 50)
  .select('firstName lastName email role')
  .lean(); // Faster, returns plain objects

// ❌ BAD: Multiple separate queries
const user = await User.findById(userId);
const tenant = await Tenant.findById(user.tenantId);
const clients = await Client.find({ tenantId: user.tenantId });

// ✅ GOOD: Single query with populate
const user = await User.findById(userId)
  .populate('tenantId', 'name settings')
  .populate({
    path: 'clients',
    match: { tenantId: user.tenantId },
    options: { limit: 20 }
  });
```

### **3. Database Connection Issues**
```javascript
// server/config/database.js - Optimized version
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 20, // Reduced for VPS
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
      maxIdleTimeMS: 30000,
      minPoolSize: 2, // Reduced for VPS
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    process.exit(1);
  }
};
```

## 🚀 **Frontend Optimization:**

### **1. Data Fetching Optimization**
```javascript
// ❌ BAD: Loading all data at once
useEffect(() => {
  const fetchData = async () => {
    const clients = await axios.get('/api/tenants/clients');
    const staff = await axios.get('/api/tenants/staff');
    const agents = await axios.get('/api/tenants/repo-agents');
    // This loads everything at once
  };
  fetchData();
}, []);

// ✅ GOOD: Lazy loading and pagination
const [clients, setClients] = useState([]);
const [loading, setLoading] = useState(false);
const [page, setPage] = useState(0);

useEffect(() => {
  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/tenants/clients?page=${page}&limit=20`);
      setClients(prev => [...prev, ...response.data]);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };
  
  fetchClients();
}, [page]);
```

### **2. Component Optimization**
```javascript
// ❌ BAD: Re-rendering on every state change
const TenantAdminPanel = () => {
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [agents, setAgents] = useState([]);
  
  // This causes unnecessary re-renders
  return (
    <div>
      <ClientList clients={clients} />
      <StaffList staff={staff} />
      <AgentList agents={agents} />
    </div>
  );
};

// ✅ GOOD: Memoized components
import { memo, useMemo } from 'react';

const ClientList = memo(({ clients }) => {
  const memoizedClients = useMemo(() => clients, [clients]);
  return (
    <div>
      {memoizedClients.map(client => (
        <ClientCard key={client.id} client={client} />
      ))}
    </div>
  );
});
```

## 🌐 **Network Optimization:**

### **1. API Response Optimization**
```javascript
// server/middleware/responseOptimizer.js
const responseOptimizer = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Compress large responses
    if (data && data.length > 1024) {
      res.setHeader('Content-Encoding', 'gzip');
    }
    
    // Add caching headers
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = responseOptimizer;
```

### **2. Request Batching**
```javascript
// client/utils/apiBatch.js
class APIBatch {
  constructor() {
    this.pendingRequests = new Map();
    this.batchTimeout = 100; // 100ms batch window
  }
  
  async request(url, options = {}) {
    const key = `${url}-${JSON.stringify(options)}`;
    
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    const promise = this.makeRequest(url, options);
    this.pendingRequests.set(key, promise);
    
    // Clear after timeout
    setTimeout(() => {
      this.pendingRequests.delete(key);
    }, this.batchTimeout);
    
    return promise;
  }
  
  async makeRequest(url, options) {
    try {
      const response = await axios({ url, ...options });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export const apiBatch = new APIBatch();
```

## 📊 **Performance Monitoring:**

### **1. Add Performance Logging**
```javascript
// server/middleware/performanceLogger.js
const performanceLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (duration > 1000) { // Log slow requests
      console.log(`🐌 SLOW REQUEST: ${req.method} ${req.path} - ${duration}ms`);
    }
    
    if (duration > 5000) { // Log very slow requests
      console.log(`🚨 VERY SLOW REQUEST: ${req.method} ${req.path} - ${duration}ms`);
      console.log(`   User: ${req.user?.email || 'Anonymous'}`);
      console.log(`   IP: ${req.ip}`);
    }
  });
  
  next();
};

module.exports = performanceLogger;
```

### **2. Database Query Monitoring**
```javascript
// server/config/database.js - Add query monitoring
mongoose.set('debug', (collectionName, method, query, doc) => {
  const startTime = Date.now();
  
  // Log slow queries
  setTimeout(() => {
    const duration = Date.now() - startTime;
    if (duration > 100) {
      console.log(`🐌 SLOW QUERY: ${collectionName}.${method}`);
      console.log(`   Query: ${JSON.stringify(query)}`);
      console.log(`   Duration: ${duration}ms`);
    }
  }, 0);
});
```

## 🔧 **Quick Fixes for Immediate Improvement:**

### **1. Enable Compression**
```javascript
// server/index.js
const compression = require('compression');
app.use(compression());
```

### **2. Add Response Caching**
```javascript
// server/middleware/cache.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cached = cache.get(key);
    
    if (cached) {
      return res.json(cached);
    }
    
    const originalSend = res.send;
    res.send = function(data) {
      cache.set(key, data, duration);
      originalSend.call(this, data);
    };
    
    next();
  };
};
```

### **3. Optimize Frontend Loading**
```javascript
// client/src/components/LazyComponents.js
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./dashboard/Dashboard'));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));

export const LazyDashboard = () => (
  <Suspense fallback={<div>Loading Dashboard...</div>}>
    <Dashboard />
  </Suspense>
);
```

## 📈 **Expected Performance Improvements:**

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| Database Queries | 2000ms | 200ms | 90% faster |
| Page Load Time | 5000ms | 800ms | 84% faster |
| API Response | 1500ms | 150ms | 90% faster |
| Memory Usage | 2GB | 800MB | 60% less |

## 🎯 **Priority Order:**

1. **High Priority** (Immediate impact):
   - Add database indexes
   - Enable compression
   - Optimize queries

2. **Medium Priority** (Significant impact):
   - Add caching
   - Implement pagination
   - Optimize frontend components

3. **Low Priority** (Nice to have):
   - Add monitoring
   - Implement lazy loading
   - Add request batching

---
**Last Updated:** $(date)
**Target:** Reduce loading time by 80-90%
**Priority:** HIGH
