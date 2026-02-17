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
    initialBalance: number;
    moveDownPercent: number;
    moveUpPercent: number;
    amountToBuy: number;
    startDate: string;
    endDate: string;
    symbol: string;
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

export async function runBacktest(params: StrategyParams) {
    const conn = await getConn();

    const {
        initialBalance,
        moveDownPercent,
        moveUpPercent,
        amountToBuy,
        startDate,
        endDate,
        symbol
    } = params;

    const moveDownDecimal = moveDownPercent / 100;
    const moveUpDecimal = moveUpPercent / 100;

    console.log(`[${new Date().toISOString()}] Starting strategy analysis for ${symbol}...`);

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

    const dailyHighMap = new Map<string, number>();
    let currentBalance = initialBalance;
    let openPositions: Position[] = [];
    let positionIdCounter = 1;
    let totalProfit = 0;
    let referencePrice = 0;
    let hasTraded = false;
    let trades: TradeRecord[] = [];
    let equityHistory: { datetime: string, accountBalance: number }[] = [];
    let tradeNoCounter = 1;
    let maxSeenToday = 0;
    let currentDateStr = '';

    // Optimization: maintain total shares and equity to avoid reduce in every iteration
    let totalSharesHeld = 0;
    let totalInvestedInUnsold = 0;

    // Performance metrics
    let peakValue = initialBalance;
    let minEquity = initialBalance;
    let minEquityTime = '';
    let maxDrawdownPercent = 0;
    let maxDrawdownAmount = 0;

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

        // Drawdown calculation
        const currentEquity = currentBalance + (totalSharesHeld * currentPrice);

        // Record equity history (sampled for responsiveness, max ~1000 points)
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

        // SELL LOGIC
        if (openPositions.length > 0) {
            let remainingPositions: Position[] = [];
            for (const pos of openPositions) {
                const targetSellPrice = pos.buyPrice * (1 + moveUpDecimal);
                if (currentPrice >= targetSellPrice) {
                    const sellAmount = pos.shares * currentPrice;
                    const profit = sellAmount - (pos.shares * pos.buyPrice);
                    currentBalance += sellAmount;
                    totalProfit += profit;
                    referencePrice = currentPrice;
                    hasTraded = true;
                    totalSharesHeld -= pos.shares;
                    totalInvestedInUnsold -= pos.amount;

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
                        profit: profit,
                        comment: `Sold lot bought at ${pos.buyPrice.toFixed(2)}`
                    });
                } else {
                    remainingPositions.push(pos);
                }
            }
            openPositions = remainingPositions;
        }

        // BUY LOGIC
        let shouldBuy = false;
        let buyReason = '';

        if (!hasTraded) {
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

        if (shouldBuy && currentBalance >= amountToBuy) {
            const sharesToBuy = amountToBuy / currentPrice;
            currentBalance -= amountToBuy;
            referencePrice = currentPrice;
            hasTraded = true;
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
