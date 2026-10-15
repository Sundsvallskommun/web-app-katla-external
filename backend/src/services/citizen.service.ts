import { MUNICIPALITY_ID } from '@/config';
import { getApiBase } from '@/config/api-config';
import { HttpException } from '@/exceptions/HttpException';
import ApiService, { Sender } from '@/services/api.service';

/** Injectable so tests can drive the exchange without an upstream. */
type CitizenApi = Pick<ApiService, 'get'>;

const defaultApi = new ApiService();
const citizenBase = getApiBase('citizen');

/**
 * Exchanges the citizen identifier from the SAML profile for the party id the rest of the app
 * keys the user on — LegalEntity mandates, the X-Sent-By sender, and errand reporters.
 */
export const getCitizenPartyId = async (personNumber: string, sender: Sender, api: CitizenApi = defaultApi): Promise<string> => {
  const url = `${citizenBase}/${MUNICIPALITY_ID}/${personNumber}/guid`;
  const res = await api.get<string>({ url }, sender);

  if (typeof res.data !== 'string' || res.data === '') {
    throw new HttpException(502, 'Invalid guid response from Citizen API');
  }

  return res.data;
};
