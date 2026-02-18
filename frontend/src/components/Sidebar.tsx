import { useState } from 'react';
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

interface SidebarProps {
    params: BacktestParams;
    loading: boolean;
    onParamChange: (key: string, value: any) => void;
    onResetParams: () => void;
    onNavigateHome: () => void;
    onRunBacktest: () => void;
    mobileOpen?: boolean;
    setMobileOpen?: (open: boolean) => void;
}

export function Sidebar({ params, loading, onParamChange, onResetParams, onNavigateHome, onRunBacktest, mobileOpen, setMobileOpen }: SidebarProps) {
    const [startDateOpen, setStartDateOpen] = useState(false);
    const [endDateOpen, setEndDateOpen] = useState(false);

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
                        Strategy Parameters
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

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">Ticker Symbol</label>
                        <Select
                            value={params.symbol}
                            onValueChange={(val) => onParamChange('symbol', val)}
                        >
                            <SelectTrigger className="w-full bg-secondary/50 border border-border h-10 text-sm font-mono mb-2 focus:ring-1 focus:ring-primary text-foreground">
                                <SelectValue placeholder="Select Symbol" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                                <SelectItem value="SOFI">SOFI</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

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
                </div>

                <ParameterSlider
                    label="Initial Balance"
                    value={params.initialBalance}
                    min={1000}
                    max={100000}
                    step={1000}
                    unit="$"
                    onChange={(v) => onParamChange('initialBalance', v)}
                />
                <ParameterSlider
                    label="Grid Step (Down)"
                    value={params.moveDownPercent}
                    min={0.5}
                    max={20}
                    step={0.5}
                    unit="%"
                    onChange={(v) => onParamChange('moveDownPercent', v)}
                />
                <ParameterSlider
                    label="Profit Target (Up)"
                    value={params.moveUpPercent}
                    min={1}
                    max={30}
                    step={0.5}
                    unit="%"
                    onChange={(v) => onParamChange('moveUpPercent', v)}
                />
                <ParameterSlider
                    label="Buy Size"
                    value={params.amountToBuy}
                    min={100}
                    max={10000}
                    step={100}
                    unit="$"
                    onChange={(v) => onParamChange('amountToBuy', v)}
                />

                <button
                    onClick={onRunBacktest}
                    disabled={loading}
                    className="w-full mt-6 bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl cursor-pointer"
                >
                    {loading ? (
                        <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
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
