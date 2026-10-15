import validateEnv from '@utils/validateEnv';

import App from '@/app';
import { CONTROLLERS } from '@/controllers';

validateEnv();

const app = new App(CONTROLLERS);

app.listen();
