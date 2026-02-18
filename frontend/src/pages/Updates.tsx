import { useState, useEffect } from 'react';
import {
    CheckCircle2,
    Clock,
    Hammer,
    ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/utils';
import type { ChangelogEntry } from '../types';

interface UpdatesProps {
    onBack: () => void;
}

export function Updates({ onBack }: UpdatesProps) {
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUpdates = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/changelog');
            const data = await res.json();

            // Normalize keys (Oracle returns UPPERCASE)
            const normalized = Array.isArray(data) ? data.map((item: any) => {
                const inner: any = {};
                Object.keys(item).forEach(key => {
                    inner[key.toLowerCase()] = item[key];
                });
                return inner;
            }) : [];

            setEntries(normalized);
        } catch (err) {
            console.error('Failed to fetch updates:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpdates();
    }, []);

    const roadmap = entries.filter(e => e.status !== 'completed');
    const changelog = entries.filter(e => e.status === 'completed');

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-500">
            {/* Header */}
            <header className="mb-12">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-primary font-bold text-sm mb-4 hover:gap-3 transition-all"
                >
                    <ArrowLeft size={16} />
                    Simulator
                </button>
                <h1 className="text-4xl font-black tracking-tight">System Updates</h1>
                <p className="text-muted-foreground mt-2">Tracking the evolution of Quant Node.</p>
            </header>

            {loading ? (
                <div className="space-y-8">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
                </div>
            ) : (
                <div className="space-y-12">
                    {/* Roadmap Section */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                                <Hammer className="text-orange-500" size={18} />
                            </div>
                            <h2 className="text-2xl font-bold">Planned & In-Progress</h2>
                        </div>

                        <div className="grid gap-4">
                            {roadmap.length === 0 ? (
                                <p className="text-muted-foreground italic px-4 py-8 border border-dashed border-border rounded-2xl text-center">
                                    Full speed ahead! No pending planned features.
                                </p>
                            ) : (
                                roadmap.map((entry, idx) => (
                                    <UpdateCard key={entry.id || idx} entry={entry} />
                                ))
                            )}
                        </div>
                    </section>

                    {/* Changelog Section */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="text-green-500" size={18} />
                            </div>
                            <h2 className="text-2xl font-bold">Shipped Updates</h2>
                        </div>

                        <div className="grid gap-4">
                            {changelog.length === 0 ? (
                                <p className="text-muted-foreground italic px-4 py-8 border border-dashed border-border rounded-2xl text-center">
                                    Nothing shipped yet. We're just getting started!
                                </p>
                            ) : (
                                changelog.map((entry, idx) => (
                                    <UpdateCard key={entry.id || idx} entry={entry} />
                                ))
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

function UpdateCard({ entry }: { entry: ChangelogEntry }) {
    return (
        <div className="p-6 rounded-2xl border border-border glass group transition-all hover:border-primary/30 relative">
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge variant={entry.type === 'feature' ? 'default' : entry.type === 'bugfix' ? 'destructive' : 'secondary'} className="uppercase text-[10px] tracking-widest font-black py-0.5 px-2">
                            {entry.type}
                        </Badge>
                        <Badge variant="outline" className={cn(
                            "uppercase text-[10px] tracking-widest font-black py-0.5 px-2",
                            entry.status === 'completed' ? "border-green-500/50 text-green-500" :
                                entry.status === 'in-progress' ? "border-orange-500/50 text-orange-500" :
                                    "border-muted-foreground/50 text-muted-foreground"
                        )}>
                            {(entry.status || 'planned').replace('-', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1 ml-1">
                            <Clock size={12} />
                            {entry.update_date ? format(new Date(entry.update_date), 'MMM d, yyyy') : 'No date'}
                        </span>
                    </div>

                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{entry.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{entry.description}</p>
                </div>
            </div>
        </div>
    );
}
