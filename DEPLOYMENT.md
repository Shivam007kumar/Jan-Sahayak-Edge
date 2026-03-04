# Jan-Sahayak Backend — AWS Deployment Guide

> **Stack:** FastAPI → Docker → Amazon ECR → AWS App Runner → API Gateway HTTP API

---

## Prerequisites

| Tool | Install |
|------|---------|
| AWS CLI v2 | `brew install awscli` |
| Docker Desktop | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| AWS Account | Console access + IAM user with AdministratorAccess (for setup only) |

Configure the CLI once:
```bash
aws configure
# Enter: Access Key ID, Secret Access Key, Region (ap-south-1), Output format (json)
```

---

## Step 1 — Create the App Runner IAM Role

This role allows App Runner to call Bedrock, Polly, S3, DynamoDB, and Cognito on your behalf.

```bash
cd /path/to/Jan-Sahayak-Edge

# 1a. Create the role with the trust policy
aws iam create-role \
  --role-name JanSahayakAppRunnerRole \
  --assume-role-policy-document file://aws/iam-trust-policy.json

# 1b. Attach the permission policy
aws iam put-role-policy \
  --role-name JanSahayakAppRunnerRole \
  --policy-name JanSahayakPermissions \
  --policy-document file://aws/iam-app-runner-role.json

# 1c. Verify
aws iam get-role --role-name JanSahayakAppRunnerRole
```

✅ Note the **Role ARN** in the output — you'll need it in Step 3.

---

## Step 2 — Build & Push Docker Image to ECR

```bash
# Make the script executable (one-time)
chmod +x aws/ecr-push.sh

# Run it
./aws/ecr-push.sh
```

