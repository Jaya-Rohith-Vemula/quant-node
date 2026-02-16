import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, getConn } from './_shared/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const symbol = (req.query.symbol as string) || 'SOFI';
        const limit = parseInt((req.query.limit as string) || '100');

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
