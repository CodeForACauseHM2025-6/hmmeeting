#!/bin/bash
set -e

# ============================================================
#  HMeeting Deployment Script
#
#  Commands:
#    setup     - First-time server setup (Docker, firewall, etc.)
#    init      - First-time app deploy (env file, SSL cert, build)
#    deploy    - Rebuild and restart the app (for updates)
#    logs      - Tail app logs
#    ssl       - Request/renew SSL certificate
#    backup    - Backup SQLite database
#    restore   - Restore SQLite database from backup
#    stop      - Stop all containers
#    status    - Show container status
# ============================================================

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$APP_DIR/backups"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; exit 1; }

# ----------------------------------------------------------
# setup: Install Docker, configure firewall
# ----------------------------------------------------------
cmd_setup() {
    log "Updating system packages..."
    sudo apt-get update && sudo apt-get upgrade -y

    log "Installing Docker..."
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com | sudo sh
        sudo usermod -aG docker "$USER"
        log "Docker installed. You may need to log out and back in for group changes."
    else
        log "Docker already installed."
    fi

    log "Installing Docker Compose plugin..."
    if ! docker compose version &> /dev/null; then
        sudo apt-get install -y docker-compose-plugin
    else
        log "Docker Compose already installed."
    fi

    log "Configuring firewall (UFW)..."
    sudo ufw allow OpenSSH
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable

    log "Setup complete!"
    log "IMPORTANT: Log out and back in so Docker group takes effect, then run:"
    echo "  ./deploy.sh init"
}

# ----------------------------------------------------------
# init: First-time app initialization
# ----------------------------------------------------------
cmd_init() {
    cd "$APP_DIR"

    # Create .env.production if it doesn't exist
    if [ ! -f .env.production ]; then
        if [ -f .env.production.example ]; then
            cp .env.production.example .env.production
            warn "Created .env.production from template."
            warn "Edit it now with your real values:"
            echo "  nano .env.production"
            echo ""
            warn "Then re-run: ./deploy.sh init"
            exit 0
        else
            err ".env.production.example not found. Cannot continue."
        fi
    fi

    # Validate required env vars are set
    source .env.production
    if [ -z "$NEXTAUTH_SECRET" ] || [ "$NEXTAUTH_SECRET" = "generate-with-openssl-rand-base64-32" ]; then
        err "NEXTAUTH_SECRET is not set in .env.production. Generate one with: openssl rand -base64 32"
    fi
    if [ -z "$GOOGLE_CLIENT_ID" ] || [ "$GOOGLE_CLIENT_ID" = "your-google-client-id" ]; then
        err "GOOGLE_CLIENT_ID is not set in .env.production."
    fi

    # Read domain from env
    DOMAIN=$(echo "$APP_URL" | sed 's|https\?://||' | sed 's|/.*||')
    if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "yourdomain.com" ]; then
        err "APP_URL is not set properly in .env.production."
    fi

    log "Domain detected: $DOMAIN"

    # Replace placeholder in nginx.conf
    sed -i "s/YOUR_DOMAIN/$DOMAIN/g" nginx.conf
    log "Updated nginx.conf with domain: $DOMAIN"

    # Build and start (HTTP only first, for SSL cert)
    log "Building Docker images..."
    docker compose build

    log "Starting containers (HTTP only for SSL setup)..."
    docker compose up -d app nginx

    # Request SSL certificate
    log "Requesting SSL certificate from Let's Encrypt..."
    read -p "Enter your email for Let's Encrypt notifications: " LE_EMAIL
    docker compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$LE_EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"

    if [ $? -eq 0 ]; then
        log "SSL certificate obtained!"

        # Enable HTTPS in nginx.conf
        # Uncomment the SSL server block
        sed -i 's/^# server {/server {/' nginx.conf
        sed -i 's/^#     listen 443/    listen 443/' nginx.conf
        sed -i 's/^#     server_name/    server_name/' nginx.conf
        sed -i 's/^#$//' nginx.conf
        sed -i 's/^#     ssl_certificate /    ssl_certificate /' nginx.conf
        sed -i 's/^#     ssl_certificate_key/    ssl_certificate_key/' nginx.conf
        sed -i 's/^#     location/    location/' nginx.conf
        sed -i 's/^#         proxy_/        proxy_/' nginx.conf
        sed -i 's/^#         proxy_cache_bypass/        proxy_cache_bypass/' nginx.conf
        sed -i 's/^#     }/    }/' nginx.conf
        sed -i 's/^# }/}/' nginx.conf

        log "Restarting nginx with HTTPS..."
        docker compose restart nginx

        # Start certbot renewal daemon
        docker compose up -d certbot
    else
        warn "SSL certificate request failed. You can retry with: ./deploy.sh ssl"
        warn "App is running on HTTP only for now."
    fi

    log "Deployment complete!"
    log "Your app should be live at: $APP_URL"
}

