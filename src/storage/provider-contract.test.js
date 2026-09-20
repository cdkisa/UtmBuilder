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

    it('lists matching documents newest first when asked for both', async () => {
      const attributes = provider.collection('linkAttributes');
      await attributes.add({ linkId: 1, attributeId: 7, value: 'first' });
      await attributes.add({ linkId: 2, attributeId: 7, value: 'other' });
      await attributes.add({ linkId: 1, attributeId: 9, value: 'second' });

      const mine = await attributes.list({ where: { field: 'linkId', equals: 1 }, reverse: true });

      expect(mine.map(row => row.value)).toEqual(['second', 'first']);
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
