# TODO

- Gör raden med "Ny ansökan Avbryt-knapp Skicka-knapp" fixed så den ligger kvar i fönstrets överkant när man scrollar.

## Open

- Bilagekategori uppströms: SupportManagements `ErrandAttachment` har ingen kategori, så
  bilagetypen väljs och valideras i klienten och följer med ner i BFF:en men släpps i det uppströms
  anropet. När fältet finns räcker det att namnge det i `UPSTREAM_CATEGORY_FIELD`
  (`backend/src/controllers/supportmanagement-attachment.controller.ts`); först då överlever typen
  en omladdning, och ett återupptaget utkast kan visa vilken bilaga som redan är inskickad.

- Generatorns skyddsnät försvinner med generatorn. `docs/jsonschemas/build-ui-schema.mjs` vägrar
  idag skriva ut ett artefaktpar som inte håller: okänt `ui:widget`-namn, en fråga som hamnar i noll
  eller flera sektioner, ett villkor som pekar på en egenskap schemat saknar, en enumkonstant som
  krockar med en annan, ett viktuttryck den inte känner igen, en post i nyckeltabellerna som inte
  matchar någon fråga. Efter lanseringen underhålls schemana direkt i jsonschema-tjänsten och
  generatorn tas bort — då finns inget byggsteg, ingen CI och ingen diff mellan en handredigering och
  medborgaren. Ersätt kontrollerna med något som körs mot ett **hämtat** schema: ett kontraktstest
  mot de publicerade schemana, eller validering i BFF:ens schemaadapter. Idag är
  `console.warn` i `frontend/src/components/json/utils/schema-conditions.ts` den enda signalen vid
  körning om ett villkor inte förstods. Behöver vara på plats före lansering, se
  `docs/aot-form-schema-plan.md` avsnitt 5.

- Kategorisering: BFF:en reducerar metadatans etikettträd till subträdet under den rot som har
  `resourcePath` `CATEGORYROOT` och klassificeringen `ROOT` (`backend/src/utils/categorization-root.ts`),
  så frontend ser kategorierna som rot. Flera rötter delar klassificeringen — `TAGROOT` för fria
  etiketter, senare kanske platser eller myndigheter — så det är sökvägen som avgör vilket träd en rot
  definierar. Roten sparas aldrig i `errand.labels`; varje etikett bär sin egen `resourcePath`.
  Trädet i `docs/label-structure.json` är nu CATEGORY → TYPE → SUBTYPE, tre nivåer, vilket är exakt
  vad renderaren klarar — en fjärde nivå ger 502 i stället för att tappa löven tyst.

- AoT-formuläret från OpenE: analys och plan i `docs/aot-form-schema-plan.md`. Schema och regler
  hör båda till flöde 2181 och matchar 1:1. Beslutat: ett schema per ärendetyp, intressenter från
  sessionsdata. Nästa steg är att be OpenE om en export där de 12 viktreglernas tröskelvärden
  följer med (de finns bara i regelnamnen idag) och att reda ut om köksblocket i cateringgrenen är
  dött. Schema och ui-schema serveras tills vidare från `backend/src/mocks/aot-schema.mock.ts`; ta
  bort mocken när de finns i jsonschema-tjänsten. Ui-schemat genereras av
  `docs/jsonschemas/build-ui-schema.mjs` — ändra generatorn, inte JSON-filen.

### Tillsyn

- Tillsyn ska hanteras lite annorlunda. Det får en egen kategori INSPECTION med under-TYPEs Tillsyn/INSPECTION och Åtgärdsärende/MEASURES. Typen av tillsyn kan sedan specificeras med fria etiketter (under rot TAG_ROOT t ex), såsom "Inre tillsyn", "Yttre tillsyn", "Alkoholtillsyn", "Tobakstillsyn". Varje INSPECTION_OR_MEASURE/MEASURE-ärende kan ha en eller flera av dessa etiketter. Så dessa fria etiketter ska finnas valbara för ärendetyp INSPECTION_OR_MEASURE/MEASURE, och åtminstone "Alkoholtillsyn" och "Tobakstillsynd" ska innebära att motsvarande schema/formulär visas. Var detta ska visas är dock en senare fråga som vi måste återvända till.
- Tillsynsärenden ska inte kunna initieras ifrån Katla. Ifrån handläggaregränssnittet i Draken, som ska använda samma labels-metadata etc, ska det däremot gå.
  - Löst via label-attributet `internalOnly=true` (DRAKEN-4906): märkta etiketter med underträd filtreras bort ur `/metadata` och avvisas vid skapa/uppdatera. Attributet måste sättas i varje miljö.

