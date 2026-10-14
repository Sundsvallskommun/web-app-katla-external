import { SamlIdentity, User } from '@/interfaces/users.interface';
import { RepresentingOrganizations } from '@/services/legal-entity.service';

declare module 'express-session' {
  interface Session {
    returnTo?: string;
    user?: User;
    /**
     * Kept when a login is refused. The IdP still has a session for the identity it asserted, and
     * without this there is no nameID to log it out with — a refused user would loop on re-login.
     */
    samlIdentity?: SamlIdentity;
    passport?: unknown;
    /**
     * Organisations the logged-in citizen may act for, per service key: their own engagements plus
     * the mandates granted in that form's namespace. The only thing errand queries may be scoped
     * by, so it is resolved server side at login and never taken from the request.
     */
    representingBusinessChoices?: RepresentingOrganizations;
    messages: string[];
  }
}
