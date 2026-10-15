import { ColorSchemeItems } from '@components/misc/color-scheme-items.component';
import { LanguageItems } from '@components/misc/language-items.component';
import { LanguageSwitchButton } from '@components/misc/language-switch-button.component';
import { MobileErrandCard } from '@components/mobile/mobile-errand-card.component';
import { AppUserMenu } from '@components/user-menu/app-user-menu.component';
import { createUserMenuGroups } from '@layouts/userMenuGroup';
import { ColorSchemeMode, PopupMenu, Tabs } from '@sk-web-gui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import NextLink from 'next/link';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import commonSv from '../../../locales/sv/common.json';
import layoutSv from '../../../locales/sv/layout.json';

const routerPushMock = vi.hoisted(() => vi.fn());
const pathnameMock = vi.hoisted(() => ({ value: '/oversikt' }));
const searchParamsMock = vi.hoisted(() => ({ value: '' }));
const colorSchemeStoreMock = vi.hoisted(() => ({
  colorScheme: 'system',
  setColorScheme: vi.fn(),
}));
const i18n = createInstance();

vi.mock('next/navigation', () => ({
  useParams: () => ({ service: 'alkoholtillstand' }),
  useRouter: () => ({ push: routerPushMock }),
  usePathname: () => pathnameMock.value,
  useSearchParams: () => new URLSearchParams(searchParamsMock.value),
}));

vi.mock('@utils/use-localstorage.hook', () => ({
  useLocalStorage: () => colorSchemeStoreMock,
}));

const renderLocalized = (component: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);

