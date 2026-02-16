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
        <div className="h-[400px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00ff7a" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#00ff7a" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                    <XAxis
                        dataKey="datetime"
                        stroke="#666"
                        fontSize={10}
                        tickFormatter={(val) => val.split(' ')[0]}
                        hide
                    />
                    <YAxis
                        stroke="#666"
                        fontSize={10}
                        tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '8px' }}
                        itemStyle={{ color: '#00ff7a' }}
                        labelStyle={{ color: '#999' }}
                        formatter={(value: any) => [`$${parseFloat(value).toLocaleString()}`, 'Account Value']}
                    />
                    <Area
                        type="monotone"
                        dataKey="accountBalance"
                        stroke="#00ff7a"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorBalance)"
                        dot={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
