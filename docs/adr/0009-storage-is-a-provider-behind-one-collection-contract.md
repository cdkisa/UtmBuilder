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
