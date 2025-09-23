import React, { useMemo } from 'react';

interface MetricRingProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  subtitle?: string;
  color?: string;
  backgroundColor?: string;
  animated?: boolean;
  showValue?: boolean;
  formatter?: (val: number) => string;
  className?: string;
  children?: React.ReactNode;
}

export default function MetricRing({
  value,
  maxValue = 100,
  size = 100,
  strokeWidth = 8,
  label,
  subtitle,
  color = '#3B82F6',
  backgroundColor = '#1E293B',
  animated = true,
  showValue = true,
  formatter = (val) => `${Math.round(val)}`,
  className = '',
  children
}: MetricRingProps) {
  const normalizedValue = Math.min(Math.max(value, 0), maxValue);
  const percentage = (normalizedValue / maxValue) * 100;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = useMemo(() => {
    if (typeof color === 'string') return color;
    if (percentage >= 80) return '#10B981';
    if (percentage >= 60) return '#F59E0B';
    if (percentage >= 40) return '#F97316';
    return '#EF4444';
  }, [color, percentage]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
          />
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
            className={animated ? "transition-all duration-1000 ease-out" : ""}
          />
        </svg>
        {(showValue || children) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {children || (
              <>
                <div className="text-lg font-bold text-white">
                  {formatter(normalizedValue)}
                </div>
                {maxValue !== 100 && (
                  <div className="text-xs text-gray-400">
                    / {formatter(maxValue)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {label && (
        <div className="mt-2 text-center">
          <div className="text-sm font-medium text-gray-200">{label}</div>
          {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}