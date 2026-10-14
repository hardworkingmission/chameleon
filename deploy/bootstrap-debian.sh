#!/usr/bin/env bash
# Run once on the Debian EC2 instance: sudo bash bootstrap-debian.sh
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo' >&2; exit 1; }
. /etc/os-release
[[ $ID == debian && $VERSION_ID =~ ^(12|13)$ ]] || { echo 'This bootstrap supports Debian 12 and 13' >&2; exit 1; }
arch=$(dpkg --print-architecture)
[[ $arch == amd64 || $arch == arm64 ]] || { echo 'Use amd64 or arm64 EC2' >&2; exit 1; }

apt-get update
apt-get install -y ca-certificates curl unzip python3 util-linux awscli
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $VERSION_CODENAME
Components: stable
Architectures: $arch
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
docker compose version
systemctl enable --now docker

if ! systemctl cat amazon-ssm-agent.service >/dev/null 2>&1; then
  package=$(mktemp --suffix=.deb)
  curl -fsSL "https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_${arch}/amazon-ssm-agent.deb" -o "$package"
  dpkg -i "$package"
  rm -f "$package"
fi
systemctl enable --now amazon-ssm-agent

install -d -m 0700 /opt/chameleon /opt/chameleon/releases /etc/chameleon
install -d -m 0755 /etc/chameleon/rds
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /etc/chameleon/rds/global-bundle.pem
chmod 0644 /etc/chameleon/rds/global-bundle.pem
echo 'Ready. Create /etc/chameleon/.env with mode 600 and configure the EC2 IAM role.'
