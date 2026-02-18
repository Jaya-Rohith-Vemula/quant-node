import { useState, useEffect } from 'react';
import {
    Plus,
    Edit2,
    Trash2,
    Clock,
    Hammer,
    ArrowLeft,
    ShieldCheck,
    Lock,
    X,
    Calendar as CalendarIcon,
    MessageSquare,
    Zap,
    Search,
    AlertCircle
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

interface FeedbackItem {
    id: number;
    type: string;
    title: string;
    description: string;
    ticker?: string;
    priority?: string;
    status: string;
    created_at: string;
}

interface AdminProps {
    onBack: () => void;
}

export function Admin({ onBack }: AdminProps) {
    const [activeTab, setActiveTab] = useState<'updates' | 'feedback'>('updates');
    const [updates, setUpdates] = useState<ChangelogEntry[]>([]);
    const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminKey, setAdminKey] = useState(localStorage.getItem('admin_key') || '');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states for updates
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingEntry, setEditingEntry] = useState<Partial<ChangelogEntry> | null>(null);
    const [datePickerOpen, setDatePickerOpen] = useState(false);

    const fetchData = async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        setError(null);
        try {
            const [updatesRes, feedbackRes] = await Promise.all([
                fetch('/api/changelog'),
                fetch('/api/feedback', {
                    headers: { 'x-admin-key': adminKey }
                })
            ]);

            const updatesData = await updatesRes.json();
            const feedbackData = await feedbackRes.json();

            if (updatesData.error) throw new Error(updatesData.error);
            if (feedbackData.error) throw new Error(feedbackData.error);

            // Normalize keys (Oracle returns UPPERCASE)
            const normalize = (arr: any[]) => Array.isArray(arr) ? arr.map(item => {
                const normalized: any = {};
                Object.keys(item).forEach(key => {
                    normalized[key.toLowerCase()] = item[key];
                });
                return normalized;
            }) : [];

            setUpdates(normalize(updatesData));
            setFeedback(normalize(feedbackData));
        } catch (err: any) {
            console.error('Failed to fetch admin data:', err);
            setError(err.message || 'Failed to retrieve administrative data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const storedKey = localStorage.getItem('admin_key');
        if (storedKey) {
            handleVerify(storedKey);
        } else {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

    const handleVerify = async (key: string) => {
        setVerifying(true);
        try {
            const res = await fetch('/api/changelog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify', adminKey: key })
            });

            if (res.ok) {
                localStorage.setItem('admin_key', key);
                setAdminKey(key);
                setIsAuthenticated(true);
            } else {
                localStorage.removeItem('admin_key');
                setError('Invalid administrative key.');
            }
        } catch (err) {
            setError('Connection failed.');
        } finally {
            setVerifying(false);
        }
    };

    const handleSaveUpdate = async () => {
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
                fetchData();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to save update');
            }
        } catch (err) {
            alert('Error saving update');
        }
    };

    const handleDeleteUpdate = async (id: number) => {
        if (!confirm('Are you sure you want to delete this update?')) return;
        try {
            const res = await fetch(`/api/changelog?id=${id}`, {
                method: 'DELETE',
                headers: { 'x-admin-key': adminKey }
            });
            if (res.ok) fetchData();
            else alert('Failed to delete update');
        } catch (err) {
            alert('Error deleting update');
        }
    };

    const handleUpdateFeedbackStatus = async (id: number, newStatus: string) => {
        try {
            const res = await fetch('/api/feedback', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminKey
                },
                body: JSON.stringify({ id, status: newStatus })
            });

            if (res.ok) {
                fetchData();
            } else {
                alert('Failed to update status');
            }
        } catch (err) {
            console.error('Error updating feedback status:', err);
        }
    };

    const handleDeleteFeedback = async (id: number) => {
        if (!confirm('Are you sure you want to delete this feedback?')) return;
        try {
            const res = await fetch(`/api/feedback?id=${id}`, {
                method: 'DELETE',
                headers: { 'x-admin-key': adminKey }
            });
            if (res.ok) fetchData();
            else alert('Failed to delete feedback');
        } catch (err) {
            alert('Error deleting feedback');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background">
                <div className="absolute inset-0 bg-background/95 backdrop-blur-md" />
                <div className="relative bg-card border border-border p-8 rounded-3xl shadow-2xl w-full max-w-md glass animate-in zoom-in-95 duration-200">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                            <Lock className="text-primary" size={32} />
                        </div>
                        <h3 className="text-2xl font-black tracking-tight">Admin Authentication</h3>
                        <p className="text-muted-foreground mt-2">Please enter your master key to access the command center.</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold flex items-center gap-2">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <Input
                        type="password"
                        placeholder="Enter Master Key"
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerify(adminKey)}
                        className="mb-6 h-14 text-center text-lg tracking-[0.5em] font-mono bg-secondary/50 border-white/5"
                        autoFocus
                    />

                    <div className="flex gap-4">
                        <Button variant="outline" onClick={onBack} className="flex-1 h-12" disabled={verifying}>Cancel</Button>
                        <Button onClick={() => handleVerify(adminKey)} className="flex-1 h-12 bg-primary font-bold" disabled={verifying}>
                            {verifying ? (
                                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full mx-auto" />
                            ) : (
                                'Decrypt & Access'
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div>
                    <div className="flex gap-4 mb-4">
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 text-primary font-bold text-sm hover:gap-3 transition-all"
                        >
                            <ArrowLeft size={16} />
                            Simulator
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem('admin_key');
                                window.location.reload();
                            }}
                            className="flex items-center gap-2 text-muted-foreground hover:text-red-500 font-bold text-sm transition-all"
                        >
                            <Lock size={14} />
                            Logout
                        </button>
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
                            <ShieldCheck className="text-primary" size={32} />
                            Admin Command Center
                        </h1>
                        <p className="text-muted-foreground mt-2">Managing Quant Node operations and community feedback.</p>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <div className="flex bg-secondary/50 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={() => setActiveTab('updates')}
                        className={cn(
                            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                            activeTab === 'updates' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        System Updates
                    </button>
                    <button
                        onClick={() => setActiveTab('feedback')}
                        className={cn(
                            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                            activeTab === 'feedback' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        User Feedback {(feedback.length > 0) && <span className="ml-1 opacity-70">({feedback.length})</span>}
                    </button>
                </div>
            </header>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                </div>
            ) : (
                <div className="space-y-8">
                    {activeTab === 'updates' ? (
                        <section className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Hammer className="text-orange-500" size={24} />
                                    Changelog Management
                                </h2>
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
                                    Post Update
                                </Button>
                            </div>

                            <div className="grid gap-4">
                                {updates.length === 0 ? (
                                    <div className="p-12 text-center border-2 border-dashed border-border rounded-3xl text-muted-foreground">
                                        No updates found. Start by adding one!
                                    </div>
                                ) : (
                                    updates.map(entry => (
                                        <div key={entry.id} className="p-6 rounded-2xl border border-border glass flex justify-between items-start group">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className="uppercase text-[10px] tracking-widest">{entry.type}</Badge>
                                                    <Badge variant="outline" className="uppercase text-[10px] tracking-widest">{entry.status}</Badge>
                                                    <span className="text-[10px] text-muted-foreground font-mono ml-2">
                                                        {format(new Date(entry.update_date), 'MMM d, yyyy')}
                                                    </span>
                                                </div>
                                                <h3 className="text-xl font-bold">{entry.title}</h3>
                                                <p className="text-muted-foreground text-sm mt-1">{entry.description}</p>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => { setEditingEntry(entry); setShowEditDialog(true); }}>
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="hover:text-red-500 hover:bg-red-500/10" onClick={() => entry.id && handleDeleteUpdate(entry.id)}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    ) : (
                        <section className="space-y-6">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <MessageSquare className="text-blue-500" size={24} />
                                Community Voice
                            </h2>
                            <div className="grid gap-6">
                                {feedback.length === 0 ? (
                                    <div className="p-12 text-center border-2 border-dashed border-border rounded-3xl text-muted-foreground">
                                        Waiting for the first user feedback...
                                    </div>
                                ) : (
                                    feedback.map(item => (
                                        <div key={item.id} className="p-6 rounded-3xl border border-border glass relative overflow-hidden group hover:border-primary/30 transition-all">
                                            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                                                {item.type === 'update' ? <MessageSquare size={48} /> : item.type === 'algorithm' ? <Zap size={48} /> : <Search size={48} />}
                                            </div>

                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge className={cn(
                                                        "uppercase text-[10px] tracking-widest py-1",
                                                        item.type === 'update' ? "bg-blue-500/20 text-blue-400 border-blue-500/20" :
                                                            item.type === 'algorithm' ? "bg-purple-500/20 text-purple-400 border-purple-500/20" :
                                                                "bg-orange-500/20 text-orange-400 border-orange-500/20"
                                                    )}>
                                                        {item.type}
                                                    </Badge>
                                                    {item.priority && (
                                                        <Badge variant="destructive" className="uppercase text-[10px] tracking-widest py-1">
                                                            {item.priority} priority
                                                        </Badge>
                                                    )}
                                                    <Badge variant="outline" className={cn(
                                                        "uppercase text-[10px] tracking-widest py-1",
                                                        item.status === 'implemented' ? "bg-green-500/20 text-green-400 border-green-500/20" :
                                                            item.status === 'planned' ? "bg-blue-500/20 text-blue-400 border-blue-500/20" :
                                                                item.status === 'rejected' ? "bg-red-500/20 text-red-400 border-red-500/20" :
                                                                    "bg-secondary text-muted-foreground"
                                                    )}>
                                                        {item.status || 'pending'}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground font-mono ml-2 flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}
                                                    </span>
                                                </div>

                                                <div className="flex gap-1 relative z-10">
                                                    <select
                                                        className="bg-secondary/50 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-primary"
                                                        value={item.status || 'pending'}
                                                        onChange={(e) => handleUpdateFeedbackStatus(item.id, e.target.value)}
                                                    >
                                                        <option value="pending">Pending</option>
                                                        <option value="reviewing">Reviewing</option>
                                                        <option value="planned">Planned</option>
                                                        <option value="implemented">Implemented</option>
                                                        <option value="rejected">Rejected</option>
                                                    </select>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDeleteFeedback(item.id)}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </div>

                                            <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                                            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{item.description}</p>

                                            {item.ticker && (
                                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Requested Ticker</span>
                                                        <span className="text-lg font-black font-mono text-primary">{item.ticker}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* Edit Update Dialog */}
            {showEditDialog && editingEntry && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowEditDialog(false)} />
                    <div className="relative bg-card border border-border p-8 rounded-3xl shadow-2xl w-full max-w-2xl glass animate-in zoom-in-95 duration-200 my-8">
                        <header className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black tracking-tight">
                                {editingEntry.id ? 'Modify Record' : 'Initialize New Entry'}
                            </h3>
                            <button onClick={() => setShowEditDialog(false)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </header>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Entry Title</label>
                                <Input
                                    value={editingEntry.title || ''}
                                    onChange={e => setEditingEntry({ ...editingEntry, title: e.target.value })}
                                    className="bg-secondary/50 h-12 text-lg font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Global Status</label>
                                    <select
                                        className="w-full bg-secondary/50 border border-white/10 h-12 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                                        value={editingEntry.status}
                                        onChange={e => setEditingEntry({ ...editingEntry, status: e.target.value as any })}
                                    >
                                        <option value="planned">Planned</option>
                                        <option value="in-progress">In-Progress</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Release Type</label>
                                    <select
                                        className="w-full bg-secondary/50 border border-white/10 h-12 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
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
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Execution Date</label>
                                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal bg-secondary/50 h-12 rounded-xl px-4">
                                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                            {editingEntry.update_date ? format(new Date(editingEntry.update_date), "PPP") : <span>Select Date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-popover border-border z-[120]" align="start">
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
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Detailed Logs</label>
                                <textarea
                                    className="w-full bg-secondary/50 border border-white/10 rounded-2xl p-4 min-h-[150px] text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={editingEntry.description || ''}
                                    onChange={e => setEditingEntry({ ...editingEntry, description: e.target.value })}
                                />
                            </div>

                            <Button onClick={handleSaveUpdate} className="w-full h-14 bg-primary text-primary-foreground font-black tracking-widest text-sm shadow-xl hover:opacity-90 active:scale-[0.98] transition-all">
                                {editingEntry.id ? 'Update Record' : 'Commit New Entry'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
