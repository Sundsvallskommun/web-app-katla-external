import { CitizenController } from './controllers/citizen.controller';
import { HealthController } from './controllers/health.controller';
import { IndexController } from './controllers/index.controller';
import { LegalEntityController } from './controllers/legal-entity.controller';
import { SchemaController } from './controllers/schema.controller';
import { SupportManagementController } from './controllers/supportmanagement.controller';
import { SupportManagementAttachmentController } from './controllers/supportmanagement-attachment.controller';
import { UserController } from './controllers/user.controller';

export const CONTROLLERS = [
  IndexController,
  UserController,
  HealthController,
  SupportManagementController,
  SupportManagementAttachmentController,
  CitizenController,
  SchemaController,
  LegalEntityController,
];
