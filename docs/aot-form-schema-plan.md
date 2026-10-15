# Plan: från OpenE-export till AoT-formulär i Katla

> Historik: OpenE-exporterna och generatorn i `docs/jsonschemas/` togs bort 2026-09-14 (finns i git-historiken). Schemana underhålls nu direkt i `backend/src/mocks/` i väntan på jsonschema-tjänsten; se `docs/schema-control-assumptions.md`.


Status: Underlag för beslut

Datum: 2026-09-08

Källor: OpenE-exporterna i `docs/jsonschemas/` — `aot_ny_for_draken-2181.*` för alkohol och
`aot_tobak_ny_for_draken-2153.*` för tobak, var och en med `.schema.json`, `.rules.json` och
`.uischema.json`. Kartan gren mot ärendetyp finns i `aot-branch-label-mapping.md`, öppna frågor i
`OUTSTANDING_QUESTIONS.md`.

**Exporten deklarerar draft-07.** Hela plattformen är 2020-12: jsonschema-tjänsten dokumenterar det,
`docs/json-schema-localization.md` slår fast det, och `form-schema-validator.ts` använder `Ajv2020`,
som kastar `no schema with key or ref "http://json-schema.org/draft-07/schema#"` på en draft-07-rot.
Att sätta om `$schema` är därför ett obligatoriskt inläsningssteg, inte en detalj — generatorn gör
det, så en ny export inte tyst återinför felet. Båda kommer från OpenE-flöde **2181**
"AoT ny för draken" v4 och är utdrag ur XML-exporter. De 169 frågenycklarna matchar varandra
exakt, i båda riktningarna.

## Sammanfattning

Schemat är fältinventariet, reglerna är logiken, och de går bara att förstå tillsammans: 168 av
169 frågor har `defaultQueryState: HIDDEN` och schemat innehåller inte ett enda `if`, `allOf`
eller `dependencies`. Renderat som det är visas en enda radioknapp.

Reglerna beskriver ett formulär som är betydligt mindre än det ser ut. Ingen sökande möter 169
frågor — den största grenen (stadigvarande servering) når 62, den minsta 32. 8 frågor kan aldrig
bli synliga över huvud taget.

Tre saker behöver åtgärdas innan ett schema kan publiceras:

1. **Regelexporten är ofullständig på en punkt.** 12 av 90 regler har tappat sitt tröskelvärde —
   villkoret finns bara kvar i regelns svenska namn. De går att rekonstruera för hand, men det bör
   bekräftas mot XML:en.
2. **Publicera inte OpenE-exporten som den är.** Nycklar och enumvärden är bundna till flöde 2181:s
   query- och alternativ-ID:n, och de blir ett permanent kontrakt i samma stund ett ärende sparas
   mot sitt `schemaId`.
3. **Formuläret delas i flera scheman, ett per ärendetyp.** Beslutat. `ERRAND_FORM_SCHEMA_NAMES`
   är redan en lista och `errand-details.component.tsx` renderar redan ett `SchemaForm` per namn,
   så delningen kostar inget arkitektoniskt — och den tar bort merparten av villkorslogiken.

## 1. Schemaexporten

Kuvertet är exakt `JsonSchemaRequest` (`name`, `version`, `value`, `description`) och kan PUT:as
till jsonschema-tjänsten som det är. `name` är `aot_opene_test` — den odelade flödeskopian, som ingen etikett väljer; ärendetypernas
scheman namnges enligt 4.1.

`value` är draft 2020-12 med två egenskaper på roten — OpenE:s två steg:
`kontaktuppgifter_6115` (18 frågor) och `ansokan_6116` (151 frågor).

### Frågetyper

| OpenE-frågetyp | Antal | JSON Schema-form i exporten                                    |
| -------------- | ----- | -------------------------------------------------------------- |
| FileUpload     | 39    | `array` av `string`/`format: data-url`                         |
| TextField      | 32    | `object` med ett delfält per textruta                          |
| RadioButton    | 30    | `string` med `oneOf: [{const, title}]`                         |
| TextArea       | 19    | `string`                                                       |
| DynamicTable   | 17    | `array` av `object` (en egenskap per kolumn)                   |
| Checkbox       | 17    | `array`, `uniqueItems`, `items.oneOf`                          |
| DateTime       | 12    | `object` med `startDate`/`endDate` eller `startTime`/`endTime` |
| ContactDetail  | 2     | `object` (personnummer, namn, adress, e-post)                  |
| CompanyDetails | 1     | `object`, `readOnly`, med `x-oe-source` (SSBT/Bolagsverket)    |

### Nyckelformat och alternativ

`<slug>_<queryID>` för frågor, `<slug>_<textFieldID>` för delfält i TextField, `<slug>_<columnID>`
för kolumner i DynamicTable. Slugen är trunkerad till 40 tecken, ibland mitt i ett ord
(`ovriga_upplysningar_angaende_finansierin`, `maximalt_antal_personer_som_kommer_att_v`).

Alternativ anges som `oneOf` med `const` satt till OpenE:s alternativ-ID:

```json
{
  "const": "49648",
  "title": "Ansöka om stadigvarande tillstånd för servering av alkoholdrycker"
}
```

### Annotationer

`x-oe` (queryID, queryTypeID, defaultQueryState) på varje fråga, plus `x-oe-alternativeID`,
`x-oe-allowedFileExtensions`, `x-oe-maxFileNameLength`, `x-oe-format`,
`x-oe-invalidFormatMessage`, `x-oe-dateRestrictions`, `x-oe-source` och `x-oe-flow`.

`x-oe-format` finns på nio delfält med värdena `swedish-personal-id`,
`swedish-organization-number` och `swedish-postal-code`, men utan motsvarande `pattern` — formatet
är dokumenterat, inte verkställt. `x-oe-dateRestrictions` bär `timeInterval: "15"` på sju
tidsfrågor och `startDateRestrictionType: "RESTRICT_FUTURE_DATES"` på en.

### Dubbletterna

151 frågor i `ansokan_6116`, men bara **91 unika slugar**. OpenE saknar återanvändning, så samma
frågeblock är inklistrat en gång per gren:

