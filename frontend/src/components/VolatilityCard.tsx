import { useState } from 'react';
import { CalendarDays, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export interface VolatilityData {
    period: string;
    low: number;
    high: number;
    lowTime: string;
    highTime: string;
    open: number;
    close: number;
    openTime: string;
    closeTime: string;
}

export interface PeriodResult {
    periodsCount: number;
    allPeriods: VolatilityData[];
}

const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[1]}-${parts[2]}-${parts[0]}`;
    }
    if (parts.length === 2) {
        return `${parts[1]}-${parts[0]}`;
    }
    return dateStr;
};

const getMetricVal = (p: VolatilityData, key: string): number => {
    if (!p) return 0;
    const open = p.open || 0;
    const high = p.high || 0;
    const low = p.low || 0;
    const close = p.close || 0;

    switch (key) {
        case 'openHighPct': return open > 0 ? Math.abs((high - open) / open) * 100 : 0;
        case 'highClosePct': return high > 0 ? Math.abs((close - high) / high) * 100 : 0;
        case 'openLowPct': return open > 0 ? Math.abs((low - open) / open) * 100 : 0;
        case 'lowClosePct': return low > 0 ? Math.abs((close - low) / low) * 100 : 0;
        case 'openClosePct': return open > 0 ? Math.abs((close - open) / open) * 100 : 0;
        case 'volatilityPct':
        default: return low > 0 ? ((high - low) / low) * 100 : 0;
    }
};

const VolatilityDetail = ({ label, volatility, timeFormat, metricKey }: { label: string, volatility: VolatilityData, timeFormat: string, metricKey: string }) => {
    const pct = getMetricVal(volatility, metricKey);
    return (
        <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1 flex items-center justify-between">
                {label}
                <span className="text-xs uppercase bg-gray-500/20 px-2 py-0.5 rounded-full">{formatDateStr(volatility.period)}</span>
            </p>
            <p className="text-2xl font-black ">
                {pct.toFixed(2)}%
            </p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p><span className="text-foreground font-mono">Open: ${(volatility.open || 0).toFixed(2)}</span> at {format(new Date(volatility.openTime.replace(' ', 'T')), timeFormat)}</p>
                <p><span className="text-foreground font-mono">Low: ${(volatility.low || 0).toFixed(2)}</span> at {format(new Date(volatility.lowTime.replace(' ', 'T')), timeFormat)}</p>
                <p><span className="text-foreground font-mono">High: ${(volatility.high || 0).toFixed(2)}</span> at {format(new Date(volatility.highTime.replace(' ', 'T')), timeFormat)}</p>
                <p><span className="text-foreground font-mono">Close: ${(volatility.close || 0).toFixed(2)}</span> at {format(new Date(volatility.closeTime.replace(' ', 'T')), timeFormat)}</p>
            </div>
        </div>
    );
};

export interface FilterCondition {
    id: string;
    metricKey: string;
    operator: '>' | '<' | '=';
    targetPct: string;
}

export const VolatilityCard = ({ title, data }: { title: string, data: PeriodResult | null }) => {
    const [metricKey, setMetricKey] = useState<string>('volatilityPct');
    const [filters, setFilters] = useState<FilterCondition[]>([
        { id: '1', metricKey: 'volatilityPct', operator: '<', targetPct: '1.0' }
    ]);
    const [showDetails, setShowDetails] = useState(false);

    if (!data || !data.allPeriods || data.allPeriods.length === 0) return null;

    const timeFormat = title === 'Daily Volatility' ? 'HH:mm' : 'MMM d, yyyy, HH:mm';

    const addFilter = () => {
        setFilters([...filters, { id: Math.random().toString(36).substring(7), metricKey: 'volatilityPct', operator: '<', targetPct: '1.0' }]);
    };

    const updateFilter = (id: string, field: keyof FilterCondition, value: string) => {
        setFilters(filters.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const removeFilter = (id: string) => {
        setFilters(filters.filter(f => f.id !== id));
    };

    let sum = 0;
    let max = data.allPeriods[0];
    let min = data.allPeriods[0];
    
    for (const p of data.allPeriods) {
        const val = getMetricVal(p, metricKey);
        sum += val;
        if (val > getMetricVal(max, metricKey)) max = p;
        if (val < getMetricVal(min, metricKey)) min = p;
    }
    
    const computedSummary = {
        averageVolatility: sum / data.allPeriods.length,
        maxVolatility: max,
        minVolatility: min,
    };

    const filteredPeriods = data.allPeriods.filter(p => {
        if (filters.length === 0) return true;
        return filters.every(f => {
            const pct = getMetricVal(p, f.metricKey);
            const targetValue = parseFloat(f.targetPct) || 0;
            if (f.operator === '>') return pct > targetValue;
            if (f.operator === '<') return pct < targetValue;
            return Math.abs(pct - targetValue) < 0.1; // fuzzy match for float equal
        });
    });

    return (
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border/50 pb-2 gap-4">
                <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
                    <CalendarDays size={18} />
                    {title} ({data.periodsCount} periods)
                </h3>
                <Select value={metricKey} onValueChange={setMetricKey}>
                    <SelectTrigger className="w-[180px] bg-secondary/50 border-border h-8 text-xs font-bold focus:ring-1 focus:ring-primary uppercase tracking-wider">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                        <SelectItem value="volatilityPct">High to Low</SelectItem>
                        <SelectItem value="openHighPct">Open to High</SelectItem>
                        <SelectItem value="highClosePct">High to Close</SelectItem>
                        <SelectItem value="openLowPct">Open to Low</SelectItem>
                        <SelectItem value="lowClosePct">Low to Close</SelectItem>
                        <SelectItem value="openClosePct">Open to Close</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border/30 pb-4">
                <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Avg Volatility</p>
                    <p className="text-2xl font-black ">
                        {computedSummary.averageVolatility.toFixed(2)}%
                    </p>
                </div>

                <VolatilityDetail label="Maximum" volatility={computedSummary.maxVolatility} timeFormat={timeFormat} metricKey={metricKey} />
                <VolatilityDetail label="Minimum" volatility={computedSummary.minVolatility} timeFormat={timeFormat} metricKey={metricKey} />
            </div>

            <div className="bg-background/30 rounded-lg p-4 border border-border/30">
                <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground w-full xl:w-auto">Filters</span>
                    
                    <div className="flex flex-col gap-2 w-full xl:flex-1">
                        {filters.length === 0 && (
                            <div className="text-sm text-muted-foreground italic">No filters applied.</div>
                        )}
                        {filters.map((f) => (
                            <div key={f.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                <Select value={f.metricKey} onValueChange={(val) => updateFilter(f.id, 'metricKey', val)}>
                                    <SelectTrigger className="w-[160px] bg-secondary/50 border-border h-9 text-xs font-bold focus:ring-1 focus:ring-primary uppercase tracking-wider">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        <SelectItem value="volatilityPct">High to Low</SelectItem>
                                        <SelectItem value="openHighPct">Open to High</SelectItem>
                                        <SelectItem value="highClosePct">High to Close</SelectItem>
                                        <SelectItem value="openLowPct">Open to Low</SelectItem>
                                        <SelectItem value="lowClosePct">Low to Close</SelectItem>
                                        <SelectItem value="openClosePct">Open to Close</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={f.operator} onValueChange={(val: any) => updateFilter(f.id, 'operator', val)}>
                                    <SelectTrigger className="w-[140px] bg-secondary/50 border-border h-9 text-sm font-bold focus:ring-1 focus:ring-primary">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        <SelectItem value=">">Greater Than (&gt;)</SelectItem>
                                        <SelectItem value="<">Lesser Than (&lt;)</SelectItem>
                                        <SelectItem value="=">Equal To (=)</SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={f.targetPct}
                                        onChange={(e) => updateFilter(f.id, 'targetPct', e.target.value)}
                                        className="w-24 bg-secondary/50 border border-border rounded-lg h-9 pl-3 pr-6 text-sm font-bold focus:ring-1 focus:ring-primary outline-none transition-colors"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">%</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeFilter(f.id)}
                                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                >
                                    <X size={16} />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center xl:ml-auto w-full xl:w-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={addFilter}
                            className="h-9 border-border/50 hover:bg-secondary/70 text-xs font-bold uppercase tracking-widest flex items-center gap-1 w-full sm:w-auto"
                        >
                            <Plus size={14} /> Add Filter
                        </Button>

                        <div className="flex justify-center items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-lg font-mono font-bold text-sm w-full sm:w-auto shrink-0">
                            <span>{filteredPeriods.length}</span>
                            <span className="text-primary/70 font-sans text-xs">
                                / {data.periodsCount} ({((filteredPeriods.length / data.periodsCount) * 100).toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                </div>

                {filteredPeriods.length > 0 ? (
                    <div className="space-y-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowDetails(!showDetails)}
                            className="w-full text-xs font-bold uppercase tracking-widest border border-border/50 hover:bg-secondary/70 h-8"
                        >
                            {showDetails ? "Hide Matching Periods" : "View Matching Periods Details"}
                        </Button>

                        {showDetails && (
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                                {filteredPeriods.map((p, i) => (
                                    <div key={i} className="bg-background/80 p-3 rounded-lg border border-border/50 flex flex-col xl:flex-row xl:items-center justify-between gap-3 hover:bg-background transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold bg-secondary/50 px-2 py-1 rounded-md text-foreground">{formatDateStr(p.period)}</span>
                                            <span className="font-bold text-primary font-mono">{getMetricVal(p, metricKey).toFixed(2)}%</span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-mono bg-secondary/20 p-2 rounded-md">
                                            <span>O: {(p.open || 0).toFixed(2)}</span>
                                            <span>H: {(p.high || 0).toFixed(2)}</span>
                                            <span>L: {(p.low || 0).toFixed(2)}</span>
                                            <span>C: {(p.close || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-sm text-muted-foreground py-4 bg-secondary/10 rounded-lg border border-border/20">
                        No periods match the selected criteria.
                    </div>
                )}
            </div>
        </div>
    );
};
