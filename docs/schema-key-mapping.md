# English keys for the AoT errand schemas

Status: applied to `backend/src/mocks/`, 2026-10-30. Source of the target names: the PartyAsset schemas for AoT
(`aot_alcohol_party_asset`, `aot_tobacco_party_asset`).

Rules used:

1. Where an errand field feeds a PartyAsset field, the errand key takes the asset's name (leaf names
   too: `street`, `postalCode`, `city`, `careOf`, `phoneNumber`, `emailAddress`, `firstName`, ...).
2. The errand structure is kept. The asset nests the premises and groups periods/hours into arrays
   per audience and location; the form keeps them as flat root fields, so the asset name becomes a
   prefix (`premisesAddress`, not `premises.address`). Restructuring would change sections and
   conditionals and is out of scope.
3. A name is not reused when the shape differs from the asset field of the same name (the asset's
   `servingTo` and `servingHours` are arrays; the form's are single values).
4. Alcohol uses the asset term `premises`, tobacco uses `pointOfSale`. Folköl belongs to the
   alcohol asset (LowAlcoholBeer\*Notification), so it uses `premises`.
5. Date ranges use `fromDate`/`toDate` (as `servingPeriods[]` and `responsibleServingStaff[]` in the
   asset), clock ranges use `from`/`to` (as `servingHours[]`).
6. Radio "describe or upload" choices get the suffix `Choice`; yes/no questions read as predicates.

Schema numbers: 0–2 folköl (sales, sales+serving, serving), 3 farm-sales, 4 permanent-catering,
5 permanent-serving, 6 tasting, 7 temporary-serving-private, 8 temporary-serving-public,
9 e-cigarette, 10 tobacco sales permit, 11 tobacco-free nicotine.

## Keys that match a PartyAsset field

| Current key                                         | New key                                   | Asset field                                        | Schemas   |
| --------------------------------------------------- | ----------------------------------------- | -------------------------------------------------- | --------- |
| `serveringsstalletsNamn`                            | `premisesName` / `pointOfSaleName`        | `premises.name` / `pointOfSale.name`               | 0–3,5,7–11 |
| `besoksadress`                                      | `premisesAddress` / `pointOfSaleAddress`  | `premises.address` / `pointOfSale.address`         | 0–3,5–11  |
| `besoksadress.gatuadress`                           | `street`                                  | `$address.street`                                  |           |
| `besoksadress.postnummer`                           | `postalCode`                              | `$address.postalCode`                              |           |
| `besoksadress.postort`                              | `city`                                    | `$address.city`                                    |           |
| `kontaktuppgifterTillServeringsstallet`             | `premisesContact` / `pointOfSaleContact`  | `premises` / `pointOfSale`                         | 0–3,5,7–11 |
| `kontaktuppgifterTillServeringsstallet.telefonnummer` | `phoneNumber`                           | `premises.phoneNumber` / `pointOfSale.phoneNumber` |           |
| `kontaktuppgifterTillServeringsstallet.ePostadress` | `emailAddress`                            | `premises.emailAddress` / `pointOfSale.emailAddress` |         |
| `alkoholdrycker`                                    | `beverages`                               | `beverages`                                        | 3–8       |
| `kunskapOmAlkohollagen`                             | `knowledgeOfAlcoholAct`                   | `knowledgeOfAlcoholAct`                            | 3–8       |
| `serveringsansvarigPersonal`                        | `responsibleServingStaff`                 | `responsibleServingStaff`                          | 3,5,7,8   |
| `serveringsansvarigPersonal[].fornamn`              | `firstName`                               | `responsibleServingStaff[].firstName`              |           |
| `serveringsansvarigPersonal[].efternamn`            | `lastName`                                | `responsibleServingStaff[].lastName`               |           |
| `serveringsansvarigPersonal[].fodelsedatum`         | `dateOfBirth`                             | `responsibleServingStaff[].dateOfBirth`            |           |
| `serveringsansvarigPersonal[].fromDate`             | `fromDate` (unchanged)                    | `responsibleServingStaff[].fromDate`               |           |
| `ordningOchNykterhet`                               | `orderAndSobriety`                        | `orderAndSobriety`                                 | 4–8       |
| `harNi`                                             | `additionalScopes`                        | `additionalScopes` (ROOM_SERVICE, MINIBAR)         | 5         |
| `verksamhetensInriktning`                           | `businessOrientationTypes`                | `businessOrientation.types`                        | 5,6       |
| `beskrivVerksamhetensInriktning`                    | `businessOrientationDescription`          | `businessOrientation.description`                  | 5,6       |
| `serveringTillAllmanhetenEllerSlutetSallskap`       | `servingAudience`                         | `servingTo` (array in the asset)                   | 5         |
| `serveringsperiodForAllmanheten`                    | `publicServingPeriod`                     | `servingPeriods[audience=PUBLIC].period`           | 5         |
| `periodServeringAllmanheten`                        | `publicServingPeriodDates`                | `servingPeriods[audience=PUBLIC].from/to`          | 5         |
| `serveringstiderInomhusAllmanheten`                 | `publicServingHoursIndoor`                | `servingHours[PUBLIC, INDOOR]`                     | 5         |
| `serveringstiderUtomhusAllmanheten`                 | `publicServingHoursOutdoor`               | `servingHours[PUBLIC, OUTDOOR]`                    | 5         |
| `serveringsperiodForSlutetSallskap`                 | `closedCompanyServingPeriod`              | `servingPeriods[audience=CLOSED_COMPANY].period`   | 5         |
| `periodServeringSlutetSallskap`                     | `closedCompanyServingPeriodDates`         | `servingPeriods[audience=CLOSED_COMPANY].from/to`  | 5         |
| `serveringstiderInomhusSlutetSallskap`              | `closedCompanyServingHoursIndoor`         | `servingHours[CLOSED_COMPANY, INDOOR]`             | 5         |
| `serveringstiderUtomhusSlutetSallskap`              | `closedCompanyServingHoursOutdoor`        | `servingHours[CLOSED_COMPANY, OUTDOOR]`            | 5         |
| `sittplatserILokalen`                               | `seating`                                 | `servingArea`                                      | 5,7,8     |
| `sittplatserILokalen.antalSittplatserInomhus`       | `seatsIndoor`                             | `servingArea.seatsIndoor`                          |           |
| `sittplatserILokalen.antalSittplatserUteservering`  | `seatsOutdoor`                            | `servingArea.seatsOutdoor`                         |           |
| `maximaltAntalPersonerILokalen`                     | `maxPersonsInPremises`                    | `servingArea`                                      | 5,7,8     |
| `maximaltAntalPersonerILokalen.antalPersoner`       | `maxPersons`                              | `servingArea.maxPersons`                           |           |
| `beskrivForsaljningsplats`                          | `salesAreaDescription`                    | `servingArea.description`                          | 3         |
| `forsaljningsperiod`                                | `salesPeriod`                             | `servingPeriods[].period`                          | 3         |
| `angePeriodForForsaljning`                          | `salesPeriodDates`                        | `servingPeriods[].from/to`                         | 3         |
| `forsaljningstider`                                 | `salesHours`                              | `servingHours[]`                                   | 3         |
| `angeMellanVilkaDatumDetTillfalliga`                | `permitPeriodDates`                       | `servingPeriods[period=FIXED_PERIOD].fromDate/toDate` | 7,8    |
| `ovrigaUppgifterGallandeDatum`                      | `permitPeriodNotes`                       | `servingPeriods[].description`                     | 7,8       |
| `klockslagForServeringen`                           | `dailyServingHours`                       | `servingHours[]`                                   | 7,8       |
| `tidsperiodForForsaljningen`                        | `salesPeriod`                             | `salesPeriod.period`                               | 9–11      |
| `startdatumForsaljning`                             | `salesStartDate`                          | `salesPeriod.from` (indefinite)                    | 9–11      |
| `periodTidsbegransadForsaljning`                    | `salesPeriodDates`                        | `salesPeriod.from/to` (temporary)                  | 9–11      |
| `bedriverAvenDistansforsaljning`                    | `includesDistanceSelling`                 | `salesTypes` ∋ DISTANCE_SELLING                    | 9–11      |
| (all date ranges) `startDate` / `endDate`           | `fromDate` / `toDate`                     |                                                    |           |
| (all clock ranges) `startTime` / `endTime`          | `from` / `to`                             | `servingHours[].from/to`                           |           |

## Keys with no PartyAsset counterpart

| Current key                                       | New key                                   | Schemas   |
| ------------------------------------------------- | ----------------------------------------- | --------- |
| `arDuFirmatecknare`                               | `isAuthorizedSignatory`                   | all       |
| `fakturaadressSammaSomForetaget`                  | `invoiceAddressSameAsCompany`             | all       |
| `fakturamottagare`                                | `invoiceRecipient`                        | all       |
| `fakturamottagare.cO`                             | `careOf`                                  |           |
| `fakturamottagare.utdelningsadress`               | `street`                                  |           |
| `fakturamottagare.postnummer`                     | `postalCode`                              |           |
| `fakturamottagare.postort`                        | `city`                                    |           |
| `fakturareferens`                                 | `invoiceReference`                        | all       |
| `verksamhetsbeskrivningsval`                      | `businessDescriptionChoice`               | all       |
| `verksamhetsbeskrivning`                          | `businessDescription`                     | all       |
| `besoksadressSammaSomArendeagare`                 | `premisesAddressSameAsCompany` / `pointOfSaleAddressSameAsCompany` | 0–2,5,6,9–11 |
| `kontaktuppgifterTillServeringsstallet.hemsida`   | `website`                                 | 0–2,5     |
| `hemsida` (tobacco root)                          | `distanceSellingWebsite`                  | 9–11      |
| `stadigvarandeForsaljningAvLivsmedel`             | `hasPermanentFoodSales`                   | 0         |
| `tillverkarFolkolPaForsaljningsstallet`           | `producesLowAlcoholBeerOnPremises`        | 0         |
| `dokumentationKanVisasVidTillsyn`                 | `canShowDocumentationAtInspection`        | 0         |
| `egenkontrollprogramFolkol`                       | `selfMonitoringProgram`                   | 0–2       |
| `livsmedelsregistrerad`                           | `isFoodRegistered`                        | 1,2       |
| `livsmedelsregistreringKanVisasVidTillsyn`        | `canShowFoodRegistrationAtInspection`     | 1,2       |
| `literStarkol`                                    | `strongBeerLiters`                        | 3         |
| `literVin`                                        | `wineLiters`                              | 3         |
| `literSpritdrycker`                               | `spiritsLiters`                           | 3         |
| `literCider`                                      | `otherFermentedBeveragesLiters`           | 3         |
| `produktionenStartade`                            | `productionStartDate`                     | 3         |
| `beroendeTillAnnanTillverkare`                    | `dependsOnOtherProducer`                  | 3         |
| `beskrivBeroende`                                 | `dependencyDescription`                   | 3         |
| `produktionsbeskrivningsval`                      | `productionDescriptionChoice`             | 3         |
| `produktionsbeskrivning`                          | `productionDescription`                   | 3         |
| `besoksarrangemang`                               | `visitorArrangementsChoice`               | 3         |
| `beskrivBesoksarrangemanget`                      | `visitorArrangementsDescription`          | 3         |
| `personnummer`                                    | `knowledgeTestPassedBy`                   | 3–8       |
| `personnummer.personnummer`                       | `personalIdentityNumber`                  |           |
| `organisationsnummer`                             | `otherLicensedBusiness`                   | 3–8       |
| `organisationsnummer.organisationsnummer`         | `organizationNumber`                      |           |
| `anmalPersonerTillKunskapsprovet`                 | `knowledgeTestRegistration`               | 3–8       |
| `personerTillKunskapsprovet`                      | `knowledgeTestParticipants`               | 3–8       |
| `personerTillKunskapsprovet[].fornamn`            | `firstName`                               |           |
| `personerTillKunskapsprovet[].efternamn`          | `lastName`                                |           |
| `personerTillKunskapsprovet[].personnummer`       | `personalIdentityNumber`                  |           |
| `personerTillKunskapsprovet[].telefonnummer`      | `phoneNumber`                             |           |
| `personerTillKunskapsprovet[].ePostadress`        | `emailAddress`                            |           |
| `finansiering`                                    | `financing`                               | 3–8,10    |
| `egnaMedel`                                       | `ownFunds`                                | 3–8,10    |
| `egnaMedel[].bank`                                | `bank`                                    |           |
| `egnaMedel[].kontonummer`                         | `accountNumber`                           |           |
| `banklan`                                         | `bankLoans`                               | 3–8,10    |
| `privatlan`                                       | `privateLoans`                            | 3–8,10    |
| `annanFinansiering`                               | `otherFinancing`                          | 3–8,10    |
| `annanFinansiering[].lanetyp`                     | `loanType`                                |           |
| `*[].langivare`                                   | `lender`                                  |           |
| `*[].beloppKronor`                                | `amountSek`                               |           |
| `ovrigaUpplysningarFinansiering`                  | `financingNotes`                          | 3–8,10    |
| `serverasMat`                                     | `servesFood`                              | 4,7,8     |
| `godkannaCateringtillfalle`                       | `cateringOccasionAcknowledgement`         | 4         |
| `forfoganderattLokal`                             | `premisesRightOfUseDocuments`             | 5         |
| `harSamarbetsavtal`                               | `hasCooperationAgreement`                 | 5         |
| `arrangeraMassa`                                  | `arrangesTradeFair`                       | 6         |
| `dryckesmenyval`                                  | `drinksMenuChoice`                        | 7,8       |
| `dryckesmeny`                                     | `drinksMenuDescription`                   | 7,8       |
| `menyval`                                         | `menuChoice`                              | 7,8       |
| `menyBeskrivning`                                 | `menuDescription`                         | 7,8       |
| `gaster`                                          | `guestTypes`                              | 7         |
| `beraknatAntalGaster`                             | `expectedGuests`                          | 7,8       |
| `beraknatAntalGaster.antal`                       | `count`                                   |           |
| `hurHarGasternaBjuditsIn`                         | `guestInvitationMethod`                   | 7         |
| `vadArDetForTypAvTillstallning`                   | `eventType`                               | 7,8       |
| `finnsPolistillstand`                             | `hasAppliedForPolicePermit`               | 7,8       |
| `omfattarSarskiltFarligaProdukter`                | `includesParticularlyDangerousProducts`   | 9,10      |
| `avtalMedTillverkareEllerPartihandlare`           | `hasSupplierAgreement`                    | 9–11      |

## Enum values

Where an enum has an asset counterpart the asset's values are used:

| Key                       | Current → asset value                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `beverages`               | STARKOL → STRONG_BEER, VIN → WINE, SPRITDRYCKER → SPIRITS, CIDER_ELLER_ANDRA_JASTA_ALKOHOLDRYCKER → OTHER_FERMENTED_BEVERAGES |
| `knowledgeOfAlcoholAct`   | HAR_GODKANT_KUNSKAPSPROV → PASSED_KNOWLEDGE_TEST, DRIVER_ANNAT_FORETAG_MED_TILLSTAND → RUNS_OTHER_LICENSED_BUSINESS, BEHOVER_SKRIVA_KUNSKAPSPROV → KNOWLEDGE_TEST_REQUIRED |
| `additionalScopes`        | RUMSSERVERING → ROOM_SERVICE, MINIBAR                                                                       |
| `businessOrientationTypes`| RESTAURANG → RESTAURANT, NATTKLUBB_DANS → NIGHTCLUB_DANCE, SPEL_OBS_KRAVER_TILLSTAND_FRAN → GAMING, UNDERHALLNING → ENTERTAINMENT, HOTELL → HOTEL, CATERING_TILL_SLUTNA_SALLSKAP → CATERING_CLOSED_COMPANY, EVENEMANG → EVENT, TRAFIKSERVERING_INRIKES_TRAFIK_PA_FARTYG → TRANSPORT_SERVING; PARTIHANDLARE → WHOLESALER and TILLVERKARE → PRODUCER have no asset value |
| `*ServingPeriod`, `salesPeriod` (3) | ARET_RUNT → ALL_YEAR, ARLIGEN_UNDER_VISS_PERIOD → ANNUAL_PERIOD                                   |
| `salesPeriod` (9–11)      | TILLSVIDARE → INDEFINITE, TIDSBEGRANSAD_FORSALJNING → TEMPORARY                                             |
| `servingAudience`         | ENBART_TILL_ALLMANHETEN → PUBLIC, ENBART_TILL_SLUTET_SALLSKAP → CLOSED_COMPANY, BADE_TILL_ALLMANHETEN_OCH_TILL → PUBLIC_AND_CLOSED_COMPANY |

The remaining enums have no asset counterpart:

| Key(s)                                   | Current → new                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| every yes/no question                    | JA → YES, NEJ → NO                                                                                |
| `hasAppliedForPolicePermit`              | JA → YES, NEJ → NO, EJ_AKTUELLT → NOT_APPLICABLE                                                  |
| every `*Choice`                          | JAG_VILL_SKRIVA_VERKSAMHETSBESKRIVNINGEN_I, JAG_VILL_BESKRIVA, JAG_VILL_BESKRIVA_BESOKSARRANGEMANGET → DESCRIBE; JAG_VILL_BIFOGA_VERKSAMHETSBESKRIVNINGEN_SOM, JAG_VILL_LADDA_UPP, JAG_VILL_LADDA_UPP_BESKRIVNING → UPLOAD |
| `selfMonitoringProgram`                  | JA → YES, NEJ_JAG_FYLLER_I_DOKUMENTET → NO_CAN_SHOW_AT_INSPECTION                                 |
| `canShowDocumentationAtInspection`       | JAG_KAN_VISA_DOKUMENTATION → CAN_SHOW_DOCUMENTATION                                               |
| `canShowFoodRegistrationAtInspection`    | JAG_KAN_VISA_LIVSMEDELSREGISTRERINGEN → CAN_SHOW_FOOD_REGISTRATION                                |
| `cateringOccasionAcknowledgement`        | JAG_AR_MEDVETEN_OM_ATT → ACKNOWLEDGED                                                             |
| `knowledgeTestRegistration`              | VILL_ANMALA_NU → NOW, VILL_ANMALA_SENARE → LATER                                                  |
| `financing`                              | EGNA_MEDEL → OWN_FUNDS, BANKLAN → BANK_LOAN, PRIVATLAN → PRIVATE_LOAN, ANNAN_FINANSIERING_EXEMPELVIS_ALMILAN_BRYGGERILAN → OTHER_FINANCING |
| `premisesRightOfUseDocuments`            | KOPAVTAL → PURCHASE_AGREEMENT, OVERLATELSEAVTAL → TRANSFER_AGREEMENT, HYRESAVTAL → LEASE_AGREEMENT, MARKUPPLATELSE → LAND_LEASE_AGREEMENT (same names as the attachment keys) |
| `guestTypes`                             | ANSTALLDA → EMPLOYEES, MEDLEMMAR → MEMBERS, ANNAT_SLUTET_SALLSKAP → OTHER_CLOSED_COMPANY          |

## Mismatches worth knowing

- `publicServingPeriodDates`/`closedCompanyServingPeriodDates`/`salesPeriodDates` (3) collect full
  dates for an ANNUAL_PERIOD, while the asset stores annual periods as `MM-DD`. Draken has to drop
  the year, or the form should ask for month and day only.
- Asset fields with no source in the errand: `premises.restaurantNumber`, `premises.propertyDesignation`
  / `pointOfSale.propertyDesignation`, `premises.municipalityId`, `servingArea.drawingReference`,
  `servingArea.description` (except farm sales), `tasting`, `servingPeriods[].location`, tobacco
  `salesTypes` RETAIL/WHOLESALE, `permitHolder` (comes from the errand's stakeholders, not the form).
- Renaming keys orphans the answers on errands already registered in test, including their
  `<name>_original` copies, since the answers are stored under the old keys.
