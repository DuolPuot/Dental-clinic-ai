# 💾 Database Backup Strategy

## Overview

This document outlines the backup and disaster recovery strategy for the Dental Clinic AI Platform.

## Backup Types

### 1. Daily Incremental Backups
- **Frequency**: Every 24 hours (3:00 AM UTC)
- **Retention**: 7 days
- **Size**: ~500 MB - 2 GB per backup
- **Location**: Primary backup server

### 2. Weekly Full Backups
- **Frequency**: Every Sunday (2:00 AM UTC)
- **Retention**: 4 weeks
- **Size**: ~500 MB - 2 GB per backup
- **Location**: Primary + Secondary backup server

### 3. Monthly Snapshots
- **Frequency**: 1st of each month (1:00 AM UTC)
- **Retention**: 12 months
- **Size**: ~500 MB - 2 GB per backup
- **Location**: Off-site cold storage

## Automated Backup Setup

### Via Cron Job

Create `/etc/cron.d/dental-clinic-backup`:

```bash
# Daily backup at 3 AM UTC
0 3 * * * root cd /opt/Dental-clinic-ai && /bin/bash scripts/backup.sh /mnt/backups >> /var/log/dental-backup.log 2>&1

# Weekly backup verification (Sunday 4 AM UTC)
0 4 * * 0 root sha256sum -c /mnt/backups/*.tar.gz.sha256 >> /var/log/dental-backup-verify.log 2>&1

# Monthly cleanup (1st of month, 5 AM UTC)
0 5 1 * * root find /mnt/backups -name "*.tar.gz" -mtime +90 -delete
```

### Via Docker Cron Container

Add to `docker-compose.yml`:

```yaml
backup-scheduler:
  image: mcuadros/ofelia:latest
  container_name: dental_backup_scheduler
  restart: unless-stopped
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
    - /opt/Dental-clinic-ai:/app
  command: daemon --docker
  environment:
    - BACKUP_SCHEDULE=0 3 * * *
    - BACKUP_SCRIPT=/app/scripts/backup.sh
```

## Manual Backup

```bash
# Navigate to project directory
cd /opt/Dental-clinic-ai

# Run backup
bash scripts/backup.sh /mnt/backups

# Verify backup
sha256sum -c /mnt/backups/dental_backup_*.tar.gz.sha256
```

## Backup Storage Architecture

```
Primary VPS
  ├── Daily backups (7 days) → /mnt/backups/local
  └── Synced to cloud (automatic)
      ├── AWS S3 (cost-effective, accessible)
      ├── Google Cloud Storage (redundant)
      └── Azure Blob Storage (enterprise option)

Off-site Backup
  ├── Monthly snapshots (12 months)
  └── Encrypted archive storage
      ├── AWS Glacier (long-term, low cost)
      ├── Backblaze B2 (cheap cloud storage)
      └── Physical hard drive (cold storage, vault)
```

## Cloud Sync Setup

### AWS S3 Auto-Sync

Install and configure AWS CLI:

```bash
# Install AWS CLI
sudo apt-get install awscli

# Configure credentials
aws configure

# Add to cron job (after backup completes)
0 4 * * * root aws s3 sync /mnt/backups s3://dental-clinic-backups/ --delete
```

### Google Cloud Storage

```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash

# Authenticate
gcloud auth login

# Add to cron job
0 4 * * * root gsutil -m rsync -r -d /mnt/backups gs://dental-clinic-backups/
```

## Restore Procedures

### Full Database Restore (from archive)

```bash
cd /opt/Dental-clinic-ai

# Extract backup
tar -xzf /path/to/backup.tar.gz

# Restore database
bash scripts/restore.sh /path/to/backup.tar.gz
```

### Point-in-Time Recovery

MongoDB supports point-in-time recovery using the oplog:

```bash
# List available backups
ls -lh /mnt/backups/*.tar.gz | tail -10

# Restore to specific time
docker exec dental_mongodb mongorestore --archive=/path/to/backup.tar.gz
```

### Selective Data Recovery

```bash
# Restore specific collection
docker exec dental_mongodb mongorestore --archive=/path/to/backup.tar.gz \
  --nsInclude "dental_clinic.patients"

# Restore specific database
docker exec dental_mongodb mongorestore --archive=/path/to/backup.tar.gz \
  --nsInclude "dental_clinic.*"
```

## Backup Monitoring

### Check Backup Status

