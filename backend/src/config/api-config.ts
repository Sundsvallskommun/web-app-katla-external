//Subscribed APIS as lowercased
export const APIS = [
  {
    name: 'simulatorserver',
    version: '2.0',
  },
  {
    name: 'support-management-alkt-sprint',
    version: '17.0',
  },
  {
    name: 'citizen',
    version: '3.0',
  },
  {
    name: 'legalentity',
    version: '2.0',
  },
  {
    name: 'jsonschema',
    version: '1.0',
  },
  {
    name: 'myrepresentatives',
    version: '4.4',
  },
] as const;

// Temporary routing for the Support Management development sprint.
// Remove this alias and rename the APIS entry to supportmanagement when the sprint API is retired.
const API_SERVICE_ALIASES: Readonly<Record<string, string>> = {
  supportmanagement: 'support-management-alkt-sprint',
};

export function getApiBase(name: string): string {
  const resolvedName = API_SERVICE_ALIASES[name] ?? name;
  const api = APIS.find(a => a.name === resolvedName);
  return api ? `${api.name}/${api.version}` : name;
}
