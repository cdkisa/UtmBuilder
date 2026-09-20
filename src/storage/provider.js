import { dexieProvider } from './dexie-provider.js';

/**
 * Where the app reads and writes. Domain modules call collections; only an
 * adapter knows a database API (ADR-0009).
 *
 * A provider:
 *   collection(name)              -> collection handle
 *   transaction(names, fn)        -> Promise, atomic across the named
 *                                    collections; calls fn(tx), where
 *                                    tx.collection(name) returns a handle
 *                                    bound to that transaction. Writing
 *                                    through a handle obtained any other way
 *                                    inside fn is not guaranteed to join it.
 *   observe(querier, collections) -> { subscribe({ next, error }) -> { unsubscribe() } }
 *                                    collections names what the querier
 *                                    reads, for a provider that needs to be
 *                                    told when to re-run it.
 *
 * A collection handle, every method async and able to reject:
 *   list(query?)            query: { where: { field, equals }, reverse: boolean }
 *                            With no query, documents come back id-ascending;
 *                            { reverse: true } returns them id-descending.
 *   get(id)
 *   add(doc)                -> the new id
 *   bulkAdd(docs)
 *   update(id, changes)     merges changes into the document
 *   remove(id)
 *   removeWhere(field, equals)
 *
 * `where` and `removeWhere` name a field the adapter can query. The Dexie
 * adapter requires it to be indexed in src/db.js; querying an unindexed field
 * throws.
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

export function observe(querier, collections) {
  return provider.observe(querier, collections);
}