# ----------------------------------------------------------
# deploy: Rebuild and restart (for updates)
# ----------------------------------------------------------
cmd_deploy() {
    cd "$APP_DIR"

    log "Pulling latest code..."
    git pull

    log "Rebuilding Docker images..."
    docker compose build

    log "Restarting containers..."
    docker compose up -d

    log "Deploy complete! Checking status..."
    docker compose ps
}

# ----------------------------------------------------------
# ssl: Request or renew SSL certificate
# ----------------------------------------------------------
cmd_ssl() {
    cd "$APP_DIR"
    log "Renewing SSL certificates..."
    docker compose run --rm certbot renew
    docker compose restart nginx
    log "SSL renewal complete."
}

# ----------------------------------------------------------
# backup: Backup the SQLite database
# ----------------------------------------------------------
cmd_backup() {
    cd "$APP_DIR"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/prod_backup_$TIMESTAMP.db"

    # Get the volume mount path and copy from container
    docker compose exec app sh -c "cp /app/data/prod.db /tmp/backup.db"
    docker compose cp app:/tmp/backup.db "$BACKUP_FILE"

    log "Database backed up to: $BACKUP_FILE"
    log "Total backups:"
    ls -lh "$BACKUP_DIR"
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

    docker compose cp "$BACKUP_FILE" app:/app/data/prod.db
    docker compose restart app
    log "Database restored from: $2"
}

# ----------------------------------------------------------
# logs: Tail container logs
# ----------------------------------------------------------
cmd_logs() {
    cd "$APP_DIR"
    docker compose logs -f --tail=100
}

# ----------------------------------------------------------
# stop: Stop all containers
# ----------------------------------------------------------
cmd_stop() {
    cd "$APP_DIR"
    docker compose down
    log "All containers stopped."
}

# ----------------------------------------------------------
# status: Show container status
# ----------------------------------------------------------
cmd_status() {
    cd "$APP_DIR"
    docker compose ps
}

# ----------------------------------------------------------
# Main
# ----------------------------------------------------------
case "${1:-}" in
    setup)   cmd_setup ;;
    init)    cmd_init ;;
    deploy)  cmd_deploy ;;
    ssl)     cmd_ssl ;;
    backup)  cmd_backup ;;
    restore) cmd_restore "$@" ;;
    logs)    cmd_logs ;;
    stop)    cmd_stop ;;
    status)  cmd_status ;;
    *)
        echo "HMeeting Deployment Script"
        echo ""
        echo "Usage: ./deploy.sh <command>"
        echo ""
        echo "Commands:"
        echo "  setup     First-time server setup (Docker, firewall)"
        echo "  init      First-time app deploy (env, SSL, build)"
        echo "  deploy    Rebuild and restart (for updates)"
        echo "  logs      Tail application logs"
        echo "  ssl       Renew SSL certificate"
        echo "  backup    Backup SQLite database"
        echo "  restore   Restore database from backup"
        echo "  stop      Stop all containers"
        echo "  status    Show container status"
        ;;
esac
