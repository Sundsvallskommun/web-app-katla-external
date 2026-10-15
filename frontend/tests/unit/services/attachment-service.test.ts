import { getErrandAttachments, updateErrandAttachmentCategory } from '@services/errand-service/attachment-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('@services/api-service', () => ({
  apiService: apiMocks,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('attachment service', () => {
  it('reads the stored purpose back as the bilagetyp', async () => {
    apiMocks.get.mockResolvedValue({
      data: [
        {
          id: 'a-1',
          fileName: 'fullmakt.pdf',
          purpose: { id: 'p-1', name: 'POWER_OF_ATTORNEY', displayName: 'Fullmakt' },
        },
        { id: 'a-2', fileName: 'ovrigt.pdf' },
      ],
    });

    await expect(getErrandAttachments('errand-id')).resolves.toEqual([
      { id: 'a-1', fileName: 'fullmakt.pdf', category: 'POWER_OF_ATTORNEY' },
      { id: 'a-2', fileName: 'ovrigt.pdf' },
    ]);
  });

  it('reads back every file of a bilagetyp', async () => {
    const purpose = { id: 'p-1', name: 'POWER_OF_ATTORNEY', displayName: 'Fullmakt' };
    apiMocks.get.mockResolvedValue({
      data: [
        { id: 'a-1', fileName: 'fullmakt-1.pdf', purpose },
        { id: 'a-2', fileName: 'fullmakt-2.pdf', purpose },
      ],
    });

    await expect(getErrandAttachments('errand-id')).resolves.toEqual([
      { id: 'a-1', fileName: 'fullmakt-1.pdf', category: 'POWER_OF_ATTORNEY' },
      { id: 'a-2', fileName: 'fullmakt-2.pdf', category: 'POWER_OF_ATTORNEY' },
    ]);
  });

  it('retypes a stored attachment through the backend', async () => {
    apiMocks.patch.mockResolvedValue({ data: {} });

    await updateErrandAttachmentCategory('errand-id', 'a-1', 'FLOOR_PLAN');

    expect(apiMocks.patch).toHaveBeenCalledWith('supportmanagement/errand/errand-id/attachments/a-1', {
      category: 'FLOOR_PLAN',
    });
  });
});
