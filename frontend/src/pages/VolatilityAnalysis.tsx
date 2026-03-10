import { Clock, BarChart2, Calendar } from 'lucide-react';
import { VolatilityCard } from '../components/VolatilityCard';
import type { AnalysisResults, BacktestParams } from '../types';
import { format } from 'date-fns';

interface VolatilityAnalysisProps {
    results: AnalysisResults | null;
    loading: boolean;
    symbol: string;
    params: BacktestParams;
}

export function VolatilityAnalysis({ results, loading, symbol, params }: VolatilityAnalysisProps) {
    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500 flex flex-col h-full mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3 tracking-tight mb-2">
                        <BarChart2 className="text-primary" size={28} />
                        {symbol} Volatility Analysis
                    </h1>
                    {!results ? (
                        <p className="text-muted-foreground text-sm font-medium">Analyze asset price ranges, volatility, and absolute price volatility for any defined period.</p>
                    ) : (
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[10px] md:text bg-muted px-3 py-1.5 rounded-full border border-border text-muted-foreground font-mono font-medium truncate flex items-center gap-2">
                                <Calendar size={14} />
                                {format(new Date(params.startDate + 'T00:00:00'), "MMM d, yyyy")} - {format(new Date(params.endDate + 'T00:00:00'), "MMM d, yyyy")}
                            </span>
                            {params.marketHoursOnly && (
                                <span className="text-[10px] md:text bg-muted px-3 py-1.5 rounded-full border border-border text-muted-foreground font-mono font-medium flex items-center gap-2">
                                    <Clock size={14} />
                                    {params.startTime && params.endTime && (params.startTime !== '09:30' || params.endTime !== '16:00')
                                        ? `${params.startTime} - ${params.endTime}`
                                        : "Market Hours (09:30 - 16:00)"}
                                </span>
                            )}

                        </div>
                    )}
                </div>
            </div>

            {loading && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 min-h-[400px]">
                    <div className="h-16 w-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-lg font-bold text-primary animate-pulse tracking-widest uppercase font-mono">
                        Crunching Volatility Data...
                    </p>
                </div>
            )}

            {!loading && !results && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 min-h-[400px]">
                    <p className="text-lg font-bold text-muted-foreground uppercase font-mono">
                        Adjust parameters and hit Analyze to see volatility data.
                    </p>
                </div>
            )}

            {!loading && results && (
                <div className="flex-1 space-y-6 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 gap-6">
                        <VolatilityCard title="Daily Volatility" data={results.daily} />
                        <VolatilityCard title="Weekly Volatility" data={results.weekly} />
                        <VolatilityCard title="Monthly Volatility" data={results.monthly} />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-secondary/30 p-4 rounded-xl border border-border">
                        <span className="flex items-center gap-2"><Clock size={14} /> Analysis based on specific entry timeframe constraints.</span>
                        <span className="font-mono">Total records processed: {results.totalRows.toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
