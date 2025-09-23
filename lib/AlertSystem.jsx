import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info, X } from 'lucide-react';

const AlertContext = createContext();

// Unified Alert System - Replaces all scattered alert/notification systems
export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);

  const addAlert = useCallback((alert) => {
    const id = Date.now() + Math.random();
    const newAlert = {
      id,
      type: 'info',
      duration: 5000,
      dismissible: true,
      ...alert,
      timestamp: new Date()
    };

    setAlerts(prev => [...prev, newAlert]);

    // Auto-dismiss after duration
    if (newAlert.duration > 0) {
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }, newAlert.duration);
    }

    return id;
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
  }, []);

  // Convenience methods
  const showSuccess = useCallback((message, options = {}) => {
    return addAlert({ type: 'success', message, ...options });
  }, [addAlert]);

  const showError = useCallback((message, options = {}) => {
    return addAlert({ type: 'error', message, duration: 8000, ...options });
  }, [addAlert]);

  const showWarning = useCallback((message, options = {}) => {
    return addAlert({ type: 'warning', message, duration: 6000, ...options });
  }, [addAlert]);

  const showInfo = useCallback((message, options = {}) => {
    return addAlert({ type: 'info', message, ...options });
  }, [addAlert]);

  const contextValue = {
    alerts,
    addAlert,
    removeAlert,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      <AlertContainer />
    </AlertContext.Provider>
  );
}

// Alert Container - Renders all alerts
function AlertContainer() {
  const { alerts, removeAlert } = useAlerts();

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} onDismiss={() => removeAlert(alert.id)} />
      ))}
    </div>
  );
}

// Individual Alert Item
function AlertItem({ alert, onDismiss }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  };

  const styles = {
    success: 'bg-green-900 border-green-700 text-green-100',
    error: 'bg-red-900 border-red-700 text-red-100',
    warning: 'bg-yellow-900 border-yellow-700 text-yellow-100',
    info: 'bg-blue-900 border-blue-700 text-blue-100'
  };

  return (
    <div
      className={`
        rounded-lg border p-4 shadow-lg transition-all duration-300 ease-in-out
        ${styles[alert.type]}
        animate-slide-in-right
      `}
      role="alert"
      aria-live={alert.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {icons[alert.type]}
        </div>

        <div className="flex-1 min-w-0">
          {alert.title && (
            <h4 className="font-medium mb-1">{alert.title}</h4>
          )}
          <p className="text-sm">{alert.message}</p>

          {alert.actions && (
            <div className="mt-3 flex gap-2">
              {alert.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    if (action.dismiss !== false) {
                      onDismiss();
                    }
                  }}
                  className="px-3 py-1 text-xs bg-opacity-20 bg-white rounded border border-current hover:bg-opacity-30 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {alert.dismissible && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Hook to use alerts
export function useAlerts() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
}

// Unified Alert Feed Component for Dashboard
export function AlertsFeed({ className = '', limit = 5 }) {
  const { alerts, removeAlert, clearAll } = useAlerts();

  const recentAlerts = alerts
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-700 ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-slate-100">Alerts & Notifications</h3>
        {alerts.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="p-4">
        {recentAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No alerts at this time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {alert.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400" />}
                  {alert.type === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                  {alert.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                  {alert.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  {alert.title && (
                    <h4 className="text-sm font-medium text-slate-200 mb-1">{alert.title}</h4>
                  )}
                  <p className="text-sm text-slate-300">{alert.message}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {alert.timestamp.toLocaleTimeString()}
                  </p>
                </div>

                <button
                  onClick={() => removeAlert(alert.id)}
                  className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Quick Alert Helpers for Specific Use Cases
export const AlertHelpers = {
  // Rate limiting alerts
  rateLimitExceeded: (showError, tier, resetTime) => {
    showError('Rate limit exceeded', {
      title: 'Usage Limit Reached',
      message: `You've reached your ${tier} tier limit. Resets at ${resetTime}`,
      actions: [{
        label: 'Upgrade Tier',
        onClick: () => window.location.href = '/upgrade'
      }]
    });
  },

  // Action completion alerts
  actionCompleted: (showSuccess, actionName, impact) => {
    showSuccess(`${actionName} completed successfully`, {
      title: 'Action Completed',
      message: impact ? `Expected impact: ${impact}` : undefined
    });
  },

  // Error handling alerts
  apiError: (showError, error, retryFn) => {
    showError('API request failed', {
      title: 'Connection Error',
      message: error.message || 'Please try again later',
      actions: retryFn ? [{
        label: 'Retry',
        onClick: retryFn
      }] : undefined
    });
  },

  // Feature restriction alerts
  featureRestricted: (showWarning, feature, requiredTier) => {
    showWarning(`${feature} requires ${requiredTier} tier or higher`, {
      title: 'Feature Restricted',
      actions: [{
        label: 'Upgrade Now',
        onClick: () => window.location.href = '/upgrade'
      }]
    });
  }
};

// CSS Animation (add to your global styles)
export const alertAnimations = `
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
`;