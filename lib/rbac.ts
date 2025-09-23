import { createLogger } from './logger'

const logger = createLogger('rbac')

export type Role = 'admin' | 'dealer' | 'viewer'
export type Permission =
  | 'batch:run'
  | 'batch:view'
  | 'queue:control'
  | 'queue:view'
  | 'schema:validate'
  | 'admin:access'
  | 'prompt:expand'
  | 'dealer:manage'

export interface User {
  id: string
  email?: string
  role: Role
  dealerId?: string
  permissions?: Permission[]
}

export interface SessionData {
  user: User
  expires: number
  created: number
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'batch:run',
    'batch:view',
    'queue:control',
    'queue:view',
    'schema:validate',
    'admin:access',
    'prompt:expand',
    'dealer:manage',
  ],
  dealer: [
    'batch:run',
    'batch:view',
    'queue:view',
    'schema:validate',
    'prompt:expand',
  ],
  viewer: [
    'batch:view',
    'queue:view',
  ],
}

export class RBAC {
  static hasPermission(user: User, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[user.role] || []
    const userPermissions = user.permissions || []

    const hasRolePermission = rolePermissions.includes(permission)
    const hasUserPermission = userPermissions.includes(permission)

    const result = hasRolePermission || hasUserPermission

    logger.debug({
      userId: user.id,
      role: user.role,
      permission,
      granted: result,
    }, 'Permission check')

    return result
  }

  static canAccessDealer(user: User, dealerId: string): boolean {
    // Admins can access any dealer
    if (user.role === 'admin') {
      return true
    }

    // Users can only access their own dealer
    const canAccess = user.dealerId === dealerId

    logger.debug({
      userId: user.id,
      userDealerId: user.dealerId,
      requestedDealerId: dealerId,
      granted: canAccess,
    }, 'Dealer access check')

    return canAccess
  }

  static requireRole(user: User, requiredRole: Role): boolean {
    const roleHierarchy: Record<Role, number> = {
      viewer: 1,
      dealer: 2,
      admin: 3,
    }

    const userLevel = roleHierarchy[user.role] || 0
    const requiredLevel = roleHierarchy[requiredRole] || 0

    const hasRole = userLevel >= requiredLevel

    logger.debug({
      userId: user.id,
      userRole: user.role,
      requiredRole,
      granted: hasRole,
    }, 'Role requirement check')

    return hasRole
  }

  static filterDealerData<T extends { dealerId?: string }>(
    user: User,
    data: T[]
  ): T[] {
    if (user.role === 'admin') {
      return data
    }

    return data.filter(item =>
      item.dealerId === user.dealerId || !item.dealerId
    )
  }
}

export class SessionManager {
  private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

  static createSession(user: User): SessionData {
    const now = Date.now()
    const session: SessionData = {
      user,
      expires: now + this.SESSION_DURATION,
      created: now,
    }

    logger.info({
      userId: user.id,
      role: user.role,
      expires: new Date(session.expires).toISOString(),
    }, 'Session created')

    return session
  }

  static isValidSession(session: SessionData): boolean {
    const now = Date.now()
    const isValid = session.expires > now

    if (!isValid) {
      logger.info({
        userId: session.user.id,
        expired: new Date(session.expires).toISOString(),
      }, 'Session expired')
    }

    return isValid
  }

  static refreshSession(session: SessionData): SessionData {
    if (!this.isValidSession(session)) {
      throw new Error('Cannot refresh expired session')
    }

    const refreshed: SessionData = {
      ...session,
      expires: Date.now() + this.SESSION_DURATION,
    }

    logger.debug({
      userId: session.user.id,
      newExpires: new Date(refreshed.expires).toISOString(),
    }, 'Session refreshed')

    return refreshed
  }
}

export function createMockUser(
  role: Role = 'dealer',
  dealerId: string = 'toyota-naples'
): User {
  return {
    id: `mock-user-${Date.now()}`,
    email: `user@${dealerId}.com`,
    role,
    dealerId,
  }
}

export function requireAuth(
  handler: (user: User, ...args: any[]) => any
) {
  return (...args: any[]) => {
    const mockUser = createMockUser()
    return handler(mockUser, ...args)
  }
}

export function requirePermission(permission: Permission) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<Function>
  ) {
    const method = descriptor.value!
    descriptor.value = function (...args: any[]) {
      const user = args[0] as User
      if (!RBAC.hasPermission(user, permission)) {
        const error = new Error(`Insufficient permissions: ${permission} required`)
        logger.warn({
          userId: user.id,
          role: user.role,
          permission,
          method: propertyName,
        }, 'Permission denied')
        throw error
      }
      return method.apply(this, args)
    }
  }
}

export function requireDealer(dealerIdParam: number = 1) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<Function>
  ) {
    const method = descriptor.value!
    descriptor.value = function (...args: any[]) {
      const user = args[0] as User
      const dealerId = args[dealerIdParam] as string

      if (!RBAC.canAccessDealer(user, dealerId)) {
        const error = new Error(`Access denied: cannot access dealer ${dealerId}`)
        logger.warn({
          userId: user.id,
          userDealerId: user.dealerId,
          requestedDealerId: dealerId,
          method: propertyName,
        }, 'Dealer access denied')
        throw error
      }

      return method.apply(this, args)
    }
  }
}

export const AuthGuard = {
  requireAuth,
  requirePermission,
  requireDealer,
  RBAC,
  SessionManager,
}