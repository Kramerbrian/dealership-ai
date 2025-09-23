// User registration API endpoint
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const logger = createLogger('auth-register')
const prisma = new PrismaClient()

const registrationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  userType: z.enum(['dealer', 'user']),
  dealershipName: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url().optional().or(z.literal(''))
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
}).refine((data) => {
  if (data.userType === 'dealer') {
    return data.dealershipName && data.location
  }
  return true
}, {
  message: "Dealership information is required for dealer accounts",
  path: ["dealershipName"]
})

function generateDealerId(name: string, location: string): string {
  // Create a URL-friendly dealer ID
  const cleanName = name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 30)

  const cleanLocation = location.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 15)

  return `${cleanName}-${cleanLocation}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedData = registrationSchema.parse(body)
    const { name, email, password, userType, dealershipName, location, website } = validatedData

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    let dealerId: string | null = null
    let dealer = null

    // Create dealer if this is a dealer registration
    if (userType === 'dealer' && dealershipName && location) {
      dealerId = generateDealerId(dealershipName, location)

      // Check if dealer already exists
      const existingDealer = await prisma.dealer.findUnique({
        where: { id: dealerId }
      })

      if (existingDealer) {
        // Add a random suffix if dealer ID already exists
        dealerId = `${dealerId}-${Math.random().toString(36).substring(2, 8)}`
      }

      dealer = await prisma.dealer.create({
        data: {
          id: dealerId,
          name: dealershipName,
          email: email,
          location: location,
          website: website || null,
          tier: 1,
          status: 'active'
        }
      })

      logger.info({
        dealerId: dealer.id,
        dealerName: dealer.name,
        location: dealer.location
      }, 'New dealer created')
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: userType === 'dealer' ? 'dealer' : 'user',
        dealerId: dealerId,
        isActive: true,
        emailVerified: new Date(), // Auto-verify for now, could add email verification later
      }
    })

    logger.info({
      userId: user.id,
      email: user.email,
      role: user.role,
      dealerId: user.dealerId,
      isNewDealer: !!dealer
    }, 'New user registered')

    // Don't return sensitive data
    const { passwordHash: _, ...userResponse } = user

    return NextResponse.json({
      message: 'User registered successfully',
      user: userResponse,
      dealer: dealer ? {
        id: dealer.id,
        name: dealer.name,
        location: dealer.location
      } : null
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    logger.error({ error }, 'Registration error')

    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}