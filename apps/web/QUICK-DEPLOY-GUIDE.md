# 🚀 DealershipAI Quick Deploy Guide

**Two simple ways to get DealershipAI live in production**

## 🎯 **Method 1: GitHub → Vercel (Easiest - 5 minutes)**

### Step 1: Push to GitHub
```bash
# If not already pushed
git add .
git commit -m "🚀 Ready for production deployment"
git push origin main
```

### Step 2: Deploy via Vercel Dashboard
1. **Go to** [vercel.com](https://vercel.com) and sign up/login
2. **Click "Add New Project"**
3. **Import your GitHub repository** (`dealership-ai`)
4. **Configure project:**
   - Framework: **Next.js**
   - Root Directory: `apps/web`
   - Build Command: `pnpm run build`
   - Output Directory: `.next`
5. **Click "Deploy"**

### Step 3: Configure Environment Variables
After deployment, go to **Project → Settings → Environment Variables** and add:

```env
# Required for basic functionality
NODE_ENV=production
NEXTAUTH_SECRET=your-generated-secret
NEXTAUTH_URL=https://your-app-name.vercel.app

# Database (use Supabase free tier)
DATABASE_URL=your-supabase-connection-string

# AI API Keys
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Optional Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## 🔧 **Method 2: CLI Deployment (Advanced)**

### Complete the Current CLI Deployment

The CLI is waiting for authentication. Complete these steps:

1. **Visit the authentication URL:**
   ```
   https://vercel.com/oauth/device?user_code=QXBF-XVTW
   ```

2. **Authorize the CLI** with your Vercel account

3. **Press ENTER** in the terminal to continue

4. **The deployment will complete automatically**

---

## 📊 **Database Setup with Supabase (Free Tier)**

### Step 1: Create Supabase Project
1. **Go to** [supabase.com](https://supabase.com)
2. **Create new project**
3. **Note your:**
   - Database URL
   - API URL
   - Public anon key

### Step 2: Set up Database Schema
Run this SQL in Supabase SQL Editor:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    dealership_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create sessions table for NextAuth
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type VARCHAR(255),
    scope VARCHAR(255),
    id_token TEXT,
    session_state VARCHAR(255),
    UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMP NOT NULL
);

-- Insert demo admin user
INSERT INTO users (email, name, role)
VALUES ('admin@dealershipai.com', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;
```

### Step 3: Update Environment Variables
Add to your Vercel environment variables:
```env
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
```

---

## 🔑 **API Keys Setup**

### OpenAI API Key
1. **Go to** [platform.openai.com](https://platform.openai.com)
2. **API Keys** → **Create new secret key**
3. **Copy** and add to environment variables

### Google OAuth (Optional)
1. **Go to** [console.cloud.google.com](https://console.cloud.google.com)
2. **Create project** → **Enable Google+ API**
3. **Credentials** → **Create OAuth 2.0 Client**
4. **Add authorized domains:**
   - `http://localhost:3000` (development)
   - `https://your-app.vercel.app` (production)
5. **Copy Client ID and Secret**

---

## ✅ **Post-Deployment Verification**

### Check Application Health
1. **Visit your deployed URL**
2. **Test key functionality:**
   - [ ] Home page loads
   - [ ] User registration works
   - [ ] Login/logout functions
   - [ ] Dashboard displays
   - [ ] AI chat responds (if API key configured)

### Monitor Performance
- **Vercel Analytics**: Built-in performance monitoring
- **Error Tracking**: Add Sentry for production error monitoring
- **Database Monitoring**: Supabase dashboard shows DB performance

---

## 🚨 **Troubleshooting Common Issues**

### Build Failures
- **Check build logs** in Vercel dashboard
- **Common fixes:**
  - Update Node.js version to 18+
  - Clear build cache and retry
  - Check TypeScript errors

### Authentication Issues
- **Verify NEXTAUTH_URL** matches deployed domain
- **Check NEXTAUTH_SECRET** is set
- **Ensure callback URLs** are configured in Google OAuth

### Database Connection Issues
- **Test connection string** in Supabase
- **Check user permissions** and password
- **Verify SSL settings** (Supabase requires SSL)

---

## 🎉 **Success! Your App is Live**

Once deployed, you'll have:

- ✅ **Full DealershipAI application** running in production
- ✅ **Automatic deployments** from GitHub pushes
- ✅ **SSL certificates** and custom domain support
- ✅ **Global CDN** for fast loading worldwide
- ✅ **Built-in monitoring** and analytics
- ✅ **Scalable infrastructure** that grows with your users

### Next Steps After Going Live

1. **Custom Domain**: Connect your own domain in Vercel settings
2. **Beta Testing**: Invite 3-5 dealerships to test the platform
3. **Analytics Setup**: Configure user behavior tracking
4. **Payment Integration**: Add Stripe for subscription billing
5. **Marketing Launch**: Create landing page and launch campaign

**Time to Market: 15-30 minutes vs 30-60 minutes with AWS!**

---

## 💡 **Cost Comparison**

| Platform | Monthly Cost | Complexity | Time to Deploy |
|----------|-------------|------------|----------------|
| **Vercel + Supabase** | $0-20 | Low | 15-30 min |
| **AWS Full Stack** | $50-200 | High | 30-60 min |
| **Railway/Render** | $20-50 | Medium | 20-40 min |

**Recommended**: Start with Vercel + Supabase, then scale to AWS when needed!