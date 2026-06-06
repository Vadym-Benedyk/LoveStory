import cron from 'node-cron';
import { expireStalePending } from '../modules/booking/booking.service.js';
import { logger } from '../lib/logger.js';

// Run hourly: move stale PENDING requests to EXPIRED so the inbox stays clean.
export function startExpiryJob() {
  cron.schedule('0 * * * *', async () => {
    try {
      const count = await expireStalePending();
      if (count > 0) logger.info({ count }, 'Expired stale pending bookings');
    } catch (err) {
      logger.error({ err }, 'Expiry job failed');
    }
  });
}
