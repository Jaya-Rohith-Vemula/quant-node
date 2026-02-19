import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, getConn } from './_shared/db.js';
import { validateSymbol, validateLimit } from './_shared/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const symbol = validateSymbol(req.query.symbol || 'SOFI');
        const limit = validateLimit(req.query.limit || '100');

        const conn = await getConn();
        const data = await db
            .select('*')
            .from('historical')
            .connection(conn)
            .where('symbol', symbol)
            .orderBy('datetime', 'desc')
            .limit(limit);

        return res.status(200).json(data);
    } catch (error: any) {
        console.error('Data fetch error:', error);
        return res.status(500).json({ error: error.message });
    }
}