The script will:
1. Create the ECR repository `jan-sahayak-backend` (if it doesn't exist)
2. Authenticate Docker with ECR
3. Build the image for `linux/amd64`
4. Push and print the full image URI

> **Apple Silicon (M1/M2/M3) users:** The script already sets `--platform linux/amd64`. Docker Desktop handles the cross-compilation automatically.

---

## Step 3 — Create App Runner Service (AWS Console)

1. Open [AWS App Runner Console](https://console.aws.amazon.com/apprunner) → **Create service**
2. **Source:** Container registry → ECR → paste the image URI from Step 2
3. **Deployment trigger:** Automatic (re-deploys on every ECR push)
4. **Service name:** `jan-sahayak-backend`
5. **Port:** `8000`
6. **Health check:** `HTTP` → Path `/health`
7. **CPU / Memory:** `1 vCPU / 2 GB`
8. **IAM Role:** Select `JanSahayakAppRunnerRole`

### Required Environment Variables (add in the console)

| Variable | Value |
|----------|-------|
| `AWS_ACCESS_KEY_ID` | Your AWS key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret |
| `AWS_DEFAULT_REGION` | `ap-south-1` |
| `GROQ_API_KEY` | Your Groq key |
| `MOCK_MODE` | `false` |
| `ALLOWED_ORIGINS` | `*` (or your frontend URL later) |
| `COGNITO_USER_POOL_ID` | Your Cognito pool ID |
| `COGNITO_APP_CLIENT_ID` | Your Cognito app client ID |

> **Security tip:** For real production use, store `AWS_SECRET_ACCESS_KEY` and `GROQ_API_KEY` in **AWS Secrets Manager** and reference them from App Runner.

8. Click **Create & Deploy** — wait ~3 minutes.

✅ Your service URL will look like: `https://xxxxxxxx.ap-south-1.awsapprunner.com`

---

## Step 4 — Smoke Test the App Runner URL

```bash
export APP_RUNNER_URL=https://xxxxxxxx.ap-south-1.awsapprunner.com

# Health check
curl ${APP_RUNNER_URL}/health

# Expected:
# {"status":"healthy","timestamp":"...","version":"2.0.0","services":{...}}
```

---

## Step 5 — Create API Gateway HTTP API (with CORS)

API Gateway gives you a stable public URL, rate limiting, usage plans, and centralised CORS control even if you swap App Runner URLs.

### Via AWS Console:
1. Open [API Gateway Console](https://console.aws.amazon.com/apigateway) → **Create API** → **HTTP API**
2. **Add integration:** HTTP URL → paste your App Runner URL
3. **Routes:** `ANY /{proxy+}` → forward to App Runner
4. **CORS configuration:**

| Setting | Value |
|---------|-------|
| Allow origins | `*` (or your frontend domain) |
| Allow methods | `GET, POST, PUT, DELETE, OPTIONS` |
| Allow headers | `Authorization, Content-Type, X-Session-Id` |
| Expose headers | `Content-Type` |
| Max age | `3600` |

5. **Stage:** `$default` (auto-deploy on)
6. Deploy — note the **Invoke URL** (e.g., `https://abc123.execute-api.ap-south-1.amazonaws.com`)

### Via CLI (one-liner):
```bash
# Create the API
API_ID=$(aws apigatewayv2 create-api \
  --name jan-sahayak-api \
  --protocol-type HTTP \
  --cors-configuration \
    AllowOrigins='["*"]',AllowMethods='["GET","POST","PUT","DELETE","OPTIONS"]',AllowHeaders='["Authorization","Content-Type","X-Session-Id"]',MaxAge=3600 \
  --query ApiId --output text)

echo "API ID: ${API_ID}"

# Create integration pointing to App Runner
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id ${API_ID} \
  --integration-type HTTP_PROXY \
  --integration-method ANY \
  --integration-uri https://YOUR_APP_RUNNER_URL/{proxy} \
  --payload-format-version 1.0 \
  --query IntegrationId --output text)

# Create catch-all route
aws apigatewayv2 create-route \
  --api-id ${API_ID} \
  --route-key "ANY /{proxy+}" \
  --target "integrations/${INTEGRATION_ID}"

# Deploy
aws apigatewayv2 create-stage \
  --api-id ${API_ID} \
  --stage-name '$default' \
  --auto-deploy

echo "API Gateway URL: https://${API_ID}.execute-api.ap-south-1.amazonaws.com"
```

---

## Step 6 — Lock Down CORS for Production

Once your frontend is deployed:

1. In App Runner console → your service → **Configuration** → **Environment variables**
2. Update `ALLOWED_ORIGINS` to your real domain:
   ```
   https://app.jansahayak.in,http://localhost:5173
   ```
3. Redeploy — no Docker rebuild needed.

Also update API Gateway CORS **Allow origins** to the same value.

---

## Step 7 — Verify CORS

```bash
export API_GW_URL=https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com

# Should return Access-Control-Allow-Origin header
curl -I -X OPTIONS ${API_GW_URL}/api/chat \
  -H "Origin: https://app.jansahayak.in" \
  -H "Access-Control-Request-Method: POST"
```

---

## Architecture Diagram

```
Browser / Mobile App
        │
        ▼
API Gateway HTTP API  ← CORS, rate limiting, stable URL
        │
        ▼
AWS App Runner        ← Auto-scaling Docker containers
        │
  ┌─────┼───────────────────────────┐
  ▼     ▼           ▼               ▼
Bedrock  Polly    DynamoDB         Cognito
(Nova/   (TTS)    (Cache)          (Auth)
 Claude)
        │
        ▼
      Groq API (fallback LLM)
```

---

## Useful Commands

```bash
# Check App Runner service status
aws apprunner list-services --region ap-south-1

# Force redeploy after ECR push
aws apprunner start-deployment \
  --service-arn YOUR_SERVICE_ARN \
  --region ap-south-1

# View live logs
aws logs tail /aws/apprunner/jan-sahayak-backend --follow
```

---

## Cost Estimate (ap-south-1, low traffic)

| Service | Est. Monthly Cost |
|---------|------------------|
| App Runner (1 vCPU / 2 GB) | ~$5–15 |
| ECR storage | ~$0.50 |
| API Gateway HTTP API | ~$1 per million requests |
| DynamoDB (on-demand) | ~$0.25 per million reads |
| **Total (light traffic)** | **~$10–20/month** |