| Antal kopior | Fråga/block                                                                         |
| ------------ | ----------------------------------------------------------------------------------- |
| 5×           | `sittplatser_i_lokalen`, `maximalt_antal_personer_som_kommer_att_v`                 |
| 4×           | `vilka_alkoholdrycker_ska_serveras`, `meny`                                         |
| 3×           | hela finansieringsblocket (9 frågor), hela kunskapsprovsblocket (5 frågor)          |
| 2×           | serveringsställe, verksamhetens inriktning, matutbud, planritning, brandskydd m.fl. |

60 av 151 frågor är kopior. I JSON Schema har vi `$defs`/`$ref` och behöver dem inte.

### Frågor som saknas i exporten

19 query-ID:n i intervallet finns inte i schemat: 81697, 81717, 81722, 81724, 81725, 81742, 81753,
81765, 81782, 81783, 81798, 81812, 81817, 81831, 81838, 81843, 81845, 81864, 81882. Nio av dem
refereras av regler, så de finns i flödet — sannolikt rena informations- och textfrågor som
exporten utelämnat. En av dem, 81697, är åldersgrindens meddelande (se nedan).

De är inte kritiska för datamodellen, men de bär den hjälptext som förklarar varför en gren ser ut
som den gör. Be om dem i nästa export och lägg dem som `ui:description` på sektionsnivå.

## 2. Regelexporten

90 regler över samma 169 frågor.

