'use client';

import { useState, useEffect } from 'react';
import { useRoles } from '../auth/RoleGuard';

interface DealerFilterProps {
  onFilterChange?: (filters: DealerFilters) => void;
  showTimeRange?: boolean;
  showMetricType?: boolean;
  showLocation?: boolean;
  className?: string;
}

export interface DealerFilters {
  dealerId?: string;
  timeRange?: string;
  metricType?: string;
  location?: string;
  brand?: string;
  tier?: number;
}

const DealerFilter: React.FC<DealerFilterProps> = ({
  onFilterChange,
  showTimeRange = true,
  showMetricType = true,
  showLocation = false,
  className = ''
}) => {
  const { dealerId: currentDealerId, isAdmin, isDealer } = useRoles();
  const [filters, setFilters] = useState<DealerFilters>({
    dealerId: currentDealerId || '',
    timeRange: '30d',
    metricType: 'all',
    location: '',
    brand: '',
    tier: undefined
  });

  const [availableDealers, setAvailableDealers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch available dealers for admin users
  useEffect(() => {
    const fetchDealers = async () => {
      if (isAdmin) {
        setLoading(true);
        try {
          const response = await fetch('/api/admin/dealers');
          const dealers = await response.json();
          setAvailableDealers(dealers);
        } catch (error) {
          console.error('Failed to fetch dealers:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDealers();
  }, [isAdmin]);

  // Update filters and notify parent
  const updateFilter = (key: keyof DealerFilters, value: string | number | undefined) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const timeRangeOptions = [
    { value: '1d', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 3 Months' },
    { value: '1y', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const metricTypeOptions = [
    { value: 'all', label: 'All Metrics' },
    { value: 'visibility', label: 'AI Visibility' },
    { value: 'revenue', label: 'Revenue Impact' },
    { value: 'competitive', label: 'Competitive Intelligence' },
    { value: 'customer', label: 'Customer Experience' },
    { value: 'operational', label: 'Operational Efficiency' }
  ];

  const brandOptions = [
    { value: '', label: 'All Brands' },
    { value: 'toyota', label: 'Toyota' },
    { value: 'honda', label: 'Honda' },
    { value: 'ford', label: 'Ford' },
    { value: 'bmw', label: 'BMW' },
    { value: 'lexus', label: 'Lexus' }
  ];

  const tierOptions = [
    { value: '', label: 'All Tiers' },
    { value: 1, label: 'Tier 1 (Premium)' },
    { value: 2, label: 'Tier 2 (Standard)' },
    { value: 3, label: 'Tier 3 (Basic)' }
  ];

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <div className=\"flex items-center justify-between mb-4\">
        <h3 className=\"text-lg font-medium text-gray-900\">Data Filters</h3>
        <button
          onClick={() => {
            const resetFilters = {
              dealerId: currentDealerId || '',
              timeRange: '30d',
              metricType: 'all',
              location: '',
              brand: '',
              tier: undefined
            };
            setFilters(resetFilters);
            onFilterChange?.(resetFilters);
          }}
          className=\"text-sm text-blue-600 hover:text-blue-800\"
        >
          Reset Filters
        </button>
      </div>

      <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4\">
        {/* Dealer Selection (Admin only) */}
        {isAdmin && (
          <div>
            <label className=\"block text-sm font-medium text-gray-700 mb-2\">
              Select Dealer
            </label>
            <select
              value={filters.dealerId}
              onChange={(e) => updateFilter('dealerId', e.target.value)}
              className=\"w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500\"
              disabled={loading}
            >
              <option value=\"\">All Dealers</option>
              {availableDealers.map((dealer: any) => (
                <option key={dealer.id} value={dealer.id}>
                  {dealer.name} ({dealer.location})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Current Dealer Info (Dealer role) */}
        {isDealer && currentDealerId && (
          <div>
            <label className=\"block text-sm font-medium text-gray-700 mb-2\">
              Current Dealer
            </label>
            <div className=\"px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900\">
              {currentDealerId}
            </div>
          </div>
        )}

        {/* Time Range */}
        {showTimeRange && (
          <div>
            <label className=\"block text-sm font-medium text-gray-700 mb-2\">
              Time Range
            </label>
            <select
              value={filters.timeRange}
              onChange={(e) => updateFilter('timeRange', e.target.value)}
              className=\"w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500\"
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Metric Type */}
        {showMetricType && (
          <div>
            <label className=\"block text-sm font-medium text-gray-700 mb-2\">
              Metric Focus
            </label>
            <select
              value={filters.metricType}
              onChange={(e) => updateFilter('metricType', e.target.value)}
              className=\"w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500\"
            >
              {metricTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Brand Filter */}
        <div>
          <label className=\"block text-sm font-medium text-gray-700 mb-2\">
            Brand
          </label>
          <select
            value={filters.brand}
            onChange={(e) => updateFilter('brand', e.target.value)}
            className=\"w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500\"
          >
            {brandOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tier Filter (Admin only) */}
        {isAdmin && (
          <div>
            <label className=\"block text-sm font-medium text-gray-700 mb-2\">
              Dealer Tier
            </label>
            <select
              value={filters.tier || ''}
              onChange={(e) => updateFilter('tier', e.target.value ? parseInt(e.target.value) : undefined)}
              className=\"w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500\"
            >
              {tierOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Location Filter */}
        {(showLocation || isAdmin) && (
          <div>
            <label className=\"block text-sm font-medium text-gray-700 mb-2\">
              Location
            </label>
            <input
              type=\"text\"
              placeholder=\"e.g., Naples, FL\"
              value={filters.location}
              onChange={(e) => updateFilter('location', e.target.value)}
              className=\"w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500\"
            />
          </div>
        )}
      </div>

      {/* Active Filters Summary */}
      <div className=\"mt-4 pt-4 border-t border-gray-200\">
        <div className=\"flex flex-wrap gap-2\">
          {filters.dealerId && (
            <span className=\"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800\">
              Dealer: {filters.dealerId}
            </span>
          )}
          {filters.timeRange && filters.timeRange !== '30d' && (
            <span className=\"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800\">
              {timeRangeOptions.find(opt => opt.value === filters.timeRange)?.label}
            </span>
          )}
          {filters.metricType && filters.metricType !== 'all' && (
            <span className=\"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800\">
              {metricTypeOptions.find(opt => opt.value === filters.metricType)?.label}
            </span>
          )}
          {filters.brand && (
            <span className=\"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800\">
              Brand: {filters.brand}
            </span>
          )}
          {filters.tier && (
            <span className=\"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800\">
              Tier {filters.tier}
            </span>
          )}
          {filters.location && (
            <span className=\"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800\">
              {filters.location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealerFilter;