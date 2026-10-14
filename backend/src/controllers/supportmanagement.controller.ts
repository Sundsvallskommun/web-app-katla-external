import { Body, Controller, Get, Param, Patch, Post, QueryParams, Req, UseBefore } from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';

import { MUNICIPALITY_ID, NAMESPACE } from '@/config';
import { getApiBase } from '@/config/api-config';
import { Errand, ErrandLifecycleEnum, Label, PageErrand } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces/auth.interface';
import authMiddleware from '@/middlewares/auth.middleware';
import { ErrandCountDTO, ErrandDTO, ErrandsQueryDTO, PageErrandDTO } from '@/responses/supportmanagement.response';
import { MetadataResponseDTO } from '@/responses/supportmanagement-metadata.response';
import ApiService from '@/services/api.service';
import { selectCategorizationSubtree, withCategorizationSubtree } from '@/utils/categorization-root';
import { assertDraftOwnedByUser, ownedWithinScope, requireOwnerPartyIds } from '@/utils/errand-access';
import { fetchMetadata } from '@/utils/fetch-metadata';
import { assertLabelsOffered, labelsChanged } from '@/utils/internal-labels';
import { completePrimaryStakeholders } from '@/utils/primary-stakeholder';
import { mapStakeholderDTOToStakeholder, mapStakeholderToStakeholderDTO } from '@/utils/stakeholder-mapping';
import { apiURL } from '@/utils/util';

// Builds the filter value; unknown value types are skipped.
const toFilterValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value !== '' ? value : undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
};

// The upstream filter grammar wraps each value in single quotes. Values come from the client,
// so characters that could end the literal or add a condition are rejected rather than escaped —
// the escaping dialect belongs to upstream and must not be guessed here.
const SAFE_FILTER_VALUE_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;

// routing-controllers does not whitelist query params: keys the DTO never declared still reach
// the handler, so the key needs the same distrust as the value. A field name cannot contain a
// quote or comma, which is what it would take to close the literal and add a condition.
const SAFE_FILTER_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.]*$/;

// A stakeholder's externalId holds the owner's party id: the organisation's, or the citizen's own.
const OWNER_FILTER_KEY = 'stakeholders.externalId';

// Upstream leaves drafts out of a search unless the filter names lifecycle.
const DRAFT_FILTER_TERM = `lifecycle:'${ErrandLifecycleEnum.DRAFT}'`;

const toFilterTerm = (key: string, value: string): string => {
  if (!SAFE_FILTER_KEY_PATTERN.test(key)) {
    throw new HttpException(400, 'Invalid filter key');
  }

  if (!SAFE_FILTER_VALUE_PATTERN.test(value)) {
    throw new HttpException(400, 'Invalid filter value');
  }

  return `${key}:'${value}'`;
};

const FILTER_AND = ' and ';

const toFilterOrGroup = (key: string, values: string[]): string => `(${values.map(value => toFilterTerm(key, value)).join(' or ')})`;

@Controller()
export class SupportManagementController {
  private apiService = new ApiService();
  private apiBase = getApiBase('supportmanagement');

  @Post('/supportmanagement/errand/create')
  @OpenAPI({ summary: 'Create new errand' })
  @UseBefore(authMiddleware)
  @ResponseSchema(ErrandDTO)
  async createErrand(@Req() req: RequestWithUser, @Body() errand: ErrandDTO): Promise<ErrandDTO> {
    const url = `${MUNICIPALITY_ID}/${NAMESPACE}/errands`;
    const baseURL = apiURL(this.apiBase);

    // routing-controllers binds body fields the DTO declares even when the client should never
    // send them. id and errandNumber are assigned upstream and must not exist on a new errand.
    const { id: _id, errandNumber: _errandNumber, ...newErrand } = errand;

    if (newErrand.labels?.length) assertLabelsOffered(newErrand.labels, await this.fetchOfferedLabels(req));

    const errandInformation = {
      ...(newErrand as Errand),
      reporterUserId: req.user.partyId,
      stakeholders: await completePrimaryStakeholders(newErrand.stakeholders?.map(mapStakeholderDTOToStakeholder), req),
    };

    const res = await this.apiService.post<Partial<Errand>>({ baseURL, url, data: errandInformation, propagateClientError: true }, req);
    if (!res.data) throw new HttpException(502, 'Invalid response when creating errand');

    const resStakeholders = res.data.stakeholders;
    if (!resStakeholders) throw new HttpException(502, 'No stakeholders in response when creating errand');

    const stakeholders = resStakeholders.map(stakeholder => mapStakeholderToStakeholderDTO(stakeholder));

    return {
      ...res.data,
      stakeholders,
    };
  }

