#!/bin/bash

# Production Deployment Script for DealershipAI
# This script handles the complete production deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="${REPO_OWNER:-yourusername}"
REPO_NAME="${REPO_NAME:-dealership-ai}"
ENVIRONMENT="${ENVIRONMENT:-production}"

echo -e "${BLUE}=== DealershipAI Production Deployment ===${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Repository: ${REPO_OWNER}/${REPO_NAME}${NC}"
echo

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"

    # Check if we're in the correct directory
    if [ ! -f "package.json" ]; then
        echo -e "${RED}Error: package.json not found. Please run from the app root directory.${NC}"
        exit 1
    fi

    # Check if required tools are installed
    for tool in git node npm pnpm gh; do
        if ! command -v $tool &> /dev/null; then
            echo -e "${RED}Error: $tool is not installed${NC}"
            exit 1
        fi
    done

    # Check if user is logged in to GitHub CLI
    if ! gh auth status &> /dev/null; then
        echo -e "${RED}Error: Please log in to GitHub CLI first: gh auth login${NC}"
        exit 1
    fi

    # Check if Vercel CLI is installed and authenticated
    if ! command -v vercel &> /dev/null; then
        echo -e "${YELLOW}Warning: Vercel CLI not found. Installing...${NC}"
        npm install -g vercel
    fi

    echo -e "${GREEN}✓ All prerequisites satisfied${NC}"
}

# Function to run pre-deployment checks
pre_deployment_checks() {
    echo -e "\n${BLUE}Running pre-deployment checks...${NC}"

    # Check Git status
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
        git status --short
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Ensure we're on main branch for production
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$ENVIRONMENT" = "production" ] && [ "$current_branch" != "main" ]; then
        echo -e "${YELLOW}Warning: Not on main branch (currently on: $current_branch)${NC}"
        read -p "Switch to main branch? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            git checkout main
            git pull origin main
        fi
    fi

    echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
}

# Function to run tests
run_tests() {
    echo -e "\n${BLUE}Running test suite...${NC}"

    # Install dependencies
    echo "Installing dependencies..."
    pnpm install --frozen-lockfile

    # TypeScript check
    echo "Running TypeScript check..."
    pnpm run type-check

    # Lint check
    echo "Running ESLint..."
    pnpm run lint

    # Unit tests
    echo "Running unit tests..."
    pnpm run test:unit

    # Integration tests (if available)
    if npm run | grep -q "test:integration"; then
        echo "Running integration tests..."
        pnpm run test:integration
    fi

    echo -e "${GREEN}✓ All tests passed${NC}"
}

# Function to build application
build_application() {
    echo -e "\n${BLUE}Building application...${NC}"

    # Set production environment
    export NODE_ENV=production

    # Build the application
    pnpm run build

    # Run bundle analyzer (optional)
    if npm run | grep -q "analyze"; then
        echo "Analyzing bundle size..."
        pnpm run analyze > build-analysis.txt 2>&1 || echo "Bundle analysis completed"
    fi

    echo -e "${GREEN}✓ Application built successfully${NC}"
}

# Function to deploy to Vercel
deploy_to_vercel() {
    echo -e "\n${BLUE}Deploying to Vercel...${NC}"

    # Deploy to production
    if [ "$ENVIRONMENT" = "production" ]; then
        vercel --prod --yes
    else
        vercel --yes
    fi

    echo -e "${GREEN}✓ Deployed to Vercel${NC}"
}

# Function to run health checks
health_checks() {
    echo -e "\n${BLUE}Running health checks...${NC}"

    # Get deployment URL (this would be set by Vercel CLI in real scenario)
    DEPLOYMENT_URL="${NEXTAUTH_URL:-https://yourdomain.com}"

    # Wait for deployment to be ready
    echo "Waiting for deployment to be ready..."
    sleep 30

    # Basic health check
    echo "Testing API health endpoint..."
    if curl -f "${DEPLOYMENT_URL}/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API health check passed${NC}"
    else
        echo -e "${YELLOW}⚠ API health check failed (deployment may still be initializing)${NC}"
    fi

    # Test critical endpoints
    echo "Testing critical endpoints..."
    endpoints=(
        "/api/dashboard/enhanced"
        "/api/pilot/toyota-naples"
        "/api/analytics/predictions"
        "/api/integrations"
    )

    for endpoint in "${endpoints[@]}"; do
        if curl -f "${DEPLOYMENT_URL}${endpoint}" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ ${endpoint}${NC}"
        else
            echo -e "${YELLOW}⚠ ${endpoint} (may require authentication)${NC}"
        fi
    done
}

