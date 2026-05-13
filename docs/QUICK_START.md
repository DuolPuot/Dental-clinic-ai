# ⚡ Quick Start Checklist - Go Live in 30 Minutes

## Pre-Deployment (5 min)

### VPS Setup
- [ ] Create VPS account (DigitalOcean/AWS/Linode)
- [ ] Get VPS IP address: ___________________
- [ ] SSH into VPS and update packages:
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

### Domain Setup
- [ ] Purchase domain: ___________________
- [ ] Update DNS A record to VPS IP
- [ ] Verify DNS propagation: `nslookup yourdomain.com`

## Installation (10 min)

```bash
# SSH to VPS
ssh -i key.pem root@YOUR_IP

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Clone your repo
mkdir -p /opt && cd /opt
git clone https://github.com/DuolPuot/Dental-clinic-ai.git
cd Dental-clinic-ai
```

## Configuration (5 min)

```bash
# Copy and edit environment file
cp .env.example .env
nano .env  # Edit: DOMAIN, passwords, JWT_SECRET, API_KEY

# Generate JWT secret
openssl rand -hex 32  # Copy to .env

# Update Nginx config
sudo nano /etc/nginx/sites-available/dentalclinic
# (Use template from GO_LIVE_GUIDE.md)

sudo ln -s /etc/nginx/sites-available/dentalclinic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL & Deployment (7 min)

```bash
# Get SSL certificate
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -m your-email@gmail.com \
  --agree-tos \
  --non-interactive

# Build and start application
docker-compose build
docker-compose up -d

# Wait 30 seconds, then verify
curl https://yourdomain.com/api/health
```

## Verification (3 min)

- [ ] Open browser to `https://yourdomain.com`
- [ ] See green lock (SSL working)
- [ ] Application loads without errors
- [ ] Can login/use features

---

## Critical Environment Variables

Edit `.env` and set these:

```bash
# MUST CHANGE
DOMAIN=yourdomain.com
MONGO_ROOT_PASSWORD=YOUR_STRONG_PASSWORD_32_CHARS
REDIS_PASSWORD=YOUR_STRONG_PASSWORD_32_CHARS
JWT_SECRET=YOUR_RANDOM_STRING_32_CHARS

# MUST SET
VITE_API_URL=https://yourdomain.com/api
OPENAI_API_KEY=your_key_if_using_ai_features
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

## Troubleshooting Quick Fixes

### Website not loading
```bash
docker-compose ps
docker-compose logs api
curl http://localhost:3000/api/health
```

### SSL errors
```bash
sudo certbot certificates
sudo nginx -t
```

### Can't connect to VPS
```bash
# Check SSH connection
ssh -i key.pem root@YOUR_IP

# Check if ports open (AWS/DigitalOcean security groups)
# Allow: 22 (SSH), 80 (HTTP), 443 (HTTPS)
```

### Database won't start
```bash
docker-compose logs mongodb
docker-compose down
docker-compose up -d
```

---

## Post-Deployment (Next Steps)

1. **Setup Backups** (5 min)
   ```bash
   chmod +x scripts/backup.sh
   crontab -e
   # Add: 0 3 * * * cd /opt/Dental-clinic-ai && bash scripts/backup.sh /mnt/backups
   ```

2. **Setup CI/CD** (10 min)
   - See: docs/GITHUB_SECRETS_SETUP.md

3. **Setup Monitoring** (5 min)
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
   ```

4. **Configure Email Alerts** (5 min)
   - Create Slack webhook
   - Add to alertmanager.yml

---

## Your Live URLs

Once deployed:

- **App**: https://yourdomain.com
- **API**: https://yourdomain.com/api
- **Status**: https://yourdomain.com/api/health

## Useful Commands

```bash
# View logs
docker-compose logs -f api

# Restart services
docker-compose restart

# Stop everything
docker-compose down

# Update code
git pull origin main && docker-compose build && docker-compose up -d

# Check server status
htop
docker stats
```

---

## Still Need Help?

📖 **Full Guides:**
- GO_LIVE_GUIDE.md - Complete step-by-step
- DEPLOYMENT.md - Infrastructure setup
- GITHUB_SECRETS_SETUP.md - CI/CD automation

🚀 **You're ready to go live!**

