import { AttachmentPurpose, MetadataResponse } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { HttpException } from '@/exceptions/HttpException';

/**
 * The bilagetyp the citizen picks is the schema's attachment key, which is also the name of an
 * attachment purpose in the namespace metadata. Purpose ids differ between environments, so the
 * name is the contract and the id is looked up per call.
 */
export const resolveAttachmentPurpose = (metadata: MetadataResponse, key: string): AttachmentPurpose => {
  const purpose = metadata.attachmentPurposes?.find(candidate => candidate.name === key && !candidate.deprecated);
  if (!purpose?.id) throw new HttpException(400, `Unknown attachment type: ${key}`);

  return purpose;
};

/** The id of the created attachment: the last path segment of the bounded Location the upload answered with. */
export const attachmentIdFromLocation = (location: string | undefined): string | undefined => {
  if (!location) return undefined;

  const id = new URL(location).pathname.split('/').filter(Boolean).pop();
  return id ? decodeURIComponent(id) : undefined;
};
