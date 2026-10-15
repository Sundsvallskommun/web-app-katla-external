'use client';

import { StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { createContext, useContext } from 'react';

/** The logged in citizen as a stakeholder; externalId is their party id. */
export const MyStakeholderContext = createContext<StakeholderDTO | undefined>(undefined);

export function useMyStakeholder(): StakeholderDTO | undefined {
  return useContext(MyStakeholderContext);
}
