# 🚀 Deployment Guide - Dental Clinic AI Platform

## Prerequisites
- Ubuntu 20.04+ or similar Linux distribution
- Docker & Docker Compose installed
- SSL certificate (or use Let's Encrypt)
- Domain name pointing to your server IP
- SSH access to your server

## Step 1: Server Setup

### Install Docker (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

### Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

## Step 2: Clone Repository

```bash
cd /opt
sudo git clone https://github.com/DuolPuot/Dental-clinic-ai.git
cd Dental-clinic-ai
sudo chown -R $USER:$USER .
```

## Step 3: Configure Environment

1. Copy the example env file:
```bash
cp .env.example .env
```

2. Edit `.env` with your production values:
```bash
nano .env
```

3. **Critical changes needed:**
   - Change all passwords from default values
   - Set `JWT_SECRET` to a strong random string (32+ chars)
   - Update `VITE_API_URL` to your domain
   - Configure email/SMTP settings
   - Add OpenAI API key
   - Update `CORS_ORIGIN` with your domain
   - Set `NODE_ENV=production`

## Step 4: SSL Certificate Setup (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx -y
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com
```

Certificates will be stored in: `/etc/letsencrypt/live/your-domain.com/`

## Step 5: Nginx Reverse Proxy Setup

Create `/etc/nginx/sites-available/dental-clinic`:

```nginx
upstream api_backend {
    server 127.0.0.1:3000;
}

upstream web_frontend {
    server 127.0.0.1:5173;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    # API Routes
    location /api/ {
        proxy_pass http://api_backend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Web Frontend
    location / {
        proxy_pass http://web_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/dental-clinic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 6: Build and Deploy with Docker Compose

```bash
cd /opt/Dental-clinic-ai

# Build images
docker-compose build

# Start services (detached mode)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api
docker-compose logs -f web
```

## Step 7: Verify Deployment

```bash
# Test API health
curl https://your-domain.com/api/health

# Check running containers
docker ps

# Check volumes
docker volume ls

# View resource usage
docker stats
```

## Step 8: Setup Auto-Renewal for SSL

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab for automatic renewal
sudo crontab -e
# Add this line: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Step 9: Database Initialization

First deployment will auto-initialize MongoDB with seed data from `scripts/mongo-init.js`.

To manually seed data:
```bash
docker-compose exec api npm run seed
```

## Monitoring & Maintenance

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f mongodb
```

### Backup MongoDB
```bash
docker-compose exec mongodb mongodump --out=/data/backup/$(date +%Y%m%d_%H%M%S)
```

### Update Services
```bash
cd /opt/Dental-clinic-ai
git pull origin main
docker-compose build
docker-compose up -d
```

### Stop/Restart
```bash
# Stop all services
docker-compose stop

# Restart all services
docker-compose restart

# Remove containers (keep volumes)
docker-compose down
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000
kill -9 <PID>
```

### Database Connection Issues
```bash
# Check MongoDB logs
docker-compose logs mongodb

# Test connection
docker-compose exec mongodb mongosh -u admin -p $MONGO_ROOT_PASSWORD
```

### Out of Memory
```bash
# Check disk space
df -h

# Check container resource limits
docker stats
```

### SSL Certificate Errors
```bash
# Verify certificate
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal
```

## Security Best Practices

1. **Firewall Setup**
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

2. **Keep System Updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Regular Backups**
   - Backup MongoDB data daily
   - Store backups off-site

4. **Monitor Logs**
   - Set up log aggregation (ELK, etc.)
   - Alert on errors

5. **Strong Passwords**
   - All database/service passwords minimum 16 characters
   - No default credentials in production

## Next Steps

1. Configure monitoring (Prometheus + Grafana)
2. Set up CI/CD pipeline for automatic deployments
3. Configure backups and disaster recovery
4. Set up application performance monitoring (APM)
5. Configure authentication/OAuth if needed

---

**Support**: For issues, check logs with `docker-compose logs` and review service-specific documentation in the README.
