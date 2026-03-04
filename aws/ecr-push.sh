#!/usr/bin/env bash
# =============================================================================
# Jan-Sahayak — ECR Build & Push Script
# =============================================================================
# Usage:
#   chmod +x aws/ecr-push.sh
#   ./aws/ecr-push.sh
#
# Prerequisites:
#   - AWS CLI v2 installed and configured (aws configure)
#   - Docker Desktop running
#   - IAM user/role must have: ecr:CreateRepository, ecr:GetAuthorizationToken,
#     ecr:BatchCheckLayerAvailability, ecr:PutImage, ecr:InitiateLayerUpload
# =============================================================================

set -euo pipefail

# ── Config (edit these if needed) ──────────────────────────────────────────────
AWS_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO_NAME="jan-sahayak-backend"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DOCKERFILE_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
FULL_IMAGE_URI="${ECR_REGISTRY}/${ECR_REPO_NAME}:${IMAGE_TAG}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Jan-Sahayak ECR Push"
echo "  Account : ${AWS_ACCOUNT_ID}"
echo "  Region  : ${AWS_REGION}"
echo "  Image   : ${FULL_IMAGE_URI}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 1: Create ECR repo (idempotent) ───────────────────────────────────────
echo "📦  [1/5] Ensuring ECR repository exists..."
aws ecr describe-repositories \
  --repository-names "${ECR_REPO_NAME}" \
  --region "${AWS_REGION}" \
  --no-cli-pager >/dev/null 2>&1 \
|| aws ecr create-repository \
  --repository-name "${ECR_REPO_NAME}" \
  --region "${AWS_REGION}" \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --no-cli-pager

echo "   ✅ ECR repo ready: ${ECR_REPO_NAME}"

# ── Step 2: Authenticate Docker → ECR ─────────────────────────────────────────
echo ""
echo "🔐  [2/5] Authenticating Docker with ECR..."
aws ecr get-login-password \
  --region "${AWS_REGION}" \
| docker login \
  --username AWS \
  --password-stdin \
  "${ECR_REGISTRY}"

echo "   ✅ Docker authenticated with ECR"

# ── Step 3: Build image ────────────────────────────────────────────────────────
echo ""
echo "🐳  [3/5] Building Docker image..."
echo "   Context: ${DOCKERFILE_DIR}"
docker build \
  --platform linux/amd64 \
  --tag "${ECR_REPO_NAME}:${IMAGE_TAG}" \
  --tag "${FULL_IMAGE_URI}" \
  --file "${DOCKERFILE_DIR}/Dockerfile" \
  "${DOCKERFILE_DIR}"

echo "   ✅ Image built: ${ECR_REPO_NAME}:${IMAGE_TAG}"

# ── Step 4: Push to ECR ────────────────────────────────────────────────────────
echo ""
echo "🚀  [4/5] Pushing image to ECR..."
docker push "${FULL_IMAGE_URI}"

echo "   ✅ Image pushed successfully"

# ── Step 5: Print App Runner instructions ──────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  DONE! Copy this URI for App Runner:"
echo ""
echo "     ${FULL_IMAGE_URI}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  [5/5] Next Steps — AWS Console:"
echo "  1. Go to: https://console.aws.amazon.com/apprunner"
echo "  2. Click 'Create service'"
echo "  3. Source: Container registry  →  ECR  →  paste the URI above"
echo "  4. Set port: 8000"
echo "  5. Add environment variables (see DEPLOYMENT.md)"
echo "  6. Attach IAM role: JanSahayakAppRunnerRole"
echo "  7. Click Deploy!"
echo ""
