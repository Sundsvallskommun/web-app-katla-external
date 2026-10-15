# Sundsvalls Kommun Katla alkohol- och tobakstillstånd

## APIer som används

Dessa APIer används i projektet, applikationsanvändaren i WSO2 måste prenumerera på dessa.

Källan är `backend/src/config/api-config.ts` — tabellen nedan speglar den.

| API                           | Version |
| ----------------------------- | ------: |
| SimulatorServer               |     2.0 |
| SupportManagement             |    15.2 |
| support-management-alkt-sprint |    15.3 |
| Citizen                       |     3.0 |
| LegalEntity                   |     2.0 |
| JsonSchema                    |     1.0 |


## Utveckling

### Krav

- Node 22.18.0 (använd den pinnade versionen i `.nvmrc`; `package.json` anger det stödda intervallet)
- Yarn

### Steg för steg

1. Klona ner repot.

```
git clone git@github.com:Sundsvallskommun/web-app-katla-aot.git
```

2. Installera dependencies för både `backend` och `frontend`

```
cd frontend
yarn install

cd backend
yarn install
```

3. Skapa .env-fil för `frontend`

```
cd frontend
cp .env-example .env
```

Redigera `.env` vid behov.

4. Skapa .env-fil för `backend`

```
cd backend
cp .env.example.local .env.development.local
```

redigera `.env.development.local` för behov. URLer, nycklar och cert behöver fyllas i korrekt.

- `CLIENT_KEY` och `CLIENT_SECRET` måste fyllas i för att APIerna ska fungera, du måste ha en applikation från WSO2-portalen som abonnerar på de microtjänster du anropar
- `SAML_ENTRY_SSO` behöver pekas till en SAML IDP
- `SAML_LOGOUT_URL` behöver pekas till IDPens Single Logout-endpoint, annars loggar "Logga ut" bara ut från appen och IDPen loggar in användaren igen direkt
- `SAML_IDP_PUBLIC_CERT` ska stämma överens med IDPens cert
- `SAML_PRIVATE_KEY` och `SAML_PUBLIC_KEY` behöver bara fyllas i korrekt om man kör mot en riktig IDP

## Tester

### Frontend (`cd frontend`)

Enhetstester körs med [Vitest](https://vitest.dev):

```
yarn test              # kör en gång
yarn test:watch        # watch-läge
yarn test:coverage     # med kodtäckning
```

E2e-tester körs med [Playwright](https://playwright.dev). Första gången behöver webbläsaren installeras:

```
yarn playwright install chromium
```

Testerna körs mot en produktionsbyggd app (Playwright startar servern själv), alternativt mot en redan startad dev-server:

```
yarn build && yarn e2e     # bygg och kör headless
yarn e2e:ui                # interaktivt UI-läge
```

Obs: e2e-testerna förutsätter att `NEXT_PUBLIC_OTHER_PARTIES_DISCLOSURE=true` och `NEXT_PUBLIC_REDUCED_STAKEHOLDER_INFO=false` är satta i `.env` vid byggtillfället (se `.github/workflows/ci.yml`).

### Backend (`cd backend`)

Tester körs med Vitest. Testmiljön sätts deterministiskt i `src/tests/setup.ts`; ingen lokal test-envfil krävs:

```
yarn test              # kör en gång
yarn test:watch        # watch-läge
```

## Lint och formatering

Båda paketen använder en strikt, typmedveten ESLint-uppsättning enligt [web-app-starter](https://github.com/Sundsvallskommun/web-app-starter) (typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`, `simple-import-sort`, `unused-imports`, `no-console`). Inline `eslint-disable`-kommentarer är avstängda — åtgärda koden i stället.

```
yarn lint              # lint
yarn lint:fix          # lint med autofix
yarn lint:strict       # som CI: 0 varningar tillåtna
yarn format            # prettier --write
yarn format:check      # som CI: verifiera formatering
```

## Git-hooks och verifiering

Rotens `package.json` installerar [husky](https://typicode.github.io/husky/)-hooks. Kör `yarn install` i roten en gång (i samma miljö som du committar från).

- **pre-commit**: stoppar `console.log`, möjliga personnummer och telefonnummer i stage:ade ändringar och kör prettier + eslint på stage:ade filer (`.lintstagedrc.mjs`). Kända testvärden läggs i `.husky/pii-allowlist.txt`.
- **commit-msg**: commit-meddelanden ska följa [Conventional Commits](https://www.conventionalcommits.org/) (`commitlint.config.js`).
- **pre-push**: strikt lint och formatkontroll för båda paketen.

```
yarn verify            # typkontroll, strikt lint, formatkontroll och enhetstester för båda paketen
```

## CI

GitHub Actions-flödet i `.github/workflows/ci.yml` kör strikt lint, formatkontroll, type-check och enhetstester för både frontend och backend samt Playwright e2e-tester vid pull requests och push till `main`/`develop`.
