#!/usr/bin/env bash
# Installation du bot Shock Engine sur un serveur Ubuntu neuf (22.04 ou 24.04), en root :
#
#   curl -fsSL https://raw.githubusercontent.com/etseroraynaud-ui/Shadowmarketpro/main/bot/deploy/install.sh | bash
#
# Installe Docker, ferme tous les ports entrants sauf SSH, active les mises à jour de sécurité,
# récupère le code dans /opt/shadowmarketpro et démarre le shadow mode (aucun ordre, aucune clé).
# Relancer le script ne casse rien : il met simplement à jour.
set -euo pipefail

REPO=https://github.com/etseroraynaud-ui/Shadowmarketpro.git
DIR=/opt/shadowmarketpro
BRANCH=${BRANCH:-main}

[ "$(id -u)" = 0 ] || { echo "À lancer en root (sudo -i, puis relancer)." >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "== Paquets et mises à jour de sécurité automatiques"
apt-get update -q
apt-get install -y -q ca-certificates curl git ufw unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

echo "== Pare-feu : SSH seulement (le bot ne fait que des connexions sortantes)"
ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null

echo "== Horloge (le bot agit à la clôture de chaque bougie)"
timedatectl set-ntp true || true
timedatectl | grep -E 'synchronized|NTP' || true

echo "== Code"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone --depth 50 -b "$BRANCH" "$REPO" "$DIR"; fi
ln -sf "$DIR/bot/deploy/smp-bot" /usr/local/bin/smp-bot

echo "== Shadow mode"
docker compose -f "$DIR/bot/deploy/compose.yml" up -d --build shadow

cat <<MSG

Installé. Le shadow mode tourne : il suit le marché et simule les trades, sans aucun ordre.

  smp-bot status          état
  smp-bot logs            journal en direct (Ctrl+C pour quitter)
  smp-bot trades          trades simulés

Bot réel (testnet d'abord) : voir bot/DEPLOY.md, étape 4.
MSG
