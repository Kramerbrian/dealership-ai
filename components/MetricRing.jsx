import React, { useMemo } from 'react';

/**
 * Unified MetricRing Component
 * Replaces ScoreRing, CircularProgress, ScoreCircle, etc.
 * One flexible component for all circular metrics
 */
const MetricRing = ({
  value,
  maxValue = 100,
  size = 100,
  strokeWidth = 8,
  label,
  subtitle,
  color = '#3B82F6',
  backgroundColor = '#1E293B',
  showBreakdown = false,
  breakdown = [],
  animated = true,
  showValue = true,
  formatter = (val) => `${Math.round(val)}`,
  className = '',
  children
}) => {
  const normalizedValue = Math.min(Math.max(value, 0), maxValue);
  const percentage = (normalizedValue / maxValue) * 100;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Dynamic color based on value
  const getColor = useMemo(() => {
    if (typeof color === 'string') return color;

    // Color thresholds
    if (percentage >= 80) return '#10B981'; // Green
    if (percentage >= 60) return '#F59E0B'; // Yellow
    if (percentage >= 40) return '#F97316'; // Orange
    return '#EF4444'; // Red
  }, [percentage, color]);

  // Breakdown segments for complex metrics
  const renderBreakdown = () => {
    if (!showBreakdown || !breakdown.length) return null;

    let currentOffset = 0;

    return breakdown.map((segment, index) => {
      const segmentPercentage = (segment.value / maxValue) * 100;
      const segmentLength = (segmentPercentage / 100) * circumference;
      const segmentDashoffset = circumference - currentOffset - segmentLength;

      currentOffset += segmentLength;

      return (
        <circle
          key={index}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={segment.color || getColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${segmentLength} ${circumference}`}
          strokeDashoffset={-currentOffset + segmentLength}
          strokeLinecap="round"
          className={animated ? 'transition-all duration-1000 ease-in-out' : ''}
        />
      );
    });
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
          />

          {/* Progress circle or breakdown */}
          {showBreakdown ? renderBreakdown() : (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={getColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={animated ? 'transition-all duration-1000 ease-in-out' : ''}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children || (
            <>
              {showValue && (
                <div className="text-2xl font-bold text-slate-100">
                  {formatter(normalizedValue)}
                </div>
              )}
              {label && (
                <div className="text-xs text-slate-400 mt-1 max-w-16 leading-tight">
                  {label}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Subtitle below the ring */}
      {subtitle && (
        <div className="text-xs text-slate-400 mt-2 text-center max-w-24">
          {subtitle}
        </div>
      )}

      {/* Breakdown legend */}
      {showBreakdown && breakdown.length > 0 && (
        <div className="mt-3 space-y-1">
          {breakdown.map((segment, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: segment.color || getColor }}
              />
              <span className="text-slate-300">{segment.label}</span>
              <span className="text-slate-400">
                {formatter(segment.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Preset configurations for common use cases
export const ScoreRing = (props) => (
  <MetricRing
    {...props}
    formatter={(val) => `${Math.round(val)}`}
    color={props.color || ((val) => {
      if (val >= 80) return '#10B981';
      if (val >= 60) return '#F59E0B';
      if (val >= 40) return '#F97316';
      return '#EF4444';
    })}
  />
);

export const PercentageRing = (props) => (
  <MetricRing
    {...props}
    formatter={(val) => `${Math.round(val)}%`}
  />
);

export const CurrencyRing = (props) => (
  <MetricRing
    {...props}
    formatter={(val) => `$${(val / 1000).toFixed(1)}k`}
  />
);

export const CompetitorRing = ({ position, total, ...props }) => (
  <MetricRing
    value={total - position + 1}
    maxValue={total}
    formatter={() => `#${position}`}
    label="Position"
    color="#8B5CF6"
    {...props}
  />
);

// Multi-metric ring for complex data
export const MultiMetricRing = ({ metrics, size = 120, ...props }) => {
  const breakdown = metrics.map((metric, index) => ({
    ...metric,
    color: metric.color || [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'
    ][index % 6]
  }));

  const totalValue = breakdown.reduce((sum, metric) => sum + metric.value, 0);

  return (
    <MetricRing
      value={totalValue}
      maxValue={100}
      size={size}
      showBreakdown={true}
      breakdown={breakdown}
      showValue={false}
      {...props}
    >
      <div className="text-center">
        <div className="text-lg font-bold text-slate-100">
          {Math.round(totalValue)}
        </div>
        <div className="text-xs text-slate-400">
          Combined
        </div>
      </div>
    </MetricRing>
  );
};

// Risk indicator ring with color zones
export const RiskRing = ({ riskLevel, ...props }) => {
  const riskColors = {
    low: '#10B981',      // Green
    medium: '#F59E0B',   // Yellow
    high: '#F97316',     // Orange
    critical: '#EF4444'  // Red
  };

  const riskValues = {
    low: 25,
    medium: 50,
    high: 75,
    critical: 100
  };

  return (
    <MetricRing
      value={riskValues[riskLevel] || 50}
      maxValue={100}
      color={riskColors[riskLevel] || '#F59E0B'}
      formatter={() => riskLevel.toUpperCase()}
      {...props}
    />
  );
};

// Trend ring showing change over time
export const TrendRing = ({ value, change, ...props }) => {
  const trendColor = change > 0 ? '#10B981' : change < 0 ? '#EF4444' : '#6B7280';

  return (
    <MetricRing
      value={value}
      color={trendColor}
      {...props}
    >
      <div className="text-center">
        <div className="text-lg font-bold text-slate-100">
          {Math.round(value)}
        </div>
        {change !== 0 && (
          <div className={`text-xs ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {change > 0 ? '+' : ''}{change}%
          </div>
        )}
      </div>
    </MetricRing>
  );
};

export default MetricRing;