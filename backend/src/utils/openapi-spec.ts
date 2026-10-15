import { defaultMetadataStorage } from 'class-transformer/cjs/storage';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { getMetadataArgsStorage } from 'routing-controllers';
import { routingControllersToSpec } from 'routing-controllers-openapi';

import { additionalConverters } from '@/utils/custom-validation-classes';

type OpenApiSchemas = ReturnType<typeof validationMetadatasToSchemas>;
type RoutingControllersOptions = NonNullable<Parameters<typeof routingControllersToSpec>[1]>;

/**
 * Builds the JSON Schema components for the DTOs. Owned in one place so the app and the
 * contract tests can never validate against different schemas: without `additionalConverters`
 * the spec loses the nullable markings from `custom-validation-classes`.
 */
export const buildOpenApiSchemas = (): OpenApiSchemas =>
  validationMetadatasToSchemas({
    classTransformerMetadataStorage: defaultMetadataStorage,
    refPointerPrefix: '#/components/schemas/',
    additionalConverters,
  });

/** Builds the OpenAPI spec for the given controllers, using the schemas actually served. */
export const buildOpenApiSpec = (controllers: RoutingControllersOptions['controllers'], routePrefix: string): unknown =>
  routingControllersToSpec(getMetadataArgsStorage(), { routePrefix, controllers }, { components: { schemas: buildOpenApiSchemas() } });
