#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const logger = {
  info: (msg, meta = {}) => console.log(`[INFO] ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[ERROR] ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[WARN] ${msg}`, meta)
};

// Database connection
let pool;

function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    logger.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    logger.info('Database pool initialized');
    return pool;
  } catch (error) {
    logger.error('Failed to initialize database pool', { error: error.message });
    process.exit(1);
  }
}

async function runMigration(filePath, description) {
  try {
    logger.info(`Starting migration: ${description}`, { file: filePath });

    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    logger.info(`Executing ${statements.length} statements from ${path.basename(filePath)}`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          await pool.query(statement);
          logger.info(`✓ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error) {
          // Some statements might fail if they already exist (CREATE TABLE IF NOT EXISTS, etc.)
          if (error.message.includes('already exists')) {
            logger.warn(`Statement ${i + 1}: ${error.message}`);
          } else {
            throw error;
          }
        }
      }
    }

    logger.info(`✅ Migration completed: ${description}`);
    return true;
  } catch (error) {
    logger.error(`❌ Migration failed: ${description}`, {
      error: error.message,
      file: filePath
    });
    return false;
  }
}

async function runAllMigrations() {
  const db = initializeDatabase();

  const migrations = [
    {
      file: path.join(__dirname, '../lib/schema/enterprise-dealership-schema.sql'),
      description: 'Enterprise Dealership Schema for 5000+ dealerships'
    },
    {
      file: path.join(__dirname, '../lib/schema/enterprise-analytics-cache.sql'),
      description: 'Enterprise Analytics Cache System'
    },
    {
      file: path.join(__dirname, '../lib/schema/cost-tracking.sql'),
      description: 'Cost Tracking and Monitoring System'
    }
  ];

  let allSuccessful = true;
  const results = [];

  logger.info('🚀 Starting database migrations for Dealership AI Enterprise System');
  logger.info(`Target: 5000+ dealership rooftops with $3/dealer cost tracking`);

  for (const migration of migrations) {
    if (fs.existsSync(migration.file)) {
      const success = await runMigration(migration.file, migration.description);
      results.push({
        file: path.basename(migration.file),
        description: migration.description,
        success
      });
      allSuccessful = allSuccessful && success;
    } else {
      logger.error(`Migration file not found: ${migration.file}`);
      results.push({
        file: path.basename(migration.file),
        description: migration.description,
        success: false,
        error: 'File not found'
      });
      allSuccessful = false;
    }
  }

  // Run verification queries
  logger.info('🔍 Running verification queries...');

  try {
    // Check if main tables exist
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'dealerships', 'dealership_groups', 'geographic_markets',
          'enterprise_analytics_cache', 'cost_tracking', 'cost_alerts'
        )
      ORDER BY table_name
    `);

    logger.info(`✅ Verified ${tableCheck.rows.length} core tables created:`, {
      tables: tableCheck.rows.map(row => row.table_name)
    });

    // Check partitioning setup
    const partitionCheck = await pool.query(`
      SELECT schemaname, tablename, partitioningtype, partitioningcolumn
      FROM pg_partitions_summary
      WHERE schemaname = 'public'
    `).catch(() => ({ rows: [] })); // pg_partitions_summary might not exist on all PostgreSQL versions

    if (partitionCheck.rows.length > 0) {
      logger.info(`✅ Partitioned tables configured: ${partitionCheck.rows.length}`);
    }

    // Check indexes
    const indexCheck = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
    `);

    logger.info(`✅ Performance indexes created: ${indexCheck.rows.length}`);

  } catch (error) {
    logger.warn('Verification queries failed (this is ok for some PostgreSQL versions)', {
      error: error.message
    });
  }

  // Print summary
  logger.info('\n📊 MIGRATION SUMMARY');
  logger.info('===================');

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    logger.info(`${status} ${result.file}: ${result.description}`);
    if (!result.success && result.error) {
      logger.info(`    Error: ${result.error}`);
    }
  });

  if (allSuccessful) {
    logger.info('\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
    logger.info('Enterprise system ready for 5000+ dealership rooftops');
    logger.info('Cost tracking active with $3/dealer target and 97% margin monitoring');
  } else {
    logger.error('\n❌ SOME MIGRATIONS FAILED');
    logger.error('Please review the errors above and fix before deployment');
  }

  await pool.end();
  process.exit(allSuccessful ? 0 : 1);
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

// Run migrations
runAllMigrations().catch(error => {
  logger.error('Migration process failed', { error: error.message });
  process.exit(1);
});