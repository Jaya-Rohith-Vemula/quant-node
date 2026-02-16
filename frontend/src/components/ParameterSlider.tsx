import React from 'react';

interface ParameterSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange: (value: number) => void;
}

export const ParameterSlider: React.FC<ParameterSliderProps> = ({
    label,
    value,
    min,
    max,
    step = 1,
    unit = '',
    onChange,
}) => {
    return (
        <div className="space-y-3 py-4 border-b border-white/5 last:border-0">
            <div className="flex justify-between items-center px-1">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {label}
                </label>
                <span className="text-primary font-bold text-lg">
                    {value}{unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1 font-mono">
                <span>{min}{unit}</span>
                <span>{max}{unit}</span>
            </div>
        </div>
    );
};
