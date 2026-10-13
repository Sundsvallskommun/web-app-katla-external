import { Controller, Get, Param, Req, UseBefore } from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';

import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces/auth.interface';
import authMiddleware from '@/middlewares/auth.middleware';
import { MyOrganizationsDTO } from '@/responses/legal-entity.response';
import { StakeholderDTO } from '@/responses/supportmanagement.response';
import { completePrimaryStakeholders, primaryStakeholderFor } from '@/utils/primary-stakeholder';
import { requireServiceKey } from '@/utils/service-context';
import { mapStakeholderToStakeholderDTO } from '@/utils/stakeholder-mapping';

@Controller()
export class LegalEntityController {
  /**
   * Served from the session rather than read again from LegalEntity, so the organisations the
   * citizen is offered are the same ones the errand endpoints scope by. Re-reading could hand
   * back an organisation the session does not carry, and an errand filed for it would come back
   * 404 on the very next read.
   */
  @Get('/my-organizations')
  @OpenAPI({ summary: 'Organizations the logged in citizen may act for' })
  @UseBefore(authMiddleware)
  @ResponseSchema(MyOrganizationsDTO)
  myOrganizations(@Req() req: RequestWithUser): MyOrganizationsDTO {
    const organizations = req.session.representingBusinessChoices?.[requireServiceKey(req)];

    // Resolved at login. Absent means the lookup failed, which must read as a failure rather than
    // as "belongs to nothing" — the same fail-closed rule the errand endpoints apply.
    if (organizations === undefined) {
      throw new HttpException(403, 'No organizations in session');
    }

    return { organizations };
  }

  /** Preview of the organisation as errand owner; every write completes it again. */
  @Get('/my-organizations/:partyId/stakeholder')
  @OpenAPI({ summary: 'One of the citizen organizations as a primary stakeholder' })
  @UseBefore(authMiddleware)
  @ResponseSchema(StakeholderDTO)
  async ownerStakeholder(@Req() req: RequestWithUser, @Param('partyId') partyId: string): Promise<StakeholderDTO> {
    const organization = req.session.representingBusinessChoices?.[requireServiceKey(req)]?.find(
      candidate => candidate.partyId.toLowerCase() === partyId.toLowerCase(),
    );

    if (!organization) {
      throw new HttpException(404, 'Organization not found');
    }

    const [stakeholder] = (await completePrimaryStakeholders([primaryStakeholderFor(organization)], req)) ?? [];
    if (!stakeholder) throw new HttpException(500, 'Could not build the stakeholder');

    return mapStakeholderToStakeholderDTO(stakeholder);
  }
}
