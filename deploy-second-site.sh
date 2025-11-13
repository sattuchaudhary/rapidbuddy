#!/bin/bash

# Second Website Deployment Script for RapidRepo
# Run this script on your VPS with: sudo bash deploy-second-site.sh
# यह script आपकी दूसरी website को VPS पर deploy करने के लिए है

set -e  # Exit on any error

# Configuration - अपने domain और settings यहाँ update करें
DOMAIN="rapidrepo.com"  # अपना domain यहाँ डालें
APP_DIR="/var/www/rapidrepo"
REPO_URL="https://github.com/yourusername/rapidrepo.git"  # अपना repo URL डालें
NODE_VERSION="18"
API_PORT="5001"  # पहली website 5000 use कर रही है, इसलिए 5001 use करें

echo "🚀 Starting Second Website Deployment for RapidRepo..."
echo "📁 Directory: $APP_DIR"
echo "🌐 Domain: $DOMAIN"
echo "🔌 API Port: $API_PORT"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Check if directory already exists
if [ -d "$APP_DIR" ]; then
    echo "⚠️  Directory $APP_DIR already exists"
    read -p "Do you want to continue? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create application directory
echo "📁 Creating application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone repository or copy files
echo "📥 Setting up application files..."
if [ -d ".git" ]; then
    echo "🔄 Updating existing repository..."
    git pull origin main
else
    echo "📥 Cloning repository..."
    if [ -n "$REPO_URL" ] && [ "$REPO_URL" != "https://github.com/yourusername/rapidrepo.git" ]; then
        git clone $REPO_URL .
    else
        echo "⚠️  Please update REPO_URL in the script or copy files manually"
        echo "You can copy files using:"
        echo "  scp -r /path/to/local/rapidrepo/* root@your-vps:/var/www/rapidrepo/"
        read -p "Press Enter after copying files..."
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."
if [ -f "package.json" ]; then
    npm install
else
    echo "❌ package.json not found. Please ensure files are copied correctly."
    exit 1
fi

# Build client
if [ -d "client" ]; then
    echo "📦 Building client..."
    cd client
    npm install
    npm run build
    cd ..
else
    echo "⚠️  Client directory not found. Skipping client build."
fi

# Create production environment file
echo "⚙️  Setting up environment configuration..."
if [ ! -f ".env.production" ]; then
    if [ -f "env.production.example" ]; then
        cp env.production.example .env.production
        echo "📝 Created .env.production from example"
        echo "⚠️  IMPORTANT: Please edit .env.production with your production values"
        echo "   - Update PORT to $API_PORT"
        echo "   - Update MONGODB_URI (use different database name if needed)"
        echo "   - Update CLIENT_URL to https://$DOMAIN"
        echo "   - Update JWT_SECRET"
    else
        echo "⚠️  env.production.example not found. Creating basic .env.production"
        cat > .env.production << EOF
NODE_ENV=production
PORT=$API_PORT
MONGODB_URI=mongodb://rapidrepo_app:password@localhost:27017/rapidrepo_prod2
JWT_SECRET=your_secure_jwt_secret_here
CLIENT_URL=https://$DOMAIN
EOF
        echo "⚠️  Please edit .env.production with your production values"
    fi
fi

# Set up application user
echo "👤 Setting up application user..."
if ! id "rapidrepo2" &>/dev/null; then
    useradd -r -s /bin/false -d $APP_DIR rapidrepo2
fi

# Set proper permissions
chown -R rapidrepo2:rapidrepo2 $APP_DIR
chmod -R 755 $APP_DIR

# Create log directory
mkdir -p /var/log/rapidrepo2
chown -R rapidrepo2:rapidrepo2 /var/log/rapidrepo2

