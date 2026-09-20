# Storage Provider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dexie sits behind one small storage contract, so another provider — a different local engine or a remote API — can be plugged in later.

**Architecture:** `src/storage/provider.js` documents the contract and holds the configured provider. `src/storage/dexie-provider.js` is the only file that knows Dexie's query API. `src/hooks/useQuery.js` replaces `useLiveQuery` at the converted call sites, built on the contract's `observe`. `src/links/store.js` and the two hooks move onto collections; the eight admin pages keep using `db` directly until a later project.

**Tech Stack:** React 18, Vite 5, Dexie 3 + `dexie-react-hooks`, Vitest 2 (unit, `src/**/*.test.js`, `fake-indexeddb`), Playwright (e2e, `tests/*.spec.js`, importing `test` from `tests/fixtures.js`).

**Spec:** `docs/superpowers/specs/2026-09-19-storage-provider-design.md` — read it before starting. It is the binding authority; this plan argues from it.

## Global Constraints

- Branch: `feat/storage-provider` (already checked out). The PR targets `main`.
- Contract methods are all async and may reject.
- Collection handle: `list(query?)`, `get(id)`, `add(doc)`, `bulkAdd(docs)`, `update(id, changes)`, `remove(id)`, `removeWhere(field, equals)`. Provider: `collection(name)`, `transaction(names, fn)`, `observe(querier)`.
- `observe(querier)` returns an object with `subscribe({ next, error })` returning `{ unsubscribe() }`.
- `useQuery(querier, deps)` returns `{ data, loading, error }`; `data` is `undefined` until the first result, so call sites supply their own default.
- Nothing user-visible changes: every exported function and hook keeps its name, arguments and return value.
- Do not touch `src/db.js`, the eight admin pages (`AttributesPage`, `LinkShortenersPage`, `MembersPage`, `ParametersPage`, `RulesPage`, `TemplatesPage`, `CreateLinkModal`, `ImportLinksModal`), or `src/links/compose.js`, `policy.js`, `interchange.js`.
- **Every e2e spec must pass**; the suite is fully green on `main`. Any failure is yours.
- Commit messages end with a `Co-Authored-By:` trailer naming the model that actually wrote the commit.
- Unit: `npm run test:unit`. E2E: `npm test` (~1.5 min, starts its own dev server). Build: `npm run build`.

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `src/storage/provider.js` | create | the contract, documented; the configured provider |
| `src/storage/dexie-provider.js` | create | the only file knowing Dexie's query API |
| `src/storage/provider-contract.test.js` | create | one suite every provider must pass |
| `src/hooks/useQuery.js` | create | `{ data, loading, error }` over `observe` |
| `src/links/store.js` | modify | collections instead of `db.*` |
| `src/hooks/useLinks.js` | modify | `useQuery` instead of `useLiveQuery` |
| `src/hooks/useWorkspace.jsx` | modify | same |
| `src/pages/LinksPage.jsx`, `QRCodesPage.jsx` | modify | three store-backed call sites |
| `docs/adr/0009-storage-is-a-provider-behind-one-collection-contract.md` | create | the decision record |

---

### Task 1: The contract, the Dexie adapter, and the contract test

**Files:**
- Create: `src/storage/provider.js`, `src/storage/dexie-provider.js`, `src/storage/provider-contract.test.js`
- Create: `docs/adr/0009-storage-is-a-provider-behind-one-collection-contract.md`

**Interfaces:**
- Produces: `setProvider`, `getProvider`, `collection(name)`, `transaction(names, fn)`, `observe(querier)` from `src/storage/provider.js`; `dexieProvider` from `src/storage/dexie-provider.js`; `describeProviderContract(name, createProvider)` from `src/storage/provider-contract.test.js`.
- Nothing else changes in this task; `src/links/store.js` still uses `db` directly.

- [ ] **Step 1: Write the failing contract test**

Create `src/storage/provider-contract.test.js`:

