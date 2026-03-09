/**
 * Pure Trend EMA Strategy — Backtest & Optimizer
 * 
 * Dead simple: read the $IUXX trend with EMAs → buy TQQQ or SQQQ.
 * 
 *   RULE 1: Price > Trend EMA  AND  EMA slope rising  → Hold TQQQ
 *   RULE 2: Price < Trend EMA  AND  EMA slope falling → Hold SQQQ
 *   RULE 3: Otherwise → FLAT (cash)
 * 
 * Optional ATR trailing stop for risk management.
 * 
 * Usage:
 *   npx tsx backtest_trend.ts                               # quick test, default params
 *   npx tsx backtest_trend.ts optimize                      # full parameter sweep
 *   npx tsx backtest_trend.ts 2022-01-01 2025-02-28         # custom date range
 *   npx tsx backtest_trend.ts optimize 2022-01-01 2025-02-28
 */

import oracledb from 'oracledb';
import { getConn } from './api/_shared/db.js';

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const mode = process.argv[2] === 'optimize' ? 'optimize' : 'single';
const startDate = mode === 'optimize' ? (process.argv[3] || '2024-01-01') : (process.argv[2] || '2024-01-01');
const endDate = mode === 'optimize' ? (process.argv[4] || '2025-02-28') : (process.argv[3] || '2025-02-28');
const initialBalance = 10000;

interface DayBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface TradeRecord {
    date: string;
    action: string;      // BUY_TQQQ, BUY_SQQQ, SELL, FLAT
    etfPrice: number;
    shares: number;
    amount: number;
    profit: number;
    reason: string;
    balance: number;
    equity: number;
}

interface BacktestResult {
    finalValue: number;
    ret: number;
    maxDD: number;
    trades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    bhRet: number;
    beatBH: boolean;
    score: number;
    tradeLog: TradeRecord[];
    timeInTQQQ: number;
    timeInSQQQ: number;
    timeInCash: number;
}

// ═══════════════════════════════════════════════════════════
// EMA CALCULATION
// ═══════════════════════════════════════════════════════════
function calcEMA(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const mult = 2 / (period + 1);
    let ema: number | null = null;
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else if (i === period - 1) {
            // SMA as seed
            let sum = 0;
            for (let j = 0; j < period; j++) sum += data[j];
            ema = sum / period;
            result.push(ema);
        } else {
            ema = (data[i] - ema!) * mult + ema!;
            result.push(ema);
        }
    }
    return result;
}

// ═══════════════════════════════════════════════════════════
// ATR CALCULATION
// ═══════════════════════════════════════════════════════════
function calcATR(bars: DayBar[], period: number): (number | null)[] {
    const trs: number[] = [0];
    for (let i = 1; i < bars.length; i++) {
        trs.push(Math.max(
            bars[i].high - bars[i].low,
            Math.abs(bars[i].high - bars[i - 1].close),
            Math.abs(bars[i].low - bars[i - 1].close)
        ));
    }
    const result: (number | null)[] = [];
    for (let i = 0; i < period; i++) result.push(null);
    let atrSum = trs.slice(1, period + 1).reduce((a, b) => a + b, 0);
    result.push(atrSum / period);
    for (let i = period + 1; i < bars.length; i++) {
        const prev = result[i - 1]!;
        result.push((prev * (period - 1) + trs[i]) / period);
    }
    return result;
}

