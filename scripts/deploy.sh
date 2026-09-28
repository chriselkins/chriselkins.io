#!/usr/bin/env bash
# Builds the site and publishes it to the S3 bucket behind CloudFront, then
# invalidates the CloudFront cache. The bucket and distribution come from the
# CloudFormation stack in infra/site.yaml, so nothing here is hard-coded.
#
#   npm run deploy
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
STACK="${STACK:-chriselkins-io-site}"
REGION="us-east-1"

output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET="$(output BucketName)"
DISTRIBUTION="$(output DistributionId)"

npm --prefix "$ROOT" run build

# Every file needs a content type below; refuse to publish anything unexpected.
unknown="$(cd "$DIST" && find . -type f ! \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.woff2' \
  -o -name '*.jpg' -o -name '*.webp' -o -name '*.png' -o -name '*.svg' -o -name '*.xml' -o -name 'robots.txt' \
  -o -name '*.zip' -o -name 'pgp.asc' -o -name 'ssh.pub' \))"
if [[ -n "$unknown" ]]; then
  echo "No content type configured for:" >&2
  echo "$unknown" >&2
  exit 1
fi

# Content-hashed build output can be cached forever. Pages are cached at the
# edge until the next deploy invalidates them, and browsers always revalidate.
# The extension downloads aren't cached anywhere (CloudFront's /downloads/*
# behavior doesn't cache either), so a change to the extension can be
# downloaded as soon as it's published.
IMMUTABLE='public, max-age=31536000, immutable'
MEDIA='public, max-age=604800'
PAGE='public, max-age=0, s-maxage=86400, must-revalidate'
DOWNLOAD='no-store'

put() {
  aws s3 cp "$DIST" "s3://$BUCKET" --recursive --only-show-errors \
    --exclude '*' --include "$1" --content-type "$2" --cache-control "$3"
}

put '_astro/*.js' 'text/javascript; charset=utf-8' "$IMMUTABLE"
put '_astro/*.css' 'text/css; charset=utf-8' "$IMMUTABLE"
put '_astro/*.woff2' 'font/woff2' "$IMMUTABLE"
put '*.jpg' 'image/jpeg' "$MEDIA"
put '*.webp' 'image/webp' "$MEDIA"
put '*.png' 'image/png' "$MEDIA"
put '*.svg' 'image/svg+xml' "$MEDIA"
put '*.html' 'text/html; charset=utf-8' "$PAGE"
put 'rss.xml' 'application/rss+xml; charset=utf-8' "$PAGE"
put 'sitemap*.xml' 'application/xml; charset=utf-8' "$PAGE"
put 'robots.txt' 'text/plain; charset=utf-8' "$PAGE"
put 'downloads/*.zip' 'application/zip' "$DOWNLOAD"
# Plain text, so the public keys open in a browser and pipe cleanly from curl.
put 'pgp.asc' 'text/plain; charset=utf-8' "$PAGE"
put 'ssh.pub' 'text/plain; charset=utf-8' "$PAGE"

# Remove files that are no longer in the build. The bucket is versioned, so
# anything removed or overwritten stays recoverable for 30 days.
aws s3 sync "$DIST" "s3://$BUCKET" --delete --only-show-errors

id="$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths '/*' \
  --query 'Invalidation.Id' --output text)"
echo "Published to s3://$BUCKET; CloudFront invalidation $id is in progress."
