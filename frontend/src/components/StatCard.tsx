import { Skeleton } from './ui/Skeleton';
import type { ReactNode } from 'react';

interface StatCardProps {
    label: string;
    value: string;
    icon: ReactNode;
    trend?: boolean | null;
    trendValue?: string;
    negative?: boolean;
    loading?: boolean;
    subtitle?: string;
}

export function StatCard({ label, value, icon, trend, trendValue, negative, loading, subtitle }: StatCardProps) {
    return (
        <div className="p-5 rounded-2xl border border-border glass hover:border-border/60 transition-all group">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="bg-secondary p-1.5 rounded-lg text-muted-foreground group-hover:text-foreground transition-colors">
                        {icon}
                    </div>
                    <div className="text-muted-foreground text-[14px] font-bold uppercase tracking-widest">{label}</div>
                </div>
                {loading ? (
                    <Skeleton className="h-4 w-10 rounded-full" />
                ) : (
                    trend !== null && trend !== undefined && (
                        <span className={`text-[10px] md:text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${trend ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'}`}>
                            {trendValue && <span>{trendValue}</span>}
                            {!trendValue && (trend ? 'BULLISH' : 'BEARISH')}
                        </span>
                    )
                )}
            </div>
            {loading ? (
                <Skeleton className="h-7 w-24" />
            ) : (
                <>
                    <div className={`text-xl font-black tracking-tight ${negative ? 'text-red-400' : ''}`}>{value}</div>
                    {subtitle && <div className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-tighter truncate">{subtitle}</div>}
                </>
            )}
        </div>
    );
}
