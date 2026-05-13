#!/bin/bash
# Backup Script for Dental Clinic AI Platform
# Backs up MongoDB database and important configuration
# Usage: ./backup.sh [destination-path]

set -e

# Configuration
BACKUP_DIR="${1:-.}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MONGO_CONTAINER="dental_mongodb"
BACKUP_NAME="dental_backup_${TIMESTAMP}"
FULL_BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    error "Docker daemon is not running"
fi

# Check if MongoDB container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    error "MongoDB container '${MONGO_CONTAINER}' not found"
fi

# Create backup directory
mkdir -p "${FULL_BACKUP_PATH}"
log "Starting backup to: ${FULL_BACKUP_PATH}"

# 1. Backup MongoDB
log "Backing up MongoDB database..."
docker exec "${MONGO_CONTAINER}" mongodump --out=/data/backup_temp || error "MongoDB backup failed"
docker cp "${MONGO_CONTAINER}:/data/backup_temp" "${FULL_BACKUP_PATH}/mongodb" || error "Failed to copy MongoDB backup"
docker exec "${MONGO_CONTAINER}" rm -rf /data/backup_temp

# 2. Backup .env file (encrypted)
if [ -f ".env" ]; then
    log "Backing up environment configuration..."
    cp .env "${FULL_BACKUP_PATH}/.env.backup"
    chmod 600 "${FULL_BACKUP_PATH}/.env.backup"
    warn "⚠️  .env file contains sensitive data - keep backup secure"
fi

# 3. Backup docker-compose.yml
log "Backing up Docker configuration..."
cp docker-compose.yml "${FULL_BACKUP_PATH}/"

# 4. Create backup metadata
log "Creating backup metadata..."
cat > "${FULL_BACKUP_PATH}/BACKUP_INFO.txt" << EOF
Backup Information
==================
Timestamp: ${TIMESTAMP}
Backup Name: ${BACKUP_NAME}
Backup Path: ${FULL_BACKUP_PATH}

Contents:
- mongodb/: Full MongoDB database dump
- .env.backup: Environment configuration (⚠️ sensitive data)
- docker-compose.yml: Docker configuration
- BACKUP_INFO.txt: This file

Restore Instructions:
1. Copy files to appropriate locations
2. Run: docker-compose up -d
3. MongoDB will auto-restore on startup

Size: $(du -sh "${FULL_BACKUP_PATH}" | cut -f1)
EOF

# 5. Create tar archive
log "Compressing backup..."
tar -czf "${FULL_BACKUP_PATH}.tar.gz" -C "${BACKUP_DIR}" "${BACKUP_NAME}" || error "Compression failed"

# 6. Clean up uncompressed backup
rm -rf "${FULL_BACKUP_PATH}"

# 7. Generate checksum
log "Generating checksum..."
cd "${BACKUP_DIR}"
sha256sum "${BACKUP_NAME}.tar.gz" > "${BACKUP_NAME}.tar.gz.sha256"
cd - > /dev/null

# 8. Cleanup old backups (keep last 7)
log "Cleaning up old backups..."
cd "${BACKUP_DIR}"
ls -t *.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm
cd - > /dev/null

# Final summary
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
log "${GREEN}✅ Backup completed successfully!${NC}"
echo ""
echo "Backup Details:"
echo "  Name: ${BACKUP_NAME}.tar.gz"
echo "  Size: ${BACKUP_SIZE}"
echo "  Location: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "  Checksum: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.sha256"
echo ""
echo "Next steps:"
echo "  1. Copy backup to off-site storage:"
echo "     scp ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz user@backup-server:/backup/"
echo "  2. Verify backup integrity:"
echo "     sha256sum -c ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.sha256"
echo ""
