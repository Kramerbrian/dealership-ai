#!/bin/bash

# DealershipAI Prerequisites Installation Script
# Installs required tools for deployment

set -e

echo "🔧 Installing DealershipAI Deployment Prerequisites"
echo "=================================================="

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

# Check if running on macOS
check_platform() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        print_status "✅ Running on macOS"
        PLATFORM="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_status "✅ Running on Linux"
        PLATFORM="linux"
    else
        print_error "❌ Unsupported platform: $OSTYPE"
        exit 1
    fi
}

# Install Homebrew if not present (macOS)
install_homebrew() {
    if [[ "$PLATFORM" == "macos" ]]; then
        if ! command -v brew &> /dev/null; then
            print_status "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        else
            print_status "✅ Homebrew already installed"
        fi
    fi
}

# Install AWS CLI
install_aws_cli() {
    print_section "Installing AWS CLI"

    if command -v aws &> /dev/null; then
        print_status "✅ AWS CLI already installed"
        aws --version
        return 0
    fi

    case "$PLATFORM" in
        "macos")
            print_status "Installing AWS CLI via Homebrew..."
            brew install awscli
            ;;
        "linux")
            print_status "Installing AWS CLI for Linux..."
            curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
            unzip -q awscliv2.zip
            sudo ./aws/install
            rm -rf aws awscliv2.zip
            ;;
    esac

    # Verify installation
    if command -v aws &> /dev/null; then
        print_status "✅ AWS CLI installed successfully"
        aws --version
    else
        print_error "❌ AWS CLI installation failed"
        exit 1
    fi
}

# Install GitHub CLI
install_github_cli() {
    print_section "Installing GitHub CLI"

    if command -v gh &> /dev/null; then
        print_status "✅ GitHub CLI already installed"
        gh --version
        return 0
    fi

    case "$PLATFORM" in
        "macos")
            print_status "Installing GitHub CLI via Homebrew..."
            brew install gh
            ;;
        "linux")
            print_status "Installing GitHub CLI for Linux..."
            curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
            sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
            sudo apt update
            sudo apt install gh -y
            ;;
    esac

    # Verify installation
    if command -v gh &> /dev/null; then
        print_status "✅ GitHub CLI installed successfully"
        gh --version
    else
        print_error "❌ GitHub CLI installation failed"
        exit 1
    fi
}

# Install additional tools
install_additional_tools() {
    print_section "Installing Additional Tools"

    # jq for JSON processing
    if ! command -v jq &> /dev/null; then
        print_status "Installing jq..."
        case "$PLATFORM" in
            "macos")
                brew install jq
                ;;
            "linux")
                sudo apt install jq -y
                ;;
        esac
    else
        print_status "✅ jq already installed"
    fi

    # curl (usually pre-installed)
    if ! command -v curl &> /dev/null; then
        print_status "Installing curl..."
        case "$PLATFORM" in
            "macos")
                brew install curl
                ;;
            "linux")
                sudo apt install curl -y
                ;;
        esac
    else
        print_status "✅ curl already installed"
    fi

    # openssl (for generating secrets)
    if ! command -v openssl &> /dev/null; then
        print_status "Installing openssl..."
        case "$PLATFORM" in
            "macos")
                brew install openssl
                ;;
            "linux")
                sudo apt install openssl -y
                ;;
        esac
    else
        print_status "✅ openssl already installed"
    fi
}

# Setup AWS credentials
setup_aws_credentials() {
    print_section "AWS Configuration"

    if aws sts get-caller-identity &> /dev/null; then
        print_status "✅ AWS credentials already configured"
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        print_status "AWS Account: $AWS_ACCOUNT_ID"
        return 0
    fi

    print_warning "AWS credentials not configured. Please run 'aws configure' after installation."
    echo ""
    echo "You will need:"
    echo "  • AWS Access Key ID"
    echo "  • AWS Secret Access Key"
    echo "  • Default region (recommended: us-east-1)"
    echo "  • Default output format (recommended: json)"
    echo ""
    read -p "Would you like to configure AWS credentials now? (y/N): " configure_aws

    if [[ $configure_aws =~ ^[Yy]$ ]]; then
        aws configure
    else
        print_warning "⚠️  Remember to run 'aws configure' before deployment"
    fi
}

# Setup GitHub authentication
setup_github_auth() {
    print_section "GitHub Authentication"

    if gh auth status &> /dev/null; then
        print_status "✅ GitHub CLI already authenticated"
        return 0
    fi

    print_warning "GitHub CLI not authenticated. Please run 'gh auth login' after installation."
    read -p "Would you like to authenticate with GitHub now? (y/N): " auth_github

    if [[ $auth_github =~ ^[Yy]$ ]]; then
        gh auth login
    else
        print_warning "⚠️  Remember to run 'gh auth login' before setting up secrets"
    fi
}

# Display summary
display_summary() {
    print_section "🎉 Prerequisites Installation Complete!"

    echo ""
    echo "Installed Tools:"
    echo "================"

    if command -v aws &> /dev/null; then
        echo "✅ AWS CLI: $(aws --version)"
    else
        echo "❌ AWS CLI: Not installed"
    fi

    if command -v gh &> /dev/null; then
        echo "✅ GitHub CLI: $(gh --version | head -n1)"
    else
        echo "❌ GitHub CLI: Not installed"
    fi

    if command -v jq &> /dev/null; then
        echo "✅ jq: $(jq --version)"
    else
        echo "❌ jq: Not installed"
    fi

    echo ""
    echo "Next Steps:"
    echo "==========="
    echo "1. Configure AWS credentials (if not done):"
    echo "   aws configure"
    echo ""
    echo "2. Authenticate with GitHub (if not done):"
    echo "   gh auth login"
    echo ""
    echo "3. Deploy AWS infrastructure:"
    echo "   ./scripts/deploy-aws-infrastructure.sh"
    echo ""
    echo "4. Set up GitHub secrets:"
    echo "   ./scripts/setup-secrets.sh"
    echo ""
}

# Main execution
main() {
    echo "Installing prerequisites for DealershipAI deployment..."
    echo ""

    check_platform
    install_homebrew
    install_aws_cli
    install_github_cli
    install_additional_tools
    setup_aws_credentials
    setup_github_auth
    display_summary
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--help]"
        echo ""
        echo "This script installs the required tools for DealershipAI deployment:"
        echo "  - AWS CLI"
        echo "  - GitHub CLI"
        echo "  - jq (JSON processor)"
        echo "  - curl, openssl (usually pre-installed)"
        echo ""
        echo "Supported platforms:"
        echo "  - macOS (via Homebrew)"
        echo "  - Linux (Ubuntu/Debian)"
        exit 0
        ;;
    *)
        main
        ;;
esac