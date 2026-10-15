import { createErrand, getErrands } from '@services/errand-service/errand-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@services/api-service', () => ({
  apiService: apiMocks,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Errand service contracts', () => {
  it('leaves sort unencoded for the HTTP client to serialize once', async () => {
    apiMocks.get.mockResolvedValue({ data: { content: [] } });

    await getErrands({ page: 0, size: 20, sortColumn: 'created', sortOrder: 'desc' });

    expect(apiMocks.get).toHaveBeenCalledWith('supportmanagement/errands', {
      params: { page: 0, size: 20, sort: 'created,desc' },
    });
  });

  it('preserves create errors for the calling form to handle', async () => {
    const error = new Error('Create failed');
    apiMocks.post.mockRejectedValue(error);

    await expect(createErrand({ title: 'User input' })).rejects.toBe(error);
  });
});