| Evaluator                                            | Antal | Betydelse                                                                                                                                         |
| ---------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QueryStateEvaluationProviderModule`                 | 61    | Om källfrågans svar finns i `requiredAlternativeIDs` (`selectionMode: ANY`) sätts `targetKeys` till `VISIBLE` (36) eller `VISIBLE_REQUIRED` (25). |
| `WeightQueryStateEvaluationProviderModule`           | 12    | _Källfrågan själv_ blir synlig när en namngiven vikt har ett visst värde.                                                                         |
| `SetWeightEvaluationProviderModule`                  | 9     | Källfrågans valda alternativ tilldelar ett tal till en namngiven vikt. Inga targets.                                                              |
| `WeightCalculatedQueryStateEvaluationProviderModule` | 7     | _Källfrågan själv_ blir synlig när `weightExpression` är sann.                                                                                    |
| `UserAgeQueryStateEvaluationProviderModule`          | 1     | Åldersgrind.                                                                                                                                      |

`doNotResetQueryState` är `false` i samtliga 61 regler som har fältet — **ett svar nollställs alltså
alltid när frågan döljs igen**. `freeTextAlternative` är `false` överallt, och
`useOnlyHighestWeight` `false` i alla nio viktregler.

### Vikterna kan elimineras

Nio viktbuckets, var och en matad av **exakt en** fråga:

| Vikt                                          | Matas av                                              |
| --------------------------------------------- | ----------------------------------------------------- |
| `uppgifter`                                   | `hamtning_av_foretagsuppgifter_81701`                 |
| `företag`                                     | `foretagsform_81706`                                  |
| `ansökan`                                     | `vad_vill_du_ansoka_om_eller_anmala_81716`            |
| `alkohollag1` / `alkohollag2` / `alkohollag3` | `kunskap_om_alkohollagen_81718` / `_81813` / `_81839` |
| `typeOfServing`                               | `ska_servering_av_alkohol_ske_till_allman_81729`      |
| `kostnadsfri`                                 | `ar_tillstallningen_i_ovrigt_kostnadsfri_81867`       |
| `bostad`                                      | `var_kommer_tillstallningen_att_aga_rum_81868`        |

Eftersom ingen bucket matas av mer än en fråga är vikten bara en indirektion, och varje viktregel
går att skriva om till ett villkor över svaret direkt. Det gäller **detta** flöde; se varningen
nedan. `$weight{typeOfServing} = 1 ||
$weight{typeOfServing} = 3` blir `ska_servering_av_alkohol_ske_till_allmanheten ∈ {49660, 49662}`.
Vikten `företag` sätts men läses aldrig och kan strykas helt.

Ett enda uttryck korsar två buckets: `($weight{kostnadsfri} + $weight{bostad}) = 2`, som visar
"Du behöver inte ansöka om serveringstillstånd!" när tillställningen är kostnadsfri **och** hålls i
privat bostad. Det är en vanlig AND över två frågor.

Uttryckssyntaxen är slarvig och en parser måste tåla det: `= 1` betyder likhet, `||` betyder eller,
och ett av de sex `typeOfServing`-uttrycken saknar mellanslag (`1 ||$weight{...}`).

**Varning: en vikt är inte alltid en likhet.** Matas bucketen av en _kryssrutefråga_ med
`useOnlyHighestWeight: false` blir vikten **summan** av de valda alternativens vikter, alltså en
bitmask. Så fungerar tobaksflödets `caseType`: alternativen väger 1, 2 och 4, och
`$weight{caseType} != 4 && $weight{caseType} > 0` betyder "något är valt och det är inte enbart
nikotinfria produkter". Att platta ut ett sådant uttryck är att räkna upp delmängder, inte likheter.
Kontrollera källfrågans typ innan en viktregel skrivs om.

### Regelexporten har tappat tröskelvärdena

De 12 `WeightQueryState`-reglerna bär `weightType` men **inget villkorsvärde** — `weightExpression`
är `null` och inget annat fält anger vilket värde som krävs. Villkoret finns bara i regelns namn:

| Fråga                                            | Namnet säger                          |
| ------------------------------------------------ | ------------------------------------- |
| `personnummer_81719`                             | `visa om alkohollag1 = 1`             |
| `organisationsnummer_81720`                      | `visa om alkohollag1 = 2`             |
| `vill_du_anmala_personer_i_foretaget_till_81721` | `visa om alkohollag = 3`              |
| `personnummer_81814` / `_81840`                  | `alkohollag2 = 1` / `alkohollag3 = 1` |
| `organisationsnummer_81815` / `_81841`           | `alkohollag2 = 2` / `alkohollag3 = 2` |
| `vill_du_anmala…_81816` / `_81842`               | `alkohollag2 = 3` / `alkohollag3 = 3` |
| `ar_fakturaadressen_samma_som_foretagets_81707`  | `uppgifter = 1\|\|2`                  |
| `fakturareferens_81709`                          | `uppgifter = 1\|\|2`                  |
| `har_du_kassaregister_81883`                     | `ansökan = 1-7`                       |

Att läsa dem som "synlig så snart vikten är satt" fungerar för `uppgifter` och `ansökan`, där namnet
räknar upp alla möjliga värden, men inte för `alkohollagN`: då skulle personnummer,
organisationsnummer och anmälningsfrågan visas samtidigt, trots att de är varandras uteslutande
följdfrågor till en trevalsknapp. Villkoret är alltså ett specifikt värde, och det värdet finns inte
i maskinläsbar form.

Tolv regler går att rekonstruera för hand utifrån namnen, och mappningen är entydig. Men be om en
export som tar med tröskelvärdet innan transformen skrivs — annars sitter formulärets logik i en
svensk namnsträng.

### Åldersgrinden finns inte i schemat

```json
{
  "type": "UserAgeQueryStateEvaluationProviderModule",
  "name": "visa om under 20",
  "sourceQueryID": "81697",
  "sourceKey": null,
  "sourceTitle": "Du måste vara 20 år eller äldre för att kunna ansöka",
  "targetQueryIDs": [],
  "targetKeys": []
}
```

Query 81697 är en av de 19 som saknas, så regeln pekar på ingenting. Kravet — sökanden måste vara
20 år — är alltså inte uttryckt någonstans i det vi kan publicera. I Katla hör det inte hemma i
schemat: åldern går att härleda ur personnumret i SAML-profilen och bör kontrolleras i backend
innan formuläret ens visas. Ta med det som ett krav, inte som ett fält.

### Åtta frågor kan aldrig bli synliga

Följande frågor är varken mål för någon regel eller källa till en viktregel. De är `HIDDEN` och
förblir det:

- `jag_vill_81784`
- `bifoga_livsmedelsregistrering_fran_miljo_81797`
- `har_ni_anmalt_koket_som_livsmedelsanlagg_81830` (är källa till en regel, men blir aldrig själv synlig)
- `kapacitet_81832`, `koksinformation_81833`, `planritning_kok_81834`, `brandskydd_kok_81835`,
  `hyresavtal_eller_upplatelseavtal_kok_81836`

De fem sista är hela köksblocket i cateringgrenen. Det är antingen ett fel i flöde 2181 eller
frågor som styrs av något exporten inte tagit med. Ställ frågan till flödesägaren innan de tas med
i schemat — och ta inte med dem om svaret är att de är döda.

### Grenarna

Toppnivån är inte ärendetypen utan `foretrader_du_ett_foretag_81698` — flödets enda synliga fråga
från start. "Nej, jag ansöker som privatperson" öppnar en helt egen gren på 19 frågor och döljer
ärendetypsfrågan. Först under "Ja" ställs `vad_vill_du_ansoka_om_eller_anmala_81716` med sina sju
alternativ.

Antal frågor som kan bli synliga per gren:

| Gren                                  | Ansökan | Kontaktuppgifter | Totalt |
| ------------------------------------- | ------- | ---------------- | ------ |
| Privatperson                          | 17      | 2                | **19** |
| Stadigvarande servering (49648)       | 45      | 17               | **62** |
| Tillfälligt, allmänheten (49649)      | 16      | 17               | **33** |
| Tillfälligt, slutet sällskap (49650)  | 19      | 17               | **36** |
| Folköl klass 2 (49651)                | 15      | 17               | **32** |
| Gårdsförsäljning (49652)              | 16      | 17               | **33** |
| Catering till slutna sällskap (49653) | 20      | 17               | **37** |
| Provsmakning (49654)                  | 26      | 17               | **43** |

De två tillfälliga tillstånden delar samma block; 49650 lägger till tre frågor om gäster och
gästlista. Tjugo frågor är gemensamma för alla sju företagsgrenar: hela företags- och
faktureringsblocket plus kassaregisterfrågan.

Notera att bara **51 av 169 frågor någonsin kan bli obligatoriska**. Sex av de sju grenrubrikerna
öppnar sina fält som `VISIBLE`, inte `VISIBLE_REQUIRED` — bara folkölsgrenen kräver sina svar.
Det ser mer ut som inkonsekvens i flödesbygget än som ett medvetet val, och obligatoriskheten bör
beslutas om från grunden i stället för att ärvas.

## 3. Vad Katlas renderare klarar idag

`ObjectFieldTemplate` (`frontend/src/components/json/fields/`) läser villkoren ur
`formContext.originalSchema` och stöder exakt ett mönster: `allOf: [{ if: { properties: { X: {
const: V } } }, then: { required?, properties? } }]` — AND över **likhet mot ett enda värde** på
**syskonfält i samma objekt**.

| Behov i reglerna                                                      | Omfattning                                             | Stöd idag         |
| --------------------------------------------------------------------- | ------------------------------------------------------ | ----------------- |
| ELLER över flera alternativ                                           | 10 av 61 QueryState-regler                             | ✔ `enum`          |
| Checkbox som källa (`finansiering` ×3, `verksamhetens_inriktning` ×2) | 5 källfrågor                                           | ✔ `contains`      |
| Villkor över stegets gräns                                            | 16 kanter, alla från `foretrader_du_ett_foretag_81698` | Nej — bara syskon |
| Flera regler mot samma målfält                                        | **0 förekomster**                                      | ✔ villkoren OR:as |

Villkoren ligger numera i `frontend/src/components/json/utils/schema-conditions.ts`, portad från
Draken och testad direkt. Ett okänt nyckelord **visar** fältet och loggar en varning i stället för
att dölja det tyst — ett dolt fält betyder att svaret aldrig samlas in, och efter lanseringen finns
inget bygg- eller CI-steg mellan en handredigering i jsonschema-tjänsten och medborgaren.

Samma modul används av `stripHiddenFields`, som rensar bort svaren på dolda fält när formuläret
ändras. Det som visas och det som sparas kan därmed inte glida isär, och en övergiven gren skickas
inte in osedd — samma beteende som OpenE, där alla 61 regler har `doNotResetQueryState: false`.

Att alla cross-step-villkor kommer från en enda fråga är väsentligt — delas företag och privatperson
i separata scheman försvinner den raden helt.

### Widgetluckorna

Widgetregistret i `schema-form.component.tsx` täcker text, texteditor, select, combobox, radio,
date och time. Tre saker saknas, och de täcker tillsammans **73 av 169 frågor**:

| Lucka                               | Frågor | Läge                                                                                                                                                                                 |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Filuppladdning (`format: data-url`) | 39     | Behövs inte — uppladdningarna är flyttade till bilagor, se 4.5. Frågorna finns inte längre i ärendetypernas scheman |
| Array av objekt (DynamicTable)      | 17     | Draken har `array-object-field-template.componant.tsx`; Katla har ingen `ArrayFieldTemplate` alls                                                                                    |
| Flervalskryssrutor                  | 17     | ✔ Åtgärdat — `CheckboxGroupWidget` portad till Katla, se avsnitt 5                                                                                                                   |
| Rubrik på nästlade objekt           | 44     | ✔ Åtgärdat — `ui:options.showObjectFieldset` portad från Draken; utan den tappade varje TextField- och DateTime-fråga sin frågetext                                                  |

Utan dem faller fälten tillbaka på RJSF:s ostilade standardmallar, som varken följer `@sk-web-gui`
eller granskningen i `docs/wcag-conformance-review.md`. Det är den enskilt största posten i
frontendarbetet, och den är oberoende av hur schemat delas.

### Utplattat exempel

Regeln `visa egna medel` (källa: checkboxfrågan `finansiering_81743`) blir:

```json
{
  "if": {
    "properties": { "finansiering": { "contains": { "const": "EGNA_MEDEL" } } },
    "required": ["finansiering"]
  },
  "then": { "required": ["egnaMedel", "bifogatKontoutdrag"] }
}
```

`VISIBLE_REQUIRED` blir `then.required`, `VISIBLE` blir enbart synlighet utan `required`.

## 4. Målbild

### 4.1 Ett schema per ärendetyp

Beslutat. Grentabellen i avsnitt 2 är argumentet: ingen sökande möter mer än 62 fält, och grenarna
överlappar bara i det gemensamma företagsblocket. Ärendetypen på ärendet väljer schema — de
kategoriseringsetiketter som används idag ska ersättas med rätt värden senare, men kopplingen
schema ↔ ärendetyp är densamma oavsett vad etiketterna heter. Ett schema per gren:

Schemanamnet är appens SM-namespace följt av hela etikettvägen, gemener:
`aot_alcohol_serving_permit_application_permanent_serving`. Trädet har nu tre nivåer
(`CATEGORY_ROOT → CATEGORY → TYPE → SUBTYPE`) med 17 valbara löv, och **alla** grenar i båda
exporterna har ett löv. `aot-branch-label-mapping.md` håller kartan gren för gren; åtta scheman
täcker exporterna. Ett schemanamn är permanent så snart ett ärende sparats mot det — det lagras
som `jsonParameters`-nyckel på ärendet.

Båda halvorna behövs. Jsonschema-tjänsten partitionerar bara på `municipalityId`
(`/{municipalityId}/schemas/{name}/versions/latest`), så alla appar i kommunen delar ett platt
namnrum och namespacet är enda kollisionsgränsen mellan dem. Hela vägen i stället för lövet
eftersom ett lövnamn bara är unikt under sin egen förälder — `STADIGVARANDE` ligger under både
`ALKOHOL` och `TOBACCO` i trädet idag.

Generatorn (`schemaNameFor`) och appen (`schemaNamesForErrand`) bygger namnet likadant, så ingen
uppslagstabell behövs på någondera sidan. Appen får namespacet ur metadatasvaret — backend lägger
`namespace` på `MetadataResponseDTO` — så det finns på ett ställe, i backendens env.

Uppdelningen omfattar två exporter, inte en. Flöde **2181** är alkohol med åtta grenar. Flöde
**2153** är tobak, och är inte tre grenar utan **ett formulär med en flervalsomfattning** — dess
`vad_vill_du_gora` är en kryssrutefråga och alla tre alternativen får samma följdfrågor. Fem
ärendetyper i trädet har ingen export alls; se kartan.

Blocken som återkommer — finansiering, kunskapsprov, serveringsställe, sittplatser — blir `$defs`.
Skälen:

- **Grenvalet försvinner.** Katla har redan Kategori/Ärendetyp på ärendet (se `TODO.md`,
  "Errand categorization"). Ärendetypen väljer schema, och både
  `vad_vill_du_ansoka_om_eller_anmala` och `foretrader_du_ett_foretag` slutar vara formulärfält.
  Därmed bortfaller de två största villkorsträden — och alla 16 cross-step-villkoren.
- **Dubbletterna försvinner.** 60 kopierade frågor blir `$ref`. De tre `alkohollagN`-vikterna blir
  en enda regel i ett delat `$def`.
- **Kvarvarande logik ryms nästan i det renderaren redan klarar.** Inom en gren är villkoren i
  praktiken "radioknapp X = värde V ⇒ visa fält" på syskonnivå. Kvar att bygga är `anyOf` och
  `contains`.
- **Varje sparat `value` blir litet** — ett stadigvarandeärende bär ~60 nycklar i stället för ett
  objekt format efter 169.
- **Versionering blir hanterbar.** En ändring i cateringgrenen tvingar inte fram en ny
  `schemaId` för alla andra ärendetyper.

Priset är att Draken måste välja schema utifrån ärendetypen på samma sätt. Det är samma kontrakt i
båda ändar, och varje `JsonParameter` bär redan sitt `key` och `schemaId`.

### 4.2 Ersätt kontaktuppgiftssteget med sessionsdata

Beslutat: intressenterna kommer från ärendets sessionsdata, inte från formuläret.

`kontaktuppgifter_6115` är OpenE:s inloggnings- och företagsupplag: `foretrader_du_ett_foretag`,
`hamtning_av_foretagsuppgifter`, `valj_foretag` (SSBT-uppslag mot Bolagsverket),
`ar_du_firmatecknare`, `ladda_upp_fullmakt`, `ditt_foretag`, `foretagsform`.

Katla löser redan detta: medborgaren loggar in med SAML, `legal-entity.service.ts` hämtar engagemang
och fullmakter, och ärendeägaren väljs ur den listan. Att rendera samma frågor som formulärfält vore
att fråga om något backend redan vet och kan lita på — och `valj_foretag` är dessutom `readOnly` i
schemat, alltså redan tänkt att fyllas maskinellt.

Behåll ur steget: fakturaadress/fakturamottagare/fakturareferens, registreringsbevis,
ägarförhållanden, registerutdrag Skatteverket och verksamhetsbeskrivning. Resten stryks.
`foretagsform` bör komma från `legalentity` snarare än frågas — men den styr fyra
uppladdningsregler, så beslutet måste tas medvetet.

### 4.2b Regler för den som skriver villkor i schemat

Två regler som gäller varje schema, oavsett om det genereras nu eller handredigeras i
jsonschema-tjänsten sedan:

- **Para alltid `if.properties` med `if.required`.** Ett saknat fält uppfyller `properties` — det är
  korrekt JSON Schema — så `if: { properties: { x: { const: 'JA' } } }` är sant redan innan
  användaren svarat, och följdfrågan visas direkt.
- **Lägg aldrig ett villkorat fält i rotens `required`.** Obligatoriskheten ska bara komma från
  `then.required`, som AJV tillämpar först när `if` slår till. Det är därför villkorsmotorn inte
  behöver göra något åt obligatoriskhet — och varför en post i rotens `required` skulle låta ett
  dolt fält blockera insändning.

### 4.3 Byt nycklar och enumvärden

OpenE-nycklarna duger inte som varaktigt kontrakt: de bär query-ID:t från en specifik flödesversion,
de är trunkerade mitt i ord, och de fryser fast i det ögonblick första ärendet sparas. Samma sak
gäller enumvärdena — `"49648"` är ett alternativ-ID i flöde 2181, inget annat.

`docs/json-schema-localization.md` slår redan fast att egenskapsnamn och enumvärden aldrig översätts
och att enumetiketter binds till ett stabilt `const` (dokumentets eget exempel är `DEVIATION`).
Numeriska alternativ-ID:n bryter mot den konventionen.

- Nycklar: `bifoga_lanebevis_for_banklan_81747` → `bifogatLanebevisBanklan`.
- Enum: `"49648"` → `"STADIGVARANDE_SERVERING"`.
- OpenE-identiteten behålls i `x-oe`/`x-oe-alternativeID` så spårbarheten mot e-tjänsten överlever.

### 4.4 Flytta texten till ui-schemat

Exporten har `title` och `description` inbäddade i JSON-schemat. `schema.controller.ts` kopierar
redan `ui:title` in i schemat via `applyUiSchemaTitleToSchema`, och lokaliseringsdokumentet är
tydligt: display-text hör hemma i ui-schemat, som kan PUT:as utan att `schemaId` ändras. En rättad
formulering ska inte tvinga fram en ny schemaversion och därmed låsa gamla ärenden.

Alltså: `title`/`description` ut ur schemat, in i ui-schemat som `ui:title`, `ui:description` och
`ui:help`, med `x-i18n`-block för `en`. De långa hjälptexterna (t.ex. den på
`verksamhetens_inriktning`) är `ui:description`, inte fältbeskrivningar.

### 4.5 Flytta filuppladdningarna till bilagor

39 av 169 frågor är filuppladdningar. I OpenE-schemat är de `array` av `format: data-url`, alltså
base64 inuti formulärets värde. Det hör inte hemma i Katla:

- Ärendets JSON-parameter är ett enda `value`. En bifogad PDF gör att hela dokumentet skrivs om vid
  varje sparning, och en ansökan med registreringsbevis, ägarförhållanden, registerutdrag,
  planritning, brandskyddsdokumentation och meny bär då flera megabyte base64 i varje PUT.
- Det finns ingen väg att hämta, byta eller ta bort en enskild fil, och inget ställe för
  filstorlek, filtypskontroll eller virusskanning.
- SupportManagement äger redan ärendebilagor — `ErrandAttachment` finns i de genererade
  kontrakten — och `frontend/src/components/tabs/tabs.tsx` har redan en utkommenterad
  `common:tabs.attachments`-flik.

Uppladdningarna är därför lyfta ur JSON-schemat och hanteras av en bilagekomponent mot
SupportManagement.

**Så här blev det.** Filfrågorna är inte längre properties — men schemat *deklarerar* dem, som
avsnittet alltid tänkt sig, under `x-attachments` i schemaroten:

```json
"x-attachments": [
  { "key": "POWER_OF_ATTORNEY", "label": "Fullmakt",
    "requiredWhen": { "properties": { "arDuFirmatecknare": { "const": "NEJ" } },
                      "required": ["arDuFirmatecknare"] } }
]
```

`requiredWhen` är exakt det `allOf`-villkor som gjorde filfältet obligatoriskt, så appen läser det
med samma villkorstolk (`matchesSchemaCondition`) som den läser schemats egna villkor.
Frontend har ingen egen lista: `attachmentTypesOfSchema` plockar blocket ur det schema som redan
laddas för Ärendeuppgifter, vilket betyder att en ny ärendetyp får sina bilagor utan att appen
släpps om. Ett schema utan blocket kräver helt enkelt ingen särskild bilaga.

- **Filuppladdningswidgeten behövs inte** i någondera appen. Bilagorna ligger i ett eget
  Bilagor-avsnitt i registreringsformuläret (`errand-attachments.component.tsx`) och laddas upp mot
  `/supportmanagement/errand/:id/attachments`.
- `$external:`-stödet i `ObjectFieldTemplate` behövdes inte: avsnittet står för sig självt i
  formuläret i stället för att pekas ut inifrån ui-schemat.
- SupportManagement har ännu ingen kategori på `ErrandAttachment`. Bilagetypen väljs och valideras i
  klienten och följer med hela vägen ner i BFF:en, men släpps i det uppströms anropet —
  `UPSTREAM_CATEGORY_FIELD` i `supportmanagement-attachment.controller.ts` är enda stället att
  ändra när fältet finns.

## 5. Ui-schemat

Draken har redan tre färdiga ui-scheman för samma renderare —
`draken/frontend/src/supportmanagement/investigation/avvikelse/schemas/utredning-*.ui-schema-request.json`.
De är förlagan: kuvertet är `UiSchemaRequest` (`value`, `description`), ett ui-schema per
JSON-schema.

### Vokabulär som redan finns i Draken

| Konstruktion                                                        | Används till                                                                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui:sections` `{ id, title, icon, defaultOpen, fields }`            | Dragspelen. Ersätter OpenE:s steg; `id` måste vara stabilt eftersom lokaliseringen binder mot det. Ikonerna är Lucides kebab-case-namn (`menu`, `file-text`, `users`, `info`, `pen`). |
| `ui:order`                                                          | Fältordning, på rot- och objektnivå                                                                                                                                                   |
| `ui:rows` `{ fields, gap }`                                         | Vågrät gruppering, t.ex. `gap-24`                                                                                                                                                     |
| `ui:widget`                                                         | Widgetval per fält                                                                                                                                                                    |
| `ui:options.className`                                              | Bredd/höjd, t.ex. `w-full max-w-[48rem]`                                                                                                                                              |
| `ui:options.multiple`                                               | Flerval på `checkboxes`/`ComboboxWidget`                                                                                                                                              |
| `ui:options.showObjectFieldset`                                     | Fältgrupp med `fieldset`/`legend` för nästlade objekt                                                                                                                                 |
| `ui:options.addable` / `orderable` / `itemTitle` / `addButtonLabel` | Arrayer av objekt                                                                                                                                                                     |
| `items: { ui:order, ui:rows, … }`                                   | Ui-schema för raderna i en array                                                                                                                                                      |
| `ui:placeholder`, `ui:readonly`                                     |                                                                                                                                                                                       |
| `$external:<namn>` i `ui:sections.fields`                           | Platshållare för något som renderas i sektionen men inte finns i schemat — Draken använder `$external:errandClassification`                                                           |

