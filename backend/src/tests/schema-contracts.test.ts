import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { SchemaController } from '@/controllers/schema.controller';
import { HttpException } from '@/exceptions/HttpException';
import { SchemaResponseDTO } from '@/responses/schema.response';
import ApiService from '@/services/api.service';
import { logger } from '@/utils/logger';

vi.mock('@/middlewares/auth.middleware', () => ({
  default: (req: Request, _res: Response, next: NextFunction) => {
    Object.defineProperty(req, 'user', {
      configurable: true,
      value: {
        name: 'Test User',
        givenName: 'Test',
        surname: 'User',
      },
    });
    next();
  },
}));

const app = new App([SchemaController]).getServer();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('JSON schema adapter contracts', () => {
  it('returns the immutable requested ID and typed schema response for an exact version', async () => {
    const getSpy = vi
      .spyOn(ApiService.prototype, 'get')
      .mockResolvedValueOnce({ data: { id: 'schema-v1', value: { type: 'object' } }, message: 'success' })
      .mockResolvedValueOnce({ data: { value: { 'ui:order': ['name'] } }, message: 'success' });

    const response = await request(app).get('/api/schemas/schema-v1').expect(200);

    expect(response.body).toEqual({
      schema: { type: 'object' },
      uiSchema: { 'ui:order': ['name'] },
      schemaId: 'schema-v1',
    });
    expect(getSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ url: '2281/schemas/schema-v1' }));
  });

  it('fails closed when the exact endpoint returns a different schema ID', async () => {
    vi.spyOn(ApiService.prototype, 'get').mockResolvedValue({
      data: { id: 'different-id', value: { type: 'object' } },
      message: 'success',
    });

    const response = await request(app).get('/api/schemas/schema-v1').expect(502);

    expect(response.body).toEqual({ message: 'Invalid JSON schema response: schema id does not match request' });
  });

  it('fails closed when the exact endpoint omits its schema ID', async () => {
    vi.spyOn(ApiService.prototype, 'get').mockResolvedValue({
      data: { value: { type: 'object' } },
      message: 'success',
    });

    const response = await request(app).get('/api/schemas/schema-v1').expect(502);

    expect(response.body).toEqual({ message: 'Invalid JSON schema response: missing schema id' });
  });

  it('returns the upstream immutable ID for a latest schema and uses it for UI schema lookup', async () => {
    const getSpy = vi
      .spyOn(ApiService.prototype, 'get')
      .mockResolvedValueOnce({ data: { id: 'latest-schema-v2', value: { type: 'object' } }, message: 'success' })
      .mockResolvedValueOnce({ data: { value: {} }, message: 'success' });

    const response = await request(app).get('/api/schemas/latest/schema-name').expect(200);

    expect(response.body).toEqual({ schema: { type: 'object' }, uiSchema: {}, schemaId: 'latest-schema-v2' });
    expect(getSpy.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ url: '2281/schemas/latest-schema-v2/ui-schema' }));
  });

  it.each([
    [{ value: { type: 'object' } }, 'Invalid JSON schema response: missing schema id'],
    [{ id: 'schema-v1' }, 'Invalid JSON schema response: missing schema definition'],
    [{ id: 'schema-v1', value: [] }, 'Invalid JSON schema response: missing schema definition'],
    [undefined, 'Invalid JSON schema response: missing schema definition'],
  ])('fails closed when latest schema payload is malformed', async (schema, message) => {
    vi.spyOn(ApiService.prototype, 'get').mockResolvedValue({ data: schema, message: 'success' });

    const response = await request(app).get('/api/schemas/latest/schema-name').expect(502);

    expect(response.body).toEqual({ message });
  });

  it('preserves typed upstream schema errors', async () => {
    vi.spyOn(ApiService.prototype, 'get').mockRejectedValue(new HttpException(404, 'Not found'));

    const response = await request(app).get('/api/schemas/schema-v1').expect(404);

    expect(response.body).toEqual({ message: 'Not found' });
  });

  it('treats a missing UI schema (404) as optional without hiding the JSON schema', async () => {
    vi.spyOn(ApiService.prototype, 'get')
      .mockResolvedValueOnce({ data: { id: 'schema-v1', value: { type: 'object' } }, message: 'success' })
      .mockRejectedValueOnce(new HttpException(404, 'Not found'));

    const response = await request(app).get('/api/schemas/latest/schema-name').expect(200);

    expect(response.body).toEqual({ schema: { type: 'object' }, uiSchema: {}, schemaId: 'schema-v1' });
  });

  it('fails closed on a malformed UI schema instead of silently dropping its sections', async () => {
    vi.spyOn(ApiService.prototype, 'get')
      .mockResolvedValueOnce({ data: { id: 'schema-v1', value: { type: 'object' } }, message: 'success' })
      .mockResolvedValueOnce({ data: { value: [] }, message: 'success' });

    const response = await request(app).get('/api/schemas/latest/schema-name').expect(502);

    expect(response.body).toEqual({ message: 'Invalid UI schema response: missing schema definition' });
  });

  it('fails closed when the UI schema fetch errors instead of rendering without sections', async () => {
    vi.spyOn(ApiService.prototype, 'get')
      .mockResolvedValueOnce({ data: { id: 'schema-v1', value: { type: 'object' } }, message: 'success' })
      .mockRejectedValueOnce(new HttpException(500, 'Internal server error from gateway'));

    await request(app).get('/api/schemas/latest/schema-name').expect(500);
  });

  it('passes typed name and version through when upstream provides them', async () => {
    vi.spyOn(ApiService.prototype, 'get')
      .mockResolvedValueOnce({ data: { id: 'schema-v1', name: 'schema-name', version: '1.3', value: { type: 'object' } }, message: 'success' })
      .mockRejectedValueOnce(new HttpException(404, 'Not found'));

    const response = await request(app).get('/api/schemas/latest/schema-name').expect(200);
    const body = response.body as SchemaResponseDTO;

    expect(body.name).toBe('schema-name');
    expect(body.version).toBe('1.3');
  });

  describe('language', () => {
    const localizedUiSchema = {
      'ui:title': 'Plats och händelseförlopp',
      'x-i18n': { en: { 'ui:title': 'Location and sequence of events' } },
      eventTime: {
        'ui:widget': 'time',
        'ui:title': 'Tid',
        'x-i18n': { en: { 'ui:title': 'Time' } },
      },
    };

    const mockUpstream = () =>
      vi
        .spyOn(ApiService.prototype, 'get')
        .mockResolvedValueOnce({
          data: { id: 'schema-v1', value: { type: 'object', title: 'Plats och händelseförlopp' } },
          message: 'success',
        })
        .mockResolvedValueOnce({ data: { value: localizedUiSchema }, message: 'success' });

    it('serves the requested language and never exposes the translation block', async () => {
      mockUpstream();

      const response = await request(app).get('/api/schemas/schema-v1').set('Accept-Language', 'en').expect(200);
      const body = response.body as SchemaResponseDTO;

      expect(body.uiSchema).toEqual({
        'ui:title': 'Location and sequence of events',
        eventTime: { 'ui:widget': 'time', 'ui:title': 'Time' },
      });
      // The title names the form in the error summary. It lives in the JSON schema, which only
      // changes with a new version, so it is read from the ui schema root instead.
      expect(body.schema).toEqual({ type: 'object', title: 'Location and sequence of events' });
      expect(JSON.stringify(body)).not.toContain('x-i18n');
    });

    it('falls back to Swedish when no language is requested', async () => {
      mockUpstream();

      const response = await request(app).get('/api/schemas/schema-v1').expect(200);
      const body = response.body as SchemaResponseDTO;

      expect(body.uiSchema).toEqual({
        'ui:title': 'Plats och händelseförlopp',
        eventTime: { 'ui:widget': 'time', 'ui:title': 'Tid' },
      });
      expect(body.schema).toEqual({ type: 'object', title: 'Plats och händelseförlopp' });
      expect(JSON.stringify(body)).not.toContain('x-i18n');
    });

    it('applies the same resolution to the latest-version route', async () => {
      mockUpstream();

      const response = await request(app).get('/api/schemas/latest/avvikelse-plats-handelse').set('Accept-Language', 'en-GB,en;q=0.9').expect(200);
      const body = response.body as SchemaResponseDTO;
      const eventTime = body.uiSchema.eventTime as Record<string, unknown>;

      expect(eventTime['ui:title']).toBe('Time');
      expect(body.schemaId).toBe('schema-v1');
    });
  });
  // The generator that once refused to emit these is retired; the adapter is the guard now.
  describe('authoring contract', () => {
    const upstream = (value: Record<string, unknown>) =>
      vi
        .spyOn(ApiService.prototype, 'get')
        .mockResolvedValueOnce({ data: { id: 'schema-v1', value }, message: 'success' })
        .mockRejectedValueOnce(new HttpException(404, 'Not found'));

    it('rejects a schema declaring another dialect', async () => {
      upstream({ $schema: 'http://json-schema.org/draft-07/schema#', type: 'object' });

      const response = await request(app).get('/api/schemas/schema-v1').expect(502);

      expect((response.body as { message: string }).message).toContain('dialect must be draft 2020-12');
    });

    it('rejects a condition reading a property the schema lacks', async () => {
      upstream({
        type: 'object',
        properties: { shown: { type: 'string' } },
        allOf: [{ if: { properties: { ghost: { const: 'JA' } }, required: ['ghost'] }, then: { required: ['shown'] } }],
      });

      const response = await request(app).get('/api/schemas/schema-v1').expect(502);

      expect((response.body as { message: string }).message).toContain("refers to missing property 'ghost'");
    });

    it('rejects a condition revealing a property the schema lacks', async () => {
      upstream({
        type: 'object',
        properties: { source: { type: 'string' } },
        allOf: [{ if: { properties: { source: { const: 'JA' } }, required: ['source'] }, then: { properties: { ghost: true } } }],
      });

      const response = await request(app).get('/api/schemas/schema-v1').expect(502);

      expect((response.body as { message: string }).message).toContain("reveals missing property 'ghost'");
    });

    it('rejects a condition in a nested object reading a property that object lacks', async () => {
      upstream({
        type: 'object',
        properties: {
          block: {
            type: 'object',
            properties: { shown: { type: 'string' } },
            allOf: [{ if: { properties: { ghost: { const: 'JA' } }, required: ['ghost'] }, then: { required: ['shown'] } }],
          },
        },
      });

      const response = await request(app).get('/api/schemas/schema-v1').expect(502);

      expect((response.body as { message: string }).message).toContain("condition at 'block' refers to missing property 'ghost'");
    });

    it('rejects a bilaga gated on a property the schema lacks', async () => {
      upstream({
        type: 'object',
        properties: { source: { type: 'string' } },
        'x-attachments': [{ key: 'bevis', label: 'Bevis', requiredWhen: { properties: { ghost: { const: 'JA' } }, required: ['ghost'] } }],
      });

      const response = await request(app).get('/api/schemas/schema-v1').expect(502);

      expect((response.body as { message: string }).message).toContain("bilaga 'bevis' is gated on missing property 'ghost'");
    });

    it('serves a bilaga that is always required', async () => {
      upstream({
        type: 'object',
        properties: { source: { type: 'string' } },
        'x-attachments': [{ key: 'BUDGET', label: 'Budget', requiredWhen: {} }],
      });

      await request(app).get('/api/schemas/schema-v1').expect(200);
    });

    it('serves a schema with an unsupported condition keyword but logs the gap', async () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      upstream({
        type: 'object',
        properties: { source: { type: 'string' }, shown: { type: 'string' } },
        allOf: [{ if: { properties: { source: { pattern: '^JA$' } }, required: ['source'] }, then: { required: ['shown'] } }],
      });

      await request(app).get('/api/schemas/schema-v1').expect(200);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("condition keyword 'pattern' is not understood"));
    });

    it('serves a schema with a malformed x-attachments entry but logs the drop', async () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      upstream({
        type: 'object',
        properties: { source: { type: 'string' } },
        'x-attachments': [{ key: 'bevis' }],
      });

      await request(app).get('/api/schemas/schema-v1').expect(200);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('malformed x-attachments entry'));
    });

    it('rejects a stop gated on a property the schema lacks', async () => {
      upstream({
        type: 'object',
        properties: { source: { type: 'string' } },
        'x-stops': [{ when: { properties: { ghost: { const: 'NEJ' } }, required: ['ghost'] }, text: 'Stopp' }],
      });

      const response = await request(app).get('/api/schemas/schema-v1').expect(502);

      expect((response.body as { message: string }).message).toContain("a stop is gated on missing property 'ghost'");
    });

    it('serves a stop on a root property', async () => {
      upstream({
        type: 'object',
        properties: { source: { type: 'string' } },
        'x-stops': [{ when: { properties: { source: { const: 'NEJ' } }, required: ['source'] }, text: 'Stopp' }],
      });

      await request(app).get('/api/schemas/schema-v1').expect(200);
    });

    it('serves a schema with a malformed x-stops entry but logs the drop', async () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      upstream({
        type: 'object',
        properties: { source: { type: 'string' } },
        'x-stops': [{ when: { properties: { source: { const: 'NEJ' } } }, text: 'Stopp' }],
      });

      await request(app).get('/api/schemas/schema-v1').expect(200);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('malformed x-stops entry'));
    });
  });
});
