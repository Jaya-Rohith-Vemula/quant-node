import { format, subDays, parseISO } from 'date-fns';
import { db, getConn } from './db.js';
import oracledb from 'oracledb';

interface Position {
    id: number;
    buyPrice: number;
    peakPrice: number; // Added to track highest price since purchase for trailing stops
    shares: number;
    amount: number;
    buyTime: string;
}

export interface StrategyParams {
    symbol: string;
    initialBalance: number;
    startDate: string;
    endDate: string;
    strategyType: string;
    strategyParams: Record<string, any>;
    timeframe?: string; // New: 1m (default), 5m, 15m, 1h, 1d
}

export interface TradeRecord {
    tradeNo: number;
    datetime: string;
    type: 'BUY' | 'SELL';
    symbol: string;
    price: number;
    shares: number;
    totalShares: number;
    remainingBalance: number;
    accountBalance: number;
    amount: number;
    profit: number;
    comment: string;
}

function calculateRSI(prices: number[], period: number) {
    const rsis: (number | null)[] = [];
    if (prices.length <= period) return new Array(prices.length).fill(null);

    let gains = 0;
    let losses = 0;

    // Initial period
    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = 0; i < period; i++) rsis.push(null);

    const initialRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsis.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + initialRS)));

    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        if (avgLoss === 0) {
            rsis.push(100);
        } else {
            const rs = avgGain / avgLoss;
            rsis.push(100 - (100 / (1 + rs)));
        }
    }

    return rsis;
}

function calculateSMA(prices: number[], period: number) {
    const smas: (number | null)[] = [];
    if (prices.length < period) return new Array(prices.length).fill(null);

    let sum = 0;
    for (let i = 0; i < prices.length; i++) {
        sum += prices[i];
        if (i >= period) {
            sum -= prices[i - period];
        }
        if (i >= period - 1) {
            smas.push(sum / period);
        } else {
            smas.push(null);
        }
    }
    return smas;
}

function calculateEMA(prices: number[], period: number) {
    const emas: (number | null)[] = [];
    if (prices.length === 0) return emas;

    const k = 2 / (period + 1);
    let ema = prices[0];
    emas.push(ema);

    for (let i = 1; i < prices.length; i++) {
        ema = (prices[i] * k) + (ema * (1 - k));
        emas.push(ema);
    }
    return emas;
}

