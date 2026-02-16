import type { ReactNode } from 'react';

interface FeatureCardProps {
    icon: ReactNode;
    title: string;
    desc: string;
}

export function FeatureCard({ icon, title, desc }: FeatureCardProps) {
    return (
        <div className="p-6 rounded-2xl border border-border bg-secondary/10 hover:bg-secondary/20 transition-all group">
            <div className="mb-4 bg-secondary/50 w-fit p-3 rounded-xl group-hover:scale-110 transition-transform mx-auto">
                {icon}
            </div>
            <h4 className="font-bold text-lg mb-1">{title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
        </div>
    );
}
