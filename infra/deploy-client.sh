#!/usr/bin/env bash
# Builds the client and publishes it to the site bucket behind CloudFront (runbook: infra/README.md).
#
#   infra/deploy-client.sh <domain>          for example: infra/deploy-client.sh example.com
#   npm run deploy:client -- <domain>
#
# The bucket and the distribution are read from the outputs of the CloudFormation stack, so the AWS CLI
# must be configured for the account. The API address is baked into the build (VITE_API_BASE), by default
# https://api.<domain>/api. Other VITE_* settings (for example VITE_GOOGLE_MAPS_EMBED) are read from
# client/.env as usual.
#
# Environment variables, all optional:
#   STACK_NAME     CloudFormation stack of app.yml     (default: lovestory)
#   STACK_REGION   region of that stack                (default: eu-central-1)
#   API_URL        API address for the build           (default: https://api.<domain>/api)
#   SKIP_BUILD     set to 1 to publish the existing client/dist as it is
#
# Order matters. The hashed files in assets/ go first and are never deleted, so a visitor who still has the
# previous index.html can load the files it points to; index.html goes last, then the cache is told about it.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DOMAIN=${1:-}
STACK=${STACK_NAME:-lovestory}
REGION=${STACK_REGION:-eu-central-1}

if [ -z "${API_URL:-}" ]; then
  [ -n "$DOMAIN" ] || { echo "usage: infra/deploy-client.sh <domain>   (or set API_URL)" >&2; exit 2; }
  API_URL="https://api.$DOMAIN/api"
fi

output() {
  local value
  value=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text)
  if [ -z "$value" ] || [ "$value" = "None" ]; then
    echo "deploy-client: output $1 not found in stack $STACK ($REGION)" >&2
    exit 1
  fi
  echo "$value"
}
BUCKET=$(output SiteBucketName)
DISTRIBUTION=$(output SiteDistributionId)

cd "$ROOT"
if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo "deploy-client: building with VITE_API_BASE=$API_URL"
  VITE_API_BASE="$API_URL" npm run build:client
fi

DIST_DIR="$ROOT/client/dist"
[ -f "$DIST_DIR/index.html" ] || { echo "deploy-client: $DIST_DIR/index.html not found, nothing to publish" >&2; exit 1; }
# A build made with another API address would send every request to the wrong place.
if ! grep -rqF -- "$API_URL" "$DIST_DIR/assets"; then
  echo "deploy-client: the build does not contain $API_URL, refusing to publish (is it a build made without SKIP_BUILD=1?)" >&2
  exit 1
fi

echo "deploy-client: uploading to s3://$BUCKET"
aws s3 sync "$DIST_DIR/assets" "s3://$BUCKET/assets" --region "$REGION" \
  --cache-control "public, max-age=31536000, immutable" --only-show-errors
aws s3 sync "$DIST_DIR" "s3://$BUCKET" --region "$REGION" \
  --exclude "assets/*" --exclude "index.html" --cache-control "no-cache" --only-show-errors
aws s3 cp "$DIST_DIR/index.html" "s3://$BUCKET/index.html" --region "$REGION" \
  --cache-control "no-cache" --only-show-errors

INVALIDATION=$(aws cloudfront create-invalidation --region "$REGION" --distribution-id "$DISTRIBUTION" \
  --paths "/" "/index.html" --query "Invalidation.Id" --output text)
echo "deploy-client: done, invalidation $INVALIDATION started for / and /index.html (usually finished in a minute or two)"
