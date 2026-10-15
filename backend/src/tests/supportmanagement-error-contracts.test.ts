import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { SupportManagementController } from '@/controllers/supportmanagement.controller';
import { HttpException } from '@/exceptions/HttpException';
import ApiService from '@/services/api.service';
import { SERVICE_KEY_HEADER } from '@/utils/service-context';

import {
  mockCitizenPartyId,
  mockEmail,
  mockErrandNumber,
  mockOrganizationName,
  mockOrganizationNumber,
  mockOrganizationPartyId,
  mockPersonNumber,
  mockPhoneNumber,
  mockServiceKey,
} from './helpers/mock-data';

vi.mock('@/middlewares/auth.middleware', () => ({
  default: (req: Request, _res: Response, next: NextFunction) => {
    Object.defineProperty(req, 'user', {
      configurable: true,
      value: {
        partyId: mockCitizenPartyId,
        name: 'Test User',
        givenName: 'Test',
        surname: 'User',
      },
    });
    // Errand queries are scoped to the session's organisations and 403 without them.
    // errand-organization-scope.test.ts covers that rule; here it just has to be satisfied.
    req.session.representingBusinessChoices = {
      [mockServiceKey]: [{ partyId: mockOrganizationPartyId, organizationNumber: mockOrganizationNumber, organizationName: mockOrganizationName }],
    };
    next();
  },
}));

const createApp = () => new App([SupportManagementController]).getServer();
const app = createApp();

// Every call names the form it acts for, as the frontend does.
const forService = (req: request.Test) => req.set(SERVICE_KEY_HEADER, mockServiceKey);

