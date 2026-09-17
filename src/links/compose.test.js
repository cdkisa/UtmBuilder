import { describe, it, expect } from 'vitest';
import { composeLink, composeTaggedUrl, taggedUrlOf, createPolicy } from './index.js';

const policy = createPolicy({ spaceChar: 'hyphen' });

function intent(overrides = {}) {
  return {
    destination: 'example.com',
    utm: {},
    customParameters: [],
    attributes: {},
    templateId: null,
    shortener: null,
    notes: '',
    author: 'Admin',
    ...overrides,
  };
}

describe('composing a Tagged URL', () => {
  it('prepends https to a Destination with no scheme', () => {
    const result = composeLink(intent(), policy);

    expect(result.ok).toBe(true);
    expect(result.draft.taggedUrl).toBe('https://example.com');
  });

  it('appends the UTM values that are set, in canonical order', () => {
    const result = composeLink(
      intent({ utm: { medium: 'cpc', campaign: 'summer', content: 'hero' } }),
      policy,
    );

    expect(result.draft.taggedUrl).toBe(
      'https://example.com?utm_campaign=summer&utm_medium=cpc&utm_content=hero',
    );
  });

  it('replaces spaces using the separator the Policy supplies', () => {
    const underscores = createPolicy({ spaceChar: 'underscore' });

    const result = composeLink(intent({ utm: { campaign: 'summer sale 2026' } }), underscores);

    expect(result.draft.taggedUrl).toBe('https://example.com?utm_campaign=summer_sale_2026');
  });

  it('appends Custom Parameters after the UTM values, skipping incomplete pairs', () => {
    const result = composeLink(
      intent({
        utm: { campaign: 'summer' },
        customParameters: [
          { name: 'ref', value: 'newsletter' },
          { name: 'partner', value: '' },
          { name: '', value: 'orphan' },
        ],
      }),
      policy,
    );

    expect(result.draft.taggedUrl).toBe(
      'https://example.com?utm_campaign=summer&ref=newsletter',
    );
  });
});

describe('a Destination that already carries UTM values', () => {
  it('strips them and re-tags from the Intent, keeping other query parameters', () => {
    const result = composeLink(
      intent({
        destination: 'https://example.com/page?ref=keep&utm_campaign=old&utm_source=google',
        utm: { campaign: 'new' },
      }),
      policy,
    );

    expect(result.draft.destination).toBe('https://example.com/page?ref=keep');
    expect(result.draft.taggedUrl).toBe('https://example.com/page?ref=keep&utm_campaign=new');
  });
});

describe('composeTaggedUrl', () => {
  it('tags one Destination without producing a Link, preserving its scheme', () => {
    const tagged = composeTaggedUrl(
      'http://shop.test/item?utm_medium=stale&id=7',
      intent({ utm: { campaign: 'promo', medium: 'email' } }),
      policy,
    );

    expect(tagged).toBe('http://shop.test/item?id=7&utm_campaign=promo&utm_medium=email');
  });
});

describe('taggedUrlOf', () => {
  it('derives the Tagged URL of a stored Link, including its Custom Parameters', () => {
    const stored = {
      url: 'https://example.com',
      campaign: 'summer sale',
      medium: 'cpc',
      source: '',
      term: '',
      content: '',
    };

    const tagged = taggedUrlOf(stored, policy, [
      { paramName: 'ref', paramValue: 'newsletter' },
    ]);

    expect(tagged).toBe(
      'https://example.com?utm_campaign=summer-sale&utm_medium=cpc&ref=newsletter',
    );
  });

  it('ignores a stale fullUrl left on older rows', () => {
    const stored = {
      url: 'https://example.com',
      fullUrl: 'https://example.com?utm_campaign=doubled&utm_campaign=doubled',
      campaign: 'summer',
    };

    expect(taggedUrlOf(stored, policy)).toBe('https://example.com?utm_campaign=summer');
  });
});

describe('Short URLs', () => {
  const fixedCode = { generateCode: () => 'abc1234' };

  it('uses the domain of the Shortener the user chose', () => {
    const result = composeLink(
      intent({ shortener: { domain: 'go.acme.test' } }),
      policy,
      fixedCode,
    );

    expect(result.draft.shortUrl).toBe('https://go.acme.test/abc1234');
  });

  it('leaves the Short URL empty when no Shortener is chosen', () => {
    const result = composeLink(intent(), policy, fixedCode);

    expect(result.draft.shortUrl).toBe('');
  });
});

describe('violations', () => {
  it('reports a missing Destination instead of producing a Draft', () => {
    const result = composeLink(intent({ destination: '   ' }), policy);

    expect(result.ok).toBe(false);
    expect(result.draft).toBeUndefined();
    expect(result.violations).toEqual([
      { field: 'destination', message: 'URL is required' },
    ]);
  });

  it('reports a missing author, since composition supplies no default', () => {
    const result = composeLink(intent({ author: '' }), policy);

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { field: 'author', message: 'An author is required.' },
    ]);
  });

  it('reports violations raised by the Policy', () => {
    const fussy = {
      ...createPolicy({}),
      validate: () => [{ field: 'campaign', message: 'Campaign is required.' }],
    };

    const result = composeLink(intent(), fussy);

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { field: 'campaign', message: 'Campaign is required.' },
    ]);
  });
});

describe('composing under a Workspace Policy', () => {
  it('composes a workspace with no Rules exactly as it did before', () => {
    const result = composeLink(
      intent({ utm: { campaign: 'Summer Sale', medium: 'social', source: 'facebook' } }),
      policy,
    );

    expect(result.ok).toBe(true);
    expect(result.draft.taggedUrl).toBe(
      'https://example.com?utm_campaign=Summer-Sale&utm_medium=social&utm_source=facebook',
    );
  });

  it('reports a Rule Violation instead of producing a Draft', () => {
    const strict = createPolicy({}, [
      { id: 1, name: 'Rule 1', config: { campaign: { required: true } } },
    ]);

    const result = composeLink(intent(), strict);

    expect(result.ok).toBe(false);
    expect(result.draft).toBeUndefined();
    expect(result.violations).toEqual([
      { field: 'campaign', message: 'Campaign is required.' },
    ]);
  });

  it('judges the normalised value, not the one that was typed', () => {
    const strict = createPolicy({ spaceChar: 'hyphen', forceLowercase: true }, [
      { id: 1, name: 'Rule 1', config: { campaign: { prohibitedValues: 'summer-sale' } } },
    ]);

    const result = composeLink(intent({ utm: { campaign: 'Summer Sale' } }), strict);

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { field: 'campaign', message: 'Campaign may not be "summer-sale".' },
    ]);
  });

  it('derives a stored Link through the Policy, so Rules apply on read', () => {
    const lowercasing = createPolicy({ spaceChar: 'underscore', forceLowercase: true });

    expect(taggedUrlOf({ url: 'example.com', campaign: 'Summer Sale' }, lowercasing)).toBe(
      'https://example.com?utm_campaign=summer_sale',
    );
  });
});
