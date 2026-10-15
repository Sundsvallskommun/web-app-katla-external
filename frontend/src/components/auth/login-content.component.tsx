'use client';

import LoaderFullScreen from '@components/loader/loader-fullscreen';
import { Button } from '@sk-web-gui/button';
import { Divider } from '@sk-web-gui/divider';
import { FormErrorMessage } from '@sk-web-gui/react';
import { apiURL } from '@utils/api-url';
import { appURL } from '@utils/app-url';
import { capitalize } from 'lodash';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isProduction } from 'src/config/appconfig';

// Turn on/off automatic login
const autoLogin = false;

export const LoginContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathName = usePathname();
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  const isLoggedOut = searchParams.get('loggedout') === '';
  const failMessage = searchParams.get('failMessage');

  const initalFocus = useRef<HTMLButtonElement>(null);
  const setInitalFocus = () => {
    setTimeout(() => {
      initalFocus?.current?.focus();
    });
  };

  const onLogin = () => {
    const searchPath = searchParams.get('path');
    const nonLoginPath = !/\/login/.exec(pathName) && pathName; // Contains path as long as it's not /login
    const nonLoginSearch = (!searchPath?.match(/\/login|\/logout/) && searchPath) ?? false; // Contains redirect path as long as it's not /login or /logout
    // Falsy semantics kept: fall through on false or an empty string, not only null/undefined.
    const path =
      nonLoginPath ? nonLoginPath
      : nonLoginSearch ? nonLoginSearch
      : `${process.env.NEXT_PUBLIC_BASE_PATH}/`;

    const url = new URL(apiURL('/saml/login'));
    const queries = new URLSearchParams({
      successRedirect: appURL(path),
      failureRedirect: `${appURL()}/login`,
    });
    url.search = queries.toString();
    // Top-level navigation, not router.push: the SameSite=Lax session cookie must ride along.
    window.location.assign(url.toString());
  };

  useEffect(() => {
    setInitalFocus();
    if (!router) return;

    if (isLoggedOut) {
      setIsLoading(false);
    } else {
      if (failMessage === 'NOT_AUTHORIZED' && autoLogin) {
        // autologin
        onLogin();
      } else if (failMessage) {
        setErrorMessage(t(`login:errors.${failMessage}`));
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  if (isLoading) {
    // to not flash the login-screen on autologin
    return <LoaderFullScreen />;
  }

  return (
    <>
      {isLoggedOut ?
        <div className="flex flex-col items-center gap-[4rem] w-full">
          <h1 className="text-center text-[4rem] font-bold leading-[5.6rem] m-0">{t('login:logged_out_title')}</h1>
          <Button
            variant="primary"
            color="vattjom"
            size="lg"
            onClick={() => {
              router.push('/login');
            }}
          >
            {t('login:login_again_button')}
          </Button>
        </div>
      : <>
          <h1 className="text-center text-h2-sm lg:text-h2-lg mb-0">{t('login:choose_login_method')}</h1>
          <Divider className="w-full" />
          <div className="flex flex-row desktop:flex-col gap-56 w-full desktop:w-fit px-80 pb-[10.4rem] pt-80 items-center">
            <span>{t('login:login_problem')}</span>
            <Button
              data-cy="login-button"
              variant="primary"
              size="lg"
              onClick={() => {
                onLogin();
              }}
            >
              {capitalize(t('common:login'))}
            </Button>
          </div>
          {errorMessage && <FormErrorMessage className="text-error mt-lg">{errorMessage}</FormErrorMessage>}
          {!isProduction() && (
            <div className="flex flex-col items-center gap-16 mt-lg">
              <span className="text-small">{t('login:test_environment_logout_help')}</span>
              <Button
                data-cy="login-logout-button"
                variant="tertiary"
                size="md"
                onClick={() => {
                  router.push('/logout');
                }}
              >
                {capitalize(t('common:logout'))}
              </Button>
            </div>
          )}
        </>
      }
    </>
  );
};
