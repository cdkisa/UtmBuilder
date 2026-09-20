import 'fake-indexeddb/auto';
import db from '../db.js';
import { describeProviderContract } from './provider-contract.js';
import { setProvider, getProvider } from './provider.js';
import { dexieProvider } from './dexie-provider.js';

describeProviderContract('Dexie', async () => {
  await db.delete();
  await db.open();
  // Route the suite through the module-level provider, so setProvider and the
  // delegating exports are covered too.
  setProvider(dexieProvider);
  return getProvider();
});
