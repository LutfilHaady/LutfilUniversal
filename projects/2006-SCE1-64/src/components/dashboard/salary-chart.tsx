'use client';

import { Line, LineChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltipContent, ChartContainer } from '@/components/ui/chart';
import { CardDescription } from '../ui/card';

type IndustrySalaryData = {
  [industry: string]: { year: number; gross_monthly_mean: number | null }[];
};

type SalaryChartProps = {
  data: IndustrySalaryData;
  selectedIndustries: string[];
};

const colors = [
  'hsl(var(--primary))',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
];

export function SalaryChart({ data, selectedIndustries }: SalaryChartProps) {
  const hasData = Array.isArray(selectedIndustries) && selectedIndustries.some((i) => data[i]?.length);

  if (!hasData) {
    return (
      <CardDescription>
        No salary data available for the selected industries.
      </CardDescription>
    );
  }

  return (
    <>
      <CardDescription>
        Estimated salary progression for selected industries in Singapore.
      </CardDescription>

      <div className="h-[300px] w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ChartContainer
            config={{ salary: { label: 'Salary', color: 'hsl(var(--primary))' } }}
          >
            <LineChart margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickCount={data[selectedIndustries[0]]?.length} 
                interval={0} 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <Tooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />

              {selectedIndustries.map((industry, i) => (
                <Line
                  key={industry}
                  data={data[industry]}
                  dataKey="gross_monthly_mean"
                  name={industry}
                  type="monotone"
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={{ fill: colors[i % colors.length], r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls={true}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </ResponsiveContainer>
      </div>
    </>
  );
}
