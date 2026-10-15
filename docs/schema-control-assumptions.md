# Antaganden som faller när schemana blir styrda

Status: Analys, beslutad hållning — underlag för förvaltningsarbetet före lansering

Datum: 2026-09-14

## Syfte

Importen från OpenE är ett övergångsläge. Slutläget är att schemana ägs av jsonschema-tjänsten och
redigeras i ett admin-GUI — ingen generator, inget byggsteg, ingen CI mellan en redigering och det
formulär medborgaren möter. Det ändrar förutsättningen i grunden: schemat är inte längre en
opålitlig export som appen måste tolerera, utan en **styrd artefakt som kan författas mot ett
kontrakt**.

Dokumentet inventerar de antaganden i schemahanteringen som bara finns för att schemana i dag
importeras, och sorterar dem efter vad som ska hända med dem: tas bort med pipelinen, skärpas när
innehållet kan styras, ersättas av kontroller i körtid, åtgärdas i själva schemainnehållet, eller
lyftas till uttryckligt kontrakt för att de blir *farligare* när en människa redigerar live.

**Beslutad hållning: hybrid.** Strukturella kontraktsbrott stoppas i BFF:ens schemaadapter
(fel dialekt, schema som Ajv inte kan kompilera, villkor eller bilagor som pekar på egenskaper som
inte finns → 502 + logg). Presentationsproblem (okänt widgetnamn, okänd ikon, sektionsegenheter)
förblir fail-open — ett extra synligt fält är återhämtningsbart, ett tyst dolt är det inte — men
med telemetri på serversidan i stället för dagens `console.warn` i medborgarens webbläsare.

Källor: `docs/aot-form-schema-plan.md` (målbilden), `docs/json-schema-localization.md`
(språkkontraktet), `TODO.md` (punkten "Generatorns skyddsnät försvinner med generatorn"), samt
koden som citeras löpande nedan.

**Genomfört 2026-09-14.** Steget bort från importen är taget: generatorn och `docs/jsonschemas/`
är borttagna (finns i git-historiken), `x-oe-*`-nycklarna är strippade ur mockarna, och mockarna i
`backend/src/mocks/` underhålls nu för hand som tjänstens ställföreträdare. Skyddsnätets ersättning
finns i `backend/src/utils/schema-contract.ts` (fail-closed på dialekt och hängande referenser,
loggvarningar för ofattade villkorsnyckelord och trasiga bilageposter) och i kontraktstestet
`frontend/tests/unit/components/json/mock-schema-contract.test.ts`, som kör varje mockat par mot
den riktiga validatorn, widgetregistret, sektionsreglerna och villkorsmotorn — peka om det mot de
publicerade schemana när de finns. Adaptern returnerar nu typade `name`/`version`, `fetchUiSchema`
skiljer 404 från fel, och `frontend/src/app/[locale]/error.tsx` fångar renderfel. Kvarstående
punkter är markerade **[kvar]** nedan.

## 1. Dör med pipelinen

Ren rivning när tjänsten tar över — inget av detta ska ersättas.

- **Generatorn och dess artefakter**: `docs/jsonschemas/build-ui-schema.mjs`, exporterna och de
  genererade `*-request`-filerna, samt det odokumenterade manuella kopieringssteget till
  `backend/src/mocks/` (filerna är bytesidentiska, bara omdöpta — steget finns inte i något skript).
- **Mocken**: `backend/src/mocks/aot-schema.mock.ts` med sina tre anropsplatser i
  `backend/src/controllers/schema.controller.ts`. Redan FIXME-märkt. Mocken konsulteras *före*
  uppströmsanropet i alla miljöer, så ett schema som publiceras i tjänsten under ett av de elva
  namnen skuggas av diskkopian tills mocken tas bort.
- **Rekonstruktionen av schema-ID** i mocken: `` `${MUNICIPALITY_ID}_${schema.name}_${schema.version}` ``
  är ett antagande om tjänstens ID-format. Språkkontraktet förbjuder redan att ID-strängen tolkas —
  ingen annan kod får någonsin återuppbygga den. Dör med mocken.
