import {
  errandFormDataForSchemas,
  errandFormDataToJsonParameters,
  schemaNamesForErrand,
} from '@components/json/utils/schema-utils';
import { ErrandFormDTO, ErrandLifecycle } from '@interfaces/errand-form';

// Status is the same for a draft and a filed errand: what sets them apart is the lifecycle.
const INITIAL_STATUS = 'NEW';

export const prepareErrandForApi = (
  values: ErrandFormDTO,
  lifecycle: ErrandLifecycle,
  namespace: string | undefined
) => {
  // Bilagor are filed straight to SupportManagement, never as part of the errand body.
  const { attachments: _attachments, errandFormData, ...errandWithoutFormData } = values;
  const labels = errandWithoutFormData.labels ?? [];

  return {
    ...errandWithoutFormData,
    stakeholders: errandWithoutFormData.stakeholders ?? [],
    labels,
    status: INITIAL_STATUS,
    lifecycle,
    // Only the current ärendetyp's form is filed; a type the citizen changed away from leaves its
    // answers in form state but must not reach the errand.
    jsonParameters: errandFormDataToJsonParameters(
      errandFormDataForSchemas(errandFormData, schemaNamesForErrand(labels, namespace))
    ),
  };
};