export async function runBacktest(params: StrategyParams) {
    const conn = await getConn();

    const {
        symbol,
        initialBalance,
        startDate,
        endDate,
        strategyType,
        strategyParams,
        timeframe = '1m'
    } = params;

    console.log(`[${new Date().toISOString()}] Starting ${strategyType} analysis for ${symbol} on ${timeframe} timeframe...`);

    // --- LOOKBACK BUFFER CALCULATION ---
    // If we have periods (like 200 SMA), we need data BEFORE the 'startDate' to have a signal on day 1.
    const fastPeriodReq = strategyParams.fastPeriod ?? 50;
    const slowPeriodReq = strategyParams.slowPeriod ?? 200;
    const rsiPeriodReq = strategyParams.rsiPeriod ?? 14;
    const amrTrendEMA = strategyParams.trendEMA ?? 50;
    const maxPeriod = Math.max(fastPeriodReq, slowPeriodReq, rsiPeriodReq, amrTrendEMA);

    let queryStartDate = startDate;
    if (maxPeriod > 0) {
        const startDt = parseISO(startDate);
        let lookbackDays = 0;
        if (timeframe === '1d' || timeframe === '1-day' || timeframe === 'Daily') {
            lookbackDays = maxPeriod * 1.5 + 20; // 1.5x for weekends/holidays
        } else if (timeframe === '1h' || timeframe === 'hourly') {
            lookbackDays = Math.ceil((maxPeriod / 6.5) * 1.5) + 5; // ~6.5 trading hours per day
        } else if (timeframe.endsWith('m')) {
            const mins = parseInt(timeframe);
            lookbackDays = Math.ceil(((maxPeriod * mins) / 390) * 1.5) + 2;
        } else {
            lookbackDays = 20; // default safe buffer for 1m
        }
        queryStartDate = format(subDays(startDt, Math.max(2, lookbackDays)), 'yyyy-MM-dd');
    }

    console.log(`[${new Date().toISOString()}] Querying OCI for ${symbol} data from ${queryStartDate} (Buffer for indicators)...`);

    // Use raw oracledb connection for the large fetch for better performance
    let result;
    try {
        result = await conn.execute(
            `SELECT "datetime", "trade_date" as "date", "trade_time" as "time", "open", "high", "low", "close", "volume" 
             FROM "historical" 
             WHERE "symbol" = :symbol 
               AND "datetime" >= :startDate 
               AND "datetime" <= :endDate 
             ORDER BY "datetime" ASC`,
            { symbol, startDate: queryStartDate, endDate },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
    } catch (err: any) {
        console.error(`[${new Date().toISOString()}] OCI Query Error:`, err.message);
        throw err;
    }

    let rows = result.rows as any[];
    console.log(`[${new Date().toISOString()}] Retrieved ${rows.length} rows from OCI for ${symbol}`);

    // --- EOD DIRECTIONAL: Also fetch TQQQ and SQQQ actual price data ---
    const eodTQQQPriceMap = new Map<string, { open: number; high: number; low: number; close: number }>();
    const eodSQQQPriceMap = new Map<string, { open: number; high: number; low: number; close: number }>();
    if (strategyType === 'eod_directional') {
        for (const etfSymbol of ['TQQQ', 'SQQQ']) {
            console.log(`[${new Date().toISOString()}] Fetching ${etfSymbol} data for EOD directional execution...`);
            try {
                const etfResult = await conn.execute(
                    `SELECT "datetime", "trade_date" as "date", "open", "high", "low", "close"
                     FROM "historical"
                     WHERE "symbol" = :symbol
                       AND "datetime" >= :startDate
                       AND "datetime" <= :endDate
                     ORDER BY "datetime" ASC`,
                    { symbol: etfSymbol, startDate: queryStartDate, endDate },
                    { outFormat: oracledb.OUT_FORMAT_OBJECT }
                );
                const etfRows = etfResult.rows as any[];
                console.log(`[${new Date().toISOString()}] Retrieved ${etfRows.length} ${etfSymbol} rows`);
                const priceMap = etfSymbol === 'TQQQ' ? eodTQQQPriceMap : eodSQQQPriceMap;
                for (const r of etfRows) {
                    // Key by date for daily matching
                    const dateKey = r.date || r.datetime.split(' ')[0];
                    priceMap.set(dateKey, { open: r.open, high: r.high, low: r.low, close: r.close });
                }
            } catch (err: any) {
                console.error(`[${new Date().toISOString()}] Failed to fetch ${etfSymbol}:`, err.message);
            }
        }
        console.log(`[${new Date().toISOString()}] TQQQ dates: ${eodTQQQPriceMap.size}, SQQQ dates: ${eodSQQQPriceMap.size}`);
    }

    // --- DATA RESAMPLING ---
    if (timeframe !== '1m' && timeframe !== '1-minute' && rows.length > 0) {
        console.log(`[${new Date().toISOString()}] Resampling data to ${timeframe}...`);
        const resampled: any[] = [];
        let currentBar: any = null;

        const getBarKey = (row: any) => {
            // "2024-10-01 04:00" -> Date object
            const dt = new Date(row.datetime.replace(' ', 'T'));
            if (timeframe === '1d' || timeframe === '1-day' || timeframe === 'Daily') {
                return row.date;
            }
            if (timeframe === '1h' || timeframe === 'hourly') {
                dt.setMinutes(0, 0, 0);
                return format(dt, 'yyyy-MM-dd HH:mm');
            }
            if (timeframe.endsWith('m')) {
                const mins = parseInt(timeframe);
                const currentMins = dt.getMinutes();
                dt.setMinutes(Math.floor(currentMins / mins) * mins, 0, 0);
                return format(dt, 'yyyy-MM-dd HH:mm');
            }
            return row.date;
        };

        for (const row of rows) {
            const key = getBarKey(row);
            if (!currentBar || currentBar.datetime !== key) {
                if (currentBar) resampled.push(currentBar);
                currentBar = {
                    datetime: key,
                    date: key.split(' ')[0],
                    open: row.open,
                    high: row.high,
                    low: row.low,
                    close: row.close,
                    volume: row.volume
                };
            } else {
                currentBar.high = Math.max(currentBar.high, row.high);
                currentBar.low = Math.min(currentBar.low, row.low);
                currentBar.close = row.close;
                currentBar.volume += row.volume;
            }
        }
        if (currentBar) resampled.push(currentBar);
        rows = resampled;
        console.log(`[${new Date().toISOString()}] Resampled to ${rows.length} rows`);
    }

    if (rows.length === 0) {
        console.warn('No data found for the selected symbol and date range.');
        return {
            trades: [],
            equityHistory: [],
            summary: {
                symbol,
                totalProfitRealized: 0,
                currentCashBalance: initialBalance,
                unsoldShares: 0,
                averagePriceUnsold: 0,
                finalAccountValue: initialBalance,
                maxDrawdownPercent: 0,
                maxDrawdownAmount: 0,
                peakValue: initialBalance,
                initialBalance,
                buyAndHoldFinalValue: initialBalance,
                buyAndHoldReturnPercent: 0
            }
        };
    }

    // Common Simulation State
    let currentBalance = initialBalance;
    let openPositions: Position[] = [];
    let positionIdCounter = 1;
    let totalProfit = 0;
    let trades: TradeRecord[] = [];
    let equityHistory: { datetime: string, accountBalance: number, buyAndHoldBalance: number, stockPrice: number }[] = [];
    let tradeNoCounter = 1;
    let totalSharesHeld = 0;
    let totalInvestedInUnsold = 0;
    let lastTradeDay = ''; // To avoid multiple trades on the same day for RSI

    // Buy-and-Hold Baseline calculation
    // Important: Buy price should be the first price AT or AFTER the requested startDate
    const startIdx = rows.findIndex(r => r.datetime >= startDate);
    const simulationStartIndex = startIdx === -1 ? 0 : startIdx;

    const initialPrice = rows[simulationStartIndex] ? rows[simulationStartIndex].close : rows[0].close;
    const buyAndHoldShares = initialBalance / initialPrice;

    // Performance metrics
    let peakValue = initialBalance;
    let peakValueTime = rows[0].datetime;
    let minEquity = initialBalance;
    let minEquityTime = rows[0].datetime;
    let maxDrawdownPercent = 0;
    let maxDrawdownAmount = 0;
    let maxDrawdownPeakTime = rows[0].datetime;
    let maxDrawdownTroughTime = rows[0].datetime;

    // Strategy Specific Setup
    let dailyHighMap = new Map<string, number>();
    let maxSeenToday = 0;
    let currentDateStr = '';
    let referencePrice = 0;
    let hasTradedGrid = false;

    // Grid Trading Specific Params
    const moveDownPercent = strategyParams.moveDownPercent ?? 2;
    const moveUpPercent = strategyParams.moveUpPercent ?? 5;
    const amountToBuyGrid = strategyParams.amountToBuy ?? 1000;
    const moveDownDecimal = moveDownPercent / 100;
    const moveUpDecimal = moveUpPercent / 100;

    // --- INTRADAY CONTROLS ---
    const isIntradayLegacy = strategyParams.intradayExit === 1;

    // Explicit new params (if defined) take precedence over legacy fallback
    const useMarketHoursOnly = strategyParams.marketHoursOnly !== undefined
        ? strategyParams.marketHoursOnly === 1
        : (strategyType === 'sma_crossover' ? true : isIntradayLegacy);

    const useForceEodExit = strategyParams.forceEodExit !== undefined
        ? strategyParams.forceEodExit === 1
        : isIntradayLegacy;

    const isMarketHoursOnly = useMarketHoursOnly &&
        timeframe !== '1d' && timeframe !== '1-day' && timeframe !== 'Daily';

    const isEodExitActive = useForceEodExit &&
        timeframe !== '1d' && timeframe !== '1-day' && timeframe !== 'Daily';

    // --- MARKET HOURS FILTERING (EARLY) ---
    // If Market Hours Only is ON, we strip out all non-market-hour data before calculating indicators/SMAs.
    if (isMarketHoursOnly) {
        console.log(`[${new Date().toISOString()}] Filtering to market hours ONLY for indicator calculation...`);
        rows = rows.filter(row => {
            const timePart = row.datetime.includes(' ') ? row.datetime.split(' ')[1] : '';
            return timePart >= '09:30' && timePart <= '16:00';
        });
        console.log(`[${new Date().toISOString()}] Data set reduced to ${rows.length} market-hour bars.`);
    }

    // RSI Specific Setup
    const rsiPeriod = strategyParams.rsiPeriod ?? 14;
    const oversoldThreshold = strategyParams.oversoldThreshold ?? 30;
    const overboughtThreshold = strategyParams.overboughtThreshold ?? 70;
    const rsiValues = (strategyType === 'rsi_mean_reversion' || strategyType === 'amr') ? calculateRSI(rows.map(r => r.close), rsiPeriod) : [];

    // SMA Specific Setup
    const fastPeriod = strategyParams.fastPeriod ?? 50;
    const slowPeriod = strategyParams.slowPeriod ?? 200;
    const trailingStopPercent = strategyParams.trailingStopPercent ?? 0;

    const fastSMA = strategyType === 'sma_crossover' ? calculateSMA(rows.map(r => r.close), fastPeriod) : [];
    const slowSMA = strategyType === 'sma_crossover' ? calculateSMA(rows.map(r => r.close), slowPeriod) : [];

    // --- AMR (Adaptive Momentum Rider) Setup ---
    const amrFastEMAPeriod = strategyParams.fastEMA ?? 8;
    const amrSlowEMAPeriod = strategyParams.slowEMA ?? 21;
    const amrTrendEMAPeriod = strategyParams.trendEMA ?? 50;
    const amrTrendTrailATR = strategyParams.trendTrailATR ?? 2.5;
    const amrChoppyTrailATR = strategyParams.choppyTrailATR ?? 1.5;
    const amrSlopeThreshold = strategyParams.trendSlopeThreshold ?? 0.1;
    const amrRSIFloor = strategyParams.rsiFloor ?? 35;
    const amrRSICeiling = strategyParams.rsiCeiling ?? 75;
    const amrReentryBars = strategyParams.reentryBars ?? 3;
    const amrATRPeriod = strategyParams.atrPeriod ?? 14;
    const amrAutoAdapt = strategyParams.autoAdapt ?? 0; // 0=off, 1=on

    const closePrices = rows.map(r => r.close);
    const amrFastEMA = strategyType === 'amr' ? calculateEMA(closePrices, amrFastEMAPeriod) : [];
    const amrSlowEMA = strategyType === 'amr' ? calculateEMA(closePrices, amrSlowEMAPeriod) : [];
    const amrTrendEMAValues = strategyType === 'amr' ? calculateEMA(closePrices, amrTrendEMAPeriod) : [];

    // ATR calculation for AMR
    const amrATR: (number | null)[] = [];
    if (strategyType === 'amr') {
        const trs: number[] = [0];
        for (let ri = 1; ri < rows.length; ri++) {
            trs.push(Math.max(
                rows[ri].high - rows[ri].low,
                Math.abs(rows[ri].high - rows[ri - 1].close),
                Math.abs(rows[ri].low - rows[ri - 1].close)
            ));
        }
        for (let ri = 0; ri < amrATRPeriod; ri++) amrATR.push(null);
        let atrSum = trs.slice(1, amrATRPeriod + 1).reduce((a, b) => a + b, 0);
        amrATR.push(atrSum / amrATRPeriod);
        for (let ri = amrATRPeriod + 1; ri < rows.length; ri++) {
            const prev = amrATR[ri - 1]!;
            amrATR.push((prev * (amrATRPeriod - 1) + trs[ri]) / amrATRPeriod);
        }
    }

    // --- AUTO-ADAPTIVE v2: compute continuous volatility ratio ---
    // Instead of switching EMAs (causes noise), scale trail & cooldown dynamically
    // volRatio[i] = current ATR% / median ATR%. >1 = high vol, <1 = low vol
    const amrVolRatio: number[] = new Array(rows.length).fill(1.0);
    if (strategyType === 'amr' && amrAutoAdapt === 1) {
        const lookback = 200;
        const atrPctHistory: number[] = [];
        for (let ri = 0; ri < rows.length; ri++) {
            if (amrATR[ri] != null && rows[ri].close > 0) {
                const atrPct = (amrATR[ri]! / rows[ri].close) * 100;
                atrPctHistory.push(atrPct);
                const recentWindow = atrPctHistory.slice(-lookback);
                const sorted = [...recentWindow].sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)];
                // Ratio clamped between 0.5 and 2.0 to prevent extremes
                amrVolRatio[ri] = Math.max(0.5, Math.min(2.0, median > 0 ? atrPct / median : 1.0));
            }
        }
        const avgRatio = amrVolRatio.reduce((a, b) => a + b, 0) / rows.length;
        console.log(`[${new Date().toISOString()}] Auto-Adapt v2: avg vol ratio = ${avgRatio.toFixed(2)} (1.0 = normal, >1 = high vol, <1 = low vol)`);
    }

    // EMA slope for regime detection (5-bar slope of trend EMA as %)
    const amrTrendSlope: number[] = strategyType === 'amr'
        ? amrTrendEMAValues.map((v, idx) => {
            if (idx < 5 || v == null) return 0;
            const prev = amrTrendEMAValues[idx - 5];
            if (prev == null || prev === 0) return 0;
            return ((v - prev) / prev) * 100;
        })
        : [];

    let amrBarsSinceExit = 999;
    let amrEntryATR = 0;

    // --- EOD DIRECTIONAL STRATEGY SETUP ---
    let eodCurrentDirection = 0; // 1=long/TQQQ, -1=short/SQQQ, 0=flat
    let eodBarsSinceExit = 999;

    // Pre-compute indicators for EOD strategy
    const eodFastEMAPeriod_eod = strategyParams.fastEMA ?? 8;
    const eodSlowEMAPeriod_eod = strategyParams.slowEMA ?? 21;
    const eodTrendEMAPeriod_eod = strategyParams.trendEMA ?? 50;
    const eodRSIPeriod_eod = strategyParams.rsiPeriod ?? 14;
    const eodMACDFastPeriod = strategyParams.macdFast ?? 12;
    const eodMACDSlowPeriod = strategyParams.macdSlow ?? 26;
    const eodMACDSignalPeriod = strategyParams.macdSignal ?? 9;
    const eodATRPeriod_eod = strategyParams.atrPeriod ?? 14;

    const eodFastEMAValues: (number | null)[] = strategyType === 'eod_directional' ? calculateEMA(closePrices, eodFastEMAPeriod_eod) : [];
    const eodSlowEMAValues: (number | null)[] = strategyType === 'eod_directional' ? calculateEMA(closePrices, eodSlowEMAPeriod_eod) : [];
    const eodTrendEMAValues_eod: (number | null)[] = strategyType === 'eod_directional' ? calculateEMA(closePrices, eodTrendEMAPeriod_eod) : [];
    const eodRSIValues: (number | null)[] = strategyType === 'eod_directional' ? calculateRSI(closePrices, eodRSIPeriod_eod) : [];

    // MACD = EMA(fast) - EMA(slow), Signal = EMA(MACD, signal period), Histogram = MACD - Signal
    const eodMACDLine: (number | null)[] = [];
    const eodMACDSignalLine: (number | null)[] = [];
    const eodMACDHistogram: (number | null)[] = [];
    if (strategyType === 'eod_directional') {
        const macdFastEMA = calculateEMA(closePrices, eodMACDFastPeriod);
        const macdSlowEMA = calculateEMA(closePrices, eodMACDSlowPeriod);
        const macdRaw: number[] = [];
        for (let mi = 0; mi < rows.length; mi++) {
            if (macdFastEMA[mi] != null && macdSlowEMA[mi] != null) {
                const macdVal = macdFastEMA[mi]! - macdSlowEMA[mi]!;
                eodMACDLine.push(macdVal);
                macdRaw.push(macdVal);
            } else {
                eodMACDLine.push(null);
                macdRaw.push(0);
            }
        }
        // Signal line = EMA of MACD line
        const signalEMA = calculateEMA(macdRaw, eodMACDSignalPeriod);
        for (let mi = 0; mi < rows.length; mi++) {
            if (eodMACDLine[mi] != null && signalEMA[mi] != null) {
                eodMACDSignalLine.push(signalEMA[mi]!);
                eodMACDHistogram.push(eodMACDLine[mi]! - signalEMA[mi]!);
            } else {
                eodMACDSignalLine.push(null);
                eodMACDHistogram.push(null);
            }
        }
    }

    // ATR for EOD strategy
    const eodATRValues: (number | null)[] = [];
    if (strategyType === 'eod_directional') {
        const trs: number[] = [0];
        for (let ri = 1; ri < rows.length; ri++) {
            trs.push(Math.max(
                rows[ri].high - rows[ri].low,
                Math.abs(rows[ri].high - rows[ri - 1].close),
                Math.abs(rows[ri].low - rows[ri - 1].close)
            ));
        }
        for (let ri = 0; ri < eodATRPeriod_eod; ri++) eodATRValues.push(null);
        let atrSum = trs.slice(1, eodATRPeriod_eod + 1).reduce((a, b) => a + b, 0);
        eodATRValues.push(atrSum / eodATRPeriod_eod);
        for (let ri = eodATRPeriod_eod + 1; ri < rows.length; ri++) {
            const prev = eodATRValues[ri - 1]!;
            eodATRValues.push((prev * (eodATRPeriod_eod - 1) + trs[ri]) / eodATRPeriod_eod);
        }
    }

    // 20-period average volume for EOD
    const eodVolPeriod = 20;
    const eodAvgVolume: (number | null)[] = [];
    if (strategyType === 'eod_directional') {
        const volumes = rows.map(r => r.volume);
        for (let vi = 0; vi < rows.length; vi++) {
            if (vi < eodVolPeriod - 1) {
                eodAvgVolume.push(null);
            } else {
                let volSum = 0;
                for (let vj = vi - eodVolPeriod + 1; vj <= vi; vj++) volSum += volumes[vj];
                eodAvgVolume.push(volSum / eodVolPeriod);
            }
        }
    }

    // --- AMR MULTI-TIMEFRAME TREND FILTER ---
    // Resample execution bars to a higher timeframe and compute EMA trend for entry confirmation
    // htfConfirm: 'none'=off, '1h', '4h', '1d', or legacy 1=1h, 0=off
    const htfConfirmRaw = strategyParams.htfConfirm ?? 'none';
    const amrHTFTimeframe = htfConfirmRaw === 1 ? '1h' : htfConfirmRaw === 0 ? 'none' : String(htfConfirmRaw);
    const amrHTFBullish: boolean[] = new Array(rows.length).fill(true);

    if (strategyType === 'amr' && amrHTFTimeframe !== 'none') {
        console.log(`[${new Date().toISOString()}] Building AMR HTF Trend Filter (${timeframe} -> ${amrHTFTimeframe})...`);

        // Generic resampling key function for any timeframe
        const getHTFBarKey = (datetime: string, tf: string): string => {
            const dt = new Date(datetime.includes('T') ? datetime : datetime.replace(' ', 'T'));
            if (tf === '1d') {
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            }
            if (tf === '4h') {
                const h = Math.floor(dt.getHours() / 4) * 4;
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(h).padStart(2, '0')}:00`;
            }
            if (tf === '1h') {
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:00`;
            }
            // For minute-based timeframes (15m, 30m, etc.)
            const mins = parseInt(tf);
            if (!isNaN(mins)) {
                const m = Math.floor(dt.getMinutes() / mins) * mins;
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
            // Fallback: treat as 1h
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:00`;
        };

        // Resample to HTF
        const htfBars: { datetime: string; open: number; high: number; low: number; close: number }[] = [];
        let htfBar: any = null;
        for (const r of rows) {
            const key = getHTFBarKey(r.datetime, amrHTFTimeframe);
            if (!htfBar || htfBar.datetime !== key) {
                if (htfBar) htfBars.push(htfBar);
                htfBar = { datetime: key, open: r.open, high: r.high, low: r.low, close: r.close };
            } else {
                htfBar.high = Math.max(htfBar.high, r.high);
                htfBar.low = Math.min(htfBar.low, r.low);
                htfBar.close = r.close;
            }
        }
        if (htfBar) htfBars.push(htfBar);

        // Compute EMAs on HTF bars using same periods
        const htfCloses = htfBars.map(b => b.close);
        const htfFastEMA = calculateEMA(htfCloses, amrFastEMAPeriod);
        const htfSlowEMA = calculateEMA(htfCloses, amrSlowEMAPeriod);
        const htfTrendEMA = calculateEMA(htfCloses, amrTrendEMAPeriod);

        // Map HTF signal back to execution bars
        let htfIdx = 0;
        for (let i = 0; i < rows.length; i++) {
            const key = getHTFBarKey(rows[i].datetime, amrHTFTimeframe);
            // Find matching or previous HTF bar
            while (htfIdx < htfBars.length - 1 && htfBars[htfIdx + 1].datetime <= key) {
                htfIdx++;
            }
            if (htfIdx >= 0 && htfFastEMA[htfIdx] != null && htfSlowEMA[htfIdx] != null && htfTrendEMA[htfIdx] != null) {
                // HTF is bullish when: fast EMA > slow EMA AND price above trend EMA
                amrHTFBullish[i] = htfFastEMA[htfIdx]! > htfSlowEMA[htfIdx]! && htfCloses[htfIdx] > htfTrendEMA[htfIdx]!;
            }
        }
        console.log(`[${new Date().toISOString()}] AMR HTF filter built: ${htfBars.length} ${amrHTFTimeframe} bars computed.`);
    }

    // --- MULTI-TIMEFRAME TREND FILTER ---
    const htfTrendCombined: (boolean | null)[] = new Array(rows.length).fill(null);
    if (strategyType === 'sma_crossover') {
        const htfParams = [strategyParams.htfTimeframe, strategyParams.htfTimeframe2];
        const activeHTFs: string[] = [];

        for (const p of htfParams) {
            if (p === 'auto') {
                if (timeframe === '1m' || timeframe === '1-minute') activeHTFs.push('5m');
                else if (timeframe === '5m') activeHTFs.push('15m');
                else if (timeframe === '15m') activeHTFs.push('1h');
                else if (timeframe === '1h' || timeframe === 'hourly') activeHTFs.push('1d');
            } else if (p && p !== 'none') {
                activeHTFs.push(p);
            }
        }

        const uniqueHTFs = [...new Set(activeHTFs)];

        // Initialize as true, if any filter is false, it becomes false
        const htfBoolMatrix: boolean[][] = [];

        for (const htf of uniqueHTFs) {
            console.log(`[${new Date().toISOString()}] Building HTF Trend Filter (${timeframe} -> ${htf})...`);

            const getHTFKey = (datetime: string, tf: string) => {
                const dt = new Date(datetime.includes('T') ? datetime : datetime.replace(' ', 'T'));
                if (tf === '1d') return format(dt, 'yyyy-MM-dd');
                if (tf === '1h') { dt.setMinutes(0, 0, 0); return format(dt, 'yyyy-MM-dd HH:mm'); }
                if (tf === '4h') {
                    const h = dt.getHours();
                    dt.setHours(Math.floor(h / 4) * 4, 0, 0, 0);
                    return format(dt, 'yyyy-MM-dd HH:mm');
                }
                if (tf.endsWith('m')) {
                    const mins = parseInt(tf);
                    dt.setMinutes(Math.floor(dt.getMinutes() / mins) * mins, 0, 0);
                    return format(dt, 'yyyy-MM-dd HH:mm');
                }
                return datetime;
            };

            const htfBars: any[] = [];
            let currentHTF: any = null;
            for (const r of rows) {
                const key = getHTFKey(r.datetime, htf);
                if (!currentHTF || currentHTF.datetime !== key) {
                    if (currentHTF) htfBars.push(currentHTF);
                    currentHTF = { datetime: key, close: r.close };
                } else {
                    currentHTF.close = r.close;
                }
            }
            if (currentHTF) htfBars.push(currentHTF);

            const htfFastSMA = calculateSMA(htfBars.map(b => b.close), fastPeriod);
            const currentHTFBools: boolean[] = new Array(rows.length).fill(true);

            let htfIdx = 0;
            for (let i = 0; i < rows.length; i++) {
                const key = getHTFKey(rows[i].datetime, htf);
                while (htfIdx < htfBars.length && htfBars[htfIdx].datetime < key) {
                    htfIdx++;
                }

                if (htfIdx > 0) {
                    const lastBar = htfBars[htfIdx - 1];
                    const lastSMA = htfFastSMA[htfIdx - 1];
                    if (lastSMA !== null) {
                        currentHTFBools[i] = lastBar.close > lastSMA;
                    }
                }
            }
            htfBoolMatrix.push(currentHTFBools);
        }

        // Combine results: Entry only if ALL active filters are bullish
        for (let i = 0; i < rows.length; i++) {
            if (uniqueHTFs.length > 0) {
                htfTrendCombined[i] = htfBoolMatrix.every(m => m[i] === true);
            } else {
                htfTrendCombined[i] = true;
            }
        }
    }

    const get7DayHigh = (currentDateISO: string) => {
        const currentDate = parseISO(currentDateISO);
        let maxHigh = maxSeenToday;
        for (let i = 1; i <= 7; i++) {
            const date = format(subDays(currentDate, i), 'yyyy-MM-dd');
            const high = dailyHighMap.get(date) || 0;
            if (high > maxHigh) maxHigh = high;
        }
        return maxHigh;
    };

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const currentPrice = row.close;
        const currentHigh = row.high;
        const currentTime = row.datetime;
        const rowDate = row.date;
        const timePart = currentTime.includes(' ') ? currentTime.split(' ')[1] : '';

        // --- INTRADAY CONTROLS (ENFORCEMENT) ---
        const isDaily = timeframe === '1d' || timeframe === '1-day' || timeframe === 'Daily';
        const isBuyWindow = isDaily || timePart === '' || (timePart >= '09:30' && timePart < '15:45');

        let shouldForceEodSell = false;
        if (isEodExitActive) {
            // Determine the "last bar" to sell on based on resolution
            const is1m = timeframe === '1m' || timeframe === '1-minute';
            const is5m = timeframe === '5m';
            const is15m = timeframe === '15m';
            const is1h = timeframe === '1h' || timeframe === 'hourly' || timeframe === '60m';

            if (is1m || is5m) {
                shouldForceEodSell = timePart >= '15:55';
            } else if (is15m) {
                shouldForceEodSell = timePart >= '15:45';
            } else if (is1h) {
                shouldForceEodSell = timePart >= '15:00';
            } else {
                shouldForceEodSell = timePart >= '15:55'; // Fallback
            }
        }

        // Skip simulation before the actual requested start date (these were just for indicator buffer)
        if (currentTime < startDate) {
            continue;
        }

        // Daily High Tracking (mostly for Grid Entry)
        if (rowDate !== currentDateStr) {
            if (currentDateStr !== '') {
                dailyHighMap.set(currentDateStr, maxSeenToday);
            }
            currentDateStr = rowDate;
            maxSeenToday = 0;
        }
        if (currentHigh > maxSeenToday) {
            maxSeenToday = currentHigh;
        }

        // Drawdown & Equity Tracking
        let currentEquity: number;
        if (strategyType === 'eod_directional' && openPositions.length > 0) {
            // Use actual TQQQ/SQQQ prices for mark-to-market
            let unrealizedValue = 0;
            for (const pos of openPositions) {
                const posDir = (pos as any).direction ?? 1;
                const etfPriceMap = posDir === 1 ? eodTQQQPriceMap : eodSQQQPriceMap;
                const etfData = etfPriceMap.get(rowDate);
                if (etfData) {
                    unrealizedValue += pos.shares * etfData.close;
                } else {
                    // Fallback: use buy value if no ETF data for this date
                    unrealizedValue += pos.amount;
                }
            }
            currentEquity = currentBalance + unrealizedValue;
        } else {
            currentEquity = currentBalance + (totalSharesHeld * currentPrice);
        }
        const buyAndHoldBalance = buyAndHoldShares * currentPrice;

        const sampleRate = Math.max(1, Math.floor(rows.length / 1000));
        if (i % sampleRate === 0 || i === rows.length - 1) {
            equityHistory.push({
                datetime: currentTime,
                accountBalance: currentEquity,
                buyAndHoldBalance: buyAndHoldBalance,
                stockPrice: currentPrice
            });
        }

        if (currentEquity > peakValue) {
            peakValue = currentEquity;
            peakValueTime = currentTime;
        }
        if (currentEquity < minEquity) {
            minEquity = currentEquity;
            minEquityTime = currentTime;
        }

        const currentDrawdownAmt = peakValue - currentEquity;
        const currentDrawdownPct = peakValue > 0 ? currentDrawdownAmt / peakValue : 0;
        if (currentDrawdownPct > maxDrawdownPercent) {
            maxDrawdownPercent = currentDrawdownPct;
            maxDrawdownPeakTime = peakValueTime;
            maxDrawdownTroughTime = currentTime;
        }
        if (currentDrawdownAmt > maxDrawdownAmount) maxDrawdownAmount = currentDrawdownAmt;

        // --- STRATEGY EXECUTION ---
        let shouldBuy = false;
        let shouldSell = false;
        let buyReason = '';
        let sellReason = '';
        let sellLots: Position[] = [];
        let compositeScoreForSizing: number | null = null; // EOD: pass score to buy sizing

        const prevPrice = i > 0 ? rows[i - 1].close : null;


        if (strategyType === 'grid_trading') {
            // SELL LOGIC (Grid)
            for (const pos of openPositions) {
                if (currentPrice >= pos.buyPrice * (1 + moveUpDecimal)) {
                    shouldSell = true;
                    sellLots.push(pos);
                }
            }

            // BUY LOGIC (Grid)
            if (!hasTradedGrid) {
                const sevenDayHigh = get7DayHigh(rowDate);
                if (sevenDayHigh > 0 && currentPrice <= sevenDayHigh * (1 - moveDownDecimal)) {
                    shouldBuy = true;
                    buyReason = `Initial entry: drop of ${moveDownPercent}% from 7-day high (${sevenDayHigh.toFixed(2)})`;
                }
            } else {
                if (currentPrice <= referencePrice * (1 - moveDownDecimal)) {
                    shouldBuy = true;
                    buyReason = `Drop of ${moveDownPercent}% from last action (${referencePrice.toFixed(2)})`;
                } else if (openPositions.length === 0) {
                    const sevenDayHigh = get7DayHigh(rowDate);
                    if (sevenDayHigh > 0 && currentPrice <= sevenDayHigh * (1 - moveDownDecimal)) {
                        shouldBuy = true;
                        buyReason = `Re-entry: drop of ${moveDownPercent}% from 7-day high (${sevenDayHigh.toFixed(2)})`;
                    }
                }
            }
        } else if (strategyType === 'rsi_mean_reversion') {
            const currentRSI = rsiValues![i];
            if (currentRSI !== null) {
                // SELL LOGIC (RSI: Exit when overbought)
                if (currentRSI >= overboughtThreshold && openPositions.length > 0) {
                    shouldSell = true;
                    sellLots = [...openPositions]; // Sell all positions
                    sellReason = `RSI Overbought: ${currentRSI.toFixed(2)} (Threshold: ${overboughtThreshold})`;
                }

                // BUY LOGIC (RSI: Entry when oversold)
                if (currentRSI <= oversoldThreshold && currentBalance >= (initialBalance * 0.1)) {
                    // Only buy if we haven't traded today and have room for positions
                    if (rowDate !== lastTradeDay && openPositions.length < 5) {
                        shouldBuy = true;
                        buyReason = `RSI Oversold: ${currentRSI.toFixed(2)} (Threshold: ${oversoldThreshold})`;
                    }
                }
            }
        } else if (strategyType === 'sma_crossover') {
            const currentFast = fastSMA[i];
            const currentSlow = slowSMA[i];
            const prevFast = i > 0 ? fastSMA[i - 1] : null;
            const prevSlow = i > 0 ? slowSMA[i - 1] : null;

            if (currentFast !== null && currentSlow !== null && prevFast !== null && prevSlow !== null && prevPrice !== null) {
                // --- SELL logic ---
                if (openPositions.length > 0) {
                    const droppedFast = prevPrice >= prevFast && currentPrice < currentFast;
                    const droppedSlow = prevPrice >= prevSlow && currentPrice < currentSlow;

                    let triggered = false;
                    let reason = '';

                    if (droppedFast || droppedSlow) {
                        triggered = true;
                        reason = `Exit: Price crossed below ${droppedFast ? 'Fast' : 'Slow'} SMA`;
                    } else {
                        // Check Trailing Stop
                        const stopPercent = strategyParams.trailingStopPercent ?? 0;
                        if (stopPercent > 0) {
                            for (const pos of openPositions) {
                                if (currentPrice <= pos.peakPrice * (1 - stopPercent / 100)) {
                                    triggered = true;
                                    reason = `Trailing Stop: Price dropped ${stopPercent}% from peak ($${pos.peakPrice.toFixed(2)})`;
                                    break;
                                }
                            }
                        }
                    }

                    if (triggered) {
                        shouldSell = true;
                        sellLots = [...openPositions];
                        sellReason = reason;
                    } else if (shouldForceEodSell) {
                        shouldSell = true;
                        sellLots = [...openPositions];
                        sellReason = 'Forced Intraday EOD Exit';
                    }
                }

                // --- BUY logic ---
                if (openPositions.length < 1 && !shouldForceEodSell && isBuyWindow) {
                    const crossedFastUp = prevPrice <= prevFast && currentPrice > currentFast;
                    const crossedSlowUp = prevPrice <= prevSlow && currentPrice > currentSlow;

                    const isTrendBullishHTF = htfTrendCombined[i] !== false;
                    const useBullishFilter = strategyParams.bullishAlignmentFilter === 1;

                    let buyTriggered = false;
                    let triggerType = '';

                    // Slow SMA is a "good sign", always allowed
                    if (crossedSlowUp) {
                        buyTriggered = true;
                        triggerType = 'Slow SMA';
                    } else if (crossedFastUp) {
                        // Fast SMA entry requires filter check
                        if (!useBullishFilter || currentFast > currentSlow) {
                            buyTriggered = true;
                            triggerType = 'Fast SMA';
                        }
                    }

                    if (buyTriggered && isTrendBullishHTF) {
                        shouldBuy = true;
                        buyReason = `Entry: Price break above ${triggerType} (Alignment: ${useBullishFilter ? (currentFast > currentSlow ? 'Golden' : 'Open') : 'Ignored'})`;
                    }
                }
            }
        } else if (strategyType === 'amr') {
            // === ADAPTIVE MOMENTUM RIDER (AMR) v2 ===
            const curFastEMA = amrFastEMA[i];
            const curSlowEMA = amrSlowEMA[i];
            const curTrendEMA = amrTrendEMAValues[i];
            const prevFastEMA = i > 0 ? amrFastEMA[i - 1] : null;
            const prevSlowEMA = i > 0 ? amrSlowEMA[i - 1] : null;
            const prevTrendEMA = i > 0 ? amrTrendEMAValues[i - 1] : null;
            const curATR = amrATR[i];
            const curRSI = rsiValues[i];
            const curSlope = amrTrendSlope[i];

            if (curFastEMA != null && curSlowEMA != null && curTrendEMA != null &&
                prevFastEMA != null && prevSlowEMA != null && prevTrendEMA != null &&
                curATR != null && curRSI != null && prevPrice != null) {

                // === ADAPTIVE REGIME DETECTION ===
                const absSlope = Math.abs(curSlope);
                const isTrending = absSlope > amrSlopeThreshold;
                const isStrongTrend = absSlope > amrSlopeThreshold * 3;
                const isModerateTrend = absSlope > amrSlopeThreshold * 1.5;

                // ATR as percentage of price
                const atrPercent = (curATR / currentPrice) * 100;

                // Auto-Adapt v2: scale trail multiplier with volatility ratio
                // High vol (ratio=1.5) → wider trails, Low vol (ratio=0.7) → tighter trails
                const volScale = amrAutoAdapt === 1 ? amrVolRatio[i] : 1.0;
                const scaledTrendTrail = amrTrendTrailATR * volScale;
                const scaledChoppyTrail = amrChoppyTrailATR * volScale;

                // Dynamic trail multiplier: regime + volatility scaling
                let dynamicTrailMult: number;
                if (isStrongTrend) {
                    dynamicTrailMult = scaledTrendTrail * 1.5;
                } else if (isModerateTrend) {
                    dynamicTrailMult = scaledTrendTrail * 1.2;
                } else if (isTrending) {
                    dynamicTrailMult = scaledTrendTrail;
                } else {
                    dynamicTrailMult = scaledChoppyTrail;
                }

                // --- SELL logic (AMR v2 — Adaptive Exit) ---
                if (openPositions.length > 0) {
                    let exitReason = '';
                    const pos = openPositions[0];

                    // How much are we up or down on this position?
                    const unrealizedPct = ((currentPrice - pos.buyPrice) / pos.buyPrice) * 100;
                    // Are the EMAs still bullishly aligned?
                    const emasBullish = curFastEMA > curSlowEMA;

                    // 1. PERCENTAGE-BASED ATR Trailing Stop — ALWAYS ACTIVE
                    // Primary exit in ALL regimes. Scales with price level via ATR%
                    const trailPercent = dynamicTrailMult * atrPercent / 100;
                    const trailingStop = pos.peakPrice * (1 - trailPercent);
                    if (currentPrice < trailingStop) {
                        exitReason = `ATR Trail Stop (${(trailPercent * 100).toFixed(1)}% from peak $${pos.peakPrice.toFixed(2)}, regime=${isStrongTrend ? 'STRONG' : isTrending ? 'TREND' : 'CHOPPY'})`;
                    }

                    // 2. Trend EMA break — ONLY when EMA structure is bearish AND losing
                    // In strong trends: completely suppressed (parabolic pullbacks are normal)
                    // In trends with profit: suppressed (trailing stop protects us)
                    if (!exitReason && !emasBullish && unrealizedPct < 0 && !isStrongTrend) {
                        if (currentPrice < curTrendEMA && prevPrice >= prevTrendEMA) {
                            exitReason = `Trend Break (bearish EMA, loss=${unrealizedPct.toFixed(1)}%)`;
                        }
                    }

                    // 3. Death cross — ONLY when materially losing AND not trending
                    if (!exitReason && unrealizedPct < -2 && !isTrending) {
                        if (curFastEMA < curSlowEMA && prevFastEMA >= prevSlowEMA) {
                            exitReason = `Death Cross (loss=${unrealizedPct.toFixed(1)}%)`;
                        }
                    }

                    if (exitReason) {
                        shouldSell = true;
                        sellLots = [...openPositions];
                        sellReason = exitReason;
                        amrBarsSinceExit = 0;
                    } else if (shouldForceEodSell) {
                        shouldSell = true;
                        sellLots = [...openPositions];
                        sellReason = 'Forced Intraday EOD Exit';
                        amrBarsSinceExit = 0;
                    }
                }

                // --- BUY logic (AMR v2) ---
                if (openPositions.length < 1 && !shouldForceEodSell && isBuyWindow) {
                    amrBarsSinceExit++;

                    // 1. EMA golden cross: fast crosses above slow
                    const crossUp = curFastEMA > curSlowEMA && prevFastEMA <= prevSlowEMA;
                    // 2. Reclaim entry: price reclaims fast EMA while EMAs still bullish
                    const reclaimEntry = curFastEMA > curSlowEMA &&
                        prevPrice < prevFastEMA &&
                        currentPrice > curFastEMA &&
                        currentPrice > curTrendEMA &&
                        amrBarsSinceExit >= 5;

                    // 3. Trend filter: price above trend EMA
                    const trendOk = currentPrice > curTrendEMA;
                    // 4. RSI filter: not overbought or oversold
                    const rsiOk = curRSI >= amrRSIFloor && curRSI <= amrRSICeiling;
                    // 5. Cooldown check — scales with volatility (high vol = longer cooldown)
                    const scaledCooldown = amrAutoAdapt === 1 ? Math.round(amrReentryBars * volScale) : amrReentryBars;
                    const cooldownOk = amrBarsSinceExit >= scaledCooldown;

                    // 6. HTF confirmation: higher timeframe must confirm bullish
                    const htfOk = amrHTFBullish[i];

                    if ((crossUp || reclaimEntry) && trendOk && rsiOk && cooldownOk && htfOk) {
                        shouldBuy = true;
                        const entryType = crossUp ? 'Golden Cross' : 'EMA Reclaim';
                        const regime = isStrongTrend ? 'STRONG' : isTrending ? 'TREND' : 'CHOPPY';
                        const volInfo = amrAutoAdapt === 1 ? `, Vol=${volScale.toFixed(2)}x` : '';
                        buyReason = `${entryType} (RSI=${curRSI.toFixed(0)}, Regime=${regime}, Trail=${dynamicTrailMult.toFixed(1)}x ATR${volInfo})`;
                        amrEntryATR = curATR;
                    }
                }
            }
        } else if (strategyType === 'eod_directional') {
            // === EOD DIRECTIONAL STRATEGY ===
            // Analyzes index ($IUXX) on daily bars, simulates TQQQ/SQQQ leveraged ETF trading
            // Multi-factor composite scoring: EMA Trend + RSI + MACD + Price Position + Volume

            if (i >= 1) {
                const eodEntryThreshold = strategyParams.entryThreshold ?? 40;
                const eodExitThreshold = strategyParams.exitThreshold ?? 10;
                const eodTrailATR = strategyParams.trailATR ?? 2.5;

                // Use pre-computed indicators from EOD setup section
                const curFastEOD = eodFastEMAValues[i];
                const curSlowEOD = eodSlowEMAValues[i];
                const curTrendEOD = eodTrendEMAValues_eod[i];
                const prevFastEOD = i > 0 ? eodFastEMAValues[i - 1] : null;
                const prevSlowEOD = i > 0 ? eodSlowEMAValues[i - 1] : null;
                const curRSIeod = eodRSIValues[i];
                const curMACDHist = eodMACDHistogram[i];
                const prevMACDHist = i > 0 ? eodMACDHistogram[i - 1] : null;
                const curATReod = eodATRValues[i];
                const curVolume = row.volume;
                const avgVol = eodAvgVolume[i];

                if (curFastEOD != null && curSlowEOD != null && curTrendEOD != null &&
                    prevFastEOD != null && prevSlowEOD != null &&
                    curRSIeod != null && curATReod != null && prevPrice != null) {

                    // ========== FACTOR 1: EMA TREND ALIGNMENT (±30 points max) ==========
                    let emaTrendScore = 0;
                    const fastAboveSlow = curFastEOD > curSlowEOD;
                    const priceAboveTrend = currentPrice > curTrendEOD;
                    const priceBelowTrend = currentPrice < curTrendEOD;

                    // EMA slope (5-bar)
                    const trendSlope = i >= 5 && eodTrendEMAValues_eod[i - 5] != null && eodTrendEMAValues_eod[i - 5] !== 0
                        ? ((curTrendEOD - eodTrendEMAValues_eod[i - 5]!) / eodTrendEMAValues_eod[i - 5]!) * 100 : 0;

                    if (fastAboveSlow && priceAboveTrend) emaTrendScore = 20;
                    else if (!fastAboveSlow && priceBelowTrend) emaTrendScore = -20;
                    else if (fastAboveSlow && !priceAboveTrend) emaTrendScore = 5;
                    else if (!fastAboveSlow && !priceBelowTrend) emaTrendScore = -5;
                    emaTrendScore += Math.max(-10, Math.min(10, trendSlope * 5));

                    // ========== FACTOR 2: RSI MOMENTUM (±25 points max) ==========
                    let rsiScore = 0;
                    if (curRSIeod > 60) rsiScore = Math.min(25, (curRSIeod - 50) * 0.8);
                    else if (curRSIeod < 40) rsiScore = Math.max(-25, (curRSIeod - 50) * 0.8);
                    else rsiScore = (curRSIeod - 50) * 0.3;

                    // ========== FACTOR 3: MACD HISTOGRAM (±25 points max) ==========
                    let macdScore = 0;
                    if (curMACDHist != null) {
                        const histNorm = curATReod > 0 ? (curMACDHist / curATReod) * 100 : 0;
                        macdScore = Math.max(-25, Math.min(25, histNorm * 2));
                        if (prevMACDHist != null) {
                            if (curMACDHist > prevMACDHist && curMACDHist > 0) macdScore += 5;
                            if (curMACDHist < prevMACDHist && curMACDHist < 0) macdScore -= 5;
                        }
                        macdScore = Math.max(-25, Math.min(25, macdScore));
                    }

                    // ========== FACTOR 4: PRICE POSITION (±10 points max) ==========
                    let pricePositionScore = 0;
                    if (row.high !== row.low) {
                        const closePos = (row.close - row.low) / (row.high - row.low);
                        pricePositionScore = (closePos - 0.5) * 20;
                    }

                    // ========== FACTOR 5: VOLUME CONVICTION (±10 points max) ==========
                    let volumeScore = 0;
                    if (avgVol != null && avgVol > 0 && curVolume > 0) {
                        const volRatio = curVolume / avgVol;
                        const priceChg = prevPrice > 0 ? (currentPrice - prevPrice) / prevPrice : 0;
                        if (volRatio > 1.2) {
                            volumeScore = priceChg > 0 ? Math.min(10, volRatio * 3) : Math.max(-10, -volRatio * 3);
                        }
                    }

                    // ========== COMPOSITE SCORE (range: roughly -100 to +100) ==========
                    const compositeScore = emaTrendScore + rsiScore + macdScore + pricePositionScore + volumeScore;
                    const atrPercent = curATReod > 0 ? (curATReod / currentPrice) * 100 : 1;

                    // ========== EXIT LOGIC ==========
                    if (openPositions.length > 0) {
                        const pos = openPositions[0];
                        const posDirection = (pos as any).direction as number;
                        const isLong = posDirection === 1;
                        const isShort = posDirection === -1;
                        let exitReason = '';

                        // 1. ATR Trailing Stop
                        const trailPct = eodTrailATR * atrPercent / 100;
                        if (isLong && currentPrice < pos.peakPrice * (1 - trailPct)) {
                            exitReason = `TQQQ Trail Stop (${(trailPct * 100).toFixed(1)}% from peak $${pos.peakPrice.toFixed(2)})`;
                        } else if (isShort && currentPrice > pos.peakPrice * (1 + trailPct)) {
                            exitReason = `SQQQ Trail Stop (${(trailPct * 100).toFixed(1)}% from best $${pos.peakPrice.toFixed(2)})`;
                        }

                        // 2. Score reversal — signal flipped against position
                        if (!exitReason) {
                            if (isLong && compositeScore < -eodExitThreshold) {
                                exitReason = `Signal Reversal to Bearish (Score: ${compositeScore.toFixed(0)})`;
                            } else if (isShort && compositeScore > eodExitThreshold) {
                                exitReason = `Signal Reversal to Bullish (Score: ${compositeScore.toFixed(0)})`;
                            }
                        }

                        if (exitReason) {
                            shouldSell = true;
                            sellLots = [...openPositions];
                            sellReason = exitReason;
                            eodBarsSinceExit = 0;
                            eodCurrentDirection = 0;
                        }
                    }

                    // ========== ENTRY LOGIC ==========
                    if (openPositions.length < 1 && !shouldSell) {
                        const cooldown = strategyParams.cooldownBars ?? 2;
                        if (eodBarsSinceExit >= cooldown) {
                            if (compositeScore >= eodEntryThreshold) {
                                shouldBuy = true;
                                buyReason = `TQQQ Entry [Score:${compositeScore.toFixed(0)}] EMA:${emaTrendScore.toFixed(0)} RSI:${rsiScore.toFixed(0)} MACD:${macdScore.toFixed(0)} Pos:${pricePositionScore.toFixed(0)} Vol:${volumeScore.toFixed(0)}`;
                                eodCurrentDirection = 1;
                            } else if (compositeScore <= -eodEntryThreshold) {
                                shouldBuy = true;
                                buyReason = `SQQQ Entry [Score:${compositeScore.toFixed(0)}] EMA:${emaTrendScore.toFixed(0)} RSI:${rsiScore.toFixed(0)} MACD:${macdScore.toFixed(0)} Pos:${pricePositionScore.toFixed(0)} Vol:${volumeScore.toFixed(0)}`;
                                eodCurrentDirection = -1;
                            }
                        }
                    }

                    if (openPositions.length < 1) eodBarsSinceExit++;

                    // Pass score to buy execution for position sizing
                    compositeScoreForSizing = compositeScore;
                }
            }
        }

        // --- TRAILING STOP LOSS UPDATE (ALWAYS ACTIVE FOR PERFORMANCE) ---
        if (openPositions.length > 0) {
            for (const pos of openPositions) {
                const posDir = (pos as any).direction ?? 1;
                if (posDir === -1) {
                    // Short position (SQQQ): track the LOWEST price as "peak" (best short entry)
                    if (currentPrice < pos.peakPrice) {
                        pos.peakPrice = currentPrice;
                    }
                } else {
                    // Long position (default): track highest price
                    if (currentPrice > pos.peakPrice) {
                        pos.peakPrice = currentPrice;
                    }
                }
            }
        }

        // Execute Sells
        if (shouldSell && sellLots.length > 0) {
            for (const pos of sellLots) {
                let sellAmount: number;
                let profit: number;

                if (strategyType === 'eod_directional') {
                    // Use actual TQQQ/SQQQ prices
                    const posDir = (pos as any).direction ?? 1;
                    const etfPriceMap = posDir === 1 ? eodTQQQPriceMap : eodSQQQPriceMap;
                    const etfData = etfPriceMap.get(rowDate);
                    const etfSellPrice = etfData ? etfData.close : (pos as any).etfBuyPrice; // fallback to buy price
                    sellAmount = pos.shares * etfSellPrice;
                    profit = sellAmount - pos.amount;
                } else {
                    sellAmount = pos.shares * currentPrice;
                    profit = sellAmount - pos.amount;
                }

                currentBalance += sellAmount;
                totalProfit += profit;
                totalSharesHeld -= pos.shares;
                totalInvestedInUnsold -= pos.amount;

                let sellComment = sellReason || 'Grid Target';

                if (strategyType === 'grid_trading') referencePrice = currentPrice;
                hasTradedGrid = true;

                const dirLabel = strategyType === 'eod_directional'
                    ? ((pos as any).direction === 1 ? 'TQQQ' : 'SQQQ')
                    : '';
                const etfSellPriceDisplay = strategyType === 'eod_directional'
                    ? (() => {
                        const pm = (pos as any).direction === 1 ? eodTQQQPriceMap : eodSQQQPriceMap;
                        const d = pm.get(rowDate);
                        return d ? d.close.toFixed(2) : '?';
                    })() : '';
                const commentPrefix = dirLabel
                    ? `${dirLabel} sold at $${etfSellPriceDisplay} (bought at $${(pos as any).etfBuyPrice?.toFixed(2) ?? '?'})`
                    : `Sold lot bought at ${pos.buyPrice.toFixed(2)}`;

                trades.push({
                    tradeNo: tradeNoCounter++,
                    datetime: currentTime,
                    type: 'SELL',
                    symbol,
                    price: currentPrice,
                    shares: pos.shares,
                    totalShares: totalSharesHeld,
                    remainingBalance: currentBalance,
                    accountBalance: currentBalance + (totalSharesHeld * currentPrice),
                    amount: sellAmount,
                    profit,
                    comment: `${commentPrefix} (${sellComment})`
                });

                // Remove from open positions
                openPositions = openPositions.filter(p => p.id !== pos.id);
            }
        }

        // Execute Buys
        let amountToBuy = 0;
        if (strategyType === 'grid_trading') {
            amountToBuy = amountToBuyGrid;
        } else if (strategyType === 'rsi_mean_reversion') {
            amountToBuy = initialBalance * 0.1;
        } else if (strategyType === 'sma_crossover') {
            amountToBuy = currentBalance;
        } else if (strategyType === 'amr') {
            amountToBuy = currentBalance; // Full position sizing (all-in, all-out)
        } else if (strategyType === 'eod_directional') {
            // Score-based position sizing: stronger signal = more capital deployed
            // At threshold (e.g. 40) → deploy 30% of cash
            // At max score (~100) → deploy 100% of cash
            // Linear scale between
            const entryThresh = strategyParams.entryThreshold ?? 40;
            const maxScore = 100;
            const absScore = Math.abs(eodCurrentDirection === 1
                ? Math.max(0, compositeScoreForSizing ?? 0)
                : Math.max(0, -(compositeScoreForSizing ?? 0)));
            const scorePct = Math.min(1.0, Math.max(0.3, (absScore - entryThresh) / (maxScore - entryThresh) * 0.7 + 0.3));
            amountToBuy = currentBalance * scorePct;
        }

        if (shouldBuy && currentBalance >= amountToBuy && amountToBuy > 0) {
            let actualBuyPrice = currentPrice;
            let etfBuyPriceVal: number | null = null;

            // For EOD directional: buy actual TQQQ/SQQQ shares at real ETF price
            if (strategyType === 'eod_directional') {
                const etfPriceMap = eodCurrentDirection === 1 ? eodTQQQPriceMap : eodSQQQPriceMap;
                const etfData = etfPriceMap.get(rowDate);
                if (!etfData) {
                    // No ETF data for this date — skip this trade
                    shouldBuy = false;
                } else {
                    etfBuyPriceVal = etfData.close;
                    actualBuyPrice = etfData.close;
                }
            }

            if (shouldBuy) {
                const sharesToBuy = amountToBuy / actualBuyPrice;
                currentBalance -= amountToBuy;
                if (strategyType === 'grid_trading') referencePrice = currentPrice;
                hasTradedGrid = true;
                lastTradeDay = rowDate;
                totalSharesHeld += sharesToBuy;
                totalInvestedInUnsold += amountToBuy;

                const newPos: any = {
                    id: positionIdCounter++,
                    buyPrice: currentPrice, // Index price (for signal reference)
                    peakPrice: currentPrice,
                    shares: sharesToBuy,
                    amount: amountToBuy,
                    buyTime: currentTime
                };
                if (strategyType === 'eod_directional') {
                    newPos.direction = eodCurrentDirection;
                    newPos.etfBuyPrice = etfBuyPriceVal;
                }
                openPositions.push(newPos);

                const dirLabel = strategyType === 'eod_directional'
                    ? (eodCurrentDirection === 1 ? '🟢 TQQQ' : '🔴 SQQQ')
                    : '';
                const etfPriceInfo = etfBuyPriceVal ? ` @ $${etfBuyPriceVal.toFixed(2)}` : '';

                trades.push({
                    tradeNo: tradeNoCounter++,
                    datetime: currentTime,
                    type: 'BUY',
                    symbol: strategyType === 'eod_directional'
                        ? (eodCurrentDirection === 1 ? 'TQQQ' : 'SQQQ') : symbol,
                    price: actualBuyPrice,
                    shares: sharesToBuy,
                    totalShares: totalSharesHeld,
                    remainingBalance: currentBalance,
                    accountBalance: currentBalance + (totalSharesHeld * actualBuyPrice),
                    amount: amountToBuy,
                    profit: 0,
                    comment: dirLabel ? `${dirLabel}${etfPriceInfo} — ${buyReason}` : buyReason
                });
            }
        }
    }

    console.log(`[${new Date().toISOString()}] Processing complete for ${symbol}`);
    let finalAccountValue: number;
    const lastClose = (rows[rows.length - 1] as any).close;
    const lastDate = (rows[rows.length - 1] as any).date;
    if (strategyType === 'eod_directional' && openPositions.length > 0) {
        let unrealizedValue = 0;
        for (const pos of openPositions) {
            const posDir = (pos as any).direction ?? 1;
            const etfPriceMap = posDir === 1 ? eodTQQQPriceMap : eodSQQQPriceMap;
            const etfData = etfPriceMap.get(lastDate);
            if (etfData) {
                unrealizedValue += pos.shares * etfData.close;
            } else {
                unrealizedValue += pos.amount; // fallback
            }
        }
        finalAccountValue = currentBalance + unrealizedValue;
    } else {
        finalAccountValue = currentBalance + (totalSharesHeld * lastClose);
    }

    return {
        trades,
        equityHistory,
        summary: {
            symbol,
            totalProfitRealized: totalProfit,
            currentCashBalance: currentBalance,
            unsoldShares: totalSharesHeld,
            averagePriceUnsold: totalSharesHeld > 0 ? totalInvestedInUnsold / totalSharesHeld : 0,
            finalAccountValue,
            maxDrawdownPercent: maxDrawdownPercent * 100,
            maxDrawdownAmount,
            minEquity,
            minEquityTime,
            peakValue,
            initialBalance,
            buyAndHoldFinalValue: buyAndHoldShares * (rows[rows.length - 1] as any).close,
            buyAndHoldReturnPercent: ((buyAndHoldShares * (rows[rows.length - 1] as any).close - initialBalance) / initialBalance) * 100,
            maxDrawdownPeakTime,
            maxDrawdownTroughTime
        }
    };
}
