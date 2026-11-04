import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { createRateProvider } from './fx.service.js';

// Base currency (prices are stored in it) + the currencies the site displays (UA → UAH, EN → USD).
const getRates = createRateProvider({ currencies: [env.DEFAULT_CURRENCY, 'USD'] });

export const publicFxRouter = Router();

publicFxRouter.get(
  '/exchange-rates',
  asyncHandler(async (_req, res) => {
    const rates = await getRates();
    if (!rates) {
      logger.warn('Exchange rates unavailable (NBU unreachable and no cached rate)');
      return res.status(503).json({ error: { code: 'RATES_UNAVAILABLE', message: 'Exchange rates unavailable' } });
    }
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ base: env.DEFAULT_CURRENCY, ...rates });
  }),
);
