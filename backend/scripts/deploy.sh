#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Called by SSM as root, or manually for a previously downloaded release.
# Usage: bash deploy.sh RELEASE_DIR AWS_REGION ECR_REGISTRY IMAGE_TAG [BACKEND_ENV_FILE]
release_dir=${1:?release directory required}
region=${2:?AWS region required}
registry=${3:?ECR registry required}
tag=${4:?image tag required}
export BACKEND_ENV_FILE=${5:-/home/admin/chameleon/backend/.env}
[[ $tag =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || { echo 'Invalid release tag' >&2; exit 1; }
[[ $region =~ ^[a-z]{2}-[a-z]+-[0-9]+$ ]] || { echo 'Invalid AWS region' >&2; exit 1; }
[[ $registry =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com$ ]] || { echo 'Invalid ECR registry' >&2; exit 1; }
[[ $(realpath "$release_dir") == "/opt/chameleon/releases/$tag" ]] || { echo 'Invalid release directory' >&2; exit 1; }
[[ $BACKEND_ENV_FILE == /* && -s "$BACKEND_ENV_FILE" ]] || { echo "Configure $BACKEND_ENV_FILE on EC2 first (absolute path required)" >&2; exit 1; }
[[ -s /etc/chameleon/rds/global-bundle.pem ]] || { echo 'RDS CA bundle is missing' >&2; exit 1; }

exec 9>/opt/chameleon/deploy.lock
flock -w 900 9 || { echo 'Another deployment is still running' >&2; exit 1; }

# Isolate ECR credentials and remove them after this deployment.
export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d)
trap 'rm -f "$DOCKER_CONFIG/config.json"; rmdir "$DOCKER_CONFIG" 2>/dev/null || true' EXIT
aws ecr get-login-password --region "$region" | docker login --username AWS --password-stdin "$registry"

printf 'ECR_REGISTRY=%s\nIMAGE_TAG=%s\n' "$registry" "$tag" > "$release_dir/image.env"
compose() {
  local dir=$1
  shift
  docker compose --project-name chameleon-backend \
    --env-file "$BACKEND_ENV_FILE" --env-file "$dir/image.env" \
    -f "$dir/compose.yml" "$@"
}
compose "$release_dir" config --quiet
# Keep download progress from exhausting SSM's captured stderr limit.
compose "$release_dir" pull --quiet backend migrate
# Migrations happen while the old API still runs: use backward-compatible migrations.
compose "$release_dir" run --rm --no-deps migrate

previous=''
if [[ -L /opt/chameleon/current ]]; then
  previous=$(readlink -f /opt/chameleon/current 2>/dev/null || true)
fi
if ! compose "$release_dir" up -d --wait --wait-timeout 180; then
  echo 'New release failed health checks.' >&2
  compose "$release_dir" ps
  if [[ -n "$previous" && -f "$previous/image.env" && "$previous" != "$release_dir" ]]; then
    echo 'Restoring previous containers. Database migrations are not reversed.' >&2
    compose "$previous" up -d --wait --wait-timeout 180 || {
      echo 'Previous release also failed health checks; manual recovery required.' >&2
      exit 1
    }
  fi
  exit 1
fi

if [[ -n "$previous" && "$previous" != "$release_dir" ]]; then
  ln -sfn "$previous" /opt/chameleon/previous
fi
ln -sfn "$release_dir" /opt/chameleon/current
echo "Deployed $tag successfully."
