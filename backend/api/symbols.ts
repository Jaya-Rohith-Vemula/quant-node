import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, getConn } from './_shared/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const conn = await getConn();

        // Using UPPERCASE for table and column names to match Oracle's default case-sensitivity behavior with Knex quoting
        const result = await db
            .select('SYMBOL')
            .from('SYMBOLS')
            .connection(conn)
            .where('IS_ACTIVE', 1)
            .orderBy('SYMBOL', 'asc');

        const symbols = result.map((r: any) => r.SYMBOL || r.symbol);

        return res.status(200).json(symbols);
    } catch (error: any) {
        console.error('Symbols fetch error:', error);
        return res.status(500).json({ error: error.message });
    }
}
