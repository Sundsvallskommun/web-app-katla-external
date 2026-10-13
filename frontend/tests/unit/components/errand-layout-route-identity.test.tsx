import { ErrandDTO } from '@data-contracts/backend/data-contracts';
import { getErrandUsingErrandNumber } from '@services/errand-service/errand-service';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { useFormContext } from 'react-hook-form';
import { ErrandLayoutContent } from 'src/components/errand-layout/errand-layout-content.component';
import { useMetadataStore } from 'src/stores/metadata-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getErrandUsingErrandNumber: vi.fn(),
  jsonParametersToErrandFormData: vi.fn(() => []),
  metadataLoadState: { value: 'ready' },
  pathname: { value: '/alkoholtillstand/arende/ERRAND-A/grundinformation' },
  params: { value: { service: 'alkoholtillstand', errandnumber: undefined as string | undefined } },
  register: vi.fn(),
  save: vi.fn(),
  wizardReset: vi.fn(),
}));

vi.mock('@services/errand-service/errand-service', () => ({
  getErrandUsingErrandNumber: mocks.getErrandUsingErrandNumber,
}));

vi.mock('@components/json/utils/schema-utils', () => ({
  jsonParametersToErrandFormData: mocks.jsonParametersToErrandFormData,
}));

vi.mock('next/navigation', () => ({
  useParams: () => mocks.params.value,
  usePathname: () => mocks.pathname.value,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('src/hooks/use-media-query', () => ({ useMediaQuery: () => false }));
// The layout does not render until the current metadata fetch finishes. The fetch itself is not
// what this test covers, so its status is driven explicitly here.
vi.mock('src/hooks/use-load-metadata', () => ({
  useLoadMetadata: () => ({ metadataError: null, metadataLoadState: mocks.metadataLoadState.value }),
}));
vi.mock('src/hooks/use-auto-init-reporter', () => ({ useAutoInitReporter: vi.fn() }));
vi.mock('src/stores/wizard-store', () => ({
  useWizardStore: (selector: (state: { reset: () => void }) => unknown) => selector({ reset: mocks.wizardReset }),
}));

vi.mock('@components/tabs/tabs', () => ({
  visibleTabsFor: () => [{ labelKey: 'common:tabs.basic_information', path: '/grundinformation', visible: true }],
}));
vi.mock('@components/wizard/mobile-wizard.component', () => ({ MobileWizard: () => <div>mobile-wizard</div> }));
vi.mock('@contexts/form-validation-provider', () => ({
  FormValidationProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}));
vi.mock('@layouts/main/main.component', () => ({
  default: ({ children }: PropsWithChildren) => <main>{children}</main>,
}));

vi.mock('@layouts/base-errand-layout/base-errand-layout.component', async () => {
  const { useFormContext: useContext } = await import('react-hook-form');

  const BaseErrandLayoutMock = ({ children, registerNewErrand }: PropsWithChildren<{ registerNewErrand: boolean }>) => {
    const { watch } = useContext<ErrandDTO>();
    const errandNumber = watch('errandNumber');
    const status = watch('status');

    return (
      <div>
        <div data-testid="base-header">
          {registerNewErrand ? 'new-errand' : `existing:${errandNumber ?? 'missing'}:${status ?? 'missing'}`}
        </div>
        {children}
      </div>
    );
  };

  return {
    default: BaseErrandLayoutMock,
  };
});

vi.mock('@layouts/errand-button-group.component', async () => {
  const { useFormContext: useContext } = await import('react-hook-form');

  return {
    ErrandButtonGroup: () => {
      const { getValues } = useContext<ErrandDTO>();

      return (
        <div>
          <button
            type="button"
            onClick={() => {
              mocks.save(getValues());
            }}
          >
            save-action
          </button>
          <button
            type="button"
            onClick={() => {
              mocks.register(getValues());
            }}
          >
            register-action
          </button>
        </div>
      );
    },
  };
});

vi.mock('@sk-web-gui/react', () => {
  const Tabs = Object.assign(({ children }: PropsWithChildren) => <div>{children}</div>, {
    Button: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Content: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Item: ({ children }: PropsWithChildren) => <div>{children}</div>,
  });
  const AlertContent = Object.assign(({ children }: PropsWithChildren) => <div>{children}</div>, {
    Description: ({ children }: PropsWithChildren) => <div>{children}</div>,
  });
  const Alert = Object.assign(({ children }: PropsWithChildren) => <div>{children}</div>, {
    Content: AlertContent,
    Icon: () => null,
  });

  return {
    Alert,
    cx: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
    Spinner: ({ 'aria-label': ariaLabel }: { 'aria-label': string }) => <div aria-label={ariaLabel} />,
    Tabs,
  };
});

const getErrandMock = vi.mocked(getErrandUsingErrandNumber);

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const setExistingRoute = (errandNumber: string): void => {
  mocks.pathname.value = `/alkoholtillstand/arende/${errandNumber}/grundinformation`;
  mocks.params.value = { service: 'alkoholtillstand', errandnumber: errandNumber };
};

const FormIdentityProbe = () => {
  const { watch } = useFormContext<ErrandDTO>();
  return <div data-testid="form-identity">{`${watch('id') ?? 'missing'}:${watch('errandNumber') ?? 'missing'}`}</div>;
};

beforeEach(() => {
  setExistingRoute('ERRAND-A');
  mocks.metadataLoadState.value = 'ready';
  useMetadataStore.setState({ metadata: { roles: [] } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('errand layout route identity', () => {
  it('waits for the current metadata request even when the store contains previous metadata', () => {
    mocks.pathname.value = '/alkoholtillstand';
    mocks.params.value.errandnumber = undefined;
    mocks.metadataLoadState.value = 'loading';

    const view = render(<ErrandLayoutContent>registration-content</ErrandLayoutContent>);

    expect(screen.getByLabelText('forms:loading')).toBeInTheDocument();
    expect(screen.queryByText('registration-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('base-header')).not.toBeInTheDocument();

    mocks.metadataLoadState.value = 'ready';
    view.rerender(<ErrandLayoutContent>registration-content</ErrandLayoutContent>);

    expect(screen.queryByLabelText('forms:loading')).not.toBeInTheDocument();
    expect(screen.getByText('registration-content')).toBeInTheDocument();
    expect(screen.getByTestId('base-header')).toHaveTextContent('new-errand');
  });

  it('removes A header, status and actions synchronously and never exposes A when B fails', async () => {
    const failedB = createDeferred<ErrandDTO>();
    getErrandMock
      .mockResolvedValueOnce({ id: 'id-a', errandNumber: 'ERRAND-A', status: 'NEW', jsonParameters: [] })
      .mockReturnValueOnce(failedB.promise);

    const view = render(
      <ErrandLayoutContent>
        <FormIdentityProbe />
      </ErrandLayoutContent>
    );

    expect(await screen.findByTestId('base-header')).toHaveTextContent('existing:ERRAND-A:NEW');
    expect(screen.getByTestId('form-identity')).toHaveTextContent('id-a:ERRAND-A');
    const detachedSaveAction = screen.getByRole('button', { name: 'save-action' });
    const detachedRegisterAction = screen.getByRole('button', { name: 'register-action' });

    setExistingRoute('ERRAND-B');
    view.rerender(
      <ErrandLayoutContent>
        <FormIdentityProbe />
      </ErrandLayoutContent>
    );

    expect(screen.queryByText(/ERRAND-A/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('base-header')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'save-action' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'register-action' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('forms:loading')).toBeInTheDocument();

    fireEvent.click(detachedSaveAction);
    fireEvent.click(detachedRegisterAction);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();

    await act(async () => {
      failedB.reject(new Error('B unavailable'));
      await failedB.promise.catch(() => undefined);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('api_errors.errand');
    expect(screen.queryByText(/ERRAND-A/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it('ignores a stale response from an unmounted route owner', async () => {
    const slowA = createDeferred<ErrandDTO>();
    const currentB = createDeferred<ErrandDTO>();
    getErrandMock.mockReturnValueOnce(slowA.promise).mockReturnValueOnce(currentB.promise);

    const view = render(
      <ErrandLayoutContent>
        <FormIdentityProbe />
      </ErrandLayoutContent>
    );

    setExistingRoute('ERRAND-B');
    view.rerender(
      <ErrandLayoutContent>
        <FormIdentityProbe />
      </ErrandLayoutContent>
    );

    await act(async () => {
      currentB.resolve({ id: 'id-b', errandNumber: 'ERRAND-B', status: 'NEW', jsonParameters: [] });
      await currentB.promise;
    });

    expect(await screen.findByTestId('base-header')).toHaveTextContent('existing:ERRAND-B:NEW');
    expect(screen.getByTestId('form-identity')).toHaveTextContent('id-b:ERRAND-B');

    await act(async () => {
      slowA.resolve({ id: 'late-id-a', errandNumber: 'ERRAND-A', status: 'NEW', jsonParameters: [] });
      await slowA.promise;
    });

    expect(screen.getByTestId('base-header')).toHaveTextContent('existing:ERRAND-B:NEW');
    expect(screen.getByTestId('form-identity')).toHaveTextContent('id-b:ERRAND-B');
    expect(mocks.jsonParametersToErrandFormData).toHaveBeenCalledTimes(1);
  });

  it('fails closed when B returns an errand with another identity', async () => {
    getErrandMock.mockResolvedValueOnce({
      id: 'wrong-id',
      errandNumber: 'ERRAND-A',
      status: 'NEW',
      jsonParameters: [],
    });
    setExistingRoute('ERRAND-B');

    render(
      <ErrandLayoutContent>
        <FormIdentityProbe />
      </ErrandLayoutContent>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('api_errors.errand');
    expect(screen.queryByText(/ERRAND-A/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('base-header')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(mocks.jsonParametersToErrandFormData).not.toHaveBeenCalled();
  });

  it('starts the registration route with fresh defaults instead of the previously loaded errand', async () => {
    getErrandMock.mockResolvedValueOnce({ id: 'id-a', errandNumber: 'ERRAND-A', status: 'NEW', jsonParameters: [] });

    const view = render(
      <ErrandLayoutContent>
        <FormIdentityProbe />
      </ErrandLayoutContent>
    );
    expect(await screen.findByTestId('form-identity')).toHaveTextContent('id-a:ERRAND-A');

    mocks.pathname.value = '/alkoholtillstand';
    mocks.params.value.errandnumber = undefined;
    view.rerender(
      <ErrandLayoutContent>
        <FormIdentityProbe />
      </ErrandLayoutContent>
    );

    expect(screen.getByTestId('base-header')).toHaveTextContent('new-errand');
    expect(screen.getByTestId('form-identity')).toHaveTextContent('missing:missing');
    fireEvent.click(screen.getByRole('button', { name: 'save-action' }));
    fireEvent.click(screen.getByRole('button', { name: 'register-action' }));

    const expectedDefaults = {
      channel: 'ESERVICE',
      priority: 'MEDIUM',
      resolution: 'INFORMED',
      title: 'Empty errand',
    };
    expect(mocks.save).toHaveBeenCalledWith(expectedDefaults);
    expect(mocks.register).toHaveBeenCalledWith(expectedDefaults);
    expect(mocks.wizardReset).toHaveBeenCalledTimes(1);
    expect(getErrandMock).toHaveBeenCalledTimes(1);
  });

  it('does not process a response after the current route owner unmounts', async () => {
    const pending = createDeferred<ErrandDTO>();
    getErrandMock.mockReturnValueOnce(pending.promise);
    const view = render(<ErrandLayoutContent>content</ErrandLayoutContent>);

    view.unmount();
    await act(async () => {
      pending.resolve({ id: 'id-a', errandNumber: 'ERRAND-A', status: 'NEW', jsonParameters: [] });
      await pending.promise;
    });

    expect(mocks.jsonParametersToErrandFormData).not.toHaveBeenCalled();
  });
});
