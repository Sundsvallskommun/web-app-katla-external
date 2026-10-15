import { Controller, Get, Param, Req, UseBefore } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';

import { MUNICIPALITY_ID } from '@/config';
import { getApiBase } from '@/config/api-config';
import { CitizenExtended } from '@/data-contracts/citizen/data-contracts';
import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces/auth.interface';
import authMiddleware from '@/middlewares/auth.middleware';
import { StakeholderDTO } from '@/responses/supportmanagement.response';
import ApiService from '@/services/api.service';
import { addHyphenToPersonNumber } from '@/utils/stakeholder-mapping';

const toStakeholder = (citizen: CitizenExtended, personNumber: string, externalId: string | undefined): StakeholderDTO => {
  const address = citizen.addresses?.[0];

  return {
    externalId,
    city: address?.city ?? undefined,
    firstName: citizen.givenname ?? undefined,
    lastName: citizen.lastname ?? undefined,
    address: address?.address ?? undefined,
    zipCode: address?.postalCode ?? undefined,
    personNumber: addHyphenToPersonNumber(personNumber),
    careOf: address?.co ?? undefined,
    country: address?.country ?? undefined,
  };
};

@Controller()
export class CitizenController {
  private apiService = new ApiService();
  private apiBase = getApiBase('citizen');

  @Get('/citizen/person/:personNumber')
  @OpenAPI({ summary: 'Get stakeholder using personNumber' })
  @UseBefore(authMiddleware)
  async getErrand(@Req() req: RequestWithUser, @Param('personNumber') personNumber: string): Promise<StakeholderDTO | null> {
    const personIdUrl = `${this.apiBase}/${MUNICIPALITY_ID}/${personNumber}/guid/`;

    try {
      const personNumberRes = await this.apiService.get<string>({ url: personIdUrl }, req);
      const personInformationUrl = `${this.apiBase}/${MUNICIPALITY_ID}/${personNumberRes.data}`;
      const res = await this.apiService.get<CitizenExtended>({ url: personInformationUrl }, req);
      if (!res.data) throw new HttpException(500, 'No data from API');
      if (!res.data.addresses?.[0]) throw new HttpException(500, 'No address data from API');

      return toStakeholder(res.data, personNumber, res.data.personId);
    } catch {
      return null;
    }
  }

  // The session already holds the party id, so no guid lookup: the citizen can only ever
  // resolve themself here. A missing address is not an error; the citizen fills it in.
  @Get('/citizen/me')
  @OpenAPI({ summary: 'Get the logged in citizen as a stakeholder' })
  @UseBefore(authMiddleware)
  async getMe(@Req() req: RequestWithUser): Promise<StakeholderDTO> {
    const { partyId, personNumber } = req.user;
    const res = await this.apiService.get<CitizenExtended>({ url: `${this.apiBase}/${MUNICIPALITY_ID}/${partyId}` }, req);
    if (!res.data) throw new HttpException(502, 'No data from Citizen API');

    return toStakeholder(res.data, personNumber, partyId);
  }
}