// updateErrand reads the errand first to check the reporter against the session user. These
// tests are about the update itself, so they hand it an errand the mocked user owns.
const stubOwnershipLookup = () =>
  vi.spyOn(ApiService.prototype, 'get').mockResolvedValue({ data: { reporterUserId: mockCitizenPartyId, lifecycle: 'DRAFT' }, message: 'success' });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SupportManagement HTTP error contracts', () => {
  it('rejects a request that names no form or an unknown one', async () => {
    vi.spyOn(ApiService.prototype, 'get').mockResolvedValue({ data: {}, message: 'success' });

    await request(app).get('/api/supportmanagement/metadata').expect(400);
    await request(app).get('/api/supportmanagement/metadata').set(SERVICE_KEY_HEADER, 'okand-tjanst').expect(400);
  });

  it('preserves the successful create response contract', async () => {
    const postSpy = vi.spyOn(ApiService.prototype, 'post').mockResolvedValue({
      data: { id: 'errand-id', errandNumber: 'ERRAND-1', stakeholders: [] },
      message: 'success',
    });

    const response = await forService(request(app).post('/api/supportmanagement/errand/create')).send({}).expect(200);

    expect(response.body).toEqual({ id: 'errand-id', errandNumber: 'ERRAND-1', stakeholders: [] });
    expect(postSpy).toHaveBeenCalledWith(expect.objectContaining({ propagateClientError: true }), expect.anything());
  });

  it('propagates a typed upstream error when creating an errand', async () => {
    vi.spyOn(ApiService.prototype, 'post').mockRejectedValue(new HttpException(500, 'SupportManagement unavailable'));

    const response = await forService(request(app).post('/api/supportmanagement/errand/create')).send({}).expect(500);

    expect(response.body).toEqual({ message: 'SupportManagement unavailable' });
  });

  it('returns 502 when create receives a malformed successful response', async () => {
    vi.spyOn(ApiService.prototype, 'post').mockResolvedValue({ data: {}, message: 'success' });

    const response = await forService(request(app).post('/api/supportmanagement/errand/create')).send({}).expect(502);

    expect(response.body).toEqual({ message: 'No stakeholders in response when creating errand' });
  });

  it('propagates a typed upstream error when attempting to update an errand', async () => {
    stubOwnershipLookup();
    const patchSpy = vi.spyOn(ApiService.prototype, 'patch').mockRejectedValue(new HttpException(409, 'Errand was modified elsewhere'));

    const response = await forService(request(app).patch('/api/supportmanagement/errand/errand-id')).send({ title: 'Changed' }).expect(409);

    expect(response.body).toEqual({ message: 'Errand was modified elsewhere' });
    expect(patchSpy).toHaveBeenCalledWith(expect.objectContaining({ propagateClientError: true }), expect.anything());
  });

  it('fails explicitly when update is given a blank errand id', async () => {
    const patchSpy = vi.spyOn(ApiService.prototype, 'patch');

    const response = await forService(request(app).patch('/api/supportmanagement/errand/%20')).send({ title: 'Changed' }).expect(400);

    expect(response.body).toEqual({ message: 'Errand id is required when updating an errand' });
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it('returns 502 when update receives an empty successful response', async () => {
    stubOwnershipLookup();
    vi.spyOn(ApiService.prototype, 'patch').mockResolvedValue({ data: undefined, message: 'success' });

    const response = await forService(request(app).patch('/api/supportmanagement/errand/errand-id')).send({ title: 'Changed' }).expect(502);

    expect(response.body).toEqual({ message: 'Invalid response when updating errand' });
  });

  // Upstream Stakeholder has only contactChannels. Passing StakeholderDTO through
  // silently drops emails/phoneNumbers and leaks personNumber.
  it('translates stakeholders to the upstream shape when updating an errand', async () => {
    stubOwnershipLookup();
    const patchSpy = vi.spyOn(ApiService.prototype, 'patch').mockResolvedValue({ data: { stakeholders: [] }, message: 'success' });

    await forService(request(app).patch('/api/supportmanagement/errand/errand-id'))
      .send({
        stakeholders: [
          {
            firstName: 'Ada',
            personNumber: mockPersonNumber,
            emails: [mockEmail],
            phoneNumbers: [mockPhoneNumber],
          },
        ],
      })
      .expect(200);

    const [requestConfig] = patchSpy.mock.calls[0] ?? [];
    if (!requestConfig) {
      throw new Error('Expected the update to reach SupportManagement');
    }
    const sentStakeholders = (requestConfig as { data?: { stakeholders?: Record<string, unknown>[] } }).data?.stakeholders ?? [];
    const [stakeholder] = sentStakeholders;
    if (!stakeholder) {
      throw new Error('Expected a mapped stakeholder in the update payload');
    }

    expect(stakeholder).not.toHaveProperty('personNumber');
    expect(stakeholder).not.toHaveProperty('emails');
    expect(stakeholder).not.toHaveProperty('phoneNumbers');
    expect(stakeholder.contactChannels).toEqual([
      { type: 'email', value: mockEmail },
      { type: 'phone', value: mockPhoneNumber },
    ]);
  });

  // id and errandNumber are assigned upstream. routing-controllers binds them off the body
  // anyway, so a client can name the errand it is "creating" unless they are stripped here.
  it('drops a client-supplied id and errandNumber when creating an errand', async () => {
    const postSpy = vi.spyOn(ApiService.prototype, 'post').mockResolvedValue({ data: { stakeholders: [] }, message: 'success' });

    await forService(request(app).post('/api/supportmanagement/errand/create'))
      .send({ id: 'attacker-chosen', errandNumber: mockErrandNumber, title: 'Nytt ärende' })
      .expect(200);

    const [requestConfig] = postSpy.mock.calls[0] ?? [];
    const sent = (requestConfig as { data?: Record<string, unknown> }).data ?? {};

    expect(sent).not.toHaveProperty('id');
    expect(sent).not.toHaveProperty('errandNumber');
    expect(sent).toMatchObject({ title: 'Nytt ärende', reporterUserId: mockCitizenPartyId });
  });

  it('propagates upstream errors from every read endpoint', async () => {
    const getSpy = vi.spyOn(ApiService.prototype, 'get').mockRejectedValue(new HttpException(503, 'Upstream unavailable'));
    const paths = ['/api/supportmanagement/errands', '/api/supportmanagement/count', '/api/supportmanagement/metadata'];

    for (const path of paths) {
      const response = await forService(request(app).get(path)).expect(503);
      expect(response.body).toEqual({ message: 'Upstream unavailable' });
    }

    expect(getSpy).toHaveBeenCalledTimes(paths.length);
  });

  it('returns 502 when a read endpoint receives an empty successful response', async () => {
    vi.spyOn(ApiService.prototype, 'get').mockResolvedValue({ data: undefined, message: 'success' });

    const response = await forService(request(app).get('/api/supportmanagement/metadata')).expect(502);

    expect(response.body).toEqual({ message: 'Invalid response when reading metadata' });
  });

  it('returns 502 when count receives a malformed successful response', async () => {
    vi.spyOn(ApiService.prototype, 'get').mockResolvedValue({ data: {}, message: 'success' });

    const response = await forService(request(app).get('/api/supportmanagement/count')).expect(502);

    expect(response.body).toEqual({ message: 'Invalid response when counting errands' });
  });

  it('serializes sort exactly once before calling SupportManagement', async () => {
    const getSpy = vi.spyOn(ApiService.prototype, 'get').mockResolvedValue({ data: { content: [] }, message: 'success' });

    const response = await forService(request(app).get('/api/supportmanagement/errands?sort=created%2Cdesc')).expect(200);

    const requestConfig = getSpy.mock.calls[0]?.[0];
    if (!requestConfig?.url) throw new Error('Expected SupportManagement request URL');
    const upstreamUrl = new URL(requestConfig.url, 'http://supportmanagement.test');

    expect(upstreamUrl.searchParams.get('sort')).toBe('created,desc');
    expect(requestConfig.url).not.toContain('%252C');
    expect(response.body).toEqual({ content: [] });
  });
});
