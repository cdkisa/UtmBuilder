# Storage behind a provider

Project A of three. The goal across all three is that UTM Builder can run on a storage backend other than Dexie/IndexedDB — another local engine, or a remote API.

## Problem

Dexie is not behind any seam. Twelve files import `src/db.js`, and eleven import `dexie-react-hooks` for 26 `useLiveQuery` call sites. Two couplings, not one:

- **The query API.** `db.links.where('linkId').equals(id).toArray()` and friends appear throughout `src/links/store.js` and the pages.
- **Reactivity, which is the deeper one.** `useLiveQuery` means a page assumes data is present immediately and re-renders itself whenever the database changes. Call sites write `useLiveQuery(...) || []`, so "still loading" and "empty" are the same thing, and failure is not a state at all. A remote backend breaks that assumption everywhere at once.

## Scope

This project builds the seam and the Dexie adapter, and moves the parts that already have a seam onto it: `src/links/store.js`, `src/hooks/useLinks.js`, `src/hooks/useWorkspace.jsx`, and the three store-backed call sites in `LinksPage.jsx` and `QRCodesPage.jsx`.

Out of scope, each its own project:

- **B — the eight admin tables** (templates, parameters, attributes, members, shorteners, rules, QR designs, custom parameter definitions) and their pages, which keep using `db` and `useLiveQuery` directly. `src/db.js` therefore stays where it is; folding the schema into the adapter is B's ending.
- **C — what only a remote provider needs**: loading and error states in the UI, auth and identity, offline and conflict behaviour, pagination. Designing that before a backend exists is invention.

Nothing user-visible changes in this project.

## Decisions

1. **One small collection contract, not a repository per domain.** A provider implements a single collection shape plus two provider-level methods. Domain meaning stays in modules like `src/links/store.js`. A second provider has one interface to satisfy, and most of its methods are ordinary CRUD.
2. **Async and fallible.** Every contract method returns a promise that may reject, even though the Dexie adapter is effectively instant and never fails. Designing for the remote case now is what makes it cheap later.
3. **Reactivity belongs to the app, not to Dexie.** `observe(querier)` is part of the contract, and `useQuery` is the app's hook. The Dexie adapter implements `observe` with Dexie's `liveQuery`, so behaviour today is identical. A remote adapter may refetch on a websocket message, or poll.
4. **`{ data, loading, error }` from the start.** Call sites destructure `data` with a default, matching today's `|| []`. No page renders a loading or error state yet; that is project C. The shape exists so those states have somewhere to live.
5. **Schema and migrations are the adapter's business.** The contract says nothing about them. A remote provider's schema does not live in the browser.
6. **The contract test is the deliverable that makes providers swappable.** One suite, exported as a function, run against the Dexie adapter now and unchanged against the next adapter.

## Design

### `src/storage/provider.js` — the contract and the configured provider

Documents the contract and holds the provider the app uses:

- `setProvider(provider)` replaces it, for tests and for a future runtime choice.
- `getProvider()` returns it, defaulting to the Dexie adapter.
- `collection(name)` is a convenience for `getProvider().collection(name)`.

A **provider** has:

- `collection(name)` → a collection handle
- `transaction(names, fn)` — runs `fn` atomically across the named collections; a rejection rolls everything back
- `observe(querier)` — calls `querier`, then calls it again whenever data it read changes. Returns an object with `subscribe({ next, error })`, which returns a subscription with `unsubscribe()` — the shape Dexie's `liveQuery` already has.

A **collection handle** has:

- `list(query?)` — every row, or those matching `query`. `query` may hold `{ where: { field, equals } }` and `{ reverse: true }` (reverse means by id, descending: newest first).
- `get(id)`
- `add(doc)` → the new id
- `bulkAdd(docs)`
- `update(id, changes)` — merges `changes` into the row
- `remove(id)`
- `removeWhere(field, equals)` — deletes every row whose `field` equals the value; the cascade `store.js` already performs

