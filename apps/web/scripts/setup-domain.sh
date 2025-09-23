#!/bin/bash

# DealershipAI Production Domain & SSL Setup Script
# This script helps configure domain and SSL certificates for production deployment

set -e

echo "🌐 DealershipAI Domain & SSL Setup"
echo "=================================="

# Configuration variables
DOMAIN_NAME="${DOMAIN_NAME:-dealershipai.com}"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-dealershipai-ssl}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first:"
        echo "curl 'https://awscli.amazonaws.com/AWSCLIV2.pkg' -o 'AWSCLIV2.pkg'"
        echo "sudo installer -pkg AWSCLIV2.pkg -target /"
        exit 1
    fi

    print_status "AWS CLI found"
}

# Check AWS credentials
check_aws_credentials() {
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi

    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    print_status "AWS Account: $AWS_ACCOUNT_ID"
}

# Deploy SSL and domain infrastructure
deploy_ssl_stack() {
    print_status "Deploying SSL and domain infrastructure..."

    if [ ! -f "infrastructure/ssl-backup-stack.yml" ]; then
        print_error "SSL CloudFormation template not found at infrastructure/ssl-backup-stack.yml"
        exit 1
    fi

    aws cloudformation deploy \
        --template-file infrastructure/ssl-backup-stack.yml \
        --stack-name "$STACK_NAME" \
        --parameter-overrides \
            DomainName="$DOMAIN_NAME" \
            Environment="$ENVIRONMENT" \
        --capabilities CAPABILITY_IAM \
        --region "$AWS_REGION" || {
        print_error "Failed to deploy SSL stack"
        exit 1
    }

    print_status "SSL stack deployed successfully"
}

# Get name servers for domain configuration
get_nameservers() {
    print_status "Getting Route53 name servers..."

    HOSTED_ZONE_ID=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`HostedZoneId`].OutputValue' \
        --output text)

    if [ -z "$HOSTED_ZONE_ID" ]; then
        print_error "Could not retrieve Hosted Zone ID"
        exit 1
    fi

    NAME_SERVERS=$(aws route53 get-hosted-zone \
        --id "$HOSTED_ZONE_ID" \
        --query 'DelegationSet.NameServers' \
        --output text)

    echo ""
    print_status "Configure your domain registrar with these name servers:"
    echo "$NAME_SERVERS" | tr '\t' '\n' | sed 's/^/  • /'
    echo ""
}

# Wait for SSL certificate validation
wait_for_ssl_validation() {
    print_status "Waiting for SSL certificate validation..."
    print_warning "This may take 5-30 minutes depending on DNS propagation"

    CERT_ARN=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`SSLCertificateArn`].OutputValue' \
        --output text)

    if [ -z "$CERT_ARN" ]; then
        print_error "Could not retrieve SSL Certificate ARN"
        exit 1
    fi

    while true; do
        STATUS=$(aws acm describe-certificate \
            --certificate-arn "$CERT_ARN" \
            --region "$AWS_REGION" \
            --query 'Certificate.Status' \
            --output text)

        case $STATUS in
            "ISSUED")
                print_status "SSL certificate validated and issued!"
                break
                ;;
            "PENDING_VALIDATION")
                print_status "Still waiting for DNS validation... (checking again in 30s)"
                sleep 30
                ;;
            "FAILED"|"EXPIRED"|"REVOKED")
                print_error "SSL certificate validation failed with status: $STATUS"
                exit 1
                ;;
            *)
                print_warning "Unknown certificate status: $STATUS"
                sleep 30
                ;;
        esac
    done
}

# Create production environment file with domain configuration
create_production_env() {
    print_status "Creating production environment configuration..."

    # Get outputs from CloudFormation stack
    CERT_ARN=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`SSLCertificateArn`].OutputValue' \
        --output text)

    BACKUP_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`BackupBucketName`].OutputValue' \
        --output text)

    cat > .env.production.ssl << EOF
# SSL and Domain Configuration (Generated by setup-domain.sh)
DOMAIN_NAME=$DOMAIN_NAME
SSL_CERTIFICATE_ARN=$CERT_ARN
BACKUP_BUCKET_NAME=$BACKUP_BUCKET
AWS_REGION=$AWS_REGION

# Update your main .env.production file with these values
# NEXTAUTH_URL=https://$DOMAIN_NAME
# Add SSL_CERTIFICATE_ARN to your infrastructure deployment
EOF

    print_status "SSL configuration saved to .env.production.ssl"
}

# Verify domain and SSL setup
verify_setup() {
    print_status "Verifying domain and SSL setup..."

    # Test DNS resolution
    if nslookup "$DOMAIN_NAME" > /dev/null 2>&1; then
        print_status "✅ Domain DNS resolution working"
    else
        print_warning "⚠️  Domain DNS not yet propagated (this may take time)"
    fi

    # Test SSL certificate
    if openssl s_client -connect "$DOMAIN_NAME:443" -servername "$DOMAIN_NAME" < /dev/null 2>/dev/null | grep -q "Verification: OK"; then
        print_status "✅ SSL certificate valid"
    else
        print_warning "⚠️  SSL certificate not yet accessible (deploy application first)"
    fi
}

# Main execution
main() {
    echo "Starting domain and SSL setup for: $DOMAIN_NAME"
    echo "AWS Region: $AWS_REGION"
    echo "Stack Name: $STACK_NAME"
    echo ""

    check_aws_cli
    check_aws_credentials
    deploy_ssl_stack
    get_nameservers

    echo ""
    print_warning "IMPORTANT: Configure your domain registrar with the name servers above before proceeding."
    read -p "Press Enter when you have updated your domain's name servers..."

    wait_for_ssl_validation
    create_production_env
    verify_setup

    echo ""
    print_status "🎉 Domain and SSL setup complete!"
    print_status "Next steps:"
    echo "  1. Deploy your application infrastructure"
    echo "  2. Update your .env.production file with the SSL configuration"
    echo "  3. Run your application deployment script"
    echo ""
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--help]"
        echo ""
        echo "Environment variables:"
        echo "  DOMAIN_NAME   - Your domain name (default: dealershipai.com)"
        echo "  AWS_REGION    - AWS region (default: us-east-1)"
        echo "  STACK_NAME    - CloudFormation stack name (default: dealershipai-ssl)"
        echo "  ENVIRONMENT   - Environment name (default: production)"
        exit 0
        ;;
    *)
        main
        ;;
esac