import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Settings,
    Calendar as CalendarIcon,
    Play,
    LineChart,
    X,
    RotateCcw
} from 'lucide-react';
import { ModeToggle } from './ModeToggle';
import { format } from "date-fns";
import { ParameterSlider } from './ParameterSlider';
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { cn } from "../lib/utils";
import type { BacktestParams } from '../types';
import { STRATEGIES } from '../strategies';

interface SidebarProps {
    mode: 'strategies' | 'volatility';
    setMode: (mode: 'strategies' | 'volatility') => void;
    params: BacktestParams;
    loading: boolean;
    onParamChange: (key: string, value: any) => void;
    onResetParams: () => void;
    onNavigateHome: () => void;
    onRunBacktest: () => void;
    availableSymbols?: string[];
    symbolsLoading?: boolean;
    mobileOpen?: boolean;
    setMobileOpen?: (open: boolean) => void;
    onRunAnalysis?: () => void;
}

const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};

const minutesToTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export function Sidebar({ mode, setMode, params, loading, availableSymbols = [], symbolsLoading = false, onParamChange, onResetParams, onNavigateHome, onRunBacktest, onRunAnalysis, mobileOpen, setMobileOpen }: SidebarProps) {
    const [startDateOpen, setStartDateOpen] = useState(false);
    const [endDateOpen, setEndDateOpen] = useState(false);
    const navigate = useNavigate();

    const isVolatility = mode === 'volatility';

    return (
        <aside className={cn(
            "fixed inset-y-0 left-0 z-50 w-80 lg:relative lg:flex lg:z-20 border-r border-border flex-col bg-background lg:bg-transparent lg:glass overflow-y-auto flex-shrink-0 transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
            <div className="p-6 border-b border-border flex items-center justify-between">
                <button
                    onClick={onNavigateHome}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity active:scale-[0.98] group"
                >
                    <div className="bg-primary/20 p-2 rounded-lg group-hover:bg-primary/30 transition-colors cursor-pointer">
                        <LineChart className="text-primary" size={20} />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground cursor-pointer">Quant Node</h1>
                </button>
                <div className="flex items-center gap-2 lg:hidden">
                    <ModeToggle />
                    {setMobileOpen && (
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6 space-y-2">

                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest font-mono">
                        <Settings size={14} />
                        {isVolatility ? "Analysis Parameters" : "Strategy Parameters"}
                    </div>
                    <button
                        onClick={onResetParams}
                        className="text-[10px] font-bold uppercase tracking-tighter text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                        title="Reset to default parameters"
                    >
                        <RotateCcw size={12} />
                        Reset
                    </button>
                </div>

                <div className="space-y-4 mb-4">
                    <div className="space-y-2">
                        <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">Mode</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode('strategies')}
                                className={cn(
                                    "flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                                    mode === 'strategies'
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                                )}
                            >
                                Strategies
                            </button>
                            <button
                                onClick={() => setMode('volatility')}
                                className={cn(
                                    "flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                                    mode === 'volatility'
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                                )}
                            >
                                Analysis
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">Ticker Symbol</label>
                        <Select
                            value={params.symbol}
                            onValueChange={(val) => onParamChange('symbol', val)}
                            disabled={symbolsLoading}
                        >
                            <SelectTrigger className="w-full bg-secondary/50 border border-border h-10 text-sm font-mono mb-2 focus:ring-1 focus:ring-primary text-foreground">
                                {symbolsLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 border-2 border-primary/30 border-t-primary animate-spin rounded-full" />
                                        <span className="text-muted-foreground">Loading symbols...</span>
                                    </div>
                                ) : (
                                    <SelectValue placeholder="Select Symbol" />
                                )}
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                                {availableSymbols.map((symbol) => (
                                    <SelectItem key={symbol} value={symbol}>
                                        {symbol}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {!isVolatility && (
                        <div className="space-y-1">
                            <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">Strategy Type</label>
                            <Select
                                value={params.strategyType}
                                onValueChange={(val) => {
                                    onParamChange('strategyType', val);
                                    const strategy = STRATEGIES.find(s => s.id === val);
                                    if (strategy) {
                                        const defaults: Record<string, any> = {};
                                        strategy.parameters.forEach(p => defaults[p.key] = p.defaultValue);
                                        onParamChange('strategyParams', defaults);
                                    }
                                }}
                            >
                                <SelectTrigger className="w-full bg-secondary/50 border border-border h-10 text-sm font-mono mb-2 focus:ring-1 focus:ring-primary text-foreground">
                                    <SelectValue placeholder="Select Strategy" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                    {STRATEGIES.filter(s => !s.isHidden).map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {!isVolatility && (
                        <div className="space-y-1">
                            <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">Simulation Timeframe</label>
                            <Select
                                value={params.timeframe || '1m'}
                                onValueChange={(val) => onParamChange('timeframe', val)}
                            >
                                <SelectTrigger className="w-full bg-secondary/50 border border-border h-10 text-sm font-mono mb-2 focus:ring-1 focus:ring-primary text-foreground">
                                    <SelectValue placeholder="Select Timeframe" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                    <SelectItem value="1m">1 Minute</SelectItem>
                                    <SelectItem value="5m">5 Minutes</SelectItem>
                                    <SelectItem value="15m">15 Minutes</SelectItem>
                                    <SelectItem value="1h">1 Hour</SelectItem>
                                    <SelectItem value="1d">1 Day (Daily)</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex justify-end px-1">
                                <button
                                    onClick={() => {
                                        if (setMobileOpen) setMobileOpen(false);
                                        navigate('/how-it-works');
                                    }}
                                    className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all hover:gap-2 group"
                                >
                                    How it works
                                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 pb-4">
                        <div className="space-y-1">
                            <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">Start Date</label>
                            <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal bg-secondary/50 border-white/5 h-10 text-xs font-mono rounded-lg hover:bg-secondary/70 transition-colors",
                                            !params.startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                        {params.startDate ? format(new Date(params.startDate + 'T00:00:00'), "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={new Date(params.startDate + 'T00:00:00')}
                                        defaultMonth={new Date(params.startDate + 'T00:00:00')}
                                        onSelect={(date) => {
                                            if (date) {
                                                onParamChange('startDate', format(date, "yyyy-MM-dd"));
                                                setStartDateOpen(false);
                                            }
                                        }}
                                        captionLayout="dropdown"
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">End Date</label>
                            <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal bg-secondary/50 border-white/5 h-10 text-xs font-mono rounded-lg hover:bg-secondary/70 transition-colors",
                                            !params.endDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                        {params.endDate ? format(new Date(params.endDate + 'T00:00:00'), "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={new Date(params.endDate + 'T00:00:00')}
                                        defaultMonth={new Date(params.endDate + 'T00:00:00')}
                                        onSelect={(date) => {
                                            if (date) {
                                                onParamChange('endDate', format(date, "yyyy-MM-dd"));
                                                setEndDateOpen(false);
                                            }
                                        }}
                                        captionLayout="dropdown"
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {isVolatility && (
                        <div className="space-y-2 mt-4">
                            <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight flex items-center justify-between">
                                Time Filter
                                <input
                                    type="checkbox"
                                    checked={params.marketHoursOnly}
                                    onChange={(e) => onParamChange('marketHoursOnly', e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-border text-primary cursor-pointer focus:ring-primary"
                                />
                            </label>
                            <div className={cn("flex flex-col transition-opacity px-1", !params.marketHoursOnly && "opacity-50 pointer-events-none")}>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Start Time</span>
                                        <span className="text-foreground font-mono font-bold">{params.startTime}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">End Time</span>
                                        <span className="text-foreground font-mono font-bold">{params.endTime}</span>
                                    </div>
                                </div>
                                <Slider
                                    min={240} // 04:00
                                    max={1200} // 20:00
                                    step={30} // 30 mins
                                    value={[timeToMinutes(params.startTime || '09:30'), timeToMinutes(params.endTime || '16:00')]}
                                    onValueChange={(vals) => {
                                        onParamChange('startTime', minutesToTime(vals[0]));
                                        onParamChange('endTime', minutesToTime(vals[1]));
                                    }}
                                    className="mb-2"
                                />
                            </div>
                            <div className="flex justify-end px-1 mt-2">
                                <button
                                    onClick={() => {
                                        if (setMobileOpen) setMobileOpen(false);
                                        navigate('/how-it-works');
                                    }}
                                    className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all hover:gap-2 group"
                                >
                                    How it works
                                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {!isVolatility && (
                    <ParameterSlider
                        label="Initial Balance"
                        value={params.initialBalance}
                        min={1000}
                        max={100000}
                        step={1000}
                        unit="$"
                        onChange={(v) => onParamChange('initialBalance', v)}
                    />
                )}

                {!isVolatility && STRATEGIES.find(s => s.id === params.strategyType)?.parameters.map((p) => {
                    const value = params.strategyParams[p.key] ?? p.defaultValue;

                    if (p.type === 'select' && p.options) {
                        return (
                            <div key={p.key} className="space-y-1 mb-4">
                                <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">{p.label}</label>
                                <Select
                                    value={value}
                                    onValueChange={(val) => onParamChange(`strategyParams.${p.key}`, val)}
                                >
                                    <SelectTrigger className="w-full bg-secondary/50 border border-border h-10 text-xs font-mono mb-2 focus:ring-1 focus:ring-primary text-foreground">
                                        <SelectValue placeholder={`Select ${p.label}`} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        {p.options.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        );
                    }

                    if (p.type === 'toggle') {
                        return (
                            <div key={p.key} className="space-y-1 mb-4">
                                <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">{p.label}</label>
                                <Select
                                    value={value.toString()}
                                    onValueChange={(val) => onParamChange(`strategyParams.${p.key}`, parseInt(val))}
                                >
                                    <SelectTrigger className="w-full bg-secondary/50 border border-border h-10 text-xs font-mono mb-2 focus:ring-1 focus:ring-primary text-foreground text-left">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        <SelectItem value="1">Enabled</SelectItem>
                                        <SelectItem value="0">Disabled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        );
                    }

                    return (
                        <ParameterSlider
                            key={p.key}
                            label={p.label}
                            value={value}
                            min={p.min ?? 0}
                            max={p.max ?? 100}
                            step={p.step ?? 1}
                            unit={p.unit ?? ''}
                            onChange={(v) => onParamChange(`strategyParams.${p.key}`, v)}
                        />
                    );
                })}

                <button
                    onClick={isVolatility ? onRunAnalysis : onRunBacktest}
                    disabled={loading}
                    className="w-full mt-6 bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl cursor-pointer"
                >
                    {loading ? (
                        <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
                    ) : isVolatility ? (
                        <>
                            <LineChart size={18} fill="currentColor" />
                            Analyze
                        </>
                    ) : (
                        <>
                            <Play size={18} fill="currentColor" />
                            Run Simulation
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
}
