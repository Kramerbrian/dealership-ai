// Database abstraction layer using Prisma
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Global Prisma client instance (singleton pattern)
declare global {
  var prisma: PrismaClient | undefined;
}

class DatabaseManager {
  private prisma: PrismaClient;

  constructor() {
    // Use singleton pattern to prevent multiple Prisma instances in development
    this.prisma = globalThis.prisma || new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });

    if (process.env.NODE_ENV !== 'production') {
      globalThis.prisma = this.prisma;
    }
  }

  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Database disconnected');
    } catch (error) {
      logger.error('Database disconnection failed', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Raw query execution
  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const result = await this.prisma.$queryRawUnsafe(sql, ...params);
      logger.debug('Query executed successfully', { sql, params });
      return result as any[];
    } catch (error) {
      logger.error('Query execution failed', error instanceof Error ? error : new Error(String(error)), { sql, params });
      throw error;
    }
  }

  // Transaction wrapper
  async transaction<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    try {
      logger.debug('Executing transaction');
      return await this.prisma.$transaction(callback);
    } catch (error) {
      logger.error('Transaction failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  // Expose Prisma client for direct access
  get client(): PrismaClient {
    return this.prisma;
  }

  // Model accessors for convenience
  get dealers() {
    return this.prisma.dealer;
  }

  get users() {
    return this.prisma.user;
  }

  get promptTemplates() {
    return this.prisma.promptTemplate;
  }

  get promptRuns() {
    return this.prisma.promptRun;
  }

  get batchTests() {
    return this.prisma.batchTest;
  }

  get schemaValidations() {
    return this.prisma.schemaValidation;
  }

  get queueJobs() {
    return this.prisma.queueJob;
  }

  get costEntries() {
    return this.prisma.costEntry;
  }
}

export const db = new DatabaseManager();
export default db;