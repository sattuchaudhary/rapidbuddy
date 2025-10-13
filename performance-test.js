#!/usr/bin/env node

/**
 * RapidRepo Performance Test Script
 * Tests concurrent user capacity
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

console.log('🚀 RapidRepo Performance Test\n');

// Configuration
const CONFIG = {
  baseUrl: 'http://localhost:5000',
  concurrentUsers: [10, 25, 50, 100],
  requestsPerUser: 10,
  timeout: 5000
};

// Test results storage
const results = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: []
};

// Make HTTP request
function makeRequest(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        resolve({
          statusCode: res.statusCode,
          responseTime: responseTime,
          data: data
        });
      });
    });
    
    req.on('error', (error) => {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      reject({
        error: error.message,
        responseTime: responseTime
      });
    });
    
    req.setTimeout(timeout, () => {
      req.destroy();
      reject({
        error: 'Request timeout',
        responseTime: timeout
      });
    });
  });
}

// Simulate user behavior
async function simulateUser(userId, requestsCount) {
  const userResults = {
    userId: userId,
    requests: [],
    totalTime: 0,
    successCount: 0,
    errorCount: 0
  };
  
  const startTime = performance.now();
  
  for (let i = 0; i < requestsCount; i++) {
    try {
      // Test different endpoints (only public ones)
      const endpoints = [
        '/api/health',
        '/api/health',
        '/api/health'
      ];
      
      const endpoint = endpoints[i % endpoints.length];
      const url = `${CONFIG.baseUrl}${endpoint}`;
      
      const result = await makeRequest(url);
      
      userResults.requests.push({
        endpoint: endpoint,
        statusCode: result.statusCode,
        responseTime: result.responseTime,
        success: result.statusCode >= 200 && result.statusCode < 300
      });
      
      if (result.statusCode >= 200 && result.statusCode < 300) {
        userResults.successCount++;
        results.successfulRequests++;
        results.responseTimes.push(result.responseTime);
      } else {
        userResults.errorCount++;
        results.failedRequests++;
      }
      
      results.totalRequests++;
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      userResults.errorCount++;
      results.failedRequests++;
      results.totalRequests++;
      results.errors.push({
        userId: userId,
        request: i,
        error: error.error || error.message
      });
      
      userResults.requests.push({
        endpoint: 'unknown',
        statusCode: 0,
        responseTime: error.responseTime || 0,
        success: false,
        error: error.error || error.message
      });
    }
  }
  
  const endTime = performance.now();
  userResults.totalTime = endTime - startTime;
  
  return userResults;
}

// Run performance test
async function runPerformanceTest() {
  console.log('📊 Starting Performance Test...\n');
  
  for (const userCount of CONFIG.concurrentUsers) {
    console.log(`🧪 Testing with ${userCount} concurrent users...`);
    
    // Reset results for this test
    results.totalRequests = 0;
    results.successfulRequests = 0;
    results.failedRequests = 0;
    results.responseTimes = [];
    results.errors = [];
    
    const startTime = performance.now();
    
    // Create concurrent users
    const userPromises = [];
    for (let i = 0; i < userCount; i++) {
      userPromises.push(simulateUser(i, CONFIG.requestsPerUser));
    }
    
    // Wait for all users to complete
    const userResults = await Promise.all(userPromises);
    
    const endTime = performance.now();
    const totalTestTime = endTime - startTime;
    
    // Calculate statistics
    const avgResponseTime = results.responseTimes.length > 0 
      ? results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length 
      : 0;
    
    const minResponseTime = results.responseTimes.length > 0 
      ? Math.min(...results.responseTimes) 
      : 0;
    
    const maxResponseTime = results.responseTimes.length > 0 
      ? Math.max(...results.responseTimes) 
      : 0;
    
    const successRate = results.totalRequests > 0 
      ? (results.successfulRequests / results.totalRequests) * 100 
      : 0;
    
    const requestsPerSecond = results.totalRequests / (totalTestTime / 1000);
    
    // Display results
    console.log(`\n📈 Results for ${userCount} concurrent users:`);
    console.log(`   Total Requests: ${results.totalRequests}`);
    console.log(`   Successful: ${results.successfulRequests}`);
    console.log(`   Failed: ${results.failedRequests}`);
    console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   Min Response Time: ${minResponseTime.toFixed(2)}ms`);
    console.log(`   Max Response Time: ${maxResponseTime.toFixed(2)}ms`);
    console.log(`   Requests/Second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`   Total Test Time: ${(totalTestTime / 1000).toFixed(2)}s`);
    
    if (results.errors.length > 0) {
      console.log(`   Errors: ${results.errors.length}`);
      console.log(`   Error Rate: ${(results.errors.length / results.totalRequests * 100).toFixed(2)}%`);
    }
    
    // Performance assessment
    if (successRate >= 95 && avgResponseTime < 500) {
      console.log(`   ✅ Performance: EXCELLENT`);
    } else if (successRate >= 90 && avgResponseTime < 1000) {
      console.log(`   ✅ Performance: GOOD`);
    } else if (successRate >= 80 && avgResponseTime < 2000) {
      console.log(`   ⚠️  Performance: ACCEPTABLE`);
    } else {
      console.log(`   ❌ Performance: POOR`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Final summary
  console.log('🎯 Performance Test Summary:');
  console.log('   • Monitor response times and success rates');
  console.log('   • Consider optimization if response time > 500ms');
  console.log('   • Consider scaling if success rate < 95%');
  console.log('   • Check server logs for errors');
  console.log('\n📚 For optimization tips, see: performance-optimization.md');
}

// Check if server is running
async function checkServer() {
  try {
    const result = await makeRequest(`${CONFIG.baseUrl}/api/health`);
    if (result.statusCode === 200) {
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
  
  console.log('\n🚀 Starting performance test...');
  console.log(`   Base URL: ${CONFIG.baseUrl}`);
  console.log(`   Test Users: ${CONFIG.concurrentUsers.join(', ')}`);
  console.log(`   Requests per User: ${CONFIG.requestsPerUser}`);
  console.log(`   Timeout: ${CONFIG.timeout}ms\n`);
  
  await runPerformanceTest();
  
  console.log('🏁 Performance test completed!');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the test
main().catch(console.error);
