import { Box, Text } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { ChartResult } from '../../api/types';

const COLORS = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f687b3', '#38b2ac'];

interface Props {
  data: ChartResult;
}

function formatTick(value: unknown): string {
  if (typeof value === 'string' && value.length === 10 && value.includes('-')) {
    return value.slice(5);
  }
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(2);
  }
  return String(value);
}

export default function ChartRenderer({ data }: Props) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  const gridColor = isDark ? '#2d3748' : '#e2e8f0';
  const textColor = isDark ? '#a0aec0' : '#718096';
  const tooltipBg = isDark ? '#1a202c' : '#fff';
  const tooltipBorder = isDark ? '#4a5568' : '#e2e8f0';

  const axisStyle = { fontSize: 11, fill: textColor };

  const commonProps = {
    data: data.data as Record<string, unknown>[],
    margin: { top: 8, right: 16, left: 0, bottom: 4 },
  };

  const renderAxes = () => (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
      <XAxis
        dataKey={data.x_key}
        tick={axisStyle}
        tickFormatter={formatTick}
        label={
          data.x_label
            ? { value: data.x_label, position: 'insideBottom', offset: -2, style: axisStyle }
            : undefined
        }
      />
      <YAxis
        tick={axisStyle}
        tickFormatter={formatTick}
        width={56}
        label={
          data.y_label
            ? { value: data.y_label, angle: -90, position: 'insideLeft', style: axisStyle }
            : undefined
        }
      />
      <Tooltip
        contentStyle={{
          background: tooltipBg,
          border: `1px solid ${tooltipBorder}`,
          borderRadius: 8,
          fontSize: 12,
        }}
        formatter={(value: unknown) => [formatTick(value), '']}
      />
      {data.y_keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
    </>
  );

  const renderSeries = () =>
    data.y_keys.map((key, i) => {
      const color = COLORS[i % COLORS.length];
      if (data.chart_type === 'line') {
        return (
          <Line key={key} type="monotone" dataKey={key} stroke={color} dot={false} strokeWidth={2} />
        );
      }
      if (data.chart_type === 'bar') {
        return <Bar key={key} dataKey={key} fill={color} radius={[3, 3, 0, 0]} />;
      }
      return (
        <Area
          key={key}
          type="monotone"
          dataKey={key}
          stroke={color}
          fill={color}
          fillOpacity={0.15}
          strokeWidth={2}
          dot={false}
        />
      );
    });

  const ChartComp =
    data.chart_type === 'line' ? LineChart : data.chart_type === 'bar' ? BarChart : AreaChart;

  return (
    <Box w="full" maxW="700px">
      {data.title && (
        <Text fontSize="sm" fontWeight="600" mb={2} color="gray.500">
          {data.title}
        </Text>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <ChartComp {...commonProps}>
          {renderAxes()}
          {renderSeries()}
        </ChartComp>
      </ResponsiveContainer>
    </Box>
  );
}
