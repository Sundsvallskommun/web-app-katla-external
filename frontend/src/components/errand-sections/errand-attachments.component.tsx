'use client';

import { ErrandDisclosure } from '@components/disclosure/errand-information-disclosure.component';
import { SectionStatus } from '@components/disclosure/section-status-label.component';
import { useFormSchema } from '@components/json/hooks/use-form-schema';
import { schemaNamesForErrand } from '@components/json/utils/schema-utils';
import { useIsContentLocked } from '@contexts/errand-content-lock-context';
import { useFormValidation } from '@contexts/form-validation-context';
import { ErrandFormAttachment, ErrandFormDTO } from '@interfaces/errand-form';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  deleteErrandAttachment,
  downloadErrandAttachment,
  getErrandAttachments,
  MAX_ATTACHMENT_SIZE_MB,
  updateErrandAttachmentCategory,
} from '@services/errand-service/attachment-service';
import { Button, FileUpload, Icon, PopupMenu, UploadFile, useSnackbar } from '@sk-web-gui/react';
import {
  answersOfErrand,
  AttachmentType,
  attachmentTypesOfSchema,
  missingRequiredAttachments,
  requiredAttachmentTypes,
} from '@utils/errand-attachments';
import { Check, Circle, Eye, FileText, Paperclip, Trash } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMetadataStore } from 'src/stores/metadata-store';

const fileNameParts = (fileName: string): { name: string; ending: string } => {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ?
      { name: fileName, ending: '' }
    : { name: fileName.slice(0, lastDot), ending: fileName.slice(lastDot + 1) };
};

/**
 * The attachment as the sk-web-gui list wants it. An attachment already stored upstream has no
 * File in the browser — the placeholder carries only the name the row renders.
 */
const toUploadFile = (attachment: ErrandFormAttachment, index: number): UploadFile => ({
  id: attachment.id ?? `pending-${String(index)}`,
  file: attachment.file ?? new File([], attachment.fileName, { type: attachment.mimeType }),
  meta: { ...fileNameParts(attachment.fileName), category: attachment.category, created: attachment.created },
});

interface AttachmentRequirements {
  loading: boolean;
  error: string | null;
  attachmentTypes: AttachmentType[];
  requiredTypes: AttachmentType[];
  missingTypes: AttachmentType[];
}

/**
 * The errand type's schema declares which bilagor it asks for — the same schema the
 * Ärendeuppgifter form renders from. A type that declares none, or whose schema will not load,
 * still takes bilagor; it just names none of them as required.
 */
const useAttachmentRequirements = (schemaName: string): AttachmentRequirements => {
  const { watch } = useFormContext<ErrandFormDTO>();
  const values: ErrandFormDTO = {
    attachments: watch('attachments'),
    labels: watch('labels'),
    errandFormData: watch('errandFormData'),
  };

  const { schema, loading, error } = useFormSchema(schemaName, { kind: 'new' });

  const attachmentTypes = attachmentTypesOfSchema(schema);
  const answers = answersOfErrand(values, schemaName);

  return {
    loading,
    error,
    attachmentTypes,
    requiredTypes: requiredAttachmentTypes(attachmentTypes, answers),
    missingTypes: missingRequiredAttachments(attachmentTypes, answers, values.attachments),
  };
};

/** Fails closed like validateErrandAttachments: an unread schema leaves the requirement unknown. */
const attachmentsStatus = (requirements: AttachmentRequirements): SectionStatus | undefined => {
  if (requirements.loading) return undefined;
  return requirements.error || requirements.missingTypes.length > 0 ? 'error' : 'complete';
};

