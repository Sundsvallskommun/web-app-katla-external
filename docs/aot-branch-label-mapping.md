# OpenE-grenar mot ärendetyper i etikettträdet

> Historik: OpenE-exporterna och generatorn i `docs/jsonschemas/` togs bort 2026-09-14 (finns i git-historiken). Schemana underhålls nu direkt i `backend/src/mocks/` i väntan på jsonschema-tjänsten; se `docs/schema-control-assumptions.md`.


Status: Uppdaterad mot etikettträdet 2026-09-09

Kartan mellan OpenE:s grenar och ärendetyperna i `docs/label-structure.json`, som avgör vilket
JSON-schema en ärendetyp väljer (se `aot-form-schema-plan.md` avsnitt 4.1). Grenarna kommer från
exporterna i `docs/jsonschemas/`.

`label-structure.json` innehåller även två utfasade rotnoder utanför `CATEGORY_ROOT` (`ANSOKAN` och
`UNCATEGORIZED`). BFF:en plockar ut subträdet under `CATEGORY_ROOT`, så de når aldrig frontend och
räknas inte här.

Trädet har nu tre nivåer: `CATEGORY_ROOT → CATEGORY → TYPE → SUBTYPE`, med 17 valbara löv. Ett löv
är ett `TYPE` utan barn eller ett `SUBTYPE`. Schemanamnet är appens SM-namespace följt av hela
vägen ned till lövet, gemener med `_` mellan nivåerna — inte bara lövet, som bara är unikt under
sin egen förälder.

## Alkohol — flöde 2181

Antalet frågor är nåbarhet räknad ur reglerna: först de frågor grenen kan visa, sedan totalen
inklusive det gemensamma företags- och kontaktblocket.

| #   | OpenE-alternativ                                                     | Alt-ID | Egna | Totalt | Löv i trädet                                           |
| --- | -------------------------------------------------------------------- | ------ | ---- | ------ | ------------------------------------------------------ |
| 1   | Ansöka om stadigvarande tillstånd för servering av alkoholdrycker    | 49648  | 45   | 62     | `SERVING_PERMIT_APPLICATION/PERMANENT_SERVING`         |
| 2   | Ansöka om tillfälligt tillstånd för servering till allmänheten       | 49649  | 16   | 33     | `SERVING_PERMIT_APPLICATION/TEMPORARY_SERVING_PUBLIC`  |
| 3   | Ansöka om tillfälligt tillstånd för servering till slutet sällskap   | 49650  | 19   | 36     | `SERVING_PERMIT_APPLICATION/TEMPORARY_SERVING_PRIVATE` |
| 4   | Anmäla servering av endast folköl (klass 2)                          | 49651  | 15   | 32     | `FOLKOL_SERVING_NOTIFICATION`                          |
| 5   | Ansöka om tillstånd för gårdsförsäljning                             | 49652  | 16   | 33     | `SERVING_PERMIT_APPLICATION/FARM_SALES`                |
| 6   | Ansökan om stadigvarande tillstånd för catering till slutna sällskap | 49653  | 20   | 37     | `SERVING_PERMIT_APPLICATION/PERMANENT_CATERING`        |
| 7   | Ansökan om provsmakning av alkoholhaltiga drycker                    | 49654  | 26   | 43     | `SERVING_PERMIT_APPLICATION/TASTING`                   |
| 8   | Ansökan som privatperson — inget alternativ, en egen väg             | —      | 17   | 19     | inget löv, avsiktligt                                  |

Alla sju alternativ har nu ett löv. Två av dem matchar inte på text: gren 4 mot
`FOLKOL_SERVING_NOTIFICATION` och gren 7 mot `TASTING` ("Provsmakning"). Kopplingarna är entydiga i
sak, men bindningen gren → löv måste därför vara en uttrycklig tabell i transformskriptet, inte en
textmatchning.

Gren 8 utlöses av `Företräder du ett företag? → Nej` som första fråga i flödet och döljer
ärendetypsfrågan helt — den har medvetet inget löv.

## Tobak — flöde 2153

