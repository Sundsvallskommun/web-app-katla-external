import { ErrandDTO, ErrandLabelDTO } from '@data-contracts/backend/data-contracts';
import { getTypeDisplayName } from '@utils/errand-helpers';
import { describe, expect, it } from 'vitest';

const label = (classification: string, displayName: string): ErrandLabelDTO => ({
  id: displayName.toLowerCase(),
  classification,
  displayName,
});

const errand = (overrides: Partial<ErrandDTO>): ErrandDTO => ({ errandNumber: 'AIA-25120019', ...overrides });

describe('getTypeDisplayName', () => {
  it('shows the subtype when the errand carries a full label path', () => {
    const result = getTypeDisplayName(
      errand({
        labels: [label('CATEGORY', 'Alkohol'), label('TYPE', 'Servering'), label('SUBTYPE', 'Stadigvarande')],
      })
    );

    expect(result).toBe('Stadigvarande');
  });

  it('shows the type when it is the leaf', () => {
    const result = getTypeDisplayName(errand({ labels: [label('CATEGORY', 'Alkohol'), label('TYPE', 'Folköl')] }));

    expect(result).toBe('Folköl');
  });

  it('falls back to the classification code when labels are missing', () => {
    expect(getTypeDisplayName(errand({ classification: { category: 'KATEGORI', type: 'TYPETEST' } }))).toBe('TYPETEST');
  });

  it('shows a dash when neither labels nor classification exist', () => {
    expect(getTypeDisplayName(errand({}))).toBe('—');
  });
});
