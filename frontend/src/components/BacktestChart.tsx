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

interface BacktestChartProps {
    data: any[];
}

export const BacktestChart: React.FC<BacktestChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground italic bg-secondary/20 rounded-xl border border-dashed border-white/10">
                No performance data to display. Run a backtest to see results.
            </div>
        );
    }

    return (
        <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00ff7a" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#00ff7a" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="datetime" hide />
                    <YAxis
                        stroke="#888"
                        fontSize={12}
                        tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                        domain={['auto', 'auto']}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                        itemStyle={{ color: '#00ff7a', fontWeight: 'bold' }}
                        labelStyle={{ color: '#94a3b8' }}
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
