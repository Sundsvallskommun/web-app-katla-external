import { ErrandFormDTO } from '@interfaces/errand-form';
import { storeErrandFormHandover, takeErrandFormHandover } from '@utils/errand-form-handover';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const values: ErrandFormDTO = {
  title: 'Empty errand',
  priority: 'MEDIUM',
  channel: 'ESERVICE',
  resolution: 'INFORMED',
  description: 'Halvfärdig beskrivning',
};

describe('errand form handover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T08:00:00Z'));
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carries the form and the wizard step across a language switch', () => {
    storeErrandFormHandover({ path: '/alkoholtillstand', values, wizardStep: 2 });

    const handover = takeErrandFormHandover('/alkoholtillstand');

    expect(handover?.values).toEqual(values);
    expect(handover?.wizardStep).toBe(2);
  });

  it('is consumed once so it does not resurface in a later empty form', () => {
    storeErrandFormHandover({ path: '/alkoholtillstand', values, wizardStep: 1 });

    expect(takeErrandFormHandover('/alkoholtillstand')).not.toBeNull();
    expect(takeErrandFormHandover('/alkoholtillstand')).toBeNull();
  });

  it('ignores a handover written on another page', () => {
    storeErrandFormHandover({ path: '/alkoholtillstand', values, wizardStep: 1 });

    // The key is the path without language prefix. Another errand is another page, and its
    // values do not belong here.
    expect(takeErrandFormHandover('/alkoholtillstand/arende/AIA-25120019/grundinformation')).toBeNull();
  });

  it('ignores a handover that outlived the navigation that wrote it', () => {
    storeErrandFormHandover({ path: '/alkoholtillstand', values, wizardStep: 1 });

    vi.setSystemTime(new Date('2026-08-14T08:00:30Z'));

    expect(takeErrandFormHandover('/alkoholtillstand')).toBeNull();
  });
});
