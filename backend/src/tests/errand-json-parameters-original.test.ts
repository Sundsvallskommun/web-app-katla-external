// Draken handlers edit the form answers under the schema-named key. The errand therefore carries a
// second, untouched copy under `<key>_original`, written by the BFF alone and never shown to the UI.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportManagementController } from '@/controllers/supportmanagement.controller';
import { Errand, JsonNode, JsonParameter } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { withOriginalCopies, withoutOriginalCopies } from '@/utils/json-parameters';

import { mockCitizenPartyId, mockErrandId, mockErrandNumber, mockServiceKey } from './helpers/mock-data';

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

const request = {
  user: { partyId: mockCitizenPartyId },
  headers: { 'x-service-key': mockServiceKey },
  session: { representingBusinessChoices: { [mockServiceKey]: [] } },
} as never;

const KEY = 'test_alcohol_serving';
const ORIGINAL_KEY = `${KEY}_original`;
const SCHEMA_ID = `2281_${KEY}_0.1`;

// Upstream types the value as Jackson's JsonNode; the form data is a plain object.
const answers = (answer: string): JsonNode => ({ answer }) as JsonNode;
const filed: JsonParameter = { key: KEY, value: answers('yes'), schemaId: SCHEMA_ID };
const original: JsonParameter = { key: ORIGINAL_KEY, value: answers('yes'), schemaId: SCHEMA_ID };
const stakeholders = [{ role: 'PRIMARY', externalId: mockCitizenPartyId }];

const sentBody = (mock: typeof post): Partial<Errand> => (mock.mock.calls[0]?.[0] as { data: Partial<Errand> }).data;

describe('withOriginalCopies', () => {
  it('appends one copy per filed entry with the same value and schemaId', () => {
    expect(withOriginalCopies([filed])).toEqual([filed, original]);
  });

  it('replaces copies the client sent', () => {
    expect(withOriginalCopies([{ ...original, value: answers('tampered') }, filed])).toEqual([filed, original]);
  });

  it('keeps an absent list absent', () => {
    expect(withOriginalCopies(undefined)).toBeUndefined();
    expect(withOriginalCopies([])).toEqual([]);
  });
});

describe('withoutOriginalCopies', () => {
  it('drops the copies and nothing else', () => {
    expect(withoutOriginalCopies([filed, original])).toEqual([filed]);
    expect(withoutOriginalCopies(undefined)).toBeUndefined();
  });
});

describe('errand json parameters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ data: { id: mockErrandId, stakeholders, jsonParameters: [filed, original] } });
    patch.mockResolvedValue({ data: { id: mockErrandId, stakeholders, jsonParameters: [filed, original] } });
  });

  it('files the answers twice on create and returns them once', async () => {
    const errand = await new SupportManagementController().createErrand(request, { jsonParameters: [filed] });

    expect(sentBody(post).jsonParameters).toEqual([filed, original]);
    expect(errand.jsonParameters).toEqual([filed]);
  });

  it('rebuilds the copy on every draft save and returns the answers once', async () => {
    get.mockResolvedValue({ data: { id: mockErrandId, reporterUserId: mockCitizenPartyId, lifecycle: 'DRAFT' } });

    const errand = await new SupportManagementController().updateErrand(request, mockErrandId, {
      jsonParameters: [{ ...original, value: answers('tampered') }, filed],
    });

    expect(sentBody(patch).jsonParameters).toEqual([filed, original]);
    expect(errand.jsonParameters).toEqual([filed]);
  });

  it('leaves jsonParameters out of the patch when the client did not send them', async () => {
    get.mockResolvedValue({ data: { id: mockErrandId, reporterUserId: mockCitizenPartyId, lifecycle: 'DRAFT' } });

    await new SupportManagementController().updateErrand(request, mockErrandId, { title: 'ny titel' });

    // JSON serialisation drops the undefined field, so nothing reaches upstream.
    expect(sentBody(patch).jsonParameters).toBeUndefined();
  });

  it('hides the copy when reading one errand', async () => {
    get.mockResolvedValue({
      data: { content: [{ id: mockErrandId, errandNumber: mockErrandNumber, stakeholders, jsonParameters: [filed, original] }] },
    });

    const errand = await new SupportManagementController().getErrand(request, mockErrandNumber);

    expect(errand.jsonParameters).toEqual([filed]);
  });

  it('retains the copy when listing errands', async () => {
    get.mockResolvedValue({ data: { content: [{ id: mockErrandId, stakeholders, jsonParameters: [filed, original] }] } });

    const page = await new SupportManagementController().getErrands(request, {});

    expect(page.content?.[0]?.jsonParameters).toEqual([filed, original]);
  });
});
