import { HttpException } from '@/exceptions/HttpException';
import { SchemaResponseDTO } from '@/responses/schema.response';
import { assertSchemaContract } from '@/utils/schema-contract';

const requireIdentifier = (value: unknown, context: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpException(502, `Invalid ${context}: missing schema id`);
  }
  return value;
};

const requireObject = (value: unknown, context: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpException(502, `Invalid ${context}: missing schema definition`);
  }
  return value as Record<string, unknown>;
};

export const mapSchemaResponse = (schema: unknown, requestedSchemaId?: string): SchemaResponseDTO => {
  const schemaPayload = requireObject(schema, 'JSON schema response');
  const responseSchemaId = requireIdentifier(schemaPayload.id, 'JSON schema response');

  if (requestedSchemaId !== undefined && responseSchemaId !== requestedSchemaId) {
    throw new HttpException(502, 'Invalid JSON schema response: schema id does not match request');
  }

  const schemaValue = requireObject(schemaPayload.value, 'JSON schema response');
  assertSchemaContract(schemaValue, responseSchemaId);

  return {
    schema: schemaValue,
    uiSchema: {},
    schemaId: responseSchemaId,
    name: typeof schemaPayload.name === 'string' ? schemaPayload.name : undefined,
    version: typeof schemaPayload.version === 'string' ? schemaPayload.version : undefined,
  };
};

export const mapUiSchema = (uiSchema: unknown): Record<string, unknown> => {
  const uiSchemaPayload = requireObject(uiSchema, 'UI schema response');
  return requireObject(uiSchemaPayload.value, 'UI schema response');
};
