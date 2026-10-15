import { Type } from 'class-transformer';
import { IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

import { ErrandAttachment, ErrandAttachmentPurpose } from '@/data-contracts/support-management-alkt-sprint/data-contracts';

export class ErrandAttachmentPurposeDTO implements ErrandAttachmentPurpose {
  @IsOptional()
  @IsString()
  id?: string;
  /** The schema's attachment key, which is what the frontend files and validates against. */
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @IsString()
  displayName?: string;
}

export class ErrandAttachmentDTO implements ErrandAttachment {
  @IsString()
  id!: string;
  @IsString()
  fileName!: string;
  @IsOptional()
  @IsString()
  mimeType?: string;
  @IsOptional()
  @IsString()
  created?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => ErrandAttachmentPurposeDTO)
  purpose?: ErrandAttachmentPurposeDTO;
}

export class CreateErrandAttachmentDTO {
  /** The bilagetyp the citizen picked: the schema's attachment key, named as a purpose upstream. */
  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateErrandAttachmentDTO {
  @IsString()
  @MinLength(1)
  category!: string;
}
