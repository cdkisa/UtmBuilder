import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import db from '../db.js';
import { composeLink, createPolicy, saveLink, saveLinks, cloneLink, deleteLink } from './index.js';

const policy = createPolicy({ spaceChar: 'hyphen' });

function intent(overrides = {}) {
  return {
    destination: 'example.com',
    utm: { campaign: 'summer', medium: 'cpc' },
    customParameters: [],
    attributes: {},
    templateId: null,
    shortener: null,
    notes: '',
    author: 'Admin',
    ...overrides,
  };
}

function draftFor(overrides) {
  const result = composeLink(intent(overrides), policy, { generateCode: () => 'abc1234' });
  if (!result.ok) throw new Error('intended a valid Link Intent');
  return result.draft;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('saveLink', () => {
  it('saves a Link with its Custom Parameters and Attributes', async () => {
    const id = await saveLink(
      draftFor({
        customParameters: [{ name: 'ref', value: 'newsletter' }],
        attributes: { 7: ['north', 'south'], 9: 'q3' },
      }),
    );

    const link = await db.links.get(id);
    expect(link.url).toBe('https://example.com');
    expect(link.campaign).toBe('summer');
    expect(link.createdBy).toBe('Admin');

    const params = await db.linkCustomParams.where('linkId').equals(id).toArray();
    expect(params).toEqual([
      expect.objectContaining({ linkId: id, paramName: 'ref', paramValue: 'newsletter' }),
    ]);

    const attrs = await db.linkAttributes.where('linkId').equals(id).toArray();
    expect(attrs.map(a => [a.attributeId, a.value])).toEqual([
      [7, 'north'],
      [7, 'south'],
      [9, 'q3'],
    ]);
  });

  it('does not store the Tagged URL', async () => {
    const id = await saveLink(draftFor({}));

    const link = await db.links.get(id);
    expect(link.fullUrl).toBeUndefined();
    expect(link.taggedUrl).toBeUndefined();
  });
});

describe('deleteLink', () => {
  it('deletes the Link and its Custom Parameter and Attribute rows', async () => {
    const doomed = await saveLink(
      draftFor({
        customParameters: [{ name: 'ref', value: 'newsletter' }],
        attributes: { 7: 'north' },
      }),
    );
    const survivor = await saveLink(
      draftFor({
        customParameters: [{ name: 'ref', value: 'keep' }],
        attributes: { 7: 'south' },
      }),
    );

    await deleteLink(doomed);

    expect(await db.links.get(doomed)).toBeUndefined();
    expect(await db.linkCustomParams.where('linkId').equals(doomed).count()).toBe(0);
    expect(await db.linkAttributes.where('linkId').equals(doomed).count()).toBe(0);

    expect(await db.links.get(survivor)).toBeDefined();
    expect(await db.linkCustomParams.where('linkId').equals(survivor).count()).toBe(1);
    expect(await db.linkAttributes.where('linkId').equals(survivor).count()).toBe(1);
  });
});

describe('saveLinks', () => {
  it('saves every Draft in one transaction and returns their ids', async () => {
    const ids = await saveLinks([
      draftFor({ destination: 'one.test' }),
      draftFor({ destination: 'two.test' }),
      draftFor({ destination: 'three.test' }),
    ]);

    expect(ids).toHaveLength(3);
    const urls = (await db.links.toArray()).map(l => l.url).sort();
    expect(urls).toEqual(['https://one.test', 'https://three.test', 'https://two.test']);
  });

  it('saves nothing at all when one Draft fails', async () => {
    const bad = draftFor({ destination: 'two.test' });
    bad.attributes = { get bad() { throw new Error('boom'); } };

    await expect(
      saveLinks([draftFor({ destination: 'one.test' }), bad]),
    ).rejects.toThrow();

    expect(await db.links.count()).toBe(0);
  });
});

describe('cloneLink', () => {
  it('never copies a stale fullUrl onto the new row', async () => {
    const original = await saveLink(draftFor({}));
    await db.links.update(original, { fullUrl: 'https://example.com?utm_campaign=stale' });

    const copy = await cloneLink(original, 'Someone Else');

    expect((await db.links.get(copy)).fullUrl).toBeUndefined();
  });

  it('copies the Link and its children, crediting the new author', async () => {
    const original = await saveLink(
      draftFor({
        shortener: { domain: 'go.acme.test' },
        customParameters: [{ name: 'ref', value: 'newsletter' }],
        attributes: { 7: 'north' },
      }),
    );
    expect((await db.links.get(original)).shortUrl).toBe('https://go.acme.test/abc1234');

    const copy = await cloneLink(original, 'Someone Else');

    expect(copy).not.toBe(original);
    const copied = await db.links.get(copy);
    expect(copied.url).toBe('https://example.com');
    expect(copied.createdBy).toBe('Someone Else');
    // Two Links must never share a Short URL.
    expect(copied.shortUrl).toBe('');

    expect(await db.linkCustomParams.where('linkId').equals(copy).count()).toBe(1);
    expect(await db.linkAttributes.where('linkId').equals(copy).count()).toBe(1);
  });
});
