#!/usr/bin/env node

/**
 * RapidRepo Performance Diagnostic Tool
 * Identifies slow loading issues
 */

const http = require('http');
const { performance } = require('perf_hooks');

console.log('🔍 RapidRepo Performance Diagnostic\n');

// Test different endpoints
const endpoints = [
  { path: '/api/health', name: 'Health Check' },
  { path: '/api/unified-auth/profile', name: 'User Profile' },
  { path: '/api/tenants/clients', name: 'Clients Data' },
  { path: '/api/tenants/staff', name: 'Staff Data' },
  { path: '/api/tenants/repo-agents', name: 'Repo Agents' }
];

const baseUrl = 'http://localhost:5000';

// Make request with detailed timing
async function testEndpoint(endpoint) {
  const startTime = performance.now();
  
  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}${endpoint.path}`, (res) => {
      let data = '';
      const responseStart = performance.now();
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const responseTime = responseStart - startTime;
        const dataTime = endTime - responseStart;
        
        resolve({
          endpoint: endpoint.name,
          path: endpoint.path,
          statusCode: res.statusCode,
          totalTime: totalTime,
          responseTime: responseTime,
          dataTime: dataTime,
          dataSize: data.length,
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });
    
    req.on('error', (error) => {
      const endTime = performance.now();
      resolve({
        endpoint: endpoint.name,
        path: endpoint.path,
        statusCode: 0,
        totalTime: endTime - startTime,
        responseTime: 0,
        dataTime: 0,
        dataSize: 0,
        success: false,
        error: error.message
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        endpoint: endpoint.name,
        path: endpoint.path,
        statusCode: 0,
        totalTime: 10000,
        responseTime: 0,
        dataTime: 0,
        dataSize: 0,
        success: false,
        error: 'Request timeout'
      });
    });
  });
}

// Test server performance
async function runDiagnostic() {
  console.log('📊 Testing server performance...\n');
  
  const results = [];
  
  for (const endpoint of endpoints) {
    console.log(`🧪 Testing ${endpoint.name}...`);
    
    // Test multiple times for average
    const tests = [];
    for (let i = 0; i < 3; i++) {
      const result = await testEndpoint(endpoint);
      tests.push(result);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    }
    
    // Calculate average
    const avgResult = {
      endpoint: endpoint.name,
      path: endpoint.path,
      avgTotalTime: tests.reduce((sum, t) => sum + t.totalTime, 0) / tests.length,
      avgResponseTime: tests.reduce((sum, t) => sum + t.responseTime, 0) / tests.length,
      avgDataTime: tests.reduce((sum, t) => sum + t.dataTime, 0) / tests.length,
      avgDataSize: tests.reduce((sum, t) => sum + t.dataSize, 0) / tests.length,
      successRate: tests.filter(t => t.success).length / tests.length,
      statusCode: tests[0].statusCode,
      error: tests[0].error
    };
    
    results.push(avgResult);
    
    // Display result
    if (avgResult.successRate > 0) {
      console.log(`   ✅ Status: ${avgResult.statusCode}`);
      console.log(`   ⏱️  Total Time: ${avgResult.avgTotalTime.toFixed(2)}ms`);
      console.log(`   🚀 Response Time: ${avgResult.avgResponseTime.toFixed(2)}ms`);
      console.log(`   📦 Data Transfer: ${avgResult.avgDataTime.toFixed(2)}ms`);
      console.log(`   📊 Data Size: ${(avgResult.avgDataSize / 1024).toFixed(2)}KB`);
      console.log(`   ✅ Success Rate: ${(avgResult.successRate * 100).toFixed(1)}%`);
      
      // Performance assessment
      if (avgResult.avgTotalTime < 100) {
        console.log(`   🟢 Performance: EXCELLENT`);
      } else if (avgResult.avgTotalTime < 500) {
        console.log(`   🟡 Performance: GOOD`);
      } else if (avgResult.avgTotalTime < 1000) {
        console.log(`   🟠 Performance: ACCEPTABLE`);
      } else {
        console.log(`   🔴 Performance: POOR`);
      }
    } else {
      console.log(`   ❌ Failed: ${avgResult.error || 'Unknown error'}`);
    }
    
    console.log('');
  }
  
  // Summary analysis
  console.log('📋 Performance Analysis Summary:\n');
  
  const successfulResults = results.filter(r => r.successRate > 0);
  
  if (successfulResults.length > 0) {
    const avgTotalTime = successfulResults.reduce((sum, r) => sum + r.avgTotalTime, 0) / successfulResults.length;
    const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.avgResponseTime, 0) / successfulResults.length;
    const avgDataTime = successfulResults.reduce((sum, r) => sum + r.avgDataTime, 0) / successfulResults.length;
    
    console.log(`📊 Overall Performance:`);
    console.log(`   Average Total Time: ${avgTotalTime.toFixed(2)}ms`);
    console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   Average Data Transfer: ${avgDataTime.toFixed(2)}ms`);
    
    // Identify bottlenecks
    console.log(`\n🔍 Bottleneck Analysis:`);
    
    if (avgResponseTime > avgDataTime * 2) {
      console.log(`   🔴 Server Processing: SLOW (${avgResponseTime.toFixed(2)}ms)`);
      console.log(`      → Check database queries`);
      console.log(`      → Check server CPU usage`);
      console.log(`      → Check MongoDB performance`);
    } else {
      console.log(`   🟢 Server Processing: OK (${avgResponseTime.toFixed(2)}ms)`);
    }
    
    if (avgDataTime > avgResponseTime) {
      console.log(`   🔴 Data Transfer: SLOW (${avgDataTime.toFixed(2)}ms)`);
      console.log(`      → Check network connection`);
      console.log(`      → Check data size optimization`);
      console.log(`      → Check VPS bandwidth`);
    } else {
      console.log(`   🟢 Data Transfer: OK (${avgDataTime.toFixed(2)}ms)`);
    }
    
    if (avgTotalTime > 1000) {
      console.log(`   🔴 Overall Performance: POOR`);
      console.log(`      → Multiple issues detected`);
      console.log(`      → Consider optimization`);
    } else if (avgTotalTime > 500) {
      console.log(`   🟡 Overall Performance: NEEDS IMPROVEMENT`);
    } else {
      console.log(`   🟢 Overall Performance: GOOD`);
    }
  } else {
    console.log(`❌ No successful requests - check server status`);
  }
  
  // Recommendations
  console.log(`\n💡 Recommendations:`);
  
  if (successfulResults.some(r => r.avgTotalTime > 1000)) {
    console.log(`   🔧 High Priority:`);
    console.log(`      • Optimize database queries`);
    console.log(`      • Add database indexes`);
    console.log(`      • Check VPS resources`);
    console.log(`      • Enable caching`);
  }
  
  if (successfulResults.some(r => r.avgDataTime > 500)) {
    console.log(`   🌐 Network Issues:`);
    console.log(`      • Check VPS bandwidth`);
    console.log(`      • Optimize data size`);
    console.log(`      • Consider CDN`);
  }
  
  console.log(`\n📚 For detailed optimization, see: performance-optimization.md`);
}

// Check server status first
async function checkServer() {
  try {
    const result = await testEndpoint({ path: '/api/health', name: 'Health Check' });
    if (result.success) {
      console.log('✅ Server is running and responding');
      return true;
    } else {
      console.log('❌ Server is not responding properly');
      return false;
    }
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log('   Make sure to start the server with: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔍 Checking server status...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  
  console.log('\n🚀 Starting performance diagnostic...');
  await runDiagnostic();
  
  console.log('\n🏁 Diagnostic completed!');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the diagnostic
main().catch(console.error);
