export interface StrategyParameter {
    key: string;
    label: string;
    min: number;
    max: number;
    step: number;
    unit: string;
    defaultValue: any;
}

export interface StrategyGuideMetadata {
    entry: string;
    exit: string;
    tip: string;
    keyPoints: string[];
}

export interface Strategy {
    id: string;
    name: string;
    description: string;
    guide: StrategyGuideMetadata;
    parameters: StrategyParameter[];
}

export const STRATEGIES: Strategy[] = [
    {
        id: 'grid_trading',
        name: 'Grid Trading',
        description: 'A quantitative strategy that buys when the price drops by a certain percentage and sells when it rises by a target percentage.',
        guide: {
            entry: "Triggered when price falls from a reference point (initially its 7-day high). Subsequent buys occur if the price drops further from the last trade price.",
            exit: "Each buy 'lot' is tracked independently. A sell order is executed for a specific lot once it reaches your 'Up' percentage target.",
            tip: "This strategy performs best in oscillating or ranging markets where price stays within a defined channel.",
            keyPoints: [
                "Independently tracked trade lots",
                "Fixed dollar purchase size",
                "Scaled entry logic"
            ]
        },
        parameters: [
            {
                key: 'moveDownPercent',
                label: 'Grid Step (Down)',
                min: 0.5,
                max: 20,
                step: 0.5,
                unit: '%',
                defaultValue: 2,
            },
            {
                key: 'moveUpPercent',
                label: 'Profit Target (Up)',
                min: 1,
                max: 30,
                step: 0.5,
                unit: '%',
                defaultValue: 5,
            },
            {
                key: 'amountToBuy',
                label: 'Buy Size',
                min: 100,
                max: 10000,
                step: 100,
                unit: '$',
                defaultValue: 1000,
            },
        ],
    },
    {
        id: 'rsi_mean_reversion',
        name: 'RSI Mean Reversion',
        description: 'A strategy that uses the Relative Strength Index (RSI) to identify oversold conditions for entry and overbought conditions for exit.',
        guide: {
            entry: "Enters the market when the RSI (Relative Strength Index) indicator falls below the 'Oversold' threshold, suggesting the asset is undervalued.",
            exit: "Exits all open positions when the RSI indicator rises above the 'Overbought' threshold, suggesting the momentum has been exhausted.",
            tip: "Adjust the RSI Period to control sensitivity. A shorter period (like 7) leads to more signals but higher risk of noise.",
            keyPoints: [
                "Wilder's Smoothing RSI formula",
                "Multi-lot scaling entries",
                "Full portfolio exit on overbought"
            ]
        },
        parameters: [
            {
                key: 'rsiPeriod',
                label: 'RSI Period',
                min: 2,
                max: 30,
                step: 1,
                unit: '',
                defaultValue: 14,
            },
            {
                key: 'oversoldThreshold',
                label: 'Oversold Level',
                min: 10,
                max: 40,
                step: 1,
                unit: '',
                defaultValue: 30,
            },
            {
                key: 'overboughtThreshold',
                label: 'Overbought Level',
                min: 60,
                max: 90,
                step: 1,
                unit: '',
                defaultValue: 70,
            },
        ],
    }
];
