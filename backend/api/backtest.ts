import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runBacktest, StrategyParams } from './_shared/strategy.js';
import { validateSymbol, validateBalance, validateDate } from './_shared/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log(`[${new Date().toISOString()}] Incoming backtest request:`, req.body);

        // Validate inputs before processing
        const params: StrategyParams = {
            symbol: validateSymbol(req.body.symbol || 'SOFI'),
            initialBalance: validateBalance(req.body.initialBalance || '10000'),
            startDate: validateDate(req.body.startDate || '2022-01-01'),
            endDate: validateDate(req.body.endDate || '2099-12-31'),
            strategyType: req.body.strategyType || 'grid_trading',
            strategyParams: req.body.strategyParams || {}
        };

        console.log('Running backtest with params:', params);
        const result = await runBacktest(params);
        console.log('Backtest completed successfully. Summary:', result.summary);
        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Backtest error in handler:', error);
        return res.status(500).json({ error: error.message });
    }
}
