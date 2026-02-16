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
    ChevronLeft
} from 'lucide-react';
import { Button } from './ui/button';

interface StrategyGuideProps {
    onBack: () => void;
}

export function StrategyGuide({ onBack }: StrategyGuideProps) {
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
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">Strategy <span className="text-primary">Guide</span></h1>
                </div>
                <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                    Understand the mathematical engine powering your backtest and how to interpret the results.
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
                            The Entry Logic (Buy)
                        </h3>
                        <p className="text-muted-foreground leading-relaxed relative z-10">
                            The algorithm follows a <strong>Grid-based Mean Reversion</strong> approach. It waits for the price to drop by a specific percentage before buying.
                        </p>
                        <ul className="mt-4 space-y-3 text-sm text-muted-foreground relative z-10">
                            <li className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span><strong>Initial Entry:</strong> Triggered when price falls from its 7-day high.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span><strong>Layering:</strong> Subsequent buys occur if the price drops further from the last trade price (buy or sell).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span><strong>Buy Size:</strong> Each purchase uses a fixed dollar amount ("Buy Size") rather than a fixed share count.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="p-6 rounded-3xl border border-border glass bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden group">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <ArrowUpCircle className="text-green-400" size={20} />
                            The Exit Logic (Sell)
                        </h3>
                        <p className="text-muted-foreground leading-relaxed relative z-10">
                            Each buy "lot" is tracked independently. This allows the strategy to take profits on early layers even if later layers are still underwater.
                        </p>
                        <ul className="mt-4 space-y-3 text-sm text-muted-foreground relative z-10">
                            <li className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span><strong>Profit Target:</strong> A sell order is executed for a specific lot once it reaches your "Up" percentage target.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span><strong>Realized Profit:</strong> Only closed trades contribute to your realized profit metric.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Parameters Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <Target className="text-primary" size={24} />
                    <h2 className="text-2xl font-bold tracking-tight">Understanding Parameters</h2>
                </div>

                <div className="space-y-4">
                    {[
                        {
                            label: "Grid Step (Down %)",
                            desc: "The percentage drop required to trigger a new buy. Smaller steps lead to more frequent buying but require more cash to sustain deep drawdowns.",
                            icon: <ArrowDownCircle size={18} className="text-red-400" />
                        },
                        {
                            label: "Profit Target (Up %)",
                            desc: "The percentage gain required to sell an individual lot. Larger targets capture more profit per trade but may result in fewer successfully closed positions.",
                            icon: <ArrowUpCircle size={18} className="text-green-400" />
                        },
                        {
                            label: "Buy Size",
                            desc: "The fixed dollar amount spent on each purchase. This determines how quickly your 'Available Cash' is deployed into the market.",
                            icon: <DollarSign size={18} className="text-blue-400" />
                        },
                        {
                            label: "Initial Balance",
                            desc: "Your total starting capital. The simulation will stop buying if your 'Available Cash' runs out.",
                            icon: <ShieldCheck size={18} className="text-primary" />
                        }
                    ].map((item, i) => (
                        <div key={i} className="flex gap-4 p-5 rounded-2xl border border-border hover:bg-secondary/30 transition-colors">
                            <div className="mt-1">{item.icon}</div>
                            <div className="space-y-1">
                                <h4 className="font-bold">{item.label}</h4>
                                <p className="text-sm text-muted-foreground">{item.desc}</p>
                            </div>
                        </div>
                    ))}
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
                    <div className="p-6 rounded-2xl border border-border space-y-3">
                        <h4 className="font-bold flex items-center gap-2">
                            <DollarSign size={16} className="text-green-400" />
                            Total Profit
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            The sum of all realized gains from closed 'Buy-Sell' cycles. This does not include paper gains or losses from unsold shares.
                        </p>
                    </div>
                    <div className="p-6 rounded-2xl border border-border space-y-3">
                        <h4 className="font-bold flex items-center gap-2">
                            <Layers size={16} className="text-orange-400" />
                            Avg Cost Basis
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            The average price of all shares you are currently holding. If the market price is above this, your 'Unsold Shares' are in profit.
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
