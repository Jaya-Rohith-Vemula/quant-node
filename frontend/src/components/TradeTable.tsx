import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Trade {
    tradeNo: number;
    datetime: string;
    type: string;
    price: number;
    shares: number;
    profit: number;
    comment: string;
}

interface TradeTableProps {
    trades: Trade[];
}

export const TradeTable: React.FC<TradeTableProps> = ({ trades }) => {
    return (
        <div className="mt-8 overflow-hidden rounded-xl border border-white/10 glass">
            <div className="bg-white/5 px-6 py-4 border-b border-white/10">
                <h3 className="font-semibold">Trade Execution History</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-xs uppercase text-muted-foreground bg-white/5">
                            <th className="px-6 py-3 font-medium">No</th>
                            <th className="px-6 py-3 font-medium">Type</th>
                            <th className="px-6 py-3 font-medium">Price</th>
                            <th className="px-6 py-3 font-medium">Shares</th>
                            <th className="px-6 py-3 font-medium">Profit</th>
                            <th className="px-6 py-3 font-medium">Date/Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {trades.slice().reverse().map((trade) => (
                            <tr key={`${trade.tradeNo}-${trade.datetime}`} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{trade.tradeNo}</td>
                                <td className="px-6 py-4">
                                    <span className={`flex items-center gap-1 text-sm font-bold ${trade.type === 'BUY' ? 'text-blue-400' : 'text-primary'}`}>
                                        {trade.type === 'BUY' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                        {trade.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-mono">${trade.price.toFixed(2)}</td>
                                <td className="px-6 py-4 text-sm font-mono">{trade.shares.toFixed(2)}</td>
                                <td className={`px-6 py-4 text-sm font-mono ${trade.profit > 0 ? 'text-primary' : trade.profit < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                    {trade.profit !== 0 ? `$${trade.profit.toFixed(2)}` : '-'}
                                </td>
                                <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">{trade.datetime}</td>
                            </tr>
                        ))}
                        {trades.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                                    No trades recorded yet. Adjust parameters and run simulation.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
