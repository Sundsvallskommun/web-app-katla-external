/** What a LogoutRequest needs to name a session at the IdP. */
export interface SamlIdentity extends Record<string, unknown> {
  nameID: string;
  nameIDFormat: string;
  sessionIndex: string;
}

// Indexable because passport's VerifiedCallback hands the user on as a plain record.
export interface User extends Record<string, unknown> {
  /** Party id from Citizen. The identity everything upstream keys the citizen on. */
  partyId: string;
  /** Person number, twelve digits, from the SAML citizen identifier. Keys LegalEntity engagements. */
  personNumber: string;
  name: string;
  firstName: string;
  lastName: string;
  /** From the assertion. Identifies the IdP session to end at logout. */
  nameID: string;
  nameIDFormat: string;
  sessionIndex: string;
}

/** What /me hands the browser. The party id stays server side. */
export interface ClientUser {
  name: string;
  initials: string;
}