- **OpenE-proveniens i publicerade scheman**, läses av ingenting i körtid: `x-oe` (442 förekomster,
  inklusive `defaultQueryState: "HIDDEN"` som är meningslöst i den nya modellen — fälten renderas
  villkorslöst), `x-oe-alternativeID` (278), `x-oe-flow`, `x-oe-format` (dubblerar `pattern`),
  `x-oe-invalidFormatMessage` (ersatt av `locales/*/validation.json`), `x-oe-dateRestrictions`
  (regeln bärs redan av `ui:options.step`). Strippas vid publiceringen, per
  `aot-form-schema-plan.md` §8.
- **Tester fastnaglade i generatorutdata**: `backend/src/tests/schema-contracts.test.ts` pinnar de
  bokstavliga egenskapsnamnen `['kontaktuppgifter_6115', 'ansokan_6116']`, de tio schemanamnen och
  `` `2281_${schemaName}_0.1` `` — allt går sönder i samma stund en admin publicerar version 0.2.
  Ersätts av fixturer som inte är bundna till generatorns utdata.

**Notering om arbetskopian**: helflödesparet (`aot_opene_test`) är borttaget ur arbetskopian —
JSON-filerna i `backend/src/mocks/` och `docs/jsonschemas/` samt importerna i
`aot-schema.mock.ts` — men generatorn skriver fortfarande ut paret vid varje körning, så det
återuppstår i `docs/jsonschemas/` om den körs igen innan den rivs.

## 2. Toleranser som bara finns för att scheman importerades

Kod som tål saker den inte längre behöver tåla när innehållet författas mot kontraktet.

- **Dialekttvånget.** Generatorn skrev om draft-07 till 2020-12 eftersom `Ajv2020` vägrar
  kompilera draft-07. Rättelse mot den ursprungliga analysen: rjsf-validatorn *sväljer*
  kompileringsfelet och visar det som ett valideringsfel på fältet `$schema` — sidan dör alltså
  inte, men medborgaren möter ett obegripligt fel och kan inte skicka in. Kontraktsregel: enbart
  2020-12. Kontrollerad i adaptern sedan 2026-09-14; `error.tsx` finns numera ändå som sista
  skyddsnät för renderfel.
- **Kuverttoleransen.** `aot-form-schema-plan.md` §5: "Inläsningen måste tåla båda" — naket schema
  respektive `{name, version, value, description}`-kuvertet. Tjänsten svarar alltid med
  `JsonSchema`-kuvertet; toleransen kan gå.
- **Stavningstolerans för widgetnamn.** De gemena aliasen i
  `frontend/src/components/json/widgets/index.ts` finns "for names arriving from the external
  service", och `group-widget-names.ts` dubblerar registret i två listor som synkas för hand. Under
  kontroll: enbart kanoniska namn. RJSF:s reserverade namn (`select`, `radio`, `textarea` …) måste
  dock förbli överskuggade — annars renderar RJSF ostilade native-kontroller.
- **`stripHiddenFields`** (`frontend/src/components/json/utils/schema-conditions.ts`) motiveras med
  "Matches OpenE, where every rule … has `doNotResetQueryState: false`" — ett flödesbrett eko av
  exporten upphöjt till appbeteende. Under kontroll är det ett medvetet kontraktsval som ska
  dokumenteras; i dag finns ingen per-fält-avstängning om ett framtida formulär behöver behålla
  svar över ett grenbyte.
- **`constAsDefaults: 'skipOneOf'`** i `schema-form.component.tsx` antar tyst att alla val uttrycks
  som `oneOf` av `const`. En handförfattad fråga med `enum` tappar skyddet och RJSF förifyller
  första alternativet — ett svar medborgaren aldrig gett. Lyfts till kontraktsregel.
- **Radindexregexen** `id.replace(/_\d+(?=_|$)/g, '_#')` i `schema-form.component.tsx` felnycklar
  varje egenskapsnamn som slutar på `_<siffror>` — exakt OpenE:s nyckelstil. Kontraktsregel:
  egenskapsnamn slutar aldrig på `_<siffror>`.
- **Frysta trunkeringsartefakter.** Konstanter som `ENSKILD_FIRMA_REGISTRERAD_HOS_SKATTEVERKET` och
  `JAG_VILL_SKRIVA_VERKSAMHETSBESKRIVNINGEN_I` (femordsgränsen, kapade mitt i meningen) fryser i
  samma stund det första ärendet sparas. Under kontroll kan de döpas om — men bara **före
  lansering**. Hänger ihop med öppen fråga 5 i `aot-form-schema-plan.md` §7 (svenska eller engelska
  namn); fönstret stängs vid första produktionsärendet.

