import fs from 'fs';
import oracledb from 'oracledb';
import { getConn, closeConn } from './api/_shared/db.js';

/**
 * Generic script to export historical data for any symbol.
 * Usage: npx tsx export_ticker_data.ts <SYMBOL> <START_DATE> <END_DATE> [INTERVAL]
 * Example: npx tsx export_ticker_data.ts $VIX 2020-01-01 2026-03-12 1min
 */

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log('');
        console.log('Error: Missing symbol.');
        console.log('Usage: npx tsx export_ticker_data.ts <SYMBOL> [START_DATE] [END_DATE] [INTERVAL]');
        console.log('   SYMBOL: e.g. $VIX, $SPX, $AAPL');
        console.log('   START_DATE: YYYY-MM-DD (Default: 2020-01-01)');
        console.log('   END_DATE: YYYY-MM-DD (Default: 2026-03-12)');
        console.log('   INTERVAL: 1min, 30min (Default: 1min)');
        console.log('');
        process.exit(1);
    }

    const symbol = args[0];
    const startDateRaw = args[1] || '2020-01-01';
    const endDateRaw = args[2] || '2026-03-12';
    const intervalSelection = args[3] || '1min';

    // Validation: Catch if $VIX was expanded to empty by shell
    if (symbol.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.error('❌ Error: The symbol looks like a date.');
        console.error(`   You likely ran: npx tsx export_ticker_data.ts $VIX ...`);
        console.error(`   The shell treats $VIX as a variable. Use single quotes: '$VIX'`);
        process.exit(1);
    }

    // Normalize dates for SQL (append time if missing)
    const sqlStartDate = startDateRaw.includes(':') ? startDateRaw : `${startDateRaw} 00:00`;
    const sqlEndDate = endDateRaw.includes(':') ? endDateRaw : `${endDateRaw} 23:59`;

    const targetTimes30min = [
        '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
        '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'
    ];

    try {
        console.log(`🚀 Connecting to Oracle Database...`);
        const conn = await getConn();

        console.log(`📊 Fetching ${intervalSelection} data for ${symbol}...`);
        console.log(`🗓️  Period: ${sqlStartDate} to ${sqlEndDate}`);

        // Base query - we filter for market hours (09:30 to 16:00) directly in SQL for 1min data
        // For 30min, we query the full range and filter in JS to stay consistent with existing patterns
        let query = `
            SELECT "datetime", "open", "high", "low", "close"
            FROM "historical" 
            WHERE "symbol" = :symbol 
              AND "datetime" >= :startDate 
              AND "datetime" <= :endDate 
        `;

        // If 1min, we restrict to market hours in SQL for performance
        if (intervalSelection === '1min') {
            query += `
              AND substr("datetime", 12, 5) >= '09:30'
              AND substr("datetime", 12, 5) <= '16:00'
            `;
        }

        query += ` ORDER BY "datetime" ASC`;

        const result: any = await conn.execute(
            query,
            { symbol, startDate: sqlStartDate, endDate: sqlEndDate },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const rows = result.rows || [];
        console.log(`✅ Loaded ${rows.length} raw rows from database.`);

        const csvHeader = ['Date', 'Time', 'Open', 'High', 'Low', 'Close'].join(',');
        let csvContent = csvHeader + '\n';

        let count = 0;
        for (const row of rows) {
            const [date, time] = row.datetime.split(' ');

            // If 30min interval selection, filter for specific timestamps
            if (intervalSelection === '30min' && !targetTimes30min.includes(time)) {
                continue;
            }

            const line = [
                date,
                time,
                row.open.toFixed(2),
                row.high.toFixed(2),
                row.low.toFixed(2),
                row.close.toFixed(2)
            ].join(',');

            csvContent += line + '\n';
            count++;
        }

        // Clean filename: remove $ and other special chars for the filename
        const safeSymbolLabel = symbol.replace(/[^a-zA-Z0-9]/g, '');
        const fileStart = startDateRaw.split(' ')[0].replace(/-/g, '');
        const fileEnd = endDateRaw.split(' ')[0].replace(/-/g, '');

        const outPath = `../${safeSymbolLabel}_${intervalSelection}_Snapshot_${fileStart}_${fileEnd}.csv`;

        fs.writeFileSync(outPath, csvContent);
        console.log(`📝 Exported ${count} records to ${outPath}`);

    } catch (error) {
        console.error('❌ Error during export:', error);
    } finally {
        await closeConn();
    }
}

main();
