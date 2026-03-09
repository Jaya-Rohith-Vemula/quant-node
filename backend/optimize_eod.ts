/**
 * EOD Directional Strategy Optimizer
 * 
 * Sweeps through parameter combinations to find the best settings
 * for the trend-following TQQQ/SQQQ strategy on $IUXX.
 * 
 * Usage:
 *   npx tsx optimize_eod.ts                           # defaults (2024-01-01 to 2025-02-28)
 *   npx tsx optimize_eod.ts 2023-01-01 2025-02-28     # custom date range
 */

import { runBacktest } from './api/_shared/strategy.js';

const startDate = process.argv[2] || '2024-01-01';
const endDate = process.argv[3] || '2025-02-28';
const initialBalance = 10000;

interface ConfigResult {
    label: string;
    params: Record<string, any>;
    ret: number;
    dd: number;
    trades: number;
    bhRet: number;
    beatBH: boolean;
    score: number;
    calmar: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    finalValue: number;
}

async function runConfig(label: string, params: Record<string, any>): Promise<ConfigResult | null> {
    try {
        const result = await runBacktest({
            symbol: '$IUXX',
            initialBalance,
            startDate,
            endDate,
            strategyType: 'eod_directional',
            strategyParams: params,
            timeframe: '1d'
        });
        const s = result.summary;
        const ret = ((s.finalAccountValue - initialBalance) / initialBalance * 100);
        const dd = s.maxDrawdownPercent;
        const score = dd > 0 ? ret / dd : 0;

        // Win/loss stats
        const sells = result.trades.filter((t: any) => t.type === 'SELL');
        const wins = sells.filter((t: any) => t.profit > 0);
        const losses = sells.filter((t: any) => t.profit < 0);
        const winRate = sells.length > 0 ? (wins.length / sells.length * 100) : 0;
        const avgWin = wins.length > 0 ? wins.reduce((a: number, t: any) => a + t.profit, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a: number, t: any) => a + t.profit, 0) / losses.length) : 0;
        const totalWins = wins.reduce((a: number, t: any) => a + t.profit, 0);
        const totalLosses = Math.abs(losses.reduce((a: number, t: any) => a + t.profit, 0));
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 99 : 0;

        // Calmar ratio
        const years = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        const annRet = (Math.pow(Math.max(0.01, s.finalAccountValue) / initialBalance, 1 / years) - 1) * 100;
        const calmar = dd > 0 ? annRet / dd : 0;

        return {
            label, params,
            ret, dd, trades: result.trades.length,
            bhRet: s.buyAndHoldReturnPercent,
            beatBH: s.finalAccountValue > s.buyAndHoldFinalValue,
            score, calmar, winRate, avgWin, avgLoss, profitFactor,
            finalValue: s.finalAccountValue
        };
    } catch (e: any) {
        console.error(`  ❌ ${label}: ${e.message.substring(0, 80)}`);
        return null;
    }
}

