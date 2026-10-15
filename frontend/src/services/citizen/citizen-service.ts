import { StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { apiService } from '@services/api-service';
import { AxiosResponse } from 'axios';

export const getStakeholderUsingPersonNumber = async (personNumber: string): Promise<AxiosResponse<StakeholderDTO>> => {
  const sanitizedPersonNumber = personNumber.replace('-', '');

  return apiService.get<StakeholderDTO>(`citizen/person/${sanitizedPersonNumber}`).then((res) => res);
};

/** The logged in citizen as a stakeholder, resolved from the session. */
export const getMyStakeholder = async (): Promise<AxiosResponse<StakeholderDTO>> =>
  apiService.get<StakeholderDTO>('citizen/me');
