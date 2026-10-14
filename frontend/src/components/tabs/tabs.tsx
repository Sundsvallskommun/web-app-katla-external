import { ServiceKey, servicePath } from 'src/constants/services';

interface TabItem {
  labelKey: string;
  path: string;
  visible: boolean;
}

export const visibleTabsFor = (service: ServiceKey): TabItem[] => [
  { labelKey: 'common:tabs.basic_information', path: servicePath(service), visible: true },
  // { labelKey: 'common:tabs.messages', path: `/arende/${errandnumber}/meddelanden`, visible: true },
  // { labelKey: 'common:tabs.attachments', path: `/arende/${errandnumber}/bilagor`, visible: true },
];
