#!/bin/bash
# DealershipAI Dashboard - New Installation Script
# Run this script to set up a fresh DealershipAI Dashboard instance

set -e  # Exit on any error

echo "🚀 Setting up DealershipAI Dashboard - Think Different Edition..."
echo "=================================================================="

# 1. Initialize new project
PROJECT_NAME="dealership-ai-dashboard-new"
mkdir -p $PROJECT_NAME
cd $PROJECT_NAME
git init

echo "📁 Project initialized: $PROJECT_NAME"

# 2. Create directory structure matching your existing format
mkdir -p {agents,components,pages/{api/{agent,dashboard},dashboard},config,lib,styles,types,scripts,reports,logs}

# 3. Create package.json with all dependencies from your existing project
cat > package.json << 'EOF'
{
  "name": "dealership-ai-dashboard",
  "version": "2.0.0",
  "private": true,
  "description": "AI-powered dashboard for automotive dealerships to track visibility, assess risks, and optimize their digital presence",
  "scripts": {
    "dev": "next dev",
    "prebuild": "vercel env pull .env.local --yes 2>/dev/null || true && (node scripts/env-check.js 2>/dev/null || echo 'Environment check skipped in production')",
    "build": "next build",
    "start": "next start",
    "env:check": "node scripts/env-check.js",
    "test:integration": "node scripts/integration-test.js",
    "test:integration:bash": "bash scripts/integration-test.sh",
    "deploy": "bash deploy.sh",
    "deploy:test": "DOMAIN=www.dealershipai.com npm run test:integration",
    "test:honda": "DEALER_NAME='Honda of Miami' DEALER_LOCATION='Miami, FL' DEALER_ID='honda-miami' npm run test:integration",
    "test:bmw": "DEALER_NAME='BMW Orlando' DEALER_LOCATION='Orlando, FL' DEALER_ID='bmw-orlando' npm run test:integration",
    "test:used": "DEALER_NAME='AutoMax Used Cars' DEALER_LOCATION='Tampa, FL' DEALER_ID='automax-tampa' npm run test:integration",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "db:generate-types": "supabase gen types typescript --project-id=vxrdvkhkombwlhjvtsmw --schema=public > lib/database.types.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "eval:golden": "node tools/eval-golden.mjs",
    "test:wandb": "node test-wandb-integration.mjs",
    "setup:finetuning": "node setup-fine-tuning.mjs",
    "generate:training-data": "node tools/generate-training-data.mjs",
    "db:reset": "node scripts/reset-db.js",
    "db:seed": "node scripts/seed-db.js",
    "rrt:pipeline": "node scripts/rrt-pipeline.mjs",
    "streamlined": "next dev --port 3001",
    "dashboard:streamlined": "next dev --port 3001"
  },
  "dependencies": {
    "@google-analytics/data": "^5.2.0",
    "@google-cloud/storage": "^7.17.1",
    "@hookform/resolvers": "^3.10.0",
    "@opentelemetry/api": "^1.9.0",
    "@supabase/ssr": "^0.7.0",
    "@supabase/supabase-js": "^2.38.0",
    "@types/cheerio": "^0.22.35",
    "@upstash/ratelimit": "^2.0.6",
    "@upstash/redis": "^1.35.4",
    "ajv": "^8.17.1",
    "ajv-formats": "^2.1.1",
    "cheerio": "^1.1.2",
    "clsx": "^2.0.0",
    "date-fns": "^2.30.0",
    "dotenv": "^17.2.2",
    "framer-motion": "^12.23.16",
    "google-auth-library": "^10.3.0",
    "googleapis": "^131.0.0",
    "lucide-react": "^0.263.1",
    "next": "^14.0.0",
    "node-fetch": "^3.3.2",
    "openai": "^5.20.3",
    "p-limit": "^5.0.0",
    "puppeteer": "^21.5.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.63.0",
    "react-hot-toast": "^2.6.0",
    "react-router-dom": "^7.9.1",
    "recharts": "^2.15.4",
    "tailwind-merge": "^2.6.0",
    "typescript": "^5.2.0",
    "usehooks-ts": "^2.16.0",
    "xml2js": "^0.6.2",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@tailwindcss/forms": "^0.5.6",
    "@tailwindcss/typography": "^0.5.10",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/react": "^13.4.0",
    "@types/node": "^20.8.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@typescript-eslint/eslint-plugin": "^6.7.0",
    "@typescript-eslint/parser": "^6.7.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.50.0",
    "eslint-config-next": "^14.0.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^30.1.2",
    "postcss": "^8.4.0",
    "prettier": "^3.6.2",
    "prettier-plugin-tailwindcss": "^0.5.14",
    "supabase": "^2.40.7",
    "tailwindcss": "^3.3.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "automotive",
    "dealership",
    "ai",
    "dashboard",
    "analytics",
    "seo",
    "visibility"
  ],
  "author": "Brian Kramer",
  "license": "MIT"
}
EOF

