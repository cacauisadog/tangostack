#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu VPS to host the Kamal deploys. Run as root:
#
#   ssh root@<ip> 'bash -s -- setup "<deploy user public key>"' < deploy/bootstrap-server.sh
#   (check that `ssh deploy@<ip>` works, then)
#   ssh root@<ip> 'bash -s -- lock-ssh' < deploy/bootstrap-server.sh
#
# Safe to run again. `lock-ssh` is separate so a mistake in `setup` can't lock you out.
set -euo pipefail

SWAP_SIZE=4G
DEPLOY_USER=deploy

setup() {
  local pubkey="${1:?usage: setup <public key of the deploy user>}"

  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get upgrade -y -qq
  apt-get install -y -qq docker.io fail2ban unattended-upgrades curl ca-certificates

  # The deploy user: Kamal connects as it. The docker group is root-equivalent, so
  # treat its key like a root key.
  id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo,docker "$DEPLOY_USER"
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  grep -qxF "$pubkey" "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null ||
    echo "$pubkey" >>"/home/$DEPLOY_USER/.ssh/authorized_keys"
  chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

  # Container logs would otherwise grow without limit.
  cat >/etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
  systemctl enable --now docker
  systemctl restart docker

  # Swap: a safety net against the out-of-memory killer, not extra capacity.
  if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
    [ -f /swapfile ] || { fallocate -l "$SWAP_SIZE" /swapfile && chmod 600 /swapfile && mkswap /swapfile; }
    swapon /swapfile
  fi
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  echo 'vm.swappiness=10' >/etc/sysctl.d/99-swappiness.conf
  sysctl -q --system

  # Ban hosts that keep failing SSH logins.
  cat >/etc/fail2ban/jail.d/sshd.local <<'INI'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
INI
  systemctl enable --now fail2ban
  systemctl restart fail2ban

  # Security updates install themselves (no automatic reboots).
  systemctl enable --now unattended-upgrades

  echo "setup done. Test: ssh $DEPLOY_USER@<ip> docker ps"
}

lock_ssh() {
  [ -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ] || { echo "no key for $DEPLOY_USER: run setup first" >&2; exit 1; }
  cat >/etc/ssh/sshd_config.d/00-hardening.conf <<CONF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
AllowUsers $DEPLOY_USER
CONF
  sshd -t
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
  echo "ssh locked: only $DEPLOY_USER, by key"
}

case "${1:-}" in
  setup) shift; setup "$@" ;;
  lock-ssh) lock_ssh ;;
  *) echo "usage: $0 setup <public key> | lock-ssh" >&2; exit 1 ;;
esac
