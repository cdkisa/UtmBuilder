# Resolve Templates Inside Composition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `composeLink` and `composeTaggedUrl` resolve a Link Intent's Template themselves, so the composing pages stop copying Template values into form state.

**Architecture:** A private `resolveUtm` in `src/links/compose.js` layers a Template's UTM values under the Intent's typed ones, using an injected `deps.templates` lookup (the same adapter pattern as `deps.generateCode`). A `useTemplateLookup()` hook supplies that lookup from the live `templates` table; both pages pass it to composition and use it to show Template values as placeholders.

**Tech Stack:** React 18, Vite 5, Dexie 3 + `dexie-react-hooks`, Vitest 2 (unit), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-09-18-resolve-templates-in-composition-design.md` — read it before starting. This plan argues from it.

## Global Constraints

- Branch: `feat/templates-resolve-in-compose`. PR targets `main` directly — never another feature branch.
- Unknown-Template Violation, exactly: `{ field: 'template', message: 'The chosen Template no longer exists.' }`
- A UTM value counts as typed only if `value != null && String(value).trim() !== ''`.
- Typed values always win over a Template's. An empty field cannot blank out a Template value.
- `draft.utm` holds the resolved values, **not** normalised (ADR-0001: normalising stays re-derivable).
- With no `intent.templateId`, `composeLink` and `composeTaggedUrl` must behave exactly as before, and must not call `deps.templates`.
- Out of scope — do not touch: the Template's `shortener` column; the `requireTemplate`, `defaultTemplateId`, `lockTemplates` settings; `TemplatesPage.jsx`; `src/links/store.js`.
- Commit messages end with: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Unit tests: `npm run test:unit`. E2E: `npm test` (starts its own dev server; takes ~2 min).
- **Known e2e failures on `main`, not yours to fix:** `links.spec.js:56`, `links.spec.js:78`, `qrcodes.spec.js:252` always fail; `qrcodes.spec.js:203` and `links.spec.js:327` are intermittently flaky. Anything else failing is yours.

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `src/links/compose.js` | modify | `resolveUtm`; both entry points use it |
| `src/links/compose.test.js` | modify | unit tests for resolution |
| `src/hooks/useLinks.js` | modify | `useTemplateLookup()` |
| `src/pages/CreateLinkModal.jsx` | modify | pass lookup; placeholders; delete Template effect |
| `src/pages/QRCodesPage.jsx` | modify | same, in `CreateQRModal` |
| `tests/link-template-integration.spec.js` | modify | rewrite two specs for the new behaviour |
| `tests/qrcodes.spec.js` | modify | one new spec for the QR page's Template |
| `docs/adr/0007-a-template-is-applied-when-composing-and-snapshotted.md` | create | the decision record |
| `CONTEXT.md` | modify | **Template** glossary entry |

---

### Task 0: Rebase onto `main` once PR #4 has merged

The Link store work (PR #4) must be on `main` first; `QRCodesPage.jsx` differs between the two trees. This branch currently holds only docs commits, so the rebase is trivial.

- [ ] **Step 1: Confirm PR #4 merged**

Run: `gh pr view 4 --json state --jq .state`
Expected: `MERGED`. If it prints `OPEN`, stop — do not start Task 1.

- [ ] **Step 2: Rebase**

```bash
git checkout feat/templates-resolve-in-compose
git fetch origin
git rebase origin/main
```

- [ ] **Step 3: Verify the store work is present and the suite is green**

Run: `grep -c "export function listLinks" src/links/store.js && ls docs/adr/0006-*.md && npm run test:unit`
Expected: `1`, the ADR-0006 path, and `Tests 49 passed (49)`.

---

### Task 1: `composeLink` resolves Templates

Adds resolution to `composeLink`, the lookup hook, and wires the lookup into both pages. The pages keep their Template `useEffect` for now: fields are still filled, typed values win, so users see no change until Tasks 3–4, and every commit stays working.

**Files:**
- Modify: `src/links/compose.js`
- Modify: `src/links/compose.test.js`
- Modify: `src/hooks/useLinks.js`
- Modify: `src/pages/CreateLinkModal.jsx`
- Modify: `src/pages/QRCodesPage.jsx`
- Create: `docs/adr/0007-a-template-is-applied-when-composing-and-snapshotted.md`
- Modify: `CONTEXT.md`

**Interfaces:**
- Produces: `composeLink(intent, policy, deps)` where `deps.templates: (id: number) => Template | undefined`. A Template is a `db.templates` row: `{ id, name, campaign, medium, source, term, content, ... }`.
- Produces: private `resolveUtm(intent, deps) => { utm: object, violation?: { field, message } }`. `utm` is always present — on an unknown Template it is the Intent's own values — so Task 2 can tag with it.
- Produces: `useTemplateLookup(): (id: number | string) => Template | undefined`, exported from `src/hooks/useLinks.js`.

- [ ] **Step 1: Write the failing tests**

Append to `src/links/compose.test.js`:

```js
describe('composing from a Template', () => {
  const spring = {
    id: 4,
    name: 'Spring promo',
    campaign: 'spring-2026',
    medium: 'email',
    source: 'mailchimp',
    term: '',
    content: '',
  };
  const templates = id => (id === 4 ? spring : undefined);

  it("shows a Template's values through the fields the Intent left untyped", () => {
    const result = composeLink(intent({ templateId: 4 }), policy, { templates });

    expect(result.draft.taggedUrl).toBe(
      'https://example.com?utm_campaign=spring-2026&utm_medium=email&utm_source=mailchimp',
    );
  });

  it("lets a typed value win over the Template's", () => {
    const result = composeLink(
      intent({ templateId: 4, utm: { medium: 'newsletter' } }),
      policy,
      { templates },
    );

    expect(result.draft.utm.medium).toBe('newsletter');
    expect(result.draft.utm.campaign).toBe('spring-2026');
  });

  it('treats a whitespace-only value as untyped', () => {
    const result = composeLink(
      intent({ templateId: 4, utm: { campaign: '   ' } }),
      policy,
      { templates },
    );

    expect(result.draft.utm.campaign).toBe('spring-2026');
  });

  it('snapshots the resolved values onto the Draft', () => {
    const result = composeLink(
      intent({ templateId: 4, utm: { medium: 'newsletter' } }),
      policy,
      { templates },
    );

    // The saved Link must not depend on the Template staying unchanged (ADR-0007).
    expect(result.draft.utm).toEqual({
      campaign: 'spring-2026',
      medium: 'newsletter',
      source: 'mailchimp',
    });
    expect(result.draft.templateId).toBe(4);
  });

  it("normalises a Template's value on the Tagged URL but stores it as the Template holds it", () => {
    const spaced = id => (id === 4 ? { ...spring, campaign: 'Spring Sale' } : undefined);

    const result = composeLink(intent({ templateId: 4 }), policy, { templates: spaced });

    expect(result.draft.taggedUrl).toContain('utm_campaign=Spring-Sale');
    expect(result.draft.utm.campaign).toBe('Spring Sale');
  });

  it("holds a Template's values to the Rules in force", () => {
    const strict = createPolicy({ spaceChar: 'hyphen' }, [
      { id: 1, name: 'Rule 1', config: { campaign: { prohibitedValues: 'spring-2026' } } },
    ]);

    const result = composeLink(intent({ templateId: 4 }), strict, { templates });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { field: 'campaign', message: 'Campaign may not be "spring-2026".' },
    ]);
  });

  it('reports a Template that no longer exists instead of composing without it', () => {
    const result = composeLink(intent({ templateId: 99 }), policy, { templates });

    expect(result.ok).toBe(false);
    expect(result.draft).toBeUndefined();
    expect(result.violations).toEqual([
      { field: 'template', message: 'The chosen Template no longer exists.' },
    ]);
  });

  it('reports a chosen Template as missing when no lookup is supplied', () => {
    const result = composeLink(intent({ templateId: 4 }), policy);

    expect(result.violations).toEqual([
      { field: 'template', message: 'The chosen Template no longer exists.' },
    ]);
  });

  it('never consults the lookup when no Template is chosen', () => {
    const untouchable = () => {
      throw new Error('the lookup must not be called');
    };

    const result = composeLink(intent({ utm: { campaign: 'summer' } }), policy, {
      templates: untouchable,
    });

    expect(result.draft.taggedUrl).toBe('https://example.com?utm_campaign=summer');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/links/compose.test.js`
Expected: FAIL. The first test fails with the Tagged URL `https://example.com` (no UTM values) — the Template is ignored. The two "no longer exists" tests fail because `result.ok` is `true`. "never consults the lookup" **passes** already; that is correct, it guards existing behaviour.

- [ ] **Step 3: Implement `resolveUtm` and use it in `composeLink`**

In `src/links/compose.js`, add below `shortUrlFor` (above `composeLink`):

```js
const isTyped = value => value != null && String(value).trim() !== '';

/**
 * Layers a chosen Template's UTM values under the Intent's own (ADR-0007). A
 * field the user left blank takes the Template's value; a typed one always
 * wins. An unknown Template is reported, never silently dropped, but the
 * Intent's own values still come back so a preview can be drawn from them.
 */
function resolveUtm(intent, deps) {
  const typed = intent.utm || {};
  if (intent.templateId == null) return { utm: typed };

  const template = deps.templates ? deps.templates(intent.templateId) : undefined;
  if (!template) {
    return {
      utm: typed,
      violation: { field: 'template', message: 'The chosen Template no longer exists.' },
    };
  }

  const utm = {};
  for (const [field] of UTM_FIELDS) {
    if (isTyped(typed[field])) utm[field] = typed[field];
    else if (isTyped(template[field])) utm[field] = template[field];
  }
  return { utm };
}
```

Then change `composeLink` from:

```js
export function composeLink(intent, policy, deps = {}) {
  const generateCode = deps.generateCode || defaultGenerateCode;
  const destination = stripExistingUtm(withScheme(intent.destination));
  const typedUtm = intent.utm || {};
  const utm = policy.normalize(typedUtm);
  const customParameters = (intent.customParameters || []).filter(p => p.name && p.value);

  const violations = [];
  if (!destination) {
    violations.push({ field: 'destination', message: 'URL is required' });
  }
  if (!intent.author) {
    violations.push({ field: 'author', message: 'An author is required.' });
  }
  violations.push(...policy.validate({ ...intent, destination, utm }));
```

to:

```js
export function composeLink(intent, policy, deps = {}) {
  const generateCode = deps.generateCode || defaultGenerateCode;
  const destination = stripExistingUtm(withScheme(intent.destination));
  const resolved = resolveUtm(intent, deps);
  const utm = policy.normalize(resolved.utm);
  const customParameters = (intent.customParameters || []).filter(p => p.name && p.value);

  const violations = [];
  if (!destination) {
    violations.push({ field: 'destination', message: 'URL is required' });
  }
  if (!intent.author) {
    violations.push({ field: 'author', message: 'An author is required.' });
  }
  if (resolved.violation) violations.push(resolved.violation);
  violations.push(...policy.validate({ ...intent, destination, utm }));
```

and in the returned draft change:

```js
      // What the user typed, not what was normalised: normalising is a Policy
      // decision that must stay re-derivable, so baking a separator or a
      // lowercasing into the stored Link would make it a cache that can
      // disagree with the settings in force (ADR-0001).
      utm: typedUtm,
```

to:

```js
      // What the user typed, with any Template's values beneath it, and not
      // what was normalised: normalising is a Policy decision that must stay
      // re-derivable (ADR-0001). The Template's values are snapshotted here so
      // editing the Template later changes no Link (ADR-0007).
      utm: resolved.utm,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS — `Tests 58 passed (58)`.

- [ ] **Step 5: Add `useTemplateLookup` to `src/hooks/useLinks.js`**

Append:

```js
/**
 * Looks a Template up by id, for composition to resolve (ADR-0007). A page
 * uses this same lookup to show the chosen Template's values, so what the form
 * shows and what gets composed cannot disagree.
 */
export function useTemplateLookup() {
  const templates = useLiveQuery(() => db.templates.toArray(), []) || [];

  return useMemo(() => {
    const byId = new Map(templates.map(t => [t.id, t]));
    return id => byId.get(Number(id));
  }, [templates]);
}
```

(`useMemo`, `useLiveQuery` and `db` are already imported in that file.)

- [ ] **Step 6: Pass the lookup to composition in `src/pages/CreateLinkModal.jsx`**

Change the hooks import:

```js
import { useLinkPolicy, useCurrentAuthor } from '../hooks/useLinks';
```

to:

```js
import { useLinkPolicy, useCurrentAuthor, useTemplateLookup } from '../hooks/useLinks';
```

Directly below `const policy = useLinkPolicy();` add:

```js
  const findTemplate = useTemplateLookup();
  const composeDeps = { templates: findTemplate };
```

Then pass `composeDeps` as the last argument to all three composition calls:

```js
  const previewTaggedUrl = composeTaggedUrl(url, buildIntent(), policy, composeDeps);
```

```js
  const compose = (destination) => composeLink(buildIntent(destination), policy, composeDeps);
```

```js
        return prefix + composeTaggedUrl(matchUrl, buildIntent(), policy, composeDeps);
```

Leave the Template `useEffect` in place — Task 3 removes it.

- [ ] **Step 7: Pass the lookup to composition in `src/pages/QRCodesPage.jsx`**

Change the hooks import:

```js
import { useLinkPolicy, useTaggedUrl, useCurrentAuthor } from '../hooks/useLinks';
```

to:

```js
import { useLinkPolicy, useTaggedUrl, useCurrentAuthor, useTemplateLookup } from '../hooks/useLinks';
```

Inside `CreateQRModal`, directly below `const policy = useLinkPolicy();` add:

```js
  const findTemplate = useTemplateLookup();
  const composeDeps = { templates: findTemplate };
```

Then change:

```js
    ? composeTaggedUrl(url, buildIntent(), policy)
```

to:

```js
    ? composeTaggedUrl(url, buildIntent(), policy, composeDeps)
```

and:

```js
      const result = composeLink(buildIntent(url), policy);
```

to:

```js
      const result = composeLink(buildIntent(url), policy, composeDeps);
```

Leave the Template `useEffect` in place — Task 4 removes it.

- [ ] **Step 8: Write ADR-0007**

Create `docs/adr/0007-a-template-is-applied-when-composing-and-snapshotted.md`:

```markdown
# A Template is applied when composing, and snapshotted

Composing a Link resolves its Template: each UTM field the Link Intent leaves blank takes the Template's value, and a typed value always wins. The saved Link stores the resolved values, so it holds the Template's values as they were when the Link was composed. `templateId` stays on the row only as a record of where the values came from.

Both composing pages used to copy a Template's values into their form fields, with identical code, and never looked at the Template again. Clearing a Template reset only its id, so its values stayed behind and were saved onto the next Link. Resolving the Template during composition, rather than copying it into the form, puts the precedence rule in one place with one set of tests, and leaves nothing behind to clear.

Snapshotting departs from ADR-0001, which derives a Link's Tagged URL on every read so that a change to the workspace settings applies to existing Links. A Template is different: a Link made from it may already be printed on a QR code or sent in an email, and editing the Template must not change a URL that is already published.

## Consequences

A blank field means "use the Template", so a field cannot be deliberately left empty while a Template that sets it is chosen; clearing the Template is the only way to drop its values. A Template chosen and then deleted before saving is reported as a Violation, not dropped silently. Editing or deleting a Template changes no existing Link.

## Considered options

Keeping a live reference, storing only what was typed and filling in the Template's values whenever the Tagged URL is derived, would follow ADR-0001 more closely. It was rejected because editing a Template would silently rewrite every URL made from it, and deleting one would strip values from Links already in use.
```

- [ ] **Step 9: Add the Template entry to `CONTEXT.md`**

Insert directly after the **Parameter Preset** entry (under "Configured elsewhere, used when composing"):

```markdown
**Template**:
A saved set of UTM values that composing layers underneath a Link Intent's own: a field the user leaves blank takes the Template's value. A Link made from a Template keeps the values it was composed with, so editing the Template later changes no Link.
_Avoid_: preset, default, blueprint
```

- [ ] **Step 10: Verify nothing else moved**

Run: `npm run test:unit && npm run build`
Expected: `Tests 58 passed (58)`; build ends `✓ built`.

- [ ] **Step 11: Commit**

```bash
git add src/links/compose.js src/links/compose.test.js src/hooks/useLinks.js src/pages/CreateLinkModal.jsx src/pages/QRCodesPage.jsx docs/adr/0007-a-template-is-applied-when-composing-and-snapshotted.md CONTEXT.md
git commit -m "feat: resolve Templates when composing a Link" -m "composeLink layers a chosen Template's UTM values under the Intent's own through an injected lookup, snapshots the resolved values onto the Draft, and reports a Template that no longer exists. Both composing pages pass the lookup; their copy-into-form effects stay until the placeholders replace them." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `composeTaggedUrl` resolves Templates

The live preview and the HTML email path go through `composeTaggedUrl`. Without this task they would leave out Template values that the saved Link includes.

**Files:**
- Modify: `src/links/compose.js`
- Modify: `src/links/compose.test.js`

**Interfaces:**
- Consumes: `resolveUtm(intent, deps)` from Task 1.
- Produces: `composeTaggedUrl(destination, intent, policy, deps = {})`. Task 1 already passes `deps` from both pages.

- [ ] **Step 1: Write the failing tests**

Append to `src/links/compose.test.js`:

```js
describe('composeTaggedUrl with a Template', () => {
  const templates = id =>
    id === 4 ? { id: 4, campaign: 'spring-2026', medium: 'email', source: '' } : undefined;

  it('tags with the Template underneath the typed values, as composeLink does', () => {
    const url = composeTaggedUrl(
      'example.com',
      { templateId: 4, utm: { medium: 'newsletter' } },
      policy,
      { templates },
    );

    expect(url).toBe('https://example.com?utm_campaign=spring-2026&utm_medium=newsletter');
  });

  it('tags with the typed values alone when the Template no longer exists', () => {
    const url = composeTaggedUrl(
      'example.com',
      { templateId: 99, utm: { medium: 'newsletter' } },
      policy,
      { templates },
    );

    expect(url).toBe('https://example.com?utm_medium=newsletter');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/links/compose.test.js`
Expected: FAIL on the first test — received `https://example.com?utm_medium=newsletter`, missing `utm_campaign=spring-2026`. The second test passes already; it pins the unknown-Template fallback.

- [ ] **Step 3: Implement**

In `src/links/compose.js` change:

```js
export function composeTaggedUrl(destination, intent, policy) {
  const cleaned = stripExistingUtm(withScheme(destination));
  const utm = policy.normalize(intent.utm || {});
```

to:

```js
export function composeTaggedUrl(destination, intent, policy, deps = {}) {
  const cleaned = stripExistingUtm(withScheme(destination));
  // An unknown Template has nowhere to be reported here; composeLink reports
  // it when the Link is saved, so the preview uses the typed values alone.
  const utm = policy.normalize(resolveUtm(intent, deps).utm);
```

`resolveUtm` is declared below `composeTaggedUrl` in the file. That is fine: function declarations are hoisted.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS — `Tests 60 passed (60)`.

- [ ] **Step 5: Commit**

```bash
git add src/links/compose.js src/links/compose.test.js
git commit -m "feat: resolve Templates in the Tagged URL preview" -m "composeTaggedUrl takes the same deps as composeLink, so the live preview and the HTML email path carry a Template's values exactly as the saved Link will." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `CreateLinkModal` shows Template values as placeholders

**Files:**
- Modify: `tests/link-template-integration.spec.js`
- Modify: `src/pages/CreateLinkModal.jsx`

**Interfaces:**
- Consumes: `findTemplate` from Task 1, already defined in the component.

- [ ] **Step 1: Rewrite the e2e specs for the new behaviour**

In `tests/link-template-integration.spec.js`, inside **creates link using a template**, replace:

```js
    // Fields should be auto-populated
    const campaignInput = page.locator(`${modal} input[placeholder*="holiday special"]`);
    await expect(campaignInput).toHaveValue('email-blast');
```

with:

```js
    // The Template's values show as placeholders; nothing is copied into the field
    const campaignInput = page.locator(`${modal} input[list="list-campaign"]`);
    await expect(campaignInput).toHaveValue('');
    await expect(campaignInput).toHaveAttribute('placeholder', 'email-blast');
```

Keep the rest of that test (preview and saved-row assertions) unchanged.

Inside **clears template selection**, replace:

```js
    // Clear button should appear and work
    await expect(page.locator(`${modal} button:has-text("CLEAR")`)).toBeVisible();
    await page.locator(`${modal} button:has-text("CLEAR")`).click();

    const templateSelect = page.locator(`${modal} select`).first();
    await expect(templateSelect).toHaveValue('');
```

with:

```js
    const preview = page.locator(`${modal} .font-mono`);
    await expect(preview).toContainText('utm_campaign=clear-test');

    // Clear button should appear and work
    await expect(page.locator(`${modal} button:has-text("CLEAR")`)).toBeVisible();
    await page.locator(`${modal} button:has-text("CLEAR")`).click();

    const templateSelect = page.locator(`${modal} select`).first();
    await expect(templateSelect).toHaveValue('');

    // Clearing the Template takes its values with it
    await expect(preview).not.toContainText('utm_campaign=clear-test');
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx playwright test tests/link-template-integration.spec.js`
Expected: FAIL on both.
- **creates link using a template** fails on `toHaveValue('')`: received `email-blast`, because the effect still copies.
- **clears template selection** fails on `not.toContainText`: the residue bug.

- [ ] **Step 3: Replace the copy with placeholders**

In `src/pages/CreateLinkModal.jsx`, delete the whole Template effect:

```js
  useEffect(() => {
    if (templateId) {
      const tmpl = templates.find(t => t.id === Number(templateId));
      if (tmpl) {
        if (tmpl.campaign) setCampaign(tmpl.campaign);
        if (tmpl.medium) setMedium(tmpl.medium);
        if (tmpl.source) setSource(tmpl.source);
        if (tmpl.term) setTerm(tmpl.term);
        if (tmpl.content) setContent(tmpl.content);
      }
    }
  }, [templateId, templates]);
```

Keep `const templates = useLiveQuery(...)`: the Template `<select>` still lists them. Keep the `useEffect` import: `setMode` still uses it.

Below the `composeDeps` line added in Task 1, add:

```js
  // A chosen Template's values show as placeholders rather than being copied
  // in; composing applies them beneath whatever is typed (ADR-0007).
  const chosenTemplate = templateId ? findTemplate(templateId) : undefined;
  const hintFor = (field, fallback) => chosenTemplate?.[field] || fallback;
```

Change the five UTM fields' `placeholder` props:

```jsx
      <ComboInput label="campaign" value={campaign} onChange={setCampaign}
        options={campaignOpts} placeholder={hintFor('campaign', 'e.g. holiday special, birthday promotion')} className="mb-3" />
      <ComboInput label="medium" value={medium} onChange={setMedium}
        options={mediumOpts} placeholder={hintFor('medium', 'e.g. banner ad, email, social post')} className="mb-3" />
      <ComboInput label="source" value={source} onChange={setSource}
        options={sourceOpts} placeholder={hintFor('source', 'e.g. adwords, google, mailchimp')} className="mb-3" />
      <ComboInput label="term" value={term} onChange={setTerm}
        options={termOpts} placeholder={hintFor('term', 'Use to identify ppc keywords')} className="mb-3" />
      <ComboInput label="content" value={content} onChange={setContent}
        options={contentOpts} placeholder={hintFor('content', 'Use to differentiate ads or words on a page')} className="mb-3" />
```

`clearTemplate` stays as `setTemplateId('')`.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx playwright test tests/link-template-integration.spec.js`
Expected: PASS, all specs in the file.

- [ ] **Step 5: Run the Links spec to check nothing else moved**

Run: `npx playwright test tests/links.spec.js`
Expected: only the known failures (`:56`, `:78`, and possibly the flaky `:327`). Many Links specs find the campaign field by its `holiday special` placeholder, which is unchanged when no Template is chosen.

- [ ] **Step 6: Commit**

```bash
git add tests/link-template-integration.spec.js src/pages/CreateLinkModal.jsx
git commit -m "feat: show Template values as placeholders when creating a Link" -m "The Create Link form no longer copies a Template's values into its fields. They show as placeholders and composing applies them, so clearing a Template no longer leaves its values behind." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `QRCodesPage` shows Template values as placeholders

The QR page has no e2e coverage of Templates today. This task adds one spec so the change is proven, not assumed.

**Files:**
- Modify: `tests/qrcodes.spec.js`
- Modify: `src/pages/QRCodesPage.jsx` (component `CreateQRModal`)

**Interfaces:**
- Consumes: `findTemplate` from Task 1, already defined in `CreateQRModal`.

- [ ] **Step 1: Write the failing e2e spec**

Add inside `test.describe('QR Codes Page', ...)` in `tests/qrcodes.spec.js`:

```js
  test('applies a chosen Template without copying it into the fields', async ({ page }) => {
    await page.locator('nav a:has-text("Templates")').click();
    await page.waitForSelector('main h1');
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('QR Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('qr-spring');
    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('text=Template created')).toBeVisible();

    await page.locator('nav a:has-text("QR Codes")').click();
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE QR CODE")').click();
    await page.locator(`${modal} input`).first().fill('https://qr-template.com');
    await page.locator(`${modal} select`).first().selectOption({ label: 'QR Template' });

    const campaignInput = page.locator(`${modal} input[list="list-campaign"]`);
    await expect(campaignInput).toHaveValue('');
    await expect(campaignInput).toHaveAttribute('placeholder', 'qr-spring');

    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('text=QR Code created')).toBeVisible();
    await expect(page.locator('td:has-text("qr-spring")').first()).toBeVisible();
  });
```

The first `<select>` in the new-link form is the Template select; it sits above the Shortener and QR-design selects in the markup.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/qrcodes.spec.js -g "applies a chosen Template"`
Expected: FAIL on `toHaveValue('')` — received `qr-spring`, because the effect still copies.

- [ ] **Step 3: Replace the copy with placeholders**

In `CreateQRModal` in `src/pages/QRCodesPage.jsx`, delete the whole Template effect:

```js
  useEffect(() => {
    if (templateId) {
      const tmpl = templates.find(t => t.id === Number(templateId));
      if (tmpl) {
        if (tmpl.campaign) setCampaign(tmpl.campaign);
        if (tmpl.medium) setMedium(tmpl.medium);
        if (tmpl.source) setSource(tmpl.source);
        if (tmpl.term) setTerm(tmpl.term);
        if (tmpl.content) setContent(tmpl.content);
      }
    }
  }, [templateId, templates]);
```

Keep `templates` (the `<select>` lists them) and the `useEffect` import (other effects use it).

Below the `composeDeps` line added in Task 1, add:

```js
  // A chosen Template's values show as placeholders rather than being copied
  // in; composing applies them beneath whatever is typed (ADR-0007).
  const chosenTemplate = templateId ? findTemplate(templateId) : undefined;
  const hintFor = (field, fallback) => chosenTemplate?.[field] || fallback;
```

Change the five UTM fields:

```jsx
              <ComboInput label="campaign" value={campaign} onChange={setCampaign} options={campaignOpts}
                placeholder={hintFor('campaign', 'e.g. holiday special')} className="mb-3" />
              <ComboInput label="medium" value={medium} onChange={setMedium} options={mediumOpts}
                placeholder={hintFor('medium', 'e.g. social')} className="mb-3" />
              <ComboInput label="source" value={source} onChange={setSource} options={sourceOpts}
                placeholder={hintFor('source', 'e.g. facebook')} className="mb-3" />
              <ComboInput label="term" value={term} onChange={setTerm} options={[]} placeholder={hintFor('term', 'ppc keywords')} className="mb-3" />
              <ComboInput label="content" value={content} onChange={setContent} options={[]} placeholder={hintFor('content', 'differentiate ads')} className="mb-3" />
```

The CLEAR button stays `onClick={() => setTemplateId('')}`.

Do **not** touch the "existing link" effect that fills the fields from a selected Link. That copies a Link's own saved values and is unrelated to Templates.

- [ ] **Step 4: Run the QR spec to verify it passes**

Run: `npx playwright test tests/qrcodes.spec.js`
Expected: the new spec passes; the only failures are the known `:252` and possibly the flaky `:203`.

- [ ] **Step 5: Commit**

```bash
git add tests/qrcodes.spec.js src/pages/QRCodesPage.jsx
git commit -m "feat: show Template values as placeholders when creating a QR code" -m "The QR form stops copying a Template's values into its fields, matching the Create Link form. Both composing pages now apply a Template only through composition." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verify and open the PR

- [ ] **Step 1: Confirm no page still copies a Template**

Run: `grep -rn "tmpl\.\(campaign\|medium\|source\|term\|content\)" src/pages/`
Expected: no output.

- [ ] **Step 2: Full verification**

Run: `npm run test:unit && npm run build && npm test`
Expected:
- unit: `Tests 60 passed (60)`
- build: `✓ built`
- e2e: every failure is one of the known ones listed in Global Constraints. If `qrcodes.spec.js:203` or `links.spec.js:327` fails, re-run it alone with `--repeat-each=5` before treating it as yours.

- [ ] **Step 3: Push and open the PR against `main`**

```bash
git push -u origin feat/templates-resolve-in-compose
gh pr create --base main --title "Resolve Templates inside composition" --body-file <path-to-body>
```

The body must state: what changed (per task), the decisions with ADR-0007, the rewritten e2e specs and why they were rewritten, and exact test results including which known failures appeared. End it with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
