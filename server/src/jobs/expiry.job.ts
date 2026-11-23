import cron from 'node-cron';
import { expireStalePending } from '../modules/booking/booking.service.js';
import { deleteDeadSessions } from '../modules/auth/auth.service.js';
import { logger } from '../lib/logger.js';

// Run hourly: move stale PENDING requests to EXPIRED so the inbox stays clean, and drop admin
// sessions that can no longer be used.
export function startExpiryJob() {
  cron.schedule('0 * * * *', async () => {
    try {
      const count = await expireStalePending();
      if (count > 0) logger.info({ count }, 'Expired stale pending bookings');
    } catch (err) {
      logger.error({ err }, 'Expiry job failed');
    }
    try {
      const sessions = await deleteDeadSessions();
      if (sessions > 0) logger.info({ count: sessions }, 'Deleted expired admin sessions');
    } catch (err) {
      logger.error({ err }, 'Session clean-up failed');
    }
  });
}