echo "📦 package.json created with full dependency list"

# 4. Create environment template with all your configurations
cat > .env.example << 'EOF'
# Core Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# AI Agent API Keys - Your Competitive Arsenal
ANTHROPIC_API_KEY=your_claude_api_key
OPENAI_API_KEY=your_openai_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
GEMINI_API_KEY=your_gemini_api_key

# Google APIs for Enhanced Analysis
GOOGLE_PLACES_API_KEY=your_google_places_key_here
GOOGLE_PAGESPEED_API_KEY=your_google_pagespeed_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_key_here

# Vertex AI Configuration (Advanced)
ANTHROPIC_VERTEX_BASE_URL=https://litellm-server:4000/vertex_ai/v1
ANTHROPIC_VERTEX_PROJECT_ID=your_gcp_project_id
CLAUDE_CODE_SKIP_VERTEX_AUTH=1
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=us-east5

# Rate Limiting (Upstash Redis - Optional)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Dashboard Config
NEXT_PUBLIC_DEFAULT_DEALER_ID=premium-auto
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NODE_ENV=development
EOF

echo "🔧 Environment template created"

# 5. Create Next.js config matching your requirements
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: false
  },
  images: {
    domains: ['images.unsplash.com', 'api.qrserver.com']
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard/premium-auto',
        permanent: false,
      },
    ]
  }
};

module.exports = nextConfig;
EOF

# 6. Create enhanced Tailwind config
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './agents/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
EOF

# 7. Create TypeScript config
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{"name": "next"}],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

# 8. Create PostCSS config
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF

# 9. Create global styles with "Think Different" theme
cat > styles/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    box-sizing: border-box;
    padding: 0;
    margin: 0;
  }

  html, body {
    max-width: 100vw;
    overflow-x: hidden;
    font-family: 'Inter', system-ui, sans-serif;
  }

  body {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    color: #1e293b;
    min-height: 100vh;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
}

