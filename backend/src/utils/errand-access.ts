import { MUNICIPALITY_ID, NAMESPACE } from '@/config';
import { Errand, ErrandLifecycleEnum, Stakeholder } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces/auth.interface';
import ApiService from '@/services/api.service';
import { apiURL } from '@/utils/util';

const PRIMARY_STAKEHOLDER_ROLE = 'PRIMARY';

const isPrimaryStakeholder = (stakeholder: Stakeholder): boolean => stakeholder.role === PRIMARY_STAKEHOLDER_ROLE;

/** Owner scope: the citizen and their organisations. Session only, so a client cannot widen it. */
export const requireOwnerPartyIds = (req: RequestWithUser): string[] => {
  const organizations = req.session.representingBusinessChoices;

  // Undefined means the lookup failed; fail closed.
  if (organizations === undefined) {
    throw new HttpException(403, 'No organizations in session to scope the errand query to');
  }

  return [req.user.partyId, ...organizations.map(organization => organization.partyId)];
};

/** Upstream filters on any stakeholder; only the primary one decides ownership. */
export const ownedWithinScope = (errand: Errand, ownerPartyIds: string[]): boolean => {
  const primaryExternalId = errand.stakeholders?.find(isPrimaryStakeholder)?.externalId;

  return primaryExternalId !== undefined && ownerPartyIds.includes(primaryExternalId);
};

const fetchErrandById = (apiService: ApiService, apiBase: string, id: string, req: RequestWithUser): Promise<Partial<Errand> | undefined> => {
  const url = `${MUNICIPALITY_ID}/${NAMESPACE}/errands/${id}`;
  const baseURL = apiURL(apiBase);

  return apiService.get<Partial<Errand>>({ baseURL, url, propagateClientError: true }, req).then(res => res.data);
};

/** Only the reporter may change an errand; upstream does not check. No reporter, no editor. */
export async function assertErrandOwnedByUser(apiService: ApiService, apiBase: string, id: string, req: RequestWithUser): Promise<Partial<Errand>> {
  const errand = await fetchErrandById(apiService, apiBase, id, req);

  // Guid casing differs between sources.
  if (errand?.reporterUserId?.toLowerCase() !== req.user.partyId.toLowerCase()) {
    throw new HttpException(403, 'Errand belongs to another user');
  }

  return errand;
}

/** Only drafts may change; the client lock alone would not stop a crafted request. */
export async function assertDraftOwnedByUser(apiService: ApiService, apiBase: string, id: string, req: RequestWithUser): Promise<Partial<Errand>> {
  const errand = await assertErrandOwnedByUser(apiService, apiBase, id, req);

  if (errand.lifecycle !== ErrandLifecycleEnum.DRAFT) {
    throw new HttpException(409, 'Errand is not a draft');
  }

  return errand;
}

/** Scoped by owner, as the list is. 404 rather than 403, so the id confirms nothing. */
export async function assertErrandReadableByUser(apiService: ApiService, apiBase: string, id: string, req: RequestWithUser): Promise<void> {
  const ownerPartyIds = requireOwnerPartyIds(req);
  const errand = await fetchErrandById(apiService, apiBase, id, req);

  if (!errand || !ownedWithinScope(errand, ownerPartyIds)) {
    throw new HttpException(404, 'Errand not found');
  }
}
