#!/bin/bash

# Security Audit Script for DealershipAI Production Deployment
# This script performs comprehensive security checks and hardening

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

AUDIT_DATE=$(date +%Y%m%d_%H%M%S)
AUDIT_REPORT="security_audit_${AUDIT_DATE}.txt"

echo -e "${BLUE}=== DealershipAI Security Audit ===${NC}"
echo -e "${YELLOW}Audit started at: $(date)${NC}"
echo -e "${YELLOW}Report file: ${AUDIT_REPORT}${NC}"
echo

# Initialize audit report
cat > "$AUDIT_REPORT" << EOF
DealershipAI Security Audit Report
Generated: $(date)
Environment: ${NODE_ENV:-development}

=== SECURITY CHECKLIST ===

EOF

# Function to log results
log_result() {
    local status="$1"
    local message="$2"
    local details="$3"

    echo -e "${message}" | tee -a "$AUDIT_REPORT"
    if [ -n "$details" ]; then
        echo -e "   ${details}" | tee -a "$AUDIT_REPORT"
    fi
    echo "" | tee -a "$AUDIT_REPORT"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo -e "${BLUE}1. Environment Security Checks${NC}"

# Check Node.js version
check_nodejs_version() {
    local node_version=$(node --version)
    local major_version=$(echo "$node_version" | sed 's/v\([0-9]*\).*/\1/')

    if [ "$major_version" -ge 18 ]; then
        log_result "PASS" "${GREEN}✓ Node.js version: $node_version (supported)${NC}"
    else
        log_result "FAIL" "${RED}✗ Node.js version: $node_version (outdated, upgrade to >= 18)${NC}"
    fi
}

# Check environment variables
check_environment_variables() {
    echo "Checking critical environment variables..." | tee -a "$AUDIT_REPORT"

    local critical_vars=(
        "NEXTAUTH_SECRET"
        "DATABASE_URL"
        "NEXTAUTH_URL"
    )

    local missing_vars=()

    for var in "${critical_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -eq 0 ]; then
        log_result "PASS" "${GREEN}✓ All critical environment variables are set${NC}"
    else
        log_result "FAIL" "${RED}✗ Missing critical environment variables: ${missing_vars[*]}${NC}"
    fi

    # Check for development secrets in production
    if [ "${NODE_ENV}" = "production" ]; then
        local dev_secrets=(
            "test"
            "development"
            "localhost"
            "example"
            "changeme"
        )

        local insecure_found=false
        for secret in "${dev_secrets[@]}"; do
            if [ -n "${NEXTAUTH_SECRET}" ] && [[ "${NEXTAUTH_SECRET}" == *"$secret"* ]]; then
                log_result "FAIL" "${RED}✗ NEXTAUTH_SECRET contains development pattern: $secret${NC}"
                insecure_found=true
            fi
        done

        if [ "$insecure_found" = false ]; then
            log_result "PASS" "${GREEN}✓ No development secrets detected in production${NC}"
        fi
    fi
}

echo -e "${BLUE}2. Dependency Security Checks${NC}"

# Check for vulnerable dependencies
check_dependencies() {
    if [ -f "package.json" ]; then
        echo "Checking for vulnerable dependencies..." | tee -a "$AUDIT_REPORT"

        if command_exists pnpm; then
            pnpm audit --audit-level high > audit_temp.txt 2>&1 || true
        elif command_exists npm; then
            npm audit --audit-level high > audit_temp.txt 2>&1 || true
        else
            log_result "SKIP" "${YELLOW}⚠ No package manager found for dependency audit${NC}"
            return
        fi

        if grep -q "vulnerabilities" audit_temp.txt; then
            local vuln_count=$(grep -o "[0-9]* vulnerabilities" audit_temp.txt | head -1 | grep -o "[0-9]*")
            if [ "$vuln_count" -gt 0 ]; then
                log_result "FAIL" "${RED}✗ $vuln_count vulnerabilities found in dependencies${NC}" "$(cat audit_temp.txt)"
            else
                log_result "PASS" "${GREEN}✓ No high-severity vulnerabilities found${NC}"
            fi
        else
            log_result "PASS" "${GREEN}✓ Dependency audit completed - no issues found${NC}"
        fi

        rm -f audit_temp.txt
    else
        log_result "SKIP" "${YELLOW}⚠ No package.json found${NC}"
    fi
}

echo -e "${BLUE}3. File and Directory Security${NC}"

# Check file permissions
check_file_permissions() {
    echo "Checking critical file permissions..." | tee -a "$AUDIT_REPORT"

    local critical_files=(
        ".env"
        ".env.local"
        ".env.production"
        "next.config.js"
        "middleware.ts"
    )

    for file in "${critical_files[@]}"; do
        if [ -f "$file" ]; then
            local perms=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%A" "$file" 2>/dev/null)
            if [[ "$perms" =~ ^6[0-4][0-4]$ ]] || [[ "$perms" =~ ^4[0-4][0-4]$ ]]; then
                log_result "PASS" "${GREEN}✓ $file has secure permissions ($perms)${NC}"
            else
                log_result "WARN" "${YELLOW}⚠ $file has potentially insecure permissions ($perms)${NC}"
            fi
        fi
    done
}

# Check for sensitive files
check_sensitive_files() {
    echo "Checking for sensitive files in repository..." | tee -a "$AUDIT_REPORT"

    local sensitive_patterns=(
        "*.pem"
        "*.key"
        "*.crt"
        "*.p12"
        "id_rsa*"
        ".env.production"
        "secrets.*"
        "*.log"
    )

    local found_files=()
    for pattern in "${sensitive_patterns[@]}"; do
        while IFS= read -r -d '' file; do
            # Skip files in .gitignore or common ignore patterns
            if ! git check-ignore "$file" >/dev/null 2>&1; then
                found_files+=("$file")
            fi
        done < <(find . -name "$pattern" -type f -print0 2>/dev/null)
    done

    if [ ${#found_files[@]} -eq 0 ]; then
        log_result "PASS" "${GREEN}✓ No sensitive files found in repository${NC}"
    else
        log_result "WARN" "${YELLOW}⚠ Potentially sensitive files found:${NC}" "$(printf '%s\n' "${found_files[@]}")"
    fi
}

echo -e "${BLUE}4. Security Headers and Configuration${NC}"

# Check Next.js security configuration
check_nextjs_config() {
    echo "Checking Next.js security configuration..." | tee -a "$AUDIT_REPORT"

    if [ -f "next.config.js" ]; then
        if grep -q "headers" next.config.js; then
            log_result "PASS" "${GREEN}✓ Security headers configuration found${NC}"
        else
            log_result "WARN" "${YELLOW}⚠ No security headers configuration in next.config.js${NC}"
        fi

        if grep -q "middleware" next.config.js || [ -f "middleware.ts" ]; then
            log_result "PASS" "${GREEN}✓ Middleware configuration found${NC}"
        else
            log_result "WARN" "${YELLOW}⚠ No middleware configuration found${NC}"
        fi
    else
        log_result "WARN" "${YELLOW}⚠ No next.config.js found${NC}"
    fi
}

echo -e "${BLUE}5. Authentication and Session Security${NC}"

# Check authentication configuration
check_auth_config() {
    echo "Checking authentication security..." | tee -a "$AUDIT_REPORT"

    # Check NextAuth configuration
    if find . -name "*.ts" -o -name "*.js" | xargs grep -l "NextAuth" >/dev/null 2>&1; then
        log_result "PASS" "${GREEN}✓ NextAuth implementation found${NC}"

        # Check for secure session configuration
        if find . -name "*.ts" -o -name "*.js" | xargs grep -l "jwt.*strategy\|session.*strategy" >/dev/null 2>&1; then
            log_result "PASS" "${GREEN}✓ Session strategy configuration found${NC}"
        else
            log_result "WARN" "${YELLOW}⚠ Session strategy configuration not clearly defined${NC}"
        fi
    else
        log_result "WARN" "${YELLOW}⚠ No authentication system detected${NC}"
    fi

    # Check for rate limiting
    if find . -name "*.ts" -o -name "*.js" | xargs grep -l "rateLimit\|rate.limit" >/dev/null 2>&1; then
        log_result "PASS" "${GREEN}✓ Rate limiting implementation found${NC}"
    else
        log_result "WARN" "${YELLOW}⚠ No rate limiting detected${NC}"
    fi
}

echo -e "${BLUE}6. API Security Checks${NC}"

# Check API security
check_api_security() {
    echo "Checking API endpoint security..." | tee -a "$AUDIT_REPORT"

    local api_files=$(find app/api -name "*.ts" 2>/dev/null || find pages/api -name "*.ts" 2>/dev/null || echo "")

    if [ -n "$api_files" ]; then
        local total_apis=$(echo "$api_files" | wc -l)
        local secured_apis=0

        echo "$api_files" | while read -r file; do
            if grep -q "withAuth\|authenticate\|authorization\|auth" "$file"; then
                ((secured_apis++)) || true
            fi
        done

        log_result "INFO" "${BLUE}ℹ API endpoints found: $total_apis${NC}"

        # Check for input validation
        if echo "$api_files" | xargs grep -l "zod\|joi\|yup\|validate" >/dev/null 2>&1; then
            log_result "PASS" "${GREEN}✓ Input validation library detected${NC}"
        else
            log_result "WARN" "${YELLOW}⚠ No input validation library detected${NC}"
        fi

        # Check for error handling
        if echo "$api_files" | xargs grep -l "try.*catch\|error.*handling" >/dev/null 2>&1; then
            log_result "PASS" "${GREEN}✓ Error handling detected in API routes${NC}"
        else
            log_result "WARN" "${YELLOW}⚠ Limited error handling detected${NC}"
        fi
    else
        log_result "INFO" "${BLUE}ℹ No API files found${NC}"
    fi
}

echo -e "${BLUE}7. Database Security${NC}"

# Check database security
check_database_security() {
    echo "Checking database security configuration..." | tee -a "$AUDIT_REPORT"

    if [ -n "${DATABASE_URL}" ]; then
        # Check if using SSL
        if [[ "${DATABASE_URL}" == *"sslmode=require"* ]] || [[ "${DATABASE_URL}" == *"ssl=true"* ]]; then
            log_result "PASS" "${GREEN}✓ Database SSL connection required${NC}"
        else
            log_result "WARN" "${YELLOW}⚠ Database SSL connection not explicitly required${NC}"
        fi

        # Check for connection pooling
        if find . -name "*.ts" -o -name "*.js" | xargs grep -l "pool\|connection.*pool" >/dev/null 2>&1; then
            log_result "PASS" "${GREEN}✓ Database connection pooling detected${NC}"
        else
            log_result "INFO" "${BLUE}ℹ Database connection pooling not clearly configured${NC}"
        fi
    else
        log_result "WARN" "${YELLOW}⚠ No DATABASE_URL configured${NC}"
    fi
}

echo -e "${BLUE}8. Production Readiness Checks${NC}"

# Check production configuration
check_production_config() {
    echo "Checking production readiness..." | tee -a "$AUDIT_REPORT"

    if [ "${NODE_ENV}" = "production" ]; then
        # Check for console.log statements
        local console_logs=$(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "console\.log" | grep -v node_modules | wc -l)

        if [ "$console_logs" -eq 0 ]; then
            log_result "PASS" "${GREEN}✓ No console.log statements found${NC}"
        else
            log_result "WARN" "${YELLOW}⚠ $console_logs files contain console.log statements${NC}"
        fi

        # Check for debug statements
        local debug_statements=$(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "debugger\|console\.debug" | grep -v node_modules | wc -l)

        if [ "$debug_statements" -eq 0 ]; then
            log_result "PASS" "${GREEN}✓ No debug statements found${NC}"
        else
            log_result "WARN" "${YELLOW}⚠ $debug_statements files contain debug statements${NC}"
        fi
    fi
}

# Run all checks
echo -e "${YELLOW}Running security audit...${NC}"
echo

check_nodejs_version
check_environment_variables
check_dependencies
check_file_permissions
check_sensitive_files
check_nextjs_config
check_auth_config
check_api_security
check_database_security
check_production_config

# Summary
echo -e "${BLUE}=== Security Audit Complete ===${NC}"
echo -e "${YELLOW}Full report saved to: ${AUDIT_REPORT}${NC}"
echo

# Count results
local passes=$(grep -c "✓" "$AUDIT_REPORT" || echo "0")
local warnings=$(grep -c "⚠" "$AUDIT_REPORT" || echo "0")
local failures=$(grep -c "✗" "$AUDIT_REPORT" || echo "0")

echo "Summary:" | tee -a "$AUDIT_REPORT"
echo "✓ Passes: $passes" | tee -a "$AUDIT_REPORT"
echo "⚠ Warnings: $warnings" | tee -a "$AUDIT_REPORT"
echo "✗ Failures: $failures" | tee -a "$AUDIT_REPORT"

if [ "$failures" -gt 0 ]; then
    echo -e "\n${RED}❌ Security audit found critical issues that must be addressed before production deployment.${NC}"
    exit 1
elif [ "$warnings" -gt 0 ]; then
    echo -e "\n${YELLOW}⚠️ Security audit completed with warnings. Review recommended.${NC}"
    exit 2
else
    echo -e "\n${GREEN}✅ Security audit passed! Ready for production deployment.${NC}"
    exit 0
fi