// ═══════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════
async function loadDailyBars(conn: any, symbol: string, start: string, end: string): Promise<DayBar[]> {
    const result = await conn.execute(
        `SELECT "trade_date" as "date", "open", "high", "low", "close", "volume"
         FROM "historical"
         WHERE "symbol" = :symbol AND "datetime" >= :startDate AND "datetime" <= :endDate
         ORDER BY "datetime" ASC`,
        { symbol, startDate: start, endDate: end },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Resample to daily bars
    const dayMap = new Map<string, DayBar>();
    for (const r of (result.rows as any[])) {
        const d = r.date;
        if (!dayMap.has(d)) {
            dayMap.set(d, { date: d, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume });
        } else {
            const bar = dayMap.get(d)!;
            if (r.high > bar.high) bar.high = r.high;
            if (r.low < bar.low) bar.low = r.low;
            bar.close = r.close;
            bar.volume += r.volume;
        }
    }
    return Array.from(dayMap.values());
}

// ═══════════════════════════════════════════════════════════
// CORE BACKTEST ENGINE
// ═══════════════════════════════════════════════════════════
interface TrendParams {
    trendEMA: number;       // Main trend EMA period (e.g., 50)
    slopeBars: number;      // How many bars to measure EMA slope (e.g., 5)
    trailPct: number;       // Trailing stop % on ETF price (0 = disabled, e.g., 10 = 10%)
    confirmBars: number;    // Bars of consistent signal before entry (0 = immediate)
    useSecondEMA: boolean;  // Require fast EMA > slow EMA alignment
    fastEMA: number;        // Fast EMA period (only if useSecondEMA)
}

function runTrendBacktest(
    iuxxBars: DayBar[],
    tqqqPriceMap: Map<string, number>,
    sqqqPriceMap: Map<string, number>,
    params: TrendParams
): BacktestResult {
    const closes = iuxxBars.map(b => b.close);
    const trendEMAValues = calcEMA(closes, params.trendEMA);
    const fastEMAValues = params.useSecondEMA ? calcEMA(closes, params.fastEMA) : [];

    let cash = initialBalance;
    let position: { direction: 'TQQQ' | 'SQQQ'; shares: number; buyPrice: number; amount: number; peakPrice: number; buyDate: string } | null = null;
    const trades: TradeRecord[] = [];
    let peakEquity = initialBalance;
    let maxDD = 0;
    let confirmCount = 0;
    let lastSignal: 'TQQQ' | 'SQQQ' | 'FLAT' = 'FLAT';
    let barsInTQQQ = 0, barsInSQQQ = 0, barsInCash = 0;

    // Buy & Hold tracking
    const firstTQQQPrice = tqqqPriceMap.get(iuxxBars[0]?.date);
    const lastTQQQPrice = tqqqPriceMap.get(iuxxBars[iuxxBars.length - 1]?.date);
    const bhRet = (firstTQQQPrice && lastTQQQPrice)
        ? ((lastTQQQPrice - firstTQQQPrice) / firstTQQQPrice * 100) : 0;

    for (let i = 0; i < iuxxBars.length; i++) {
        const bar = iuxxBars[i];
        const ema = trendEMAValues[i];
        const prevEma = i >= params.slopeBars && trendEMAValues[i - params.slopeBars] != null
            ? trendEMAValues[i - params.slopeBars]! : null;

        if (ema == null || prevEma == null) {
            barsInCash++;
            continue;
        }

        // ========== TREND SIGNAL ==========
        const emaSlope = (ema - prevEma) / prevEma * 100;
        const priceAboveEMA = bar.close > ema;
        const priceBelowEMA = bar.close < ema;
        const emaRising = emaSlope > 0;
        const emaFalling = emaSlope < 0;

        let signal: 'TQQQ' | 'SQQQ' | 'FLAT' = 'FLAT';
        if (priceAboveEMA && emaRising) {
            signal = 'TQQQ';
        } else if (priceBelowEMA && emaFalling) {
            signal = 'SQQQ';
        }

        // Optional: require fast EMA > slow EMA alignment
        if (params.useSecondEMA && fastEMAValues[i] != null) {
            if (signal === 'TQQQ' && fastEMAValues[i]! < ema) signal = 'FLAT';
            if (signal === 'SQQQ' && fastEMAValues[i]! > ema) signal = 'FLAT';
        }

        // Confirmation: require N consecutive bars of same signal
        if (signal === lastSignal && signal !== 'FLAT') {
            confirmCount++;
        } else {
            confirmCount = signal !== 'FLAT' ? 1 : 0;
        }
        lastSignal = signal;

        const confirmedSignal = confirmCount >= params.confirmBars ? signal : 'FLAT';

        // ========== GET ETF PRICES ==========
        const tqqqPrice = tqqqPriceMap.get(bar.date);
        const sqqqPrice = sqqqPriceMap.get(bar.date);

        // ========== PCT TRAILING STOP CHECK ==========
        if (position && params.trailPct > 0) {
            const etfMap = position.direction === 'TQQQ' ? tqqqPriceMap : sqqqPriceMap;
            const curEtfPrice = etfMap.get(bar.date) ?? position.buyPrice;

            // Update peak ETF price
            if (curEtfPrice > position.peakPrice) position.peakPrice = curEtfPrice;

            const dropPct = (position.peakPrice - curEtfPrice) / position.peakPrice * 100;
            if (dropPct >= params.trailPct) {
                // Trail stop hit — exit
                const sellAmount = position.shares * curEtfPrice;
                const profit = sellAmount - position.amount;
                cash += sellAmount;
                trades.push({
                    date: bar.date, action: `SELL_${position.direction}`, etfPrice: curEtfPrice,
                    shares: position.shares, amount: sellAmount, profit,
                    reason: `Trail Stop (${dropPct.toFixed(1)}% from peak $${position.peakPrice.toFixed(2)})`,
                    balance: cash, equity: cash
                });
                position = null;
            }
        }

        // ========== EXIT: Signal changed ==========
        if (position) {
            const shouldExit = (position.direction === 'TQQQ' && confirmedSignal !== 'TQQQ')
                || (position.direction === 'SQQQ' && confirmedSignal !== 'SQQQ');

            if (shouldExit) {
                const etfMap = position.direction === 'TQQQ' ? tqqqPriceMap : sqqqPriceMap;
                const sellPrice = etfMap.get(bar.date) ?? position.buyPrice;
                const sellAmount = position.shares * sellPrice;
                const profit = sellAmount - position.amount;
                cash += sellAmount;
                trades.push({
                    date: bar.date, action: `SELL_${position.direction}`, etfPrice: sellPrice,
                    shares: position.shares, amount: sellAmount, profit,
                    reason: `Trend Reversed → ${confirmedSignal}`,
                    balance: cash, equity: cash
                });
                position = null;
            }
        }

        // ========== ENTRY ==========
        if (!position && confirmedSignal !== 'FLAT') {
            const etfPrice = confirmedSignal === 'TQQQ' ? tqqqPrice : sqqqPrice;
            if (etfPrice && cash > 100) {
                const shares = cash / etfPrice;
                const amount = cash;
                position = {
                    direction: confirmedSignal,
                    shares, buyPrice: etfPrice, amount,
                    peakPrice: etfPrice, buyDate: bar.date
                };
                cash = 0;
                trades.push({
                    date: bar.date, action: `BUY_${confirmedSignal}`, etfPrice,
                    shares, amount, profit: 0,
                    reason: `Trend=${confirmedSignal} (EMA slope=${emaSlope.toFixed(3)}%)`,
                    balance: cash, equity: amount
                });
            }
        }

        // Track time allocation
        if (position?.direction === 'TQQQ') barsInTQQQ++;
        else if (position?.direction === 'SQQQ') barsInSQQQ++;
        else barsInCash++;

        // Equity tracking
        let equity = cash;
        if (position) {
            const etfMap = position.direction === 'TQQQ' ? tqqqPriceMap : sqqqPriceMap;
            const curPrice = etfMap.get(bar.date) ?? position.buyPrice;
            equity += position.shares * curPrice;
        }
        if (equity > peakEquity) peakEquity = equity;
        const dd = peakEquity > 0 ? (peakEquity - equity) / peakEquity * 100 : 0;
        if (dd > maxDD) maxDD = dd;
    }

    // Close any open position at end
    let finalValue = cash;
    if (position) {
        const lastBar = iuxxBars[iuxxBars.length - 1];
        const etfMap = position.direction === 'TQQQ' ? tqqqPriceMap : sqqqPriceMap;
        const lastPrice = etfMap.get(lastBar.date) ?? position.buyPrice;
        finalValue = cash + position.shares * lastPrice;
    }

    // Compute stats
    const sells = trades.filter(t => t.action.startsWith('SELL'));
    const wins = sells.filter(t => t.profit > 0);
    const losses = sells.filter(t => t.profit < 0);
    const totalWins = wins.reduce((a, t) => a + t.profit, 0);
    const totalLosses = Math.abs(losses.reduce((a, t) => a + t.profit, 0));
    const ret = ((finalValue - initialBalance) / initialBalance * 100);
    const totalBars = barsInTQQQ + barsInSQQQ + barsInCash;

    return {
        finalValue, ret, maxDD,
        trades: trades.length,
        winRate: sells.length > 0 ? (wins.length / sells.length * 100) : 0,
        avgWin: wins.length > 0 ? totalWins / wins.length : 0,
        avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
        profitFactor: totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 99 : 0),
        bhRet, beatBH: ret > bhRet,
        score: maxDD > 0 ? ret / maxDD : 0,
        tradeLog: trades,
        timeInTQQQ: totalBars > 0 ? barsInTQQQ / totalBars * 100 : 0,
        timeInSQQQ: totalBars > 0 ? barsInSQQQ / totalBars * 100 : 0,
        timeInCash: totalBars > 0 ? barsInCash / totalBars * 100 : 0,
    };
}

