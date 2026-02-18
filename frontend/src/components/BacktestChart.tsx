import React from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';
import { format } from 'date-fns';

interface BacktestChartProps {
    data: any[];
}

export const BacktestChart: React.FC<BacktestChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground italic bg-secondary/20 rounded-xl border border-dashed border-border">
                No performance data to display. Run a backtest to see results.
            </div>
        );
    }

    const formatDateTick = (tickItem: string) => {
        try {
            return format(new Date(tickItem), 'MMM d');
        } catch (e) {
            return tickItem;
        }
    };

    const formatTooltipLabel = (label: any) => {
        if (!label) return '';
        try {
            return format(new Date(label), 'MMM d, yyyy HH:mm');
        } catch (e) {
            return String(label);
        }
    };

    return (
        <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00ff7a" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#00ff7a" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} opacity={0.3} />
                    <XAxis
                        dataKey="datetime"
                        tickFormatter={formatDateTick}
                        stroke="#888"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={40}
                        dy={10}
                    />
                    <YAxis
                        stroke="#888"
                        fontSize={12}
                        tickFormatter={(val) => {
                            if (val >= 1000) {
                                return `$${(val / 1000).toLocaleString(undefined, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 1
                                })}k`;
                            }
                            return `$${val}`;
                        }}
                        domain={['auto', 'auto']}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px',
                        }}
                        itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
                        labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                        labelFormatter={formatTooltipLabel}
                        formatter={(value: any) => [`$${parseFloat(value).toLocaleString()}`, 'Portfolio Value']}
                    />
                    <Area
                        type="monotone"
                        dataKey="accountBalance"
                        stroke="#00ff7a"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorBalance)"
                        dot={false}
                        animationDuration={1500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