const AttachmentsForSchema: React.FC<{ requirements: AttachmentRequirements }> = ({ requirements }) => {
  const { t } = useTranslation();
  const toastMessage = useSnackbar();
  const isLocked = useIsContentLocked();
  const { showValidation } = useFormValidation();
  const { getValues, setValue, watch } = useFormContext<ErrandFormDTO>();

  const uploadFormMethods = useForm<{ files: UploadFile[] }>({ defaultValues: { files: [] } });

  const errandId = watch('id');
  const attachments = watch('attachments');

  const [loadError, setLoadError] = useState(false);

  const { loading, error, attachmentTypes, requiredTypes, missingTypes } = requirements;

  // Empty entry first, so an untagged file does not read as the first bilagetyp.
  const categories = {
    '': t('errand-information:attachments.choose_category'),
    ...Object.fromEntries(attachmentTypes.map((type) => [type.key, type.label])),
  };

  // FileUpload.List copies this into its own state on each new identity. Rebuilding here is safe:
  // that copy re-renders the list, not this component.
  const files = (attachments ?? []).map(toUploadFile);

  // What is already filed upstream is not in form state until it is read back: on opening a saved
  // errand, and again after a save, which resets the form and with it the list. Writing the list
  // either way — an empty one on failure too — is what ends the condition that asks for it.
  const attachmentsUnread = errandId !== undefined && attachments === undefined;

  useEffect(() => {
    if (!errandId || !attachmentsUnread) return;

    let active = true;
    void getErrandAttachments(errandId)
      .then((stored) => {
        if (active) setValue('attachments', stored);
      })
      .catch(() => {
        if (!active) return;
        setValue('attachments', []);
        setLoadError(true);
      });

    return () => {
      active = false;
    };
  }, [attachmentsUnread, errandId, setValue]);

  const updateAttachments = (next: ErrandFormAttachment[]) => {
    setValue('attachments', next, { shouldDirty: true });
  };

  const addFiles = (added: UploadFile[]) => {
    // Untagged: the bilagetyp is the citizen's to pick.
    const picked = added.map((upload) => ({
      fileName: upload.file.name,
      mimeType: upload.file.type,
      file: upload.file,
    }));
    updateAttachments([...(getValues('attachments') ?? []), ...picked]);
  };

  // The list may have changed while the backend answered, so a stored file is found again by id.
  const indexAfterAwait = (current: ErrandFormAttachment[], attachment: ErrandFormAttachment, index: number) =>
    attachment.id ? current.findIndex((candidate) => candidate.id === attachment.id) : index;

  const setCategory = async (index: number, category: string) => {
    const attachment = (getValues('attachments') ?? [])[index];

    try {
      if (attachment.id && errandId) {
        await updateErrandAttachmentCategory(errandId, attachment.id, category);
      }
      const current = getValues('attachments') ?? [];
      const currentIndex = indexAfterAwait(current, attachment, index);
      updateAttachments(current.map((candidate, i) => (i === currentIndex ? { ...candidate, category } : candidate)));
    } catch {
      toastMessage({
        position: 'bottom',
        status: 'error',
        message: t('errand-information:attachments.category_error'),
      });
    }
  };

  const removeAttachment = async (index: number) => {
    const attachment = (getValues('attachments') ?? [])[index];

    try {
      if (attachment.id && errandId) {
        await deleteErrandAttachment(errandId, attachment.id);
      }
      const current = getValues('attachments') ?? [];
      updateAttachments(current.filter((_, i) => i !== indexAfterAwait(current, attachment, index)));
    } catch {
      toastMessage({ position: 'bottom', status: 'error', message: t('errand-information:attachments.remove_error') });
    }
  };

  const openAttachment = async (index: number) => {
    const attachment = (getValues('attachments') ?? [])[index];

    try {
      const blob =
        attachment.file ??
        (attachment.id && errandId ? await downloadErrandAttachment(errandId, attachment.id) : undefined);
      if (!blob) return;

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toastMessage({ position: 'bottom', status: 'error', message: t('errand-information:attachments.open_error') });
    }
  };

  const morePanel = (index: number) => (
    <PopupMenu.Panel data-cy="attachment-context-menu">
      <PopupMenu.Items>
        <PopupMenu.Group>
          <PopupMenu.Item>
            <Button
              data-cy={`open-attachment-${String(index)}`}
              leftIcon={<Eye />}
              onClick={() => {
                void openAttachment(index);
              }}
            >
              {t('errand-information:attachments.open')}
            </Button>
          </PopupMenu.Item>
          {!isLocked && (
            <PopupMenu.Item>
              <Button
                data-cy={`delete-attachment-${String(index)}`}
                leftIcon={<Trash />}
                onClick={() => {
                  void removeAttachment(index);
                }}
              >
                {t('errand-information:attachments.remove')}
              </Button>
            </PopupMenu.Item>
          )}
        </PopupMenu.Group>
      </PopupMenu.Items>
    </PopupMenu.Panel>
  );

  if (loading) {
    return <div className="text-gray-500">{t('errand-information:attachments.loading_types')}</div>;
  }

  return (
    <div className="flex flex-col gap-24 pb-[2.4rem]">
      {error && (
        <div role="alert" className="text-error">
          {t('errand-information:attachments.types_error')}
        </div>
      )}

      {requiredTypes.length > 0 && (
        <div data-cy="required-attachments">
          <p className="font-bold">{t('errand-information:attachments.required_heading')}</p>
          <ul className="mt-8 flex flex-col gap-8">
            {requiredTypes.map((type) => {
              const missing = missingTypes.some((missingType) => missingType.key === type.key);
              return (
                <li key={type.key} className="flex gap-8">
                  {missing ?
                    <Circle className="shrink-0 mt-2 text-dark-secondary" size={18} aria-hidden />
                  : <Check className="shrink-0 mt-2 text-gronsta-text-primary" size={18} aria-hidden />}
                  <div>
                    <span className={missing && showValidation ? 'text-error' : undefined}>{type.label}</span>
                    {missing && (
                      <span className="text-dark-secondary"> ({t('errand-information:attachments.missing')})</span>
                    )}
                    {type.description && <p className="text-dark-secondary text-small">{type.description}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {loadError && (
        <div role="alert" className="text-error">
          {t('errand-information:attachments.load_error')}
        </div>
      )}

      <FormProvider {...uploadFormMethods}>
        {!isLocked && (
          /* The library prints the raw accept list (MIME types) truncated with an ellipsis; hide
             that row and describe the allowed formats in plain language below instead. */
          <FileUpload.Field
            accept={ALLOWED_ATTACHMENT_MIME_TYPES}
            className="[&_.sk-form-file-upload-field-button-content-restrictions-mimetypes]:hidden"
            data-cy="attachment-upload-field"
            maxFileSizeMB={MAX_ATTACHMENT_SIZE_MB}
            onChange={(event) => {
              addFiles(event.target.value);
            }}
            onInvalid={(message) => {
              toastMessage({ position: 'bottom', status: 'error', message });
            }}
          />
        )}
        <small>{t('errand-information:attachments.allowed_formats')}</small>

        {/* `files` must be passed explicitly: without it FileUpload.List watches a field of the
            surrounding form, which yields a new array every render and loops setState. */}
        <FileUpload.List isEdit={!isLocked} files={files} showLabels>
          {files.map((file, index) => (
            <FileUpload.ListItem
              data-cy={`attachment-item-${String(index)}`}
              key={file.id}
              file={file}
              index={index}
              isEdit={!isLocked}
              iconProps={{ icon: <Icon icon={<FileText />} /> }}
              nameProps={{
                isEdit: false,
                description:
                  typeof file.meta.created === 'string' ?
                    t('errand-information:attachments.uploaded_at', {
                      date: new Date(file.meta.created).toLocaleString('sv-SE'),
                    })
                  : t('errand-information:attachments.not_sent_yet'),
              }}
              categoryProps={{
                className: 'min-w-0 [&_.sk-form-control]:w-full [&_.sk-form-select]:w-full',
                categories,
                selectProps: {
                  value: file.meta.category ?? '',
                  onChange: (event) => {
                    void setCategory(index, event.target.value);
                  },
                },
              }}
              actionsProps={{
                isEdit: false,
                showRemove: false,
                showMore: true,
                morePopupMenuPanel: morePanel(index),
              }}
            />
          ))}
        </FileUpload.List>
      </FormProvider>
    </div>
  );
};

const useSchemaName = (): string | undefined => {
  const { watch } = useFormContext<ErrandFormDTO>();
  const namespace = useMetadataStore((state) => state.metadata?.namespace);
  return schemaNamesForErrand(watch('labels'), namespace)[0];
};

const NoErrandType: React.FC = () => {
  const { t } = useTranslation();
  return <span className="text-dark-secondary">{t('errand-information:attachments.no_errand_type')}</span>;
};

const SchemaAttachments: React.FC<{ schemaName: string }> = ({ schemaName }) => (
  <AttachmentsForSchema requirements={useAttachmentRequirements(schemaName)} />
);

export const ErrandAttachmentsContent: React.FC = () => {
  const schemaName = useSchemaName();
  return schemaName ? <SchemaAttachments schemaName={schemaName} /> : <NoErrandType />;
};

const AttachmentsDisclosure: React.FC<{ status?: SectionStatus; children: ReactNode }> = ({ status, children }) => {
  const { t } = useTranslation();

  return (
    <ErrandDisclosure
      header={t('errand-information:attachments.title')}
      icon={<Paperclip />}
      status={status}
      statusDataCy="section-status-attachments"
    >
      {children}
    </ErrandDisclosure>
  );
};

const SchemaAttachmentsDisclosure: React.FC<{ schemaName: string }> = ({ schemaName }) => {
  const { showValidation } = useFormValidation();
  const requirements = useAttachmentRequirements(schemaName);

  return (
    <AttachmentsDisclosure status={showValidation ? attachmentsStatus(requirements) : undefined}>
      <AttachmentsForSchema requirements={requirements} />
    </AttachmentsDisclosure>
  );
};

export const ErrandAttachments: React.FC = () => {
  const schemaName = useSchemaName();

  return schemaName ?
      <SchemaAttachmentsDisclosure schemaName={schemaName} />
    : <AttachmentsDisclosure>
        <NoErrandType />
      </AttachmentsDisclosure>;
};
