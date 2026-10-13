import { MUNICIPALITY_ID } from '@/config';
import { MetadataResponse } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces/auth.interface';
import ApiService from '@/services/api.service';
import { requireNamespace } from '@/utils/service-context';

export async function fetchMetadata(apiService: ApiService, apiBase: string, req: RequestWithUser): Promise<MetadataResponse> {
  const url = `${apiBase}/${MUNICIPALITY_ID}/${requireNamespace(req)}/metadata`;
  const res = await apiService.get<MetadataResponse>({ url }, req);
  if (!res.data) throw new HttpException(502, 'Invalid response when reading metadata');

  return res.data;
}
