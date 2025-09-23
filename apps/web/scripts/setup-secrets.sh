#!/bin/bash

# DealershipAI GitHub Secrets Setup Script
# Sets up required secrets for CI/CD pipeline

set -e

echo "🔐 DealershipAI GitHub Secrets Setup"
echo "====================================="

# Configuration
REPO_OWNER="${REPO_OWNER:-yourusername}"
REPO_NAME="${REPO_NAME:-dealership-ai}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_section "Checking Prerequisites"

    # Check GitHub CLI
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI is not installed. Please install it first:"
        echo "  brew install gh"
        echo "  # or visit https://cli.github.com/"
        exit 1
    fi
    print_status "✅ GitHub CLI found"

    # Check if authenticated
    if ! gh auth status &> /dev/null; then
        print_error "Not authenticated with GitHub. Run 'gh auth login' first."
        exit 1
    fi
    print_status "✅ GitHub authentication verified"

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    print_status "✅ AWS CLI found"

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi

    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    print_status "✅ AWS Account: $AWS_ACCOUNT_ID"
}

# Generate secure secrets
generate_secrets() {
    print_section "Generating Secure Secrets"

    # Generate NextAuth secret
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    print_status "✅ Generated NextAuth secret"

    # Generate database password if it doesn't exist
    if ! aws ssm get-parameter --name "/dealershipai/database/password" --region us-east-1 &>/dev/null; then
        DATABASE_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        aws ssm put-parameter \
            --name "/dealershipai/database/password" \
            --value "$DATABASE_PASSWORD" \
            --type "SecureString" \
            --region us-east-1
        print_status "✅ Generated and stored database password in AWS SSM"
    else
        print_status "✅ Database password already exists in AWS SSM"
    fi
}

# Set GitHub secrets
set_github_secrets() {
    print_section "Setting GitHub Secrets"

    # AWS credentials
    read -p "Enter AWS Access Key ID: " AWS_ACCESS_KEY_ID
    read -s -p "Enter AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
    echo

    gh secret set AWS_ACCESS_KEY_ID --body "$AWS_ACCESS_KEY_ID" --repo "$REPO_OWNER/$REPO_NAME"
    gh secret set AWS_SECRET_ACCESS_KEY --body "$AWS_SECRET_ACCESS_KEY" --repo "$REPO_OWNER/$REPO_NAME"
    gh secret set AWS_ACCOUNT_ID --body "$AWS_ACCOUNT_ID" --repo "$REPO_OWNER/$REPO_NAME"
    print_status "✅ AWS credentials set"

    # NextAuth configuration
    gh secret set NEXTAUTH_SECRET --body "$NEXTAUTH_SECRET" --repo "$REPO_OWNER/$REPO_NAME"

    read -p "Enter production URL (e.g., https://dealershipai.com): " PRODUCTION_URL
    gh secret set NEXTAUTH_URL --body "$PRODUCTION_URL" --repo "$REPO_OWNER/$REPO_NAME"
    gh secret set PRODUCTION_URL --body "$PRODUCTION_URL" --repo "$REPO_OWNER/$REPO_NAME"
    print_status "✅ NextAuth configuration set"

    # AI API Keys
    read -p "Enter OpenAI API Key: " OPENAI_API_KEY
    gh secret set OPENAI_API_KEY --body "$OPENAI_API_KEY" --repo "$REPO_OWNER/$REPO_NAME"

    read -p "Enter Anthropic API Key (optional): " ANTHROPIC_API_KEY
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        gh secret set ANTHROPIC_API_KEY --body "$ANTHROPIC_API_KEY" --repo "$REPO_OWNER/$REPO_NAME"
    fi

    print_status "✅ AI API keys set"

    # Google OAuth (optional)
    read -p "Enter Google OAuth Client ID (optional): " GOOGLE_CLIENT_ID
    if [ -n "$GOOGLE_CLIENT_ID" ]; then
        read -p "Enter Google OAuth Client Secret: " GOOGLE_CLIENT_SECRET
        gh secret set GOOGLE_CLIENT_ID --body "$GOOGLE_CLIENT_ID" --repo "$REPO_OWNER/$REPO_NAME"
        gh secret set GOOGLE_CLIENT_SECRET --body "$GOOGLE_CLIENT_SECRET" --repo "$REPO_OWNER/$REPO_NAME"
        print_status "✅ Google OAuth credentials set"
    fi

    # Monitoring and alerting
    read -p "Enter Sentry DSN (optional): " SENTRY_DSN
    if [ -n "$SENTRY_DSN" ]; then
        gh secret set SENTRY_DSN --body "$SENTRY_DSN" --repo "$REPO_OWNER/$REPO_NAME"
        print_status "✅ Sentry DSN set"
    fi

    read -p "Enter Slack Webhook URL for deployment notifications (optional): " SLACK_WEBHOOK_URL
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        gh secret set SLACK_WEBHOOK_URL --body "$SLACK_WEBHOOK_URL" --repo "$REPO_OWNER/$REPO_NAME"
        print_status "✅ Slack webhook URL set"
    fi
}

