import React, { useState } from 'react';
import { useThemeColors } from '../context/ThemeContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface MultiMetricChartProps {
  data: any[];
  title?: string;
}

interface MetricOption {
  key: string;
  label: string;
  stroke: string;
  unit?: string;
  formatter?: (value: any) => string;
}

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'pace', label: 'Pace', stroke: '#fc4c02', unit: 'min/km', formatter: (value: any) => { const m = Math.floor(Number(value)); const s = Math.floor((Number(value) - m) * 60); return `${m}:${s.toString().padStart(2, '0')}`; } },
  { key: 'speed', label: 'Speed', stroke: '#007bff', unit: 'km/h' },
  { key: 'elevation', label: 'Elevation', stroke: '#28a745', unit: 'm' },
  { key: 'heartrate', label: 'Heart Rate', stroke: '#dc3545', unit: 'bpm' },
  { key: 'altitude', label: 'Altitude', stroke: '#6f42c1', unit: 'm' },
  { key: 'time', label: 'Time', stroke: '#17a2b8', unit: 'min' },
];

const MultiMetricChart: React.FC<MultiMetricChartProps> = ({ data, title = 'Multi-Metric Overview' }) => {
  const colors = useThemeColors();
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['pace', 'speed']);

  const toggleMetric = (key: string) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      return [...prev, key];
    });
  };

  const availableMetrics = METRIC_OPTIONS.filter((m) =>
    data.some((d) => d[m.key] !== undefined && d[m.key] !== null && d[m.key] !== 0)
  );

  const hasTimeAxis = data.some((d) => d.time !== undefined);
  const hasDistanceAxis = data.some((d) => d.distance !== undefined || d.km !== undefined);

  const getXAxisConfig = () => {
    if (hasDistanceAxis) {
      const hasKm = data.some((d) => d.km !== undefined);
      return {
        dataKey: hasKm ? 'km' : 'distance',
        label: hasKm ? 'Distance (km)' : 'Distance (km)',
      };
    }
    if (hasTimeAxis) {
      return {
        dataKey: 'time',
        label: 'Time (minutes)',
      };
    }
    return null;
  };

  const xAxisConfig = getXAxisConfig();
  if (!xAxisConfig || data.length === 0) return null;

  const activeMetrics = availableMetrics.filter((m) => selectedMetrics.includes(m.key));

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {availableMetrics.map((metric) => (
            <button
              key={metric.key}
              onClick={() => toggleMetric(metric.key)}
              style={{
                padding: '0.3rem 0.6rem',
                border: `2px solid ${metric.stroke}`,
                borderRadius: '4px',
                backgroundColor: selectedMetrics.includes(metric.key) ? metric.stroke : colors.bgSecondary,
                color: selectedMetrics.includes(metric.key) ? 'white' : metric.stroke,
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: selectedMetrics.includes(metric.key) ? 'bold' : 'normal',
                transition: 'all 0.2s',
              }}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xAxisConfig.dataKey}
              label={{ value: xAxisConfig.label, position: 'insideBottom', offset: -5 }}
            />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              formatter={(value: any, name: string) => {
                const metric = METRIC_OPTIONS.find((m) => m.key === name);
                if (metric?.formatter) {
                  return [metric.formatter(value), `${metric.label} (${metric.unit})`];
                }
                return [value, metric ? `${metric.label} (${metric.unit})` : name];
              }}
            />
            <Legend
              formatter={(value: string) => {
                const metric = METRIC_OPTIONS.find((m) => m.key === value);
                return metric ? `${metric.label} (${metric.unit})` : value;
              }}
            />
            {activeMetrics.map((metric) => (
              <Line
                key={metric.key}
                yAxisId="right"
                type="monotone"
                dataKey={metric.key}
                stroke={metric.stroke}
                strokeWidth={2}
                dot={false}
                activeDot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MultiMetricChart;
