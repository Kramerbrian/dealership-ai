"use client";
import { useState } from 'react';
import { Card } from '@dealershipai/ui';
import { useCostTracking } from '@/hooks';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Settings,
  Calendar,
  BarChart3,
  Edit,
  Save,
  X
} from 'lucide-react';

export default function CostDashboard() {
  const {
    usage,
    budgetLimits,
    budgetUtilization,
    loading,
    error,
    updateBudgetLimits,
    fetchUsage,
  } = useCostTracking();

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    daily: budgetLimits?.daily || 0,
    monthly: budgetLimits?.monthly || 0,
  });

  const handleSaveBudget = async () => {
    const success = await updateBudgetLimits(budgetForm);
    if (success) {
      setEditingBudget(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getUtilizationBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 75) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Loading cost data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-6">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>Error loading cost data: {error}</p>
        <button
          onClick={fetchUsage}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cost Management</h1>
        <button
          onClick={fetchUsage}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <BarChart3 className="w-4 h-4" />
          Refresh Data
        </button>
      </div>

      {/* Cost Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Daily Total</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(usage?.dailyTotal || 0)}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Total</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(usage?.monthlyTotal || 0)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spend</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(usage?.grandTotal || 0)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Budget Utilization */}
      {budgetUtilization && (
        <Card>
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Budget Utilization</h3>
              {!editingBudget ? (
                <button
                  onClick={() => {
                    setBudgetForm({
                      daily: budgetLimits?.daily || 0,
                      monthly: budgetLimits?.monthly || 0,
                    });
                    setEditingBudget(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  <Edit className="w-4 h-4" />
                  Edit Budget
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveBudget}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => setEditingBudget(false)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Daily Budget</h4>
                  {editingBudget ? (
                    <input
                      type="number"
                      step="0.01"
                      value={budgetForm.daily}
                      onChange={(e) => setBudgetForm({
                        ...budgetForm,
                        daily: parseFloat(e.target.value) || 0
                      })}
                      className="w-24 px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    <span className="text-sm text-gray-600">
                      Limit: {formatCurrency(budgetLimits?.daily || 0)}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used: {formatCurrency(budgetUtilization.daily.used)}</span>
                    <span>Remaining: {formatCurrency(budgetUtilization.daily.remaining)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${getUtilizationBarColor(budgetUtilization.daily.percentage)}`}
                      style={{ width: `${Math.min(budgetUtilization.daily.percentage, 100)}%` }}
                    />
                  </div>
                  <div className={`text-sm px-2 py-1 rounded ${getUtilizationColor(budgetUtilization.daily.percentage)}`}>
                    {budgetUtilization.daily.percentage}% utilized
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Monthly Budget</h4>
                  {editingBudget ? (
                    <input
                      type="number"
                      step="0.01"
                      value={budgetForm.monthly}
                      onChange={(e) => setBudgetForm({
                        ...budgetForm,
                        monthly: parseFloat(e.target.value) || 0
                      })}
                      className="w-24 px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    <span className="text-sm text-gray-600">
                      Limit: {formatCurrency(budgetLimits?.monthly || 0)}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used: {formatCurrency(budgetUtilization.monthly.used)}</span>
                    <span>Remaining: {formatCurrency(budgetUtilization.monthly.remaining)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${getUtilizationBarColor(budgetUtilization.monthly.percentage)}`}
                      style={{ width: `${Math.min(budgetUtilization.monthly.percentage, 100)}%` }}
                    />
                  </div>
                  <div className={`text-sm px-2 py-1 rounded ${getUtilizationColor(budgetUtilization.monthly.percentage)}`}>
                    {budgetUtilization.monthly.percentage}% utilized
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Usage Breakdown */}
      {usage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4">Daily Usage</h3>
              <div className="space-y-3">
                {usage.daily.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium">{item.provider} - {item.model}</p>
                      <p className="text-sm text-gray-600">
                        {item.inputTokens.toLocaleString()} in / {item.outputTokens.toLocaleString()} out
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(item.totalCost)}</p>
                      <p className="text-sm text-gray-600">{item.requestCount} requests</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4">Monthly Usage</h3>
              <div className="space-y-3">
                {usage.monthly.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium">{item.provider} - {item.model}</p>
                      <p className="text-sm text-gray-600">
                        {item.inputTokens.toLocaleString()} in / {item.outputTokens.toLocaleString()} out
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(item.totalCost)}</p>
                      <p className="text-sm text-gray-600">{item.requestCount} requests</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Budget Alerts */}
      {budgetUtilization && (
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Budget Alerts</h3>
            <div className="space-y-2">
              {budgetUtilization.daily.percentage >= 90 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-red-800">
                    Daily budget is {budgetUtilization.daily.percentage}% utilized.
                    Only {formatCurrency(budgetUtilization.daily.remaining)} remaining.
                  </span>
                </div>
              )}
              {budgetUtilization.monthly.percentage >= 90 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-red-800">
                    Monthly budget is {budgetUtilization.monthly.percentage}% utilized.
                    Only {formatCurrency(budgetUtilization.monthly.remaining)} remaining.
                  </span>
                </div>
              )}
              {budgetUtilization.daily.percentage >= 75 && budgetUtilization.daily.percentage < 90 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="text-yellow-800">
                    Daily budget is {budgetUtilization.daily.percentage}% utilized.
                  </span>
                </div>
              )}
              {budgetUtilization.monthly.percentage >= 75 && budgetUtilization.monthly.percentage < 90 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="text-yellow-800">
                    Monthly budget is {budgetUtilization.monthly.percentage}% utilized.
                  </span>
                </div>
              )}
              {budgetUtilization.daily.percentage < 75 && budgetUtilization.monthly.percentage < 75 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded">
                  <span className="text-green-800">Budget usage is within healthy limits.</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}