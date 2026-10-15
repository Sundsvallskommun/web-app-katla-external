import { ErrandDTO, MetadataResponseDTO, PageErrandDTO } from '@data-contracts/backend/data-contracts';
import { ErrandLifecycle } from '@interfaces/errand-form';
import { apiService } from '@services/api-service';

export interface ErrandQuery {
  page?: number;
  size?: number;
  sortColumn?: string;
  sortOrder?: 'asc' | 'desc';
  statuses?: string[];
  // Upstream leaves drafts out of every search that does not name the lifecycle.
  lifecycle?: ErrandLifecycle;
}

export const getErrandUsingErrandNumber = async (errandNumber: string): Promise<ErrandDTO> => {
  return apiService.get<ErrandDTO>(`supportmanagement/errand/${errandNumber}`).then((res) => res.data);
};

export const getErrands = async (q?: ErrandQuery): Promise<PageErrandDTO> => {
  const params: Record<string, string | number> = {};

  if (q?.statuses && q.statuses.length > 0) {
    params.status = q.statuses.join(',');
  }
  if (q?.lifecycle) params.lifecycle = q.lifecycle;

  if (q?.page !== undefined) params.page = q.page;
  if (q?.size !== undefined) params.size = q.size;
  if (q?.sortColumn) {
    params.sort = `${q.sortColumn},${q.sortOrder ?? 'desc'}`;
  }

  return apiService
    .get<PageErrandDTO>('supportmanagement/errands', {
      params: { ...params },
    })
    .then((res) => res.data);
};

export const getErrandsCount = async (q?: ErrandQuery): Promise<{ count: number }> => {
  const params: Record<string, string | number> = {};

  if (q?.statuses && q.statuses.length > 0) {
    params.status = q.statuses.join(',');
  }
  if (q?.lifecycle) params.lifecycle = q.lifecycle;

  return apiService
    .get<{ count: number }>('supportmanagement/count', {
      params: { ...params },
    })
    .then((res) => res.data);
};

export const getMetadata = async (): Promise<MetadataResponseDTO> => {
  return apiService.get<MetadataResponseDTO>('supportmanagement/metadata').then((res) => res.data);
};

export const createErrand = async (errand: ErrandDTO): Promise<ErrandDTO> => {
  return apiService.post<ErrandDTO>('supportmanagement/errand/create', errand).then((res) => res.data);
};

export const updateErrand = async (id: string, errand: Partial<ErrandDTO>): Promise<ErrandDTO> => {
  return apiService.patch<ErrandDTO>(`supportmanagement/errand/${id}`, errand).then((res) => res.data);
};
