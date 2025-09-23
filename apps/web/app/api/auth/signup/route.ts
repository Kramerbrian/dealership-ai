import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('signup');
const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name.trim(),
        passwordHash,
        role: 'user', // Default role
        isActive: true,
        emailVerified: new Date(), // Auto-verify for now
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      }
    });

    logger.info({
      userId: user.id,
      email: user.email,
      name: user.name
    }, 'New user account created');

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    });

  } catch (error) {
    logger.error({ error }, 'User signup failed');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}