# Set environment secrets
set_environment_secrets() {
    print_section "Setting Environment-Specific Secrets"

    # Create environment if it doesn't exist
    gh api -X PUT "repos/$REPO_OWNER/$REPO_NAME/environments/$ENVIRONMENT" \
        --field wait_timer=0 \
        --field prevent_self_review=false \
        --field reviewers='[]' \
        --field deployment_branch_policy='{"protected_branches":true,"custom_branch_policies":false}' || true

    print_status "✅ Environment '$ENVIRONMENT' configured"

    # Set environment-specific secrets
    read -p "Enter database URL for $ENVIRONMENT (will be generated if empty): " DATABASE_URL
    if [ -n "$DATABASE_URL" ]; then
        gh secret set DATABASE_URL --body "$DATABASE_URL" --repo "$REPO_OWNER/$REPO_NAME" --env "$ENVIRONMENT"
    fi

    read -p "Enter Redis URL for $ENVIRONMENT (will be generated if empty): " REDIS_URL
    if [ -n "$REDIS_URL" ]; then
        gh secret set REDIS_URL --body "$REDIS_URL" --repo "$REPO_OWNER/$REPO_NAME" --env "$ENVIRONMENT"
    fi

    print_status "✅ Environment secrets set for $ENVIRONMENT"
}

# Create ECR repository
create_ecr_repository() {
    print_section "Creating ECR Repository"

    REPO_NAME_ECR="dealershipai-web"

    if aws ecr describe-repositories --repository-names "$REPO_NAME_ECR" --region us-east-1 &>/dev/null; then
        print_status "✅ ECR repository '$REPO_NAME_ECR' already exists"
    else
        aws ecr create-repository \
            --repository-name "$REPO_NAME_ECR" \
            --region us-east-1 \
            --image-scanning-configuration scanOnPush=true

        print_status "✅ ECR repository '$REPO_NAME_ECR' created"
    fi

    # Set lifecycle policy
    cat > /tmp/lifecycle-policy.json << EOF
{
    "rules": [
        {
            "rulePriority": 1,
            "description": "Keep last 10 production images",
            "selection": {
                "tagStatus": "tagged",
                "tagPrefixList": ["main-", "latest"],
                "countType": "imageCountMoreThan",
                "countNumber": 10
            },
            "action": {
                "type": "expire"
            }
        },
        {
            "rulePriority": 2,
            "description": "Keep images for 7 days",
            "selection": {
                "tagStatus": "untagged",
                "countType": "sinceImagePushed",
                "countUnit": "days",
                "countNumber": 7
            },
            "action": {
                "type": "expire"
            }
        }
    ]
}
EOF

    aws ecr put-lifecycle-policy \
        --repository-name "$REPO_NAME_ECR" \
        --lifecycle-policy-text file:///tmp/lifecycle-policy.json \
        --region us-east-1

    rm /tmp/lifecycle-policy.json
    print_status "✅ ECR lifecycle policy configured"
}

# Verify secrets
verify_secrets() {
    print_section "Verifying Secrets Configuration"

    print_status "Repository secrets:"
    gh secret list --repo "$REPO_OWNER/$REPO_NAME" | head -10

    print_status "Environment secrets for $ENVIRONMENT:"
    gh secret list --repo "$REPO_OWNER/$REPO_NAME" --env "$ENVIRONMENT" | head -10

    print_status "✅ Secrets verification complete"
}

# Display setup summary
display_summary() {
    print_section "🎉 Setup Complete!"

    echo ""
    echo "GitHub Secrets Configuration Summary:"
    echo "====================================="
    echo "Repository: $REPO_OWNER/$REPO_NAME"
    echo "Environment: $ENVIRONMENT"
    echo "AWS Account: $AWS_ACCOUNT_ID"
    echo ""
    echo "Next Steps:"
    echo "==========="
    echo "1. Verify your GitHub Actions workflow permissions:"
    echo "   https://github.com/$REPO_OWNER/$REPO_NAME/settings/actions"
    echo ""
    echo "2. Test your CI/CD pipeline by pushing to main branch"
    echo ""
    echo "3. Monitor deployments in GitHub Actions:"
    echo "   https://github.com/$REPO_OWNER/$REPO_NAME/actions"
    echo ""
    echo "4. Set up branch protection rules (recommended):"
    echo "   https://github.com/$REPO_OWNER/$REPO_NAME/settings/branches"
    echo ""
}

# Main execution
main() {
    echo "Setting up GitHub secrets for: $REPO_OWNER/$REPO_NAME"
    echo "Environment: $ENVIRONMENT"
    echo ""

    check_prerequisites
    generate_secrets
    set_github_secrets
    set_environment_secrets
    create_ecr_repository
    verify_secrets
    display_summary
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--help]"
        echo ""
        echo "Environment variables:"
        echo "  REPO_OWNER    - GitHub repository owner (default: yourusername)"
        echo "  REPO_NAME     - GitHub repository name (default: dealership-ai)"
        echo "  ENVIRONMENT   - Environment name (default: production)"
        echo ""
        echo "Prerequisites:"
        echo "  - GitHub CLI installed and authenticated"
        echo "  - AWS CLI installed and configured"
        echo "  - Repository admin access"
        echo ""
        exit 0
        ;;
    *)
        main
        ;;
esac