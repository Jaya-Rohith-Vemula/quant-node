import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConn } from './_shared/db.js';
import oracledb from 'oracledb';
import { startOfWeek, format, parseISO } from 'date-fns';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { symbol, startDate, endDate, startTime, endTime } = req.body;

        if (!symbol || !startDate || !endDate) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const conn = await getConn();

        console.log(`[${new Date().toISOString()}] Volatility Analysis for ${symbol}`);

        // Adding buffer of full days for inclusive range
        const queryStartDate = startDate + ' 00:00';
        const queryEndDate = endDate + ' 23:59';

        const result = await conn.execute(
            `SELECT "datetime", "trade_date" as "date", "open", "high", "low", "close"
             FROM "historical" 
             WHERE "symbol" = :symbol 
               AND "datetime" >= :startDate 
               AND "datetime" <= :endDate 
             ORDER BY "datetime" ASC`,
            { symbol, startDate: queryStartDate, endDate: queryEndDate },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        let rows = result.rows as any[];

        // Filter by time if provided
        if (startTime && endTime) {
            rows = rows.filter((row: any) => {
                const timePart = row.datetime.includes(' ') ? row.datetime.split(' ')[1] : '';
                if (!timePart) return true; // Daily rows lack time part
                return timePart >= startTime && timePart <= endTime;
            });
        }

        if (rows.length === 0) {
            return res.status(200).json({ error: 'No data found for the given parameters.' });
        }

        // Helper to aggregate based on a grouping key
        const aggregate = (getKey: (row: any) => string) => {
            const groups = new Map<string, any>();

            for (const row of rows) {
                const key = getKey(row);
                if (!groups.has(key)) {
                    groups.set(key, {
                        period: key,
                        low: row.low,
                        high: row.high,
                        lowTime: row.datetime,
                        highTime: row.datetime,
                        open: row.open,
                        openTime: row.datetime,
                        close: row.close,
                        closeTime: row.datetime
                    });
                } else {
                    const group = groups.get(key);
                    if (row.low < group.low) {
                        group.low = row.low;
                        group.lowTime = row.datetime;
                    }
                    if (row.high > group.high) {
                        group.high = row.high;
                        group.highTime = row.datetime;
                    }
                    group.close = row.close; // continuously update to last
                    group.closeTime = row.datetime;
                }
            }

            const periods = Array.from(groups.values()).map(g => {
                const volatilityPct = g.low > 0 ? ((g.high - g.low) / g.low) * 100 : 0;
                return { ...g, volatilityPct };
            });

            if (periods.length === 0) return null;

            let maxPeriod = periods[0];
            let minPeriod = periods[0];
            let sumVolatility = 0;

            for (const p of periods) {
                if (p.volatilityPct > maxPeriod.volatilityPct) {
                    maxPeriod = p;
                }
                if (p.volatilityPct < minPeriod.volatilityPct) {
                    minPeriod = p;
                }
                sumVolatility += p.volatilityPct;
            }

            return {
                averageVolatility: sumVolatility / periods.length,
                maxVolatility: maxPeriod,
                minVolatility: minPeriod,
                periodsCount: periods.length,
                allPeriods: periods
            };
        };

        const daily = aggregate((row) => row.datetime.split(' ')[0]);
        const weekly = aggregate((row) => {
            const date = parseISO(row.datetime.split(' ')[0]);
            return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        });
        const monthly = aggregate((row) => row.datetime.substring(0, 7));

        return res.status(200).json({
            daily,
            weekly,
            monthly,
            totalRows: rows.length
        });
    } catch (error: any) {
        console.error('Volatility API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
