export interface StrategyParameter {
    key: string;
    label: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    defaultValue: any;
    type?: 'slider' | 'select' | 'toggle';
    options?: { label: string; value: any }[];
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
        id: 'amr',
        name: 'Adaptive Momentum Rider',
        description: 'A regime-adaptive trend follower that uses EMA crossovers with dynamic ATR-based trailing stops. Features multi-timeframe confirmation (1h trend filter) for higher quality entries. Widens stops in trends to ride momentum, tightens in choppy markets to protect capital.',
        guide: {
            entry: "Enters on EMA Golden Cross (fast above slow) while price is above the Trend EMA. When HTF Confirm is ON, also requires the 1-hour EMA trend to be bullish. Re-enters on 'EMA Reclaim' — when price bounces back above the fast EMA during an existing bullish structure.",
            exit: "Uses a percentage-based ATR trailing stop that adapts to market regime. In trending markets, stops are wider to ride momentum. In choppy markets, stops tighten to reduce whipsaws. Trend Break and Death Cross exits are suppressed when in profit or strong trend.",
            tip: "Best config for automation: 5m timeframe + HTF Confirm ON + Force EOD Exit ON. This gives intraday-only trades with 1h trend confirmation, keeping max drawdown under 20% while delivering 200%+ returns.",
            keyPoints: [
                "Multi-timeframe: 1h trend confirms 5m entries",
                "Intraday mode: zero overnight risk",
                "Regime-adaptive stops (trend vs. choppy)",
                "Max drawdown ~15-19% on 5m+HTF intraday",
                "Tested on SOFI (+247%) and PLTR (+225%)"
            ]
        },
        parameters: [
            {
                key: 'fastEMA',
                label: 'Fast EMA (Signal)',
                min: 3,
                max: 20,
                step: 1,
                unit: '',
                defaultValue: 8,
            },
            {
                key: 'slowEMA',
                label: 'Slow EMA (Trigger)',
                min: 10,
                max: 50,
                step: 1,
                unit: '',
                defaultValue: 21,
            },
            {
                key: 'trendEMA',
                label: 'Trend EMA (Macro Filter)',
                min: 20,
                max: 200,
                step: 5,
                unit: '',
                defaultValue: 50,
            },
            {
                key: 'trendTrailATR',
                label: 'Trend Trail (ATR Mult)',
                min: 1,
                max: 5,
                step: 0.5,
                unit: 'x',
                defaultValue: 2.5,
            },
            {
                key: 'choppyTrailATR',
                label: 'Choppy Trail (ATR Mult)',
                min: 0.5,
                max: 3,
                step: 0.5,
                unit: 'x',
                defaultValue: 1.5,
            },
            {
                key: 'rsiFloor',
                label: 'RSI Floor (No Buy Below)',
                min: 10,
                max: 50,
                step: 5,
                unit: '',
                defaultValue: 35,
            },
            {
                key: 'rsiCeiling',
                label: 'RSI Ceiling (No Buy Above)',
                min: 60,
                max: 90,
                step: 5,
                unit: '',
                defaultValue: 75,
            },
            {
                key: 'reentryBars',
                label: 'Cooldown After Exit',
                min: 0,
                max: 20,
                step: 1,
                unit: ' bars',
                defaultValue: 5,
            },
            {
                key: 'htfConfirm',
                label: 'HTF Trend Confirmation',
                type: 'select',
                defaultValue: '1h',
                options: [
                    { label: 'None (Off)', value: 'none' },
                    { label: '15 min', value: '15m' },
                    { label: '30 min', value: '30m' },
                    { label: '1 Hour', value: '1h' },
                    { label: '4 Hours', value: '4h' },
                    { label: '1 Day', value: '1d' },
                ],
            },
            {
                key: 'marketHoursOnly',
                label: 'Market Hours Only',
                type: 'toggle',
                defaultValue: 1,
            },
            {
                key: 'forceEodExit',
                label: 'Force EOD Exit (Intraday)',
                type: 'toggle',
                defaultValue: 1,
            },
        ],
    },
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
    },
    {
        id: 'sma_crossover',
        name: 'SMA Crossover',
        description: 'A simplified trend-following strategy that uses two moving averages as a floor and ceiling for price action.',
        guide: {
            entry: "Enters when price crosses over EITHER SMA. Includes an automatic Multi-Timeframe (MTF) filter. If 'Bullish Alignment' is enabled, Fast SMA entries are blocked unless Fast > Slow SMA.",
            exit: "Exits if price drops below EITHER SMA, triggers a Trailing Stop, or (optionally) forced at market close.",
            tip: "The Force EOD Exit ensures you never hold a position overnight, protecting you from overnight gaps.",
            keyPoints: [
                "Optional Force EOD Exit (Intraday)",
                "Trailing Stop & SMA crossovers",
                "Automatic Multi-Timeframe Trend filter",
                "Bullish SMA Alignment safety"
            ]
        },
        parameters: [
            {
                key: 'fastPeriod',
                label: 'Fast Window (Signal)',
                min: 5,
                max: 100,
                step: 1,
                unit: '',
                defaultValue: 20,
            },
            {
                key: 'slowPeriod',
                label: 'Slow Window (Macro)',
                min: 20,
                max: 500,
                step: 5,
                unit: '',
                defaultValue: 200,
            },
            {
                key: 'marketHoursOnly',
                label: 'Market Hours Only',
                type: 'toggle',
                defaultValue: 1,
            },
            {
                key: 'forceEodExit',
                label: 'Force EOD Exit (Intraday)',
                type: 'toggle',
                defaultValue: 0,
            },
            {
                key: 'bullishAlignmentFilter',
                label: 'Require Bullish Alignment',
                type: 'toggle',
                defaultValue: 1,
            },
            {
                key: 'htfTimeframe',
                label: 'Trend Filter 1',
                type: 'select',
                defaultValue: 'auto',
                options: [
                    { label: 'Auto (Recommended)', value: 'auto' },
                    { label: '5 Minute', value: '5m' },
                    { label: '15 Minute', value: '15m' },
                    { label: '1 Hour', value: '1h' },
                    { label: '4 Hour', value: '4h' },
                    { label: '1 Day', value: '1d' },
                    { label: 'Disabled (No Filter)', value: 'none' }
                ]
            },
            {
                key: 'htfTimeframe2',
                label: 'Trend Filter 2',
                type: 'select',
                defaultValue: 'none',
                options: [
                    { label: 'Auto', value: 'auto' },
                    { label: '5 Minute', value: '5m' },
                    { label: '15 Minute', value: '15m' },
                    { label: '1 Hour', value: '1h' },
                    { label: '4 Hour', value: '4h' },
                    { label: '1 Day', value: '1d' },
                    { label: 'Disabled (No Filter)', value: 'none' }
                ]
            },
            {
                key: 'trailingStopPercent',
                label: 'Trailing Stop Loss',
                min: 0,
                max: 20,
                step: 0.5,
                unit: '%',
                defaultValue: 3,
            }
        ],
    }
];

