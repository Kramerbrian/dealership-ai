import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { schemaLogger, logRequest } from '@/lib/logger'
import { schemaRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import * as cheerio from 'cheerio'

const SchemaValidateSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10),
  dealer_id: z.string().optional(),
  validation_types: z.array(z.enum(['AutoDealer', 'LocalBusiness', 'Vehicle', 'Product', 'FAQPage', 'Service', 'AutoRepair'])).optional(),
})

interface SchemaValidationResult {
  url: string
  status: 'success' | 'error' | 'no_schema'
  schemas_found: number
  validation_results: SchemaValidation[]
  issues: Issue[]
  score: number
  html_title?: string
  meta_description?: string
  error?: string
}

interface SchemaValidation {
  type: string
  valid: boolean
  required_fields_present: string[]
  missing_required_fields: string[]
  recommended_fields_present: string[]
  missing_recommended_fields: string[]
  errors: string[]
  warnings: string[]
}

interface Issue {
  severity: 'error' | 'warning' | 'info'
  type: string
  field?: string
  message: string
}

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwardedFor?.split(',')[0] || realIp || 'anonymous'
}

async function fetchAndParseHTML(url: string): Promise<{ html: string; title: string; description: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DealershipAI Schema Validator/1.0 (compatible; schema validation bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10000,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const title = $('title').text().trim() || 'No title found'
    const description = $('meta[name="description"]').attr('content')?.trim() || 'No description found'

    return { html, title, description }

  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function extractJSONLD(html: string): any[] {
  const $ = cheerio.load(html)
  const jsonLdScripts = $('script[type="application/ld+json"]')
  const schemas: any[] = []

  jsonLdScripts.each((_, element) => {
    try {
      const content = $(element).html()
      if (content) {
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
          schemas.push(...parsed)
        } else {
          schemas.push(parsed)
        }
      }
    } catch (error) {
      schemaLogger.warn({ error }, 'Failed to parse JSON-LD script')
    }
  })

  return schemas
}

function validateAutoDealer(schema: any): SchemaValidation {
  const requiredFields = ['@type', 'name', 'address', 'telephone']
  const recommendedFields = ['url', 'image', 'priceRange', 'openingHours', 'geo', 'review', 'aggregateRating']

  const validation: SchemaValidation = {
    type: 'AutoDealer',
    valid: false,
    required_fields_present: [],
    missing_required_fields: [],
    recommended_fields_present: [],
    missing_recommended_fields: [],
    errors: [],
    warnings: [],
  }

  // Check required fields
  for (const field of requiredFields) {
    if (schema[field]) {
      validation.required_fields_present.push(field)
    } else {
      validation.missing_required_fields.push(field)
      validation.errors.push(`Missing required field: ${field}`)
    }
  }

  // Check recommended fields
  for (const field of recommendedFields) {
    if (schema[field]) {
      validation.recommended_fields_present.push(field)
    } else {
      validation.missing_recommended_fields.push(field)
      validation.warnings.push(`Missing recommended field: ${field}`)
    }
  }

  // Validate address structure
  if (schema.address && typeof schema.address === 'object') {
    const addressRequired = ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode']
    for (const field of addressRequired) {
      if (!schema.address[field]) {
        validation.errors.push(`Missing address field: ${field}`)
      }
    }
  }

  // Validate telephone format
  if (schema.telephone && typeof schema.telephone === 'string') {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
    if (!phoneRegex.test(schema.telephone.replace(/[\s\-\(\)]/g, ''))) {
      validation.warnings.push('Telephone format may not be optimal for structured data')
    }
  }

  validation.valid = validation.missing_required_fields.length === 0

  return validation
}

function validateVehicle(schema: any): SchemaValidation {
  const requiredFields = ['@type', 'name', 'model', 'brand']
  const recommendedFields = ['image', 'description', 'offers', 'vehicleIdentificationNumber', 'mileageFromOdometer']

  const validation: SchemaValidation = {
    type: 'Vehicle',
    valid: false,
    required_fields_present: [],
    missing_required_fields: [],
    recommended_fields_present: [],
    missing_recommended_fields: [],
    errors: [],
    warnings: [],
  }

  // Check required fields
  for (const field of requiredFields) {
    if (schema[field]) {
      validation.required_fields_present.push(field)
    } else {
      validation.missing_required_fields.push(field)
      validation.errors.push(`Missing required field: ${field}`)
    }
  }

  // Check recommended fields
  for (const field of recommendedFields) {
    if (schema[field]) {
      validation.recommended_fields_present.push(field)
    } else {
      validation.missing_recommended_fields.push(field)
      validation.warnings.push(`Missing recommended field: ${field}`)
    }
  }

  validation.valid = validation.missing_required_fields.length === 0

  return validation
}

function validateSchema(schema: any, validationTypes?: string[]): SchemaValidation[] {
  const results: SchemaValidation[] = []
  const schemaType = schema['@type']

  if (!schemaType) {
    return [{
      type: 'Unknown',
      valid: false,
      required_fields_present: [],
      missing_required_fields: ['@type'],
      recommended_fields_present: [],
      missing_recommended_fields: [],
      errors: ['Missing @type field'],
      warnings: [],
    }]
  }

  const types = Array.isArray(schemaType) ? schemaType : [schemaType]

  for (const type of types) {
    if (validationTypes && !validationTypes.includes(type)) {
      continue
    }

    switch (type) {
      case 'AutoDealer':
      case 'LocalBusiness':
        results.push(validateAutoDealer(schema))
        break
      case 'Vehicle':
      case 'Product':
        results.push(validateVehicle(schema))
        break
      default:
        // Generic validation for unknown types
        results.push({
          type,
          valid: true,
          required_fields_present: Object.keys(schema),
          missing_required_fields: [],
          recommended_fields_present: [],
          missing_recommended_fields: [],
          errors: [],
          warnings: [`Validation not implemented for type: ${type}`],
        })
    }
  }

  return results
}

function calculateSchemaScore(validations: SchemaValidation[]): number {
  if (validations.length === 0) return 0

  let totalScore = 0

  for (const validation of validations) {
    let score = 0

    // Base score for valid schema
    if (validation.valid) {
      score += 50
    }

    // Points for required fields
    score += validation.required_fields_present.length * 10

    // Points for recommended fields
    score += validation.recommended_fields_present.length * 5

    // Penalties for errors and warnings
    score -= validation.errors.length * 15
    score -= validation.warnings.length * 5

    totalScore += Math.max(0, Math.min(100, score))
  }

  return Math.round(totalScore / validations.length)
}

async function validateURL(url: string, validationTypes?: string[]): Promise<SchemaValidationResult> {
  try {
    schemaLogger.info({ url }, 'Starting schema validation')

    const { html, title, description } = await fetchAndParseHTML(url)
    const schemas = extractJSONLD(html)

    if (schemas.length === 0) {
      return {
        url,
        status: 'no_schema',
        schemas_found: 0,
        validation_results: [],
        issues: [{
          severity: 'warning',
          type: 'missing_schema',
          message: 'No JSON-LD structured data found on page',
        }],
        score: 0,
        html_title: title,
        meta_description: description,
      }
    }

    const allValidations: SchemaValidation[] = []
    const allIssues: Issue[] = []

    for (const schema of schemas) {
      const validations = validateSchema(schema, validationTypes)
      allValidations.push(...validations)

      // Convert validation errors and warnings to issues
      for (const validation of validations) {
        for (const error of validation.errors) {
          allIssues.push({
            severity: 'error',
            type: validation.type,
            message: error,
          })
        }
        for (const warning of validation.warnings) {
          allIssues.push({
            severity: 'warning',
            type: validation.type,
            message: warning,
          })
        }
      }
    }

    const score = calculateSchemaScore(allValidations)

    const result: SchemaValidationResult = {
      url,
      status: 'success',
      schemas_found: schemas.length,
      validation_results: allValidations,
      issues: allIssues,
      score,
      html_title: title,
      meta_description: description,
    }

    schemaLogger.info({
      url,
      schemasFound: schemas.length,
      validations: allValidations.length,
      score,
    }, 'Schema validation completed')

    return result

  } catch (error) {
    schemaLogger.error({ error, url }, 'Schema validation failed')

    return {
      url,
      status: 'error',
      schemas_found: 0,
      validation_results: [],
      issues: [{
        severity: 'error',
        type: 'fetch_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }],
      score: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await schemaRateLimit.checkLimit(clientId)

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...createRateLimitHeaders(rateLimitResult, 20),
          },
        }
      )
    }

    // Parse request body
    const body = await request.json()
    const parseResult = SchemaValidateSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.errors },
        { status: 400 }
      )
    }

    const { urls, dealer_id, validation_types } = parseResult.data

    // Validate all URLs
    const results = await Promise.all(
      urls.map(url => validateURL(url, validation_types))
    )

    // Calculate summary statistics
    const summary = {
      total_urls: urls.length,
      successful_validations: results.filter(r => r.status === 'success').length,
      failed_validations: results.filter(r => r.status === 'error').length,
      no_schema_found: results.filter(r => r.status === 'no_schema').length,
      total_schemas: results.reduce((sum, r) => sum + r.schemas_found, 0),
      average_score: Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length),
      total_errors: results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'error').length, 0),
      total_warnings: results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'warning').length, 0),
    }

    const responseData = {
      validation_results: results,
      summary,
      dealer_id,
      validation_types: validation_types || ['all'],
      timestamp: new Date().toISOString(),
    }

    const response = NextResponse.json(responseData)

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '20')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())

    schemaLogger.info({
      urlCount: urls.length,
      successful: summary.successful_validations,
      averageScore: summary.average_score,
      totalErrors: summary.total_errors,
    }, 'Bulk schema validation completed')

    logRequest(request, startTime)
    return response

  } catch (error) {
    schemaLogger.error({ error }, 'Error in /api/schema/validate POST')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}