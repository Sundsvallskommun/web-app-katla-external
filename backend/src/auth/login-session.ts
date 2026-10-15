import { Request } from 'express';

import { User } from '@/interfaces/users.interface';
import { getMyOrganizations } from '@/services/legal-entity.service';
import { logger } from '@/utils/logger';

/**
 * The citizen's organisations are the only scope errand queries accept, so they are resolved
 * server side at login and never taken from a request. A failure here leaves the session without
 * organisations, which the errand endpoints answer with 403 rather than an unscoped read.
 *
 * Call after req.login so it lands on the authenticated, persisted session.
 */
export const loadRepresentingOrganizations = async (req: Request): Promise<void> => {
  const user = req.user as User | undefined;

  if (user) {
    try {
      req.session.representingBusinessChoices = await getMyOrganizations(user.personNumber, user.partyId, { user });
    } catch (error) {
      logger.error(`Could not resolve the organizations for citizen ${user.partyId}`);
      logger.error(error);
    }
  }

  await new Promise<void>(resolve => {
    req.session.save(saveErr => {
      if (saveErr) {
        logger.error('Could not save the session after login');
      }
      resolve();
    });
  });
};
