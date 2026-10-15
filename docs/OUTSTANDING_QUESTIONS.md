# Öppna frågor

Frågor som behöver ett svar från verksamheten eller teamet innan arbetet kan gå vidare. En fråga
som besvarats flyttas till det dokument där beslutet hör hemma, inte hit.

## 1. Vad ska en tobaksinlämning med flera val bli för ärende?

**Behövs innan tobaksschemat författas. Blockerar inte de sju alkoholschemana.**

Tobaksflödets första fråga, `vad_vill_du_gora_80555` i flöde 2153, är en **kryssrutefråga**
(`type: array`, `uniqueItems`) med tre alternativ:

| Alternativ                                                                | Alt-ID | Ärendetyp i etikettträdet                          |
| ------------------------------------------------------------------------- | ------ | -------------------------------------------------- |
| Ansökan om tillstånd för försäljning av tobak                             | 30343  | `TOBACCO/SALES_PERMIT_APPLICATION`                 |
| Anmälan om försäljning av elektroniska cigaretter och påfyllnadsbehållare | 30344  | `TOBACCO/ECIGARETTE_SALES_NOTIFICATION`            |
| Anmälan om försäljning av tobaksfria nikotinprodukter                     | 30345  | `TOBACCO/TOBACCO_FREE_NICOTINE_SALES_NOTIFICATION` |

En sökande kan kryssa i flera — en närbutik som säljer både cigaretter och e-cigaretter kryssar
rimligen två. Reglerna ger dessutom alla tre alternativen exakt samma 26 följdfrågor, så formuläret
är identiskt oavsett vad som kryssas. Det är alltså en ifyllning och en inlämning.

Men de tre alternativen är **tre olika ärendetyper**, och ett ärende bär en enda typ. Det är
strukturellt i koden, i båda riktningarna:

- `getSelectedLabels` (`frontend/src/utils/label-tree.ts`) gör `.find()` **per klassificering** — en
  CATEGORY, en TYPE, en SUBTYPE. En andra TYPE i arrayen skulle aldrig läsas.
- `toErrandLabels` tar `(category, type?, subtype?)` — skrivvägen kan bara producera en kedja.

Alkoholflödet har inte problemet: dess motsvarande fråga är en radioknapp, alltså en gren, ett löv,
en typ.

### Alternativ

1. **Ett ärende per ikryssad produkt.** Samma 26 svar arkiveras två eller tre gånger, och
   handläggaren får flera ärenden för samma verksamhet.
2. **Ett ärende med en bredare ärendetyp**, där produkturvalet blir ett fält i schemat i stället för
   en ärendetyp. Då beskriver inte längre `SALES_PERMIT_APPLICATION`,
   `ECIGARETTE_SALES_NOTIFICATION` och `TOBACCO_FREE_NICOTINE_SALES_NOTIFICATION` var för sig vad
   som lämnats in.
3. ~~Ett ärende som bär flera ärendetyper.~~ **Uteslutet.**

Frågan är verksamhetens, inte teknikens: vad _ska_ en tobaksinlämning bli i handläggarens inkorg?

## 2. Är köksblocket i cateringgrenen dött?

**Frågan går till flödesägaren.**

Åtta av flöde 2181:s 169 frågor kan aldrig bli synliga. Alla frågor i flödet har
`defaultQueryState: HIDDEN`, och dessa åtta är varken mål för någon regel eller källa till en
viktregel — det finns alltså ingenting som kan visa dem:

| Fråga                                            | Gren                                                            |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `kapacitet_81832`                                | catering                                                        |
| `koksinformation_81833`                          | catering                                                        |
| `planritning_kok_81834`                          | catering                                                        |
| `brandskydd_kok_81835`                           | catering                                                        |
| `hyresavtal_eller_upplatelseavtal_kok_81836`     | catering                                                        |
| `har_ni_anmalt_koket_som_livsmedelsanlagg_81830` | catering (är källa till en regel, men blir aldrig själv synlig) |
| `jag_vill_81784`                                 | folköl                                                          |
| `bifoga_livsmedelsregistrering_fran_miljo_81797` | folköl                                                          |

De sex första är hela köksblocket i cateringgrenen — kapacitet, adress, planritning, brandskydd och
hyresavtal för köket. Att en cateringansökan inte skulle fråga om köket ser ut som ett förbiseende.

Antingen är det ett fel i flöde 2181, eller så styrs frågorna av något som exporten inte tagit med.
Behövs de i schemat, eller ska de strykas? Ta inte med dem förrän svaret finns — ett fält som inte
går att nå är värre än inget fält.

## 3. Vilka fält ska faktiskt vara obligatoriska?

**Frågan är verksamhetens.**

OpenE sätter en fråga till `VISIBLE` eller `VISIBLE_REQUIRED` när en regel visar den. I flöde 2181
kan bara **51 av 169** frågor någonsin bli obligatoriska, och fördelningen ser inte avsiktlig ut:
av de sju grenrubrikerna öppnar **bara folkölsgrenen** sina fält som `VISIBLE_REQUIRED`. De övriga
sex — stadigvarande, båda de tillfälliga, gårdsförsäljning, catering och provsmakning — öppnar sina
fält som valfria. En stadigvarande ansökan kan alltså skickas in utan serveringsställe, utan
serveringstider och utan finansiering.

Det ser ut som inkonsekvens i flödesbygget snarare än ett beslut. Obligatoriskheten bör därför
bestämmas från grunden per fält och gren, inte ärvas från exporten. Det som beslutas blir
`then.required` i schemat och styr både formulärets validering och vad handläggaren kan lita på.

## 4. Ska `foretagsform` frågas eller hämtas?

Företagsformen finns i `legalentity` och behöver rimligen inte frågas, men den styr fyra
uppladdningsregler i flöde 2181. Se `aot-form-schema-plan.md` avsnitt 4.2.

## 5. Vad ska bilagekategorierna heta, och hur valideras ett obligatoriskt bilagekrav?

Filuppladdningarna lyfts ur JSON-schemat och hanteras som ärendebilagor. Kvar att bestämma är
kategoriernas namn och hur "obligatorisk bilaga i den här grenen" valideras vid insändning när det
inte längre är ett `required` i schemat. Se `aot-form-schema-plan.md` avsnitt 4.5.
