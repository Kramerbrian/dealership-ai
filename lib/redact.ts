import { createLogger } from './logger'

const logger = createLogger('redact')

export interface RedactionRule {
  name: string
  pattern: RegExp
  replacement: string
  severity: 'low' | 'medium' | 'high'
}

export interface RedactionResult {
  redacted: string
  matches: Array<{
    rule: string
    original: string
    position: number
    severity: 'low' | 'medium' | 'high'
  }>
  score: number
}

export const REDACTION_RULES: RedactionRule[] = [
  // Phone numbers
  {
    name: 'phone',
    pattern: /(\+?1[-.\s]?)?(\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g,
    replacement: '[PHONE-REDACTED]',
    severity: 'medium',
  },

  // Email addresses
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL-REDACTED]',
    severity: 'medium',
  },

  // Social Security Numbers
  {
    name: 'ssn',
    pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    replacement: '[SSN-REDACTED]',
    severity: 'high',
  },

  // Credit Card Numbers (basic pattern)
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CARD-REDACTED]',
    severity: 'high',
  },

  // VIN Numbers
  {
    name: 'vin',
    pattern: /\b[A-HJ-NPR-Z0-9]{17}\b/g,
    replacement: '[VIN-REDACTED]',
    severity: 'medium',
  },

  // Driver's License (basic pattern)
  {
    name: 'drivers_license',
    pattern: /\b[A-Z]{1,2}\d{6,8}\b/g,
    replacement: '[DL-REDACTED]',
    severity: 'high',
  },

  // IP Addresses
  {
    name: 'ip_address',
    pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    replacement: '[IP-REDACTED]',
    severity: 'low',
  },

  // API Keys (generic pattern)
  {
    name: 'api_key',
    pattern: /\b[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[API-KEY-REDACTED]',
    severity: 'high',
  },

  // Bank Account Numbers (basic pattern)
  {
    name: 'bank_account',
    pattern: /\b\d{8,17}\b/g,
    replacement: '[ACCOUNT-REDACTED]',
    severity: 'high',
  },

  // Physical Addresses (basic pattern)
  {
    name: 'address',
    pattern: /\b\d{1,5}\s+([A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Boulevard|Blvd))\b/gi,
    replacement: '[ADDRESS-REDACTED]',
    severity: 'medium',
  },
]

export class PIIRedactor {
  private rules: RedactionRule[]

  constructor(customRules: RedactionRule[] = []) {
    this.rules = [...REDACTION_RULES, ...customRules]
    logger.debug({ totalRules: this.rules.length }, 'PII Redactor initialized')
  }

  redact(text: string, options: {
    skipLowSeverity?: boolean
    onlyRules?: string[]
    skipRules?: string[]
  } = {}): RedactionResult {
    if (!text || typeof text !== 'string') {
      return {
        redacted: text || '',
        matches: [],
        score: 0,
      }
    }

    let redacted = text
    const matches: RedactionResult['matches'] = []

    // Filter rules based on options
    let rulesToApply = this.rules

    if (options.skipLowSeverity) {
      rulesToApply = rulesToApply.filter(rule => rule.severity !== 'low')
    }

    if (options.onlyRules) {
      rulesToApply = rulesToApply.filter(rule => options.onlyRules!.includes(rule.name))
    }

    if (options.skipRules) {
      rulesToApply = rulesToApply.filter(rule => !options.skipRules!.includes(rule.name))
    }

    // Apply each rule
    for (const rule of rulesToApply) {
      const ruleMatches = text.matchAll(rule.pattern)

      for (const match of ruleMatches) {
        if (match[0] && match.index !== undefined) {
          matches.push({
            rule: rule.name,
            original: match[0],
            position: match.index,
            severity: rule.severity,
          })

          // Replace in the redacted text
          redacted = redacted.replace(rule.pattern, rule.replacement)
        }
      }
    }

    // Calculate risk score
    const score = this.calculateRiskScore(matches)

    logger.debug({
      originalLength: text.length,
      redactedLength: redacted.length,
      matchCount: matches.length,
      riskScore: score,
    }, 'PII redaction completed')

    return {
      redacted,
      matches,
      score,
    }
  }

  private calculateRiskScore(matches: RedactionResult['matches']): number {
    const severityWeights = {
      low: 1,
      medium: 3,
      high: 10,
    }

    const totalScore = matches.reduce((sum, match) => {
      return sum + severityWeights[match.severity]
    }, 0)

    // Normalize to 0-100 scale (assuming max 10 high-severity matches)
    return Math.min(100, totalScore)
  }

  scan(text: string): {
    hasPII: boolean
    riskLevel: 'none' | 'low' | 'medium' | 'high'
    matches: RedactionResult['matches']
  } {
    const result = this.redact(text)

    let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none'
    if (result.score === 0) riskLevel = 'none'
    else if (result.score <= 10) riskLevel = 'low'
    else if (result.score <= 30) riskLevel = 'medium'
    else riskLevel = 'high'

    return {
      hasPII: result.matches.length > 0,
      riskLevel,
      matches: result.matches,
    }
  }

  addRule(rule: RedactionRule): void {
    this.rules.push(rule)
    logger.debug({ ruleName: rule.name, severity: rule.severity }, 'Custom redaction rule added')
  }

  removeRule(ruleName: string): boolean {
    const initialLength = this.rules.length
    this.rules = this.rules.filter(rule => rule.name !== ruleName)
    const removed = this.rules.length < initialLength

    if (removed) {
      logger.debug({ ruleName }, 'Redaction rule removed')
    }

    return removed
  }

  getRules(): RedactionRule[] {
    return [...this.rules]
  }
}

// Global instance
export const globalRedactor = new PIIRedactor()

// Convenience functions
export function redactPII(text: string): string {
  return globalRedactor.redact(text).redacted
}

export function scanForPII(text: string) {
  return globalRedactor.scan(text)
}

export function redactAIResponse(response: string): {
  safe: string
  warnings: string[]
} {
  const result = globalRedactor.redact(response)
  const warnings: string[] = []

  if (result.matches.length > 0) {
    const highSeverityCount = result.matches.filter(m => m.severity === 'high').length
    const mediumSeverityCount = result.matches.filter(m => m.severity === 'medium').length

    if (highSeverityCount > 0) {
      warnings.push(`⚠️ ${highSeverityCount} high-risk PII elements redacted`)
    }
    if (mediumSeverityCount > 0) {
      warnings.push(`⚠️ ${mediumSeverityCount} medium-risk PII elements redacted`)
    }

    logger.warn({
      matchCount: result.matches.length,
      riskScore: result.score,
      highSeverity: highSeverityCount,
      mediumSeverity: mediumSeverityCount,
    }, 'PII detected in AI response')
  }

  return {
    safe: result.redacted,
    warnings,
  }
}

export function createDealershipRedactor(): PIIRedactor {
  const redactor = new PIIRedactor()

  // Add dealership-specific rules
  redactor.addRule({
    name: 'loan_number',
    pattern: /\b[A-Z]{2}\d{8,12}\b/g,
    replacement: '[LOAN-REDACTED]',
    severity: 'high',
  })

  redactor.addRule({
    name: 'customer_id',
    pattern: /\bCUST\d{6,10}\b/gi,
    replacement: '[CUSTOMER-ID-REDACTED]',
    severity: 'medium',
  })

  redactor.addRule({
    name: 'dealer_code',
    pattern: /\b[A-Z]{2,4}\d{3,6}\b/g,
    replacement: '[DEALER-CODE-REDACTED]',
    severity: 'low',
  })

  return redactor
}