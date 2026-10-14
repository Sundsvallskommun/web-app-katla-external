// Knowing an errand's guid must not be enough to patch it — updateErrand has to check the
// reporter itself. The reporter is the citizen's party id, since citizens have no account name.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportManagementController } from '@/controllers/supportmanagement.controller';
import { ErrandLifecycleEnum } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces/auth.interface';

import { mockCitizenPartyId, mockErrandId, mockOtherCitizenPartyId, mockServiceKey } from './helpers/mock-data';

const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock('@/services/api.service', () => ({
  default: class {
    get = get;
    patch = patch;
    post = vi.fn();
    put = vi.fn();
    delete = vi.fn();
  },
}));

const requestAs = (partyId: string): RequestWithUser =>
  ({ user: { partyId }, headers: { 'x-service-key': mockServiceKey } }) as unknown as RequestWithUser;

const upstreamReturnsReporter = (reporterUserId: string | undefined, lifecycle = 'DRAFT') => {
  get.mockResolvedValue({ data: { id: mockErrandId, reporterUserId, lifecycle } });
};

describe('errand update ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    patch.mockResolvedValue({ data: { id: mockErrandId, stakeholders: [] } });
  });

  it('updates an errand the user registered', async () => {
    upstreamReturnsReporter(mockCitizenPartyId);

    await new SupportManagementController().updateErrand(requestAs(mockCitizenPartyId), mockErrandId, { title: 'ny titel' });

    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('refuses to patch an errand registered by another user', async () => {
    upstreamReturnsReporter(mockOtherCitizenPartyId);

    await expect(
      new SupportManagementController().updateErrand(requestAs(mockCitizenPartyId), mockErrandId, { title: 'kapad' }),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it('does not reach upstream with the update when ownership fails', async () => {
    upstreamReturnsReporter(mockOtherCitizenPartyId);

    await expect(
      new SupportManagementController().updateErrand(requestAs(mockCitizenPartyId), mockErrandId, { title: 'kapad' }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(patch).not.toHaveBeenCalled();
  });

  it('refuses an errand that carries no reporter, rather than treating it as unowned', async () => {
    upstreamReturnsReporter(undefined);

    await expect(new SupportManagementController().updateErrand(requestAs(mockCitizenPartyId), mockErrandId, { title: 'x' })).rejects.toMatchObject({
      status: 403,
    });
    expect(patch).not.toHaveBeenCalled();
  });

  it('refuses to patch an errand that is no longer a draft', async () => {
    upstreamReturnsReporter(mockCitizenPartyId, 'ACTIVE');

    await expect(
      new SupportManagementController().updateErrand(requestAs(mockCitizenPartyId), mockErrandId, {
        title: 'ny titel',
        lifecycle: ErrandLifecycleEnum.DRAFT,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(patch).not.toHaveBeenCalled();
  });

  it('lets a draft be registered', async () => {
    upstreamReturnsReporter(mockCitizenPartyId);

    await new SupportManagementController().updateErrand(requestAs(mockCitizenPartyId), mockErrandId, { lifecycle: ErrandLifecycleEnum.ACTIVE });

    expect((patch.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data).toMatchObject({ lifecycle: 'ACTIVE' });
  });

  it('accepts a casing difference in the party id', async () => {
    upstreamReturnsReporter(mockCitizenPartyId.toUpperCase());

    await new SupportManagementController().updateErrand(requestAs(mockCitizenPartyId), mockErrandId, { title: 'ny titel' });

    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('strips fields upstream rejects on update', async () => {
    upstreamReturnsReporter(mockCitizenPartyId);

    await new SupportManagementController().updateErrand(requestAs(mockCitizenPartyId), mockErrandId, {
      title: 'ny titel',
      actions: [],
      phases: [],
      process: { id: 'p' },
      version: 0,
      classification: {},
    });

    const sent = (patch.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(sent).toMatchObject({ title: 'ny titel' });
    for (const field of ['actions', 'phases', 'process', 'version', 'classification']) {
      expect(sent).not.toHaveProperty(field);
    }
  });

  it('keeps a classification that is set', async () => {
    upstreamReturnsReporter(mockCitizenPartyId);
    const classification = { category: 'ALCOHOL', type: 'SERVING_PERMIT_APPLICATION' };

    await new SupportManagementController().updateErrand(requestAs(mockCitizenPartyId), mockErrandId, { classification });

    expect((patch.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data).toMatchObject({ classification });
  });

  it('checks ownership before spending a request on the update', async () => {
    upstreamReturnsReporter(mockCitizenPartyId);

    await new SupportManagementController().updateErrand(requestAs(mockCitizenPartyId), mockErrandId, { title: 'ny titel' });

    expect(get.mock.invocationCallOrder[0]).toBeLessThan(patch.mock.invocationCallOrder[0] ?? Infinity);
  });
});
