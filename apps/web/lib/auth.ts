// NextAuth.js configuration for DealershipAI
import { NextAuthOptions, User } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { createLogger } from '@/lib/logger'

const logger = createLogger('auth')
const prisma = new PrismaClient()

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
      dealerId?: string | null
      isActive: boolean
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    role: string
    dealerId?: string | null
    isActive: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    dealerId?: string | null
    isActive: boolean
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          logger.warn('Missing credentials in auth attempt')
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { dealer: true }
          })

          if (!user) {
            logger.warn({ email: credentials.email }, 'User not found')
            return null
          }

          if (!user.isActive) {
            logger.warn({ email: credentials.email }, 'Inactive user attempted login')
            return null
          }

          // Check password if it exists (OAuth users might not have passwords)
          if (user.passwordHash) {
            const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash)
            if (!isValidPassword) {
              logger.warn({ email: credentials.email }, 'Invalid password')
              return null
            }
          }

          logger.info({
            userId: user.id,
            email: user.email,
            role: user.role,
            dealerId: user.dealerId
          }, 'User authenticated successfully')

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            dealerId: user.dealerId,
            isActive: user.isActive,
          }
        } catch (error) {
          logger.error({ error, email: credentials.email }, 'Authentication error')
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          // Check if user exists, create if not
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! }
          })

          if (!existingUser) {
            // Create new user with Google account
            const newUser = await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || profile?.name || null,
                image: user.image || profile?.picture || null,
                role: 'user', // Default role
                emailVerified: new Date(),
                isActive: true,
              }
            })

            logger.info({
              userId: newUser.id,
              email: newUser.email,
              provider: 'google'
            }, 'New Google user created')
          } else if (!existingUser.isActive) {
            logger.warn({ email: user.email }, 'Inactive user attempted Google login')
            return false
          }

          return true
        } catch (error) {
          logger.error({ error, email: user.email }, 'Google sign-in error')
          return false
        }
      }

      return true
    },
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.role = user.role
        token.dealerId = user.dealerId
        token.isActive = user.isActive
      }

      // Update session trigger
      if (trigger === 'update' && session) {
        token.role = session.role || token.role
        token.dealerId = session.dealerId || token.dealerId
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.dealerId = token.dealerId
        session.user.isActive = token.isActive
      }

      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  },
  events: {
    signIn: async ({ user, account, isNewUser }) => {
      logger.info({
        userId: user.id,
        email: user.email,
        provider: account?.provider,
        isNewUser
      }, 'User signed in')
    },
    signOut: async ({ token }) => {
      logger.info({
        userId: token?.id,
        email: token?.email
      }, 'User signed out')
    },
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
}

// Helper functions for server-side auth checks
export async function getServerSession(req: any, res: any) {
  const { getServerSession } = await import('next-auth')
  return getServerSession(req, res, authOptions)
}

// Role-based authorization helpers
export function hasRole(session: any, role: string): boolean {
  return session?.user?.role === role
}

export function isAdmin(session: any): boolean {
  return hasRole(session, 'admin')
}

export function isDealer(session: any): boolean {
  return hasRole(session, 'dealer')
}

export function canAccessDealer(session: any, dealerId: string): boolean {
  if (isAdmin(session)) return true
  return session?.user?.dealerId === dealerId
}

// Next.js 14 App Router middleware for API route protection
export function withAuth(
  handler: (request: NextRequest, session: any) => Promise<NextResponse>,
  options: {
    requireRole?: string
    requireDealer?: boolean
  } = {}
) {
  return async (request: NextRequest) => {
    try {
      // Get session from NextAuth
      const { getServerSession } = await import('next-auth')
      const session = await getServerSession(authOptions)

      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized - Please sign in' },
          { status: 401 }
        )
      }

      if (!session.user.isActive) {
        return NextResponse.json(
          { error: 'Account inactive - Please contact support' },
          { status: 403 }
        )
      }

      if (options.requireRole && !hasRole(session, options.requireRole)) {
        return NextResponse.json(
          { error: `Insufficient permissions - ${options.requireRole} role required` },
          { status: 403 }
        )
      }

      if (options.requireDealer && !session.user.dealerId) {
        return NextResponse.json(
          { error: 'Dealer access required - Please associate with a dealership' },
          { status: 403 }
        )
      }

      // Pass session to handler
      return handler(request, session)
    } catch (error) {
      logger.error({
        error,
        url: request.url,
        method: request.method
      }, 'Authentication middleware error')

      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      )
    }
  }
}

// Legacy middleware for Pages API (if needed)
export function withAuthPages(
  handler: (req: any, res: any, session: any) => Promise<any>,
  options: {
    requireRole?: string
    requireDealer?: boolean
  } = {}
) {
  return async (req: any, res: any) => {
    const session = await getServerSession(req, res)

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!session.user.isActive) {
      return res.status(403).json({ error: 'Account inactive' })
    }

    if (options.requireRole && !hasRole(session, options.requireRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    if (options.requireDealer && !session.user.dealerId) {
      return res.status(403).json({ error: 'Dealer access required' })
    }

    return handler(req, res, session)
  }
}