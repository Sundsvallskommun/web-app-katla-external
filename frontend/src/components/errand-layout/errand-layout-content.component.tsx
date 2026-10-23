'use client';

import { pathWithoutLocale } from '@app/locale-path';
import { jsonParametersToErrandFormData } from '@components/json/utils/schema-utils';
import { ErrorAlertList } from '@components/misc/error-alert.component';
import { visibleTabsFor } from '@components/tabs/tabs';
import { MobileWizard } from '@components/wizard/mobile-wizard.component';
import { FormValidationProvider } from '@contexts/form-validation-provider';
import { MyStakeholderContext } from '@contexts/my-stakeholder-context';
import { yupResolver } from '@hookform/resolvers/yup';
import { ErrandFormDTO } from '@interfaces/errand-form';
import BaseErrandLayout from '@layouts/base-errand-layout/base-errand-layout.component';
import { ErrandButtonGroup } from '@layouts/errand-button-group.component';
import Main from '@layouts/main/main.component';
import { getErrandUsingErrandNumber } from '@services/errand-service/errand-service';
import { cx, Spinner, Tabs } from '@sk-web-gui/react';
import { ErrandFormHandover, takeErrandFormHandover } from '@utils/errand-form-handover';
import { withCitizenAsContact } from '@utils/stakeholder';
import { default as NextLink } from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, Resolver, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MOBILE_BREAKPOINT } from 'src/constants/responsive';
import { servicePath } from 'src/constants/services';
import { useLoadMetadata } from 'src/hooks/use-load-metadata';
import { useLoadMyStakeholder } from 'src/hooks/use-load-my-stakeholder';
import { useMediaQuery } from 'src/hooks/use-media-query';
import { useService } from 'src/hooks/use-service';
import { useMetadataStore } from 'src/stores/metadata-store';
import { useWizardStore } from 'src/stores/wizard-store';
import * as yup from 'yup';

const FormSchema = yup.object({}).required();
const REGISTER_ROUTE_IDENTITY = 'new-errand';
const INVALID_ROUTE_IDENTITY = 'invalid-errand-route';

type ErrandRoute =
  | { identity: typeof REGISTER_ROUTE_IDENTITY; kind: 'register' }
  | { errandNumber: string; identity: string; kind: 'existing' }
  | { identity: typeof INVALID_ROUTE_IDENTITY; kind: 'invalid' };

// The check exists to reject responses from an earlier route, not to demand canonical casing.
// Compare normalised so a valid deep link with different casing still loads the errand.
const matchesRequestedErrand = (errandNumber: string | undefined, requestedErrandNumber: string): boolean =>
  errandNumber?.trim().toLocaleUpperCase('sv-SE') === requestedErrandNumber.trim().toLocaleUpperCase('sv-SE');

const createDefaultErrand = (): ErrandFormDTO => ({
  title: 'Empty errand',
  priority: 'MEDIUM',
  //TODO: Change channel to ESERVICE_KATLA?
  channel: 'ESERVICE',
  resolution: 'INFORMED',
  parameters: [{ key: 'premisesMunicipality', values: ['2281'] }],
});

interface ErrandRouteContentProps {
  children: React.ReactNode;
  route: ErrandRoute;
}

// Tabs identifies its direct Button child by component reference. Passing the polymorphic link
// props through an object keeps that identity while working around the installed declaration,
// which does not expose the target's props.
const createLinkTabProps = (href: string) => ({ as: NextLink, href });

