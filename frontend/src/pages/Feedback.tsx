import { useState } from 'react';
import { ChevronLeft, MessageSquare, Zap, Search, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

interface FeedbackProps {
    onBack: () => void;
}

export function Feedback({ onBack }: FeedbackProps) {
    const [submitted, setSubmitted] = useState<string | null>(null);
    const [loading, setLoading] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, type: string) => {
        e.preventDefault();
        setLoading(type);

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type,
                    ...data,
                    timestamp: new Date().toISOString()
                }),
            });

            if (!response.ok) throw new Error('Failed to submit feedback');

            setSubmitted(type);
            (e.target as HTMLFormElement).reset();

            // Revert success state after 3 seconds
            setTimeout(() => setSubmitted(null), 3000);
        } catch (error) {
            console.error('Submission failed:', error);
            alert('Something went wrong. Please try again later.');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 pb-8 animate-in fade-in duration-500">
            {/* Header */}
            <header className="mb-12">
                <Button
                    variant="ghost"
                    onClick={onBack}
                    className="group -ml-4 text-muted-foreground hover:text-primary transition-colors mb-4 cursor-pointer"
                >
                    <ChevronLeft className="mr-2 group-hover:-translate-x-1 transition-transform " size={20} />
                    Back to Simulator
                </Button>
                <h1 className="text-4xl font-black tracking-tight">Community Feedback</h1>
                <p className="text-muted-foreground mt-2 text-lg">Help us shape the future of Quant Node. Your input is invaluable.</p>
            </header>

            <div className="grid gap-8">
                {/* Form 1: App Updates */}
                <section className="p-8 rounded-3xl border border-border glass relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <MessageSquare size={120} />
                    </div>

                    <div className="flex items-center gap-3 mb-6 relative">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <MessageSquare className="text-blue-500" size={20} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">App Update Suggestions</h2>
                            <p className="text-sm text-muted-foreground font-medium">New features, UI improvements, or general workflow changes.</p>
                        </div>
                    </div>

                    <form onSubmit={(e) => handleSubmit(e, 'update')} className="space-y-4 relative">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Suggestion Title</label>
                            <Input
                                name="title"
                                required
                                placeholder="e.g., Dark Mode Improvements, Custom Layouts..."
                                className="bg-secondary/30 border-white/5 h-12 focus:ring-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Description</label>
                            <textarea
                                name="description"
                                required
                                rows={4}
                                placeholder="Describe your idea in detail..."
                                className="w-full bg-secondary/30 border border-white/5 rounded-xl p-4 text-sm focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={loading === 'update'}
                            className={cn(
                                "w-full h-12 font-bold tracking-wide transition-all",
                                submitted === 'update' ? "bg-green-500 hover:bg-green-600" : "bg-primary hover:opacity-90"
                            )}
                        >
                            {loading === 'update' ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : submitted === 'update' ? (
                                <span className="flex items-center gap-2"><CheckCircle2 size={18} /> Feedback Received!</span>
                            ) : (
                                <span className="flex items-center gap-2"><Send size={16} /> Submit Suggestion</span>
                            )}
                        </Button>
                    </form>
                </section>

                {/* Form 2: Algorithm Suggestions */}
                <section className="p-8 rounded-3xl border border-border glass relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Zap size={120} />
                    </div>

                    <div className="flex items-center gap-3 mb-6 relative">
                        <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Zap className="text-purple-500" size={20} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">New Algorithm Ideas</h2>
                            <p className="text-sm text-muted-foreground font-medium">Have a strategy you want us to implement? Tell us about it.</p>
                        </div>
                    </div>

                    <form onSubmit={(e) => handleSubmit(e, 'algorithm')} className="space-y-4 relative">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Strategy Name</label>
                            <Input
                                name="strategyName"
                                required
                                placeholder="e.g., Mean Reversion, Bollinger Bands Cross..."
                                className="bg-secondary/30 border-white/5 h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Strategy Logic</label>
                            <textarea
                                name="logic"
                                required
                                rows={4}
                                placeholder="Explain when to buy and when to sell..."
                                className="w-full bg-secondary/30 border border-white/5 rounded-xl p-4 text-sm focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={loading === 'algorithm'}
                            className={cn(
                                "w-full h-12 font-bold tracking-wide transition-all",
                                submitted === 'algorithm' ? "bg-green-500 hover:bg-green-600" : "bg-primary hover:opacity-90"
                            )}
                        >
                            {loading === 'algorithm' ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : submitted === 'algorithm' ? (
                                <span className="flex items-center gap-2"><CheckCircle2 size={18} /> Strategy Logged!</span>
                            ) : (
                                <span className="flex items-center gap-2"><Send size={16} /> Share Algorithm</span>
                            )}
                        </Button>
                    </form>
                </section>

                {/* Form 3: Stock Ticker Request */}
                <section className="p-8 rounded-3xl border border-border glass relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Search size={120} />
                    </div>

                    <div className="flex items-center gap-3 mb-6 relative">
                        <div className="h-10 w-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                            <Search className="text-orange-500" size={20} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Request Ticker Support</h2>
                            <p className="text-sm text-muted-foreground font-medium">What should we add next?</p>
                        </div>
                    </div>

                    <form onSubmit={(e) => handleSubmit(e, 'ticker')} className="space-y-4 relative">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Stock Ticker</label>
                                <Input
                                    name="ticker"
                                    required
                                    placeholder="e.g., TSLA, NVDA, AAPL..."
                                    className="bg-secondary/30 border-white/5 h-12 font-mono uppercase"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Priority</label>
                                <select
                                    name="priority"
                                    className="w-full bg-secondary/30 border border-white/5 rounded-xl h-12 px-4 text-sm font-medium focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                                >
                                    <option value="low">Low - Just curious</option>
                                    <option value="medium" selected>Medium - Would use often</option>
                                    <option value="high">High - Critical for my analysis</option>
                                </select>
                            </div>
                        </div>
                        <Button
                            type="submit"
                            disabled={loading === 'ticker'}
                            className={cn(
                                "w-full h-12 font-bold tracking-wide transition-all",
                                submitted === 'ticker' ? "bg-green-500 hover:bg-green-600" : "bg-primary hover:opacity-90"
                            )}
                        >
                            {loading === 'ticker' ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : submitted === 'ticker' ? (
                                <span className="flex items-center gap-2"><CheckCircle2 size={18} /> Request Noted!</span>
                            ) : (
                                <span className="flex items-center gap-2"><Send size={16} /> Request Ticker</span>
                            )}
                        </Button>
                    </form>
                </section>
            </div>

            <footer className="mt-12 text-center text-muted-foreground text-sm">
                <p>Quant Node Community Hub • Feedback is processed periodically.</p>
            </footer>
        </div>
    );
}