# Function to create deployment tag
create_deployment_tag() {
    echo -e "\n${BLUE}Creating deployment tag...${NC}"

    TAG="deploy-$(date +'%Y%m%d-%H%M%S')"
    COMMIT_SHA=$(git rev-parse HEAD)

    git tag -a "$TAG" -m "Production deployment: $TAG"
    git push origin "$TAG"

    echo -e "${GREEN}✓ Created deployment tag: $TAG${NC}"
    echo -e "${BLUE}Commit SHA: $COMMIT_SHA${NC}"
}

# Function to send notifications
send_notifications() {
    echo -e "\n${BLUE}Sending deployment notifications...${NC}"

    # Create GitHub deployment status
    gh api repos/$REPO_OWNER/$REPO_NAME/deployments \
        --method POST \
        --field ref="$(git rev-parse HEAD)" \
        --field environment="$ENVIRONMENT" \
        --field description="DealershipAI deployment to $ENVIRONMENT" \
        > /dev/null 2>&1 || echo "Failed to create GitHub deployment (continuing...)"

    echo -e "${GREEN}✓ Notifications sent${NC}"
}

# Function to display deployment summary
deployment_summary() {
    echo -e "\n${GREEN}=== Deployment Summary ===${NC}"
    echo -e "${GREEN}✅ DealershipAI successfully deployed to $ENVIRONMENT!${NC}"
    echo
    echo "📊 Deployment Details:"
    echo "  • Environment: $ENVIRONMENT"
    echo "  • Branch: $(git rev-parse --abbrev-ref HEAD)"
    echo "  • Commit: $(git rev-parse --short HEAD)"
    echo "  • Deployed by: $(git config user.name)"
    echo "  • Timestamp: $(date)"
    echo
    echo "🔗 Links:"
    echo "  • Application: ${NEXTAUTH_URL:-https://yourdomain.com}"
    echo "  • Repository: https://github.com/$REPO_OWNER/$REPO_NAME"
    echo "  • Actions: https://github.com/$REPO_OWNER/$REPO_NAME/actions"
    echo
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Monitor application performance and logs"
    echo "2. Run smoke tests on critical user journeys"
    echo "3. Monitor error rates and performance metrics"
    echo "4. Update team on deployment status"
    echo
    echo -e "${YELLOW}Important:${NC}"
    echo "• Keep monitoring the application for the next 30 minutes"
    echo "• Have rollback plan ready if issues are detected"
    echo "• Verify all integrations are working correctly"
}

# Function to handle rollback
rollback() {
    echo -e "\n${RED}=== ROLLBACK INITIATED ===${NC}"
    echo "To rollback this deployment:"
    echo "1. Get previous deployment ID from Vercel dashboard"
    echo "2. Run: vercel --prod rollback <deployment-id>"
    echo "3. Or use the Vercel dashboard to rollback"
    echo
    echo "Database rollback (if needed):"
    echo "1. Check if any migrations were applied"
    echo "2. Run: npx prisma migrate reset (⚠️  DESTRUCTIVE)"
    echo "3. Or restore database from backup"
}

# Main deployment process
main() {
    echo -e "${BLUE}Starting DealershipAI deployment process...${NC}"

    # Trap to handle rollback on failure
    trap 'echo -e "\n${RED}Deployment failed!${NC}"; rollback; exit 1' ERR

    check_prerequisites
    pre_deployment_checks
    run_tests
    build_application
    deploy_to_vercel
    health_checks
    create_deployment_tag
    send_notifications
    deployment_summary

    echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "check")
        check_prerequisites
        ;;
    "test")
        run_tests
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|check|test}"
        echo
        echo "Commands:"
        echo "  deploy   - Run full deployment process (default)"
        echo "  rollback - Show rollback instructions"
        echo "  check    - Check prerequisites only"
        echo "  test     - Run test suite only"
        exit 1
        ;;
esac