# Resolve Templates inside composition

Candidate 4 of the 16 September 2026 architecture review.

## Problem

A Template is a Link Intent concern, but `src/links/` knows only its id. Both composing pages resolve it themselves, with identical code (`CreateLinkModal.jsx:50-61`, `QRCodesPage.jsx:205-215`): a `useEffect` copies the Template's five UTM values into local form state, one way, and never reads the Template again. `composeLink` then passes `templateId` through untouched.

Two defects follow from the copy:

- **Residue on clear.** CLEAR resets `templateId` and leaves the copied values in the fields, so a Link composed after clearing a Template still carries its values.
- **No single place owns precedence.** Which of a Template's values and a user's typed values wins is decided implicitly, by effect ordering, in two places.

## Decisions

1. **Resolved in composition.** `composeLink` and `composeTaggedUrl` resolve the Template themselves, through an injected lookup.
2. **Placeholders, not copies.** The form's UTM fields hold only what the user typed. When a Template is chosen, each field's placeholder shows that Template's value; otherwise the field keeps its existing hint text.
3. **Typed values win.** Template values sit underneath the Intent's own. A field that is empty, `null`, or whitespace-only counts as untyped, so the Template's value applies. Consequence: an empty field cannot blank out a Template value; to drop one, clear the Template.
4. **Snapshot, not reference.** The saved Link stores the resolved values. Editing or deleting a Template later never changes a Link, so a Tagged URL already published keeps working. `templateId` stays on the row as provenance only (it drives the Links table's "Template" badge).
5. **Unknown Template is a Violation.** A `templateId` the lookup cannot find returns a Violation on field `template` with the message `The chosen Template no longer exists.` It is never silently dropped.

## Design

### Composition — `src/links/compose.js`

`deps` gains `templates`: a function from Template id to a Template record, or `undefined` when there is no such Template. It is the same adapter pattern as the existing `deps.generateCode`, so composition stays synchronous and free of Dexie.

A private `resolveUtm(intent, deps)` returns `{ utm }`, plus a `violation` when the Template is unknown. `utm` is always present, so `composeTaggedUrl` can still tag from the Intent's own values:

- no `intent.templateId` → the Intent's `utm`, unchanged;
- `templateId` present, `deps.templates` absent or returning `undefined` → the Intent's `utm` together with the unknown-Template Violation;
- otherwise, for each of the five UTM fields, the Intent's value if typed, else the Template's value if it has one, else absent.

Both entry points use it:

- `composeLink(intent, policy, deps)` — the resolved `utm` replaces `typedUtm` everywhere it is used today: it is normalised, validated by the Policy, tagged, and returned as `draft.utm`. The Policy therefore validates resolved values, so a Template cannot carry a prohibited value past a Rule.
- `composeTaggedUrl(destination, intent, policy, deps)` — gains the same fourth argument, so the live preview and the HTML email path match what is saved. On an unknown Template it tags with the Intent's own values only; it has no Violation channel, and `composeLink` reports the problem on save.

Called without `deps.templates` and without `intent.templateId`, both functions behave exactly as today.

`src/links/store.js` does not change: `draft.utm` already arrives resolved, and `rowFor` already writes `templateId`.

### Lookup hook — `src/hooks/useLinks.js`

`useTemplateLookup()` loads `db.templates` with `useLiveQuery` and returns a memoised function `id => template | undefined`, matching on `Number(id)`. It sits beside `useLinkPolicy`, which builds the other thing composition is subject to.

### Pages — `CreateLinkModal.jsx`, `QRCodesPage.jsx`

Each page:

- calls `useTemplateLookup()` once, as `findTemplate`;
- deletes its Template `useEffect`;
- passes `{ templates: findTemplate }` to every `composeLink` and `composeTaggedUrl` call;
- sets each UTM `ComboInput`'s `placeholder` to `findTemplate(templateId)?.[field]` when that is non-empty, falling back to the field's current hint text;
- keeps CLEAR as `setTemplateId('')`, which now removes the Template's values too because none were ever copied.

`templateId` stays in `buildIntent` as it is today.

## Out of scope

- The Template's `shortener` column, written at `TemplatesPage.jsx:175` and never read. It stores `'none'` or `'local'`, not a domain, and turning a Shortener choice into `{ domain }` is candidate 5's job.
- The workspace settings `requireTemplate`, `defaultTemplateId` and `lockTemplates`, stored by the Rules page and never read.
- Any change to the Templates page itself.

## Testing

Unit, test-first, in `src/links/compose.test.js`, with `deps.templates` as a plain function:

- a Template's value shows through a field the Intent left untyped;
- a typed value wins over the Template's;
- a whitespace-only typed value counts as untyped;
- an unknown `templateId` returns the Violation and no Draft;
- `draft.utm` holds the resolved values (the snapshot);
- a Template value is still normalised by the Policy, and a prohibited Template value is still a Violation;
- `composeTaggedUrl` resolves the same way;
- with no `templateId`, results are identical to today's.

End-to-end, `tests/link-template-integration.spec.js` is rewritten, not patched, because it asserts the old copy behaviour:

- **creates link using a template** — after choosing the Template, the campaign field is empty with placeholder `email-blast`; the preview carries the Template's three values; the saved row shows `email-blast`. Locate the field by something other than its placeholder, which now changes.
- **clears template selection** — additionally asserts the fix: after CLEAR, the preview no longer contains `utm_campaign=clear-test`.

## Docs

- ADR-0007, "A Template is applied when composing, and snapshotted": decisions 3 and 4, and why snapshotting departs from ADR-0001's derive-on-read — a Template edit must not rewrite URLs already in the wild.
- `CONTEXT.md` gains a **Template** entry. The glossary lists a Template as part of a Link Intent but never defines it.

## Sequencing

Implementation starts from `main` only after PR #4 (the Link store work) has merged, rebasing this branch onto it first; `QRCodesPage.jsx` differs between the two.
