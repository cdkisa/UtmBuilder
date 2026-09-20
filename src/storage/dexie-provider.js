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
      const collection = query.where
        ? table.where(query.where.field).equals(query.where.equals)
        : table;
      return query.reverse ? collection.reverse().toArray() : collection.toArray();
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
    const scope = { collection: name => handleFor(tableFor(name)) };
    return db.transaction('rw', names.map(tableFor), () => fn(scope));
  },

  /**
   * liveQuery re-runs the querier whenever Dexie data it read changes, so it
   * tracks dependencies itself. That is this adapter's convenience, not part
   * of the contract: another provider may re-run the querier on any signal.
   * `collections` is ignored here for that reason.
   */
  observe(querier, collections) {
    return liveQuery(querier);
  },
};
