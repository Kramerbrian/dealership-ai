#!/bin/bash

# DealershipAI Complete AWS Infrastructure Deployment Script
# This script deploys the complete production infrastructure using CloudFormation

set -e

echo "🚀 DealershipAI AWS Infrastructure Deployment"
echo "============================================="

# Configuration variables
DOMAIN_NAME="${DOMAIN_NAME:-dealershipai.com}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.medium}"
ALERT_EMAIL="${ALERT_EMAIL:-alerts@dealershipai.com}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Stack names
MAIN_STACK_NAME="dealershipai-${ENVIRONMENT}"
SSL_STACK_NAME="dealershipai-ssl-${ENVIRONMENT}"
MONITORING_STACK_NAME="dealershipai-monitoring-${ENVIRONMENT}"

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

    # Check required templates
    local templates=("infrastructure/aws-deploy.yml" "infrastructure/ssl-backup-stack.yml" "infrastructure/monitoring-stack.yml")
    for template in "${templates[@]}"; do
        if [ ! -f "$template" ]; then
            print_error "Required template not found: $template"
            exit 1
        fi
        print_status "✅ Template found: $template"
    done

    # Check if database password parameter exists
    if ! aws ssm get-parameter --name "/dealershipai/database/password" --region "$AWS_REGION" &>/dev/null; then
        print_warning "Database password parameter not found. Creating secure random password..."

        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        aws ssm put-parameter \
            --name "/dealershipai/database/password" \
            --value "$DB_PASSWORD" \
            --type "SecureString" \
            --region "$AWS_REGION"

        print_status "✅ Database password parameter created"
    else
        print_status "✅ Database password parameter exists"
    fi
}

# Deploy SSL and backup infrastructure
deploy_ssl_stack() {
    print_section "Deploying SSL & Backup Infrastructure"

    print_status "Deploying SSL and backup stack..."

    aws cloudformation deploy \
        --template-file infrastructure/ssl-backup-stack.yml \
        --stack-name "$SSL_STACK_NAME" \
        --parameter-overrides \
            DomainName="$DOMAIN_NAME" \
            Environment="$ENVIRONMENT" \
        --capabilities CAPABILITY_IAM \
        --region "$AWS_REGION" || {
        print_error "Failed to deploy SSL stack"
        exit 1
    }

    print_status "✅ SSL and backup stack deployed successfully"
}

# Deploy main application infrastructure
deploy_main_infrastructure() {
    print_section "Deploying Main Application Infrastructure"

    print_status "Deploying main application infrastructure..."

    aws cloudformation deploy \
        --template-file infrastructure/aws-deploy.yml \
        --stack-name "$MAIN_STACK_NAME" \
        --parameter-overrides \
            DomainName="$DOMAIN_NAME" \
            Environment="$ENVIRONMENT" \
            InstanceType="$INSTANCE_TYPE" \
        --capabilities CAPABILITY_IAM \
        --region "$AWS_REGION" || {
        print_error "Failed to deploy main infrastructure"
        exit 1
    }

    print_status "✅ Main infrastructure deployed successfully"
}

# Deploy monitoring stack
deploy_monitoring_stack() {
    print_section "Deploying Monitoring & Alerting Stack"

    print_status "Deploying monitoring and alerting stack..."

    local monitoring_params="Environment=$ENVIRONMENT AlertEmail=$ALERT_EMAIL"

    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        monitoring_params="$monitoring_params SlackWebhookURL=$SLACK_WEBHOOK_URL"
    fi

    aws cloudformation deploy \
        --template-file infrastructure/monitoring-stack.yml \
        --stack-name "$MONITORING_STACK_NAME" \
        --parameter-overrides $monitoring_params \
        --capabilities CAPABILITY_IAM \
        --region "$AWS_REGION" || {
        print_error "Failed to deploy monitoring stack"
        exit 1
    }

    print_status "✅ Monitoring stack deployed successfully"
}

# Wait for SSL certificate validation
wait_for_ssl_certificate() {
    print_section "Waiting for SSL Certificate Validation"

    CERT_ARN=$(aws cloudformation describe-stacks \
        --stack-name "$SSL_STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`SSLCertificateArn`].OutputValue' \
        --output text)

    if [ -z "$CERT_ARN" ]; then
        print_error "Could not retrieve SSL Certificate ARN"
        exit 1
    fi

    print_status "Waiting for SSL certificate validation..."
    print_warning "This may take 5-30 minutes depending on DNS propagation"

    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        STATUS=$(aws acm describe-certificate \
            --certificate-arn "$CERT_ARN" \
            --region "$AWS_REGION" \
            --query 'Certificate.Status' \
            --output text)

        case $STATUS in
            "ISSUED")
                print_status "✅ SSL certificate validated and issued!"
                return 0
                ;;
            "PENDING_VALIDATION")
                print_status "Still waiting for DNS validation... (attempt $((attempt + 1))/$max_attempts)"
                ;;
            "FAILED"|"EXPIRED"|"REVOKED")
                print_error "SSL certificate validation failed with status: $STATUS"
                exit 1
                ;;
            *)
                print_warning "Unknown certificate status: $STATUS"
                ;;
        esac

        attempt=$((attempt + 1))
        sleep 30
    done

    print_error "SSL certificate validation timed out after $((max_attempts * 30 / 60)) minutes"
    exit 1
}

