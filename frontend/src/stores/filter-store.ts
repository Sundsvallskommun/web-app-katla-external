import { ErrandLifecycle } from '@interfaces/errand-form';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FilterState {
  activeStatus: string | null;
  statuses: string[];
  lifecycle?: ErrandLifecycle;
  setActiveStatus: (status: string) => void;
  setStatuses: (statuses: string[]) => void;
  setLifecycle: (lifecycle?: ErrandLifecycle) => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      activeStatus: null,
      statuses: [],
      setActiveStatus: (status) => set({ activeStatus: status }),
      setStatuses: (statuses) => set({ statuses }),
      setLifecycle: (lifecycle) => set({ lifecycle }),
    }),
    {
      name: 'filter-storage',
    }
  )
);