## 3. Generatorns skyddsnät → ersättning

`TODO.md`-punkten, konkretiserad med den beslutade hållningen. Vad varje vakt i
`build-ui-schema.mjs` fångade, vad som händer i körtid i dag, och var kontrollen ska bo.

| Vakt (generatorn) | Körtid i dag | Föreslagen plats |
| --- | --- | --- |
| Okänt `ui:widget`-namn | RJSF:s standardwidget, tyst | Tolerera + telemetri |
| Fråga i noll eller flera sektioner | Osektionerad svans / renderas två gånger, tyst | Tolerera + telemetri |
| Villkor pekar på egenskap som saknas | Fältet visas aldrig, tyst | **Stoppa i adaptern** |
| `x-attachments.requiredWhen` pekar på egenskap som saknas | Bilagan blir permanent frivillig, tyst | **Stoppa i adaptern** |
| Enumkonstanter krockar | — | Admin-GUI:ts ansvar; rimlighetskontroll i adaptern valfri |
| `$schema`-dialekt / Ajv-kompilerbarhet | Sidan dör i render, ingen boundary | **Stoppa i adaptern** |
| Ofattat villkorsnyckelord | Fältet visas + en `console.warn` per nyckelord och sidladdning, enbart i webbläsaren | Tolerera + **telemetri på serversidan** |

Två korrigeringar av TODO-punktens bild: widgetkontrollen (`assertWidgetsResolve`) och
sektionstillhörighetskontrollen kördes **enbart på helflödesartefakten** — de tio scheman som
faktiskt serveras har aldrig widgetkontrollerats, och flöde 2153 fick ingen widgetkontroll alls.
Skyddsnätet som försvinner är alltså mindre än det ser ut. Dessutom innehåller generatorns
`VALID_WIDGETS` namnet `'files'`, som inte finns i Katlas register — listan var aldrig strikt lika
med registret.

Ersättningens form (rekommendation, inte implementerad): validering i BFF:ens schemaadapter —
`backend/src/utils/schema-response-mapping.ts` är i dag den *enda* strukturella kontrollen och
verifierar bara "objekt med id", ingenting om att `value` är ett giltigt JSON Schema — plus ett
kontraktstest som körs mot de **publicerade** schemana, i linje med TODO-punktens eget förslag.
Telemetri betyder backend-loggning, inte medborgarens konsol. `requiredWhen` i `x-attachments`
passerar i dag aldrig `warnAboutUnsupportedKeywords` — ersättningen måste täcka även den vägen.

## 4. Blir åtgärdbart i schemainnehållet

Det kontrollen *möjliggör*: brister som hittills fått bo i schemana för att exporten såg ut som den
gjorde.

- **Svensk text i JSON-schemat.** `title`/`description` ligger i schemat, inte i ui-schemat, och
  `x-i18n` emitteras ingenstans — §4.4 i planen är oimplementerad i artefakterna. Backend löser
  dessutom upp `x-i18n` **enbart i ui-schemat** (`backend/src/utils/schema-localization.ts`):
  `x-i18n` inne i JSON-schemat skulle nå webbläsaren rå, och `x-attachments`-etiketter går inte att
  översätta alls i dag. När texterna kan flyttas ska upplösningen och kontraktet i
  `json-schema-localization.md` följa med.
- **`then.required` som synlighet.** Renderaren läser "krävs när" som "visas när", och
  `then.properties: {fält: true}` är en JSON-Schema-tautologi som bara finns som synlighetsmarkör.
  Ett handförfattat schema som använder `then.required` i betydelsen *obligatoriskt men alltid
  synligt* får fältet att **försvinna** tills villkoret slår in. Konventionen behålls — den är
  etablerad och delad med Draken — men den måste stå i författarkontraktet (utvidgar planens
  §4.2b), för utanför generatorn är den kontraintuitiv.
- **Duplicerade block utan `$defs`.** Finansiering, kunskapsprov och serveringsställe ligger
  inlinade i 3–8 filer. Frestande att deduplicera under kontroll, men renderaren stöder **inte**
  `$ref`: `collectSchemasById`, villkorsmotorn och `schemaOfProperty` ignorerar alla referensen,
  så villkor slutar tyst att tillämpas inne i ett `$ref`:at objekt. Kontraktsregel: inga
  `$ref`/`$defs` förrän renderaren stöder dem.

