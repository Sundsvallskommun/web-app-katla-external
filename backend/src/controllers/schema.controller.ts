import { Controller, Get, Param, Req, UseBefore } from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';

import { MUNICIPALITY_ID } from '@/config';
import { getApiBase } from '@/config/api-config';
import { JsonSchema, UiSchema } from '@/data-contracts/jsonschema/data-contracts';
import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces/auth.interface';
import authMiddleware from '@/middlewares/auth.middleware';
import { SchemaResponseDTO } from '@/responses/schema.response';
import ApiService from '@/services/api.service';
import { logger } from '@/utils/logger';
import { applyUiSchemaTitleToSchema, localeFromAcceptLanguage, localizeUiSchema } from '@/utils/schema-localization';
import { mapSchemaResponse, mapUiSchema } from '@/utils/schema-response-mapping';
import { apiURL } from '@/utils/util';

@Controller()
export class SchemaController {
  private apiService = new ApiService();
  private apiBase = getApiBase('jsonschema');

  /**
   * The ui schema stores its translations in x-i18n blocks. They are resolved here so the
   * frontend gets finished text for the requested locale and never sees the other languages.
   */
  private async fetchUiSchema(schemaId: string, req: RequestWithUser, locale: string): Promise<Record<string, unknown>> {
    try {
      const uiRes = await this.apiService.get<UiSchema>(
        {
          baseURL: apiURL(this.apiBase),
          url: `${MUNICIPALITY_ID}/schemas/${schemaId}/ui-schema`,
        },
        req,
      );
      return localizeUiSchema(mapUiSchema(uiRes.data), locale);
    } catch (error) {
      // Only a missing ui schema is optional. Anything else — upstream failure, malformed body —
      // must not silently render the form without sections and widgets.
      if (error instanceof HttpException && error.status === 404) {
        logger.info(`No UI schema found for ${schemaId}, using empty object`);
        return {};
      }
      throw error;
    }
  }

  @Get('/schemas/:schemaId')
  @OpenAPI({ summary: 'Get a JSON schema by immutable schema ID' })
  @UseBefore(authMiddleware)
  @ResponseSchema(SchemaResponseDTO)
  async getSchemaById(@Param('schemaId') schemaId: string, @Req() req: RequestWithUser): Promise<SchemaResponseDTO> {
    const locale = localeFromAcceptLanguage(req.headers['accept-language']);
    const schema = (
      await this.apiService.get<JsonSchema>(
        {
          baseURL: apiURL(this.apiBase),
          url: `${MUNICIPALITY_ID}/schemas/${schemaId}`,
        },
        req,
      )
    ).data;

    const result = mapSchemaResponse(schema, schemaId);
    const uiSchema = await this.fetchUiSchema(result.schemaId, req, locale);

    return {
      schema: applyUiSchemaTitleToSchema(result.schema, uiSchema),
      schemaId: result.schemaId,
      name: result.name,
      version: result.version,
      uiSchema,
    };
  }

  @Get('/schemas/latest/:schemaName')
  @OpenAPI({ summary: 'Get the latest version of a named JSON schema' })
  @UseBefore(authMiddleware)
  @ResponseSchema(SchemaResponseDTO)
  async getLatestSchema(@Param('schemaName') schemaName: string, @Req() req: RequestWithUser): Promise<SchemaResponseDTO> {
    const locale = localeFromAcceptLanguage(req.headers['accept-language']);
    const latest = (
      await this.apiService.get<JsonSchema>(
        {
          baseURL: apiURL(this.apiBase),
          url: `${MUNICIPALITY_ID}/schemas/${schemaName}/versions/latest`,
        },
        req,
      )
    ).data;

    const result = mapSchemaResponse(latest);
    const uiSchema = await this.fetchUiSchema(result.schemaId, req, locale);

    return {
      schema: applyUiSchemaTitleToSchema(result.schema, uiSchema),
      schemaId: result.schemaId,
      name: result.name,
      version: result.version,
      uiSchema,
    };
  }
}
