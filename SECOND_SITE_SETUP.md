# दूसरी Website Setup Guide - RapidRepo

यह guide आपको VPS पर दूसरी website setup करने में मदद करेगा।

## 📋 Prerequisites

1. ✅ पहली website already running होनी चाहिए
2. ✅ Domain name ready होना चाहिए (जैसे rapidrepo.com)
3. ✅ DNS records properly configured होने चाहिए

## 🚀 Quick Setup

### Step 1: Directory बनाएं (Already done)
```bash
sudo mkdir -p /var/www/rapidrepo
```

### Step 2: Deployment Script Run करें
```bash
# Script को executable बनाएं
chmod +x deploy-second-site.sh

# Script run करें
sudo bash deploy-second-site.sh
```

Script run करने से पहले:
- Script में अपना domain name update करें (line 8)
- अपना repository URL update करें (line 9)

### Step 3: Manual Setup (अगर script use नहीं करना चाहते)

#### 3.1 Files Copy करें
```bash
# Local machine से VPS पर files copy करें
scp -r /path/to/rapidrepo/* root@your-vps-ip:/var/www/rapidrepo/
```

या git से clone करें:
```bash
cd /var/www/rapidrepo
git clone https://github.com/yourusername/rapidrepo.git .
```

#### 3.2 Dependencies Install करें
```bash
cd /var/www/rapidrepo
npm install
cd client && npm install && npm run build && cd ..
```

#### 3.3 Environment File Setup करें
```bash
cd /var/www/rapidrepo
cp env.production.example .env.production
nano .env.production
```

`.env.production` में ये values update करें:
```env
NODE_ENV=production
PORT=5001                    # पहली website 5000 use कर रही है
MONGODB_URI=mongodb://rapidrepo_app:password@localhost:27017/rapidrepo_prod2
JWT_SECRET=your_secure_jwt_secret_here
CLIENT_URL=https://your-domain.com
```

#### 3.4 User और Permissions Setup करें
```bash
# User बनाएं
sudo useradd -r -s /bin/false -d /var/www/rapidrepo rapidrepo2

# Permissions set करें
sudo chown -R rapidrepo2:rapidrepo2 /var/www/rapidrepo
sudo chmod -R 755 /var/www/rapidrepo

# Log directory बनाएं
sudo mkdir -p /var/log/rapidrepo2
sudo chown -R rapidrepo2:rapidrepo2 /var/log/rapidrepo2
```

#### 3.5 PM2 Configuration
`/var/www/rapidrepo/ecosystem-second.config.js` file बनाएं:
```javascript
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
      PORT: 5001
    },
    kill_timeout: 1200000,
    listen_timeout: 1200000,
    shutdown_with_message: true,
    user: 'rapidrepo2',
    cwd: '/var/www/rapidrepo',
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
```

#### 3.6 Application Start करें
```bash
cd /var/www/rapidrepo
pm2 start ecosystem-second.config.js
pm2 save
```

#### 3.7 Nginx Configuration
```bash
# Nginx config file बनाएं
sudo nano /etc/nginx/sites-available/your-domain.com
```

`nginx-second-site.conf` file देखें (script automatically create करेगा)।

Config file में:
- `YOUR_DOMAIN_HERE` को अपने domain से replace करें
- Port `5001` use हो रहा है (पहली website 5000 use कर रही है)

```bash
# Site enable करें
sudo ln -s /etc/nginx/sites-available/your-domain.com /etc/nginx/sites-enabled/

# Nginx test करें
sudo nginx -t

# Nginx reload करें
sudo systemctl reload nginx
```

#### 3.8 SSL Certificate Setup
```bash
# SSL certificate install करें
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal test करें
sudo certbot renew --dry-run
```

## 🔍 Verification

### Check Application Status
```bash
# PM2 status check करें
pm2 status

# दोनों applications दिखनी चाहिए:
# - rapidrepo-api (port 5000)
# - rapidrepo-api-2 (port 5001)
```

