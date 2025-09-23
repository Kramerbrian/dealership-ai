// Simple console logger fallback to avoid pino worker thread issues in development
const isDev = process.env.NODE_ENV === 'development'
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info')

const logLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLogLevel = logLevels[logLevel as keyof typeof logLevels] || 1

const createLogFunction = (level: string, priority: number) =>
  (obj: any, msg?: string) => {
    if (priority < currentLogLevel) return

    const timestamp = new Date().toISOString()
    const logObj = typeof obj === 'string' ? { msg: obj } : obj
    const message = msg || logObj.msg || ''

    if (isDev) {
      console[level as keyof Console](`[${timestamp}] ${level.toUpperCase()}: ${message}`, logObj !== obj ? logObj : '')
    } else {
      console.log(JSON.stringify({
        timestamp,
        level,
        message,
        ...logObj,
      }))
    }
  }

const logger = {
  debug: createLogFunction('debug', 0),
  info: createLogFunction('info', 1),
  warn: createLogFunction('warn', 2),
  error: createLogFunction('error', 3),
  child: (meta: Record<string, any>) => ({
    debug: (obj: any, msg?: string) => logger.debug({ ...meta, ...obj }, msg),
    info: (obj: any, msg?: string) => logger.info({ ...meta, ...obj }, msg),
    warn: (obj: any, msg?: string) => logger.warn({ ...meta, ...obj }, msg),
    error: (obj: any, msg?: string) => logger.error({ ...meta, ...obj }, msg),
  }),
}

export default logger

export const createLogger = (service: string) => {
  return logger.child({ service })
}

export const apiLogger = createLogger('api')
export const queueLogger = createLogger('queue')
export const dbLogger = createLogger('database')
export const aiLogger = createLogger('ai')
export const schemaLogger = createLogger('schema')

export const logRequest = (req: Request, startTime: number) => {
  const duration = Date.now() - startTime
  const method = req.method
  const url = req.url

  apiLogger.info({
    method,
    url,
    duration: `${duration}ms`,
    userAgent: req.headers.get('user-agent'),
  }, 'API Request completed')
}

export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    context,
  }, 'Error occurred')
}

export const logAIRequest = (
  provider: string,
  model: string,
  tokens: { prompt: number; completion: number },
  cost: number,
  duration: number
) => {
  aiLogger.info({
    provider,
    model,
    tokens,
    cost,
    duration,
  }, 'AI API request completed')
}