async function optimize() {
    console.log(`\n${'═'.repeat(90)}`);
    console.log(`  EOD DIRECTIONAL OPTIMIZER — $IUXX → TQQQ/SQQQ`);
    console.log(`  Date Range: ${startDate} to ${endDate}`);
    console.log(`${'═'.repeat(90)}\n`);

    const results: ConfigResult[] = [];
    let configCount = 0;

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: EMA combinations × Entry thresholds
    // The core question: which trend detection + threshold works?
    // ═══════════════════════════════════════════════════════════
    console.log('📊 PHASE 1: EMA Trend Detection + Entry Thresholds\n');

    const emaSets = [
        { fast: 5, slow: 13, trend: 34, label: 'EMA(5/13/34)' },
        { fast: 8, slow: 21, trend: 50, label: 'EMA(8/21/50)' },
        { fast: 10, slow: 30, trend: 50, label: 'EMA(10/30/50)' },
        { fast: 8, slow: 21, trend: 100, label: 'EMA(8/21/100)' },
        { fast: 13, slow: 34, trend: 89, label: 'EMA(13/34/89)' },
        { fast: 5, slow: 21, trend: 50, label: 'EMA(5/21/50)' },
    ];

    const entryThresholds = [25, 30, 35, 40, 50, 60];

    for (const ema of emaSets) {
        for (const entry of entryThresholds) {
            configCount++;
            const label = `${ema.label} entry=${entry}`;
            process.stdout.write(`  [${configCount}] ${label}...`);
            const r = await runConfig(label, {
                fastEMA: ema.fast, slowEMA: ema.slow, trendEMA: ema.trend,
                rsiPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9,
                entryThreshold: entry, exitThreshold: 10,
                trailATR: 2.5, cooldownBars: 2,
            });
            if (r) {
                results.push(r);
                console.log(` ${r.ret > 0 ? '+' : ''}${r.ret.toFixed(1)}% | ${r.dd.toFixed(0)}%DD | ${r.trades}T | WR=${r.winRate.toFixed(0)}% | score=${r.score.toFixed(2)}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: Trail stops + exit thresholds on top 3
    // ═══════════════════════════════════════════════════════════
    console.log('\n📊 PHASE 2: Trail Stops & Exit Thresholds (top 5 from Phase 1)\n');

    const phase1Top = [...results].sort((a, b) => b.score - a.score).slice(0, 5);

    const trailATRs = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
    const exitThresholds = [5, 10, 15, 20, 30];

    for (const top of phase1Top) {
        for (const trail of trailATRs) {
            for (const exit of exitThresholds) {
                configCount++;
                const label = `${top.label} trail=${trail} exit=${exit}`;
                process.stdout.write(`  [${configCount}] ${label}...`);
                const r = await runConfig(label, {
                    ...top.params,
                    trailATR: trail,
                    exitThreshold: exit,
                });
                if (r) {
                    results.push(r);
                    console.log(` ${r.ret > 0 ? '+' : ''}${r.ret.toFixed(1)}% | ${r.dd.toFixed(0)}%DD | ${r.trades}T | WR=${r.winRate.toFixed(0)}% | score=${r.score.toFixed(2)}`);
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: Cooldown bars on top 5 overall
    // ═══════════════════════════════════════════════════════════
    console.log('\n📊 PHASE 3: Cooldown Tuning (top 5 overall)\n');

    const phase2Top = [...results].sort((a, b) => b.score - a.score).slice(0, 5);
    const cooldowns = [0, 1, 2, 3, 5, 8];

    for (const top of phase2Top) {
        for (const cd of cooldowns) {
            configCount++;
            const label = `${top.label.split(' trail')[0]} trail=${top.params.trailATR} exit=${top.params.exitThreshold} cd=${cd}`;
            process.stdout.write(`  [${configCount}] ${label}...`);
            const r = await runConfig(label, {
                ...top.params,
                cooldownBars: cd,
            });
            if (r) {
                results.push(r);
                console.log(` ${r.ret > 0 ? '+' : ''}${r.ret.toFixed(1)}% | ${r.dd.toFixed(0)}%DD | ${r.trades}T | WR=${r.winRate.toFixed(0)}% | score=${r.score.toFixed(2)}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 4: MACD variations on top 3
    // ═══════════════════════════════════════════════════════════
    console.log('\n📊 PHASE 4: MACD Variations (top 3 overall)\n');

    const phase3Top = [...results].sort((a, b) => b.score - a.score).slice(0, 3);
    const macdSets = [
        { fast: 8, slow: 17, signal: 9, label: 'MACD(8/17/9)' },
        { fast: 12, slow: 26, signal: 9, label: 'MACD(12/26/9)' },
        { fast: 12, slow: 26, signal: 5, label: 'MACD(12/26/5)' },
        { fast: 5, slow: 35, signal: 5, label: 'MACD(5/35/5)' },
    ];

    for (const top of phase3Top) {
        for (const macd of macdSets) {
            configCount++;
            const label = `${top.label.split(' trail')[0]} ${macd.label}`;
            process.stdout.write(`  [${configCount}] ${label}...`);
            const r = await runConfig(label, {
                ...top.params,
                macdFast: macd.fast, macdSlow: macd.slow, macdSignal: macd.signal,
            });
            if (r) {
                results.push(r);
                console.log(` ${r.ret > 0 ? '+' : ''}${r.ret.toFixed(1)}% | ${r.dd.toFixed(0)}%DD | ${r.trades}T | WR=${r.winRate.toFixed(0)}% | score=${r.score.toFixed(2)}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 5: RSI period variations on top 3
    // ═══════════════════════════════════════════════════════════
    console.log('\n📊 PHASE 5: RSI Period Variations (top 3 overall)\n');

    const phase4Top = [...results].sort((a, b) => b.score - a.score).slice(0, 3);
    const rsiPeriods = [7, 10, 14, 21];

    for (const top of phase4Top) {
        for (const rsi of rsiPeriods) {
            configCount++;
            const label = `${top.label.split(' trail')[0]} RSI=${rsi}`;
            process.stdout.write(`  [${configCount}] ${label}...`);
            const r = await runConfig(label, {
                ...top.params,
                rsiPeriod: rsi,
            });
            if (r) {
                results.push(r);
                console.log(` ${r.ret > 0 ? '+' : ''}${r.ret.toFixed(1)}% | ${r.dd.toFixed(0)}%DD | ${r.trades}T | WR=${r.winRate.toFixed(0)}% | score=${r.score.toFixed(2)}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // FINAL REPORT
    // ═══════════════════════════════════════════════════════════
    const sorted = [...results].sort((a, b) => b.score - a.score);
    // De-duplicate by keeping best score per unique param set
    const seen = new Set<string>();
    const unique = sorted.filter(r => {
        const key = JSON.stringify(r.params);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const bhRet = unique[0]?.bhRet ?? 0;

    console.log(`\n${'═'.repeat(120)}`);
    console.log(`  FINAL RESULTS — EOD Directional on $IUXX → TQQQ/SQQQ (${configCount} configs tested, ${unique.length} unique)`);
    console.log(`  Buy & Hold: ${bhRet > 0 ? '+' : ''}${bhRet.toFixed(1)}%    Date Range: ${startDate} → ${endDate}`);
    console.log(`${'═'.repeat(120)}\n`);

    console.log(
        `${'Rank'.padEnd(5)} | ` +
        `${'Config'.padEnd(55)} | ` +
        `${'Return'.padEnd(9)} | ` +
        `${'MaxDD'.padEnd(7)} | ` +
        `${'Trades'.padEnd(7)} | ` +
        `${'WinR'.padEnd(6)} | ` +
        `${'PF'.padEnd(6)} | ` +
        `${'Score'.padEnd(7)} | ` +
        `B&H`
    );
    console.log('─'.repeat(120));

    unique.slice(0, 25).forEach((r, idx) => {
        const rank = idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `${idx + 1}.`;
        console.log(
            `${rank.padEnd(5)} | ` +
            `${r.label.substring(0, 55).padEnd(55)} | ` +
            `${(r.ret > 0 ? '+' : '') + r.ret.toFixed(1) + '%'}`.padEnd(9) +
            ` | ${(r.dd.toFixed(1) + '%').padEnd(7)}` +
            ` | ${String(r.trades).padEnd(7)}` +
            ` | ${(r.winRate.toFixed(0) + '%').padEnd(6)}` +
            ` | ${r.profitFactor.toFixed(1).padEnd(6)}` +
            ` | ${r.score.toFixed(2).padEnd(7)}` +
            ` | ${r.beatBH ? '✅' : '❌'}`
        );
    });

    // Best config details
    const best = unique[0];
    console.log(`\n${'═'.repeat(90)}`);
    console.log(`  🏆 BEST CONFIG — EOD Directional`);
    console.log(`${'═'.repeat(90)}\n`);
    console.log(`  Return:          ${best.ret > 0 ? '+' : ''}${best.ret.toFixed(2)}%`);
    console.log(`  Final Value:     $${best.finalValue.toFixed(2)}`);
    console.log(`  Max Drawdown:    ${best.dd.toFixed(2)}%`);
    console.log(`  Score (R/DD):    ${best.score.toFixed(3)}`);
    console.log(`  Trades:          ${best.trades}`);
    console.log(`  Win Rate:        ${best.winRate.toFixed(0)}%`);
    console.log(`  Avg Win:         $${best.avgWin.toFixed(2)}`);
    console.log(`  Avg Loss:        $${best.avgLoss.toFixed(2)}`);
    console.log(`  Profit Factor:   ${best.profitFactor.toFixed(2)}`);
    console.log(`  Beat B&H:        ${best.beatBH ? 'YES ✅' : 'NO ❌'} (B&H = ${bhRet > 0 ? '+' : ''}${bhRet.toFixed(1)}%)`);
    console.log(`\n  Strategy Parameters:\n`);
    console.log(JSON.stringify({
        symbol: '$IUXX',
        initialBalance,
        startDate,
        endDate,
        strategyType: 'eod_directional',
        strategyParams: best.params,
        timeframe: '1d'
    }, null, 4));

    // Alternative views
    const profitable = unique.filter(r => r.ret > 0);
    const lowestDD = profitable.length > 0
        ? [...profitable].sort((a, b) => a.dd - b.dd)[0]
        : null;
    const highestRet = [...unique].sort((a, b) => b.ret - a.ret)[0];
    const bestPF = [...unique].filter(r => r.trades >= 4).sort((a, b) => b.profitFactor - a.profitFactor)[0];
    const bestCalmar = [...unique].filter(r => r.ret > 0).sort((a, b) => b.calmar - a.calmar)[0];

    console.log(`\n\n  📋 ALTERNATIVES BY PRIORITY:\n`);
    if (lowestDD) console.log(`  Lowest Drawdown:    ${lowestDD.label} → ${lowestDD.ret > 0 ? '+' : ''}${lowestDD.ret.toFixed(1)}%, ${lowestDD.dd.toFixed(1)}%DD`);
    console.log(`  Highest Return:     ${highestRet.label} → ${highestRet.ret > 0 ? '+' : ''}${highestRet.ret.toFixed(1)}%, ${highestRet.dd.toFixed(1)}%DD`);
    if (bestPF) console.log(`  Best Profit Factor: ${bestPF.label} → PF=${bestPF.profitFactor.toFixed(2)}, ${bestPF.ret > 0 ? '+' : ''}${bestPF.ret.toFixed(1)}%`);
    if (bestCalmar) console.log(`  Best Calmar Ratio:  ${bestCalmar.label} → Calmar=${bestCalmar.calmar.toFixed(2)}, ${bestCalmar.ret > 0 ? '+' : ''}${bestCalmar.ret.toFixed(1)}%`);

    console.log(`\n`);
    process.exit(0);
}

optimize().catch(e => { console.error(e); process.exit(1); });
