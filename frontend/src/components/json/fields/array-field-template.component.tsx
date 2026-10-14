'use client';
import {
  type ArrayFieldTemplateItemType,
  type ArrayFieldTemplateProps,
  getTemplate,
  getUiOptions,
  titleId,
} from '@rjsf/utils';
import { Button } from '@sk-web-gui/react';
import { ArrowDown, ArrowUp, Copy, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Dynamic tables — `type: "array"` of objects, OpenE's DynamicTableQuery. RJSF's own template is
 * Bootstrap 3 markup the app ships no styles for, which leaves a zero-sized add button under a
 * heading and no way to fill the table in.
 *
 * Only the title is rendered here: FieldTemplate renders the description for every field, and
 * RJSF sets `displayLabel` false for object arrays, so the label is this template's to draw.
 */
export function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const { t } = useTranslation('forms');
  const { canAdd, disabled, idSchema, items, onAddClick, readonly, registry, required, title, uiSchema } = props;

  const uiOptions = getUiOptions(uiSchema);
  const ItemTemplate = getTemplate<'ArrayFieldItemTemplate'>('ArrayFieldItemTemplate', registry, uiOptions);
  const addButtonLabel = uiOptions.addButtonLabel;
  const addLabel = typeof addButtonLabel === 'string' && addButtonLabel ? addButtonLabel : t('array.add');

  return (
    <fieldset id={idSchema.$id} className="m-0 min-w-0 w-full border-0 p-0" disabled={!!disabled || !!readonly}>
      {title && (
        <legend
          id={titleId(idSchema.$id)}
          className="max-w-full whitespace-normal break-words text-label-medium font-bold"
        >
          {title}
          {required ? '*' : ''}
        </legend>
      )}

      {items.length > 0 && (
        <div className="mt-8 flex flex-col gap-16">
          {items.map(({ key, ...itemProps }) => (
            <ItemTemplate key={key} {...itemProps} />
          ))}
        </div>
      )}

      {canAdd && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-16"
          leftIcon={<Plus />}
          onClick={onAddClick}
          data-cy={`${idSchema.$id}-add`}
        >
          {addLabel}
        </Button>
      )}
    </fieldset>
  );
}

interface ItemActionProps {
  label: string;
  icon: React.ReactElement;
  onClick: () => void;
}

function ItemAction({ label, icon, onClick }: ItemActionProps) {
  return (
    <Button type="button" variant="ghost" size="sm" iconButton aria-label={label} title={label} onClick={onClick}>
      {icon}
    </Button>
  );
}

/**
 * One row of a dynamic table. The row is numbered because the fields inside it repeat, so the
 * position is all that tells two rows apart — both on screen and in the actions' labels.
 */
export function ArrayFieldItemTemplate(props: ArrayFieldTemplateItemType) {
  const { t } = useTranslation('forms');
  const {
    children,
    hasCopy,
    hasMoveDown,
    hasMoveUp,
    hasRemove,
    hasToolbar,
    index,
    onCopyIndexClick,
    onDropIndexClick,
    onReorderClick,
  } = props;

  const position = index + 1;

  return (
    <div className="border-1 rounded-12 bg-background-content w-full min-w-0" data-cy="array-item">
      <div className="rounded-t-12 bg-vattjom-background-200 flex min-h-[4rem] items-center justify-between gap-12 px-16">
        <strong>{t('array.row', { position })}</strong>
        {hasToolbar && (
          <div className="flex items-center gap-4">
            {hasMoveUp && (
              <ItemAction
                label={t('array.move_up', { position })}
                icon={<ArrowUp />}
                onClick={onReorderClick(index, index - 1)}
              />
            )}
            {hasMoveDown && (
              <ItemAction
                label={t('array.move_down', { position })}
                icon={<ArrowDown />}
                onClick={onReorderClick(index, index + 1)}
              />
            )}
            {hasCopy && (
              <ItemAction label={t('array.copy', { position })} icon={<Copy />} onClick={onCopyIndexClick(index)} />
            )}
            {hasRemove && (
              <ItemAction label={t('array.remove', { position })} icon={<X />} onClick={onDropIndexClick(index)} />
            )}
          </div>
        )}
      </div>
      <div className="min-w-0 p-16">{children}</div>
    </div>
  );
}
