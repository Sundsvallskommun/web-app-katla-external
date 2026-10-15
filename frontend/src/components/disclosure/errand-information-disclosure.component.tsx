import { SectionStatus, SectionStatusLabel } from '@components/disclosure/section-status-label.component';
import { ErrandContentLock } from '@components/errand-content-lock/errand-content-lock.component';
import { Checkbox, Disclosure, Divider, Label } from '@sk-web-gui/react';
import { ReactElement, ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'src/config/appconfig';

export const ErrandDisclosure: React.FC<{
  header: string;
  icon: ReactElement;
  children: ReactNode;
  errandInformationSection?: boolean;
  disabled?: boolean;
  initialOpen?: boolean;
  status?: SectionStatus;
  statusDataCy?: string;
}> = ({
  header,
  icon,
  children,
  errandInformationSection,
  disabled = false,
  initialOpen = true,
  status,
  statusDataCy,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(disabled ? false : initialOpen);
  const [doneMark, setDoneMark] = useState(false);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    } else {
      setOpen(initialOpen);
    }
  }, [disabled, initialOpen]);

  useEffect(() => {
    if (doneMark) {
      setOpen(!open);
    }
  }, [doneMark]);

  const handleToggleOpen = (isOpen: boolean) => {
    if (!disabled) {
      setOpen(isOpen);
    }
  };

  return (
    <Disclosure
      variant="alt"
      className="w-full mobileVersion"
      open={open}
      onToggleOpen={handleToggleOpen}
      disabled={disabled}
    >
      <Disclosure.Header>
        <Disclosure.Icon icon={icon} />
        <Disclosure.Title>{header}</Disclosure.Title>
        {status && <SectionStatusLabel status={status} data-cy={statusDataCy} />}
        {doneMark && status !== 'complete' && (
          <Label inverted rounded color="gronsta">
            {t('errand-information:section.complete')}
          </Label>
        )}
        <Disclosure.Button />
      </Disclosure.Header>
      <Disclosure.Content>
        <ErrandContentLock className="w-full" disabled={disabled}>
          {children}
          {errandInformationSection && <Divider className="pt-20" />}

          {appConfig.features.disclosureDoneMark && (
            <Checkbox
              onClick={() => {
                setDoneMark(!doneMark);
              }}
              checked={doneMark}
              disabled={disabled}
            >
              {t('errand-information:section.mark_complete')}
            </Checkbox>
          )}
        </ErrandContentLock>
      </Disclosure.Content>
    </Disclosure>
  );
};
