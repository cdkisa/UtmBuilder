import { describe, it, expect } from 'vitest';
import { createPolicy, taggedUrlOf, linksToCsv, csvToDrafts } from './index.js';
import { parseCsv } from '../utils/csv.js';

const policy = createPolicy({ spaceChar: 'hyphen' });
const COLUMNS = 'created_by,created_at,short_url,full_url,campaign,medium,source,term,content,notes,url';

function link(overrides = {}) {
  return {
    id: 1,
    url: 'https://a.test',
    shortUrl: '',
    campaign: '',
    medium: '',
    source: '',
    term: '',
    content: '',
    notes: '',
    createdBy: 'Admin',
    createdAt: '2026-09-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('linksToCsv', () => {
  it('writes the Link columns in a fixed order, even for no Links', () => {
    expect(linksToCsv([], l => taggedUrlOf(l, policy))).toBe(COLUMNS);
  });

  it('writes each Link with its Tagged URL', () => {
    const stored = link({ shortUrl: 'https://go.test/abc', campaign: 'summer', notes: 'hi' });

    const [record] = parseCsv(linksToCsv([stored], l => taggedUrlOf(l, policy)));

    expect(record).toEqual({
      created_by: 'Admin',
      created_at: '2026-09-19T00:00:00.000Z',
      short_url: 'https://go.test/abc',
      full_url: 'https://a.test?utm_campaign=summer',
      campaign: 'summer',
      medium: '',
      source: '',
      term: '',
      content: '',
      notes: 'hi',
      url: 'https://a.test',
    });
  });
});

describe('csvToDrafts', () => {
  it("lets a row's UTM columns replace those already on its Tagged URL (ADR-0002)", () => {
    const { drafts } = csvToDrafts(
      'full_url,campaign\nhttps://a.test?utm_campaign=old&ref=x,new',
      policy,
    );

    expect(drafts[0].taggedUrl).toBe('https://a.test?ref=x&utm_campaign=new');
  });

  it('falls back to the url column when there is no full_url', () => {
    const { drafts } = csvToDrafts('url,utm_source\nb.test,google', policy);

    expect(drafts[0].taggedUrl).toBe('https://b.test?utm_source=google');
  });

  it('prefers a utm_ column over the bare one', () => {
    const { drafts } = csvToDrafts('url,utm_medium,medium\na.test,email,cpc', policy);

    expect(drafts[0].utm.medium).toBe('email');
  });

  it('matches headers whatever their case', () => {
    const { drafts } = csvToDrafts('URL,Campaign,UTM_SOURCE\na.test,x,y', policy);

    expect(drafts[0].taggedUrl).toBe('https://a.test?utm_campaign=x&utm_source=y');
  });

  it('skips a row with no URL, numbering rows as a spreadsheet does', () => {
    const { drafts, skipped } = csvToDrafts(
      'url,notes\na.test,"two\nlines"\n,orphan\nb.test,ok',
      policy,
    );

    expect(drafts).toHaveLength(2);
    expect(skipped).toEqual([{ row: 3, reason: 'No URL' }]);
  });

  it('skips a row the Policy rejects, giving its first Violation', () => {
    const strict = createPolicy({ spaceChar: 'hyphen' }, [
      { id: 1, name: 'Rule 1', config: { campaign: { required: true } } },
    ]);

    const { drafts, skipped } = csvToDrafts('url,campaign\na.test,\nb.test,ok', strict);

    expect(drafts).toHaveLength(1);
    expect(skipped).toEqual([{ row: 2, reason: 'Campaign is required.' }]);
  });

  it('keeps the Short URL from the file and credits the import', () => {
    const { drafts } = csvToDrafts('url,short_url\na.test,https://go.test/abc', policy);

    expect(drafts[0].shortUrl).toBe('https://go.test/abc');
    expect(drafts[0].author).toBe('Import');
  });
});

describe('a round-trip through CSV (ADR-0008)', () => {
  it('gives back the same Tagged URL, Short URL, UTM values and notes', () => {
    const links = [
      link({
        id: 1,
        shortUrl: 'https://go.test/abc',
        campaign: 'Summer Sale',
        medium: 'email',
        source: 'news',
        content: 'hero',
        notes: 'line one\nline two, with "quotes"',
      }),
      link({ id: 2, url: 'https://b.test/path?page=1', campaign: 'x', term: 't' }),
    ];
    const taggedUrl = l => taggedUrlOf(l, policy);

    const { drafts, skipped } = csvToDrafts(linksToCsv(links, taggedUrl), policy);

    expect(skipped).toEqual([]);
    drafts.forEach((draft, i) => {
      expect(draft.taggedUrl).toBe(taggedUrl(links[i]));
      expect(draft.shortUrl).toBe(links[i].shortUrl);
      expect(draft.notes).toBe(links[i].notes);
      for (const field of ['campaign', 'medium', 'source', 'term', 'content']) {
        expect(draft.utm[field] || '').toBe(links[i][field]);
      }
    });
  });

  it('keeps every parameter of a Link with Custom Parameters, whatever their order', () => {
    const stored = link({ id: 3, url: 'https://c.test', campaign: 'c' });
    const rows = [{ linkId: 3, paramName: 'ref', paramValue: 'news' }];
    const original = taggedUrlOf(stored, policy, rows);

    const { drafts } = csvToDrafts(linksToCsv([stored], () => original), policy);

    const before = new URL(original);
    const after = new URL(drafts[0].taggedUrl);
    expect(after.origin + after.pathname).toBe(before.origin + before.pathname);
    expect([...after.searchParams].sort()).toEqual([...before.searchParams].sort());
  });
});
