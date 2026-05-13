# 🚀 Go Live Guide - Make Your App Public

This guide walks you through deploying your Dental Clinic AI Platform and making it accessible on the internet with a custom domain.

## Prerequisites Checklist

- [ ] VPS with Ubuntu 20.04+ (AWS, DigitalOcean, Linode, etc.)
- [ ] Domain name (namecheap.com, GoDaddy, etc.)
- [ ] SSH access to your VPS
- [ ] Docker & Docker Compose installed on VPS
- [ ] 80 and 443 ports open (HTTP/HTTPS)
- [ ] SSL certificate (Let's Encrypt - free)

## Step 1: Choose & Setup Your VPS

### Option A: DigitalOcean (Recommended for beginners)
1. Create account: https://digitalocean.com
2. Click "Create" → "Droplet"
3. Select:
   - Image: Ubuntu 20.04 LTS
   - Size: $6/month (2GB RAM) - minimum for this app
   - Region: Closest to your users
4. Add SSH key (recommended over password)
5. Click "Create Droplet"

### Option B: AWS EC2
1. Go to AWS Console → EC2 → Instances
2. Launch Instance:
   - AMI: Ubuntu Server 20.04
   - Instance type: t3.micro (free tier) or t3.small
   - Security Group: Allow ports 22, 80, 443
3. Allocate Elastic IP (for static IP)

### Option C: Linode
1. Create account: https://linode.com
2. Linodes → Create Linode
3. Select: Ubuntu 20.04, 4GB RAM ($20/month)
4. SSH access available immediately

**Get your VPS IP address** - you'll need this later.

## Step 2: Setup Domain Name

### Purchase Domain
- Go to: namecheap.com, GoDaddy, or Route53
- Search & buy your domain (e.g., `dentalclinic.ai`)
- ~$10/year for most domains

### Point Domain to Your VPS

1. **Get VPS IP Address**
   ```bash
   # From your VPS dashboard, copy the IP address
   # Example: 123.45.67.89
   ```

2. **Update DNS Records**
   - Go to your domain registrar (Namecheap, GoDaddy, etc.)
   - Find "DNS Settings" or "Manage DNS"
   - Add/Edit these records:
   
   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | A | @ | 123.45.67.89 | 3600 |
   | A | www | 123.45.67.89 | 3600 |
   | AAAA | @ | (your IPv6) | 3600 |

3. **Verify DNS Propagation** (takes 5-30 minutes)
   ```bash
   # On your local machine
   nslookup dentalclinic.ai
   
   # Should show your VPS IP address
   ```

## Step 3: Connect to Your VPS

### SSH into VPS
```bash
# Using SSH key (recommended)
ssh -i /path/to/key.pem root@123.45.67.89

# Or with password (if set)
ssh root@123.45.67.89
```

### First-time Setup
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git nano htop

# Create deployment user (optional but recommended)
sudo adduser deployer
sudo usermod -aG sudo deployer
sudo usermod -aG docker deployer

# Switch to deployer
su - deployer
```

## Step 4: Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version

# If docker-compose not found, install it
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Step 5: Clone & Deploy Application

```bash
# Create deployment directory
mkdir -p /opt
cd /opt

# Clone your repository
git clone https://github.com/DuolPuot/Dental-clinic-ai.git
cd Dental-clinic-ai

# Fix permissions
sudo chown -R $USER:$USER .
```

## Step 6: Configure Environment Variables

```bash
# Copy example to production config
cp .env.example .env

# Edit with your values
nano .env
```

**Update these critical values:**

```env
# ─── SERVER ────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
DOMAIN=dentalclinic.ai
VITE_API_URL=https://dentalclinic.ai/api

# ─── DATABASE ──────────────────────────────────────────────────────────────
MONGO_ROOT_PASSWORD=change_to_strong_password_32_chars_min
MONGO_ROOT_USER=admin
REDIS_PASSWORD=change_to_strong_password_32_chars_min

# ─── JWT SECURITY ──────────────────────────────────────────────────────────
JWT_SECRET=generate_random_string_32_chars_minimum_use_openssl_rand_hex

# ─── EMAIL (Update for production) ─────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password

# ─── AI/LLM (Optional but recommended) ─────────────────────────────────────
OPENAI_API_KEY=your_openai_api_key

# ─── CORS ──────────────────────────────────────────────────────────────────
CORS_ORIGIN=https://dentalclinic.ai,https://www.dentalclinic.ai

# ─── SSL ──────────────────────────────────────────────────────────────────
SSL_ENABLED=true
```

**Generate secure JWT secret:**
```bash
# Generate random 32-char string
openssl rand -hex 32
# Copy output to JWT_SECRET in .env
```

## Step 7: Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/dentalclinic
```

**Paste this config:**

```nginx
upstream api_backend {
    server 127.0.0.1:3000;
}

upstream web_frontend {
    server 127.0.0.1:5173;
}

server {
    listen 80;
    listen [::]:80;
    server_name dentalclinic.ai www.dentalclinic.ai;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name dentalclinic.ai www.dentalclinic.ai;

    # SSL certificates (will update after certbot)
    ssl_certificate /etc/letsencrypt/live/dentalclinic.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dentalclinic.ai/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # File upload size
    client_max_body_size 50M;

    # API Routes
    location /api/ {
        proxy_pass http://api_backend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # Web Frontend
    location / {
        proxy_pass http://web_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Enable the site:**
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/dentalclinic /etc/nginx/sites-enabled/

# Remove default
sudo rm /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 8: Get SSL Certificate with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone \
  -d dentalclinic.ai \
  -d www.dentalclinic.ai \
  -m your-email@gmail.com \
  --agree-tos \
  --non-interactive

# Verify certificate
sudo certbot certificates

# Auto-renewal (runs automatically every 12 hours)
sudo systemctl enable certbot.timer
```

## Step 9: Start Application

```bash
cd /opt/Dental-clinic-ai

# Build Docker images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Health check
curl http://localhost:3000/api/health
```

**Wait 30-60 seconds for services to start**, then verify with:

```bash
# Test API through Nginx
curl https://dentalclinic.ai/api/health

# Should return: {"status":"ok"}
```

## Step 10: Verify Everything Works

### Test Your Live Application

1. **Open browser** and go to:
   ```
   https://dentalclinic.ai
   ```

2. **Should see:**
   - Your Dental Clinic AI Platform UI loaded
   - Green lock icon (SSL working)
   - No browser warnings

3. **Test key features:**
   - Login page loads
   - API endpoints respond
   - Database connected (check logs)

### Troubleshooting

**Site not loading?**
```bash
# Check if services running
docker-compose ps

# Check logs
docker-compose logs api
docker-compose logs web

# Check Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

**SSL certificate errors?**
```bash
# Verify certificate
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run
```

**API not responding?**
```bash
# Test local API
curl http://localhost:3000/api/health

# Check API logs
docker-compose logs -f api

# Check database
docker-compose logs -f mongodb
```

## Step 11: Setup Automated Backups

```bash
# Make backup script executable
chmod +x scripts/backup.sh scripts/restore.sh

# Create backup directory
sudo mkdir -p /mnt/backups
sudo chown $USER:$USER /mnt/backups

# Setup automatic daily backups at 3 AM
crontab -e
```

**Add this line:**
```cron
0 3 * * * cd /opt/Dental-clinic-ai && bash scripts/backup.sh /mnt/backups
```

## Step 12: Setup Monitoring (Optional but Recommended)

```bash
cd /opt/Dental-clinic-ai

# Start monitoring stack
docker-compose -f docker-compose.yml \
  -f docker-compose.monitoring.yml up -d

# Access Grafana
# https://dentalclinic.ai:3001
# Username: admin
# Password: (set in .env GRAFANA_PASSWORD)
```

## Step 13: Setup Auto-Deployment from GitHub

See [docs/GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) for setting up automatic deployments when you push to GitHub.

## Accessing Your Live Application

### Public URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Application** | https://dentalclinic.ai | Your live app |
| **API** | https://dentalclinic.ai/api | Backend API |
| **Monitoring** | https://dentalclinic.ai:3001 | Grafana dashboards |
| **Alerts** | https://dentalclinic.ai:9093 | Alertmanager |

### Admin Access

After first deployment:

1. Go to `https://dentalclinic.ai`
2. If you have seed data, use those credentials
3. Otherwise, register as admin

## Domain Redirect (www to non-www)

The Nginx config above already redirects `www.dentalclinic.ai` → `dentalclinic.ai`. You can also do the reverse if preferred.

## SSL Certificate Auto-Renewal

Your certificate will auto-renew 30 days before expiration:

```bash
# Check renewal status
sudo certbot renew --dry-run

# View renewal logs
sudo journalctl -u certbot.timer -f

# Manual renewal if needed
sudo certbot renew
```

## Troubleshooting Live Deployment

### Service Port Conflicts

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process if needed
sudo kill -9 <PID>
```

### Out of Memory Issues

```bash
# Check memory usage
free -h

# Check container resource usage
docker stats

# Increase Docker memory limit if needed
```

### Database Connection Issues

```bash
# Test MongoDB connection
docker-compose exec mongodb mongosh

# View MongoDB logs
docker-compose logs -f mongodb
```

### Nginx Issues

```bash
# Check Nginx status
sudo systemctl status nginx

# View error logs
sudo tail -100 /var/log/nginx/error.log

# Test config
sudo nginx -t
```

## Performance Optimization

### Enable Caching

Already configured in Nginx config with:
- Browser caching for static files (30 days)
- Gzip compression
- HTTP/2 support

### Monitor Performance

```bash
# Check server resources
htop

# Monitor Docker
docker stats

# View access logs
sudo tail -f /var/log/nginx/access.log
```

## Security Checklist

- [ ] SSL certificate installed (HTTPS working)
- [ ] Firewall enabled and ports configured
- [ ] SSH key-based authentication only
- [ ] Strong database passwords (30+ chars)
- [ ] JWT secret strong and random
- [ ] Backups running daily
- [ ] Monitoring alerts configured
- [ ] Regular updates scheduled
- [ ] DDoS protection (optional: Cloudflare)

## Upgrade & Maintenance

### Update Application Code

```bash
cd /opt/Dental-clinic-ai

# Pull latest changes
git pull origin main

# Rebuild images
docker-compose build

# Restart services
docker-compose up -d

# Verify
curl https://dentalclinic.ai/api/health
```

### Update System

```bash
# Check updates
sudo apt update

# Install updates
sudo apt upgrade -y

# Reboot if needed
sudo reboot
```

## Cost Estimation

### Monthly Costs (Approximate)

| Service | Cost | Notes |
|---------|------|-------|
| VPS (DigitalOcean) | $6-20 | Depends on size |
| Domain | $1 | Yearly cost amortized |
| SSL Certificate | $0 | Free (Let's Encrypt) |
| Backups (S3) | $1-5 | Optional storage |
| **Total** | **$8-26** | Very affordable |

## Support & Help

### Common Issues

1. **Website not loading** → Check `docker-compose ps` and logs
2. **SSL errors** → Check certificate with `sudo certbot certificates`
3. **Database errors** → Check `docker-compose logs mongodb`
4. **Performance issues** → Check `docker stats` and system resources

### Getting Help

- Check logs: `docker-compose logs -f`
- Review deployment guide: `docs/DEPLOYMENT.md`
- Check monitoring: Open Grafana dashboard

## Next Steps

1. **Set up email notifications** - Configure SMTP for alerts
2. **Enable backups to cloud** - S3, Google Cloud, or Azure
3. **Setup CI/CD** - Automatic deployments from GitHub
4. **Configure monitoring** - Real-time dashboards and alerts
5. **Setup DNS failover** - Route53 or Cloudflare

---

**Congratulations! Your app is now live!** 🎉

Check your application at: `https://dentalclinic.ai`

For next steps, see:
- [MONITORING_LOGGING_SETUP.md](MONITORING_LOGGING_SETUP.md) - Monitor your app
- [BACKUP_STRATEGY.md](BACKUP_STRATEGY.md) - Protect your data
- [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) - Auto-deployments

