#!/usr/bin/env node

/**
 * RapidRepo Security Audit Script
 * Run this script to check for common security issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 RapidRepo Security Audit\n');

// Check 1: Environment Variables
console.log('1. Checking Environment Variables...');
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  
  // Check for weak JWT secret
  if (envContent.includes('JWT_SECRET=your_super_secret_jwt_key_here')) {
    console.log('   ❌ WARNING: Default JWT secret detected!');
    console.log('   🔧 Fix: Change JWT_SECRET to a strong random string');
  } else {
    console.log('   ✅ JWT secret appears to be customized');
  }
  
  // Check for default MongoDB URI
  if (envContent.includes('mongodb://localhost:27017/rapidrepo')) {
    console.log('   ⚠️  INFO: Using local MongoDB (OK for development)');
  } else {
    console.log('   ✅ MongoDB URI appears to be configured');
  }
} else {
  console.log('   ❌ WARNING: .env file not found!');
  console.log('   🔧 Fix: Create .env file from env.example');
}

// Check 2: Package Dependencies
console.log('\n2. Checking Dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Check for known vulnerable packages
  const vulnerablePackages = [
    'express', 'mongoose', 'jsonwebtoken', 'bcryptjs', 'helmet', 'cors'
  ];
  
  vulnerablePackages.forEach(pkg => {
    if (dependencies[pkg]) {
      console.log(`   ✅ ${pkg} is installed`);
    } else {
      console.log(`   ⚠️  ${pkg} not found in dependencies`);
    }
  });
} catch (error) {
  console.log('   ❌ Error reading package.json');
}

// Check 3: Server Configuration
console.log('\n3. Checking Server Configuration...');
try {
  const serverFile = fs.readFileSync('server/index.js', 'utf8');
  
  if (serverFile.includes('helmet()')) {
    console.log('   ✅ Helmet security middleware detected');
  } else {
    console.log('   ❌ WARNING: Helmet not found');
  }
  
  if (serverFile.includes('rateLimit')) {
    console.log('   ✅ Rate limiting detected');
  } else {
    console.log('   ❌ WARNING: Rate limiting not found');
  }
  
  if (serverFile.includes('cors()')) {
    console.log('   ✅ CORS middleware detected');
  } else {
    console.log('   ❌ WARNING: CORS not configured');
  }
} catch (error) {
  console.log('   ❌ Error reading server configuration');
}

// Check 4: Client Configuration
console.log('\n4. Checking Client Configuration...');
try {
  const clientPackageJson = JSON.parse(fs.readFileSync('client/package.json', 'utf8'));
  
  if (clientPackageJson.dependencies['react']) {
    console.log('   ✅ React is installed');
  }
  
  if (clientPackageJson.dependencies['@mui/material']) {
    console.log('   ✅ Material-UI is installed');
  }
} catch (error) {
  console.log('   ❌ Error reading client configuration');
}

// Check 5: File Permissions (Unix/Linux only)
console.log('\n5. Checking File Permissions...');
if (process.platform !== 'win32') {
  try {
    const stats = fs.statSync('.env');
    const mode = stats.mode & parseInt('777', 8);
    
    if (mode > parseInt('600', 8)) {
      console.log('   ❌ WARNING: .env file has overly permissive permissions');
      console.log('   🔧 Fix: Run: chmod 600 .env');
    } else {
      console.log('   ✅ .env file permissions look secure');
    }
  } catch (error) {
    console.log('   ⚠️  Could not check .env permissions');
  }
} else {
  console.log('   ⚠️  File permission check skipped (Windows)');
}

// Summary
console.log('\n📋 Security Audit Summary:');
console.log('   • Review all warnings above');
console.log('   • Change default passwords and secrets');
console.log('   • Enable HTTPS in production');
console.log('   • Configure firewall properly');
console.log('   • Run regular security updates');
console.log('   • Monitor logs for suspicious activity');

console.log('\n🔒 Security audit complete!');
console.log('   For detailed security guidelines, see: SECURITY_CHECKLIST.md');



