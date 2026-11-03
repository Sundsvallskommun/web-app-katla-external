import type { RJSFSchema } from '@rjsf/utils';
import { describe, expect, it } from 'vitest';

import {
  getFormSchemaValidator,
  getJsonValueSchemaValidator,
} from '../../../../src/components/json/schema/form-schema-validator';

describe('formSchemaValidator', () => {
  it('validates draft 2020-12 keywords', () => {
    const formSchemaValidator = getFormSchemaValidator('draft-2020-12-schema-v1');
    const schema: RJSFSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        email: { type: 'string' },
        phone: { type: 'string' },
      },
      dependentRequired: {
        email: ['phone'],
      },
    };

    expect(formSchemaValidator.validateFormData({ email: 'person@example.com' }, schema).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'dependentRequired' })])
    );
    expect(
      // 0701740635 is a mock phone number from PTS, not a real number
      formSchemaValidator.validateFormData({ email: 'person@example.com', phone: '0701740635' }, schema).errors
    ).toEqual([]);
  });

  it('keeps HTML-aware text length validation', () => {
    const formSchemaValidator = getFormSchemaValidator('html-length-schema-v1');
    const schema: RJSFSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        description: { type: 'string', minLength: 3 },
      },
    };

    expect(formSchemaValidator.validateFormData({ description: '<b>ab</b>' }, schema).errors).toHaveLength(1);
    expect(formSchemaValidator.validateFormData({ description: '<b>abc</b>' }, schema).errors).toEqual([]);
  });

  it.each([
    ['string first', 'same-document-id-string-first-v1', 'same-document-id-string-first-v2', true],
    ['number first', 'same-document-id-number-first-v1', 'same-document-id-number-first-v2', false],
  ])(
    'isolates exact Katla schema versions that share a JSON Schema $id (%s)',
    (_case, firstId, secondId, stringFirst) => {
      const sharedDocumentId = `urn:katla:${_case.replaceAll(' ', '-')}`;
      const stringSchema: RJSFSchema = {
        $id: sharedDocumentId,
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'string',
      };
      const numberSchema: RJSFSchema = {
        $id: sharedDocumentId,
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'number',
      };
      const firstSchema = stringFirst ? stringSchema : numberSchema;
      const secondSchema = stringFirst ? numberSchema : stringSchema;
      const firstValue = stringFirst ? 'valid string' : 42;
      const secondValidValue = stringFirst ? 42 : 'valid string';
      const secondInvalidValue = stringFirst ? 'not a number' : 42;

      expect(getJsonValueSchemaValidator(firstId).validateFormData(firstValue, firstSchema).errors).toEqual([]);
      expect(getJsonValueSchemaValidator(secondId).validateFormData(secondValidValue, secondSchema).errors).toEqual([]);
      expect(
        getJsonValueSchemaValidator(secondId).validateFormData(secondInvalidValue, secondSchema).errors
      ).not.toEqual([]);
    }
  );
});
