'use client';

import { ErrandDTO } from '@data-contracts/backend/data-contracts';
import { createContext, useContext } from 'react';
import { useFormContext } from 'react-hook-form';

export const ErrandContentLockContext = createContext(false);

/**
 * True once the errand has been filed: its content may no longer change. A draft is still being
 * prepared and stays open. The rule lives here so it cannot drift apart between the surfaces
 * that need it.
 */
export function useErrandLocked(): boolean {
  const { watch } = useFormContext<ErrandDTO>();
  const id = watch('id');
  const lifecycle = watch('lifecycle');
  return Boolean(id) && lifecycle !== 'DRAFT';
}

/**
 * True when the component renders inside a locked ErrandContentLock.
 *
 * Components rendering actions use it to omit them entirely. A disabled fieldset makes buttons
 * unclickable but leaves them visible, and a button that does not respond reads as broken rather
 * than as a locked errand.
 */
export function useIsContentLocked(): boolean {
  return useContext(ErrandContentLockContext);
}