# Configure PM2 for second instance
echo "⚙️  Configuring PM2 for second website..."
cat > $APP_DIR/ecosystem-second.config.js << EOF
module.exports = {
  apps: [{
    name: 'rapidrepo-api-2',
    script: 'server/index.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '2G',
    node_args: '--max-old-space-size=2048',
    env: {
      NODE_ENV: 'production',
      PORT: $API_PORT
    },
    kill_timeout: 1200000,
    listen_timeout: 1200000,
    shutdown_with_message: true,
    user: 'rapidrepo2',
    cwd: '$APP_DIR',
    log_file: '/var/log/rapidrepo2/app.log',
    out_file: '/var/log/rapidrepo2/out.log',
    error_file: '/var/log/rapidrepo2/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Start application with PM2
echo "🚀 Starting application with PM2..."
cd $APP_DIR
pm2 start ecosystem-second.config.js
pm2 save

# Configure nginx for second domain
echo "⚙️  Configuring nginx for $DOMAIN..."

# Create nginx config for second site
cat > /etc/nginx/sites-available/$DOMAIN << 'NGINX_CONFIG'
# Nginx Configuration for Second RapidRepo Site
# Domain: YOUR_DOMAIN_HERE

# Rate limiting zones (separate from first site)
limit_req_zone $binary_remote_addr zone=api2:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth2:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=upload2:10m rate=2r/s;

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name YOUR_DOMAIN_HERE www.YOUR_DOMAIN_HERE;
    
    # Security headers for HTTP
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS configuration
server {
    listen 443 ssl http2;
    server_name YOUR_DOMAIN_HERE www.YOUR_DOMAIN_HERE;

    # SSL Certificate paths (will be set up by certbot)
    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN_HERE/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN_HERE/privkey.pem;

    # SSL Configuration - Enhanced Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Remove server signature
    server_tokens off;

    # File upload settings
    client_max_body_size 10G;
    client_body_timeout 1200s;
    client_header_timeout 1200s;
    send_timeout 1200s;
    
    # Buffer settings
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Root location for React app
    location / {
        root /var/www/rapidrepo/client/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header X-Content-Type-Options nosniff;
        }
        
        # Security for HTML files
        location ~* \.html$ {
            add_header X-Frame-Options DENY;
            add_header X-Content-Type-Options nosniff;
            add_header X-XSS-Protection "1; mode=block";
        }
    }

    # API routes with rate limiting (using port 5001)
    location /api/ {
        # Rate limiting
        limit_req zone=api2 burst=20 nodelay;
        
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 1200s;
        proxy_send_timeout 1200s;
        proxy_read_timeout 1200s;
        
        # Buffer settings
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        
        # Security headers for API
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
    }

    # Auth routes with stricter rate limiting
    location /api/auth/ {
        limit_req zone=auth2 burst=10 nodelay;
        
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Shorter timeout for auth
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Upload routes with special rate limiting
    location /api/tenant/mobile/ {
        limit_req zone=upload2 burst=5 nodelay;
        
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Extended timeout for uploads
        proxy_connect_timeout 1200s;
        proxy_send_timeout 1200s;
        proxy_read_timeout 1200s;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:5001/api/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # No rate limiting for health checks
        access_log off;
    }

    # Block access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ /(\.env|\.git|\.htaccess|\.htpasswd|\.DS_Store) {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Block access to backup files
    location ~ \.(bak|backup|old|orig|save|swp|tmp)$ {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Security for uploads directory
    location /uploads/ {
        root /var/www/rapidrepo/server;
        
        # Only allow specific file types
        location ~* \.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv)$ {
            expires 1y;
            add_header Cache-Control "public";
            add_header X-Content-Type-Options nosniff;
        }
        
        # Block execution of uploaded files
        location ~* \.(php|pl|py|jsp|asp|sh|cgi)$ {
            deny all;
        }
    }

    # Custom error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /404.html {
        root /var/www/rapidrepo/client/build;
        internal;
    }
    
    location = /50x.html {
        root /var/www/rapidrepo/client/build;
        internal;
    }
}
NGINX_CONFIG

# Replace placeholder with actual domain
sed -i "s/YOUR_DOMAIN_HERE/$DOMAIN/g" /etc/nginx/sites-available/$DOMAIN

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
nginx -t

# Reload nginx
systemctl reload nginx

# Set up SSL certificate
echo "🔒 Setting up SSL certificate..."
echo "⚠️  Make sure your domain DNS is pointing to this VPS IP before continuing"
read -p "Press Enter to continue with SSL setup, or Ctrl+C to cancel..."

certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
    echo "⚠️  SSL certificate setup failed. You can set it up manually later with:"
    echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN"
}

# Set up log rotation
echo "📝 Setting up log rotation..."
cat > /etc/logrotate.d/rapidrepo2 << EOF
/var/log/rapidrepo2/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 rapidrepo2 rapidrepo2
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Final checks
echo "🧪 Running final checks..."

# Check if all services are running
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx is not running"
fi

if pm2 list | grep -q "rapidrepo-api-2.*online"; then
    echo "✅ Second application is running"
else
    echo "❌ Second application is not running"
    echo "   Check logs with: pm2 logs rapidrepo-api-2"
fi

echo ""
echo "🎉 Second Website Deployment Complete!"
echo ""
echo "🌐 Your second application is now available at:"
echo "  - https://$DOMAIN"
echo "  - https://www.$DOMAIN"
echo ""
echo "📊 Health check: https://$DOMAIN/api/health"
echo ""
echo "🔍 Useful commands:"
echo "  Check PM2 status: pm2 status"
echo "  View logs: pm2 logs rapidrepo-api-2"
echo "  Restart app: pm2 restart rapidrepo-api-2"
echo "  Check nginx: systemctl status nginx"
echo "  View nginx config: cat /etc/nginx/sites-available/$DOMAIN"
echo ""
echo "📝 Important Notes:"
echo "  1. Update .env.production with your production values"
echo "  2. Make sure DNS is pointing to this VPS"
echo "  3. SSL certificate should be automatically configured"
echo "  4. First website is on port 5000, second on port 5001"
echo "  5. Both websites can run simultaneously"
echo ""
echo "✅ Setup Complete!"

