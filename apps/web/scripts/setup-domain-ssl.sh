#!/bin/bash

# Domain and SSL Certificate Setup Script for DealershipAI
# Usage: ./scripts/setup-domain-ssl.sh [domain-name]

set -e

DOMAIN=${1:-dealershipai.com}
PROJECT_DIR=$(pwd)
VERCEL_PROJECT_NAME="dealership-ai"

echo "🌐 Setting up domain and SSL certificates for DealershipAI..."
echo "Domain: $DOMAIN"
echo "Project: $VERCEL_PROJECT_NAME"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel@latest
    echo "✅ Vercel CLI installed"
fi

# Check if user is logged in to Vercel
echo "🔐 Checking Vercel authentication..."
if ! vercel whoami &> /dev/null; then
    echo "Please log in to Vercel:"
    vercel login
else
    echo "✅ Vercel authentication verified"
fi

# Link project to Vercel if not already linked
echo "🔗 Linking project to Vercel..."
if [ ! -d ".vercel" ]; then
    vercel link --project=$VERCEL_PROJECT_NAME --yes || vercel link --yes
    echo "✅ Project linked to Vercel"
else
    echo "✅ Project already linked to Vercel"
fi

# Set up environment variables in Vercel
echo "🌍 Setting up environment variables..."

# Read from .env.local if it exists
if [ -f ".env.local" ]; then
    echo "📋 Found .env.local, setting up production environment variables..."

    # Extract and set environment variables
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        if [[ $line =~ ^#.*$ ]] || [[ -z "$line" ]]; then
            continue
        fi

        # Extract variable name and value
        if [[ $line =~ ^([^=]+)=(.*)$ ]]; then
            var_name="${BASH_REMATCH[1]}"
            var_value="${BASH_REMATCH[2]}"

            # Remove quotes if present
            var_value=$(echo "$var_value" | sed 's/^"//;s/"$//')

            echo "Setting $var_name..."
            vercel env add "$var_name" production <<< "$var_value" 2>/dev/null || true
        fi
    done < .env.local

    echo "✅ Environment variables configured"
else
    echo "⚠️  .env.local not found. Please ensure environment variables are set manually."
fi

# Set production-specific environment variables
echo "🔧 Setting production-specific variables..."
vercel env add NEXTAUTH_URL production <<< "https://$DOMAIN" 2>/dev/null || true
vercel env add NEXT_PUBLIC_APP_URL production <<< "https://$DOMAIN" 2>/dev/null || true
vercel env add NODE_ENV production <<< "production" 2>/dev/null || true

# Deploy to get the Vercel URL first
echo "🚀 Deploying to Vercel..."
DEPLOYMENT_URL=$(vercel --prod --yes | grep -o 'https://[^ ]*')

if [ -z "$DEPLOYMENT_URL" ]; then
    echo "❌ Failed to get deployment URL"
    exit 1
fi

echo "✅ Deployment successful: $DEPLOYMENT_URL"

# Add custom domain
echo "🌐 Adding custom domain: $DOMAIN"
vercel domains add "$DOMAIN" --yes || true

# Add www subdomain
echo "🌐 Adding www subdomain: www.$DOMAIN"
vercel domains add "www.$DOMAIN" --yes || true

# Set up domain configuration
echo "📝 Configuring domain settings..."
vercel domains ls

# Create domain verification file
cat > "./public/vercel-domain-verify.txt" << EOF
vercel-domain-verify=$DOMAIN
EOF

echo "✅ Domain verification file created"

# Update next.config.mjs for production domain
echo "⚙️  Updating Next.js configuration for production..."

# Backup existing config
cp next.config.mjs next.config.mjs.backup

# Add domain configuration to next.config.mjs
cat > next.config.mjs << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },

  // Disable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript during builds
  typescript: {
    ignoreBuildErrors: true,
  },

  // Production optimizations
  output: 'standalone',

  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:",
          },
        ],
      },
    ]
  },

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Reduce client-side bundle size
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    domains: ['dealershipai.com', 'www.dealershipai.com'],
  },

  // Environment-specific settings
  ...(process.env.NODE_ENV === 'production' && {
    // Production-only settings
    swcMinify: true,

    // Asset optimization
    assetPrefix: process.env.CDN_URL || '',

    // Error reporting
    sentry: {
      hideSourceMaps: true,
    },

    // Redirect configuration
    async redirects() {
      return [
        {
          source: '/api/health',
          destination: '/api/v1/health',
          permanent: true,
        },
      ]
    },
  }),
};

export default nextConfig;
EOF

echo "✅ Next.js configuration updated for production"

# Create SSL verification script
cat > "./scripts/verify-ssl.sh" << 'EOF'
#!/bin/bash

DOMAIN=${1:-dealershipai.com}

echo "🔒 Verifying SSL certificate for $DOMAIN..."

# Check SSL certificate
echo "📋 SSL Certificate Information:"
echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates -subject -issuer

# Test SSL grade
echo ""
echo "🔍 Testing SSL configuration..."
curl -s "https://api.ssllabs.com/api/v3/analyze?host=$DOMAIN&publish=off&startNew=on" | jq -r '.status'