## 5. Kopplingar som blir farligare med admin-GUI

Antaganden som inte försvinner utan tvärtom skärps när en människa redigerar utan skyddsnät. De ska
upp till uttryckligt kontrakt eller kontroll.

- **[kvar] Namnkonventionen** `<namespace>_<hela etikettvägen>` härleds fristående i frontends
  `schemaNamesForErrand` — hittills speglad av generatorn, snart speglad av en människa i ett
  admin-GUI. Ett felstavat namn ger 404 → `SchemaNotFoundError` → ärendetypen renderas tyst som
  formulärlös; det går inte att skilja från en avsiktligt formulärlös typ. Kräver åtminstone
  telemetri som skiljer fallen åt — eller på sikt en uppslagning i metadatan i stället för
  konvention.
- **Adaptern tappar `name` och `version`.** Åtgärdat 2026-09-14 — `mapSchemaResponse` passerar
  dem typade när uppström anger dem; språkkontraktet förbjuder fortsatt att ID-strängen tolkas.
- **[kvar] Cachning utan utrymning.** Frontends modulglobala `schemaCache`, valideringsinstanserna och
  `warnedKeywords` töms aldrig — en admins redigering är osynlig för en öppen SPA-session på
  obestämd tid, och en in-place-PUT av ett ui-schema ändrar retroaktivt hur sparade utkast
  renderas (invariant 3 i språkkontraktet hedras tekniskt men inte till sin avsikt). Backend
  sätter inga cache-huvuden alls. En cachestrategi blir ett krav, inte en optimering, när
  redigeringar sker live.
- **[kvar] Ingen serversidesvalidering av inskickade svar, någonstans.** `jsonParameters` passerar
  BFF:en okontrollerade till SupportManagement; adaptern verifierar inte ens att angivet
  `schemaId` finns. Tjänstekontraktets `validationUsageCount`/`lastUsedForValidation` antyder en
  valideringsförmåga ingen anropar. Med styrda scheman kan BFF:en validera mot exakt `schemaId`.
- **`fetchUiSchema` sväljer allt.** Åtgärdat 2026-09-14 — 404 betyder "inget ui-schema" och ger
  `{}`; alla andra fel propageras i stället för att tyst rendera formuläret sektionslöst.
- **Trasiga `x-attachments`-poster släpps tyst** (medvetet, dokumenterat i
  `errand-attachments.ts`): en obligatorisk bilaga vars `label` råkar raderas blir osynlig och
  ovillkorlig. Fail-open är rätt hållning; sedan 2026-09-14 loggar adaptern varje släppt post,
  och en `requiredWhen` som pekar fel stoppas.
- **[kvar]** Mindre, listade för fullständighet: mobilguidens submit-väg utelämnar `requiredSchemaNames`
  (desktopens fail-closed-regel för orörda formulär körs inte där); okänt `format` skriver ut det
  råa nyckelordet för medborgaren och `enum`/`not`-fel visas som "obligatoriskt";
  `HtmlAwareAjv2020` mäter `minLength`/`maxLength` på HTML-strippad längd för **alla** strängar,
  inte bara rich text; `ui:widget: "time"` utan `format: "time"` ger offsetlöst värde som uppström
  avvisar först vid submit; `TextareaWidget` är Quill och lagrar HTML — ren flerradstext saknas;
  widgetregistret ska vara identiskt med Drakens utan något test som binder dem.

## 6. Författarkontraktet

Reglerna en schemaförfattare — och admin-GUI:ts publiceringsvalidering — måste följa. Detta är den
positiva formuleringen av allt ovan; adaptern och kontraktstestet kontrollerar delmängder av den.

1. **Dialekt**: `$schema` är alltid draft 2020-12.
2. **Namn**: `<namespace>_<hela etikettvägen i gemener>`; namnet är permanent när första ärendet
   sparats. Egenskapsnamn slutar aldrig på `_<siffror>`.
3. **Val**: alternativfrågor uttrycks som `oneOf` av `const` med `title` — aldrig `enum`, aldrig
   `anyOf`.