### Check Nginx Status
```bash
# Nginx status
sudo systemctl status nginx

# Nginx configs list करें
ls -la /etc/nginx/sites-enabled/
```

### Test URLs
```bash
# Health check करें
curl https://your-domain.com/api/health

# या browser में open करें
# https://your-domain.com
```

## 📊 Important Differences

| Feature | First Website | Second Website |
|---------|--------------|----------------|
| Directory | `/var/www/rapidbuddy.cloud` | `/var/www/rapidrepo` |
| Domain | `rapidbuddy.cloud` | `your-domain.com` |
| Port | `5000` | `5001` |
| PM2 App Name | `rapidrepo-api` | `rapidrepo-api-2` |
| User | `rapidrepo` | `rapidrepo2` |
| Log Directory | `/var/log/rapidrepo` | `/var/log/rapidrepo2` |

## 🔧 Troubleshooting

### Application Start नहीं हो रहा
```bash
# Logs check करें
pm2 logs rapidrepo-api-2

# Manual start करें
cd /var/www/rapidrepo
node server/index.js
```

### Port Already in Use Error
```bash
# Check करें कौन सा process port use कर रहा है
sudo lsof -i :5001

# या
sudo netstat -tulpn | grep 5001
```

### Nginx Configuration Error
```bash
# Nginx config test करें
sudo nginx -t

# Error logs check करें
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Issues
```bash
# Certificate status check करें
sudo certbot certificates

# Manual renewal करें
sudo certbot renew
```

### Database Connection Issues
```bash
# MongoDB status check करें
sudo systemctl status mongodb

# Connection test करें
mongo --eval "db.adminCommand('ping')"
```

## 📝 Useful Commands

```bash
# PM2 Commands
pm2 status                          # Status check
pm2 logs rapidrepo-api-2            # Logs देखें
pm2 restart rapidrepo-api-2         # Restart करें
pm2 stop rapidrepo-api-2            # Stop करें
pm2 delete rapidrepo-api-2          # Delete करें

# Nginx Commands
sudo systemctl status nginx          # Status
sudo systemctl restart nginx         # Restart
sudo nginx -t                        # Config test
sudo tail -f /var/log/nginx/access.log   # Access logs
sudo tail -f /var/log/nginx/error.log    # Error logs

# Application Logs
sudo tail -f /var/log/rapidrepo2/app.log
sudo tail -f /var/log/rapidrepo2/error.log
```

## 🔄 Updates और Maintenance

### Code Update करना
```bash
cd /var/www/rapidrepo
git pull origin main
npm install
cd client && npm install && npm run build && cd ..
pm2 restart rapidrepo-api-2
```

### Backup करना
```bash
# Database backup
mongodump --db rapidrepo_prod2 --out /var/backups/rapidrepo2/db_backup

# Application backup
tar -czf /var/backups/rapidrepo2/app_backup.tar.gz -C /var/www/rapidrepo .
```

## ✅ Checklist

- [ ] Directory `/var/www/rapidrepo` created
- [ ] Files copied/cloned
- [ ] Dependencies installed
- [ ] `.env.production` configured with port 5001
- [ ] User `rapidrepo2` created
- [ ] Permissions set correctly
- [ ] PM2 app `rapidrepo-api-2` running
- [ ] Nginx config created and enabled
- [ ] SSL certificate installed
- [ ] DNS pointing to VPS IP
- [ ] Health check working
- [ ] Both websites running simultaneously

## 🎉 Success!

अगर सब कुछ ठीक से setup हो गया है, तो:
- ✅ पहली website: `https://rapidbuddy.cloud` (port 5000)
- ✅ दूसरी website: `https://your-domain.com` (port 5001)

दोनों websites अब simultaneously run कर रही हैं! 🚀

## 📞 Support

अगर कोई problem आए तो:
1. Logs check करें
2. PM2 status verify करें
3. Nginx config test करें
4. Port conflicts check करें

Happy coding! 🎊

