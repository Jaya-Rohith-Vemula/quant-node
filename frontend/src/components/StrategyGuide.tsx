import {
    BookOpen,
    ArrowDownCircle,
    ArrowUpCircle,
    ShieldCheck,
    BarChart3,
    Info,
    Layers,
    Target,
    DollarSign,
    TrendingDown,
    ChevronLeft,
    Lightbulb
} from 'lucide-react';
import { Button } from './ui/button';
import { STRATEGIES } from '../strategies';

interface StrategyGuideProps {
    strategyId: string;
    onBack: () => void;
}

export function StrategyGuide({ strategyId, onBack }: StrategyGuideProps) {
    const strategy = STRATEGIES.find(s => s.id === strategyId) || STRATEGIES[0];

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="space-y-4">
                <Button
                    variant="ghost"
                    onClick={onBack}
                    className="group -ml-4 text-muted-foreground hover:text-primary transition-colors mb-4 cursor-pointer"
                >
                    <ChevronLeft className="mr-2 group-hover:-translate-x-1 transition-transform " size={20} />
                    Back to Simulator
                </Button>

                <div className="flex items-center gap-4 mb-2">
                    <div className="bg-primary/20 p-3 rounded-2xl shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                        <BookOpen className="text-primary" size={20} />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">{strategy.name} <span className="text-primary">Guide</span></h1>
                </div>
                <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                    {strategy.description}
                </p>
            </div>

            {/* Core Logic Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <Layers className="text-primary" size={24} />
                    <h2 className="text-2xl font-bold tracking-tight">How the Strategy Works</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-3xl border border-border glass bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden group">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <ArrowDownCircle className="text-red-400" size={20} />
                            Entry Logic (Buy)
                        </h3>
                        <p className="text-muted-foreground leading-relaxed relative z-10">
                            {strategy.guide.entry}
                        </p>
                    </div>

                    <div className="p-6 rounded-3xl border border-border glass bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden group">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <ArrowUpCircle className="text-green-400" size={20} />
                            Exit Logic (Sell)
                        </h3>
                        <p className="text-muted-foreground leading-relaxed relative z-10">
                            {strategy.guide.exit}
                        </p>
                    </div>
                </div>

                <div className="p-6 rounded-3xl border border-primary/20 bg-primary/5 relative overflow-hidden">
                    <div className="flex items-start gap-4">
                        <div className="bg-primary/20 p-2 rounded-xl mt-1">
                            <Lightbulb className="text-primary" size={20} />
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold text-lg text-primary">Pro Tip</h4>
                            <p className="text-muted-foreground leading-relaxed italic">
                                "{strategy.guide.tip}"
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Parameters Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <Target className="text-primary" size={24} />
                    <h2 className="text-2xl font-bold tracking-tight">{strategy.name} Parameters</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {strategy.parameters.map((p, i) => (
                        <div key={i} className="flex gap-4 p-5 rounded-2xl border border-border hover:bg-secondary/30 transition-colors">
                            <div className="mt-1">
                                {p.unit === '%' ? <TrendingDown size={18} className="text-red-400" /> : <DollarSign size={18} className="text-blue-400" />}
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-bold">{p.label}</h4>
                                <p className="text-sm text-muted-foreground">Adjusts the {p.label.toLowerCase()} for the simulation.</p>
                            </div>
                        </div>
                    ))}
                    <div className="flex gap-4 p-5 rounded-2xl border border-border hover:bg-secondary/30 transition-colors">
                        <div className="mt-1">
                            <ShieldCheck size={18} className="text-primary" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-bold">Initial Balance</h4>
                            <p className="text-sm text-muted-foreground">Your total starting capital for the backtest.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Performance Stats Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <BarChart3 className="text-primary" size={24} />
                    <h2 className="text-2xl font-bold tracking-tight">Interpreting Results</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 rounded-2xl border border-border space-y-3">
                        <h4 className="font-bold flex items-center gap-2">
                            <Info size={16} className="text-primary" />
                            Total Net Worth
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            Your current account value, calculating both remaining cash and the current market value of all unsold shares at the end of the period.
                        </p>
                    </div>
                    <div className="p-6 rounded-2xl border border-border space-y-3">
                        <h4 className="font-bold flex items-center gap-2">
                            <TrendingDown size={16} className="text-red-400" />
                            Max Drawdown
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            The largest percentage drop your portfolio experienced from its highest peak. A critical measure of risk.
                        </p>
                    </div>
                </div>
            </section>

            {/* Call to action */}
            <div className="p-8 rounded-[2rem] bg-primary/10 border border-primary/20 flex flex-col items-center text-center space-y-4">
                <h3 className="text-2xl font-bold italic tracking-tight">"The trend is your friend, but the cycle is your alpha."</h3>
                <p className="text-muted-foreground max-w-md">
                    Ready to put these concepts to the test? Use the sidebar to tweak your parameters and find the optimal configuration for your chosen asset.
                </p>
                <Button onClick={onBack} size="lg" className="rounded-xl px-8 font-bold cursor-pointer">
                    Back to Simulator
                </Button>
            </div>
        </div>
    );
}