4. **Villkor**: `if.properties` paras alltid med `if.required`; synlighet uttrycks som
   `allOf: [{if, then}]` på objektets nivå; `then.required` betyder *synligt och obligatoriskt*,
   `then.properties: {fält: true}` betyder *synligt*; rot-`required` används aldrig för villkorade
   fält; `else` används inte (läses inte). Tillåtna nyckelord i `if` är exakt villkorsmotorns:
   `const`, `enum`, `properties`, `required`, `contains`, `allOf`, `anyOf`, `oneOf`, `not`.
5. **Struktur**: inga `$ref`/`$defs`; nästling följer vad `collectSchemasById` klarar
   (objekt, och arrayer av objekt).
6. **Ui-schema**: enbart kanoniska widgetnamn (PascalCase-registret); varje fält i exakt en
   `ui:sections`-post; sektions-`id` är stabila (lokaliseringen binder mot dem); vokabulären i
   `aot-form-schema-plan.md` §5.
7. **Bilagor**: `x-attachments`-poster har formen `{key, label, description?, requiredWhen?}`;
   `requiredWhen` följer villkorsreglerna i punkt 4 och pekar bara på egenskaper schemat har.
   En bilaga som alltid krävs har `"requiredWhen": {}` (ett villkor utan krav matchar alltid);
   saknas `requiredWhen` är bilagan frivillig.
   `key` är engelsk `UPPER_SNAKE_CASE` och identisk med namnet på motsvarande attachment purpose i
   SupportManagements namnrymdsmetadata; samma dokument har samma `key` i alla scheman, medan
   `label` får skilja sig per schema.
8. **Text och språk**: placering och `x-i18n` enligt `json-schema-localization.md`; maskinvärden
   översätts aldrig.
9. **Besöksadress**: serverings- eller försäljningsställets adress ligger alltid i rotegenskapen
   `besoksadress` med `gatuadress`, `postnummer` och `postort` — ingen annan egenskap bär de
   fälten. Draken läser adressen därifrån, utom när `besoksadressSammaSomArendeagare` är `JA`; då
   gäller adressen på ärendets PRIMARY-intressent. Finns frågan krävs `besoksadress` vid `NEJ`,
   saknas frågan är `besoksadress` alltid obligatorisk. Kontrolleras i kontraktstestet.
10. **Stopp**: ett svar som utesluter ansökan uttrycks på roten som
    `x-stops: [{when, text}]`. `when` följer villkorsreglerna i punkt 4, pekar bara på
    rotegenskaper och har alltid `required`; texten visas under den sista egenskapen i
    `when.required`. Så länge villkoret matchar nekas registrering med `text` som felmeddelande,
    efter formulärets egna fel; utkast kan fortfarande sparas. `text` lokaliseras inte, precis som
    bilagornas etiketter. Ett villkor som pekar på en egenskap som saknas stoppas i adaptern; en
    post utan `text` eller `when.required` släpps och loggas.
11. **Beslutsflikens nycklar**: Drakens beslutsunderlag läser serverings- eller
    försäljningsstället ur fasta rotnycklar, på samma sätt som besöksadressen i punkt 9
    (`docs/beslutsflik-nycklar.md`). Namnet är rotsträngen `serveringsstalletsNamn`;
    kontaktuppgifterna ligger i `kontaktuppgifterTillServeringsstallet` med enbart
    `telefonnummer`, `ePostadress` och `hemsida`, och inget annat objekt bär de fälten; sittplatser i
    `sittplatserILokalen` med `antalSittplatserInomhus` och `antalSittplatserUteservering`;
    dryckerna i `alkoholdrycker` med de fyra konstanterna; maten som `serverasMat`, `menyval`
    (`JAG_VILL_BESKRIVA` | `JAG_VILL_LADDA_UPP`) och `menyBeskrivning`, där bilagan `MENU` krävs
    vid `JAG_VILL_LADDA_UPP`; ansvariga personer i `serveringsansvarigPersonal` med `fornamn`,
    `efternamn` och `personnummer`. Titlarna får skilja sig per schema, nycklarna inte. Ett schema
    utan frågan utelämnar nyckeln; Draken visar då "—". Kontrolleras i kontraktstestet.
    Undantag: tobakens `hemsida` är en rotsträng som visas vid distansförsäljning, eftersom
    villkorsmotorn bara kan visa rotegenskaper (punkt 4) — Draken läser den från roten för tobak.
