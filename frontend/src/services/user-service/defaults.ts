import { User } from '@data-contracts/backend/data-contracts';
import { ApiResponse } from '@services/api-service';

export const emptyUser: User = {
  name: '',
  initials: '',
};

export const emptyUserResponse: ApiResponse<User> = {
  data: emptyUser,
  message: 'none',
};
