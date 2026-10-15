import { VerifiedCallback } from '@node-saml/passport-saml';

import { HttpException } from '@/exceptions/HttpException';
import { Profile } from '@/interfaces/profile.interface';
import { SamlIdentity, User } from '@/interfaces/users.interface';
import { NO_SESSION_SENDER } from '@/services/api.service';
import { getCitizenPartyId } from '@/services/citizen.service';
import { logger } from '@/utils/logger';
import { sanitizePersonNumber } from '@/utils/sanitizePersonNumber';

/**
 * Citizens, not employees: the IdP sends no group or role claims, so nothing is authorized here.
 * Identity is the citizen identifier, exchanged for the party id the rest of the app keys on.
 */
export const citizenVerify = async (profile: Profile | null, done: VerifiedCallback): Promise<void> => {
  if (!profile) {
    done({ name: 'SAML_MISSING_PROFILE', message: 'Missing SAML profile' });
    return;
  }

  const samlIdentity: SamlIdentity = {
    nameID: profile.nameID,
    nameIDFormat: profile.nameIDFormat,
    sessionIndex: profile.sessionIndex ?? '',
  };
  const refuse = (name: string, message: string) => {
    done(null, undefined, { name, message, samlIdentity });
  };

  const { firstname: givenName, Surname: surname, citizenIdentifier } = profile;

  // Its own case: an identity without a citizen identifier is an employee, not a citizen.
  if (!citizenIdentifier) {
    logger.error('The IDP profile carries no citizen identifier');
    refuse('SAML_MISSING_CITIZEN_IDENTIFIER', 'Missing citizen identifier');
    return;
  }

  if (!givenName || !surname) {
    logger.error('Could not extract necessary profile data fields from the IDP profile. Does the Profile interface match the IDP profile response?');
    refuse('SAML_MISSING_ATTRIBUTES', 'Missing profile attributes');
    return;
  }

  const personNumber = sanitizePersonNumber(citizenIdentifier);
  if (personNumber === undefined) {
    logger.error('The citizen identifier in the IDP profile is not a person number');
    refuse('SAML_INVALID_CITIZEN_IDENTIFIER', 'Invalid citizen identifier');
    return;
  }

  try {
    // The party id being resolved here is the one every later call sends as X-Sent-By.
    const partyId = await getCitizenPartyId(personNumber, NO_SESSION_SENDER);

    const findUser: User = {
      partyId,
      personNumber,
      name: `${givenName} ${surname}`,
      firstName: givenName,
      lastName: surname,
      nameID: profile.nameID,
      nameIDFormat: profile.nameIDFormat,
      sessionIndex: profile.sessionIndex ?? '',
    };

    // The profile and the person number are PII — never above debug.
    logger.info(`Authenticated citizen ${partyId}`);
    logger.debug(`Found user: ${JSON.stringify(findUser)}`);

    done(null, findUser);
  } catch (err) {
    if (err instanceof HttpException && err.status === 404) {
      logger.error('Citizen has no party id');
      refuse('SAML_CITIZEN_FAILED', 'Failed to fetch user from Citizen API');
      return;
    }
    logger.error('Error when calling Citizen:');
    logger.error(err);
    done(err instanceof Error ? err : null);
  }
};