```js
import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import db from '../db.js';
import { dexieProvider } from './dexie-provider.js';

/**
 * The suite every storage provider must pass. A second provider imports this
 * and calls it with its own factory; nothing here knows about Dexie.
 */
export function describeProviderContract(name, createProvider) {
  describe(`${name} provider contract`, () => {
    let provider;
    let templates;

    beforeEach(async () => {
      provider = await createProvider();
      templates = provider.collection('templates');
    });

    it('adds a document and reads it back by id', async () => {
      const id = await templates.add({ name: 'first' });

      expect((await templates.get(id)).name).toBe('first');
    });

    it('lists documents, newest first when asked', async () => {
      const first = await templates.add({ name: 'first' });
      const second = await templates.add({ name: 'second' });

      expect((await templates.list()).map(row => row.id)).toEqual([first, second]);
      expect((await templates.list({ reverse: true })).map(row => row.id)).toEqual([
        second,
        first,
      ]);
    });

    it('lists only the documents a field matches', async () => {
      const attributes = provider.collection('linkAttributes');
      await attributes.add({ linkId: 1, attributeId: 7, value: 'north' });
      await attributes.add({ linkId: 2, attributeId: 7, value: 'south' });

      const mine = await attributes.list({ where: { field: 'linkId', equals: 1 } });

      expect(mine.map(row => row.value)).toEqual(['north']);
    });

    it('merges changes into a document, leaving its other fields alone', async () => {
      const id = await templates.add({ name: 'first', slug: 'keep-me' });

      await templates.update(id, { name: 'renamed' });

      expect(await templates.get(id)).toEqual(
        expect.objectContaining({ name: 'renamed', slug: 'keep-me' }),
      );
    });

    it('removes one document', async () => {
      const id = await templates.add({ name: 'doomed' });

      await templates.remove(id);

      expect(await templates.get(id)).toBeUndefined();
    });

    it('removes every document a field matches, and no others', async () => {
      const attributes = provider.collection('linkAttributes');
      await attributes.add({ linkId: 1, attributeId: 7, value: 'north' });
      await attributes.add({ linkId: 1, attributeId: 9, value: 'q3' });
      await attributes.add({ linkId: 2, attributeId: 7, value: 'south' });

      await attributes.removeWhere('linkId', 1);

      expect((await attributes.list()).map(row => row.value)).toEqual(['south']);
    });

    it('adds many documents at once', async () => {
      await templates.bulkAdd([{ name: 'one' }, { name: 'two' }]);

      expect(await templates.list()).toHaveLength(2);
    });

    it('leaves nothing behind when a transaction fails', async () => {
      await expect(
        provider.transaction(['templates'], async () => {
          await templates.add({ name: 'doomed' });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(await templates.list()).toEqual([]);
    });

    it('re-runs an observed query when the data it read changes', async () => {
      const counts = [];
      let arrived;
      const nextResult = () => new Promise(resolve => { arrived = resolve; });

      let pending = nextResult();
      const subscription = provider.observe(() => templates.list()).subscribe({
        next: rows => { counts.push(rows.length); arrived(); },
      });

      await pending;
      pending = nextResult();
      await templates.add({ name: 'later' });
      await pending;
      subscription.unsubscribe();

      expect(counts[0]).toBe(0);
      expect(counts[counts.length - 1]).toBe(1);
    });
  });
}

describeProviderContract('Dexie', async () => {
  await db.delete();
  await db.open();
  return dexieProvider;
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/storage/provider-contract.test.js`
Expected: FAIL — `src/storage/dexie-provider.js` does not exist, so the file errors on import.

- [ ] **Step 3: Write `src/storage/dexie-provider.js`**

