import { useState } from 'react';
import {
  TrendingUp,
  Settings,
  DollarSign,
  Play,
  Activity,
  TrendingDown,
  Briefcase,
  Target,
  Wallet
} from 'lucide-react';
import { ParameterSlider } from './components/ParameterSlider';
import { BacktestChart } from './components/BacktestChart';
import { TradeTable } from './components/TradeTable';
import { Skeleton } from './components/ui/Skeleton';

interface BacktestSummary {
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

function App() {
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({
    symbol: 'SOFI',
    initialBalance: 10000,
    initialDropPercent: 5,
    moveDownPercent: 2,
    moveUpPercent: 5,
    amountToBuy: 1000,
    startDate: '2024-01-01',
    endDate: '2025-12-31'
  });

  const [results, setResults] = useState<{
    trades: any[],
    equityHistory: any[],
    summary: BacktestSummary | null
  }>({
    trades: [],
    equityHistory: [],
    summary: null
  });

  const runBacktest = async () => {
    console.log('Initiating backtest with params:', params);
    setLoading(true);
    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Received data:', data);

      if (data.error) {
        throw new Error(data.error);
      }

      setResults(data);
      if (data.trades.length === 0) {
        console.warn('Backend returned zero trades.');
        alert('No trades were executed for this period. Try increasing the date range or the ticker symbol.');
      }
    } catch (error: any) {
      console.error('Failed to run backtest:', error);
      alert(`Error: ${error.message || 'Failed to connect to backend API'}`);
    } finally {
      setLoading(false);
    }
  };