- For a user with no organization, the errand list should be empty, not show "Ärendena kunde inte hämtas. Försök igen senare."
- A logged in citizen can only register new errand or update draft errands they have previously registered but that are not yet handled by admins.
- Remove citizen search, this app does not need it. It will have this flow (we are building it later): citizen logs in -> app gets personnummer, exchanges it for an internal guid partyId, fetches organizations where this citizen has engagements, and allows the user to select a primary stakeholder from these organizations when registering a new errand. And reporterUserId must be set to the citizens partyId
- husky hooks, yarn verify, knip, github actions like in draken etc
- IDOR check

DOING

PR

DONE

- Schemanamn är namespace-medvetna: `<namespace>_<hela etikettvägen>`, t.ex.
  `aot_alcohol_serving_permit_application_permanent_serving`. Namespacet kommer från backendens env
  via metadatasvaret, så en andra app i repot får rätt namn utan kodändring. Lövnamn ensamt räckte
  inte — jsonschema-tjänsten partitionerar bara på kommun, och `STADIGVARANDE` finns under två
  kategorier.

- Bilagor: filfrågorna är borta ur ärendetypernas JSON-scheman och ersatta av ett Bilagor-avsnitt i
  registreringsformuläret. Vilka bilagor en ärendetyp begär, och när de är obligatoriska, deklarerar
  schemat självt under `x-attachments` — appen läser det i runtime ur schemat den redan
  laddar och har ingen egen lista. Filerna går till
  `/supportmanagement/errand/:id/attachments` i BFF:en; eftersom SupportManagement bara tar emot
  filer på ett ärende som finns väntar de i formulärstate och skickas direkt efter att ärendet
  skapats. Backend behöver `yarn install` — `multer`, `form-data` och `@types/multer` är nya.

- Errand categorization: "Om ärendet" now has Kategori (Select) and Ärendetyp (Combobox, subtypes
  grouped under their type), reusing draken's ThreeLevelCategorization shape. The pick is stored as
  errand.labels — three labels, or two when the type is a leaf. The UNCATEGORIZED placeholder is gone.
  classification.category/type is deliberately not written, so the overview column still reads "—".
- For a user with not citizenidentifier in the SAML profile, the error message "NO_USER": "Misslyckades att konfigurera användare" is shown. A more informative error message would be goood your this particular case, because in our test enviroment this will happen often when people pick the wrong test user to login with. Also, in the test environment (we should add an env variable ENVIRONMENT=LOCAL|TEST|empty/prod for this) a logout button should be shown on the login page so that it is easy to logout and try a different user.
  Refused logins left no SAML session to log out with, so the IdP kept re-asserting the same identity and the button could not break the loop — the asserted nameID is now kept on the session for the logout to use.
- Logout functionality
- When no user is logged in, I should be sent to the login page, not a broken errand listing with a bunch of 401s in the network tab. Why is this not working?
- In the resgister form, the Ärendeägare accordion should list the organizations a user has engagements in - the same list as stored in the session
- Person number sanitiation is too allowing: a future birth date should be rejected, not assumed to mean a date 100 years earlier. And is the plus sign really a convention for centenarians?
- Login - citizens, not employees. No groups or permissions should be set. Get the citizenidentifier from the SAML profile as in Mina sidor privat, and exchange it for a partyid with Citizen.
- After login, fetch all the organizations (from legalentity) that the logged in citizen has an engagement in, and then automatically fetch all errands where some of these organizations is the applicant stakeholder. Do this utilizing the following services/controllers:
  \*\* A service (maybe named legal-entity.service.ts, which we need to build) for fetching myOrganizations from legalentity. Use the generated data contracts and define classes to return from the service (and in the next step, the calling controller) so that the frontend can in turn generate data contracts to use.
- in ./web-app-business-center/backend\src\services\legal-entity.service.ts you have an example of fetch the users orgs. like in business center/Mina sidor privat, we need to handle both organizations from legalentity and from myrepresentatives (mandates given to the logged in citizen)
- default deny auth guard
- The /errandNumber endpoint can go away - it is not needed here, only for admins in the internal app. The citizen mapping for person number can also go, but leave it commented out/inactve rather than removing it, and add a FIXME comment. I will need to discuss with the team. Another thing: fetching errands should only ever be done with a filter for the currently logged in citizens organizations (resolved server side - session.partyId or so) - no general errand fetch should be done.
- Posting to /errand/create should strip id and errandNumber - these should never exist when creating a new errand
