'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

interface InteractiveChartProps {
  data?: ChartDataPoint[];
  type?: 'line' | 'area' | 'bar' | 'pie';
  title?: string;
  height?: number;
  dataKey?: string;
  xAxisKey?: string;
  color?: string;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  realTime?: boolean;
  refreshInterval?: number;
  apiEndpoint?: string;
  animated?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const InteractiveChart: React.FC<InteractiveChartProps> = ({
  data: initialData = [],
  type = 'line',
  title,
  height = 300,
  dataKey = 'value',
  xAxisKey = 'name',
  color = '#8884d8',
  colors = COLORS,
  showGrid = true,
  showLegend = true,
  'real-time': realTime = false,
  refreshInterval = 30000,
  apiEndpoint,
  animated = true
}) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Real-time data fetching
  useEffect(() => {
    if (realTime && apiEndpoint) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const response = await fetch(apiEndpoint);
          const data = await response.json();
          setChartData(data);
          setLastUpdate(new Date());
        } catch (error) {
          console.error('Failed to fetch chart data:', error);
        } finally {
          setLoading(false);
        }
      };

      // Initial fetch
      fetchData();

      // Set up interval for real-time updates
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [realTime, apiEndpoint, refreshInterval]);

  const renderChart = () => {
    const commonProps = {
      width: '100%',
      height,
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    const commonAxisProps = {
      axisLine: false,
      tickLine: false,
      tick: { fontSize: 12, fill: '#6b7280' }
    };

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />}
            <XAxis dataKey={xAxisKey} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            {showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: color, strokeWidth: 2, fill: '#fff' }}
              animationDuration={animated ? 1000 : 0}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />}
            <XAxis dataKey={xAxisKey} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            {showLegend && <Legend />}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={`${color}20`}
              strokeWidth={2}
              animationDuration={animated ? 1000 : 0}
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />}
            <XAxis dataKey={xAxisKey} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            {showLegend && <Legend />}
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[4, 4, 0, 0]}
              animationDuration={animated ? 1000 : 0}
            />
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart width="100%" height={height}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={dataKey}
              animationDuration={animated ? 1000 : 0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            {showLegend && <Legend />}
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          {realTime && (
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
              <span className="text-xs text-gray-500">
                {lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString()}` : 'Real-time'}
              </span>
            </div>
          )}
        </div>
      )}

      {loading && chartData.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default InteractiveChart;