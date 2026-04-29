#!/usr/bin/env bash
# Idempotent nginx setup for scheduler.mtrokel.org on a Linode VM behind
# Cloudflare. Installs nginx if missing, drops in a server block for the
# scheduler app on 127.0.0.1:3000, redirects HTTP→HTTPS, locks down the
# default catch-all, and reloads nginx.
#
# Prereqs:
#   - You have a Cloudflare Origin Certificate at:
#       /etc/ssl/cloudflare/origin.pem  (cert)
#       /etc/ssl/cloudflare/origin.key  (key, mode 600)
#   - DNS for scheduler.mtrokel.org points (orange-cloud) at this VM
#   - Cloudflare SSL/TLS mode is "Full (strict)"
#
# Usage:
#   sudo bash scripts/setup-nginx.sh
#
# Override defaults by env:
#   DOMAIN=scheduler.mtrokel.org APP_PORT=3000 sudo -E bash scripts/setup-nginx.sh

set -euo pipefail

DOMAIN="${DOMAIN:-scheduler.mtrokel.org}"
APP_PORT="${APP_PORT:-3000}"
CERT="${CERT:-/etc/ssl/cloudflare/origin.pem}"
KEY="${KEY:-/etc/ssl/cloudflare/origin.key}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; exit 1; }

if [ "$EUID" -ne 0 ]; then
    err "Run as root (sudo)."
fi

# ---------------------------------------------------------------- nginx install
if ! command -v nginx >/dev/null 2>&1; then
    log "Installing nginx..."
    apt-get update -y
    apt-get install -y nginx
else
    log "nginx already installed: $(nginx -v 2>&1)"
fi

# ---------------------------------------------------------------- cert sanity
if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    warn "Origin cert/key not found at $CERT / $KEY"
    warn "Get one from Cloudflare dashboard:"
    warn "  SSL/TLS -> Origin Server -> Create Certificate"
    warn "  Hostnames: *.mtrokel.org, mtrokel.org"
    warn "  Save cert -> $CERT (mode 644), key -> $KEY (mode 600)"
    err  "Aborting until cert is in place."
fi

KEY_PERMS=$(stat -c '%a' "$KEY")
if [ "$KEY_PERMS" != "600" ]; then
    log "Tightening cert key perms (was $KEY_PERMS, setting 600)"
    chmod 600 "$KEY"
fi

# ---------------------------------------------------------------- redirect 80→443
cat > /etc/nginx/sites-available/00-redirect-http <<'EOF'
# Catch-all HTTP listener: redirect every request to HTTPS regardless of host.
# Cloudflare's "Always Use HTTPS" already handles this at the edge for proxied
# traffic, but this is defense-in-depth for anyone hitting the origin IP.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 301 https://$host$request_uri;
}
EOF
ln -sf /etc/nginx/sites-available/00-redirect-http /etc/nginx/sites-enabled/00-redirect-http

# ---------------------------------------------------------------- default 443 catch-all
cat > /etc/nginx/sites-available/01-default-https <<EOF
# Default HTTPS catch-all: anyone reaching this VM with an unknown Host
# header (including a direct-IP probe) gets the connection closed without
# a response.
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name _;

    ssl_certificate     $CERT;
    ssl_certificate_key $KEY;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    return 444;  # close connection, no response
}
EOF
ln -sf /etc/nginx/sites-available/01-default-https /etc/nginx/sites-enabled/01-default-https

# ---------------------------------------------------------------- scheduler vhost
cat > "/etc/nginx/sites-available/$DOMAIN" <<EOF
# scheduler.mtrokel.org -> Next.js app on 127.0.0.1:$APP_PORT
# (http2 is declared once on the default_server above; this vhost
# inherits it for the same ip:port — repeating it would warn.)
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $DOMAIN;

    ssl_certificate     $CERT;
    ssl_certificate_key $KEY;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    server_tokens off;
    client_max_body_size 64k;

    # Strip any inbound Forwarded; Cloudflare already provides CF-Connecting-IP.
    proxy_set_header Forwarded "";

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header CF-Connecting-IP \$http_cf_connecting_ip;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }
}
EOF
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"

# Disable the stock 'default' site if present — we have our own default_server.
if [ -L /etc/nginx/sites-enabled/default ]; then
    rm -f /etc/nginx/sites-enabled/default
    log "Removed stock default site."
fi

# ---------------------------------------------------------------- validate + reload
log "Testing nginx config..."
if ! nginx -t; then
    err "nginx -t failed; not reloading. Inspect output above."
fi

log "Reloading nginx..."
${RELOAD_CMD:-systemctl reload nginx}

# ---------------------------------------------------------------- firewall
if [ "${SKIP_UFW:-0}" = "1" ]; then
    warn "SKIP_UFW=1 set — leaving firewall alone."
elif command -v ufw >/dev/null 2>&1; then
    log "Configuring UFW for Cloudflare-only origin access..."
    ufw allow OpenSSH >/dev/null
    # Allow Cloudflare published ranges on 80/443. Refresh by re-running.
    for ip in $(curl -fsSL https://www.cloudflare.com/ips-v4); do
        ufw allow from "$ip" to any port 80 proto tcp >/dev/null
        ufw allow from "$ip" to any port 443 proto tcp >/dev/null
    done
    for ip in $(curl -fsSL https://www.cloudflare.com/ips-v6); do
        ufw allow from "$ip" to any port 80 proto tcp >/dev/null
        ufw allow from "$ip" to any port 443 proto tcp >/dev/null
    done
    # Make sure direct port 3000 is closed (Node binds to loopback anyway).
    ufw delete allow 3000/tcp 2>/dev/null || true
    ufw deny 3000/tcp >/dev/null
    yes | ufw enable >/dev/null
    log "UFW rules:"
    ufw status numbered | head -30
else
    warn "ufw not installed — skipping firewall lockdown. Install with: apt-get install -y ufw"
fi

# ---------------------------------------------------------------- done
log "nginx is live for https://$DOMAIN"
echo
echo "Verify:"
echo "  curl -I https://$DOMAIN/api/health        # should be 200"
echo "  curl -I https://$DOMAIN/                  # should be 200/302"
echo "  curl --resolve $DOMAIN:443:127.0.0.1 -kI https://$DOMAIN/  # local sanity"
echo
echo "If 502: app isn't running on 127.0.0.1:$APP_PORT yet. Run ./deploy.sh init."
echo "If hang: UFW may be blocking your shell's IP from 443; that's expected — only Cloudflare can reach it now."
