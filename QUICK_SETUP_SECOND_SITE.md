# 🚀 Quick Setup - दूसरी Website

## ⚡ Fast Setup (3 Steps)

### Step 1: Script में Domain Update करें
```bash
nano deploy-second-site.sh
```
Line 8 पर अपना domain डालें:
```bash
DOMAIN="your-domain.com"  # अपना domain यहाँ डालें
```

### Step 2: Script Run करें
```bash
sudo bash deploy-second-site.sh
```

### Step 3: DNS Setup करें
अपने domain के DNS में:
```
A Record: your-domain.com -> VPS_IP
CNAME: www.your-domain.com -> your-domain.com
```

## ✅ Done!

अब आपकी दूसरी website ready है:
- 🌐 URL: `https://your-domain.com`
- 🔌 Port: `5001` (पहली website `5000` use कर रही है)
- 📁 Directory: `/var/www/rapidrepo`

## 🔍 Verify करें

```bash
# PM2 status
pm2 status

# दोनों apps दिखनी चाहिए:
# - rapidrepo-api (port 5000)
# - rapidrepo-api-2 (port 5001)

# Health check
curl https://your-domain.com/api/health
```

## 📝 Important Notes

1. **Port**: दूसरी website port `5001` use करेगी
2. **Database**: अगर चाहें तो अलग database name use करें (`.env.production` में)
3. **SSL**: Script automatically SSL certificate setup करेगी
4. **Both Sites**: दोनों websites simultaneously run कर सकती हैं

## 🆘 Problems?

```bash
# Logs check करें
pm2 logs rapidrepo-api-2

# Nginx check करें
sudo nginx -t
sudo systemctl status nginx

# Port check करें
sudo lsof -i :5001
```

## 📚 Detailed Guide

पूरी detailed guide के लिए `SECOND_SITE_SETUP.md` देखें।

