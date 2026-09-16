import type { FormTemplate } from '@bin-tracker/types';

/**
 * Which form the `/app/forms/:formId` url is asking for.
 *
 * Returns null for "show the list instead" — no id in the url, the list still
 * loading, or an id that is no longer in it (a stale bookmark, or a form
 * deactivated since). The caller renders the list in all three cases, so a bad
 * link degrades to the list rather than a blank screen.
 */
export function resolveOpenForm(
    forms: FormTemplate[] | undefined,
    formId: string | undefined,
): FormTemplate | null {
    if (!formId || !forms) return null;
    return forms.find((f) => f.id === formId) ?? null;
}
