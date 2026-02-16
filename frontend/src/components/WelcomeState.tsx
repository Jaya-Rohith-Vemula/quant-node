import { LineChart, Settings, Zap, BarChart3, MousePointer2, BookOpen } from 'lucide-react';
import { FeatureCard } from './FeatureCard';

interface WelcomeStateProps {
    onOpenSidebar: () => void;
    onNavigateToGuide: () => void;
}

export function WelcomeState({ onOpenSidebar, onNavigateToGuide }: WelcomeStateProps) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-700 py-12">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
                <div className="relative bg-secondary/30 p-8 rounded-3xl border border-border glass">
                    <LineChart size={64} className="text-primary animate-pulse" />
                </div>
            </div>

            <div className="space-y-4 max-w-md">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight">Welcome to Quant Node</h2>
                <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                    The ultimate grid trading backtester. Configure your strategy parameters and hit <span className="text-primary font-bold">Run Simulation</span> to analyze market behavior.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                    <button
                        onClick={onOpenSidebar}
                        className="lg:hidden w-full sm:w-auto px-8 bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] cursor-pointer"
                    >
                        <Settings size={18} />
                        Start Configuring
                    </button>
                    <button
                        onClick={onNavigateToGuide}
                        className="w-full sm:w-auto px-8 bg-secondary/50 backdrop-blur-md text-foreground font-bold py-3.5 rounded-2xl border border-border/50 flex items-center justify-center gap-2 hover:bg-secondary/80 active:scale-95 transition-all shadow-sm group cursor-pointer"
                    >
                        <BookOpen size={18} className="text-primary group-hover:rotate-12 transition-transform" />
                        Learn How it Works
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
                <FeatureCard
                    icon={<Zap size={20} className="text-yellow-400" />}
                    title="Flash Backtesting"
                    desc="Analyze years of historical data in milliseconds."
                />
                <FeatureCard
                    icon={<BarChart3 size={20} className="text-blue-400" />}
                    title="Deep Insights"
                    desc="Track drawdown, equity curves, and profit metrics."
                />
                <FeatureCard
                    icon={<MousePointer2 size={20} className="text-purple-400" />}
                    title="Interactive UI"
                    desc="Modify parameters on the fly and see instant updates."
                />
            </div>
        </div>
    );
}
