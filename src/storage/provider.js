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
