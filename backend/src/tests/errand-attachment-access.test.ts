// Bilagor follow the errand's own access rules: reading is scoped by the session's organisations,
// writing to the citizen who registered the errand. These drive the controller directly with the
// session and the upstream answer each case needs.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportManagementAttachmentController } from '@/controllers/supportmanagement-attachment.controller';
import { CreateErrandAttachmentDTO } from '@/responses/supportmanagement-attachment.response';

import {
  mockCitizenPartyId,
  mockErrandId,
  mockForeignOrganizationPartyId,
  mockOrganizationPartyId,
  mockOtherCitizenPartyId,
  mockServiceKey,
} from './helpers/mock-data';

const { get, post, patch, deleteRequest } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), deleteRequest: vi.fn() }));

vi.mock('@/services/api.service', () => ({
  default: class {
    get = get;
    post = post;
    delete = deleteRequest;
    patch = patch;
    put = vi.fn();
  },
}));

const representing = (partyId: string) => ({ partyId, organizationNumber: `nr-${partyId}`, organizationName: `Org ${partyId}` });

const requestAs = (partyId: string, organizationPartyIds: string[] = [mockOrganizationPartyId]) =>
  ({
    user: { partyId },
    headers: { 'x-service-key': mockServiceKey },
    session: { representingBusinessChoices: { [mockServiceKey]: organizationPartyIds.map(representing) } },
  }) as never;

const upstreamErrand = (reporterUserId: string, organizationPartyId: string, lifecycle = 'DRAFT') => {
  get.mockResolvedValue({
    data: { id: mockErrandId, reporterUserId, lifecycle, stakeholders: [{ role: 'PRIMARY', externalId: organizationPartyId }] },
  });
};

const FLOOR_PLAN_PURPOSE_ID = '5f79a808-0ef3-4985-99b9-b12f23e202a7';
const ATTACHMENTS_URL = `2281/test/errands/${mockErrandId}/attachments`;

/** The errand, then the metadata: the order the controller reads them in when a bilagetyp is given. */
const upstreamErrandAndPurposes = (reporterUserId: string) => {
  get
    .mockResolvedValueOnce({
      data: { id: mockErrandId, reporterUserId, lifecycle: 'DRAFT', stakeholders: [{ role: 'PRIMARY', externalId: mockOrganizationPartyId }] },
    })
    .mockResolvedValueOnce({
      data: {
        attachmentPurposes: [
          { id: FLOOR_PLAN_PURPOSE_ID, name: 'FLOOR_PLAN', displayName: 'Planritning' },
          { id: 'retired', name: 'MENU', displayName: 'Meny', deprecated: true },
        ],
      },
    });
};

const pdf = (): Express.Multer.File => ({ originalname: 'planritning.pdf', buffer: Buffer.from('%PDF') }) as Express.Multer.File;

const attachmentDto = (category?: string): CreateErrandAttachmentDTO => ({ category });

/**
 * The multipart body the upstream call was handed, as field name to value. form-data keeps each
 * part as a header entry followed by its value entry, so the value is the entry after the header.
 */
const uploadedFields = (): Record<string, string> => {
  const data = (post.mock.calls[0]?.[0] as { data: { _streams: unknown[] } }).data;
  const fields: Record<string, string> = {};

  data._streams.forEach((stream, index) => {
    if (typeof stream !== 'string') return;
    const name = /name="([^"]+)"/.exec(stream)?.[1];
    if (!name) return;
    const value = data._streams[index + 1];
    fields[name] = typeof value === 'string' ? value : String(value);
  });

  return fields;
};

/** Every part header of the multipart body, joined — where the file name is declared. */
const uploadedHeaders = (): string => {
  const data = (post.mock.calls[0]?.[0] as { data: { _streams: unknown[] } }).data;
  return data._streams.filter((stream): stream is string => typeof stream === 'string').join('\n');
};

