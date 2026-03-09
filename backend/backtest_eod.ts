/**
 * EOD Directional Strategy Backtest Script
 * 
 * Quick script to test the EOD Directional strategy directly.
 * Uses $IUXX for signal analysis, trades actual TQQQ/SQQQ prices.
 * 
 * Usage:
 *   npx tsx backtest_eod.ts                          # defaults
 *   npx tsx backtest_eod.ts 2024-01-01 2025-02-28    # custom date range
 *   npx tsx backtest_eod.ts 2024-01-01 2025-02-28 40 # custom entry threshold
 */

import { runBacktest } from './api/_shared/strategy.js';

const startDate = process.argv[2] || '2024-10-01';
const endDate = process.argv[3] || '2025-02-28';
const entryThreshold = parseInt(process.argv[4] || '40');
const initialBalance = 10000;

async function run() {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`  EOD DIRECTIONAL BACKTEST — $IUXX → TQQQ/SQQQ`);
    console.log(`  Date Range: ${startDate} to ${endDate}`);
    console.log(`  Entry Threshold: ${entryThreshold}`);
    console.log(`${'═'.repeat(80)}\n`);

    const result = await runBacktest({
        symbol: '$IUXX',
        initialBalance,
        startDate,
        endDate,
        strategyType: 'eod_directional',
        strategyParams: {
            fastEMA: 8,
            slowEMA: 21,
            trendEMA: 50,
            rsiPeriod: 14,
            macdFast: 12,
            macdSlow: 26,
            macdSignal: 9,
            entryThreshold,
            exitThreshold: 10,
            trailATR: 2.5,
            cooldownBars: 2,
        },
        timeframe: '1d'
    });

    const s = result.summary;
    const ret = ((s.finalAccountValue - initialBalance) / initialBalance * 100);
    const years = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    console.log(`\n📊 RESULTS:`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`  Final Value:     $${s.finalAccountValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
    console.log(`  Return:          ${ret > 0 ? '+' : ''}${ret.toFixed(2)}%`);
    console.log(`  Buy & Hold:      ${s.buyAndHoldReturnPercent > 0 ? '+' : ''}${s.buyAndHoldReturnPercent.toFixed(2)}% ($${s.buyAndHoldFinalValue.toFixed(2)})`);
    console.log(`  Beat B&H:        ${s.finalAccountValue > s.buyAndHoldFinalValue ? '✅ YES' : '❌ NO'}`);
    console.log(`  Max Drawdown:    ${s.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`  Peak Value:      $${s.peakValue.toFixed(2)}`);
    console.log(`  Total Trades:    ${result.trades.length}`);

    // Win rate
    const sells = result.trades.filter((t: any) => t.type === 'SELL');
    const wins = sells.filter((t: any) => t.profit > 0);
    const losses = sells.filter((t: any) => t.profit < 0);
    console.log(`  Win/Loss:        ${wins.length}W / ${losses.length}L (${sells.length > 0 ? (wins.length / sells.length * 100).toFixed(0) : 0}% win rate)`);
    console.log(`  Avg Win:         $${wins.length > 0 ? (wins.reduce((a: number, t: any) => a + t.profit, 0) / wins.length).toFixed(2) : '0'}`);
    console.log(`  Avg Loss:        $${losses.length > 0 ? (losses.reduce((a: number, t: any) => a + t.profit, 0) / losses.length).toFixed(2) : '0'}`);

    console.log(`\n📋 TRADE LOG:`);
    console.log(`${'─'.repeat(120)}`);
    console.log(`${'#'.padEnd(4)} | ${'Date'.padEnd(12)} | ${'Type'.padEnd(5)} | ${'Price'.padEnd(10)} | ${'Shares'.padEnd(10)} | ${'Profit'.padEnd(12)} | Comment`);
    console.log(`${'─'.repeat(120)}`);

    for (const t of result.trades) {
        const profitStr = t.profit !== 0 ? `${t.profit > 0 ? '+' : ''}$${t.profit.toFixed(2)}` : '—';
        console.log(
            `${String(t.tradeNo).padEnd(4)} | ` +
            `${t.datetime.substring(0, 10).padEnd(12)} | ` +
            `${t.type.padEnd(5)} | ` +
            `$${t.price.toFixed(2).padEnd(9)} | ` +
            `${t.shares.toFixed(2).padEnd(10)} | ` +
            `${profitStr.padEnd(12)} | ` +
            `${t.comment.substring(0, 60)}`
        );
    }

    console.log(`\n${'═'.repeat(80)}\n`);

    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