`$external:` är precis vad AoT behöver när ärendetypen och ärendeägaren flyttar ut ur formuläret
(4.1 och 4.2): sektionen kan fortfarande visa dem, utan att de blir schemafält.

### Widgetval per OpenE-frågetyp

| queryTypeID                    | ui:widget                                   | Läge                            |
| ------------------------------ | ------------------------------------------- | ------------------------------- |
| RadioButtonQuery               | `RadiobuttonWidget`                         | Finns i båda                    |
| CheckboxQuery (array)          | `checkboxes` → `CheckboxGroupWidget`        | Finns i båda                    |
| TextFieldQuery                 | `TextWidget`                                | Finns                           |
| TextAreaQuery                  | `TexteditorWidget`                          | Finns                           |
| DateTimeQuery (datum)          | `DateWidget`                                | Finns                           |
| DateTimeQuery (tid)            | `TimeWidget`                                | Finns i båda                    |
| FileUploadQuery                | `file`                                      | **Måste byggas i båda apparna** |
| DynamicTableQuery              | array-mall med `itemTitle`/`addButtonLabel` | Saknas i Katla, finns i Draken  |
| ContactDetail / CompanyDetails | —                                           | Utgår, se 4.2                   |

Varning från Drakens eget registerkommentar: `TextareaWidget` renderar **inte** en `<textarea>`
utan Quill-editorn och lagrar HTML, och den ockuperar RJSF:s reserverade namn `textarea`. Det finns
ingen enkel flerradig textwidget i någon av apparna. AoT har 19 TextArea-frågor; avgör per fält om
HTML är önskvärt (t.ex. `meny`, `verksamhetsbeskrivning`) eller om en ren `TextWidget` räcker.

