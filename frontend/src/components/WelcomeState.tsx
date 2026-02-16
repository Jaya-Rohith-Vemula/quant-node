import { LineChart, Zap, BarChart3, MousePointer2 } from 'lucide-react';
import { FeatureCard } from './FeatureCard';

export function WelcomeState() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-700">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
                <div className="relative bg-secondary/30 p-8 rounded-3xl border border-border glass">
                    <LineChart size={64} className="text-primary animate-pulse" />
                </div>
            </div>

            <div className="space-y-3 max-w-md">
                <h2 className="text-4xl font-black tracking-tight">Welcome to Quant Node</h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                    The ultimate grid trading backtester. Configure your strategy parameters on the left and hit <span className="text-primary font-bold">Run Simulation</span> to analyze market behavior.
                </p>
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
