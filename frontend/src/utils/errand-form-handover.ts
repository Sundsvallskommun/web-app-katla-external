import { ErrandFormDTO } from '@interfaces/errand-form';

const STORAGE_KEY = 'errand-form-handover';

/**
 * How long a handover may linger. Navigation happens on the client and is effectively instant,
 * so the window only has to cover that. Without it a handover that was never picked up could
 * surface in an empty form much later.
 */
const MAX_AGE_MS = 10_000;

export interface ErrandFormHandover {
  /** The path without language prefix, so the handover applies only to the page that wrote it. */
  path: string;
  values: ErrandFormDTO;
  wizardStep: number;
  storedAt: number;
}

/**
 * Switching language navigates to another route and remounts the whole errand tree. The form
 * lives only in memory, so without this handover switching language mid-registration costs the
 * user everything they have entered.
 */
export const storeErrandFormHandover = (handover: Omit<ErrandFormHandover, 'storedAt'>): void => {
  try {
    // A File does not survive JSON, so a bilaga that has not reached SupportManagement yet cannot
    // cross the navigation. Dropping it leaves a list that matches what can still be sent.
    const values = {
      ...handover.values,
      attachments: handover.values.attachments?.filter((attachment) => !attachment.file),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...handover, values, storedAt: Date.now() }));
  } catch {
    // With no storage, fall back to the old behaviour — an empty form — rather than letting the
    // language switch itself crash.
  }
};

/**
 * Reads the handover once and removes it. It should survive exactly the navigation that wrote
 * it, not reappear the next time an empty form is opened.
 */
export const takeErrandFormHandover = (path: string): ErrandFormHandover | null => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    sessionStorage.removeItem(STORAGE_KEY);

    const handover = JSON.parse(stored) as ErrandFormHandover;
    if (handover.path !== path) return null;
    if (Date.now() - handover.storedAt > MAX_AGE_MS) return null;

    return handover;
  } catch {
    return null;
  }
};