```js
import { liveQuery } from 'dexie';
import db from '../db.js';

/**
 * The Dexie adapter: the only file that knows Dexie's query API. The schema
 * it works against stays in src/db.js, because schema and migrations belong
 * to an adapter rather than to the contract (ADR-0009).
 */
function handleFor(table) {
  return {
    list(query = {}) {
      if (query.where) {
        return table.where(query.where.field).equals(query.where.equals).toArray();
      }
      return query.reverse ? table.reverse().toArray() : table.toArray();
    },
    get(id) {
      return table.get(id);
    },
    add(doc) {
      return table.add(doc);
    },
    bulkAdd(docs) {
      return table.bulkAdd(docs);
    },
    update(id, changes) {
      return table.update(id, changes);
    },
    remove(id) {
      return table.delete(id);
    },
    removeWhere(field, equals) {
      return table.where(field).equals(equals).delete();
    },
  };
}

function tableFor(name) {
  const table = db[name];
  if (!table) throw new Error(`No collection named "${name}"`);
  return table;
}

export const dexieProvider = {
  collection(name) {
    return handleFor(tableFor(name));
  },

  transaction(names, fn) {
    return db.transaction('rw', names.map(tableFor), fn);
  },

  /**
   * liveQuery re-runs the querier whenever Dexie data it read changes, so it
   * tracks dependencies itself. That is this adapter's convenience, not part
   * of the contract: another provider may re-run the querier on any signal.
   */
  observe(querier) {
    return liveQuery(querier);
  },
};
```

- [ ] **Step 4: Write `src/storage/provider.js`**

```js
import { dexieProvider } from './dexie-provider.js';

/**
 * Where the app reads and writes. Domain modules call collections; only an
 * adapter knows a database API (ADR-0009).
 *
 * A provider:
 *   collection(name)        -> collection handle
 *   transaction(names, fn)  -> Promise, atomic across the named collections
 *   observe(querier)        -> { subscribe({ next, error }) -> { unsubscribe() } }
 *
 * A collection handle, every method async and able to reject:
 *   list(query?)            query: { where: { field, equals }, reverse: boolean }
 *   get(id)
 *   add(doc)                -> the new id
 *   bulkAdd(docs)
 *   update(id, changes)     merges changes into the document
 *   remove(id)
 *   removeWhere(field, equals)
 */
let provider = dexieProvider;

/** Swaps the provider the app uses; for tests and for a future runtime choice. */
export function setProvider(next) {
  provider = next;
}

export function getProvider() {
  return provider;
}

export function collection(name) {
  return provider.collection(name);
}

export function transaction(names, fn) {
  return provider.transaction(names, fn);
}

export function observe(querier) {
  return provider.observe(querier);
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm run test:unit`
Expected: PASS — `Tests 98 passed (98)` (89 existing + 9 contract tests).

- [ ] **Step 6: Write ADR-0009**

Create `docs/adr/0009-storage-is-a-provider-behind-one-collection-contract.md`:

```markdown
# Storage is a provider behind one collection contract

The app reads and writes through a storage provider: `collection(name)` with `list`, `get`, `add`, `bulkAdd`, `update`, `remove` and `removeWhere`, plus `transaction` and `observe`. Only an adapter knows a database API. Dexie is one adapter; another local engine or a remote API can be a second.

A repository interface per domain — Links, Templates, Members and the rest — was the alternative. It would make a second provider implement eight interfaces of mostly identical CRUD. One collection contract keeps what a new provider owes to a single small shape, and leaves domain meaning in modules like `src/links/store.js`, where it already lives.

Every contract method is asynchronous and may reject, although the Dexie adapter is effectively instant and never fails. The cost today is a promise where none is needed; the cost of the opposite choice is revisiting every call site when a remote provider arrives.

Reactivity is the app's, not Dexie's. `observe(querier)` is part of the contract and `useQuery` is the app's hook, so pages no longer import `dexie-react-hooks`. The Dexie adapter implements `observe` with Dexie's own `liveQuery`, which tracks the reads a querier performs, so behaviour is unchanged today. A remote adapter may refetch on a websocket message or poll instead.

Schema and migrations stay with the adapter, in `src/db.js`. A remote provider's schema does not live in the browser, so the contract says nothing about either.

## Consequences

`useQuery` returns `{ data, loading, error }`, but nothing renders a loading or error state yet: call sites default `data` the way they defaulted `useLiveQuery(...) || []`. The states exist so that the project which adds a remote provider has somewhere to put them, along with auth, offline and conflict behaviour.

`useQuery` has no unit test. Testing a React hook needs `@testing-library/react` and a jsdom environment, which this repo does not have, and adding both is a separate decision. The end-to-end suite drives every page that uses it.

The eight admin tables — templates, parameters, attributes, members, shorteners, rules, QR designs and custom parameter definitions — still reach `db` and `useLiveQuery` directly from their pages. Until they move, `src/db.js` is imported from two places by design: the adapter and those pages.
```

