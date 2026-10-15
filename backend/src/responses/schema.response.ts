import { IsObject, IsOptional, IsString } from 'class-validator';

export class SchemaResponseDTO {
  @IsObject()
  schema!: Record<string, unknown>;

  @IsObject()
  uiSchema!: Record<string, unknown>;

  @IsString()
  schemaId!: string;

  // The localization contract forbids parsing name or version out of the schema ID, so the
  // adapter passes them through typed when upstream provides them.
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  version?: string;
}
