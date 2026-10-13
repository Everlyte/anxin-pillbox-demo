#!/usr/bin/env bash
# Run as root on a fresh Ubuntu x86_64 server. Credentials are supplied separately.
set -euo pipefail
IP="${1:?Usage: bootstrap.sh PUBLIC_IP}"
[[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 2
[[ $(uname -m) == x86_64 ]] || { echo 'x86_64 required'; exit 2; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git xz-utils
TASK_TMP=$(mktemp -d)
trap 'rm -rf "$TASK_TMP"' EXIT
cd "$TASK_TMP"
NODE_VERSION=v22.23.3
curl --fail --location --retry 2 --connect-timeout 15 --max-time 180 "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz" -o node.tar.xz
curl --fail --location --retry 2 --max-time 30 "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o node-sha.txt
NODE_SHA=$(awk -v f="node-$NODE_VERSION-linux-x64.tar.xz" '$2==f {print $1}' node-sha.txt)
printf '%s  node.tar.xz\n' "$NODE_SHA" | sha256sum -c -
mkdir -p /opt/anxin-node
tar -xJf node.tar.xz --strip-components=1 -C /opt/anxin-node
CADDY_VERSION=2.11.7
curl --fail --location --retry 2 --connect-timeout 15 --max-time 180 "https://github.com/caddyserver/caddy/releases/download/v$CADDY_VERSION/caddy_${CADDY_VERSION}_linux_amd64.tar.gz" -o caddy.tar.gz
curl --fail --location --retry 2 --max-time 30 "https://github.com/caddyserver/caddy/releases/download/v$CADDY_VERSION/caddy_${CADDY_VERSION}_checksums.txt" -o caddy-sha.txt
CADDY_SHA=$(awk -v f="caddy_${CADDY_VERSION}_linux_amd64.tar.gz" '$2==f {print $1}' caddy-sha.txt)
printf '%s  caddy.tar.gz\n' "$CADDY_SHA" | sha256sum -c -
tar -xzf caddy.tar.gz caddy
install -m 0755 caddy /usr/local/bin/caddy
id anxin >/dev/null 2>&1 || useradd --system --home-dir /var/lib/anxin --create-home --shell /usr/sbin/nologin anxin
id caddy >/dev/null 2>&1 || useradd --system --home-dir /var/lib/caddy --create-home --shell /usr/sbin/nologin caddy
if [[ ! -d /opt/anxin-pillbox/.git ]]; then git clone https://github.com/Everlyte/anxin-pillbox-demo.git /opt/anxin-pillbox; fi
cd /opt/anxin-pillbox
/opt/anxin-node/bin/node --test test.mjs
install -d -m 0700 /etc/anxin
if [[ ! -f /etc/anxin/anxin.env ]]; then
 cat > /etc/anxin/anxin.env <<'ENV'
HOST=127.0.0.1
PORT=4173
DEEPSEEK_MODEL=deepseek-flash
AI_DAILY_LIMIT=100
ENV
 chmod 0600 /etc/anxin/anxin.env
fi
cat > /etc/systemd/system/anxin-pillbox.service <<'UNIT'
[Unit]
Description=Anxin pillbox demo
After=network-online.target
Wants=network-online.target
[Service]
User=anxin
Group=anxin
WorkingDirectory=/opt/anxin-pillbox
EnvironmentFile=/etc/anxin/anxin.env
ExecStart=/opt/anxin-node/bin/node /opt/anxin-pillbox/server.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
MemoryMax=384M
UMask=0077
[Install]
WantedBy=multi-user.target
UNIT
install -d -m 0755 /etc/caddy
if [[ -f /etc/caddy/Caddyfile ]]; then cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-anxin-$(date +%s)"; fi
cat > /etc/caddy/Caddyfile <<CADDY
{
    default_sni $IP
}
https://$IP {
    tls {
        issuer acme {
            dir https://acme-v02.api.letsencrypt.org/directory
            profile shortlived
        }
    }
    encode zstd gzip
    header X-Content-Type-Options nosniff
    header Referrer-Policy strict-origin-when-cross-origin
    reverse_proxy 127.0.0.1:4173
}
CADDY
cat > /etc/systemd/system/caddy.service <<'UNIT'
[Unit]
Description=Caddy HTTPS proxy for Anxin
After=network-online.target
Wants=network-online.target
[Service]
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
Environment=HOME=/var/lib/caddy
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/var/lib/caddy
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
/usr/local/bin/caddy validate --config /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now anxin-pillbox
systemctl enable --now caddy
systemctl is-active anxin-pillbox caddy
printf 'BOOTSTRAP_COMPLETE https://%s\n' "$IP"
