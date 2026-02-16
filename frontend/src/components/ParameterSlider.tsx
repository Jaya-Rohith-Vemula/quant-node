import React, { useState, useEffect } from 'react';

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
    const [localValue, setLocalValue] = useState(value);

    // Sync local value with prop if prop changes externally
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleCommit = () => {
        if (localValue !== value) {
            onChange(localValue);
        }
    };

    return (
        <div className="space-y-3 py-4 border-b border-border last:border-0">
            <div className="flex justify-between items-center px-1">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {label}
                </label>
                <span className="text-foreground font-bold text-lg">
                    {localValue}{unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={localValue}
                onChange={(e) => setLocalValue(parseFloat(e.target.value))}
                onMouseUp={handleCommit}
                onTouchEnd={handleCommit}
                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-muted-foreground"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1 font-mono">
                <span>{min}{unit}</span>
                <span>{max}{unit}</span>
            </div>
        </div>
    );
};