```bash
# List recent backups
ls -lh /mnt/backups/dental_backup_*.tar.gz | tail -5

# Check disk usage
du -sh /mnt/backups

# Verify latest backup integrity
ls /mnt/backups/dental_backup_*.tar.gz | tail -1 | xargs -I {} sh256sum -c {}.sha256

# Monitor backup process
tail -f /var/log/dental-backup.log
```

### Set Up Alerts

Add to monitoring system (Prometheus/Grafana):

```bash
# Alert if backup older than 25 hours
find /mnt/backups -name "dental_backup_*.tar.gz" -mtime -1 || \
  echo "WARNING: No backup found in last 24 hours"

# Alert if disk usage > 80%
df /mnt/backups | awk 'NR==2 {print $5}' | sed 's/%//' | awk '{if ($1 > 80) exit 1}'
```

## Backup Security

### Encryption

Enable encryption for sensitive backups:

```bash
# Create encrypted backup
tar -czf - /mnt/backups/dental_backup_* | \
  openssl enc -aes-256-cbc -salt -out backup.tar.gz.enc

# Decrypt for restore
openssl enc -d -aes-256-cbc -in backup.tar.gz.enc | tar -xz
```

### Access Control

```bash
# Restrict backup permissions
chmod 600 /mnt/backups/*.tar.gz
chown root:root /mnt/backups/*.tar.gz

# Restrict backup script
chmod 700 scripts/backup.sh scripts/restore.sh
```

### Off-site Storage

- Encrypt before sending to cloud
- Use separate AWS/GCP credentials for backups
- Implement multi-factor authentication
- Audit access logs regularly

## Disaster Recovery Plan

### RTO (Recovery Time Objective): 2 hours
### RPO (Recovery Point Objective): 4 hours (latest backup)

### Step 1: Assess (15 min)
- Determine scope of data loss
- Identify recovery point needed
- Notify stakeholders

### Step 2: Prepare (30 min)
- Provision new server (if needed)
- Install Docker and dependencies
- Configure network/DNS

### Step 3: Recover (1 hour)
- Download backup from storage
- Restore Docker volumes
- Run restore script
- Verify data integrity

### Step 4: Validate (15 min)
- Test application functionality
- Verify data consistency
- Check user access

### Step 5: Communicate (ongoing)
- Update status page
- Notify users
- Document incident

## Testing & Validation

### Monthly Backup Test

```bash
#!/bin/bash
# test-backup-restore.sh

# 1. Take snapshot
BACKUP_FILE=$(ls -t /mnt/backups/dental_backup_*.tar.gz | head -1)

# 2. Verify integrity
sha256sum -c "${BACKUP_FILE}.sha256" || exit 1

# 3. Extract to test directory
TEST_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEST_DIR"

# 4. Verify contents
ls "$TEST_DIR"/**/mongodb/dental_clinic/ || exit 1

# 5. Log success
echo "✅ Backup test passed: $BACKUP_FILE"
rm -rf "$TEST_DIR"
```

### Quarterly Full Restore Test

- Take backup from production
- Create test environment
- Execute full restore
- Validate all functionality
- Document any issues
- Update recovery procedures if needed

## Compliance & Retention

### Data Retention Requirements
- Transaction logs: 7 years (regulatory)
- Patient records: 7 years minimum
- System logs: 2 years
- Audit logs: 3 years

### Backup Retention Policy
- Daily: 7 days
- Weekly: 4 weeks
- Monthly: 12 months
- Yearly: 7 years (for compliance)

## Cost Optimization

### Backup Storage Costs

```
Daily backups (1 GB avg):
  Local SSD: $0.10/day
  S3 Standard: $0.023/day
  S3 Glacier: $0.004/day

Monthly: ~$3 (local) to $0.13 (Glacier)
Yearly: ~$36 (local) to $1.60 (Glacier)
```

### Cost Reduction Strategies
1. Use Glacier for archival backups
2. Compress backups (75-80% reduction)
3. Deduplicate backups
4. Set appropriate retention policies
5. Use lifecycle policies for cloud storage

## References

- [MongoDB Backup & Recovery](https://docs.mongodb.com/manual/core/backups/)
- [Docker Volumes Backup](https://docs.docker.com/storage/volumes/#backup-restore-or-migrate-a-volume)
- [AWS Backup Best Practices](https://docs.aws.amazon.com/aws-backup/latest/devguide/)

---

**Last Updated**: 2024-01-01
**Next Review**: Quarterly
**Owner**: DevOps Team
