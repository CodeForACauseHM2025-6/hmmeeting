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

    log "Configuring firewall (UFW)..."
    sudo ufw allow OpenSSH
    sudo ufw allow 3000/tcp
    sudo ufw --force enable

    log "Setup complete! Now run:"
    echo "  ./deploy.sh init"
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
        echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
        echo "APP_URL=http://YOUR_LINODE_IP:3000"
        echo "NEXTAUTH_URL=http://YOUR_LINODE_IP:3000"
        echo "RESEND_API_KEY=re_your_resend_api_key"
        echo "----------------------------------------------"
        echo ""
        warn "Then re-run: ./deploy.sh init"
        exit 0
    fi

    # Validate required env vars
    set -a
    source .env.production
    set +a

    if [ -z "$NEXTAUTH_SECRET" ] || [ "$NEXTAUTH_SECRET" = "generate-with-openssl-rand-base64-32" ]; then
        err "NEXTAUTH_SECRET not set. Generate with: openssl rand -base64 32"
    fi
    if [ -z "$GOOGLE_CLIENT_ID" ] || [ "$GOOGLE_CLIENT_ID" = "your-google-client-id" ]; then
        err "GOOGLE_CLIENT_ID not set in .env.production."
    fi
    if [ -z "$APP_URL" ] || [ "$APP_URL" = "http://YOUR_LINODE_IP:3000" ]; then
        err "APP_URL not set. Use http://YOUR_IP:3000"
    fi

    # Create data directory for production SQLite
    mkdir -p "$DATA_DIR"

    log "Installing dependencies..."
    npm ci

    log "Generating Prisma client..."
    npx prisma generate

    log "Running database migrations..."
    DATABASE_URL="file:$DATA_DIR/prod.db" npx prisma migrate deploy

    log "Building Next.js..."
    # Load env vars so NEXT_PUBLIC_ vars are baked into the build
    set -a
    source .env.production
    set +a
    npm run build

    log "Starting app with PM2..."
    DATABASE_URL="file:$DATA_DIR/prod.db" pm2 start npm --name "hmmeeting" -- start
    pm2 save

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

    log "Pulling latest code..."
    git pull

    log "Installing dependencies..."
    npm ci

    log "Generating Prisma client..."
    npx prisma generate

    log "Running database migrations..."
    DATABASE_URL="file:$DATA_DIR/prod.db" npx prisma migrate deploy

    log "Building Next.js..."
    set -a
    source .env.production
    set +a
    npm run build

    log "Restarting app..."
    pm2 restart hmmeeting
    pm2 save

    log "Deploy complete!"
    pm2 status
}

# ----------------------------------------------------------
# backup: Backup the SQLite database
# ----------------------------------------------------------
cmd_backup() {
    cd "$APP_DIR"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/prod_backup_$TIMESTAMP.db"

    if [ -f "$DATA_DIR/prod.db" ]; then
        cp "$DATA_DIR/prod.db" "$BACKUP_FILE"
        log "Database backed up to: $BACKUP_FILE"
        log "Total backups:"
        ls -lh "$BACKUP_DIR"
    else
        err "No database found at $DATA_DIR/prod.db"
    fi
}

# ----------------------------------------------------------
# restore: Restore SQLite from a backup
# ----------------------------------------------------------
cmd_restore() {
    cd "$APP_DIR"

    if [ -z "$2" ]; then
        echo "Available backups:"
        ls -1 "$BACKUP_DIR" 2>/dev/null || echo "  No backups found."
        echo ""
        echo "Usage: ./deploy.sh restore <backup_filename>"
        exit 1
    fi

    BACKUP_FILE="$BACKUP_DIR/$2"
    if [ ! -f "$BACKUP_FILE" ]; then
        err "Backup file not found: $BACKUP_FILE"
    fi

    warn "This will replace the current database with: $2"
    read -p "Are you sure? (y/N): " confirm
    if [ "$confirm" != "y" ]; then
        log "Restore cancelled."
        exit 0
    fi

    pm2 stop hmmeeting
    cp "$BACKUP_FILE" "$DATA_DIR/prod.db"
    pm2 start hmmeeting
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
    cd "$APP_DIR"
    set -a
    source .env.production
    set +a
    DATABASE_URL="file:$DATA_DIR/prod.db" pm2 start hmmeeting
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
