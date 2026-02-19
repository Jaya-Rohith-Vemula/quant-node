import { format, subDays, parseISO } from 'date-fns';
import { db, getConn } from './db.js';
import oracledb from 'oracledb';

interface Position {
    // ... (omitting for brevity in this thought, will use full block in tool call)
    id: number;
    buyPrice: number;
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

export async function runBacktest(params: StrategyParams) {
    const conn = await getConn();

    const {
        symbol,
        initialBalance,
        startDate,
        endDate,
        strategyType,
        strategyParams
    } = params;

    console.log(`[${new Date().toISOString()}] Starting ${strategyType} analysis for ${symbol}...`);

    console.log(`[${new Date().toISOString()}] Querying OCI for ${symbol} data...`);

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
            { symbol, startDate, endDate },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
    } catch (err: any) {
        console.error(`[${new Date().toISOString()}] OCI Query Error:`, err.message);
        throw err;
    }

    const rows = result.rows as any[];
    console.log(`[${new Date().toISOString()}] Retrieved ${rows.length} rows from OCI for ${symbol}`);

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
                minEquity: initialBalance,
                minEquityTime: '',
                peakValue: initialBalance,
                initialBalance
            }
        };
    }

    // Common Simulation State
    let currentBalance = initialBalance;
    let openPositions: Position[] = [];
    let positionIdCounter = 1;
    let totalProfit = 0;
    let trades: TradeRecord[] = [];
    let equityHistory: { datetime: string, accountBalance: number }[] = [];
    let tradeNoCounter = 1;
    let totalSharesHeld = 0;
    let totalInvestedInUnsold = 0;
    let lastTradeDay = ''; // To avoid multiple trades on the same day for RSI

    // Performance metrics
    let peakValue = initialBalance;
    let minEquity = initialBalance;
    let minEquityTime = '';
    let maxDrawdownPercent = 0;
    let maxDrawdownAmount = 0;

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

    // RSI Specific Setup
    const rsiPeriod = strategyParams.rsiPeriod ?? 14;
    const oversoldThreshold = strategyParams.oversoldThreshold ?? 30;
    const overboughtThreshold = strategyParams.overboughtThreshold ?? 70;
    const rsiValues = strategyType === 'rsi_mean_reversion' ? calculateRSI(rows.map(r => r.close), rsiPeriod) : [];

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
        const sampleRate = Math.max(1, Math.floor(rows.length / 1000));
        if (i % sampleRate === 0 || i === rows.length - 1) {
            equityHistory.push({ datetime: currentTime, accountBalance: currentEquity });
        }

        if (currentEquity > peakValue) peakValue = currentEquity;
        if (currentEquity < minEquity) {
            minEquity = currentEquity;
            minEquityTime = currentTime;
        }

        const currentDrawdownAmt = peakValue - currentEquity;
        const currentDrawdownPct = peakValue > 0 ? currentDrawdownAmt / peakValue : 0;
        if (currentDrawdownPct > maxDrawdownPercent) maxDrawdownPercent = currentDrawdownPct;
        if (currentDrawdownAmt > maxDrawdownAmount) maxDrawdownAmount = currentDrawdownAmt;

        // --- STRATEGY EXECUTION ---
        let shouldBuy = false;
        let shouldSell = false;
        let buyReason = '';
        let sellLots: Position[] = [];

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
                    comment: `Sold lot bought at ${pos.buyPrice.toFixed(2)} (${strategyType === 'rsi_mean_reversion' ? 'RSI Exit' : 'Grid Target'})`
                });

                // Remove from open positions
                openPositions = openPositions.filter(p => p.id !== pos.id);
            }
        }

        // Execute Buys
        const amountToBuy = strategyType === 'grid_trading' ? amountToBuyGrid : (initialBalance * 0.1); // RSI buys 10% of initial balance
        if (shouldBuy && currentBalance >= amountToBuy) {
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
            initialBalance
        }
    };
}