`vad_vill_du_gora_80555` är en kryssrutefråga, inte en radioknappsfråga, och reglerna ger alla tre
alternativen samma åtta följdfrågor. Det enda alternativsspecifika är att en fråga döms bort när
_endast_ nikotinfria produkter är valda. Flöde 2153 är därför **ett formulär med en
flervalsomfattning**, inte tre grenar: 42 frågor totalt, 16 i kontaktsteget och 26 i ansökan. Ett
och samma schema betjänar alltså alla tre löven — och en inlämning kan kryssa flera, medan ett
ärende bär en enda typ. Se `OUTSTANDING_QUESTIONS.md` fråga 1.

| Alternativ i `vad_vill_du_gora`                                           | Alt-ID | Löv i trädet                               |
| ------------------------------------------------------------------------- | ------ | ------------------------------------------ |
| Ansökan om tillstånd för försäljning av tobak                             | 30343  | `SALES_PERMIT_APPLICATION`                 |
| Anmälan om försäljning av elektroniska cigaretter och påfyllnadsbehållare | 30344  | `ECIGARETTE_SALES_NOTIFICATION`            |
| Anmälan om försäljning av tobaksfria nikotinprodukter                     | 30345  | `TOBACCO_FREE_NICOTINE_SALES_NOTIFICATION` |

## Löv utan export

| Löv                                 | Visningsnamn                                            | Läge                                 |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| `ALCOHOL/SERVING_PERMIT_CHANGE`     | Förändring av befintligt serveringstillstånd            | ingen export                         |
| `ALCOHOL/SERVING_PERMIT_ADDITION`   | Tillägg av befintligt serveringstillstånd               | ingen export                         |
| `ALCOHOL/FOLKOL_SALES_NOTIFICATION` | Anmälan om försäljning av folköl                        | ingen export — finns **inte** i 2153 |
| `ALCOHOL/ALCOHOL_INSPECTION`        | Tillsyn                                                 | myndighetsinitierad, ingen ansökan   |
| `TOBACCO/TOBACCO_INSPECTION`        | Tillsyn                                                 | myndighetsinitierad, ingen ansökan   |
| `TOBACCO/SALES_PERMIT_CHANGE`       | Ändring av tillståndspliktig försäljning av tobaksvaror | ingen export — 2153 är "ny"          |
| `TOBACCO/SALES_PERMIT_TERMINATION`  | Avslut av tillståndspliktig försäljning av tobaksvaror  | ingen export                         |

## Kvarstående frågor

Alla grenar i båda exporterna har nu ett löv. Kvar är hur tobaksflödets flerval ska bli ärenden —
`OUTSTANDING_QUESTIONS.md` fråga 1.

## Avgjort av trädets nuvarande form

- **Gårdsförsäljning ligger under `SERVING_PERMIT_APPLICATION`** som `FARM_SALES`, trots att det är
  ett försäljnings- och inte ett serveringstillstånd.
- **Tillfällig servering är två löv**, inte ett med villkorade frågor. De två delar hela sitt
  frågeblock; 49650 lägger till tre frågor om gäster och gästlista, så blocket blir ett `$defs`.
- **Privatpersonsvägen har inget löv** och ingår därmed inte i uppdelningen.
- **`ALCOHOL_INSPECTION` / `TOBACCO_INSPECTION`** särskiljer nu de två tillsynstyperna, så Drakens
  `getLabelTypeFromName` inte längre kan lösa upp fel nod.

## Uppdelningen som den ser ut nu

Åtta scheman täcker exporterna: sju alkoholscheman, ett per löv i tabellen ovan, och ett
tobaksschema som betjänar tobakskategorins tre försäljningslöv. Sju löv har ingen export och därmed
inget schema.

| Löv                                                    | Schema            | Egna frågor |
| ------------------------------------------------------ | ----------------- | ----------- |
| `SERVING_PERMIT_APPLICATION/PERMANENT_SERVING`         | eget              | 45          |
| `SERVING_PERMIT_APPLICATION/TASTING`                   | eget              | 26          |
| `SERVING_PERMIT_APPLICATION/PERMANENT_CATERING`        | eget              | 20          |
| `SERVING_PERMIT_APPLICATION/TEMPORARY_SERVING_PRIVATE` | eget              | 19          |
| `SERVING_PERMIT_APPLICATION/TEMPORARY_SERVING_PUBLIC`  | eget              | 16          |
| `SERVING_PERMIT_APPLICATION/FARM_SALES`                | eget              | 16          |
| `FOLKOL_SERVING_NOTIFICATION`                          | eget              | 15          |
| tobakens tre försäljningslöv                           | delat, flöde 2153 | 26          |