const ErrandRouteContent: React.FC<ErrandRouteContentProps> = ({ children, route }) => {
  const { t } = useTranslation();
  const service = useService();
  const registerNewErrand = route.kind === 'register';
  const requestedErrandNumber = route.kind === 'existing' ? route.errandNumber : null;
  const initialFocus = useRef<HTMLBodyElement>(null);
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const wizardReset = useWizardStore((s) => s.reset);
  const wizardGoToStep = useWizardStore((s) => s.goToStep);
  const pathname = usePathname();
  const handoverRef = useRef<{ handover: ErrandFormHandover | null; path: string } | null>(null);
  const { metadataError, metadataLoadState } = useLoadMetadata();
  const { self, selfError, selfLoadState } = useLoadMyStakeholder();
  const metadata = useMetadataStore((state) => state.metadata);
  const [loadState, setLoadState] = useState<'error' | 'loading' | 'ready'>(
    route.kind === 'register' ? 'ready'
    : route.kind === 'invalid' ? 'error'
    : 'loading'
  );

  const setInitalFocus = () => {
    setTimeout(() => {
      initialFocus.current?.focus();
    });
  };

  const methods = useForm<ErrandFormDTO>({
    resolver: yupResolver(FormSchema) as unknown as Resolver<ErrandFormDTO>,
    defaultValues: createDefaultErrand(),
    mode: 'onSubmit',
  });
  const { reset, getValues, setValue } = methods;

  useEffect(() => {
    // A language switch is a navigation, and Next remounts the whole tree. The handover carries
    // what lived only in memory across it; without it, switching language mid-registration costs
    // the user everything they entered.
    //
    // The entry is removed on first read, while the effect may re-run for the same page —
    // StrictMode does exactly that in development. The result is therefore cached per path: a
    // re-run for the same page reuses it, and a move to another path gets its own (empty) result
    // instead of reapplying values that have gone stale.
    const handoverPath = pathWithoutLocale(pathname);
    if (handoverRef.current?.path !== handoverPath) {
      handoverRef.current = { path: handoverPath, handover: takeErrandFormHandover(handoverPath) };
    }
    const handover = handoverRef.current.handover;

    if (registerNewErrand) {
      if (handover) {
        reset(handover.values);
        wizardGoToStep(handover.wizardStep);
      } else {
        wizardReset();
      }
      return;
    }

    if (!requestedErrandNumber) return;

    let active = true;
    void getErrandUsingErrandNumber(requestedErrandNumber)
      .then((errand) => {
        if (!active) return;
        if (!matchesRequestedErrand(errand.errandNumber, requestedErrandNumber)) {
          throw new Error('Det hämtade ärendet matchar inte den begärda routen');
        }

        const errandFormData = jsonParametersToErrandFormData(errand.jsonParameters);
        // The handover holds unsaved edits and is therefore newer than the API response, which
        // carries only what has been saved.
        if (handover) {
          reset(handover.values);
          wizardGoToStep(handover.wizardStep);
        } else {
          reset({ ...errand, errandFormData });
        }
        setLoadState('ready');
      })
      .catch(() => {
        if (active) setLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [pathname, registerNewErrand, requestedErrandNumber, reset, wizardGoToStep, wizardReset]);

  // A new errand always lists the citizen; idempotent, so a re-run or a handover that already
  // carries them changes nothing. Loaded drafts are completed on save instead.
  useEffect(() => {
    if (!registerNewErrand || !self) return;
    setValue('stakeholders', withCitizenAsContact(getValues('stakeholders'), self));
  }, [registerNewErrand, self, getValues, setValue]);

  const errandNumber = methods.watch('errandNumber');
  const isDraft = methods.watch('lifecycle') === 'DRAFT';
  // A draft is the same unfinished work whether just created or resumed, and the wizard is the
  // interface built for narrow screens. Without this condition a resumed draft switched to the
  // tab view on mobile.
  const showMobileWizard = isMobile && (registerNewErrand || isDraft);
  // Mirrors ErrandButtonGroup's visibility; keeps the submit action reachable while scrolling.
  const showSubmitBar = registerNewErrand || isDraft;

  const getHeaderTitle = () => {
    if (registerNewErrand) {
      return t('filtering:new_errand');
    }
    if (isDraft) {
      return `${t('errand-information:draft')} ${errandNumber}`;
    }
    return `${t('errand-information:errand')} ${errandNumber}`;
  };

  // Role names come from metadata. Rendering the page before it exists leaves the roles empty,
  // so metadata belongs to the same readiness boundary as the errand itself. The citizen's own
  // stakeholder is needed to tell their card apart, so it is part of the boundary too.
  const loadErrors = [loadState === 'error' ? t('api_errors.errand') : null, metadataError, selfError].filter(
    (message): message is string => message !== null
  );

  if (
    loadErrors.length > 0 ||
    loadState !== 'ready' ||
    metadataLoadState !== 'ready' ||
    !metadata ||
    selfLoadState !== 'ready'
  ) {
    return (
      <FormProvider {...methods}>
        <div className="bg-background-100 h-screen min-h-screen flex items-center justify-center p-24">
          {loadErrors.length > 0 ?
            <ErrorAlertList messages={loadErrors} />
          : <Spinner aria-label={t('forms:loading')} />}
        </div>
      </FormProvider>
    );
  }

  return (
    <FormProvider {...methods}>
      <MyStakeholderContext.Provider value={self}>
        <FormValidationProvider>
          <NextLink
            href="#content"
            passHref
            onClick={() => {
              setInitalFocus();
            }}
            className="sr-only focus:not-sr-only bg-primary-light border-2 border-black p-4 text-black inline-block focus:absolute focus:top-0 focus:left-0 focus:right-0 focus:m-auto focus:w-80 text-center"
          >
            {t('layout:header.goto_content')}
          </NextLink>
          <BaseErrandLayout registerNewErrand={registerNewErrand}>
            {showMobileWizard ?
              <MobileWizard />
            : <div
                className={cx('grow shrink overflow-y-auto', showSubmitBar && 'scroll-pt-[16rem] md:scroll-pt-[12rem]')}
              >
                <div className="bg-transparent">
                  <div className="mb-xl">
                    <div className={cx(showSubmitBar && 'sticky top-0 z-10 bg-background-100')}>
                      <div className="mx-auto max-w-[108rem] flex flex-col md:flex-row justify-between pt-16 md:pt-32 pb-12 px-16 md:px-0 gap-12">
                        <h1 className="text-h2-sm md:text-h2-lg">{getHeaderTitle()}</h1>
                        <ErrandButtonGroup isNewErrand={registerNewErrand} />
                      </div>
                    </div>
                    <Main>
                      <Tabs
                        className="border-1 rounded-12 bg-background-content pt-22 pl-5 mx-auto max-w-[108rem]"
                        tabslistClassName="border-0 -m-b-12 flex-wrap ml-10 overflow-x-auto"
                        panelsClassName="border-t-1"
                        size="sm"
                      >
                        {visibleTabsFor(service)
                          .filter((tab) => tab.visible)
                          .map((tab) => {
                            return (
                              <Tabs.Item key={tab.path}>
                                <Tabs.Button {...createLinkTabProps(tab.path)} className="text-base whitespace-nowrap">
                                  {t(tab.labelKey)}
                                </Tabs.Button>
                                <Tabs.Content>
                                  <div className="pt-xl pb-64 px-16 md:px-40">{children}</div>
                                </Tabs.Content>
                              </Tabs.Item>
                            );
                          })}
                      </Tabs>
                    </Main>
                  </div>
                </div>
              </div>
            }
          </BaseErrandLayout>
        </FormValidationProvider>
      </MyStakeholderContext.Provider>
    </FormProvider>
  );
};

export const ErrandLayoutContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathName = usePathname();
  const service = useService();
  const { errandnumber } = useParams<{ errandnumber?: string }>();

  let route: ErrandRoute;
  if (pathWithoutLocale(pathName).replace(/\/$/, '') === servicePath(service)) {
    route = { identity: REGISTER_ROUTE_IDENTITY, kind: 'register' };
  } else if (errandnumber) {
    route = { errandNumber: errandnumber, identity: `existing:${errandnumber}`, kind: 'existing' };
  } else {
    route = { identity: INVALID_ROUTE_IDENTITY, kind: 'invalid' };
  }

  // One route identity owns exactly one RHF instance. The key tears the previous form down
  // synchronously on an A→B navigation, before B renders its header or actions, while the
  // request cleanup rejects any late A response.
  return (
    <ErrandRouteContent key={route.identity} route={route}>
      {children}
    </ErrandRouteContent>
  );
};
