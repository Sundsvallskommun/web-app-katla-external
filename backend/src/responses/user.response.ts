import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';

import ApiResponse from '@/interfaces/api-service.interface';
import { ClientUser } from '@/interfaces/users.interface';

export class User implements ClientUser {
  @IsString()
  name!: string;
  @IsString()
  initials!: string;
}

export class UserApiResponse implements ApiResponse<User> {
  @ValidateNested()
  @Type(() => User)
  data!: User;
  @IsString()
  message!: string;
}
