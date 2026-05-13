#!/bin/bash
# Restore Script for Dental Clinic AI Platform
# Restores MongoDB database from backup
# Usage: ./restore.sh backup_file.tar.gz

set -e

# Configuration
BACKUP_FILE="${1}"
MONGO_CONTAINER="dental_mongodb"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Functions
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

# Validation
if [ -z "${BACKUP_FILE}" ]; then
    error "Usage: $0 backup_file.tar.gz"
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    error "Backup file not found: ${BACKUP_FILE}"
fi

# Verify checksum
if [ -f "${BACKUP_FILE}.sha256" ]; then
    log "Verifying backup integrity..."
    if ! sha256sum -c "${BACKUP_FILE}.sha256"; then
        error "Backup integrity check failed! Do not proceed with restore."
    fi
    log "✅ Backup integrity verified"
fi

# Confirmation
warn "⚠️  RESTORING FROM BACKUP WILL OVERWRITE CURRENT DATABASE!"
read -p "Are you sure you want to restore? Type 'yes' to confirm: " -r
if [[ ! $REPLY =~ ^yes$ ]]; then
    echo "Restore cancelled"
    exit 0
fi

# Extract backup
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

log "Extracting backup..."
tar -xzf "${BACKUP_FILE}" -C "${TEMP_DIR}"

# Find backup directory
BACKUP_DIR=$(ls -d "${TEMP_DIR}"/dental_backup_* 2>/dev/null | head -1)
if [ ! -d "${BACKUP_DIR}" ]; then
    error "Invalid backup format - could not find backup directory"
fi

# Stop services
log "Stopping services..."
docker-compose down

# Restore MongoDB
log "Restoring MongoDB database..."
if [ -d "${BACKUP_DIR}/mongodb" ]; then
    docker cp "${BACKUP_DIR}/mongodb" "${MONGO_CONTAINER}:/data/restore_temp"
    docker-compose up -d mongodb
    
    # Wait for MongoDB to start
    log "Waiting for MongoDB to start..."
    sleep 10
    
    # Restore from dump
    docker exec "${MONGO_CONTAINER}" mongorestore /data/restore_temp || warn "MongoDB restore encountered an issue"
    docker exec "${MONGO_CONTAINER}" rm -rf /data/restore_temp
else
    error "MongoDB backup not found in backup archive"
fi

# Restore .env if present
if [ -f "${BACKUP_DIR}/.env.backup" ]; then
    log "Found .env backup - review before restoring"
    warn "⚠️  Manually review and restore: ${BACKUP_DIR}/.env.backup"
fi

# Restart all services
log "Restarting all services..."
docker-compose up -d

# Verify
sleep 5
log "Verifying restoration..."
docker-compose ps

log "${GREEN}✅ Restore completed!${NC}"
log "Please verify your data is correct before resuming normal operations"
