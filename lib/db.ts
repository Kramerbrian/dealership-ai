import { Pool, PoolClient, QueryResult } from 'pg'
import { createLogger } from './logger'

const logger = createLogger('database')

let pool: Pool | null = null

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })

    pool.on('connect', () => {
      logger.debug('New database connection established')
    })

    pool.on('error', (err) => {
      logger.error({ error: err }, 'Database pool error')
    })

    logger.info('Database pool initialized')
  } catch (error) {
    logger.error({ error }, 'Failed to initialize database pool')
  }
} else {
  logger.warn('DATABASE_URL not provided, database operations will be simulated')
}

export interface DatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>
  release?: () => void
}

class MockDatabaseClient implements DatabaseClient {
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    logger.debug({ query: text, params }, 'Mock database query (no DATABASE_URL)')

    // Return mock data based on query patterns
    if (text.includes('dealers') || text.includes('dealership')) {
      return {
        rows: [{
          id: 'mock-dealer-1',
          name: 'Mock Toyota Dealership',
          city: 'Naples',
          state: 'FL',
          created_at: new Date(),
        }] as T[],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      }
    }

    if (text.includes('prompts') || text.includes('prompt_pack')) {
      return {
        rows: [] as T[],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      }
    }

    return {
      rows: [] as T[],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    }
  }
}

export class DB {
  static async getClient(): Promise<DatabaseClient> {
    if (!pool) {
      return new MockDatabaseClient()
    }

    try {
      const client = await pool.connect()
      return {
        query: client.query.bind(client),
        release: () => client.release(),
      }
    } catch (error) {
      logger.error({ error }, 'Failed to get database client')
      return new MockDatabaseClient()
    }
  }

  static async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const client = await this.getClient()
    try {
      const start = Date.now()
      const result = await client.query<T>(text, params)
      const duration = Date.now() - start

      logger.debug({
        query: text,
        params,
        duration: `${duration}ms`,
        rowCount: result.rowCount,
      }, 'Database query completed')

      return result
    } catch (error) {
      logger.error({ error, query: text, params }, 'Database query error')
      throw error
    } finally {
      if (client.release) {
        client.release()
      }
    }
  }

  static async transaction<T>(
    callback: (client: DatabaseClient) => Promise<T>
  ): Promise<T> {
    if (!pool) {
      const mockClient = new MockDatabaseClient()
      return callback(mockClient)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await callback({
        query: client.query.bind(client),
      })
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error({ error }, 'Transaction error, rolled back')
      throw error
    } finally {
      client.release()
    }
  }

  static async healthCheck(): Promise<boolean> {
    if (!pool) {
      logger.warn('No database pool, health check skipped')
      return true
    }

    try {
      const result = await this.query('SELECT NOW() as now')
      return result.rowCount === 1
    } catch (error) {
      logger.error({ error }, 'Database health check failed')
      return false
    }
  }

  static async end(): Promise<void> {
    if (pool) {
      await pool.end()
      logger.info('Database pool closed')
    }
  }

  static isConnected(): boolean {
    return !!pool || !process.env.DATABASE_URL
  }
}

// Schema creation helpers for development
export const createTablesSQL = `
  -- Dealers table
  CREATE TABLE IF NOT EXISTS dealers (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    brand VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(10),
    zip VARCHAR(20),
    phone VARCHAR(50),
    website VARCHAR(500),
    google_place_id VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Prompt executions table
  CREATE TABLE IF NOT EXISTS prompt_executions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id VARCHAR(255) REFERENCES dealers(id),
    prompt_id VARCHAR(100) NOT NULL,
    batch_id VARCHAR(100),
    engine VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    input_data JSONB NOT NULL,
    output_data JSONB,
    tokens_used JSONB,
    cost_cents INTEGER DEFAULT 0,
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
  );

  -- Schema validations table
  CREATE TABLE IF NOT EXISTS schema_validations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id VARCHAR(255) REFERENCES dealers(id),
    url VARCHAR(1000) NOT NULL,
    schema_type VARCHAR(100),
    validation_result JSONB NOT NULL,
    issues_found JSONB,
    score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_prompt_executions_dealer_id ON prompt_executions(dealer_id);
  CREATE INDEX IF NOT EXISTS idx_prompt_executions_batch_id ON prompt_executions(batch_id);
  CREATE INDEX IF NOT EXISTS idx_prompt_executions_status ON prompt_executions(status);
  CREATE INDEX IF NOT EXISTS idx_prompt_executions_created_at ON prompt_executions(created_at);
  CREATE INDEX IF NOT EXISTS idx_schema_validations_dealer_id ON schema_validations(dealer_id);
  CREATE INDEX IF NOT EXISTS idx_schema_validations_created_at ON schema_validations(created_at);
`

export default DB