# Get deployment outputs
get_deployment_outputs() {
    print_section "Collecting Deployment Information"

    # Main infrastructure outputs
    LOAD_BALANCER_DNS=$(aws cloudformation describe-stacks \
        --stack-name "$MAIN_STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text)

    DATABASE_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$MAIN_STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
        --output text)

    CACHE_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$MAIN_STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`CacheEndpoint`].OutputValue' \
        --output text)

    # SSL stack outputs
    SSL_CERT_ARN=$(aws cloudformation describe-stacks \
        --stack-name "$SSL_STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`SSLCertificateArn`].OutputValue' \
        --output text)

    BACKUP_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "$SSL_STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`BackupBucketName`].OutputValue' \
        --output text)

    # Monitoring stack outputs
    DASHBOARD_URL=$(aws cloudformation describe-stacks \
        --stack-name "$MONITORING_STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`DashboardURL`].OutputValue' \
        --output text)

    print_status "✅ Deployment outputs collected"
}

# Create production environment file
create_production_environment() {
    print_section "Creating Production Environment Configuration"

    cat > .env.production.aws << EOF
# AWS Infrastructure Configuration (Generated by deploy-aws-infrastructure.sh)
# Generated on: $(date)

# Domain and SSL
DOMAIN_NAME=$DOMAIN_NAME
SSL_CERTIFICATE_ARN=$SSL_CERT_ARN
NEXTAUTH_URL=https://$DOMAIN_NAME

# Database Configuration
DATABASE_URL=postgresql://dealershipai:\$DATABASE_PASSWORD@$DATABASE_ENDPOINT:5432/dealershipai_prod
DATABASE_ENDPOINT=$DATABASE_ENDPOINT

# Redis Cache
REDIS_URL=redis://$CACHE_ENDPOINT:6379
CACHE_ENDPOINT=$CACHE_ENDPOINT

# AWS Configuration
AWS_REGION=$AWS_REGION
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BACKUP_BUCKET_NAME=$BACKUP_BUCKET

# Load Balancer
LOAD_BALANCER_DNS=$LOAD_BALANCER_DNS

# Monitoring
DASHBOARD_URL=$DASHBOARD_URL

# Stack Names (for reference)
MAIN_STACK_NAME=$MAIN_STACK_NAME
SSL_STACK_NAME=$SSL_STACK_NAME
MONITORING_STACK_NAME=$MONITORING_STACK_NAME

# Environment
NODE_ENV=production
ENVIRONMENT=$ENVIRONMENT
EOF

    print_status "✅ Production environment file created: .env.production.aws"
}

# Display deployment summary
display_deployment_summary() {
    print_section "🎉 Deployment Complete!"

    echo ""
    echo "Infrastructure Details:"
    echo "======================="
    echo "Domain:              $DOMAIN_NAME"
    echo "Environment:         $ENVIRONMENT"
    echo "AWS Region:          $AWS_REGION"
    echo "Load Balancer DNS:   $LOAD_BALANCER_DNS"
    echo "Database Endpoint:   $DATABASE_ENDPOINT"
    echo "Cache Endpoint:      $CACHE_ENDPOINT"
    echo ""
    echo "Monitoring:"
    echo "==========="
    echo "CloudWatch Dashboard: $DASHBOARD_URL"
    echo "Backup Bucket:       $BACKUP_BUCKET"
    echo ""
    echo "Next Steps:"
    echo "==========="
    echo "1. Point your domain ($DOMAIN_NAME) to the Load Balancer DNS:"
    echo "   $LOAD_BALANCER_DNS"
    echo ""
    echo "2. Update your application's environment variables:"
    echo "   cp .env.production.aws .env.production"
    echo "   # Add your API keys and secrets to .env.production"
    echo ""
    echo "3. Build and deploy your application Docker image"
    echo ""
    echo "4. Configure your domain's DNS records"
    echo ""
    echo "Files created:"
    echo "• .env.production.aws - Infrastructure configuration"
    echo ""
}

# Main execution function
main() {
    echo "Starting AWS infrastructure deployment..."
    echo "Domain: $DOMAIN_NAME"
    echo "Environment: $ENVIRONMENT"
    echo "Region: $AWS_REGION"
    echo ""

    if [ "$1" = "--dry-run" ]; then
        print_status "DRY RUN MODE - No changes will be made"
        return 0
    fi

    check_prerequisites
    deploy_ssl_stack
    deploy_main_infrastructure
    deploy_monitoring_stack
    wait_for_ssl_certificate
    get_deployment_outputs
    create_production_environment
    display_deployment_summary
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--dry-run] [--help]"
        echo ""
        echo "Environment variables:"
        echo "  DOMAIN_NAME        - Your domain name (default: dealershipai.com)"
        echo "  AWS_REGION         - AWS region (default: us-east-1)"
        echo "  ENVIRONMENT        - Environment name (default: production)"
        echo "  INSTANCE_TYPE      - EC2 instance type (default: t3.medium)"
        echo "  ALERT_EMAIL        - Email for alerts (default: alerts@dealershipai.com)"
        echo "  SLACK_WEBHOOK_URL  - Optional Slack webhook for notifications"
        echo ""
        echo "Examples:"
        echo "  $0                                    # Deploy with defaults"
        echo "  DOMAIN_NAME=myapp.com $0              # Deploy with custom domain"
        echo "  ENVIRONMENT=staging $0                # Deploy staging environment"
        echo "  $0 --dry-run                          # Check prerequisites only"
        exit 0
        ;;
    --dry-run)
        main --dry-run
        ;;
    *)
        main
        ;;
esac