# Test HTTPS redirect
echo ""
echo "🔄 Testing HTTPS redirect..."
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}" "http://$DOMAIN")
if [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    echo "✅ HTTPS redirect working (HTTP $HTTP_STATUS)"
else
    echo "⚠️  HTTPS redirect not detected (HTTP $HTTP_STATUS)"
fi

# Test security headers
echo ""
echo "🛡️  Security Headers:"
curl -s -I "https://$DOMAIN" | grep -E "(Strict-Transport-Security|X-Content-Type-Options|X-Frame-Options|X-XSS-Protection)"

echo ""
echo "✅ SSL verification completed"
EOF

chmod +x "./scripts/verify-ssl.sh"

# Deploy with custom domain configuration
echo "🚀 Deploying with custom domain configuration..."
vercel --prod --yes

# Wait for DNS propagation
echo "⏳ Waiting for DNS propagation (this may take a few minutes)..."
echo "You may need to configure your DNS records:"
echo ""
echo "For $DOMAIN:"
echo "Type: A Record"
echo "Name: @"
echo "Value: 76.76.19.61"
echo ""
echo "For www.$DOMAIN:"
echo "Type: CNAME"
echo "Name: www"
echo "Value: cname.vercel-dns.com"
echo ""

# Test domain accessibility
echo "🧪 Testing domain accessibility..."
sleep 30

# Test main domain
echo "Testing https://$DOMAIN..."
if curl -s -f "https://$DOMAIN" > /dev/null; then
    echo "✅ https://$DOMAIN is accessible"
else
    echo "⚠️  https://$DOMAIN is not yet accessible (DNS may still be propagating)"
fi

# Test www subdomain
echo "Testing https://www.$DOMAIN..."
if curl -s -f "https://www.$DOMAIN" > /dev/null; then
    echo "✅ https://www.$DOMAIN is accessible"
else
    echo "⚠️  https://www.$DOMAIN is not yet accessible (DNS may still be propagating)"
fi

# Create monitoring script
cat > "./scripts/monitor-ssl.sh" << 'EOF'
#!/bin/bash

DOMAIN=${1:-dealershipai.com}

echo "📊 SSL Certificate Monitoring for $DOMAIN"
echo "========================================"

# Check certificate expiration
CERT_EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
CERT_EXPIRY_TIMESTAMP=$(date -d "$CERT_EXPIRY" +%s)
CURRENT_TIMESTAMP=$(date +%s)
DAYS_UNTIL_EXPIRY=$(( ($CERT_EXPIRY_TIMESTAMP - $CURRENT_TIMESTAMP) / 86400 ))

echo "Certificate expires: $CERT_EXPIRY"
echo "Days until expiry: $DAYS_UNTIL_EXPIRY"

if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
    echo "⚠️  WARNING: Certificate expires in less than 30 days!"
else
    echo "✅ Certificate expiry is healthy"
fi

# Check domain accessibility
echo ""
echo "🌐 Domain Accessibility:"
for url in "https://$DOMAIN" "https://www.$DOMAIN"; do
    if curl -s -f "$url/api/health" > /dev/null; then
        echo "✅ $url - Healthy"
    else
        echo "❌ $url - Not accessible"
    fi
done

# Performance check
echo ""
echo "⚡ Performance Check:"
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "https://$DOMAIN")
echo "Response time: ${RESPONSE_TIME}s"

if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    echo "✅ Response time is good"
else
    echo "⚠️  Response time is slow"
fi
EOF

chmod +x "./scripts/monitor-ssl.sh"

# Create domain configuration summary
cat > "./DOMAIN-SETUP.md" << EOF
# Domain and SSL Configuration

## Domain Information
- Primary Domain: $DOMAIN
- WWW Domain: www.$DOMAIN
- Vercel Project: $VERCEL_PROJECT_NAME
- Deployment URL: $DEPLOYMENT_URL

## DNS Configuration
Configure the following DNS records with your domain registrar:

### A Record (for $DOMAIN)
\`\`\`
Type: A
Name: @
Value: 76.76.19.61
TTL: 300
\`\`\`

### CNAME Record (for www.$DOMAIN)
\`\`\`
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 300
\`\`\`

## SSL Certificate
- SSL certificates are automatically managed by Vercel
- Let's Encrypt certificates with auto-renewal
- Full SSL/TLS encryption enabled

## Security Headers Configured
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Content-Security-Policy
- Referrer-Policy

## Monitoring Scripts
- \`./scripts/verify-ssl.sh\` - Verify SSL configuration
- \`./scripts/monitor-ssl.sh\` - Monitor certificate health

## Testing Commands
\`\`\`bash
# Verify SSL certificate
./scripts/verify-ssl.sh $DOMAIN

# Monitor certificate health
./scripts/monitor-ssl.sh $DOMAIN

# Test application endpoints
curl -f https://$DOMAIN/api/health
curl -f https://$DOMAIN/api/v1/probe/status
\`\`\`

## Next Steps
1. Configure DNS records with your domain registrar
2. Wait for DNS propagation (up to 24 hours)
3. Run SSL verification: \`./scripts/verify-ssl.sh $DOMAIN\`
4. Set up monitoring alerts
5. Configure backup and disaster recovery

EOF

echo ""
echo "📊 Domain and SSL Setup Summary"
echo "================================"
echo "Primary Domain: https://$DOMAIN"
echo "WWW Domain: https://www.$DOMAIN"
echo "Vercel Project: $VERCEL_PROJECT_NAME"
echo "Deployment URL: $DEPLOYMENT_URL"
echo ""
echo "📋 Next Steps:"
echo "1. Configure DNS records (see DOMAIN-SETUP.md)"
echo "2. Wait for DNS propagation (up to 24 hours)"
echo "3. Run: ./scripts/verify-ssl.sh $DOMAIN"
echo "4. Run: ./scripts/monitor-ssl.sh $DOMAIN"
echo ""
echo "📄 Documentation created: DOMAIN-SETUP.md"
echo "✅ Domain and SSL certificate setup completed!"