  @Patch('/supportmanagement/errand/:id')
  @OpenAPI({ summary: 'Update errand' })
  @UseBefore(authMiddleware)
  @ResponseSchema(ErrandDTO)
  async updateErrand(@Req() req: RequestWithUser, @Param('id') id: string, @Body() errand: Partial<Errand>): Promise<Partial<Errand>> {
    if (!id.trim()) throw new HttpException(400, 'Errand id is required when updating an errand');

    const storedErrand = await assertDraftOwnedByUser(this.apiService, this.apiBase, id, req);
    if (errand.labels?.length && labelsChanged(errand.labels, storedErrand.labels)) {
      assertLabelsOffered(errand.labels, await this.fetchOfferedLabels(req));
    }

    const url = `${MUNICIPALITY_ID}/${NAMESPACE}/errands/${id}`;
    const baseURL = apiURL(this.apiBase);
    // Read-only upstream: sending them, even empty, fails validation with "must be null"
    const {
      id: _id,
      errandNumber: _errandNumber,
      created: _created,
      modified: _modified,
      touched: _touched,
      reporterUserId: _reporterUserId,
      activeNotifications: _activeNotifications,
      actions: _actions,
      phases: _phases,
      process: _process,
      version: _version,
      classification,
      ...errandData
    } = errand;

    // Translate both ways, as on create: the DTO has emails/phoneNumbers/personNumber,
    // upstream Stakeholder has only contactChannels. An empty classification fails upstream's
    // not-blank check, so it is only sent when set.
    const errandInformation = {
      ...errandData,
      ...(classification?.category || classification?.type ? { classification } : {}),
      stakeholders: await completePrimaryStakeholders(errandData.stakeholders?.map(mapStakeholderDTOToStakeholder), req),
    };

    const res = await this.apiService.patch<Partial<Errand>>({ baseURL, url, data: errandInformation, propagateClientError: true }, req);
    if (!res.data) throw new HttpException(502, 'Invalid response when updating errand');

    const stakeholders = res.data.stakeholders?.map(stakeholder => mapStakeholderToStakeholderDTO(stakeholder)) ?? [];

    return {
      ...res.data,
      stakeholders,
    };
  }

  @Get('/supportmanagement/errand/:errandNumber')
  @OpenAPI({ summary: 'Read one errand owned by the citizen or a session organisation' })
  @UseBefore(authMiddleware)
  @ResponseSchema(ErrandDTO)
  async getErrand(@Req() req: RequestWithUser, @Param('errandNumber') errandNumber: string): Promise<ErrandDTO> {
    const ownerPartyIds = requireOwnerPartyIds(req);

    const scope = [toFilterTerm('errandNumber', errandNumber), toFilterOrGroup(OWNER_FILTER_KEY, ownerPartyIds)];
    const matchedErrand = (await this.findErrand(scope, req)) ?? (await this.findErrand([...scope, DRAFT_FILTER_TERM], req));

    // 404, not 403: errand numbers are enumerable, so someone else's errand must be
    // indistinguishable from one that does not exist.
    if (!matchedErrand || !ownedWithinScope(matchedErrand, ownerPartyIds)) {
      throw new HttpException(404, 'Errand not found');
    }

    const stakeholders = matchedErrand.stakeholders?.map(stakeholder => mapStakeholderToStakeholderDTO(stakeholder)) ?? [];

    return {
      ...matchedErrand,
      stakeholders,
    };
  }

