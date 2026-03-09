/**
 * AMR Strategy Optimizer
 * 
 * Finds the optimal parameters for any stock by running a comprehensive
 * parameter sweep across timeframes, EMAs, trail stops, cooldowns, and modes.
 * 
 * Usage:
 *   npx tsx optimize_amr.ts SOFI
 *   npx tsx optimize_amr.ts PLTR
 *   npx tsx optimize_amr.ts AMZN
 *   npx tsx optimize_amr.ts SOFI 2023-01-01 2026-02-28   (custom date range)
 */

import { runBacktest } from './api/_shared/strategy.js';

const symbol = process.argv[2] || 'SOFI';
const startDate = process.argv[3] || '2022-01-01';
const endDate = process.argv[4] || '2026-02-28';
const initialBalance = 10000;

interface ConfigResult {
    label: string;
    timeframe: string;
    params: Record<string, any>;
    ret: number;
    dd: number;
    trades: number;
    bhRet: number;
    beatBH: boolean;
    score: number;       // return / drawdown
    calmar: number;      // annualized return / max DD
    winRate: number;
}

async function runConfig(label: string, tf: string, params: Record<string, any>): Promise<ConfigResult | null> {
    try {
        const result = await runBacktest({
            symbol,
            initialBalance,
            startDate,
            endDate,
            strategyType: 'amr',
            strategyParams: params,
            timeframe: tf
        });
        const s = result.summary;
        const ret = ((s.finalAccountValue - initialBalance) / initialBalance * 100);
        const dd = s.maxDrawdownPercent;
        const score = dd > 0 ? ret / dd : 0;

        // Calculate win rate
        const wins = result.trades.filter((t: any) => t.type === 'sell' && t.profit > 0).length;
        const totalSells = result.trades.filter((t: any) => t.type === 'sell').length;
        const winRate = totalSells > 0 ? (wins / totalSells * 100) : 0;

        // Approximate annualized return for Calmar ratio
        const years = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        const annRet = (Math.pow(s.finalAccountValue / initialBalance, 1 / years) - 1) * 100;
        const calmar = dd > 0 ? annRet / dd : 0;

        return {
            label, timeframe: tf, params,
            ret, dd, trades: result.trades.length,
            bhRet: s.buyAndHoldReturnPercent, beatBH: s.finalAccountValue > s.buyAndHoldFinalValue,
            score, calmar, winRate
        };
    } catch (e: any) {
        console.error(`  ❌ ${label}: ${e.message.substring(0, 80)}`);
        return null;
    }
}

