import validateEnv from '@utils/validateEnv';

import App from '@/app';
import { CONTROLLERS } from '@/controllers';
import { createSessionStore } from '@/utils/session-store';

validateEnv();

void (async () => {
  const sessionStore = await createSessionStore();
  const app = new App(CONTROLLERS, sessionStore);
  app.listen();
})();