- [ ] **Step 7: Commit**

```bash
git add src/storage docs/adr/0009-storage-is-a-provider-behind-one-collection-contract.md
git commit -m "feat: put storage behind a provider contract" -m "One collection contract with transaction and observe, a Dexie adapter that is the only file knowing Dexie's query API, and a contract suite any future provider must pass. Nothing calls it yet." -m "Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 2: The Link store reads and writes through the provider

**Files:**
- Modify: `src/links/store.js`

**Interfaces:**
- Consumes: `collection`, `transaction` from `src/storage/provider.js` (Task 1).
- Produces: no interface change. `saveLink`, `saveLinks`, `deleteLink`, `cloneLink`, `listLinks`, `listQrLinks`, `listCustomParams`, `attachQrCode`, `deleteAttribute` keep their names, arguments and return values.

`src/links/store.test.js` is the safety net: it already covers every one of these functions and must keep passing untouched. This task changes no test.

- [ ] **Step 1: Confirm the net is green before you touch anything**

Run: `npx vitest run src/links/store.test.js`
Expected: PASS, 16 tests.

- [ ] **Step 2: Replace the import and the table handles**

In `src/links/store.js`, replace:

```js
import db from '../db.js';

const LINK_TABLES = () => [db.links, db.linkAttributes, db.linkCustomParams];
```

with:

```js
import { collection, transaction } from '../storage/provider.js';

const LINK_COLLECTIONS = ['links', 'linkAttributes', 'linkCustomParams'];

const links = () => collection('links');
const linkAttributes = () => collection('linkAttributes');
const linkCustomParams = () => collection('linkCustomParams');
```

- [ ] **Step 3: Move each function onto the collections**

Apply these replacements in `src/links/store.js`. Everything not listed — `rowFor`, `attributeRowsFor`, `qrFieldsFor`, and every comment — stays exactly as it is.

In `insert`:

```js
  const linkId = await db.links.add({ ...rowFor(draft), ...qrFieldsFor(qr) });
```
→
```js
  const linkId = await links().add({ ...rowFor(draft), ...qrFieldsFor(qr) });
```

```js
  if (customParams.length > 0) await db.linkCustomParams.bulkAdd(customParams);
```
→
```js
  if (customParams.length > 0) await linkCustomParams().bulkAdd(customParams);
```

```js
  if (attrs.length > 0) await db.linkAttributes.bulkAdd(attrs);
```
→
```js
  if (attrs.length > 0) await linkAttributes().bulkAdd(attrs);
```

`saveLink`:

```js
  return db.transaction('rw', LINK_TABLES(), () => insert(draft, qr));
```
→
```js
  return transaction(LINK_COLLECTIONS, () => insert(draft, qr));