describe('errand attachment access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ data: {}, location: `https://api.example/${ATTACHMENTS_URL}/attachment-id` });
    patch.mockResolvedValue({ data: {} });
    deleteRequest.mockResolvedValue({ data: {} });
  });

  it('uploads to an errand the citizen registered', async () => {
    upstreamErrand(mockCitizenPartyId, mockOrganizationPartyId);

    await new SupportManagementAttachmentController().createAttachment(requestAs(mockCitizenPartyId), mockErrandId, [pdf()], attachmentDto());

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('refuses to attach to an errand another citizen registered, without reaching upstream', async () => {
    upstreamErrand(mockOtherCitizenPartyId, mockOrganizationPartyId);

    await expect(
      new SupportManagementAttachmentController().createAttachment(requestAs(mockCitizenPartyId), mockErrandId, [pdf()], attachmentDto()),
    ).rejects.toMatchObject({ status: 403 });
    expect(post).not.toHaveBeenCalled();
  });

  it('refuses to delete from an errand another citizen registered', async () => {
    upstreamErrand(mockOtherCitizenPartyId, mockOrganizationPartyId);

    await expect(
      new SupportManagementAttachmentController().deleteAttachment(requestAs(mockCitizenPartyId), mockErrandId, 'attachment-id'),
    ).rejects.toMatchObject({ status: 403 });
    expect(deleteRequest).not.toHaveBeenCalled();
  });

  it('still takes an upload for an active errand, since registration activates before sending', async () => {
    upstreamErrand(mockCitizenPartyId, mockOrganizationPartyId, 'ACTIVE');

    await new SupportManagementAttachmentController().createAttachment(requestAs(mockCitizenPartyId), mockErrandId, [pdf()], attachmentDto());

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('refuses to delete from an errand that is no longer a draft', async () => {
    upstreamErrand(mockCitizenPartyId, mockOrganizationPartyId, 'ACTIVE');

    await expect(
      new SupportManagementAttachmentController().deleteAttachment(requestAs(mockCitizenPartyId), mockErrandId, 'attachment-id'),
    ).rejects.toMatchObject({ status: 409 });
    expect(deleteRequest).not.toHaveBeenCalled();
  });

  it('rejects a request whose file the upload filter dropped', async () => {
    upstreamErrand(mockCitizenPartyId, mockOrganizationPartyId);

    await expect(
      new SupportManagementAttachmentController().createAttachment(requestAs(mockCitizenPartyId), mockErrandId, [], attachmentDto()),
    ).rejects.toMatchObject({ status: 400 });
    expect(post).not.toHaveBeenCalled();
  });

  // The upload takes no purpose field; the bilagetyp is set on the created attachment afterwards.
  it('sends the file and the channel upstream, and not the category', async () => {
    upstreamErrandAndPurposes(mockCitizenPartyId);

    await new SupportManagementAttachmentController().createAttachment(
      requestAs(mockCitizenPartyId),
      mockErrandId,
      [pdf()],
      attachmentDto('FLOOR_PLAN'),
    );

    const fields = uploadedFields();
    expect(Object.keys(fields)).toEqual(['errandAttachment', 'channel']);
    expect(uploadedHeaders()).toContain('filename="planritning.pdf"');
    expect(fields.channel).toBe('ESERVICE');
  });

  it('sets the purpose named by the bilagetyp on the attachment the upload created', async () => {
    upstreamErrandAndPurposes(mockCitizenPartyId);

    await new SupportManagementAttachmentController().createAttachment(
      requestAs(mockCitizenPartyId),
      mockErrandId,
      [pdf()],
      attachmentDto('FLOOR_PLAN'),
    );

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0]?.[0]).toMatchObject({
      url: `${ATTACHMENTS_URL}/attachment-id`,
      data: { purpose: { id: FLOOR_PLAN_PURPOSE_ID } },
      propagateClientError: true,
    });
  });

  it('refuses an unknown bilagetyp before anything is uploaded', async () => {
    upstreamErrandAndPurposes(mockCitizenPartyId);

    await expect(
      new SupportManagementAttachmentController().createAttachment(
        requestAs(mockCitizenPartyId),
        mockErrandId,
        [pdf()],
        attachmentDto('bifogaPlanritning'),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(post).not.toHaveBeenCalled();
  });

  it('does not offer a deprecated purpose', async () => {
    upstreamErrandAndPurposes(mockCitizenPartyId);

    await expect(
      new SupportManagementAttachmentController().createAttachment(requestAs(mockCitizenPartyId), mockErrandId, [pdf()], attachmentDto('MENU')),
    ).rejects.toMatchObject({ status: 400 });
    expect(post).not.toHaveBeenCalled();
  });

  it('uploads an untyped file without reading the metadata or setting a purpose', async () => {
    upstreamErrand(mockCitizenPartyId, mockOrganizationPartyId);

    await new SupportManagementAttachmentController().createAttachment(requestAs(mockCitizenPartyId), mockErrandId, [pdf()], attachmentDto());

    expect(get).toHaveBeenCalledTimes(1);
    expect(patch).not.toHaveBeenCalled();
  });

  it('answers 502 when the upload gives no Location to set the purpose on', async () => {
    upstreamErrandAndPurposes(mockCitizenPartyId);
    post.mockResolvedValue({ data: {} });

    await expect(
      new SupportManagementAttachmentController().createAttachment(requestAs(mockCitizenPartyId), mockErrandId, [pdf()], attachmentDto('FLOOR_PLAN')),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('changes the bilagetyp of a stored attachment', async () => {
    upstreamErrandAndPurposes(mockCitizenPartyId);

    await new SupportManagementAttachmentController().updateAttachment(requestAs(mockCitizenPartyId), mockErrandId, 'attachment-id', {
      category: 'FLOOR_PLAN',
    });

    expect(patch.mock.calls[0]?.[0]).toMatchObject({ url: `${ATTACHMENTS_URL}/attachment-id`, data: { purpose: { id: FLOOR_PLAN_PURPOSE_ID } } });
  });

  it('refuses to retype an attachment on an errand another citizen registered', async () => {
    upstreamErrand(mockOtherCitizenPartyId, mockOrganizationPartyId);

    await expect(
      new SupportManagementAttachmentController().updateAttachment(requestAs(mockCitizenPartyId), mockErrandId, 'attachment-id', {
        category: 'FLOOR_PLAN',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(patch).not.toHaveBeenCalled();
  });

  it('refuses to retype an attachment on an errand that is no longer a draft', async () => {
    upstreamErrand(mockCitizenPartyId, mockOrganizationPartyId, 'ACTIVE');

    await expect(
      new SupportManagementAttachmentController().updateAttachment(requestAs(mockCitizenPartyId), mockErrandId, 'attachment-id', {
        category: 'FLOOR_PLAN',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(patch).not.toHaveBeenCalled();
  });

  it('lists the attachments of an errand belonging to a session organisation', async () => {
    upstreamErrand(mockOtherCitizenPartyId, mockOrganizationPartyId);
    get.mockResolvedValueOnce({
      data: { id: mockErrandId, reporterUserId: mockOtherCitizenPartyId, stakeholders: [{ role: 'PRIMARY', externalId: mockOrganizationPartyId }] },
    });
    get.mockResolvedValueOnce({ data: [{ id: 'attachment-id', fileName: 'planritning.pdf' }] });

    // A colleague in the same organisation reads it even though someone else registered it.
    const attachments = await new SupportManagementAttachmentController().getAttachments(requestAs(mockCitizenPartyId), mockErrandId);

    expect(attachments).toHaveLength(1);
  });

  it('answers 404 for an errand outside the session organisations', async () => {
    upstreamErrand(mockCitizenPartyId, mockForeignOrganizationPartyId);

    await expect(new SupportManagementAttachmentController().getAttachments(requestAs(mockCitizenPartyId), mockErrandId)).rejects.toMatchObject({
      status: 404,
    });
  });
});
