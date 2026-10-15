/**
 * Field controls showing a validation error carry this attribute, so error navigation can find
 * the first one in document order without knowing how the forms are built — necessary because
 * errors come from both the JSON schema and hand-written fields.
 */
export const INVALID_FIELD_ATTRIBUTE = 'data-invalid-field';

const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Collapsed Disclosure sections render their content but hide it. Regions are found through
 * ARIA rather than class names, so the same navigation works for every section in the app.
 */
function collapsedRegionsAround(field: HTMLElement): HTMLElement[] {
  const regions: HTMLElement[] = [];
  let current: HTMLElement | null = field;

  while (current) {
    const region: HTMLElement | null = current.closest('[role="region"][aria-hidden="true"]');
    if (!region) break;
    // Outermost section first, or the inner ones cannot be opened.
    regions.unshift(region);
    current = region.parentElement;
  }

  return regions;
}

function expandCollapsedRegions(field: HTMLElement): void {
  for (const region of collapsedRegionsAround(field)) {
    const toggles = document.querySelectorAll<HTMLElement>('[aria-expanded="false"][aria-controls]');
    for (const toggle of toggles) {
      if (toggle.getAttribute('aria-controls') === region.id) {
        toggle.click();
        break;
      }
    }
  }
}

function scrollIntoView(element: HTMLElement): void {
  // jsdom has no scrollIntoView, and older browsers do not support the options object.
  if (typeof element.scrollIntoView !== 'function') return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Returns false when the field could not be focused, e.g. because its section is still hidden. */
function revealField(field: HTMLElement): boolean {
  const focusTarget = field.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  focusTarget?.focus({ preventScroll: true });
  scrollIntoView(focusTarget ?? field);

  return focusTarget !== null && document.activeElement === focusTarget;
}

/**
 * Moves focus to the first field showing a validation error, opens the section holding it and
 * scrolls it into view. Returns false when no flagged field exists.
 */
export function focusFirstInvalidField(root: ParentNode = document): boolean {
  const field = root.querySelector<HTMLElement>(`[${INVALID_FIELD_ATTRIBUTE}]`);
  if (!field) return false;

  expandCollapsedRegions(field);

  if (!revealField(field)) {
    // A section expanded in a later update has not yet made the field focusable.
    requestAnimationFrame(() => {
      revealField(field);
    });
  }

  return true;
}
