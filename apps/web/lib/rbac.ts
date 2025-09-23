// Role-Based Access Control and session management
import { NextRequest } from 'next/server';
import { logger } from './logger';

export type Role = 'admin' | 'dealer' | 'user' | 'viewer';
export type Permission =
  | 'read:dashboard'
  | 'write:dashboard'
  | 'read:batches'
  | 'write:batches'
  | 'read:queue'
  | 'write:queue'
  | 'read:admin'
  | 'write:admin'
  | 'read:costs'
  | 'write:costs';

export interface User {
  id: string;
  email: string;
  role: Role;
  dealerId?: string;
  permissions: Permission[];
  metadata: {
    name?: string;
    lastLogin?: Date;
    createdAt: Date;
  };
}

export interface Session {
  userId: string;
  user: User;
  expiresAt: Date;
  createdAt: Date;
}

// Role permission mappings
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'read:dashboard', 'write:dashboard',
    'read:batches', 'write:batches',
    'read:queue', 'write:queue',
    'read:admin', 'write:admin',
    'read:costs', 'write:costs',
  ],
  dealer: [
    'read:dashboard', 'write:dashboard',
    'read:batches', 'write:batches',
    'read:queue',
    'read:costs',
  ],
  user: [
    'read:dashboard',
    'read:batches',
    'read:queue',
  ],
  viewer: [
    'read:dashboard',
  ],
};

class SessionManager {
  private sessions = new Map<string, Session>();

  async createSession(user: User): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour sessions

    const session: Session = {
      userId: user.id,
      user,
      expiresAt,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);

    logger.info('Session created', {
      userId: user.id,
      sessionId: sessionId.substring(0, 8) + '...',
      expiresAt,
    });

    return sessionId;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      logger.info('Session expired', { userId: session.userId });
      return null;
    }

    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      logger.info('Session deleted', { userId: session.userId });
    }
  }

  async refreshSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.expiresAt = new Date();
      session.expiresAt.setHours(session.expiresAt.getHours() + 24);
    }
  }

  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    let cleanupCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      logger.info('Cleaned up expired sessions', { count: cleanupCount });
    }
  }
}

class AccessControl {
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();

    // Cleanup expired sessions every hour
    setInterval(() => {
      this.sessionManager.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  hasPermission(user: User, permission: Permission): boolean {
    return user.permissions.includes(permission) ||
           ROLE_PERMISSIONS[user.role]?.includes(permission);
  }

  hasAnyPermission(user: User, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission));
  }

  hasAllPermissions(user: User, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission));
  }

  canAccessDealer(user: User, dealerId: string): boolean {
    // Admins can access any dealer
    if (user.role === 'admin') return true;

    // Users can only access their own dealer
    return user.dealerId === dealerId;
  }

  async authenticateRequest(request: NextRequest): Promise<User | null> {
    try {
      // Try to get session from Authorization header
      const authHeader = request.headers.get('authorization');
      let sessionId: string | null = null;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        sessionId = authHeader.substring(7);
      }

      // Fallback to cookie
      if (!sessionId) {
        sessionId = request.cookies.get('session')?.value || null;
      }

      if (!sessionId) return null;

      const session = await this.sessionManager.getSession(sessionId);
      if (!session) return null;

      // Refresh session on each request
      await this.sessionManager.refreshSession(sessionId);

      return session.user;
    } catch (error) {
      logger.error('Authentication error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  async createUserSession(user: User): Promise<string> {
    return await this.sessionManager.createSession(user);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionManager.deleteSession(sessionId);
  }

  // Middleware helpers
  requireAuth() {
    return async (request: NextRequest) => {
      const user = await this.authenticateRequest(request);
      if (!user) {
        throw new Error('Authentication required');
      }
      return user;
    };
  }

  requirePermission(permission: Permission) {
    return async (request: NextRequest) => {
      const user = await this.authenticateRequest(request);
      if (!user) {
        throw new Error('Authentication required');
      }
      if (!this.hasPermission(user, permission)) {
        throw new Error(`Permission required: ${permission}`);
      }
      return user;
    };
  }

  requireDealer(dealerId: string) {
    return async (request: NextRequest) => {
      const user = await this.authenticateRequest(request);
      if (!user) {
        throw new Error('Authentication required');
      }
      if (!this.canAccessDealer(user, dealerId)) {
        throw new Error('Access to dealer not allowed');
      }
      return user;
    };
  }
}

// Mock user database for development
class MockUserService {
  private users: Map<string, User> = new Map();

  constructor() {
    // Create some default users for development
    this.users.set('admin@dealershipai.com', {
      id: 'admin-1',
      email: 'admin@dealershipai.com',
      role: 'admin',
      permissions: [],
      metadata: {
        name: 'Admin User',
        createdAt: new Date(),
      },
    });

    this.users.set('dealer@toyota-naples.com', {
      id: 'dealer-1',
      email: 'dealer@toyota-naples.com',
      role: 'dealer',
      dealerId: 'toyota-naples',
      permissions: [],
      metadata: {
        name: 'Toyota Naples',
        createdAt: new Date(),
      },
    });

    this.users.set('user@example.com', {
      id: 'user-1',
      email: 'user@example.com',
      role: 'user',
      dealerId: 'toyota-naples',
      permissions: [],
      metadata: {
        name: 'Demo User',
        createdAt: new Date(),
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.get(email) || null;
  }

  async findById(id: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.id === id) return user;
    }
    return null;
  }

  async createUser(userData: Omit<User, 'id' | 'permissions' | 'metadata'>): Promise<User> {
    const user: User = {
      ...userData,
      id: `user-${Date.now()}`,
      permissions: ROLE_PERMISSIONS[userData.role] || [],
      metadata: {
        createdAt: new Date(),
      },
    };

    this.users.set(user.email, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) return null;

    const updatedUser = { ...user, ...updates };
    this.users.set(user.email, updatedUser);
    return updatedUser;
  }
}

// Mock authentication for development
export async function mockLogin(email: string, password: string): Promise<{ user: User; sessionId: string } | null> {
  // In development, accept any password
  if (process.env.NODE_ENV === 'development' || password === 'demo123') {
    const user = await userService.findByEmail(email);
    if (user) {
      const sessionId = await rbac.createUserSession(user);
      logger.info('Mock login successful', { email, userId: user.id });
      return { user, sessionId };
    }
  }

  logger.warn('Mock login failed', { email });
  return null;
}

export const rbac = new AccessControl();
export const userService = new MockUserService();
export default rbac;