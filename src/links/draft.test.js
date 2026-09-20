import { describe, it, expect } from 'vitest';
import { createLinkDraft } from './draft.js';

describe('LinkDraft', () => {
  it('builds a draft from the resolved values and derives its URLs', () => {
    const draft = createLinkDraft({
      utm: { campaign: 'summer', medium: 'social' },
      destination: 'https://example.com/page?ref=keep',
      customParameters: [{ name: 'source', value: 'newsletter' }],
      attributes: { region: 'na' },
      templateId: 4,
      notes: 'note',
      author: 'Admin',
      shortener: { domain: 'go.acme.test' },
      generateCode: () => 'abc1234',
    });

    expect(draft).toMatchObject({
      utm: { campaign: 'summer', medium: 'social' },
      destination: 'https://example.com/page?ref=keep',
      templateId: 4,
      notes: 'note',
      author: 'Admin',
      attributes: { region: 'na' },
    });
    expect(draft.taggedUrl).toBe(
      'https://example.com/page?ref=keep&utm_campaign=summer&utm_medium=social&source=newsletter',
    );
    expect(draft.shortUrl).toBe('https://go.acme.test/abc1234');
  });
});
