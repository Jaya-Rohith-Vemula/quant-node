import React from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
    Legend
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
                <AreaChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 40 }}>
                    <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00ff7a" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#00ff7a" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorBuyHold" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                        dy={5}
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
                    {/* Hidden YAxis for stock price to prevent scaling interference */}
                    <YAxis yAxisId="stock" hide domain={['auto', 'auto']} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px',
                        }}
                        itemStyle={{ fontWeight: 'bold' }}
                        labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                        labelFormatter={formatTooltipLabel}
                        formatter={(value: any, name?: string) => {
                            let displayName = name;
                            if (name === 'accountBalance') displayName = 'Strategy Portfolio';
                            else if (name === 'buyAndHoldBalance') displayName = 'Buy & Hold';
                            else if (name === 'stockPrice') displayName = 'Stock Price';

                            return [`$${parseFloat(value).toLocaleString()}`, displayName];
                        }}
                    />
                    <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        formatter={(value) => {
                            if (value === 'stockPrice') return null;
                            return (
                                <span className="text-sm font-medium text-muted-foreground mr-4">
                                    {value === 'accountBalance' ? 'Strategy' : 'Buy & Hold'}
                                </span>
                            );
                        }}
                    />
                    <Area
                        type="monotone"
                        name="stockPrice"
                        dataKey="stockPrice"
                        yAxisId="stock"
                        stroke="#94a3b8"
                        fill="transparent"
                        strokeWidth={0}
                        dot={false}
                        legendType="none"
                    />
                    <Area
                        type="monotone"
                        name="buyAndHoldBalance"
                        dataKey="buyAndHoldBalance"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fillOpacity={1}
                        fill="url(#colorBuyHold)"
                        dot={false}
                    />
                    <Area
                        type="monotone"
                        name="accountBalance"
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

