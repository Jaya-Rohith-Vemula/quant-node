import { Skeleton } from './ui/Skeleton';
import type { ReactNode } from 'react';

interface StatCardProps {
    label: string;
    value: string;
    icon: ReactNode;
    trend?: boolean | null;
    negative?: boolean;
    loading?: boolean;
}

export function StatCard({ label, value, icon, trend, negative, loading }: StatCardProps) {
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
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${trend ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'}`}>
                            {trend ? 'BULLISH' : 'BEARISH'}
                        </span>
                    )
                )}
            </div>
            {loading ? (
                <Skeleton className="h-7 w-24" />
            ) : (
                <div className={`text-xl font-black tracking-tight ${negative ? 'text-red-400' : ''}`}>{value}</div>
            )}
        </div>
    );
}
