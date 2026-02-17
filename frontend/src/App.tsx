import { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  DollarSign,
  TrendingDown,
  Briefcase,
  Target,
  Wallet,
  Activity,
  Play,
  Settings
} from 'lucide-react';
import { format } from "date-fns";
import { BacktestChart } from './components/BacktestChart';
import { TradeTable } from './components/TradeTable';
import { StrategyGuide } from './components/StrategyGuide';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/alert-dialog";
import { cn } from "./lib/utils";

import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { StatCard } from './components/StatCard';
import { Sidebar } from './components/Sidebar';
import { WelcomeState } from './components/WelcomeState';
import { ThemeProvider } from './components/theme-provider';
import { ModeToggle } from './components/ModeToggle';
import { Updates } from './pages/Updates';
import type { BacktestParams, BacktestResults } from './types';

const DEFAULT_PARAMS: BacktestParams = {
  symbol: 'SOFI',
  initialBalance: 10000,
  moveDownPercent: 2,
  moveUpPercent: 5,
  amountToBuy: 1000,
  startDate: '2025-01-01',
  endDate: '2025-02-28'
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  // Derive currentPage from location
  const currentPage = location.pathname === '/how-it-works' ? 'guide' :
    location.pathname === '/updates' ? 'updates' : 'simulator';

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Cooking the required details...');
  const [alertConfig, setAlertConfig] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'default' | 'error';
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'default'
  });

  const mainContentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
  }, [currentPage]);

  const loadingMessages = [
    "Cooking the required details...",
    "Performing the calculations...",
    "Hacking the mainframe for alpha...",
    "Summoning the profit demons...",
    "Grinding through years of data...",
    "Consulting the oracle...",
    "Optimizing for moon mission...",
    "Distilling market noise into gold...",
    "Calculating the perfect entry..."
  ];

  useEffect(() => {
    let interval: any;
    if (loading) {
      let index = 0;
      interval = setInterval(() => {
        index = (index + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[index]);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const [params, setParams] = useState<BacktestParams>(DEFAULT_PARAMS);

  const [results, setResults] = useState<BacktestResults>({
    trades: [],
    equityHistory: [],
    summary: null
  });

  const [lastRunParams, setLastRunParams] = useState<BacktestParams | null>(null);
  const isStale = !!results.summary && lastRunParams && JSON.stringify(params) !== JSON.stringify(lastRunParams);

  const runBacktest = async () => {
    setMobileSidebarOpen(false);
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

      setResults({
        trades: data.trades || [],
        equityHistory: data.equityHistory || [],
        summary: data.summary || null
      });
      setLastRunParams({ ...params });
      if (!data.trades || data.trades.length === 0) {
        console.warn('Backend returned zero trades.');
        setAlertConfig({
          open: true,
          title: 'No Trades Executed',
          description: 'No trades were executed for this period. Try increasing the date range or the ticker symbol.',
          variant: 'default'
        });
      }
    } catch (error: any) {
      console.error('Failed to run backtest:', error);
      setAlertConfig({
        open: true,
        title: 'Simulation Error',
        description: error.message || 'Failed to connect to backend API',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateParam = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const navigateHome = () => {
    setParams(DEFAULT_PARAMS);
    setResults({
      trades: [],
      equityHistory: [],
      summary: null
    });
    setLastRunParams(null);
    setMobileSidebarOpen(false);
    navigate('/');
  };

  const resetParams = () => {
    setParams(DEFAULT_PARAMS);
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="h-screen bg-background text-foreground flex overflow-hidden font-sans">
        <Sidebar
          params={params}
          loading={loading}
          onParamChange={updateParam}
          onResetParams={resetParams}
          onNavigateHome={navigateHome}
          onNavigateToSimulator={() => {
            navigate('/');
            setMobileSidebarOpen(false);
          }}
          onNavigateToGuide={() => {
            navigate('/how-it-works');
            setMobileSidebarOpen(false);
          }}
          onNavigateToUpdates={() => {
            navigate('/updates');
            setMobileSidebarOpen(false);
          }}
          onRunBacktest={() => {
            navigate('/');
            runBacktest();
          }}
          mobileOpen={mobileSidebarOpen}
          setMobileOpen={setMobileSidebarOpen}
          activePage={currentPage}
        />

        {/* Backdrop for mobile sidebar */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Persistent Mobile Header */}
          <header className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-md z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="p-2.5 rounded-xl bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-all active:scale-95 shadow-sm"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={navigateHome}
                className="flex flex-col text-left hover:opacity-80 transition-opacity active:scale-[0.98]"
              >
                <h1 className="text-sm font-black tracking-tight uppercase leading-none">Quant Node</h1>
                <span className="text-[10px] text-primary font-bold tracking-widest uppercase">Simulator</span>
              </button>
            </div>
            <ModeToggle />
          </header>

          {/* Main Content */}
          <main
            ref={mainContentRef}
            className="flex-1 p-4 md:p-8 overflow-y-auto relative w-full"
          >
            <Routes>
              <Route path="/how-it-works" element={<StrategyGuide onBack={() => navigate('/')} />} />
              <Route path="/updates" element={<Updates onBack={() => navigate('/')} />} />
              <Route path="/" element={
                <>
                  {isStale && !loading && !mobileSidebarOpen && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center animate-in fade-in duration-300">
                      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
                      <div className="relative bg-card/90 border border-primary/50 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-sm glass mx-4">
                        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                          <Activity className="text-primary animate-pulse" size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold">Settings Modified</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Your parameters have changed. Run the simulation again to update the results with the new data.
                          </p>
                        </div>
                        <button
                          onClick={runBacktest}
                          className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
                        >
                          <Play size={16} fill="currentColor" />
                          Update Simulation
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={cn(
                    "max-w-7xl mx-auto h-full flex flex-col transition-all duration-300",
                    (isStale && !loading) && "opacity-50 blur-[1px] pointer-events-none scale-[0.99]"
                  )}>
                    {!results.summary && !loading ? (
                      <WelcomeState
                        onOpenSidebar={() => setMobileSidebarOpen(true)}
                        onNavigateToGuide={() => navigate('/how-it-works')}
                      />
                    ) : (
                      <>
                        <header className="flex flex-col sm:flex-row justify-between items-center sm:items-center gap-2 mb-4 md:mb-6">
                          <div className="flex flex-col items-center sm:items-start w-full sm:w-auto text-center sm:text-left">
                            <div className="animate-in slide-in-from-left duration-500">
                              <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground text-xs mb-1 uppercase tracking-widest font-bold">
                                <TrendingUp size={14} />
                                Performance Overview
                              </div>
                              <h2 className="text-xl md:text-2xl font-black flex items-center justify-center sm:justify-start gap-2">
                                {params.symbol} <span >Backtest</span>
                              </h2>
                            </div>
                          </div>
                          <div className="animate-in slide-in-from-right duration-500 w-full sm:w-auto flex justify-center sm:justify-end">
                            <span className="text-[10px] md:text-sm bg-muted px-3 py-1.5 rounded-full border border-border text-muted-foreground font-mono font-medium truncate">
                              {format(new Date(params.startDate + 'T00:00:00'), "MMM d, yyyy")} - {format(new Date(params.endDate + 'T00:00:00'), "MMM d, yyyy")}
                            </span>
                          </div>
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
                            loading={loading}
                          />
                          <StatCard
                            label="Trades Executed"
                            value={(results.trades?.length || 0).toString()}
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
                        <div className="p-4 md:p-8 rounded-2xl md:rounded-3xl border border-border glass rh-gradient relative overflow-hidden group min-h-[400px] md:min-h-[500px]">
                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-xl font-bold tracking-tight">Equity Curve</h3>
                            <div className="flex gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                              <div className="flex items-center gap-2 text-primary">
                                <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                                Portfolio Value
                              </div>
                            </div>
                          </div>
                          <div className="h-full w-full relative min-h-[300px] md:min-h-[400px]">
                            {loading ? (
                              <div className="h-full w-full flex flex-col items-center justify-center gap-6">
                                <div className="h-full w-full bg-white/5 animate-pulse rounded-2xl" />
                                <div className="absolute flex flex-col items-center gap-4 bg-background/40 backdrop-blur-md p-8 rounded-3xl border border-border">
                                  <div className="h-12 w-12 border-4 border-primary/20 border-t-primary animate-spin rounded-full" />
                                  <p className="text-lg font-bold text-primary animate-pulse tracking-widest uppercase font-mono">
                                    {loadingMessage}
                                  </p>
                                </div>
                              </div>
                            ) : (results.equityHistory?.length || 0) > 0 ? (
                              <BacktestChart data={results.equityHistory} />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-2xl min-h-[300px] md:min-h-[400px]">
                                No chart data available
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Trade History */}
                        <div className="animate-in slide-in-from-bottom duration-700 pb-8 mt-6">
                          <TradeTable trades={results.trades || []} loading={loading} />
                        </div>
                      </>
                    )}
                  </div>
                </>
              } />
            </Routes>
          </main>

          <AlertDialog open={alertConfig.open} onOpenChange={(open) => setAlertConfig(prev => ({ ...prev, open }))}>
            <AlertDialogContent className="bg-background border-border glass">
              <AlertDialogHeader>
                <AlertDialogTitle className={cn(
                  "text-xl font-bold",
                  alertConfig.variant === 'error' ? "text-red-400" : "text-foreground"
                )}>
                  {alertConfig.title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  {alertConfig.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction className="bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">
                  Understood
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
