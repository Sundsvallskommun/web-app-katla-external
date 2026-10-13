// A citizen may only file an errand under a label Katla offers: internal-only labels are hidden
// from the chooser, and create/update must not accept them from a hand-crafted request either.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportManagementController } from '@/controllers/supportmanagement.controller';
import { ErrandLabel, Label } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { RequestWithUser } from '@/interfaces/auth.interface';

import { mockCitizenPartyId, mockErrandId, mockServiceKey } from './helpers/mock-data';

const { get, patch, post } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));

vi.mock('@/services/api.service', () => ({
  default: class {
    get = get;
    patch = patch;
    post = post;
    put = vi.fn();
    delete = vi.fn();
  },
}));

const request = { user: { partyId: mockCitizenPartyId }, headers: { 'x-service-key': mockServiceKey } } as unknown as RequestWithUser;

const node = (resourcePath: string, labels: Label[] = [], internal = false): Label => ({
  id: `id-${resourcePath}`,
  classification: resourcePath === 'CATEGORYROOT' ? 'ROOT' : 'CATEGORY',
  resourceName: resourcePath.split('/').at(-1) ?? resourcePath,
  resourcePath,
  labels,
  attributes: internal ? [{ key: 'internalOnly', value: 'true' }] : undefined,
});

const metadata = {
  labels: {
    labelStructure: [
      node('CATEGORYROOT', [node('CATEGORYROOT/ALCOHOL', [node('CATEGORYROOT/ALCOHOL/SERVING'), node('CATEGORYROOT/ALCOHOL/INSPECTION', [], true)])]),
    ],
  },
};

const errandLabel = (resourcePath: string): ErrandLabel => ({ id: `id-${resourcePath}`, resourcePath });
const serving = [errandLabel('CATEGORYROOT/ALCOHOL'), errandLabel('CATEGORYROOT/ALCOHOL/SERVING')];
const inspection = [errandLabel('CATEGORYROOT/ALCOHOL'), errandLabel('CATEGORYROOT/ALCOHOL/INSPECTION')];

const isMetadataCall = (args: unknown[]) => (args[0] as { url?: string }).url?.endsWith('/metadata') ?? false;

describe('errand label guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ data: { id: mockErrandId, stakeholders: [] } });
    patch.mockResolvedValue({ data: { id: mockErrandId, stakeholders: [] } });
  });

  describe('create', () => {
    beforeEach(() => {
      get.mockResolvedValue({ data: metadata });
    });

    it('creates an errand under an offered label', async () => {
      await new SupportManagementController().createErrand(request, { labels: serving });

      expect(post).toHaveBeenCalledTimes(1);
    });

    it('refuses an internal-only label without reaching upstream with the errand', async () => {
      await expect(new SupportManagementController().createErrand(request, { labels: inspection })).rejects.toMatchObject({
        status: 400,
      });
      expect(post).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const storedErrand = (labels: ErrandLabel[]) => {
      get.mockImplementation((options: { url?: string }) =>
        Promise.resolve(
          options.url?.endsWith('/metadata')
            ? { data: metadata }
            : { data: { id: mockErrandId, reporterUserId: mockCitizenPartyId, lifecycle: 'DRAFT', labels } },
        ),
      );
    };

    it('refuses to relabel an errand to an internal-only label', async () => {
      storedErrand(serving);

      await expect(new SupportManagementController().updateErrand(request, mockErrandId, { labels: inspection })).rejects.toMatchObject({
        status: 400,
      });
      expect(patch).not.toHaveBeenCalled();
    });

    it('relabels to another offered label', async () => {
      storedErrand([errandLabel('CATEGORYROOT/ALCOHOL')]);

      await new SupportManagementController().updateErrand(request, mockErrandId, { labels: serving });

      expect(patch).toHaveBeenCalledTimes(1);
    });

    it('saves unchanged labels without reading metadata, even if their type has since become internal', async () => {
      storedErrand(inspection);

      await new SupportManagementController().updateErrand(request, mockErrandId, { labels: inspection, title: 'ny titel' });

      expect(patch).toHaveBeenCalledTimes(1);
      expect(get.mock.calls.some(isMetadataCall)).toBe(false);
    });
  });
});
