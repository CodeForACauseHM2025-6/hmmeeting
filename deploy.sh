#!/bin/bash
set -e

# ============================================================
#  HMeeting Bare-Metal Deployment Script
#  Run this ON YOUR LINODE after cloning the repo.
#  Usage: ./deploy.sh [command]
#
#  Commands:
#    setup     - First-time server setup (Node.js, pm2, firewall)
#    init      - First-time app deploy (env, install, build, start)
#    deploy    - Pull latest code, rebuild, restart
#    logs      - Tail app logs
#    backup    - Backup SQLite database
#    restore   - Restore SQLite database from backup
#    stop      - Stop the app
#    start     - Start the app
#    status    - Show app status
# ============================================================

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$APP_DIR/backups"
DATA_DIR="$APP_DIR/data"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; exit 1; }

# ----------------------------------------------------------
# Helper: Load all env vars from .env.production + DATABASE_URL
# ----------------------------------------------------------
load_env() {
    cd "$APP_DIR"
    if [ ! -f .env.production ]; then
        err ".env.production not found."
    fi
    set -a
    source .env.production
    set +a
    export DATABASE_URL="file:$DATA_DIR/prod.db"
}

# ----------------------------------------------------------
# Helper: Start PM2 fresh (delete old process if exists, then start)
# PM2 only captures env vars at start time, not on restart.
# Binds Node to loopback only — public traffic must come through nginx.
# ----------------------------------------------------------
pm2_fresh_start() {
    pm2 delete hmmeeting 2>/dev/null || true
    NODE_ENV=production HOSTNAME=127.0.0.1 TRUST_PROXY=true \
        pm2 start npm --name "hmmeeting" -- start
    pm2 save
}

# ----------------------------------------------------------
# setup: Install Node.js, PM2, configure firewall
# ----------------------------------------------------------
cmd_setup() {
    log "Updating system packages..."
    sudo apt-get update && sudo apt-get upgrade -y

    log "Installing Node.js 20 LTS..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        log "Node.js already installed: $(node --version)"
    fi

    log "Installing PM2 (process manager)..."
    if ! command -v pm2 &> /dev/null; then
        sudo npm install -g pm2
        pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | sudo bash
    else
        log "PM2 already installed."
    fi

    log "Installing nginx + certbot (TLS terminator)..."
    sudo apt-get install -y nginx certbot python3-certbot-nginx

    log "Configuring firewall (UFW)..."
    sudo ufw allow OpenSSH
    sudo ufw allow 'Nginx Full'
    # Explicitly close 3000 — Node binds to loopback, public traffic goes
    # through nginx on 80/443.
    sudo ufw delete allow 3000/tcp 2>/dev/null || true
    sudo ufw deny 3000/tcp
    sudo ufw --force enable

    log "Setup complete!"
    log "Next steps:"
    echo "  1. Point your DNS A record at this server."
    echo "  2. Copy nginx.conf to /etc/nginx/sites-available/hmmeeting,"
    echo "     replace YOUR_DOMAIN with your hostname, and link into sites-enabled."
    echo "  3. Run: sudo certbot --nginx -d your.domain"
    echo "  4. Then: ./deploy.sh init"
}

# ----------------------------------------------------------
# init: First-time app initialization
# ----------------------------------------------------------
cmd_init() {
    cd "$APP_DIR"

    # Check for .env.production
    if [ ! -f .env.production ]; then
        warn ".env.production not found. Create it now:"
        echo ""
        echo "  nano .env.production"
        echo ""
        echo "Paste the following and fill in your real values:"
        echo "----------------------------------------------"
        echo "GOOGLE_CLIENT_ID=your-google-client-id"
        echo "NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id"
        echo "GOOGLE_CLIENT_SECRET=your-google-client-secret"
        echo "AUTH_SECRET=$(openssl rand -base64 32)"
        echo "AUTH_URL=http://YOUR_SSLIP_DOMAIN"
        echo "AUTH_TRUST_HOST=true"
        echo "APP_URL=http://YOUR_SSLIP_DOMAIN"
        echo "RESEND_API_KEY=re_your_resend_api_key"
        echo "----------------------------------------------"
        echo ""
        warn "Then re-run: ./deploy.sh init"
        exit 0
    fi

    # Load env vars
    load_env

    # Validate required env vars
    if [ -z "$AUTH_SECRET" ] && [ -z "$NEXTAUTH_SECRET" ]; then
        err "AUTH_SECRET not set. Generate with: openssl rand -base64 32"
    fi
    if [ -z "$GOOGLE_CLIENT_ID" ] || [ "$GOOGLE_CLIENT_ID" = "your-google-client-id" ]; then
        err "GOOGLE_CLIENT_ID not set in .env.production."
    fi
    if [ -z "$APP_URL" ] || echo "$APP_URL" | grep -q "YOUR_"; then
        err "APP_URL not set properly in .env.production."
    fi
    if ! echo "$APP_URL" | grep -qE '^https://'; then
        err "APP_URL must start with https:// (got: $APP_URL). Provision TLS via certbot first."
    fi

    log "App URL: $APP_URL"

    # Create data directory for production SQLite
    mkdir -p "$DATA_DIR"

    log "Installing dependencies..."
    npm ci

    log "Generating Prisma client..."
    npx prisma generate

    log "Running database migrations..."
    npx prisma migrate deploy

    log "Building Next.js..."
    npm run build

    log "Starting app with PM2..."
    pm2_fresh_start

    log "Deployment complete!"
    log "Your app is live at: $APP_URL"
    echo ""
    log "Useful commands:"
    echo "  ./deploy.sh logs      View logs"
    echo "  ./deploy.sh status    Check status"
    echo "  ./deploy.sh deploy    Deploy updates"
    echo "  ./deploy.sh backup    Backup database"
}

