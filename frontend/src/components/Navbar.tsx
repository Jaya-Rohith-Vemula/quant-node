import { useNavigate } from 'react-router-dom';
import {
    LineChart,
    BookOpen,
    Activity,
    MessageSquare,
    ShieldCheck
} from 'lucide-react';
import { cn } from "../lib/utils";
import { ModeToggle } from './ModeToggle';

interface NavbarProps {
    activePage: string;
}

export function Navbar({ activePage }: NavbarProps) {
    const navigate = useNavigate();

    const navItems = [
        { id: 'simulator', label: 'Simulator', icon: LineChart, path: '/' },
        { id: 'guide', label: 'How it works', icon: BookOpen, path: '/how-it-works' },
        { id: 'updates', label: 'System Updates', icon: Activity, path: '/updates' },
        { id: 'feedback', label: 'Feedback', icon: MessageSquare, path: '/feedback' },
        { id: 'admin', label: 'Admin', icon: ShieldCheck, path: '/admin' },
    ];

    return (
        <nav className="hidden lg:flex items-center justify-between px-8 py-3 border-b border-border bg-background/40 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex items-center gap-1">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => navigate(item.path)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-secondary/80 active:scale-95 group relative",
                            activePage === item.id
                                ? "text-primary bg-primary/10 shadow-[inset_0_0_20px_rgba(var(--primary-rgb),0.05)]"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <item.icon
                            size={18}
                            className={cn(
                                "transition-all duration-300",
                                activePage === item.id ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground group-hover:scale-110"
                            )}
                        />
                        <span className="tracking-tight uppercase text-[11px]">{item.label}</span>
                        {activePage === item.id && (
                            <div className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.8)]" />
                        )}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-4">
                <div className="h-6 w-px bg-border mx-2" />
                <ModeToggle />
            </div>
        </nav>
    );
}
