import authMiddleware from '@middlewares/auth.middleware';
import { Response } from 'express';
import { Controller, Get, Req, Res, UseBefore } from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';

import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces/auth.interface';
import { ClientUser } from '@/interfaces/users.interface';
import { UserApiResponse } from '@/responses/user.response';

@Controller()
export class UserController {
  @Get('/me')
  @OpenAPI({
    summary: 'Return current user',
  })
  @ResponseSchema(UserApiResponse)
  @UseBefore(authMiddleware)
  getUser(@Req() req: RequestWithUser, @Res() response: Response): Response {
    const { name, firstName, lastName } = req.user;

    if (!name) {
      throw new HttpException(400, 'Bad Request');
    }

    const initials = firstName.charAt(0).toUpperCase() + lastName.charAt(0).toUpperCase();

    const userData: ClientUser = {
      name: name,
      initials: initials,
    };

    return response.send({ data: userData, message: 'success' });
  }
}
