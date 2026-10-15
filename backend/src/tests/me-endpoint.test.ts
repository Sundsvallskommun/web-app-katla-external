// /me is the one user payload the browser gets. It carries a display name, never the party id:
// that is the identity upstream keys errands and stakeholders on.

import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { UserController } from '@/controllers/user.controller';

import { mockCitizenPartyId, mockFirstName, mockLastName, mockPersonNumber } from './helpers/mock-data';

vi.mock('@/middlewares/auth.middleware', () => ({
  default: (req: Request, _res: Response, next: NextFunction) => {
    Object.defineProperty(req, 'user', {
      configurable: true,
      value: {
        partyId: mockCitizenPartyId,
        personNumber: mockPersonNumber,
        name: `${mockFirstName} ${mockLastName}`,
        firstName: mockFirstName,
        lastName: mockLastName,
      },
    });
    next();
  },
}));

const app = new App([UserController]).getServer();

describe('GET /me', () => {
  it('returns the display name and initials', async () => {
    const response = await request(app).get('/api/me').expect(200);

    expect(response.body).toEqual({
      data: { name: `${mockFirstName} ${mockLastName}`, initials: 'AA' },
      message: 'success',
    });
  });

  it('never sends the party id or person number to the browser', async () => {
    const response = await request(app).get('/api/me').expect(200);

    expect(response.text).not.toContain(mockCitizenPartyId);
    expect(response.text).not.toContain(mockPersonNumber);
  });
});
