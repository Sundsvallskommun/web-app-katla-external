import { APIS } from '@config';
import { Controller, Get } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';

import { HttpException } from '@/exceptions/HttpException';
import { Public } from '@/middlewares/public.decorator';
import ApiService, { NO_SESSION_SENDER } from '@/services/api.service';
import { logger } from '@/utils/logger';

@Controller()
export class HealthController {
  private apiService = new ApiService();
  public api = APIS.find(x => x.name === 'simulatorserver');

  @Get('/health/up')
  @OpenAPI({ summary: 'Return health check' })
  @Public('Liveness probe - polled by infrastructure without a session')
  async up(): Promise<{ status: string } | undefined> {
    if (!this.api) {
      throw new HttpException(500, 'Health check API is not configured');
    }
    const url = `${this.api.name}/${this.api.version}/simulations/response?status=200%20OK`;
    const data = {
      status: 'OK',
    };
    try {
      const res = await this.apiService.post<{ status: string }>({ url, data }, NO_SESSION_SENDER);
      return res.data;
    } catch (e) {
      logger.error('Error when doing health check:', e);
      return undefined;
    }
  }
}
