import cron from 'node-cron';
import { inviteRecentCheckouts } from '../modules/reviews/review-invite.service.js';
import { logger } from '../lib/logger.js';

// Hourly, at :30 (the expiry job runs at :00): invite the guests whose stay ended.
export function startReviewInviteJob() {
  cron.schedule('30 * * * *', async () => {
    try {
      const count = await inviteRecentCheckouts();
      if (count > 0) logger.info({ count }, 'Review invitations sent');
    } catch (err) {
      logger.error({ err }, 'Review invitation job failed');
    }
  });
}
