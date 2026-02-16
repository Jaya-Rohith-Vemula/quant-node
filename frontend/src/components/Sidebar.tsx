import {
    Settings,
    Activity,
    Calendar as CalendarIcon,
    Play
} from 'lucide-react';
import { format } from "date-fns";
import { ParameterSlider } from './ParameterSlider';
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./ui/popover";
import { cn } from "../lib/utils";
import type { BacktestParams } from '../types';

interface SidebarProps {
    params: BacktestParams;
    loading: boolean;
    onParamChange: (key: string, value: any) => void;
    onRunBacktest: () => void;
}

export function Sidebar({ params, loading, onParamChange, onRunBacktest }: SidebarProps) {
    return (
        <aside className="w-80 border-r border-white/10 flex flex-col glass overflow-y-auto flex-shrink-0 relative z-20">
            <div className="p-6 border-b border-white/10 flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-lg">
                    <Activity className="text-primary" size={20} />
                </div>
                <h1 className="text-xl font-bold tracking-tight">Quant Node</h1>
            </div>

            <div className="p-6 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 font-mono">
                    <Settings size={14} />
                    Strategy Parameters
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">Ticker Symbol</label>
                        <input
                            type="text"
                            value={params.symbol}
                            onChange={(e) => onParamChange('symbol', e.target.value.toUpperCase())}
                            placeholder="e.g. SOFI"
                            className="w-full bg-secondary/50 border border-white/5 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono mb-2 placeholder:text-muted-foreground/30"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 pb-4">
                        <div className="space-y-1">
                            <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">Start Date</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal bg-secondary/50 border-white/5 h-10 text-xs font-mono rounded-lg hover:bg-secondary/70 transition-colors",
                                            !params.startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                        {params.startDate ? format(new Date(params.startDate + 'T00:00:00'), "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-black border-white/10" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={new Date(params.startDate + 'T00:00:00')}
                                        onSelect={(date) => date && onParamChange('startDate', format(date, "yyyy-MM-dd"))}
                                        captionLayout="dropdown"
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[12px] text-muted-foreground uppercase font-bold px-1 font-mono tracking-tight">End Date</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal bg-secondary/50 border-white/5 h-10 text-xs font-mono rounded-lg hover:bg-secondary/70 transition-colors",
                                            !params.endDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                        {params.endDate ? format(new Date(params.endDate + 'T00:00:00'), "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-black border-white/10" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={new Date(params.endDate + 'T00:00:00')}
                                        onSelect={(date) => date && onParamChange('endDate', format(date, "yyyy-MM-dd"))}
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
                    label="Initial Drop"
                    value={params.initialDropPercent}
                    min={1}
                    max={50}
                    unit="%"
                    onChange={(v) => onParamChange('initialDropPercent', v)}
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
                    className="w-full mt-6 bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(0,255,122,0.2)]"
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
