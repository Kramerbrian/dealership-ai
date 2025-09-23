// PII redaction and data sanitization utilities
import { logger } from './logger';

export interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
  severity: 'low' | 'medium' | 'high';
  category: 'pii' | 'financial' | 'credential' | 'internal';
}

export interface RedactionResult {
  text: string;
  redactions: Array<{
    rule: string;
    count: number;
    severity: RedactionRule['severity'];
    category: RedactionRule['category'];
  }>;
  riskScore: number;
}

// Common PII and sensitive data patterns
const REDACTION_RULES: RedactionRule[] = [
  // Email addresses
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL]',
    severity: 'medium',
    category: 'pii',
  },

  // Phone numbers (US format)
  {
    name: 'phone',
    pattern: /(\+?1[-.\s]?)?(\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g,
    replacement: '[PHONE]',
    severity: 'medium',
    category: 'pii',
  },

  // Social Security Numbers
  {
    name: 'ssn',
    pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    replacement: '[SSN]',
    severity: 'high',
    category: 'pii',
  },

  // Credit card numbers (basic pattern)
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[-\s]?){3,4}\d{4}\b/g,
    replacement: '[CARD]',
    severity: 'high',
    category: 'financial',
  },

  // IP addresses
  {
    name: 'ip_address',
    pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    replacement: '[IP]',
    severity: 'low',
    category: 'internal',
  },

  // API keys (generic pattern)
  {
    name: 'api_key',
    pattern: /\b[A-Za-z0-9]{32,}\b/g,
    replacement: '[API_KEY]',
    severity: 'high',
    category: 'credential',
  },

  // JWT tokens
  {
    name: 'jwt_token',
    pattern: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*/g,
    replacement: '[JWT]',
    severity: 'high',
    category: 'credential',
  },

  // URLs with potential credentials
  {
    name: 'credential_url',
    pattern: /https?:\/\/[^\/\s:@]+:[^\/\s@]+@[^\s]+/g,
    replacement: '[URL_WITH_CREDS]',
    severity: 'high',
    category: 'credential',
  },

  // Database connection strings
  {
    name: 'db_connection',
    pattern: /(postgresql|mysql|mongodb):\/\/[^\s]+/gi,
    replacement: '[DB_CONNECTION]',
    severity: 'high',
    category: 'credential',
  },

  // AWS access keys
  {
    name: 'aws_access_key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: '[AWS_KEY]',
    severity: 'high',
    category: 'credential',
  },

  // Private keys
  {
    name: 'private_key',
    pattern: /-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/g,
    replacement: '[PRIVATE_KEY]',
    severity: 'high',
    category: 'credential',
  },

  // Vehicle identification numbers (VIN)
  {
    name: 'vin',
    pattern: /\b[A-HJ-NPR-Z0-9]{17}\b/g,
    replacement: '[VIN]',
    severity: 'medium',
    category: 'pii',
  },

  // License plate numbers (basic US pattern)
  {
    name: 'license_plate',
    pattern: /\b[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{3,4}\b/g,
    replacement: '[PLATE]',
    severity: 'low',
    category: 'pii',
  },
];

class DataRedactor {
  private rules: Map<string, RedactionRule>;

  constructor(customRules: RedactionRule[] = []) {
    this.rules = new Map();

    // Load default rules
    REDACTION_RULES.forEach(rule => {
      this.rules.set(rule.name, rule);
    });

    // Add custom rules
    customRules.forEach(rule => {
      this.rules.set(rule.name, rule);
    });
  }

  redactText(text: string, enabledRules?: string[]): RedactionResult {
    if (!text) {
      return {
        text: '',
        redactions: [],
        riskScore: 0,
      };
    }

    let redactedText = text;
    const redactions: RedactionResult['redactions'] = [];
    const rulesToApply = enabledRules
      ? Array.from(this.rules.values()).filter(rule => enabledRules.includes(rule.name))
      : Array.from(this.rules.values());

    for (const rule of rulesToApply) {
      const matches = text.match(rule.pattern);
      if (matches && matches.length > 0) {
        redactedText = redactedText.replace(rule.pattern, rule.replacement);
        redactions.push({
          rule: rule.name,
          count: matches.length,
          severity: rule.severity,
          category: rule.category,
        });

        logger.debug('Applied redaction rule', {
          rule: rule.name,
          matches: matches.length,
          severity: rule.severity,
        });
      }
    }

    const riskScore = this.calculateRiskScore(redactions);

    if (redactions.length > 0) {
      logger.info('Text redacted', {
        redactionCount: redactions.length,
        riskScore,
        categories: [...new Set(redactions.map(r => r.category))],
      });
    }

    return {
      text: redactedText,
      redactions,
      riskScore,
    };
  }