# ----------------------------------------------------------
# deploy: Pull latest, rebuild, restart
# ----------------------------------------------------------
cmd_deploy() {
    cd "$APP_DIR"
    load_env

    log "Pulling latest code..."
    git pull

    log "Installing dependencies..."
    npm ci

    log "Checking for known vulnerabilities..."
    npm audit --omit=dev || warn "Vulnerabilities found — review above before going live."

    log "Generating Prisma client..."
    npx prisma generate

    log "Running database migrations..."
    npx prisma migrate deploy

    log "Building Next.js..."
    npm run build

    log "Restarting app..."
    pm2_fresh_start

    log "Deploy complete!"
    pm2 status
}

# ----------------------------------------------------------
# backup: encrypted SQLite backup via scripts/backup-tool.ts
#
# Backups are AES-256-GCM encrypted under AWS_BACKUP_SECRET_NAME (or
# BACKUP_KEY for dev). Files are written with mode 0600 to keep them
# unreadable by other users on the box, and use the .db.enc extension.
# ----------------------------------------------------------
cmd_backup() {
    cd "$APP_DIR"
    load_env
    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/prod_backup_$TIMESTAMP.db.enc"

    if [ ! -f "$DATA_DIR/prod.db" ]; then
        err "No database found at $DATA_DIR/prod.db"
    fi

    if [ -z "$AWS_BACKUP_SECRET_NAME" ] && [ -z "$BACKUP_KEY" ]; then
        err "No backup key configured. Set AWS_BACKUP_SECRET_NAME+AWS_REGION (prod) or BACKUP_KEY (dev) in .env.production."
    fi

    # Use SQLite's online backup API to get a consistent snapshot, then
    # encrypt the snapshot. The temp file gets shredded.
    SNAP="$DATA_DIR/.snap_$TIMESTAMP.db"
    sqlite3 "$DATA_DIR/prod.db" ".backup '$SNAP'"
    npx tsx scripts/backup-tool.ts encrypt "$SNAP" "$BACKUP_FILE"
    chmod 600 "$BACKUP_FILE"
    rm -f "$SNAP"

    log "Database backed up (encrypted) to: $BACKUP_FILE"
    log "Total backups:"
    ls -lh "$BACKUP_DIR"
}

# ----------------------------------------------------------
# restore: decrypt a backup, replace prod.db
# ----------------------------------------------------------
cmd_restore() {
    cd "$APP_DIR"
    load_env

    if [ -z "$2" ]; then
        echo "Available backups:"
        ls -1 "$BACKUP_DIR" 2>/dev/null || echo "  No backups found."
        echo ""
        echo "Usage: ./deploy.sh restore <backup_filename.db.enc>"
        exit 1
    fi

    BACKUP_FILE="$BACKUP_DIR/$2"
    if [ ! -f "$BACKUP_FILE" ]; then
        err "Backup file not found: $BACKUP_FILE"
    fi

    if [ -z "$AWS_BACKUP_SECRET_NAME" ] && [ -z "$BACKUP_KEY" ]; then
        err "No backup key configured to decrypt this backup."
    fi

    warn "This will replace the current database with: $2"
    read -p "Are you sure? (y/N): " confirm
    if [ "$confirm" != "y" ]; then
        log "Restore cancelled."
        exit 0
    fi

    TMP_OUT="$DATA_DIR/.restore_$(date +%s).db"
    npx tsx scripts/backup-tool.ts decrypt "$BACKUP_FILE" "$TMP_OUT"

    pm2 stop hmmeeting
    mv "$TMP_OUT" "$DATA_DIR/prod.db"
    chmod 600 "$DATA_DIR/prod.db"
    pm2_fresh_start
    log "Database restored from: $2"
}

# ----------------------------------------------------------
# logs / start / stop / status
# ----------------------------------------------------------
cmd_logs() {
    pm2 logs hmmeeting --lines 100
}

cmd_stop() {
    pm2 stop hmmeeting
    log "App stopped."
}

cmd_start() {
    load_env
    pm2_fresh_start
    log "App started."
}

cmd_status() {
    pm2 status
}

# ----------------------------------------------------------
# Main
# ----------------------------------------------------------
case "${1:-}" in
    setup)   cmd_setup ;;
    init)    cmd_init ;;
    deploy)  cmd_deploy ;;
    backup)  cmd_backup ;;
    restore) cmd_restore "$@" ;;
    logs)    cmd_logs ;;
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    status)  cmd_status ;;
    *)
        echo "HMeeting Deployment Script"
        echo ""
        echo "Usage: ./deploy.sh <command>"
        echo ""
        echo "Commands:"
        echo "  setup     First-time server setup (Node.js, PM2, firewall)"
        echo "  init      First-time app deploy (install, build, start)"
        echo "  deploy    Pull latest, rebuild, restart"
        echo "  logs      Tail application logs"
        echo "  backup    Backup SQLite database"
        echo "  restore   Restore database from backup"
        echo "  start     Start the app"
        echo "  stop      Stop the app"
        echo "  status    Show app status"
        ;;
esac