  private async findErrand(filterParts: string[], req: RequestWithUser): Promise<Errand | undefined> {
    const params = new URLSearchParams({ filter: filterParts.join(FILTER_AND) });
    const url = `${this.apiBase}/${MUNICIPALITY_ID}/${NAMESPACE}/errands?${params.toString()}`;

    const res = await this.apiService.get<PageErrand>({ url }, req);
    if (!res.data) throw new HttpException(502, 'Invalid response when reading errand');

    return res.data.content?.[0];
  }

  @Get('/supportmanagement/errands')
  @OpenAPI({ summary: 'Read matching errands' })
  @UseBefore(authMiddleware)
  @ResponseSchema(PageErrandDTO)
  async getErrands(@Req() req: RequestWithUser, @QueryParams() query: ErrandsQueryDTO): Promise<PageErrand> {
    const ownerPartyIds = requireOwnerPartyIds(req);
    const baseUrl = `${this.apiBase}/${MUNICIPALITY_ID}/${NAMESPACE}/errands`;
    const params = new URLSearchParams();

    if (query.page !== undefined) params.append('page', String(query.page));
    if (query.size !== undefined) params.append('size', String(query.size));
    if (query.sort !== undefined) params.append('sort', query.sort);

    const filterParts = [toFilterOrGroup(OWNER_FILTER_KEY, ownerPartyIds)];
    const queryEntries = query as unknown as Record<string, unknown>;

    for (const key of Object.keys(queryEntries)) {
      if (['page', 'size', 'sort'].includes(key)) continue;
      if (key === OWNER_FILTER_KEY) throw new HttpException(400, 'Owner scope is set by the server');
      const value = toFilterValue(queryEntries[key]);

      if (value !== undefined) {
        filterParts.push(toFilterTerm(key, value));
      }
    }

    params.append('filter', filterParts.join(FILTER_AND));

    const finalUrl = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;

    const res = await this.apiService.get<PageErrand>({ url: finalUrl }, req);
    if (!res.data) throw new HttpException(502, 'Invalid response when reading errands');

    return { ...res.data, content: res.data.content?.filter(errand => ownedWithinScope(errand, ownerPartyIds)) };
  }

  @Get('/supportmanagement/count')
  @OpenAPI({ summary: 'Count errands' })
  @UseBefore(authMiddleware)
  @ResponseSchema(ErrandCountDTO)
  async getNumberOfErrands(@Req() req: RequestWithUser, @QueryParams() query: ErrandsQueryDTO): Promise<{ count: number }> {
    const ownerPartyIds = requireOwnerPartyIds(req);
    const baseUrl = `${this.apiBase}/${MUNICIPALITY_ID}/${NAMESPACE}/errands/count`;
    const params = new URLSearchParams();

    const filterParts = [toFilterOrGroup(OWNER_FILTER_KEY, ownerPartyIds)];
    const queryEntries = query as unknown as Record<string, unknown>;

    for (const key of Object.keys(queryEntries)) {
      if (key === OWNER_FILTER_KEY) throw new HttpException(400, 'Owner scope is set by the server');
      const value = toFilterValue(queryEntries[key]);

      if (value !== undefined) {
        filterParts.push(toFilterTerm(key, value));
      }
    }

    params.append('filter', filterParts.join(FILTER_AND));

    const finalUrl = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;

    const res = await this.apiService.get<{ count: number }>({ url: finalUrl }, req);
    if (!res.data || typeof res.data.count !== 'number') throw new HttpException(502, 'Invalid response when counting errands');

    return res.data;
  }

  @Get('/supportmanagement/metadata')
  @OpenAPI({ summary: 'Get all metadata for provided namespace and municipality' })
  @UseBefore(authMiddleware)
  @ResponseSchema(MetadataResponseDTO)
  async getMetadata(@Req() req: RequestWithUser): Promise<MetadataResponseDTO> {
    return { ...withCategorizationSubtree(await fetchMetadata(this.apiService, this.apiBase, req)), namespace: NAMESPACE };
  }

  private async fetchOfferedLabels(req: RequestWithUser): Promise<Label[]> {
    return selectCategorizationSubtree((await fetchMetadata(this.apiService, this.apiBase, req)).labels?.labelStructure);
  }
}
