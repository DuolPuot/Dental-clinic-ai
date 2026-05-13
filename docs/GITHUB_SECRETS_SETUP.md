# 🔐 GitHub Secrets Setup Guide for CI/CD

This guide explains how to configure GitHub Secrets for automated deployment to your VPS.

## Step 1: Generate SSH Key for Deployment

Run this on your VPS or local machine:

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
```

This creates two files:
- `deploy_key` (private key - keep secret)
- `deploy_key.pub` (public key - add to server)

## Step 2: Add Public Key to Your VPS

On your VPS, add the public key to the deployment user:

```bash
# Copy the public key content
cat deploy_key.pub

# Add to authorized_keys
mkdir -p ~/.ssh
cat deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

## Step 3: Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

### Required Secrets

| Secret Name | Description | Example Value |
|---|---|---|
| `DEPLOY_HOST` | VPS IP or hostname | `123.45.67.89` or `deploy.example.com` |
| `DEPLOY_USER` | SSH user on VPS | `ubuntu` or `root` |
| `DEPLOY_KEY` | Private SSH key (paste entire file) | `-----BEGIN OPENSSH PRIVATE KEY-----`... |

### Optional Secrets (for notifications)

| Secret Name | Description |
|---|---|
| `SLACK_WEBHOOK` | Slack webhook URL for deployment notifications |

## Step 4: Configure Deployment Path

Edit your deployment user's `.bashrc` to ensure correct paths:

```bash
# On your VPS
sudo nano /home/your-user/.bashrc

# Add these lines (if not present)
export PATH="/usr/local/bin:$PATH"
export DOCKER_HOST=unix:///var/run/docker.sock
```

## Step 5: Verify SSH Connection

Test SSH connection before enabling CI/CD:

```bash
ssh -i deploy_key ubuntu@your-vps-ip "docker ps"
```

If it works without prompting for password, you're ready!

## Step 6: Enable GitHub Actions

1. Go to repository → Actions
2. Click "I understand my workflows, go ahead and enable them"
3. Navigate to Workflows → "Deploy to Production"

## Step 7: Trigger First Deployment

Option A: Manual trigger
- Go to Actions tab
- Click "Deploy to Production"
- Click "Run workflow" → "Run workflow"

Option B: Push to main branch
```bash
git push origin main
```

## Step 8: Monitor Deployment

1. Go to Actions tab
2. Watch the workflow run
3. Check logs for any errors
4. Verify deployment on your VPS

## Troubleshooting

### SSH Connection Fails
```bash
# Check if SSH key is correctly formatted
cat deploy_key | head -1

# Should show: -----BEGIN OPENSSH PRIVATE KEY-----

# Verify correct encoding - paste entire key including BEGIN and END lines
```

### Permission Denied
```bash
# Check permissions on VPS
ssh ubuntu@your-vps-ip "ls -la ~/.ssh"

# Fix if needed
ssh ubuntu@your-vps-ip "chmod 600 ~/.ssh/authorized_keys"
```

### Deployment Commands Fail
```bash
# SSH to VPS and verify docker-compose works manually
ssh ubuntu@your-vps-ip
cd /opt/Dental-clinic-ai
docker-compose ps
```

### GitHub Actions Skipped
- Verify workflow file is in `.github/workflows/` directory
- Check that your default branch is `main`
- Go to Settings → Actions → Allow GitHub Actions

## Security Best Practices

✅ **DO:**
- Keep private key secret
- Rotate keys every 90 days
- Use strong `DEPLOY_HOST` authentication
- Limit SSH key permissions (`600`)
- Review deployment logs regularly

❌ **DON'T:**
- Commit private keys to repository
- Share SSH keys
- Use same key for multiple services
- Store secrets in code

## Advanced: Custom Deployment Conditions

Modify `.github/workflows/deploy.yml` to deploy only on specific branches or pull request merges:

```yaml
on:
  push:
    branches: [main, production]  # Deploy on these branches
    paths:
      - 'apps/**'  # Only deploy if these files change
      - 'docker-compose.yml'
```

## Rotating Secrets

Every 90 days:

1. Generate new SSH key
2. Update `DEPLOY_KEY` in GitHub Secrets
3. Update public key on VPS
4. Verify deployment works
5. Safely delete old keys

---

Need help? Check GitHub Actions logs in your repository Actions tab.
