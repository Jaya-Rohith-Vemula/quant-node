import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, getConn } from './_shared/db.js';
import { validateSymbol } from './_shared/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PATCH,DELETE');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-admin-key'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const conn = await getConn();
        const adminKey = req.headers['x-admin-key'];
        const isAuthorized = adminKey === process.env.ADMIN_SECRET_KEY;

        // GET: Fetch feedback (Admin only)
        if (req.method === 'GET') {
            if (!isAuthorized) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const data = await db
                .select('*')
                .from('FEEDBACK')
                .connection(conn)
                .orderBy('CREATED_AT', 'desc');

            return res.status(200).json(data);
        }

        // POST: Submit feedback (Public)
        if (req.method === 'POST') {
            const { type, title, strategyName, description, logic, priority } = req.body;
            let ticker = req.body.ticker;

            // Validate ticker if provided
            if (ticker) {
                try {
                    ticker = validateSymbol(ticker);
                } catch (e) {
                    // If ticker is malformed, we can either reject or sanitize
                    // For feedback, we'll just ensure it's a string and doesn't contain dangerous characters
                    ticker = String(ticker).substring(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
                }
            }

            // Map types to title/description fields
            const finalTitle = title || strategyName || (type === 'ticker' ? `Ticker Request: ${ticker}` : '');
            const finalDescription = description || logic || '';

            await db('FEEDBACK')
                .connection(conn)
                .insert({
                    TYPE: type,
                    TITLE: finalTitle,
                    DESCRIPTION: finalDescription,
                    TICKER: ticker || null,
                    PRIORITY: priority || null,
                    STATUS: 'pending',
                    CREATED_AT: new Date()
                });

            return res.status(200).json({
                success: true,
                message: 'Feedback received successfully. Thank you!'
            });
        }

        // PATCH: Update feedback (Admin only)
        if (req.method === 'PATCH') {
            if (!isAuthorized) return res.status(401).json({ error: 'Unauthorized' });

            const { id, status } = req.body;
            if (!id) return res.status(400).json({ error: 'ID required' });

            await db('FEEDBACK')
                .connection(conn)
                .where('ID', id)
                .update({ STATUS: status });

            return res.status(200).json({ success: true, message: 'Status updated' });
        }

        // DELETE: Remove feedback (Admin only)
        if (req.method === 'DELETE') {
            if (!isAuthorized) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'ID required' });

            await db('FEEDBACK')
                .connection(conn)
                .where('ID', id)
                .delete();

            return res.status(200).json({ success: true, message: 'Feedback deleted' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        console.error('Feedback API error:', error);
        return res.status(500).json({ error: error.message });
    }
}
