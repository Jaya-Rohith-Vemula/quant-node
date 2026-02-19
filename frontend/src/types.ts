export interface BacktestSummary {
    symbol: string;
    totalProfitRealized: number;
    currentCashBalance: number;
    unsoldShares: number;
    averagePriceUnsold: number;
    finalAccountValue: number;
    maxDrawdownPercent: number;
    maxDrawdownAmount: number;
    minEquity: number;
    minEquityTime: string;
    peakValue: number;
    initialBalance: number;
}

export interface BacktestParams {
    symbol: string;
    initialBalance: number;
    startDate: string;
    endDate: string;
    strategyType: string;
    strategyParams: Record<string, any>;
}

export interface BacktestResults {
    trades: any[];
    equityHistory: any[];
    summary: BacktestSummary | null;
}

export interface ChangelogEntry {
    id?: number;
    title: string;
    description: string;
    status: 'planned' | 'in-progress' | 'completed';
    type: 'feature' | 'bugfix' | 'improvement';
    update_date: string;
    created_at?: string;
}