async function optimize() {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`  AMR STRATEGY OPTIMIZER — ${symbol}`);
    console.log(`  Date Range: ${startDate} to ${endDate}`);
    console.log(`${'═'.repeat(80)}\n`);

    const results: ConfigResult[] = [];
    let configCount = 0;

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: Timeframe + EMA combinations
    // ═══════════════════════════════════════════════════════════
    console.log('📊 PHASE 1: Timeframe & EMA Sweep...\n');

    const emaSets = [
        { fast: 5, slow: 13, trend: 34, label: 'EMA(5/13/34)' },
        { fast: 8, slow: 21, trend: 50, label: 'EMA(8/21/50)' },
        { fast: 5, slow: 13, trend: 50, label: 'EMA(5/13/50)' },
        { fast: 8, slow: 21, trend: 34, label: 'EMA(8/21/34)' },
    ];

    const timeframes = [
        { tf: '5m', htf: '1h', eod: 1, label: '5m intraday' },
        { tf: '15m', htf: '1h', eod: 1, label: '15m intraday' },
        { tf: '1h', htf: 'none', eod: 0, label: '1h swing' },
    ];

    for (const tf of timeframes) {
        for (const ema of emaSets) {
            configCount++;
            const label = `${tf.label} ${ema.label}`;
            process.stdout.write(`  [${configCount}] ${label}...`);
            const r = await runConfig(label, tf.tf, {
                fastEMA: ema.fast, slowEMA: ema.slow, trendEMA: ema.trend,
                trendTrailATR: 2.5, choppyTrailATR: 1.5,
                rsiFloor: 35, rsiCeiling: 75, reentryBars: 5,
                htfConfirm: tf.htf, autoAdapt: 0,
                marketHoursOnly: 1, forceEodExit: tf.eod,
            });
            if (r) {
                results.push(r);
                console.log(` ${r.ret > 0 ? '+' : ''}${r.ret.toFixed(0)}%, ${r.dd.toFixed(0)}%DD, score=${r.score.toFixed(1)}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: Trail & Cooldown optimization (top 2 TF+EMA combos)
    // ═══════════════════════════════════════════════════════════
    console.log('\n📊 PHASE 2: Trail & Cooldown Optimization (top configs)...\n');

    const phase1Sorted = [...results].sort((a, b) => b.score - a.score);
    const topConfigs = phase1Sorted.slice(0, 2);

    const trailSets = [
        { trend: 2.0, choppy: 1.0 },
        { trend: 2.5, choppy: 1.5 },
        { trend: 3.0, choppy: 1.5 },
        { trend: 3.0, choppy: 2.0 },
    ];
    const cooldowns = [3, 5, 8, 10];

    for (const top of topConfigs) {
        for (const trail of trailSets) {
            for (const cd of cooldowns) {
                configCount++;
                const label = `${top.timeframe} ${top.label.split(' ').slice(1).join(' ')} T(${trail.trend}/${trail.choppy}) c=${cd}`;
                process.stdout.write(`  [${configCount}] ${label}...`);
                const r = await runConfig(label, top.timeframe, {
                    ...top.params,
                    trendTrailATR: trail.trend, choppyTrailATR: trail.choppy,
                    reentryBars: cd, autoAdapt: 0,
                });
                if (r) {
                    results.push(r);
                    console.log(` ${r.ret > 0 ? '+' : ''}${r.ret.toFixed(0)}%, ${r.dd.toFixed(0)}%DD, score=${r.score.toFixed(1)}`);
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: Auto-Adapt on top 5 configs
    // ═══════════════════════════════════════════════════════════
    console.log('\n📊 PHASE 3: Auto-Adapt on Top Configs...\n');

    const phase2Sorted = [...results].sort((a, b) => b.score - a.score);
    const topForAdapt = phase2Sorted.slice(0, 5);

    for (const top of topForAdapt) {
        configCount++;
        const label = `${top.label} +AA`;
        process.stdout.write(`  [${configCount}] ${label}...`);
        const r = await runConfig(label, top.timeframe, {
            ...top.params, autoAdapt: 1,
        });
        if (r) {
            results.push(r);
            console.log(` ${r.ret > 0 ? '+' : ''}${r.ret.toFixed(0)}%, ${r.dd.toFixed(0)}%DD, score=${r.score.toFixed(1)}`);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 4: HTF variations on best config
    // ═══════════════════════════════════════════════════════════
    console.log('\n📊 PHASE 4: HTF Timeframe Variations...\n');

    const bestSoFar = [...results].sort((a, b) => b.score - a.score)[0];
    if (bestSoFar.timeframe !== '1h') { // Only if intraday
        for (const htf of ['30m', '1h', '4h']) {
            configCount++;
            const label = `Best+HTF=${htf}`;
            process.stdout.write(`  [${configCount}] ${label}...`);
            const r = await runConfig(label, bestSoFar.timeframe, {
                ...bestSoFar.params, htfConfirm: htf,
            });
            if (r) {
                results.push(r);
                console.log(` ${r.ret > 0 ? '+' : ''}${r.ret.toFixed(0)}%, ${r.dd.toFixed(0)}%DD, score=${r.score.toFixed(1)}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // FINAL REPORT
    // ═══════════════════════════════════════════════════════════
    const sorted = results.sort((a, b) => b.score - a.score);
    const bhRet = sorted[0]?.bhRet ?? 0;

    console.log(`\n${'═'.repeat(100)}`);
    console.log(`  FINAL RESULTS — ${symbol} (${configCount} configs tested)`);
    console.log(`  Buy & Hold: ${bhRet > 0 ? '+' : ''}${bhRet.toFixed(0)}%`);
    console.log(`${'═'.repeat(100)}\n`);

    console.log(`${'Rank'.padEnd(5)} | ${'Config'.padEnd(48)} | ${'Return'.padEnd(8)} | ${'MaxDD'.padEnd(6)} | ${'Trades'.padEnd(7)} | ${'WinRate'.padEnd(8)} | ${'Score'.padEnd(6)} | B&H`);
    console.log('-'.repeat(105));

    sorted.forEach((r, idx) => {
        const rank = idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `${idx + 1}.`;
        console.log(
            `${rank.padEnd(5)} | ` +
            `${r.label.padEnd(48)} | ` +
            `${(r.ret > 0 ? '+' : '') + r.ret.toFixed(0) + '%'}`.padEnd(8) +
            ` | ${r.dd.toFixed(0) + '%'}`.padEnd(7) +
            ` | ${String(r.trades).padEnd(7)}` +
            ` | ${r.winRate.toFixed(0) + '%'}`.padEnd(9) +
            ` | ${r.score.toFixed(1).padEnd(6)}` +
            ` | ${r.beatBH ? '✅' : '❌'}`
        );
    });

    // Print the best config as JSON
    const best = sorted[0];
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`  🏆 BEST CONFIG FOR ${symbol}`);
    console.log(`${'═'.repeat(80)}\n`);
    console.log(`  Return: ${best.ret > 0 ? '+' : ''}${best.ret.toFixed(0)}%`);
    console.log(`  Max DD: ${best.dd.toFixed(0)}%`);
    console.log(`  Score:  ${best.score.toFixed(2)} (return/drawdown)`);
    console.log(`  Trades: ${best.trades}`);
    console.log(`  WinRate: ${best.winRate.toFixed(0)}%`);
    console.log(`  Beat B&H: ${best.beatBH ? 'YES ✅' : 'NO ❌'} (B&H = ${bhRet > 0 ? '+' : ''}${bhRet.toFixed(0)}%)`);
    console.log(`\n  JSON config:\n`);
    console.log(JSON.stringify({
        symbol,
        initialBalance,
        startDate,
        endDate,
        strategyType: 'amr',
        strategyParams: best.params,
        timeframe: best.timeframe
    }, null, 4));

    // Also print top 3 for different priorities
    const lowestDD = [...results].sort((a, b) => a.dd - b.dd).filter(r => r.ret > 0)[0];
    const highestRet = [...results].sort((a, b) => b.ret - a.ret)[0];
    const bestCalmar = [...results].sort((a, b) => b.calmar - a.calmar)[0];

    console.log(`\n\n  📋 ALTERNATIVES BY PRIORITY:\n`);
    console.log(`  Lowest Drawdown:  ${lowestDD.label} → +${lowestDD.ret.toFixed(0)}%, ${lowestDD.dd.toFixed(0)}%DD`);
    console.log(`  Highest Return:   ${highestRet.label} → +${highestRet.ret.toFixed(0)}%, ${highestRet.dd.toFixed(0)}%DD`);
    console.log(`  Best Calmar Ratio: ${bestCalmar.label} → +${bestCalmar.ret.toFixed(0)}%, ${bestCalmar.dd.toFixed(0)}%DD, Calmar=${bestCalmar.calmar.toFixed(2)}`);

    process.exit(0);
}

optimize().catch(e => { console.error(e); process.exit(1); });
