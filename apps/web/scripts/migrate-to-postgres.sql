-- PostgreSQL Migration Script
-- Run this to migrate from SQLite to PostgreSQL

BEGIN;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS "User" (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    email TEXT UNIQUE NOT NULL,
    "emailVerified" TIMESTAMPTZ,
    name TEXT,
    image TEXT,
    "passwordHash" TEXT,
    role TEXT DEFAULT 'user',
    "isActive" BOOLEAN DEFAULT true,
    "dealerId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Dealers table
CREATE TABLE IF NOT EXISTS "Dealer" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    website TEXT,
    location TEXT,
    tier INTEGER DEFAULT 3,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- NextAuth tables
CREATE TABLE IF NOT EXISTS "Account" (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "userId" TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Session" (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "sessionToken" TEXT UNIQUE NOT NULL,
    "userId" TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    identifier TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- Additional application tables
CREATE TABLE IF NOT EXISTS "PromptTemplate" (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    "dealerId" TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptTemplate_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "QueueJob" (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    type TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    "maxAttempts" INTEGER DEFAULT 3,
    "runAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    error TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Session_sessionToken_idx" ON "Session"("sessionToken");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"(email);
CREATE INDEX IF NOT EXISTS "User_dealerId_idx" ON "User"("dealerId");
CREATE INDEX IF NOT EXISTS "PromptTemplate_dealerId_idx" ON "PromptTemplate"("dealerId");
CREATE INDEX IF NOT EXISTS "QueueJob_status_idx" ON "QueueJob"(status);
CREATE INDEX IF NOT EXISTS "QueueJob_runAt_idx" ON "QueueJob"("runAt");

-- Add foreign key constraints
ALTER TABLE "User"
ADD CONSTRAINT "User_dealerId_fkey"
FOREIGN KEY ("dealerId") REFERENCES "Dealer"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key"
ON "Account"(provider, "providerAccountId");

-- Insert default data
INSERT INTO "Dealer" (id, name, email, website, location, tier) VALUES
('toyota-naples', 'Toyota of Naples', 'contact@toyotaofnaples.com', 'https://toyotaofnaples.com', 'Naples, FL', 2),
('honda-miami', 'Honda of Miami', 'info@hondamiami.com', 'https://hondamiami.com', 'Miami, FL', 1),
('ford-tampa', 'Ford Tampa Bay', 'sales@fordtampabay.com', 'https://fordtampabay.com', 'Tampa, FL', 3),
('chevrolet-orlando', 'Chevrolet of Orlando', 'service@chevrolet-orlando.com', 'https://chevrolet-orlando.com', 'Orlando, FL', 2),
('bmw-jacksonville', 'BMW of Jacksonville', 'contact@bmwjacksonville.com', 'https://bmwjacksonville.com', 'Jacksonville, FL', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "PromptTemplate" (name, template, category, "dealerId") VALUES
('Vehicle Description', 'Create a compelling description for: {vehicle_year} {vehicle_make} {vehicle_model}. Highlight key features: {features}. Target audience: {target_demographic}.', 'inventory', 'toyota-naples'),
('Service Appointment', 'Generate a friendly reminder for service appointment: Customer {customer_name}, Vehicle {vehicle}, Service {service_type}, Date {appointment_date}.', 'service', 'honda-miami'),
('Follow-up Email', 'Write a follow-up email for customer {customer_name} who {interaction_type} for {vehicle}. Include {key_points} and next steps.', 'sales', 'ford-tampa')
ON CONFLICT DO NOTHING;

COMMIT;

-- Performance optimization
VACUUM ANALYZE;