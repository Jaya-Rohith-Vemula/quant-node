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
    const maxPeriod = Math.max(fastPeriodReq, slowPeriodReq, rsiPeriodReq);

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
    const rsiValues = strategyType === 'rsi_mean_reversion' ? calculateRSI(rows.map(r => r.close), rsiPeriod) : [];

    // SMA Specific Setup
    const fastPeriod = strategyParams.fastPeriod ?? 50;
    const slowPeriod = strategyParams.slowPeriod ?? 200;
    const trailingStopPercent = strategyParams.trailingStopPercent ?? 0;

    const fastSMA = strategyType === 'sma_crossover' ? calculateSMA(rows.map(r => r.close), fastPeriod) : [];
    const slowSMA = strategyType === 'sma_crossover' ? calculateSMA(rows.map(r => r.close), slowPeriod) : [];

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
        const isBuyWindow = timePart >= '09:30' && timePart < '15:45';

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
        const currentEquity = currentBalance + (totalSharesHeld * currentPrice);
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
        }

        // --- TRAILING STOP LOSS UPDATE (ALWAYS ACTIVE FOR PERFORMANCE) ---
        if (openPositions.length > 0) {
            for (const pos of openPositions) {
                if (currentPrice > pos.peakPrice) {
                    pos.peakPrice = currentPrice;
                }
            }
        }

        // Execute Sells
        if (shouldSell && sellLots.length > 0) {
            for (const pos of sellLots) {
                const sellAmount = pos.shares * currentPrice;
                const profit = sellAmount - pos.amount;
                currentBalance += sellAmount;
                totalProfit += profit;
                totalSharesHeld -= pos.shares;
                totalInvestedInUnsold -= pos.amount;

                let sellComment = sellReason || 'Grid Target';

                if (strategyType === 'grid_trading') referencePrice = currentPrice;
                hasTradedGrid = true;

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
                    comment: `Sold lot bought at ${pos.buyPrice.toFixed(2)} (${sellComment})`
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
        }

        if (shouldBuy && currentBalance >= amountToBuy && amountToBuy > 0) {
            const sharesToBuy = amountToBuy / currentPrice;
            currentBalance -= amountToBuy;
            if (strategyType === 'grid_trading') referencePrice = currentPrice;
            hasTradedGrid = true;
            lastTradeDay = rowDate; // Record the day of the trade
            totalSharesHeld += sharesToBuy;
            totalInvestedInUnsold += amountToBuy;

            openPositions.push({
                id: positionIdCounter++,
                buyPrice: currentPrice,
                peakPrice: currentPrice, // Initialize peakPrice at buyPrice
                shares: sharesToBuy,
                amount: amountToBuy,
                buyTime: currentTime
            });

            trades.push({
                tradeNo: tradeNoCounter++,
                datetime: currentTime,
                type: 'BUY',
                symbol,
                price: currentPrice,
                shares: sharesToBuy,
                totalShares: totalSharesHeld,
                remainingBalance: currentBalance,
                accountBalance: currentBalance + (totalSharesHeld * currentPrice),
                amount: amountToBuy,
                profit: 0,
                comment: buyReason
            });
        }
    }

    console.log(`[${new Date().toISOString()}] Processing complete for ${symbol}`);
    const finalAccountValue = currentBalance + (totalSharesHeld * (rows[rows.length - 1] as any).close);

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