// ═══════════════════════════════════════════════════════════
// FORMAT RESULTS
// ═══════════════════════════════════════════════════════════
function printResult(label: string, r: BacktestResult, verbose = false) {
    console.log(`\n  ${label}`);
    console.log(`  ${'─'.repeat(60)}`);
    console.log(`  Final Value:     $${r.finalValue.toFixed(2)}  (${r.ret > 0 ? '+' : ''}${r.ret.toFixed(2)}%)`);
    console.log(`  Buy & Hold:      ${r.bhRet > 0 ? '+' : ''}${r.bhRet.toFixed(2)}%  ${r.beatBH ? '✅ BEAT' : '❌ LOST'}`);
    console.log(`  Max Drawdown:    ${r.maxDD.toFixed(2)}%`);
    console.log(`  Score (R/DD):    ${r.score.toFixed(3)}`);
    console.log(`  Trades:          ${r.trades}  |  Win Rate: ${r.winRate.toFixed(0)}%`);
    console.log(`  Avg Win/Loss:    $${r.avgWin.toFixed(2)} / $${r.avgLoss.toFixed(2)}  |  PF: ${r.profitFactor.toFixed(2)}`);
    console.log(`  Time: TQQQ=${r.timeInTQQQ.toFixed(0)}% | SQQQ=${r.timeInSQQQ.toFixed(0)}% | Cash=${r.timeInCash.toFixed(0)}%`);

    if (verbose && r.tradeLog.length > 0) {
        console.log(`\n  TRADE LOG:`);
        console.log(`  ${'─'.repeat(100)}`);
        console.log(`  ${'Date'.padEnd(12)} | ${'Action'.padEnd(12)} | ${'ETF Price'.padEnd(10)} | ${'Shares'.padEnd(10)} | ${'P&L'.padEnd(12)} | Reason`);
        console.log(`  ${'─'.repeat(100)}`);
        for (const t of r.tradeLog) {
            const pnl = t.profit !== 0 ? `${t.profit > 0 ? '+' : ''}$${t.profit.toFixed(2)}` : '—';
            console.log(
                `  ${t.date.padEnd(12)} | ${t.action.padEnd(12)} | $${t.etfPrice.toFixed(2).padEnd(9)} | ${t.shares.toFixed(2).padEnd(10)} | ${pnl.padEnd(12)} | ${t.reason.substring(0, 50)}`
            );
        }
    }
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
    console.log(`\n${'═'.repeat(90)}`);
    console.log(`  PURE TREND EMA STRATEGY — $IUXX → TQQQ/SQQQ`);
    console.log(`  Mode: ${mode.toUpperCase()} | Date: ${startDate} → ${endDate}`);
    console.log(`${'═'.repeat(90)}\n`);

    // Load data
    const conn = await getConn();
    const bufferStart = new Date(startDate);
    bufferStart.setDate(bufferStart.getDate() - 300); // buffer for EMA warmup
    const bufStart = bufferStart.toISOString().split('T')[0];

    console.log('  Loading $IUXX daily bars...');
    const iuxxBars = await loadDailyBars(conn, '$IUXX', bufStart, endDate);
    console.log(`  → ${iuxxBars.length} daily bars`);

    console.log('  Loading TQQQ prices...');
    const tqqqBars = await loadDailyBars(conn, 'TQQQ', bufStart, endDate);
    const tqqqPriceMap = new Map(tqqqBars.map(b => [b.date, b.close]));
    console.log(`  → ${tqqqBars.length} TQQQ bars`);

    console.log('  Loading SQQQ prices...');
    const sqqqBars = await loadDailyBars(conn, 'SQQQ', bufStart, endDate);
    const sqqqPriceMap = new Map(sqqqBars.map(b => [b.date, b.close]));
    console.log(`  → ${sqqqBars.length} SQQQ bars\n`);

    // Filter to actual backtest range
    const testBars = iuxxBars.filter(b => b.date >= startDate && b.date <= endDate);
    // But keep full bars for EMA warmup — we compute on full range, test on filtered
    // Actually better: compute indicators on full data, then only trade on test range
    // We'll pass full bars but mark the start index
    const startIdx = iuxxBars.findIndex(b => b.date >= startDate);

    if (mode === 'single') {
        // Single run with default params
        const result = runTrendBacktest(iuxxBars.slice(Math.max(0, startIdx - 200)), tqqqPriceMap, sqqqPriceMap, {
            trendEMA: 50, slopeBars: 5, trailPct: 0,
            confirmBars: 1, useSecondEMA: false, fastEMA: 13,
        });
        printResult('DEFAULT: EMA(50), Slope(5), No Trail, Confirm(1)', result, true);
    } else {
        // ═══════════════════════════════════════════════════════════
        // OPTIMIZER MODE
        // ═══════════════════════════════════════════════════════════
        interface SweepResult { label: string; params: TrendParams; result: BacktestResult }
        const allResults: SweepResult[] = [];
        let count = 0;

        // Phase 1: EMA period × slope bars
        console.log('📊 PHASE 1: Trend EMA Period × Slope Detection\n');
        const emaPeriods = [20, 30, 40, 50, 60, 80, 100, 150, 200];
        const slopeBars = [3, 5, 8, 10];

        for (const ema of emaPeriods) {
            for (const slope of slopeBars) {
                count++;
                const params: TrendParams = {
                    trendEMA: ema, slopeBars: slope, trailPct: 0,
                    confirmBars: 1, useSecondEMA: false, fastEMA: 13,
                };
                const label = `EMA(${ema}) slope(${slope})`;
                const bars = iuxxBars.slice(Math.max(0, startIdx - Math.max(ema + 50, 200)));
                const r = runTrendBacktest(bars, tqqqPriceMap, sqqqPriceMap, params);
                allResults.push({ label, params, result: r });
                const sign = r.ret > 0 ? '+' : '';
                process.stdout.write(`  [${count}] ${label.padEnd(25)} → ${sign}${r.ret.toFixed(1)}% | ${r.maxDD.toFixed(0)}%DD | ${r.trades}T | WR=${r.winRate.toFixed(0)}% | score=${r.score.toFixed(2)}\n`);
            }
        }

        // Phase 2: Percentage trailing stops on top 5
        console.log('\n📊 PHASE 2: PCT Trailing Stops (top 5)\n');
        const top5 = [...allResults].sort((a, b) => b.result.score - a.result.score).slice(0, 5);
        const trailPcts = [0, 5, 8, 10, 12, 15, 20, 25];

        for (const top of top5) {
            for (const trail of trailPcts) {
                count++;
                const params = { ...top.params, trailPct: trail };
                const label = `${top.label} trail(${trail}%)`;
                const bars = iuxxBars.slice(Math.max(0, startIdx - Math.max(params.trendEMA + 50, 200)));
                const r = runTrendBacktest(bars, tqqqPriceMap, sqqqPriceMap, params);
                allResults.push({ label, params, result: r });
                const sign = r.ret > 0 ? '+' : '';
                process.stdout.write(`  [${count}] ${label.padEnd(30)} → ${sign}${r.ret.toFixed(1)}% | ${r.maxDD.toFixed(0)}%DD | ${r.trades}T | WR=${r.winRate.toFixed(0)}% | score=${r.score.toFixed(2)}\n`);
            }
        }

        // Phase 3: Confirmation bars on top 5
        console.log('\n📊 PHASE 3: Confirmation Bars (top 5)\n');
        const top5b = [...allResults].sort((a, b) => b.result.score - a.result.score).slice(0, 5);
        const confirmBars = [0, 1, 2, 3, 5];

        for (const top of top5b) {
            for (const cb of confirmBars) {
                count++;
                const params = { ...top.params, confirmBars: cb };
                const label = `${top.label.split(' trail')[0]} trail(${params.trailPct}%) confirm(${cb})`;
                const bars = iuxxBars.slice(Math.max(0, startIdx - Math.max(params.trendEMA + 50, 200)));
                const r = runTrendBacktest(bars, tqqqPriceMap, sqqqPriceMap, params);
                allResults.push({ label, params, result: r });
                const sign = r.ret > 0 ? '+' : '';
                process.stdout.write(`  [${count}] ${label.padEnd(40)} → ${sign}${r.ret.toFixed(1)}% | ${r.maxDD.toFixed(0)}%DD | ${r.trades}T | WR=${r.winRate.toFixed(0)}% | score=${r.score.toFixed(2)}\n`);
            }
        }

        // Phase 4: Add fast EMA filter on top 5
        console.log('\n📊 PHASE 4: Fast EMA Filter (top 5)\n');
        const top5c = [...allResults].sort((a, b) => b.result.score - a.result.score).slice(0, 5);
        const fastEMAs = [8, 13, 21];

        for (const top of top5c) {
            for (const fast of fastEMAs) {
                if (fast >= top.params.trendEMA) continue; // skip if fast >= trend
                count++;
                const params = { ...top.params, useSecondEMA: true, fastEMA: fast };
                const label = `${top.label.split(' confirm')[0].split(' trail')[0]} fast(${fast}) trail(${params.trailPct}%)`;
                const bars = iuxxBars.slice(Math.max(0, startIdx - Math.max(params.trendEMA + 50, 200)));
                const r = runTrendBacktest(bars, tqqqPriceMap, sqqqPriceMap, params);
                allResults.push({ label, params, result: r });
                const sign = r.ret > 0 ? '+' : '';
                process.stdout.write(`  [${count}] ${label.padEnd(45)} → ${sign}${r.ret.toFixed(1)}% | ${r.maxDD.toFixed(0)}%DD | ${r.trades}T | WR=${r.winRate.toFixed(0)}% | score=${r.score.toFixed(2)}\n`);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // FINAL REPORT
        // ═══════════════════════════════════════════════════════════
        // De-duplicate
        const seen = new Set<string>();
        const unique = [...allResults]
            .sort((a, b) => b.result.score - a.result.score)
            .filter(r => {
                const key = JSON.stringify(r.params);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

        const bhRet = unique[0]?.result.bhRet ?? 0;

        console.log(`\n${'═'.repeat(120)}`);
        console.log(`  FINAL RESULTS — Pure Trend EMA on $IUXX → TQQQ/SQQQ (${count} configs, ${unique.length} unique)`);
        console.log(`  Buy & Hold (TQQQ): ${bhRet > 0 ? '+' : ''}${bhRet.toFixed(1)}%    Date: ${startDate} → ${endDate}`);
        console.log(`${'═'.repeat(120)}\n`);

        console.log(
            `${'Rank'.padEnd(5)} | ${'Config'.padEnd(50)} | ${'Return'.padEnd(9)} | ${'MaxDD'.padEnd(7)} | ${'Trades'.padEnd(7)} | ${'WinR'.padEnd(6)} | ${'PF'.padEnd(6)} | ${'Score'.padEnd(7)} | ${'TQQQ%'.padEnd(6)} | ${'SQQQ%'.padEnd(6)} | B&H`
        );
        console.log('─'.repeat(130));

        unique.slice(0, 20).forEach((r, idx) => {
            const rank = idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `${idx + 1}.`;
            console.log(
                `${rank.padEnd(5)} | ${r.label.substring(0, 50).padEnd(50)} | ` +
                `${(r.result.ret > 0 ? '+' : '') + r.result.ret.toFixed(1) + '%'}`.padEnd(9) +
                ` | ${(r.result.maxDD.toFixed(1) + '%').padEnd(7)}` +
                ` | ${String(r.result.trades).padEnd(7)}` +
                ` | ${(r.result.winRate.toFixed(0) + '%').padEnd(6)}` +
                ` | ${r.result.profitFactor.toFixed(1).padEnd(6)}` +
                ` | ${r.result.score.toFixed(2).padEnd(7)}` +
                ` | ${(r.result.timeInTQQQ.toFixed(0) + '%').padEnd(6)}` +
                ` | ${(r.result.timeInSQQQ.toFixed(0) + '%').padEnd(6)}` +
                ` | ${r.result.beatBH ? '✅' : '❌'}`
            );
        });

        // Print best config
        const best = unique[0];
        printResult('🏆 BEST CONFIG', best.result, true);
        console.log(`\n  Parameters: ${JSON.stringify(best.params, null, 2)}\n`);
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