### OpenE-exporten har ett eget ui-schema

`aot_tobak_ny_for_draken-2153.uischema.json` är OpenE:s eget ui-schema. Det går inte att använda som
det är — det saknar `ui:sections` helt, och dess `textarea`-alias landar i Quill-editorn i båda
apparna, inte i en vanlig flerradig ruta. Men en sak i det finns ingen annanstans:

`ui:options.oeDescriptionHtml` bär **länkarna** som JSON-schemats `description` har plattat bort.
Schemat renderar `Läs mer på sidan Så här hämtas dina företagsuppgifter.` med `href` borta, medan
ui-schemat har `<a href="http://bolagsverket.se/...">`. Tretton av 42 fält i tobaksflödet har
riktig HTML där. Katlas `sanitizeFieldDescription` stöder redan länkar (med uppläsning av "öppnas i
ny flik") och `ul`/`ol`, så det är precis vad den maskineriet är byggt för.

Generatorn läser därför OpenE:s ui-schema och tar `ui:description` därifrån, men slänger skräpet: en
del poster är CKEditor-rester av formen `<p> </p><style>.cke{visibility:hidden;}</style>`. I
alkoholflödet ger det 52 fält med riktig HTML och noll skräpposter.

Notera också att tobaksexportens schema är ett **naket** JSON Schema, inte
`{name, version, value, description}`-kuvertet som alkoholexporten använder. Inläsningen måste tåla
båda.

### Filkonventionen — Drakens

Draken versionshanterar sina scheman som färdiga request-bodies i repot och publicerar dem manuellt
(`draken/frontend/src/supportmanagement/investigation/avvikelse/schemas/README.md`):
`*.schema-request.json` går till `POST /2281/schemas`, och det skapade schema-ID:t används sedan med
`*.ui-schema-request.json` i `PUT /2281/schemas/{id}/ui-schema`. Katalogens README listar namn,
version och vad som faktiskt är publicerat i test — att en artefakt finns i repot betyder inte att
den är publicerad. Publicerade versioner behandlas som immutabla; ändrad presentation publiceras med
ett nytt versionsnummer. Till det hör ett kontraktstest med fixtures: ett giltigt `formData` plus
negativa fall per schema.

AoT ska följa samma konvention, med ett par filer per ärendetyp när uppdelningen i 4.1 är gjord.

### Ui-schemat genereras, inte skrivs

169 fält gör handredigering ohållbar, och widgetvalet följer mekaniskt ur `x-oe.queryTypeID` medan
sektionerna följer ur vilken gren som kan nå frågan. Därför genereras ui-schemat:

- `docs/jsonschemas/build-ui-schema.mjs` — läser båda OpenE-exporterna, kör samma
  nåbarhetsanalys som avsnitt 2 och skriver ut båda request-kropparna.
- `docs/jsonschemas/aot_opene_test.ui-schema-request.json` — resultatet, i `UiSchemaRequest`-kuvert.
- `backend/src/mocks/aot-ui-schema.json` — samma fil, serverad av mocken tillsammans med schemat.

Generatorn kastar om en fråga hamnar i noll eller i flera sektioner, så uppdelningen kan inte tysta
tappa fält. Sektionerna blir:

| Sektion                                                 | Frågor |
| ------------------------------------------------------- | ------ |
| Kontaktuppgifter och företag                            | 18     |
| Om ansökan (gemensamt: ärendetyp + kassaregister)       | 3      |
| Ansökan som privatperson                                | 17     |
| Stadigvarande serveringstillstånd                       | 42     |
| Tillfälligt tillstånd (allmänheten och slutet sällskap) | 13     |
| Tillfälligt tillstånd, endast slutet sällskap           | 3      |
| Servering av folköl (klass 2)                           | 12     |
| Gårdsförsäljning                                        | 13     |
| Catering till slutna sällskap                           | 17     |
| Provsmakning                                            | 23     |
| Frågor utan synlighetsregel                             | 8      |

Den sista sektionen är de åtta frågorna ur avsnitt 2 som ingen regel kan nå. De renderas hellre
under en tydlig rubrik än försvinner tyst innan flödesägaren har svarat.

Ui-schemat är interimistiskt: nycklarna är OpenE:s och byts i 4.3, och sektionerna blir egna scheman
i 4.1. Generatorn är den bestående delen — den flyttar med.

Texten ligger kvar i JSON-schemat så länge; `applyUiSchemaTitleToSchema` skulle bara skriva tillbaka
den. Flytten till `ui:title`/`x-i18n` (4.4) görs i samma steg som nyckelbytet.

### Widgetregistret är samsynkat med Draken

Katlas register låg tidigare fyra namn efter Drakens, och ett Draken-författat ui-schema hade
tappat **varje radioknapp** i Katla — RJSF faller tillbaka på sin standardwidget utan att klaga.
Registren är nu identiska: `frontend/src/components/json/widgets/index.ts` speglar
`draken/frontend/src/common/components/json/widgets/index.componant.tsx`, namn för namn.

Kanoniska namn (komponentens PascalCase-namn) samt alias:

```
TextWidget  SelectWidget  RadiobuttonWidget  CheckboxWidget  CheckboxGroupWidget
DateWidget  TimeWidget  ComboboxWidget  TexteditorWidget  TextareaWidget
RadioWidget  text  select  radio  radiobutton  checkbox  checkboxes
checkboxGroup  checkbox-group  date  time  combobox  texteditor  textarea
```

Tillkom i Katla: `CheckboxGroupWidget` (flervalskryssrutor, fanns inte alls), `TextareaWidget`
(Quill utan verktygsrad, delar nu `RjsfTextEditor` med `TexteditorWidget`) och aliasen
`RadiobuttonWidget`, `radiobutton`, `checkboxes`, `checkboxGroup`, `checkbox-group`, `textarea`.

En avvikelse från Draken är avsiktlig: Drakens `CheckboxGroupWidget` renderar sin egen `fieldset`
eftersom Drakens `FieldTemplate` alltid sätter `htmlFor`. Katlas `FieldTemplate` ger i stället
grupper `fieldset`/`legend` — ett åtagande i `docs/wcag-conformance-review.md` — så Katlas widget
renderar bara gruppen och `isGroupWidgetName` (`group-widget-names.ts`, tidigare
`radio-widget-names.ts`) avgör vilka namn som räknas som grupp. Lägg till nya gruppalias på båda
ställena, annars får gruppen en etikett som pekar på ingenting.

Kvar att bygga i Katla: en `ArrayFieldTemplate` för DynamicTable-frågorna. Drakens
`array-object-field-template.componant.tsx` med `itemTitle`/`addButtonLabel`/`addable`/`orderable` är
förlagan. Filuppladdningswidgeten utgår, se 4.5.

Radioknappar med långa alternativ — `kunskap_om_alkohollagen`, vars tre alternativ är hela
meningar — bör bli `select` eller `ComboboxWidget`.

Texten läggs i ui-schemat med `x-i18n`-block för `en`, enligt 4.4.

## 6. Validering som måste läggas till

Exporten har i praktiken inga begränsningar. Minst detta ska med innan v1.0 publiceras:

- `pattern` för de nio fält som har `x-oe-format`: personnummer, organisationsnummer, postnummer.
  Använd samma mönster som redan finns i ContactDetail-blocken (`^(19|20)?\d{6}[-+]?\d{4}$`,
  `^\d{3}\s?\d{2}$`) — och samma personnummersanering som backend redan gör, framtida födelsedatum
  inräknat.
- Åldersgrinden: 20 år, kontrollerad i backend mot SAML-profilen (se avsnitt 2).
- `format: email` på alla e-postfält (finns bara på ContactDetail idag).
- Obligatoriska bilagor per gren — inte som `minItems` i schemat längre, se 4.5.
- `maxLength` på TextArea-fält. `HtmlAwareAjv2020` mäter `maxLength` på HTML-strippad text, så
  gränsen kan sättas i tecken användaren faktiskt skrivit.
- Datumordning: `endDate` ≥ `startDate`. Går inte att uttrycka i draft 2020-12 utan `$data`; lägg
  det i felhanteringen eller låt backend fånga det.
- `x-oe-dateRestrictions.timeInterval: "15"` → 15-minuterssteg i `time`-widgeten.
- `x-oe-allowedFileExtensions` (`doc`, `docx`, `pdf`) → `accept` i filwidgeten.
- `x-oe-invalidFormatMessage` bär färdiga svenska felmeddelanden. De bör flyttas till
  `locales/sv/validation.json` via `createJsonErrorTransformer`, inte ligga kvar i schemat.

## 7. Öppna frågor

1. **Är köksblocket i cateringgrenen dött?** Fem frågor plus tre till kan aldrig bli synliga i flöde 2181. Fel i flödet, eller något exporten missat? Frågan går till flödesägaren.
2. **Ska privatpersonsgrenen finnas i Katla?** Den utlöses av "Nej, jag ansöker som privatperson",
   men Katla kräver att en organisation väljs som ärendeägare. Antingen byggs grenen medvetet eller
   så stryks den — den ska inte bli ett fält som inte går att nå.
3. **Obligatoriskhet.** Bara 51 av 169 frågor kan bli obligatoriska idag, och sex av sju grenar
   öppnar sina fält som valfria. Vilka fält som faktiskt krävs bör beslutas av verksamheten.
4. **Ska `foretagsform` frågas eller hämtas?** Den styr fyra uppladdningsregler.
5. **Nyckel- och enumkonvention** — svensk eller engelsk camelCase. Låses i samma stund som första
   ärendet sparas.
6. ~~**Bilagekategorier och deras obligatoriskhet** (4.5)~~ — avgjord: katalogen ligger i
   `frontend/src/constants/attachment-types.ts` och `requiredWhen` bär schemats eget villkor.
7. **Hur hanteras tobaksflödets flerval?** En inlämning kan avse tobak, e-cigaretter och nikotinfria
   produkter samtidigt, men ett ärende bär en enda ärendetyp i `errand.labels`. Ett ärende per vald
   produkt, eller en ärendetyp med produkturvalet kvar som ett fält?
8. **Behövs en ärendetyp för tobaksfria nikotinprodukter?** Alternativ 30345 saknar motsvarighet i
   etikettträdet. Se `aot-branch-label-mapping.md`.

## 8. Arbetsordning

| Steg | Innehåll                                                                                                                                                                                                    | Beroende         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 0 ✔  | Mocka jsonschema-tjänsten (`backend/src/mocks/aot-schema.mock.ts`) med både schema och genererat ui-schema, så exporten kan renderas som den är                                                             | —                |
| 1 ◐  | Be om en ny export med de 19 saknade informationsfrågorna och svar på köksblocket. Viktreglernas tröskelvärden rekonstrueras för hand ur regelnamnen i stället — entydigt, och blockerar därmed inte steg 3 | Blockerar steg 3 |
| 2 ◐  | Etikettträdets löv är klara och uppdelningen beslutad. Kvar: `OUTSTANDING_QUESTIONS.md` — obligatoriskhet och köksblocket rör alkoholuppdelningen, tobaksflervalet bara tobak                               | Blockerar steg 3 |
| 3 ◐  | Skriv ett transformskript: OpenE-export + regler → Katla-schema + ui-schema. Deterministiskt, så migreringen kan köras om mot en ny export fram till lansering                                              | 1, 2             |
| 4 ◐  | Widgetregistret är samsynkat med Drakens, flervalskryssrutorna finns (17 frågor) och nästlade objekt får rubrik (44 frågor). Kvar: `ArrayFieldTemplate` för DynamicTable (17 frågor, tas från Draken)       | —                |
| 5 ✔  | Villkorsmotorn ligger i `frontend/src/components/json/utils/schema-conditions.ts`: `enum`, `contains`, flera regler per fält, dolda svar rensas, okänt nyckelord visar fältet och varnar                    | —                |
| 5b ✔ | Bilagor: eget Bilagor-avsnitt i formuläret, bilage-endpoints i BFF:en och bilagekatalog per ärendetyp. Filfrågorna är borta ur ärendetypernas scheman (4.5)                                                  | 2                |
| 6    | Lägg på valideringen i avsnitt 6, inklusive åldersgrinden i backend                                                                                                                                         | 3                |
| 7    | Publicera v1.0 enligt Drakens konvention (`POST /schemas`, sedan `PUT .../ui-schema`), **strippa `x-oe*`** (se nedan), lägg till README och kontraktstest, ta bort mocken                                    | 3–6              |

### `x-oe*` strippas vid publiceringen

Alla `x-oe`-nycklar är OpenE-proveniens och läses inte av någon app — varken Katla eller Draken.
De hör inte hemma i det publicerade schemat, men är kvar så länge generatorn används: `x-oe.queryID`
och `x-oe-alternativeID` är enda tråden tillbaka till OpenE-frågan, och alltså det som gör en ny
export diffbar mot ett publicerat schema.

| Nyckel | Vad som händer vid strippningen |
| ------ | ------------------------------- |
| `x-oe`, `x-oe-alternativeID`, `x-oe-flow` | Ren proveniens, försvinner utan förlust |
| `x-oe-format` | Dubblett — `pattern` bredvid säger redan samma sak |
| `x-oe-invalidFormatMessage` | OpenE:s felmeddelanden, ersatta av appens egna i `locales/*/validation.json` |
| `x-oe-dateRestrictions` | **Bar en regel som inget annat uttryckte.** Kvartsstegen i serveringstiderna ligger nu som `ui:options.step` (sekunder) i ui-schemat och överlever strippningen |

Kommer nya `x-oe`-nycklar med en framtida export måste samma kontroll göras: bär nyckeln en regel
som schemat inte uttrycker någon annanstans, eller är den bara proveniens?

Steg 4 och 5 är oberoende av 1–3 och kan börja direkt — de behövs oavsett hur schemat delas.