  const updateParam = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar - Parameters */}
      <aside className="w-80 border-r border-white/10 flex flex-col glass overflow-y-auto">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg">
            <Activity className="text-primary" size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">QuantNode</h1>
        </div>

        <div className="p-6 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            <Settings size={14} />
            Strategy Parameters
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-bold px-1">Ticker Symbol</label>
              <input
                type="text"
                value={params.symbol}
                onChange={(e) => updateParam('symbol', e.target.value.toUpperCase())}
                className="w-full bg-secondary/50 border border-white/5 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono mb-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pb-4">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase font-bold px-1">Start Date</label>
                <input
                  type="date"
                  value={params.startDate}
                  onChange={(e) => updateParam('startDate', e.target.value)}
                  className="w-full bg-secondary/50 border border-white/5 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary text-[10px] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase font-bold px-1">End Date</label>
                <input
                  type="date"
                  value={params.endDate}
                  onChange={(e) => updateParam('endDate', e.target.value)}
                  className="w-full bg-secondary/50 border border-white/5 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary text-[10px] font-mono"
                />
              </div>
            </div>
          </div>

          <ParameterSlider
            label="Initial Balance"
            value={params.initialBalance}
            min={1000}
            max={100000}
            step={1000}
            unit="$"
            onChange={(v) => updateParam('initialBalance', v)}
          />
          <ParameterSlider
            label="Initial Drop"
            value={params.initialDropPercent}
            min={1}
            max={50}
            unit="%"
            onChange={(v) => updateParam('initialDropPercent', v)}
          />
          <ParameterSlider
            label="Grid Step (Down)"
            value={params.moveDownPercent}
            min={0.5}
            max={20}
            step={0.5}
            unit="%"
            onChange={(v) => updateParam('moveDownPercent', v)}
          />
          <ParameterSlider
            label="Profit Target (Up)"
            value={params.moveUpPercent}
            min={1}
            max={30}
            step={0.5}
            unit="%"
            onChange={(v) => updateParam('moveUpPercent', v)}
          />
          <ParameterSlider
            label="Buy Size"
            value={params.amountToBuy}
            min={100}
            max={10000}
            step={100}
            unit="$"
            onChange={(v) => updateParam('amountToBuy', v)}
          />

          <button
            onClick={runBacktest}
            disabled={loading}
            className="w-full mt-6 bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(0,255,122,0.2)]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
            ) : (
              <>
                <Play size={18} fill="currentColor" />
                Run Simulation
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1 uppercase tracking-widest font-semibold">
              <TrendingUp size={16} />
              Performance Overview
            </div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3">
              {params.symbol} Backtest
              <span className="text-xs bg-white/5 px-2 py-1 rounded-full border border-white/10 text-muted-foreground font-mono">
                {params.startDate} to {params.endDate}
              </span>
            </h2>
          </div>

          {(results.summary || loading) && (
            <div className="flex gap-4">
              <div className="text-right">
                <span className="text-xs text-muted-foreground block uppercase font-bold tracking-tighter">Total Return</span>
                {loading ? (
                  <Skeleton className="h-8 w-32 mt-1 ml-auto" />
                ) : (
                  results.summary && (
                    <span className={`text-2xl font-black ${results.summary.totalProfitRealized >= 0 ? 'text-primary' : 'text-red-400'}`}>
                      {results.summary.totalProfitRealized >= 0 ? '+' : ''}
                      ${results.summary.totalProfitRealized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )
                )}
              </div>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <StatCard
            label="Total Net Worth"
            value={`$${results.summary?.finalAccountValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
            icon={<DollarSign size={20} />}
            trend={results.summary ? (results.summary.finalAccountValue > results.summary.initialBalance) : null}
            loading={loading}
          />
          <StatCard
            label="Total Profit"
            value={`$${results.summary?.totalProfitRealized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
            icon={<TrendingUp size={20} />}
            trend={results.summary ? (results.summary.totalProfitRealized > 0) : null}
            loading={loading}
          />
          <StatCard
            label="Max Drawdown"
            value={`${results.summary?.maxDrawdownPercent.toFixed(2) || '0'}%`}
            icon={<TrendingDown size={20} />}
            negative
            loading={loading}
          />
          <StatCard
            label="Trades Executed"
            value={results.trades.length.toString()}
            icon={<Activity size={20} />}
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            label="Available Cash"
            value={`$${results.summary?.currentCashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0'}`}
            icon={<Wallet size={20} className="text-blue-400" />}
            loading={loading}
          />
          <StatCard
            label="Unsold Shares"
            value={results.summary?.unsoldShares.toFixed(2) || '0'}
            icon={<Briefcase size={20} className="text-orange-400" />}
            loading={loading}
          />
          <StatCard
            label="Avg Cost Basis"
            value={`$${results.summary?.averagePriceUnsold.toFixed(2) || '0'}`}
            icon={<Target size={20} className="text-purple-400" />}
            loading={loading}
          />
          <StatCard
            label="All-Time High"
            value={`$${results.summary?.peakValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
            icon={<TrendingUp size={20} className="text-primary" />}
            loading={loading}
          />
          <StatCard
            label="Peak Growth"
            value={`${results.summary ? (((results.summary.peakValue / results.summary.initialBalance) - 1) * 100).toFixed(2) : '0'}%`}
            icon={<Activity size={20} className="text-primary" />}
            loading={loading}
          />
        </div>

        {/* Chart Area */}
        <div className="p-8 rounded-2xl border border-white/10 glass rh-gradient">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">Equity Curve</h3>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-primary">
                <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_#00ff7a]" />
                Portfolio Value
              </div>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <BacktestChart data={results.equityHistory} />
          )}
        </div>

        {/* Trade History */}
        <TradeTable trades={results.trades} loading={loading} />

      </main>
    </div>
  );
}

function StatCard({ label, value, icon, trend, negative, loading }: any) {
  return (
    <div className="p-6 rounded-2xl border border-white/10 glass hover:border-white/20 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="bg-secondary p-2 rounded-xl text-muted-foreground group-hover:text-white transition-colors">
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-4 w-12 rounded-full" />
        ) : (
          trend !== null && trend !== undefined && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'}`}>
              {trend ? 'BULLISH' : 'BEARISH'}
            </span>
          )
        )}
      </div>
      <div className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-1">{label}</div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className={`text-2xl font-black ${negative ? 'text-red-400' : ''}`}>{value}</div>
      )}
    </div>
  );
}

export default App;
