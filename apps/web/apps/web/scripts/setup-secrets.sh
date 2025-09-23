#!/bin/bash

# GitHub Secrets Setup Script for DealershipAI Production Deployment
# This script configures all necessary GitHub secrets for CI/CD pipeline

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
REPO_OWNER="${REPO_OWNER:-yourusername}"
REPO_NAME="${REPO_NAME:-dealership-ai}"

echo -e "${BLUE}=== DealershipAI GitHub Secrets Setup ===${NC}"
echo -e "${YELLOW}Repository: ${REPO_OWNER}/${REPO_NAME}${NC}"
echo

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is logged in to GitHub CLI
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Please log in to GitHub CLI first:${NC}"
    echo "gh auth login"
    exit 1
fi

echo -e "${GREEN}✓ GitHub CLI is installed and authenticated${NC}"

# Function to set a secret with error handling
set_secret() {
    local secret_name="$1"
    local secret_description="$2"
    local is_sensitive="${3:-false}"

    echo -n -e "${YELLOW}Enter ${secret_description}: ${NC}"
    if [ "$is_sensitive" = "true" ]; then
        read -s secret_value
        echo
    else
        read secret_value
    fi

    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}⚠ Skipping ${secret_name} (empty value)${NC}"
        return
    fi

    if echo "$secret_value" | gh secret set "$secret_name" --repo="$REPO_OWNER/$REPO_NAME"; then
        echo -e "${GREEN}✓ Set ${secret_name}${NC}"
    else
        echo -e "${RED}✗ Failed to set ${secret_name}${NC}"
    fi
}

echo -e "${BLUE}=== Core Application Secrets ===${NC}"

# Next.js and Application Secrets
set_secret "NEXTAUTH_SECRET" "NextAuth Secret (generate with: openssl rand -base64 32)" true
set_secret "NEXTAUTH_URL" "NextAuth URL (e.g., https://yourdomain.com)"
set_secret "DATABASE_URL" "Database URL (PostgreSQL connection string)" true

echo -e "\n${BLUE}=== AI Provider Secrets ===${NC}"

# OpenAI Configuration
set_secret "OPENAI_API_KEY" "OpenAI API Key" true
set_secret "OPENAI_ORGANIZATION" "OpenAI Organization ID (optional)"

# Anthropic Claude Configuration
set_secret "ANTHROPIC_API_KEY" "Anthropic API Key" true

echo -e "\n${BLUE}=== Third-Party Integration Secrets ===${NC}"

# AutoTrader Integration
set_secret "AUTOTRADER_API_KEY" "AutoTrader API Key" true
set_secret "AUTOTRADER_SECRET" "AutoTrader API Secret" true
set_secret "AUTOTRADER_DEALER_ID" "AutoTrader Dealer ID"

# Cars.com Integration
set_secret "CARSCOM_API_KEY" "Cars.com API Key" true
set_secret "CARSCOM_DEALER_ID" "Cars.com Dealer ID"

# Facebook/Meta Integration
set_secret "FACEBOOK_APP_ID" "Facebook App ID"
set_secret "FACEBOOK_APP_SECRET" "Facebook App Secret" true
set_secret "FACEBOOK_ACCESS_TOKEN" "Facebook Access Token" true

# Instagram Integration
set_secret "INSTAGRAM_ACCESS_TOKEN" "Instagram Access Token" true

# Google My Business Integration
set_secret "GOOGLE_CLIENT_ID" "Google Client ID"
set_secret "GOOGLE_CLIENT_SECRET" "Google Client Secret" true
set_secret "GOOGLE_REFRESH_TOKEN" "Google Refresh Token" true

echo -e "\n${BLUE}=== Deployment & Infrastructure Secrets ===${NC}"

# Vercel Deployment
set_secret "VERCEL_TOKEN" "Vercel Token (for deployment)" true
set_secret "VERCEL_ORG_ID" "Vercel Organization ID"
set_secret "VERCEL_PROJECT_ID" "Vercel Project ID"

# Supabase Configuration
set_secret "SUPABASE_URL" "Supabase Project URL"
set_secret "SUPABASE_ANON_KEY" "Supabase Anonymous Key" true
set_secret "SUPABASE_SERVICE_ROLE_KEY" "Supabase Service Role Key" true

# Docker Registry (if using containerization)
set_secret "DOCKER_USERNAME" "Docker Hub Username"
set_secret "DOCKER_PASSWORD" "Docker Hub Password" true

echo -e "\n${BLUE}=== Monitoring & Analytics Secrets ===${NC}"

# Sentry Error Tracking
set_secret "SENTRY_DSN" "Sentry DSN URL" true
set_secret "SENTRY_AUTH_TOKEN" "Sentry Auth Token" true

# DataDog Monitoring
set_secret "DATADOG_API_KEY" "DataDog API Key" true
set_secret "DATADOG_APP_KEY" "DataDog Application Key" true

# Google Analytics
set_secret "GOOGLE_ANALYTICS_ID" "Google Analytics Measurement ID"

echo -e "\n${BLUE}=== Security & Encryption Secrets ===${NC}"

# JWT and Encryption
set_secret "JWT_SECRET" "JWT Secret Key (generate with: openssl rand -base64 32)" true
set_secret "ENCRYPTION_KEY" "Data Encryption Key (32 bytes base64)" true

# Rate Limiting (Redis)
set_secret "REDIS_URL" "Redis URL (for rate limiting and caching)" true

echo -e "\n${BLUE}=== Email & Communication Secrets ===${NC}"

# Email Service (SendGrid/Nodemailer)
set_secret "SENDGRID_API_KEY" "SendGrid API Key" true
set_secret "SMTP_HOST" "SMTP Host (alternative to SendGrid)"
set_secret "SMTP_PORT" "SMTP Port"
set_secret "SMTP_USER" "SMTP Username"
set_secret "SMTP_PASS" "SMTP Password" true

echo -e "\n${BLUE}=== Toyota Naples Pilot Specific ===${NC}"

# Pilot Program Configuration
set_secret "TOYOTA_NAPLES_API_KEY" "Toyota Naples API Key" true
set_secret "PILOT_ENVIRONMENT" "Pilot Environment (staging/production)"

echo -e "\n${GREEN}=== Secrets Setup Complete ===${NC}"

# List all secrets to verify
echo -e "\n${BLUE}Verifying secrets in repository:${NC}"
if gh secret list --repo="$REPO_OWNER/$REPO_NAME" 2>/dev/null; then
    echo -e "\n${GREEN}✓ All secrets configured successfully!${NC}"
else
    echo -e "\n${RED}⚠ Unable to verify secrets. Check repository permissions.${NC}"
fi

echo -e "\n${BLUE}=== Next Steps ===${NC}"
echo "1. Verify all secrets are set correctly in your GitHub repository"
echo "2. Update your GitHub Actions workflow files to use these secrets"
echo "3. Test the deployment pipeline in a staging environment"
echo "4. Monitor the CI/CD pipeline for any missing configurations"

echo -e "\n${YELLOW}Important Notes:${NC}"
echo "• Keep this script secure and never commit it with actual secret values"
echo "• Rotate secrets regularly for security best practices"
echo "• Use different secrets for staging and production environments"
echo "• Ensure all team members have appropriate access to secrets"

echo -e "\n${GREEN}GitHub Secrets setup completed successfully!${NC}"