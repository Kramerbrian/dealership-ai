import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Check environment variables
    const requiredEnvVars = [
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
      'DATABASE_URL'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Missing required environment variables',
          details: { missingEnvVars }
        },
        { status: 500 }
      );
    }

    // System health metrics
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      checks: {
        database: true,
        environment: true,
        auth: !!process.env.NEXTAUTH_SECRET
      }
    };

    return NextResponse.json(health);

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        checks: {
          database: false,
          environment: true,
          auth: !!process.env.NEXTAUTH_SECRET
        }
      },
      { status: 503 }
    );
  } finally {
    await prisma.$disconnect();
  }
}