```

`saveLinks`:

```js
  return db.transaction('rw', LINK_TABLES(), async () => {
```
→
```js
  return transaction(LINK_COLLECTIONS, async () => {
```

`deleteLink` — its whole body:

```js
  return transaction(LINK_COLLECTIONS, async () => {
    await linkCustomParams().removeWhere('linkId', linkId);
    await linkAttributes().removeWhere('linkId', linkId);
    await links().remove(linkId);
  });
```

`cloneLink` — the transaction line becomes `return transaction(LINK_COLLECTIONS, async () => {`, and inside it:

```js
    const original = await db.links.get(linkId);
```
→
```js
    const original = await links().get(linkId);
```

```js
    const copyId = await db.links.add({
```
→
```js
    const copyId = await links().add({
```

```js
    const params = await db.linkCustomParams.where('linkId').equals(linkId).toArray();
    if (params.length > 0) {
      await db.linkCustomParams.bulkAdd(
```
→
```js
    const params = await linkCustomParams().list({ where: { field: 'linkId', equals: linkId } });
    if (params.length > 0) {
      await linkCustomParams().bulkAdd(
```

```js
    const attrs = await db.linkAttributes.where('linkId').equals(linkId).toArray();
    if (attrs.length > 0) {
      await db.linkAttributes.bulkAdd(
```
→
```js
    const attrs = await linkAttributes().list({ where: { field: 'linkId', equals: linkId } });
    if (attrs.length > 0) {
      await linkAttributes().bulkAdd(
```

`listLinks`:

```js
  return db.links.reverse().toArray();
```
→
```js
  return links().list({ reverse: true });
```

`attachQrCode`:

```js
  return db.links.update(linkId, qrFieldsFor(qr));
```
→
```js
  return links().update(linkId, qrFieldsFor(qr));
```

`listQrLinks` — the scan moves into this module, which is where it belongs; keep the existing doc comment above it:

```js
export async function listQrLinks() {
  const all = await links().list();
  return all.filter(link => Boolean(link.qrCode));
}
```

`listCustomParams`:

```js
  return db.linkCustomParams.toArray();
```
→
```js
  return linkCustomParams().list();
```

`deleteAttribute` — its whole body:

```js
  return transaction(['attributes', 'linkAttributes'], async () => {
    await collection('linkAttributes').removeWhere('attributeId', attributeId);
    await collection('attributes').remove(attributeId);
  });
```

- [ ] **Step 4: Run the net to verify it still passes**

Run: `npm run test:unit`
Expected: PASS — `Tests 98 passed (98)`, `src/links/store.test.js` unchanged.

Run: `grep -n "db\." src/links/store.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/links/store.js
git commit -m "refactor: read and write Links through the storage provider" -m "The Link store calls collections and the provider's transaction instead of Dexie tables. Its interface is unchanged, and store.test.js passes untouched." -m "Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 3: `useQuery` replaces `useLiveQuery` at the seamed call sites

**Files:**
- Create: `src/hooks/useQuery.js`
- Modify: `src/hooks/useLinks.js`, `src/hooks/useWorkspace.jsx`, `src/pages/LinksPage.jsx`, `src/pages/QRCodesPage.jsx`

**Interfaces:**
- Consumes: `collection`, `observe` from `src/storage/provider.js` (Task 1); `listLinks`, `listQrLinks`, `listCustomParams` from `src/links` (Task 2).
- Produces: `useQuery(querier, deps)` → `{ data, loading, error }`.

There is no unit test for a React hook in this repo (no jsdom, no `@testing-library/react`) and this task must not add those dependencies. The e2e suite is the net: it drives every converted page. Run it before you start so you know it was green, and again at the end.

- [ ] **Step 1: Confirm the net is green before you touch anything**

Run: `npm test`
Expected: all specs pass, 0 failed. Record the total in your report.

- [ ] **Step 2: Create `src/hooks/useQuery.js`**

```js
import { useEffect, useState } from 'react';
import { observe } from '../storage/provider.js';

/**
 * Subscribes to a storage query and re-runs it whenever the data it read
 * changes (ADR-0009). `data` is undefined until the first result, so a caller
 * supplies its own default. Nothing renders `loading` or `error` yet; they
 * exist for the project that adds a remote provider.
 */
export function useQuery(querier, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });

  useEffect(() => {
    let live = true;
    setState(current => ({ ...current, loading: true }));

    const subscription = observe(querier).subscribe({
      next: data => {
        if (live) setState({ data, loading: false, error: null });
      },
      error: error => {
        if (live) setState(current => ({ data: current.data, loading: false, error }));
      },
    });

    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, deps);

  return state;
}
```

- [ ] **Step 3: Convert `src/hooks/useLinks.js`**

Replace the two imports:

```js
import { useLiveQuery } from 'dexie-react-hooks';
```
→
```js
import { useQuery } from './useQuery.js';
```

and

```js
import db from '../db';
```
→
```js
import { collection } from '../storage/provider.js';
```

Then each read:

```js
  const members = useLiveQuery(() => db.members.toArray(), []) || [];
```
→
```js
  const { data: members = [] } = useQuery(() => collection('members').list(), []);
```

```js
  const rules = useLiveQuery(() => db.rules.toArray(), []) || [];
```
→
```js
  const { data: rules = [] } = useQuery(() => collection('rules').list(), []);
```

```js
  const customParamRows = useLiveQuery(listCustomParams, []) || [];
```
→
```js
  const { data: customParamRows = [] } = useQuery(listCustomParams, []);
```

```js
  const templates = useLiveQuery(() => db.templates.toArray(), []) || [];
```
→
```js
  const { data: templates = [] } = useQuery(() => collection('templates').list(), []);
```

Every exported hook keeps its signature and its doc comment.

- [ ] **Step 4: Convert `src/hooks/useWorkspace.jsx`**

Replace:

```js
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db';
```
→
```js
import { useQuery } from './useQuery.js';
import { collection } from '../storage/provider.js';
```

and:

```js
  const settings = useLiveQuery(() => db.workspaceSettings.toCollection().first()) || {};
```
→
```js
  const { data: rows = [] } = useQuery(() => collection('workspaceSettings').list(), []);
  const settings = rows[0] || {};
```

- [ ] **Step 5: Convert the three page call sites**

`src/pages/LinksPage.jsx` — replace `import { useLiveQuery } from 'dexie-react-hooks';` with `import { useQuery } from '../hooks/useQuery';`, then:

```js
  const links = useLiveQuery(listLinks) || [];
```
→
```js
  const { data: links = [] } = useQuery(listLinks, []);
```

`src/pages/QRCodesPage.jsx` — this file keeps `useLiveQuery` for its other reads (templates, QR designs, parameters), which belong to a later project, so ADD the import `import { useQuery } from '../hooks/useQuery';` alongside the existing `dexie-react-hooks` import, then:

```js
  const links = useLiveQuery(listQrLinks, []) || [];
```
→
```js
  const { data: links = [] } = useQuery(listQrLinks, []);
```

```js
  const existingLinks = useLiveQuery(listLinks, []) || [];
```
→
```js
  const { data: existingLinks = [] } = useQuery(listLinks, []);
```

- [ ] **Step 6: Verify**

Run: `npm run test:unit && npm run build`
Expected: `Tests 98 passed (98)`; `✓ built`.

Run: `grep -n "dexie-react-hooks\|from '../db'" src/hooks/useLinks.js src/hooks/useWorkspace.jsx src/pages/LinksPage.jsx`
Expected: no output.

Run: `npm test`
Expected: every spec passes, 0 failed — the same total as Step 1. This is the only test covering `useQuery`, so read the failures carefully if any appear: a hook that never resolves shows up as an empty table or a missing row, not as an error.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useQuery.js src/hooks/useLinks.js src/hooks/useWorkspace.jsx src/pages/LinksPage.jsx src/pages/QRCodesPage.jsx
git commit -m "feat: subscribe to storage through useQuery" -m "useQuery returns { data, loading, error } over the provider's observe, and replaces useLiveQuery in the Link hooks, the workspace hook and the three store-backed page reads. The admin pages keep dexie-react-hooks until their own project." -m "Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 4: Verify and open the PR

- [ ] **Step 1: Confirm the seam holds**

Run: `grep -rn "from 'dexie'" src/ | grep -v "src/storage/dexie-provider.js"; grep -rn "db\." src/links/ src/hooks/ | grep -v test`
Expected: no output from either — outside the adapter, no file in `src/links/` or `src/hooks/` touches Dexie or `db`.

- [ ] **Step 2: Full verification**

Run: `npm run test:unit && npm run build && npm test`
Expected: `Tests 98 passed (98)`; `✓ built`; e2e all passed, 0 failed.

- [ ] **Step 3: Push and open the PR against `main`**

```bash
gh pr list --head feat/storage-provider --state all
git push -u origin feat/storage-provider
gh pr create --base main --title "Storage behind a provider" --body-file <path-to-body>
```

The body must state: the contract and why it is one collection shape rather than a repository per domain, that everything is async and fallible by design, that reactivity moved from `dexie-react-hooks` to `useQuery`, what is deliberately left for the two later projects, the `useQuery` test gap, and exact test results. End it with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
