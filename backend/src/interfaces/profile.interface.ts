import { Profile as SamlProfile } from '@node-saml/passport-saml';

/**
 * The citizen-facing IdP profile. This app logs in citizens, not employees, so there are no
 * group or role claims here — only the identity attributes and the citizen identifier.
 */
export interface Profile extends SamlProfile {
  /** The citizen's person number, exchanged for a party id via Citizen at login. */
  citizenIdentifier?: string;
  firstname?: string;
  Surname?: string;
  attributes?: Record<string, unknown>;
}