  private calculateRiskScore(redactions: RedactionResult['redactions']): number {
    if (redactions.length === 0) return 0;

    const severityWeights = {
      low: 1,
      medium: 3,
      high: 5,
    };

    const totalWeight = redactions.reduce((sum, redaction) => {
      return sum + (severityWeights[redaction.severity] * redaction.count);
    }, 0);

    // Normalize to 0-100 scale
    return Math.min(100, Math.round(totalWeight * 5));
  }

  // Redact structured data (objects)
  redactObject(obj: any, enabledRules?: string[]): { data: any; redactions: RedactionResult['redactions']; riskScore: number } {
    const redactedData = JSON.parse(JSON.stringify(obj)); // Deep clone
    const allRedactions: RedactionResult['redactions'] = [];

    const processValue = (value: any, path: string): any => {
      if (typeof value === 'string') {
        const result = this.redactText(value, enabledRules);
        allRedactions.push(...result.redactions.map(r => ({
          ...r,
          rule: `${path}.${r.rule}`,
        })));
        return result.text;
      } else if (Array.isArray(value)) {
        return value.map((item, index) => processValue(item, `${path}[${index}]`));
      } else if (typeof value === 'object' && value !== null) {
        const result: any = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = processValue(val, `${path}.${key}`);
        }
        return result;
      }
      return value;
    };

    const processedData = processValue(redactedData, 'root');
    const riskScore = this.calculateRiskScore(allRedactions);

    return {
      data: processedData,
      redactions: allRedactions,
      riskScore,
    };
  }

  // Check if text contains sensitive data without redacting
  scanText(text: string, enabledRules?: string[]): {
    hasSensitiveData: boolean;
    detectedTypes: string[];
    riskScore: number;
  } {
    const result = this.redactText(text, enabledRules);
    return {
      hasSensitiveData: result.redactions.length > 0,
      detectedTypes: result.redactions.map(r => r.rule),
      riskScore: result.riskScore,
    };
  }

  // Validate that text is safe for logging/storage
  isSafeForLogging(text: string): boolean {
    const scan = this.scanText(text, ['email', 'phone', 'ssn', 'credit_card', 'api_key', 'jwt_token', 'private_key']);
    return scan.riskScore < 20; // Allow low-risk content
  }

  // Add custom redaction rule
  addRule(rule: RedactionRule): void {
    this.rules.set(rule.name, rule);
    logger.info('Custom redaction rule added', { name: rule.name, category: rule.category });
  }

  // Remove redaction rule
  removeRule(ruleName: string): void {
    if (this.rules.delete(ruleName)) {
      logger.info('Redaction rule removed', { name: ruleName });
    }
  }

  // Get available rules
  getRules(): RedactionRule[] {
    return Array.from(this.rules.values());
  }

  // Redact for specific context (logging, storage, etc.)
  redactForContext(text: string, context: 'logging' | 'storage' | 'display'): string {
    const contextRules = {
      logging: ['email', 'phone', 'ssn', 'credit_card', 'api_key', 'jwt_token', 'private_key', 'aws_access_key'],
      storage: ['ssn', 'credit_card', 'api_key', 'jwt_token', 'private_key', 'aws_access_key', 'credential_url'],
      display: ['ssn', 'credit_card', 'api_key', 'jwt_token', 'private_key'],
    };

    const result = this.redactText(text, contextRules[context]);
    return result.text;
  }
}

// Middleware for automatic request/response redaction
export function createRedactionMiddleware(options: {
  redactRequests?: boolean;
  redactResponses?: boolean;
  enabledRules?: string[];
  logRedactions?: boolean;
} = {}) {
  const redactor = new DataRedactor();

  return {
    redactRequest: (data: any) => {
      if (!options.redactRequests) return data;

      const result = redactor.redactObject(data, options.enabledRules);

      if (options.logRedactions && result.redactions.length > 0) {
        logger.warn('Request data redacted', {
          redactionCount: result.redactions.length,
          riskScore: result.riskScore,
        });
      }

      return result.data;
    },

    redactResponse: (data: any) => {
      if (!options.redactResponses) return data;

      const result = redactor.redactObject(data, options.enabledRules);

      if (options.logRedactions && result.redactions.length > 0) {
        logger.warn('Response data redacted', {
          redactionCount: result.redactions.length,
          riskScore: result.riskScore,
        });
      }

      return result.data;
    },

    scanOnly: (data: any) => {
      const result = redactor.redactObject(data, options.enabledRules);
      return {
        hasSensitiveData: result.redactions.length > 0,
        riskScore: result.riskScore,
        redactions: result.redactions,
      };
    },
  };
}

export const redactor = new DataRedactor();
export default redactor;