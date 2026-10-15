import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Dev-servern läser .env via Next, så konfigurationen måste läsa samma fil för att
// baseURL och funktionsflaggorna nedan ska beskriva appen som faktiskt testas.
// dotenv skriver inte över redan satta variabler, så CI:s explicita värden vinner.
dotenv.config({ path: '.env', quiet: true });

const PORT = process.env.PORT || '3000';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Runs the suite against a server that is already up instead of starting one, e.g. a dev server
// on another host. The only way in where `next dev` cannot start locally: on a Windows-mounted
// working copy it fails to acquire its lockfile, which takes the webServer block with it.
const EXTERNAL_BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, '');

// appUrl() appends paths to baseURL, so a base path missing here turns every navigation into a
// 404 that reads as the app being broken rather than as the URL being wrong.
if (EXTERNAL_BASE_URL && BASE_PATH && !EXTERNAL_BASE_URL.endsWith(BASE_PATH)) {
  throw new Error(
    `PLAYWRIGHT_BASE_URL must end with the base path ${BASE_PATH}, for example http://dev.test:3100${BASE_PATH}.`
  );
}

// appconfig läser flaggan som strikt === 'true', så ett utelämnat värde är inte
// neutralt — det stänger av funktionen. Att bara avvisa 'false' släppte därför
// igenom en oansatt variabel, och de tre scenarier som använder Övriga parter
// föll på element som aldrig renderats i stället för på ett begripligt fel.
if (process.env.NEXT_PUBLIC_OTHER_PARTIES_DISCLOSURE !== 'true') {
  throw new Error(
    'Playwright requires NEXT_PUBLIC_OTHER_PARTIES_DISCLOSURE=true because the registration scenarios exercise other stakeholders. Add it to frontend/.env (the dev server reads the same file).'
  );
}

if (process.env.NEXT_PUBLIC_REDUCED_STAKEHOLDER_INFO === 'true') {
  throw new Error(
    'Playwright requires NEXT_PUBLIC_REDUCED_STAKEHOLDER_INFO=false because the registration scenarios exercise stakeholder contact fields.'
  );
}

if (process.env.NEXT_PUBLIC_DRAFT_ERRAND !== 'true') {
  throw new Error(
    'Playwright requires NEXT_PUBLIC_DRAFT_ERRAND=true because the attachment scenarios save the errand as a draft.'
  );
}

export default defineConfig({
  testDir: './e2e/tests',
  // Checks that the target is actually usable before any spec runs; see the file for why.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Sviten kör mot en enda dev-server som kompilerar on demand. Parallella
  // workers får den att kompilera flera routes samtidigt, och de tyngsta
  // registrera-scenarierna föll då ungefär var tredje körning utan att koden
  // hade ändrats. En worker kostar ~9 sekunder och gör lokala körningar
  // deterministiska och identiska med CI.
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'on-failure' }]],
  timeout: 60_000,
  use: {
    baseURL: EXTERNAL_BASE_URL ?? `http://localhost:${PORT}${BASE_PATH}`,
    // Missing or covered controls should fail quickly instead of consuming the full test timeout.
    actionTimeout: 10_000,
    // Projektet använder data-cy-attribut som testselektorer
    testIdAttribute: 'data-cy',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Motsvarar Cypress viewport "macbook-16"
        viewport: { width: 1536, height: 960 },
      },
    },
  ],
  // Nothing to start when PLAYWRIGHT_BASE_URL names a server that is already running.
  webServer:
    EXTERNAL_BASE_URL ? undefined : (
      {
        // Produktionsbygget använder Nexts standalone-output, som inte kan startas med `next start`.
        // CI verifierar bygget separat; Playwright använder den befintliga dev-servern som testharness.
        command: 'yarn dev',
        url: `http://localhost:${PORT}${BASE_PATH}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    ),
});
