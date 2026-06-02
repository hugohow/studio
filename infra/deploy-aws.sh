#!/usr/bin/env bash
# Déploie le job StudioTonight sur AWS : S3 (feed public) + Lambda (scrape) + EventBridge (15 min).
# Idempotent : relançable sans casse. Nécessite un compte AWS avec droits
#   s3:*, iam:CreateRole/PutRolePolicy/PassRole, lambda:*, events:* sur ces ressources.
# Usage : AWS_PROFILE=<admin> bash infra/deploy-aws.sh
set -euo pipefail

REGION="${AWS_REGION:-eu-west-3}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="studiotonight-feed-${ACCOUNT}"
FN="studiotonight-refresh"
ROLE="studiotonight-lambda-role"
RULE="studiotonight-refresh-15min"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"

echo "▶ Compte=$ACCOUNT  Région=$REGION  Bucket=$BUCKET"

echo "▶ 1/5 Bucket S3 (feed public en lecture)"
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
fi
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"PublicReadFeed\",\"Effect\":\"Allow\",\"Principal\":\"*\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/*\"}]}"

echo "▶ 2/5 Rôle IAM Lambda"
TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document "$TRUST" >/dev/null
  aws iam attach-role-policy --role-name "$ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "  (attente propagation IAM…)"; sleep 12
fi
aws iam put-role-policy --role-name "$ROLE" --policy-name s3-put-feed \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"s3:PutObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/*\"}]}"
ROLE_ARN="$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)"

echo "▶ 3/5 Packaging (handler + src/adapters)"
BUILD="$(mktemp -d)"
echo '{"type":"module"}' > "$BUILD/package.json"
cp "$HERE/lambda/handler.mjs" "$BUILD/handler.mjs"
mkdir -p "$BUILD/src"
cp -r "$REPO/src/adapters" "$BUILD/src/adapters"
( cd "$BUILD" && zip -qr function.zip . )

echo "▶ 4/5 Lambda (nodejs20.x)"
ENVVARS="Variables={FEED_BUCKET=$BUCKET,FEED_KEY=slots.json,DURATION_H=1,MONTHS=1}"
if aws lambda get-function --function-name "$FN" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --zip-file "fileb://$BUILD/function.zip" >/dev/null
else
  aws lambda create-function --function-name "$FN" \
    --runtime nodejs20.x --handler handler.handler --role "$ROLE_ARN" \
    --timeout 120 --memory-size 512 --environment "$ENVVARS" \
    --zip-file "fileb://$BUILD/function.zip" >/dev/null
fi
FN_ARN="$(aws lambda get-function --function-name "$FN" --query Configuration.FunctionArn --output text)"

echo "▶ 5/5 Planning EventBridge (rate 15 min)"
aws events put-rule --name "$RULE" --schedule-expression "rate(15 minutes)" --state ENABLED >/dev/null
aws lambda add-permission --function-name "$FN" --statement-id "${RULE}-invoke" \
  --action lambda:InvokeFunction --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:$ACCOUNT:rule/$RULE" >/dev/null 2>&1 || true
aws events put-targets --rule "$RULE" --targets "Id=1,Arn=$FN_ARN" >/dev/null

echo "▶ Run initial"
aws lambda invoke --function-name "$FN" --cli-binary-format raw-in-base64-out \
  --payload '{}' /tmp/st-lambda-out.json >/dev/null 2>&1 || true
cat /tmp/st-lambda-out.json 2>/dev/null || true; echo

echo ""
echo "✅ Déployé. URL du feed :"
echo "   https://$BUCKET.s3.$REGION.amazonaws.com/slots.json"
echo "→ Mets cette URL dans Vercel : FEED_URL (et supprime FEED_TOKEN)."
