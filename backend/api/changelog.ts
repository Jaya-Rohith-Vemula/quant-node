import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, getConn } from './_shared/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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
        const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
        const isAuthorized = adminKey === process.env.ADMIN_SECRET_KEY;

        // VERIFY: Check if key is valid
        if (req.method === 'POST' && req.body?.action === 'verify') {
            if (isAuthorized) return res.status(200).json({ success: true });
            return res.status(401).json({ error: 'Invalid secret key' });
        }

        // GET: Fetch all entries
        if (req.method === 'GET') {
            const data = await db
                .select('*')
                .from('changelog')
                .connection(conn)
                .orderBy('update_date', 'desc');
            return res.status(200).json(data);
        }

        // POST/PUT: Admin only - Add or Edit
        if (req.method === 'POST' || req.method === 'PUT') {
            if (!isAuthorized) return res.status(401).json({ error: 'Unauthorized' });

            const { id, title, description, status, type, update_date } = req.body;

            if (id) {
                // Update
                await db('changelog')
                    .connection(conn)
                    .where('id', id)
                    .update({
                        title,
                        description,
                        status,
                        type,
                        update_date: update_date ? new Date(update_date) : new Date()
                    });
                return res.status(200).json({ message: 'Updated successfully' });
            } else {
                // Insert
                await db('changelog')
                    .connection(conn)
                    .insert({
                        title,
                        description,
                        status,
                        type,
                        update_date: update_date ? new Date(update_date) : new Date()
                    });
                return res.status(201).json({ message: 'Created successfully' });
            }
        }

        // DELETE: Admin only
        if (req.method === 'DELETE') {
            if (!isAuthorized) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'ID required' });

            await db('changelog')
                .connection(conn)
                .where('id', id)
                .delete();
            return res.status(200).json({ message: 'Deleted successfully' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        console.error('Changelog API error:', error);
        return res.status(500).json({ error: error.message });
    }
}
