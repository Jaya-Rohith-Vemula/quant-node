import { useState, useEffect } from 'react';
import {
    Plus,
    Edit2,
    Trash2,
    CheckCircle2,
    Clock,
    Hammer,
    ArrowLeft,
    ShieldCheck,
    Lock,
    X,
    Calendar as CalendarIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/Skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { cn } from '../lib/utils';
import type { ChangelogEntry } from '../types';

interface UpdatesProps {
    onBack: () => void;
}

export function Updates({ onBack }: UpdatesProps) {
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminKey, setAdminKey] = useState(localStorage.getItem('admin_key') || '');
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [showAdminDialog, setShowAdminDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingEntry, setEditingEntry] = useState<Partial<ChangelogEntry> | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [adminError, setAdminError] = useState<string | null>(null);
    const [datePickerOpen, setDatePickerOpen] = useState(false);

    const fetchUpdates = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/changelog');
            const data = await res.json();
            setEntries(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch updates:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpdates();
        const storedKey = localStorage.getItem('admin_key');
        if (storedKey) {
            // Verify stored key silently once on mount
            fetch('/api/changelog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify', adminKey: storedKey })
            }).then(res => {
                if (res.ok) setIsAdminMode(true);
                else localStorage.removeItem('admin_key');
            });
        }
    }, []);

    const handleSave = async () => {
        if (!editingEntry) return;

        try {
            const res = await fetch('/api/changelog', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminKey
                },
                body: JSON.stringify(editingEntry)
            });

            if (res.ok) {
                setShowEditDialog(false);
                setEditingEntry(null);
                fetchUpdates();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to save');
            }
        } catch (err) {
            alert('Error saving update');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this update?')) return;

        try {
            const res = await fetch(`/api/changelog?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'x-admin-key': adminKey
                }
            });

            if (res.ok) {
                fetchUpdates();
            } else {
                alert('Failed to delete');
            }
        } catch (err) {
            alert('Error deleting update');
        }
    };

    const toggleAdmin = () => {
        if (isAdminMode) {
            setIsAdminMode(false);
            setAdminKey('');
            localStorage.removeItem('admin_key');
        } else {
            setAdminError(null);
            setShowAdminDialog(true);
        }
    };

    const handleAdminSubmit = async () => {
        setVerifying(true);
        setAdminError(null);
        try {
            const res = await fetch('/api/changelog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify', adminKey })
            });

            if (res.ok) {
                localStorage.setItem('admin_key', adminKey);
                setIsAdminMode(true);
                setShowAdminDialog(false);
            } else {
                setAdminError('Invalid secret key. Please try again.');
            }
        } catch (err) {
            setAdminError('Connection error. Could not verify key.');
        } finally {
            setVerifying(false);
        }
    };

    const roadmap = entries.filter(e => e.status !== 'completed');
    const changelog = entries.filter(e => e.status === 'completed');

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-primary font-bold text-sm mb-4 hover:gap-3 transition-all"
                    >
                        <ArrowLeft size={16} />
                        Simulator
                    </button>
                    <h1 className="text-4xl font-black tracking-tight">System Updates</h1>
                    <p className="text-muted-foreground mt-2">Tracking the evolution of Quant Node.</p>
                </div>

                <div className="flex gap-2">
                    {isAdminMode && (
                        <Button
                            onClick={() => {
                                setEditingEntry({
                                    title: '',
                                    description: '',
                                    status: 'planned',
                                    type: 'feature',
                                    update_date: new Date().toISOString()
                                });
                                setShowEditDialog(true);
                            }}
                            className="bg-primary hover:bg-primary/90"
                        >
                            <Plus size={18} className="mr-2" />
                            Add Update
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={toggleAdmin}
                        className={cn(isAdminMode && "border-primary text-primary bg-primary/5")}
                    >
                        {isAdminMode ? <ShieldCheck size={18} /> : <Lock size={18} />}
                    </Button>
                </div>
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
                                <p className="text-muted-foreground italic px-4 py-8 border border-dashed rounded-2xl text-center">
                                    Full speed ahead! No pending planned features.
                                </p>
                            ) : (
                                roadmap.map(entry => (
                                    <UpdateCard
                                        key={entry.id}
                                        entry={entry}
                                        isAdmin={isAdminMode}
                                        onEdit={() => {
                                            setEditingEntry(entry);
                                            setShowEditDialog(true);
                                        }}
                                        onDelete={() => entry.id && handleDelete(entry.id)}
                                    />
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
                                <p className="text-muted-foreground italic px-4 py-8 border border-dashed rounded-2xl text-center">
                                    Nothing shipped yet. We're just getting started!
                                </p>
                            ) : (
                                changelog.map(entry => (
                                    <UpdateCard
                                        key={entry.id}
                                        entry={entry}
                                        isAdmin={isAdminMode}
                                        onEdit={() => {
                                            setEditingEntry(entry);
                                            setShowEditDialog(true);
                                        }}
                                        onDelete={() => entry.id && handleDelete(entry.id)}
                                    />
                                ))
                            )}
                        </div>
                    </section>
                </div>
            )}

            {/* Admin Key Dialog */}
            {showAdminDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowAdminDialog(false)} />
                    <div className="relative bg-card border border-border p-6 rounded-2xl shadow-2xl w-full max-w-sm glass animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Lock size={18} className="text-primary" />
                            Admin Access
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">Enter the secret key to manage system updates.</p>

                        {adminError && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200">
                                {adminError}
                            </div>
                        )}

                        <Input
                            type="password"
                            placeholder="Secret Key"
                            value={adminKey}
                            onChange={(e) => setAdminKey(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdminSubmit()}
                            className="mb-4"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowAdminDialog(false)} className="flex-1" disabled={verifying}>Cancel</Button>
                            <Button onClick={handleAdminSubmit} className="flex-1 bg-primary" disabled={verifying}>
                                {verifying ? (
                                    <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
                                ) : (
                                    'Access'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit/Add Dialog */}
            {showEditDialog && editingEntry && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowEditDialog(false)} />
                    <div className="relative bg-card border border-border p-8 rounded-3xl shadow-2xl w-full max-w-2xl glass animate-in zoom-in-95 duration-200 my-8">
                        <header className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black tracking-tight">
                                {editingEntry.id ? 'Edit Update' : 'New System Update'}
                            </h3>
                            <button onClick={() => setShowEditDialog(false)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </header>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Title</label>
                                <Input
                                    value={editingEntry.title || ''}
                                    onChange={e => setEditingEntry({ ...editingEntry, title: e.target.value })}
                                    placeholder="Feature title..."
                                    className="bg-secondary/50 h-12 text-lg font-bold border-white/5"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</label>
                                    <select
                                        className="w-full bg-secondary/50 border border-white/5 h-12 rounded-xl px-4 text-sm font-medium focus:ring-1 focus:ring-primary"
                                        value={editingEntry.status}
                                        onChange={e => setEditingEntry({ ...editingEntry, status: e.target.value as any })}
                                    >
                                        <option value="planned">Planned</option>
                                        <option value="in-progress">In-Progress</option>
                                        <option value="completed">Completed/Shipped</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Type</label>
                                    <select
                                        className="w-full bg-secondary/50 border border-white/5 h-12 rounded-xl px-4 text-sm font-medium focus:ring-1 focus:ring-primary"
                                        value={editingEntry.type}
                                        onChange={e => setEditingEntry({ ...editingEntry, type: e.target.value as any })}
                                    >
                                        <option value="feature">Feature</option>
                                        <option value="bugfix">Bugfix</option>
                                        <option value="improvement">Improvement</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Date</label>
                                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal bg-secondary/50 border-white/5 h-12 rounded-xl px-4 hover:bg-secondary/70 transition-colors",
                                                !editingEntry.update_date && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                            {editingEntry.update_date ? format(new Date(editingEntry.update_date), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-popover border-border z-[110]" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={editingEntry.update_date ? new Date(editingEntry.update_date) : undefined}
                                            onSelect={(date) => {
                                                if (date) {
                                                    setEditingEntry({ ...editingEntry, update_date: date.toISOString() });
                                                    setDatePickerOpen(false);
                                                }
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                                <textarea
                                    className="w-full bg-secondary/50 border border-white/5 rounded-2xl p-4 min-h-[150px] text-sm focus:ring-1 focus:ring-primary"
                                    placeholder="Detail the changes..."
                                    value={editingEntry.description || ''}
                                    onChange={e => setEditingEntry({ ...editingEntry, description: e.target.value })}
                                />
                            </div>

                            <Button onClick={handleSave} className="w-full h-14 bg-primary text-primary-foreground font-black tracking-widest text-sm shadow-xl hover:opacity-90 active:scale-[0.98] transition-all">
                                {editingEntry.id ? 'Push Update' : 'Initialize Update'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function UpdateCard({ entry, isAdmin, onEdit, onDelete }: { entry: ChangelogEntry, isAdmin: boolean, onEdit: () => void, onDelete: () => void }) {
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
                            {entry.status.replace('-', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1 ml-1">
                            <Clock size={12} />
                            {entry.update_date ? format(new Date(entry.update_date), 'MMM d, yyyy') : 'No date'}
                        </span>
                    </div>

                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{entry.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{entry.description}</p>
                </div>

                {isAdmin && (
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onEdit}
                            className="h-8 w-8 hover:bg-primary/20 hover:text-primary"
                        >
                            <Edit2 size={14} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onDelete}
                            className="h-8 w-8 hover:bg-red-500/20 hover:text-red-500"
                        >
                            <Trash2 size={14} />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
