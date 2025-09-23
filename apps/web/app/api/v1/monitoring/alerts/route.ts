import { NextRequest, NextResponse } from 'next/server';

interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  timestamp: string;
  source: string;
  status: 'active' | 'acknowledged' | 'resolved';
  tags: string[];
  metadata?: Record<string, any>;
}

interface AlertRules {
  memory_usage_critical: number; // %
  memory_usage_high: number; // %
  response_time_critical: number; // ms
  response_time_high: number; // ms
  error_rate_critical: number; // %
  error_rate_high: number; // %
  queue_backlog_critical: number; // number of jobs
  cost_budget_critical: number; // % of budget
}

// Default alert thresholds
const DEFAULT_ALERT_RULES: AlertRules = {
  memory_usage_critical: 90,
  memory_usage_high: 80,
  response_time_critical: 5000,
  response_time_high: 2000,
  error_rate_critical: 5,
  error_rate_high: 2,
  queue_backlog_critical: 1000,
  cost_budget_critical: 90,
};

class AlertManager {
  private static alerts: Alert[] = [];

  static generateAlerts(): Alert[] {
    const currentAlerts: Alert[] = [];

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryPercent > DEFAULT_ALERT_RULES.memory_usage_critical) {
      currentAlerts.push({
        id: `memory-critical-${Date.now()}`,
        severity: 'critical',
        title: 'Critical Memory Usage',
        description: `Memory usage is ${memoryPercent.toFixed(1)}% (threshold: ${DEFAULT_ALERT_RULES.memory_usage_critical}%)`,
        timestamp: new Date().toISOString(),
        source: 'system_monitor',
        status: 'active',
        tags: ['memory', 'performance', 'critical'],
        metadata: {
          current_usage: memoryPercent,
          threshold: DEFAULT_ALERT_RULES.memory_usage_critical,
          heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
      });
    } else if (memoryPercent > DEFAULT_ALERT_RULES.memory_usage_high) {
      currentAlerts.push({
        id: `memory-high-${Date.now()}`,
        severity: 'high',
        title: 'High Memory Usage',
        description: `Memory usage is ${memoryPercent.toFixed(1)}% (threshold: ${DEFAULT_ALERT_RULES.memory_usage_high}%)`,
        timestamp: new Date().toISOString(),
        source: 'system_monitor',
        status: 'active',
        tags: ['memory', 'performance'],
        metadata: {
          current_usage: memoryPercent,
          threshold: DEFAULT_ALERT_RULES.memory_usage_high,
        },
      });
    }

    // Check environment configuration
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      currentAlerts.push({
        id: `database-config-${Date.now()}`,
        severity: 'high',
        title: 'Database Configuration Missing',
        description: 'Production database URL not configured',
        timestamp: new Date().toISOString(),
        source: 'configuration_monitor',
        status: 'active',
        tags: ['database', 'configuration'],
        metadata: {
          issue: 'Missing or placeholder DATABASE_URL',
          action_required: 'Configure production database connection',
        },
      });
    }

    // Check AI provider configuration
    const missingProviders = [];
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('placeholder')) {
      missingProviders.push('OpenAI');
    }
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('placeholder')) {
      missingProviders.push('Anthropic');
    }

    if (missingProviders.length > 0) {
      currentAlerts.push({
        id: `ai-providers-${Date.now()}`,
        severity: missingProviders.length >= 2 ? 'critical' : 'medium',
        title: 'AI Provider Configuration Issues',
        description: `Missing or invalid API keys for: ${missingProviders.join(', ')}`,
        timestamp: new Date().toISOString(),
        source: 'configuration_monitor',
        status: 'active',
        tags: ['ai_providers', 'configuration'],
        metadata: {
          missing_providers: missingProviders,
          action_required: 'Configure API keys in environment variables',
        },
      });
    }

    // Check SSL/Security configuration in production
    if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL?.startsWith('https://')) {
      currentAlerts.push({
        id: `ssl-config-${Date.now()}`,
        severity: 'high',
        title: 'SSL Configuration Warning',
        description: 'NEXTAUTH_URL is not using HTTPS in production',
        timestamp: new Date().toISOString(),
        source: 'security_monitor',
        status: 'active',
        tags: ['ssl', 'security', 'configuration'],
        metadata: {
          current_url: process.env.NEXTAUTH_URL,
          action_required: 'Update NEXTAUTH_URL to use HTTPS',
        },
      });
    }

    return currentAlerts;
  }

  static getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => alert.status === 'active');
  }

  static acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'acknowledged';
      return true;
    }
    return false;
  }

  static resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'resolved';
      return true;
    }
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'active' | 'acknowledged' | 'resolved' | null;
    const severity = url.searchParams.get('severity') as Alert['severity'] | null;

    // Generate current alerts
    const currentAlerts = AlertManager.generateAlerts();

    // Update internal alert store
    AlertManager.alerts = [...AlertManager.alerts, ...currentAlerts];

    // Filter alerts based on query parameters
    let filteredAlerts = AlertManager.alerts;

    if (status) {
      filteredAlerts = filteredAlerts.filter(alert => alert.status === status);
    }

    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }

    // Sort by timestamp (newest first) and limit to last 50
    filteredAlerts = filteredAlerts
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);

    const response = {
      alerts: filteredAlerts,
      summary: {
        total: filteredAlerts.length,
        critical: filteredAlerts.filter(a => a.severity === 'critical').length,
        high: filteredAlerts.filter(a => a.severity === 'high').length,
        medium: filteredAlerts.filter(a => a.severity === 'medium').length,
        low: filteredAlerts.filter(a => a.severity === 'low').length,
        active: filteredAlerts.filter(a => a.status === 'active').length,
        acknowledged: filteredAlerts.filter(a => a.status === 'acknowledged').length,
        resolved: filteredAlerts.filter(a => a.status === 'resolved').length,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to retrieve alerts:', error);

    return NextResponse.json({
      error: 'Failed to retrieve alerts',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId } = body;

    if (!action || !alertId) {
      return NextResponse.json({
        error: 'Missing required fields: action, alertId',
      }, { status: 400 });
    }

    let success = false;

    switch (action) {
      case 'acknowledge':
        success = AlertManager.acknowledgeAlert(alertId);
        break;
      case 'resolve':
        success = AlertManager.resolveAlert(alertId);
        break;
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: acknowledge, resolve',
        }, { status: 400 });
    }

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Alert ${alertId} ${action}d successfully`,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json({
        error: 'Alert not found',
      }, { status: 404 });
    }

  } catch (error) {
    console.error('Failed to update alert:', error);

    return NextResponse.json({
      error: 'Failed to update alert',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}