describe('control semantics', () => {
  beforeAll(async () => {
    await i18n.init({
      lng: 'sv',
      resources: {
        sv: {
          common: commonSv,
          layout: layoutSv,
        },
      },
      defaultNS: 'layout',
      ns: ['layout', 'common'],
    });
  });

  afterEach(() => {
    routerPushMock.mockReset();
    pathnameMock.value = '/oversikt';
    searchParamsMock.value = '';
    colorSchemeStoreMock.colorScheme = 'system';
    colorSchemeStoreMock.setColorScheme.mockReset();
  });

  it('keeps the application menu actions keyboard-addressable', async () => {
    renderLocalized(
      <AppUserMenu initials="AE" menuTitle="Ada Exempel" menuGroups={createUserMenuGroups(i18n.t)} buttonSize="md" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Öppna användarmeny' }));
    const logout = await screen.findByRole('menuitem', { name: 'Logga ut' });

    expect(logout).toHaveAttribute('id');
    expect(logout).toHaveAttribute('tabindex');
    fireEvent.click(logout);
    expect(routerPushMock).toHaveBeenCalledWith('/logout');
  });

  it('gives the user menu trigger a functional accessible name', () => {
    renderLocalized(
      <AppUserMenu
        data-testid="user-menu"
        initials="AE"
        menuTitle="Ada Exempel"
        menuGroups={[
          {
            label: 'Kontroller',
            elements: [{ label: 'Inställningar', element: () => <button type="button">Inställningar</button> }],
          },
        ]}
        buttonSize="md"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Öppna användarmeny' }));

    expect(screen.getByRole('menuitem', { name: 'Inställningar' })).toBeVisible();
    expect(screen.getByTestId('user-menu')).toHaveClass('sk-usermenu');
  });

  it('renders mobile errand navigation as one named link', () => {
    renderLocalized(
      <MobileErrandCard
        errand={{
          errandNumber: 'AIA-25120019',
          status: 'NEW',
          created: '2026-08-12T08:00:00Z',
        }}
      />
    );

    const link = screen.getByRole('link', { name: 'Öppna ärende AIA-25120019' });
    expect(link).toHaveAttribute('href', '/alkoholtillstand/arende/AIA-25120019/grundinformation');
    expect(link.querySelector('button')).not.toBeInTheDocument();
  });

  it('keeps the design-system tab identity while rendering a single link', () => {
    const linkProps = { as: NextLink, href: '/alkoholtillstand/arende/ett/grundinformation' };

    render(
      <Tabs>
        <Tabs.Item>
          <Tabs.Button {...linkProps}>Grundinformation</Tabs.Button>
          <Tabs.Content>Innehåll</Tabs.Content>
        </Tabs.Item>
      </Tabs>
    );

    const tab = screen.getByRole('tab', { name: 'Grundinformation' });
    expect(tab.tagName).toBe('A');
    expect(tab).toHaveAttribute('href', '/alkoholtillstand/arende/ett/grundinformation');
    expect(tab.querySelector('button')).not.toBeInTheDocument();
  });

  it('exposes color modes as one radio set without closing after a selection', () => {
    renderLocalized(
      <PopupMenu open>
        <PopupMenu.Button>Färgläge</PopupMenu.Button>
        <PopupMenu.Panel>
          <ColorSchemeItems />
        </PopupMenu.Panel>
      </PopupMenu>
    );

    const light = screen.getByRole('menuitemradio', { name: 'Ljust' });
    const dark = screen.getByRole('menuitemradio', { name: 'Mörkt' });
    const system = screen.getByRole('menuitemradio', { name: 'System' });

    expect([light, dark, system].map((radio) => radio.getAttribute('name'))).toEqual([
      'user-menu-color-scheme',
      'user-menu-color-scheme',
      'user-menu-color-scheme',
    ]);
    expect(system).toBeChecked();

    fireEvent.click(light);

    expect(colorSchemeStoreMock.setColorScheme).toHaveBeenCalledWith(ColorSchemeMode.Light);
    expect(screen.getByRole('menuitemradio', { name: 'Mörkt' })).toBeVisible();
  });

  it('exposes languages by their native names as one radio set', () => {
    renderLocalized(
      <PopupMenu open>
        <PopupMenu.Button>Språk</PopupMenu.Button>
        <PopupMenu.Panel>
          <LanguageItems />
        </PopupMenu.Panel>
      </PopupMenu>
    );

    // Names are written in the language itself so a user who does not read Swedish still
    // recognises their own language in the menu.
    const swedish = screen.getByRole('menuitemradio', { name: 'Svenska' });
    const english = screen.getByRole('menuitemradio', { name: 'English' });

    expect([swedish, english].map((radio) => radio.getAttribute('name'))).toEqual([
      'user-menu-language',
      'user-menu-language',
    ]);
    expect(swedish).toBeChecked();
    expect(english).toHaveAttribute('lang', 'en');
  });

  it('switches language by navigating to the same page under an explicit locale prefix', () => {
    pathnameMock.value = '/alkoholtillstand/arende/AIA-25120019/grundinformation';

    renderLocalized(
      <PopupMenu open>
        <PopupMenu.Button>Språk</PopupMenu.Button>
        <PopupMenu.Panel>
          <LanguageItems />
        </PopupMenu.Panel>
      </PopupMenu>
    );

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));

    // The same page, not a return to the start page, or the user loses their place.
    expect(routerPushMock).toHaveBeenCalledWith('/en/alkoholtillstand/arende/AIA-25120019/grundinformation');
  });

  it('keeps the query string when switching language', () => {
    pathnameMock.value = '/login';
    searchParamsMock.value =
      'path=%2Falkoholtillstand%2Farende%2FAIA-25120019%2Fgrundinformation&failMessage=NOT_AUTHORIZED';

    renderLocalized(
      <PopupMenu open>
        <PopupMenu.Button>Språk</PopupMenu.Button>
        <PopupMenu.Panel>
          <LanguageItems />
        </PopupMenu.Panel>
      </PopupMenu>
    );

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));

    // Login reads ?path for where to return afterwards and ?failMessage for the error to show.
    // A language switch that drops the query string sends the user to the overview instead of
    // the page they were trying to reach.
    expect(routerPushMock).toHaveBeenCalledWith(
      '/en/login?path=%2Falkoholtillstand%2Farende%2FAIA-25120019%2Fgrundinformation&failMessage=NOT_AUTHORIZED'
    );
  });

  it('reaches the language choice from the header without opening the user menu', async () => {
    renderLocalized(<LanguageSwitchButton />);

    // The code on the button is a compact visual form; the accessible name spells the language
    // out, since "SV" means nothing to someone who does not already recognise it.
    const trigger = screen.getByRole('button', { name: 'Byt språk. Valt språk: Svenska' });
    expect(trigger).toHaveTextContent('SV');

    fireEvent.click(trigger);

    expect(await screen.findByRole('menuitemradio', { name: 'Svenska' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toBeVisible();
  });

  it('keeps the header language list in its own radio group', async () => {
    renderLocalized(<LanguageSwitchButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Byt språk. Valt språk: Svenska' }));

    // Sharing a name with the user menu's group would fuse the two lists into one radio group,
    // where only one could be selected.
    expect(await screen.findByRole('menuitemradio', { name: 'Svenska' })).toHaveAttribute('name', 'header-language');
  });
});
