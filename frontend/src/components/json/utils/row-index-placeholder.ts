/**
 * Stands in for a dynamic table's row number, which is only known once the row is rendered.
 * Shared by the id builder in schema-form.component and the row-agnostic lookup in
 * object-field-template.component; lives here so both files export only components.
 */
export const ROW_INDEX_PLACEHOLDER = '#';
