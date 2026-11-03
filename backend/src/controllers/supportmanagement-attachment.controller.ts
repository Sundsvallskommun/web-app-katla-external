import { Response } from 'express';
import FormData from 'form-data';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, UploadedFiles, UseBefore } from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';

import { MUNICIPALITY_ID } from '@/config';
import { getApiBase } from '@/config/api-config';
import {
  AttachmentPurpose,
  ErrandAttachment,
  ErrandAttachmentChannelEnum,
  UpdateErrandAttachmentRequest,
} from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces/auth.interface';
import authMiddleware from '@/middlewares/auth.middleware';
import { writeRateLimit } from '@/middlewares/rate-limit.middleware';
import { CreateErrandAttachmentDTO, ErrandAttachmentDTO, UpdateErrandAttachmentDTO } from '@/responses/supportmanagement-attachment.response';
import ApiService from '@/services/api.service';
import { attachmentIdFromLocation, resolveAttachmentPurpose } from '@/utils/attachment-purposes';
import { assertDraftOwnedByUser, assertErrandOwnedByUser, assertErrandReadableByUser } from '@/utils/errand-access';
import { fetchMetadata } from '@/utils/fetch-metadata';
import { fileUploadOptions } from '@/utils/file-upload-options';
import { requireNamespace } from '@/utils/service-context';
import { apiURL } from '@/utils/util';

@Controller()
export class SupportManagementAttachmentController {
  private apiService = new ApiService();
  private apiBase = getApiBase('supportmanagement');

  private attachmentsUrl(id: string, req: RequestWithUser): string {
    return `${MUNICIPALITY_ID}/${requireNamespace(req)}/errands/${id}/attachments`;
  }

  @Get('/supportmanagement/errand/:id/attachments')
  @OpenAPI({ summary: 'List the attachments on an errand' })
  @UseBefore(authMiddleware)
  @ResponseSchema(ErrandAttachmentDTO, { isArray: true })
  async getAttachments(@Req() req: RequestWithUser, @Param('id') id: string): Promise<ErrandAttachment[]> {
    await assertErrandReadableByUser(this.apiService, this.apiBase, id, req);

    const res = await this.apiService.get<ErrandAttachment[]>({ baseURL: apiURL(this.apiBase), url: this.attachmentsUrl(id, req) }, req);

    return res.data ?? [];
  }

  @Get('/supportmanagement/errand/:id/attachments/:attachmentId')
  @OpenAPI({ summary: 'Download one attachment' })
  @UseBefore(authMiddleware)
  async getAttachment(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ): Promise<Response> {
    await assertErrandReadableByUser(this.apiService, this.apiBase, id, req);

    const res = await this.apiService.get<Buffer>(
      { baseURL: apiURL(this.apiBase), url: `${this.attachmentsUrl(id, req)}/${attachmentId}`, responseType: 'arraybuffer' },
      req,
    );

    // Served back as an opaque download: the file came from a citizen, so it must never be
    // rendered inline in the app's own origin.
    return response.setHeader('Content-Type', 'application/octet-stream').setHeader('Content-Disposition', 'attachment').send(res.data);
  }

  @Post('/supportmanagement/errand/:id/attachments')
  @HttpCode(201)
  @OpenAPI({ summary: 'Attach a file to an errand' })
  @UseBefore(authMiddleware, writeRateLimit)
  async createAttachment(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @UploadedFiles('files', { options: fileUploadOptions, required: false }) files: Express.Multer.File[],
    @Body() attachment: CreateErrandAttachmentDTO,
  ): Promise<{ message: string }> {
    // TODO
    // Ownership only: registration activates the errand before its pending bilagor are sent
    // (DRAKEN-5075 moves activation last, after which this becomes a draft check too).
    await assertErrandOwnedByUser(this.apiService, this.apiBase, id, req);
    const purpose = attachment.category === undefined ? undefined : await this.resolvePurpose(attachment.category, req);

    const file = files?.[0];
    if (!file) throw new HttpException(400, 'No file of an accepted type in the request');

    const data = new FormData();
    data.append('errandAttachment', file.buffer, { filename: file.originalname });
    data.append('channel', ErrandAttachmentChannelEnum.ESERVICE);

    const res = await this.apiService.post(
      {
        baseURL: apiURL(this.apiBase),
        url: this.attachmentsUrl(id, req),
        data,
        headers: { 'Content-Type': data.getHeaders()['content-type'] as string },
        propagateClientError: true,
        skipLocationFollow: true,
      },
      req,
    );

    if (purpose) {
      const attachmentId = attachmentIdFromLocation(res.location);
      if (!attachmentId) throw new HttpException(502, 'No attachment id in response when uploading attachment');
      await this.setPurpose(id, attachmentId, purpose, req);
    }

    return { message: 'success' };
  }

  @Patch('/supportmanagement/errand/:id/attachments/:attachmentId')
  @OpenAPI({ summary: 'Change the bilagetyp of an attachment' })
  @UseBefore(authMiddleware)
  async updateAttachment(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Body() attachment: UpdateErrandAttachmentDTO,
  ): Promise<{ message: string }> {
    await assertDraftOwnedByUser(this.apiService, this.apiBase, id, req);
    const purpose = await this.resolvePurpose(attachment.category, req);

    await this.setPurpose(id, attachmentId, purpose, req);

    return { message: 'success' };
  }

  private async resolvePurpose(category: string, req: RequestWithUser): Promise<AttachmentPurpose> {
    return resolveAttachmentPurpose(await fetchMetadata(this.apiService, this.apiBase, req), category);
  }

  private async setPurpose(id: string, attachmentId: string, purpose: AttachmentPurpose, req: RequestWithUser): Promise<void> {
    const data: UpdateErrandAttachmentRequest = { purpose: { id: purpose.id } };

    await this.apiService.patch(
      { baseURL: apiURL(this.apiBase), url: `${this.attachmentsUrl(id, req)}/${attachmentId}`, data, propagateClientError: true },
      req,
    );
  }

  @Delete('/supportmanagement/errand/:id/attachments/:attachmentId')
  @OpenAPI({ summary: 'Remove an attachment from an errand' })
  @UseBefore(authMiddleware)
  async deleteAttachment(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<{ message: string }> {
    await assertDraftOwnedByUser(this.apiService, this.apiBase, id, req);

    await this.apiService.delete(
      { baseURL: apiURL(this.apiBase), url: `${this.attachmentsUrl(id, req)}/${attachmentId}`, propagateClientError: true },
      req,
    );

    return { message: 'success' };
  }
}