@layer components {
  .btn-primary {
    @apply bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors;
  }

  .btn-secondary {
    @apply bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors;
  }

  .card {
    @apply bg-white rounded-2xl border border-gray-200 p-6 shadow-sm;
  }

  .metric-card {
    @apply card hover:shadow-md transition-shadow cursor-pointer;
  }

  .tab-active {
    @apply bg-blue-600 text-white;
  }

  .tab-inactive {
    @apply text-gray-700 hover:bg-gray-100;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }

  .gradient-text {
    @apply bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent;
  }

  .animate-fade-in {
    animation: fadeIn 0.5s ease-in;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Think Different inspired animations */
.think-different-pulse {
  animation: thinkDifferentPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes thinkDifferentPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}
EOF

# 10. Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Supabase
.supabase/
EOF

# 11. Create main dashboard page matching your structure
cat > pages/dashboard/[dealerId].tsx << 'EOF'
// /pages/dashboard/[dealerId].tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';

// Import agent system
import { useAgentLoader, AgentRegistry } from '../../agents/AgentLoader';

// Dynamic imports for blocks (code splitting)
const OverviewBlock = dynamic(() => import('../../components/OverviewBlock'), {
  loading: () => <BlockSkeleton title="Overview" />
});

const UGCBlock = dynamic(() => import('../../components/UGCBlock'), {
  loading: () => <BlockSkeleton title="UGC Monitoring" />
});

const SchemaBlock = dynamic(() => import('../../components/SchemaBlock'), {
  loading: () => <BlockSkeleton title="Schema Auditor" />
});

const AIIntelligenceBlock = dynamic(() => import('../../components/AIIntelligenceBlock'), {
  loading: () => <BlockSkeleton title="AI Intelligence" />
});

const SettingsBlock = dynamic(() => import('../../components/SettingsBlock'), {
  loading: () => <BlockSkeleton title="Settings" />
});

// Types
interface DashboardConfig {
  dealerId: string;
  businessInfo: {
    name: string;
    domain: string;
    location: string;
    industry: string;
  };
  enabledBlocks: string[];
  blockConfigs: Record<string, any>;
  agentRegistry?: AgentRegistry;
  supabaseConfig: {
    url: string;
    anonKey: string;
  };
}

interface BlockDefinition {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  icon: string;
  description: string;
  requiredRole: 'admin' | 'manager' | 'viewer';
}

// Available blocks registry
const AVAILABLE_BLOCKS: BlockDefinition[] = [
  {
    id: 'overview',
    title: 'Overview',
    component: OverviewBlock,
    icon: '📊',
    description: 'Key metrics and performance summary',
    requiredRole: 'viewer'
  },
  {
    id: 'ai-intelligence',
    title: 'AI Intelligence',
    component: AIIntelligenceBlock,
    icon: '🧠',
    description: 'SEO, AEO, GEO scores and AI visibility',
    requiredRole: 'viewer'
  },
  {
    id: 'ugc',
    title: 'UGC Monitoring',
    component: UGCBlock,
    icon: '💬',
    description: 'Social media and review monitoring',
    requiredRole: 'manager'
  },
  {
    id: 'schema',
    title: 'Schema Auditor',
    component: SchemaBlock,
    icon: '🔍',
    description: 'Structured data validation',
    requiredRole: 'admin'
  },
  {
    id: 'settings',
    title: 'Settings',
    component: SettingsBlock,
    icon: '⚙️',
    description: 'Configuration and preferences',
    requiredRole: 'admin'
  }
];

// Loading skeleton component
const BlockSkeleton = ({ title }: { title: string }) => (
  <div className="bg-white border rounded-2xl p-6">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
      <div className="h-6 bg-gray-200 rounded w-32 animate-pulse" />
    </div>
    <div className="space-y-4">
      <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
      <div className="h-24 bg-gray-200 rounded animate-pulse" />
    </div>
  </div>
);

// Main Dashboard Component
export default function DealershipDashboard() {
  const router = useRouter();
  const { dealerId } = router.query;

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [activeBlock, setActiveBlock] = useState<string>('overview');
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize agent loader with custom registry if provided
  const { registry, tasks, executeTask } = useAgentLoader(config?.agentRegistry);

  // Load dashboard configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!dealerId) return;

      setLoading(true);
      setError(null);

      try {
        // Load from environment or API
        const response = await fetch(`/api/dashboard/config?dealerId=${dealerId}`);

        if (!response.ok) {
          // Fallback to default config
          const defaultConfig: DashboardConfig = {
            dealerId: dealerId as string,
            businessInfo: {
              name: 'Premium Auto Dealership',
              domain: 'premiumauto.com',
              location: 'Cape Coral, FL',
              industry: 'automotive'
            },
            enabledBlocks: ['overview', 'ai-intelligence', 'ugc', 'schema'],
            blockConfigs: {
              overview: { refreshInterval: 300000, autoLoad: true },
              ugc: {
                platforms: ['google', 'yelp', 'facebook', 'reddit'],
                refreshInterval: 60000,
                autoResponse: false
              },
              schema: {
                autoFix: false,
                schemaTypes: ['LocalBusiness', 'Organization', 'Vehicle']
              }
            },
            supabaseConfig: {
              url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
              anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            }
          };
          setConfig(defaultConfig);
        } else {
          const data = await response.json();
          setConfig(data);
        }

        // Load user role (could be from auth, for now using localStorage)
        const savedRole = localStorage.getItem(`role_${dealerId}`) as typeof userRole;
        if (savedRole) setUserRole(savedRole);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [dealerId]);

  // Available blocks based on role and config
  const availableBlocks = useMemo(() => {
    if (!config) return [];

    return AVAILABLE_BLOCKS.filter(block => {
      // Check if block is enabled
      if (!config.enabledBlocks.includes(block.id)) return false;

      // Check role permissions
      const roleHierarchy = { viewer: 1, manager: 2, admin: 3 };
      return roleHierarchy[userRole] >= roleHierarchy[block.requiredRole];
    });
  }, [config, userRole]);

  // Tab navigation
  const TabNavigation = () => (
    <nav className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex space-x-1 overflow-x-auto py-2">
          {availableBlocks.map(block => {
            const isActive = activeBlock === block.id;
            const hasRunningTask = Object.values(tasks).some(t =>
              t.blockId === block.id &&
              ['pending', 'running'].includes(t.status)
            );
            const hasEscalatedTask = Object.values(tasks).some(t =>
              t.blockId === block.id &&
              t.status === 'escalated'
            );

            return (
              <button
                key={block.id}
                onClick={() => setActiveBlock(block.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{block.icon}</span>
                <span>{block.title}</span>
                {hasEscalatedTask && (
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Escalated task" />
                )}
                {hasRunningTask && !hasEscalatedTask && (
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" title="Running task" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );

  // Header component
  const Header = () => (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">DealershipAI Dashboard</h1>
            <p className="text-gray-600">{config?.businessInfo.name}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Role selector (admin only) */}
            {userRole === 'admin' && (
              <select
                value={userRole}
                onChange={(e) => {
                  const newRole = e.target.value as typeof userRole;
                  setUserRole(newRole);
                  localStorage.setItem(`role_${dealerId}`, newRole);
                }}
                className="px-3 py-1 border rounded-lg text-sm"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
            )}

            {/* Task status indicator */}
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full think-different-pulse" />
                <span className="text-gray-600">
                  {Object.values(registry.agents).length} agents ready
                </span>
              </div>

              {Object.values(tasks).some(t => ['pending', 'running'].includes(t.status)) && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="text-gray-600">Processing...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );

  // Render active block
  const renderActiveBlock = () => {
    if (!config) return null;

    const blockDef = availableBlocks.find(b => b.id === activeBlock);
    if (!blockDef) return <div className="p-6 text-center text-gray-500">Block not found</div>;

    const BlockComponent = blockDef.component;
    const blockConfig = config.blockConfigs[activeBlock] || {};

    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          <BlockComponent
            dealerId={config.dealerId}
            businessInfo={config.businessInfo}
            config={blockConfig}
          />
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto p-6">
          <BlockSkeleton title="Loading Dashboard..." />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border rounded-2xl p-8 text-center max-w-md">
          <div className="text-red-500 text-2xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Dashboard Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <TabNavigation />
      {renderActiveBlock()}

      {/* Global task status overlay */}
      {Object.values(tasks).some(t => t.status === 'escalated') && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span className="text-sm">
              {Object.values(tasks).filter(t => t.status === 'escalated').length} tasks escalated
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
EOF

# 12. Create pages/_app.tsx for global app configuration
cat > pages/_app.tsx << 'EOF'
import type { AppProps } from 'next/app'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
EOF

# 13. Create the AgentLoader stub
mkdir -p agents
cat > agents/AgentLoader.tsx << 'EOF'
// Placeholder AgentLoader - replace with full implementation
import { useState } from 'react';

export interface AgentRegistry {
  agents: Record<string, any>;
}

export function useAgentLoader(registry?: AgentRegistry) {
  const [tasks, setTasks] = useState({});

  const defaultRegistry = {
    agents: {
      'claude-sonnet': { id: 'claude-sonnet', name: 'Claude Sonnet' },
      'chatgpt-4': { id: 'chatgpt-4', name: 'ChatGPT-4' },
      'perplexity': { id: 'perplexity', name: 'Perplexity' },
      'gemini': { id: 'gemini', name: 'Gemini Pro' }
    }
  };

  const executeTask = async (taskType: string, inputs: any, blockId: string) => {
    console.log('Executing task:', taskType, inputs, blockId);
    return { id: Date.now().toString(), result: 'success' };
  };

  return {
    registry: registry || defaultRegistry,
    tasks,
    executeTask
  };
}
EOF

# 14. Create enhanced components with AI consensus integration
mkdir -p components

# Create AI Intelligence Block with real consensus scoring
cat > components/AIIntelligenceBlock.tsx << 'EOF'
import React, { useState, useEffect } from 'react';

interface AIIntelligenceBlockProps {
  dealerId: string;
  businessInfo: any;
  config: any;
}

export default function AIIntelligenceBlock({ dealerId, businessInfo, config }: AIIntelligenceBlockProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runConsensusAnalysis = async (analysisType: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/analysis/consensus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: businessInfo?.domain,
          analysisType,
          dealerId
        })
      });
      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 gradient-text">🧠 AI Intelligence Console</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => runConsensusAnalysis('localSEO')}
            className="btn-primary text-sm py-2 px-3"
            disabled={loading}
          >
            🎯 Local SEO
          </button>
          <button
            onClick={() => runConsensusAnalysis('ecommerceSEO')}
            className="btn-primary text-sm py-2 px-3"
            disabled={loading}
          >
            🛒 E-commerce SEO
          </button>
          <button
            onClick={() => runConsensusAnalysis('videoSEO')}
            className="btn-primary text-sm py-2 px-3"
            disabled={loading}
          >
            📹 Video SEO
          </button>
          <button
            onClick={() => runConsensusAnalysis('inventoryVisibility')}
            className="btn-primary text-sm py-2 px-3"
            disabled={loading}
          >
            🚗 Inventory
          </button>
          <button
            onClick={() => runConsensusAnalysis('voiceCommerce')}
            className="btn-primary text-sm py-2 px-3"
            disabled={loading}
          >
            🎤 Voice Search
          </button>
          <button
            onClick={() => runConsensusAnalysis('competitiveIntel')}
            className="btn-primary text-sm py-2 px-3"
            disabled={loading}
          >
            🛡️ Competitive
          </button>
          <button
            onClick={() => runConsensusAnalysis('localDominance')}
            className="btn-primary text-sm py-2 px-3"
            disabled={loading}
          >
            📍 Local Dominance
          </button>
          <button
            onClick={() => {
              const analysisTypes = ['localSEO', 'ecommerceSEO', 'videoSEO', 'inventoryVisibility'];
              analysisTypes.forEach((type, i) => {
                setTimeout(() => runConsensusAnalysis(type), i * 3000);
              });
            }}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm py-2 px-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all"
            disabled={loading}
          >
            ⚡ Full Audit
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="think-different-pulse">🤖 AI Consensus Analysis Running...</div>
          </div>
        )}

        {analysis && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Consensus Score: {analysis.consensus_score}/100</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                analysis.confidence === 'high' ? 'bg-green-100 text-green-800' :
                analysis.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {analysis.confidence.toUpperCase()} CONFIDENCE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card bg-blue-50">
                <h4 className="font-semibold text-blue-900">Perplexity Score</h4>
                <p className="text-2xl font-bold text-blue-600">{analysis.individual_scores.perplexity}/100</p>
              </div>
              <div className="card bg-green-50">
                <h4 className="font-semibold text-green-900">ChatGPT Score</h4>
                <p className="text-2xl font-bold text-green-600">{analysis.individual_scores.chatgpt}/100</p>
              </div>
              <div className="card bg-purple-50">
                <h4 className="font-semibold text-purple-900">Gemini Score</h4>
                <p className="text-2xl font-bold text-purple-600">{analysis.individual_scores.gemini}/100</p>
              </div>
            </div>

            <div className="card bg-red-50">
              <h4 className="font-semibold text-red-900 mb-2">🚨 Unanimous Issues (All AIs Agree)</h4>
              <ul className="space-y-1">
                {analysis.unanimous_issues.map((issue: string, index: number) => (
                  <li key={index} className="text-red-700">• {issue}</li>
                ))}
              </ul>
            </div>

            <div className="card bg-green-50">
              <h4 className="font-semibold text-green-900 mb-2">✅ Quick Wins</h4>
              <ul className="space-y-1">
                {analysis.all_quick_wins.slice(0, 5).map((win: string, index: number) => (
                  <li key={index} className="text-green-700">• {win}</li>
                ))}
              </ul>
            </div>

            <div className="card bg-blue-50">
              <h4 className="font-semibold text-blue-900 mb-2">💡 AI Recommendation</h4>
              <p className="text-blue-800">{analysis.recommendation}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
EOF

# Create other component stubs
for component in OverviewBlock UGCBlock SchemaBlock SettingsBlock; do
  cat > components/${component}.tsx << EOF
import React from 'react';

interface ${component}Props {
  dealerId: string;
  businessInfo: any;
  config: any;
}

export default function ${component}({ dealerId, businessInfo, config }: ${component}Props) {
  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">${component}</h2>
      <p className="text-gray-600">
        ${component} component for {businessInfo?.name || dealerId}
      </p>
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          🚀 This component is ready for your custom implementation.
          Replace this placeholder with your AI-powered features!
        </p>
      </div>
    </div>
  );
}
EOF
done

# Create API directory and consensus endpoint
mkdir -p pages/api/analysis
cat > pages/api/analysis/consensus.js << 'EOF'
// API endpoint for AI consensus analysis
const { executeConsensusAnalysis, DEALERSHIP_PROMPTS } = require('../../../lib/ai-consensus-engine');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, analysisType = 'localDominance', dealerId } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  try {
    // Get the specific prompt for the analysis type
    const taskPrompt = DEALERSHIP_PROMPTS[analysisType] || DEALERSHIP_PROMPTS.localDominance;

    // Execute consensus analysis with all three AI providers
    const result = await executeConsensusAnalysis(domain, taskPrompt);

    // Add metadata
    const response = {
      ...result,
      metadata: {
        domain,
        analysisType,
        dealerId,
        timestamp: new Date().toISOString(),
        aiProviders: ['perplexity', 'chatgpt', 'gemini']
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Consensus analysis failed:', error);

    // Return a fallback response
    res.status(500).json({
      error: 'Analysis failed',
      fallback: {
        consensus_score: 50,
        confidence: 'low',
        recommendation: 'Unable to complete analysis - manual review required',
        individual_scores: { perplexity: null, chatgpt: null, gemini: null },
        unanimous_issues: [],
        all_quick_wins: []
      }
    });
  }
}
EOF

# Create AI consensus engine
mkdir -p lib
cat > lib/ai-consensus-engine.js << 'EOF'
// Simplified AI consensus engine for the setup
const AI_PROVIDERS = {
  perplexity: { model: 'pplx-70b-online', purpose: 'Search visibility' },
  chatgpt: { model: 'gpt-4-turbo', purpose: 'Content generation' },
  gemini: { model: 'gemini-pro', purpose: 'Google optimization' }
};

const DEALERSHIP_PROMPTS = {
  localSEO: 'Evaluate GMB presence and local search optimization',
  ecommerceSEO: 'Check product schema and e-commerce optimization',
  videoSEO: 'Analyze YouTube optimization for automotive dealership',
  localDominance: 'Analyze local search dominance and Google Business Profile optimization',
  inventoryVisibility: 'Check vehicle inventory visibility and schema markup',
  voiceCommerce: 'Analyze voice search readiness for car buyers',
  competitiveIntel: 'Real-time competitive analysis and market positioning'
};

async function executeConsensusAnalysis(domain, task) {
  // Simulate consensus analysis (replace with real implementation)
  return {
    consensus_score: Math.floor(Math.random() * 40) + 60, // 60-100 range
    individual_scores: {
      perplexity: Math.floor(Math.random() * 30) + 70,
      chatgpt: Math.floor(Math.random() * 30) + 65,
      gemini: Math.floor(Math.random() * 30) + 75
    },
    unanimous_issues: [
      'Missing LocalBusiness schema markup',
      'Google Business Profile needs optimization',
      'Vehicle inventory not properly indexed'
    ],
    all_quick_wins: [
      'Add LocalBusiness schema',
      'Optimize Google Business Profile hours',
      'Enable Google Shopping feeds',
      'Add FAQ schema for common questions'
    ],
    confidence: 'high',
    variance: 8.5,
    recommendation: 'Multiple improvement opportunities identified - implement quick wins first'
  };
}

module.exports = {
  executeConsensusAnalysis,
  DEALERSHIP_PROMPTS,
  AI_PROVIDERS
};
EOF

# 15. Install dependencies
echo "📥 Installing dependencies..."
npm install

echo ""
echo "✅ DealershipAI Dashboard Setup Complete!"
echo "========================================="
echo ""
echo "🎯 Your new dashboard is ready with:"
echo "✓ Complete Next.js project structure"
echo "✓ All required dependencies installed"
echo "✓ Your existing dashboard format preserved"
echo "✓ Tailwind CSS with custom theme"
echo "✓ TypeScript configuration"
echo "✓ Component stubs ready for development"
echo "✓ Agent system foundation"
echo ""
echo "📋 Next Steps:"
echo "1. Copy environment variables: cp .env.example .env.local"
echo "2. Add your actual API keys and Supabase config"
echo "3. Replace component stubs with full implementations"
echo "4. Set up your Supabase database"
echo "5. Run: npm run dev"
echo "6. Visit: http://localhost:3000/dashboard/premium-auto"
echo ""
echo "🚀 Ready to revolutionize the automotive industry!"
echo "💡 'Think Different' - Your dashboard awaits customization!"