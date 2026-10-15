/** The one form the e2e suite exercises; pages live under its route prefix. */
export const SERVICE_KEY = 'alkoholtillstand';
export const SERVICE_PATH = `/${SERVICE_KEY}`;
export const OVERVIEW_PATH = `${SERVICE_PATH}/oversikt`;
export const errandPagePath = (errandNumber: string | undefined) =>
  `${SERVICE_PATH}/arende/${errandNumber}/grundinformation`;