Anything beyond this stays in the domain module. `listQrLinks`'s unindexed scan, for instance, becomes `list()` plus a JavaScript `filter` in `store.js`, which is what Dexie was doing anyway.

### `src/storage/dexie-provider.js` — the only file that knows Dexie's query API

Wraps the existing `src/db.js` instance. Mapping:

| Contract | Dexie |
| --- | --- |
| `list()` | `table.toArray()` |
| `list({ reverse: true })` | `table.reverse().toArray()` |
| `list({ where: { field, equals } })` | `table.where(field).equals(value).toArray()` |
| `get(id)` | `table.get(id)` |
| `add(doc)` | `table.add(doc)` |
| `bulkAdd(docs)` | `table.bulkAdd(docs)` |
| `update(id, changes)` | `table.update(id, changes)` |
| `remove(id)` | `table.delete(id)` |
| `removeWhere(field, equals)` | `table.where(field).equals(value).delete()` |
| `transaction(names, fn)` | `db.transaction('rw', tables, fn)` |
| `observe(querier)` | `liveQuery(querier)` |

`liveQuery` tracks whatever Dexie reads the querier performs, including reads made through this adapter, so `observe` needs no explicit dependency declaration. That is a property of this adapter, not of the contract: a remote adapter is free to re-run the querier on any signal it likes.

### `src/hooks/useQuery.js`

`useQuery(querier, deps = [])` returns `{ data, loading, error }`:

- `loading` starts `true` and becomes `false` on the first result or error.
- `data` is `undefined` until the first result; call sites supply their own default.
- `error` holds a rejection from the querier or the subscription; `data` keeps its last value.
- Re-subscribes when `deps` change, and calls `unsubscribe()` on unmount.

### What changes

- **`src/links/store.js`** — every `db.*` call becomes a collection call; `LINK_TABLES` becomes the names `['links', 'linkAttributes', 'linkCustomParams']`; `deleteAttribute` uses `['attributes', 'linkAttributes']`. Its exported functions keep their names, arguments and return values.
- **`src/hooks/useLinks.js`** — its four `useLiveQuery` calls become `useQuery`, reading through collections instead of `db.members`, `db.rules` and `db.templates`. `useCurrentAuthor`, `useLinkPolicy`, `useTaggedUrl` and `useTemplateLookup` keep their signatures, so no page that uses them changes.
- **`src/hooks/useWorkspace.jsx`** — `useQuery` over `collection('workspaceSettings').list()`, taking the first row. `useWorkspace()` still returns `{ settings }`.
- **`src/pages/LinksPage.jsx:26`** and **`src/pages/QRCodesPage.jsx:23,135`** — `useLiveQuery(listLinks)` becomes `useQuery(listLinks, [])` with `data` defaulted to `[]`. The QR page's other live queries are project B's and stay as they are, so that file keeps importing `dexie-react-hooks` for now.
- `src/db.js` is unchanged.

## Testing

- **`src/storage/provider-contract.test.js`** exports `describeProviderContract(name, createProvider)` and runs it against the Dexie adapter with `fake-indexeddb`. It covers: `add` then `get`; `list` order, `where` and `reverse`; `update` merging; `remove`; `removeWhere` deleting only matching rows; `bulkAdd`; a `transaction` that rejects leaving nothing behind; and `observe` delivering a first result and then a second after a write.
- **`src/links/store.test.js`** keeps its assertions, now exercising the provider path. Its direct `db.*` reads may stay: they assert stored state, and the Dexie adapter writes to the same tables.
- **`useQuery` gets no unit test.** Testing a React hook needs `@testing-library/react` and a jsdom environment, which this repo does not have; adding them is a separate decision. The e2e suite drives every converted page, so a broken hook fails there. This gap is stated in the ADR.

## Docs

ADR-0009, "Storage is a provider behind one collection contract": decisions 1, 2, 3 and 5, the reason `useQuery` has no unit test, and the two projects that follow.
