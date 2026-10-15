import {
  CategoryDTO,
  ContactReasonDTO,
  ExternalIdTypeDTO,
  LabelsDTO,
  MetadataResponseDTO,
  RoleDTO,
  StatusDTO,
} from '@data-contracts/backend/data-contracts';
import { create } from 'zustand';

interface MetadataState {
  metadata: MetadataResponseDTO | null;
  setMetadata: (metadata: MetadataResponseDTO) => void;

  setCategories: (categories: CategoryDTO[]) => void;
  setExternalIdTypes: (types: ExternalIdTypeDTO[]) => void;
  setLabels: (labels: LabelsDTO) => void;
  setStatuses: (statuses: StatusDTO[]) => void;
  setRoles: (roles: RoleDTO[]) => void;
  setContactReasons: (reasons: ContactReasonDTO[]) => void;
}

// The store is deliberately not persisted: a localStorage copy let errand pages render against
// metadata fetched long ago. Each surface fetches it itself through useLoadMetadata instead.
export const useMetadataStore = create<MetadataState>()((set) => ({
  metadata: null,

  setMetadata: (metadata) => {
    set({ metadata });
  },

  setCategories: (categories) => {
    set((state) => ({
      metadata: { ...(state.metadata ?? {}), categories },
    }));
  },

  setExternalIdTypes: (externalIdTypes) => {
    set((state) => ({
      metadata: { ...(state.metadata ?? {}), externalIdTypes },
    }));
  },

  setLabels: (labels) => {
    set((state) => ({
      metadata: { ...(state.metadata ?? {}), labels },
    }));
  },

  setStatuses: (statuses) => {
    set((state) => ({
      metadata: { ...(state.metadata ?? {}), statuses },
    }));
  },

  setRoles: (roles) => {
    set((state) => ({
      metadata: { ...(state.metadata ?? {}), roles },
    }));
  },

  setContactReasons: (contactReasons) => {
    set((state) => ({
      metadata: { ...(state.metadata ?? {}), contactReasons },
    }));
  },
}));
