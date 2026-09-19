# CSV Interchange — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app can read back its own CSV export: one generic CSV module and one Link interchange module replace CSV code spread across four files.

**Architecture:** `src/utils/csv.js` holds generic, DOM-free CSV reading and writing plus a one-function download adapter. `src/links/interchange.js` builds the Link CSV format on it: `linksToCsv` for export and `csvToDrafts` for import, which composes each record under the Policy. The Links page, QR page and Import modal call those; the five other exporting pages keep `exportToCsv`, now from `src/utils/csv.js`.

**Tech Stack:** React 18, Vite 5, Dexie 3, Vitest 2 (unit, `src/**/*.test.js`), Playwright (e2e, `tests/*.spec.js`, importing `test` from `tests/fixtures.js`).

**Spec:** `docs/superpowers/specs/2026-09-19-csv-interchange-design.md` — read it before starting. It is the binding authority; this plan argues from it.

## Global Constraints

- Branch: `feat/csv-interchange` (already checked out). The PR targets `main`.
- Link CSV columns, exactly and in this order: `created_by,created_at,short_url,full_url,campaign,medium,source,term,content,notes,url`
- Import precedence (ADR-0002, unchanged): Destination = `full_url`, else `url`. Each UTM value = `utm_<field>`, else `<field>`. Header names are matched case-insensitively.
- Skip reasons: `'No URL'` for a record without a Destination; otherwise the first Violation's `message`. `row` = record index + 2 (header is row 1).
- Imported Links have author `'Import'`; `shortUrl` comes from the `short_url` column (or `''`).
- The round-trip guarantee is the Tagged URL: byte-identical without Custom Parameters; the same parameters (order-insensitive), origin and path with them.
- Never write an invisible byte-order-mark character into source. Build it as `String.fromCharCode(0xfeff)`.
- Do not change `src/links/compose.js`, `policy.js` or `store.js`, or the five non-Link pages' export columns.
- Commit messages end with a `Co-Authored-By:` trailer naming the model that actually wrote the commit.
- Unit: `npm run test:unit`. E2E: `npm test` (~1.5 min, starts its own dev server). Build: `npm run build`.
- **Every e2e spec must pass**; the suite is fully green on `main`. Any failure is yours.

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `src/utils/csv.js` | create | `toCsv`, `parseCsv`, `downloadCsv`, `exportToCsv` |
| `src/utils/csv.test.js` | create | unit tests for `toCsv` and `parseCsv` |
| `src/utils/utm.js` | modify | loses all CSV code; keeps clipboard and date helpers |
| `src/links/interchange.js` | create | `linksToCsv`, `csvToDrafts` |
| `src/links/interchange.test.js` | create | unit tests, including the round-trip guarantee |
| `src/links/index.js` | modify | export the two interchange functions |
| `src/pages/LinksPage.jsx`, `QRCodesPage.jsx` | modify | export through `linksToCsv` + `downloadCsv` |
| `src/pages/ImportLinksModal.jsx` | modify | import through `csvToDrafts`; template via `downloadCsv` |
| `src/pages/AttributesPage.jsx`, `LinkShortenersPage.jsx`, `MembersPage.jsx`, `ParametersPage.jsx`, `TemplatesPage.jsx` | modify | import path only |
| `tests/links.spec.js` | modify | one export-then-import spec |
| `docs/adr/0008-a-csv-round-trip-preserves-the-tagged-url.md` | create | the decision record |

---

### Task 1: Generic CSV module

**Files:**
- Create: `src/utils/csv.js`
- Create: `src/utils/csv.test.js`
- Modify: `src/utils/utm.js`
- Modify (import line only): `src/pages/AttributesPage.jsx`, `LinkShortenersPage.jsx`, `MembersPage.jsx`, `ParametersPage.jsx`, `TemplatesPage.jsx`, `LinksPage.jsx`, `QRCodesPage.jsx`

**Interfaces:**
- Produces: `toCsv(rows: object[]): string`, `parseCsv(text: string): object[]`, `downloadCsv(text: string, filename: string): void`, `exportToCsv(data: object[], filename: string): void`, all exported from `src/utils/csv.js`.
- `parseCsvText` stays in `src/utils/utm.js` for now, because `ImportLinksModal.jsx` still uses it. Task 3 deletes it.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/csv.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { toCsv, parseCsv } from './csv.js';

const BOM = String.fromCharCode(0xfeff);

describe('toCsv', () => {
  it("writes the first row's keys as the header, then each row in order", () => {
    expect(toCsv([{ a: '1', b: '2' }, { a: '3', b: '4' }])).toBe('a,b\n1,2\n3,4');
  });

  it('quotes a value holding a comma, a quote or a line break, doubling its quotes', () => {
    expect(toCsv([{ v: 'a,b' }, { v: 'say "hi"' }, { v: 'x\ny' }, { v: 'x\ry' }])).toBe(
      'v\n"a,b"\n"say ""hi"""\n"x\ny"\n"x\ry"',
    );
  });

  it('writes null and undefined as empty', () => {
    expect(toCsv([{ a: null, b: undefined, c: 0 }])).toBe('a,b,c\n,,0');
  });

  it('writes nothing for no rows', () => {
    expect(toCsv([])).toBe('');
  });
});

describe('parseCsv', () => {
  it('keys each record by its trimmed header', () => {
    expect(parseCsv(' a , b \n1,2')).toEqual([{ a: '1', b: '2' }]);
  });

  it('keeps a comma inside quotes', () => {
    expect(parseCsv('v\n"a,b"')).toEqual([{ v: 'a,b' }]);
  });

  it('reads a doubled quote inside quotes as one quote', () => {
    expect(parseCsv('v\n"say ""hi"""')).toEqual([{ v: 'say "hi"' }]);
  });

  it('keeps a line break inside quotes as part of one record', () => {
    expect(parseCsv('v,w\n"line one\nline two",x')).toEqual([
      { v: 'line one\nline two', w: 'x' },
    ]);
  });

  it('reads CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,4\r\n')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('ignores a leading byte-order mark', () => {
    expect(parseCsv(`${BOM}a\n1`)).toEqual([{ a: '1' }]);
  });

  it('ignores blank lines', () => {
    expect(parseCsv('a\n\n1\n\n')).toEqual([{ a: '1' }]);
  });

  it('reads missing cells as empty and ignores extra ones', () => {
    expect(parseCsv('a,b,c\n1\n1,2,3,4')).toEqual([
      { a: '1', b: '', c: '' },
      { a: '1', b: '2', c: '3' },
    ]);
  });

  it('trims unquoted values and keeps quoted ones exactly', () => {
    expect(parseCsv('a,b\n  x  ," y "')).toEqual([{ a: 'x', b: ' y ' }]);
  });

  it('reads a quote in the middle of an unquoted value literally', () => {
    expect(parseCsv('a\nsay "hi"')).toEqual([{ a: 'say "hi"' }]);
  });

  it('runs an unclosed quote to the end of the text', () => {
    expect(parseCsv('a,b\n"open,1\n2')).toEqual([{ a: 'open,1\n2', b: '' }]);
  });

  it('returns no records for a header alone or for nothing', () => {
    expect(parseCsv('a,b')).toEqual([]);
    expect(parseCsv('')).toEqual([]);
  });

  it('reads back exactly what toCsv wrote', () => {
    const rows = [
      { v: 'a,b' },
      { v: 'say "hi"' },
      { v: 'line one\nline two' },
      { v: 'all, "three"\nat once' },
      { v: 'plain' },
    ];

    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/utils/csv.test.js`
Expected: FAIL. The module does not exist, so the suite errors on import (`Failed to resolve import "./csv.js"` or similar).

- [ ] **Step 3: Implement `src/utils/csv.js`**

```js
/**
 * Generic CSV, knowing nothing about Links. src/links/interchange.js builds
 * the Link format on top of it. downloadCsv is the only code here that
 * touches the DOM.
 */

const BOM = String.fromCharCode(0xfeff);
const NEEDS_QUOTES = /[",\n\r]/;

function encode(value) {
  const text = value == null ? '' : String(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows of objects as CSV text; the first row's keys are the header. */
export function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = rows.map(row => headers.map(header => encode(row[header])).join(','));
  return [headers.map(encode).join(','), ...lines].join('\n');
}

/**
 * Splits CSV text into records of fields. A quoted field may hold commas,
 * line breaks and doubled quotes; an unquoted field is trimmed, a quoted one
 * kept exactly. An unclosed quote runs to the end of the text, as
 * spreadsheets read it. Blank records are dropped.
 */
function recordsOf(text) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  let inQuotes = false;

  const endField = () => {
    record.push(quoted ? field : field.trim());
    field = '';
    quoted = false;
  };
  const endRecord = () => {
    endField();
    if (record.some(value => value !== '')) records.push(record);
    record = [];
  };

  for (let i = text.startsWith(BOM) ? 1 : 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = false;
    } else if (ch === '"' && !quoted && field.trim() === '') {
      field = '';
      quoted = true;
      inQuotes = true;
    } else if (ch === ',') endField();
    else if (ch === '\n') endRecord();
    else if (ch === '\r') { if (text[i + 1] !== '\n') endRecord(); }
    else field += ch;
  }
  if (field !== '' || quoted || record.length > 0) endRecord();

  return records;
}

/** CSV text as an array of objects keyed by the trimmed header. */
export function parseCsv(text) {
  const [header, ...data] = recordsOf(text);
  if (!header || data.length === 0) return [];
  const keys = header.map(name => name.trim());
  return data.map(fields => Object.fromEntries(keys.map((key, i) => [key, fields[i] ?? ''])));
}

/** Hands CSV text to the browser as a file download. */
export function downloadCsv(text, filename) {
  const blob = new Blob([text], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Downloads rows as a CSV file; does nothing when there are no rows. */
export function exportToCsv(data, filename) {
  if (!data.length) return;
  downloadCsv(toCsv(data), filename);
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/utils/csv.test.js`
Expected: PASS, 17 tests.

- [ ] **Step 5: Move `exportToCsv` callers to the new module**

In `src/utils/utm.js`, delete the whole `exportToCsv` function (keep `parseCsvText`, `copyToClipboard` and `formatDate`), and replace the two header comment lines:

```js
// URL composition moved to src/links/ (see CONTEXT.md and docs/adr/0001).
// What remains here is generic: CSV, clipboard and date formatting.
```

with:

```js
// URL composition lives in src/links/ (see CONTEXT.md and docs/adr/0001), and
// CSV in src/utils/csv.js. What remains here: clipboard and date formatting.
```

Change these import lines exactly:

| File | From | To |
| --- | --- | --- |
| `src/pages/AttributesPage.jsx` | `import { exportToCsv } from '../utils/utm';` | `import { exportToCsv } from '../utils/csv';` |
| `src/pages/LinkShortenersPage.jsx` | same | same |
| `src/pages/MembersPage.jsx` | same | same |
| `src/pages/ParametersPage.jsx` | same | same |
| `src/pages/TemplatesPage.jsx` | `import { exportToCsv, formatDate } from '../utils/utm';` | `import { formatDate } from '../utils/utm';` then, on the next line, `import { exportToCsv } from '../utils/csv';` |
| `src/pages/LinksPage.jsx` | `import { exportToCsv, copyToClipboard, formatDate } from '../utils/utm';` | `import { copyToClipboard, formatDate } from '../utils/utm';` then `import { exportToCsv } from '../utils/csv';` |
| `src/pages/QRCodesPage.jsx` | `import { formatDate, exportToCsv, copyToClipboard } from '../utils/utm';` | `import { formatDate, copyToClipboard } from '../utils/utm';` then `import { exportToCsv } from '../utils/csv';` |

- [ ] **Step 6: Verify nothing else moved**

Run: `grep -rn "exportToCsv" src/utils/utm.js; npm run test:unit && npm run build`
Expected: no grep output; `Tests 77 passed (77)` (60 existing + 17); build ends `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/utils/csv.js src/utils/csv.test.js src/utils/utm.js src/pages/AttributesPage.jsx src/pages/LinkShortenersPage.jsx src/pages/MembersPage.jsx src/pages/ParametersPage.jsx src/pages/TemplatesPage.jsx src/pages/LinksPage.jsx src/pages/QRCodesPage.jsx
git commit -m "feat: add a generic CSV module that can read its own output" -m "toCsv, parseCsv, downloadCsv and exportToCsv move to src/utils/csv.js. parseCsv follows the standard quoting rules, so a value holding a line break or a quote reads back as written; the browser download is the only DOM code." -m "Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 2: Link interchange module

**Files:**
- Create: `src/links/interchange.js`
- Create: `src/links/interchange.test.js`
- Modify: `src/links/index.js`
- Create: `docs/adr/0008-a-csv-round-trip-preserves-the-tagged-url.md`

**Interfaces:**
- Consumes: `toCsv`, `parseCsv` from `src/utils/csv.js` (Task 1); `composeLink` from `src/links/compose.js`.
- Produces: `linksToCsv(links: StoredLink[], taggedUrl: (link) => string): string` and `csvToDrafts(text: string, policy): { drafts: LinkDraft[], skipped: { row: number, reason: string }[] }`, exported from `src/links/index.js`. A StoredLink is a `db.links` row: `{ id, url, shortUrl, campaign, medium, source, term, content, notes, createdBy, createdAt, ... }`.

- [ ] **Step 1: Write the failing tests**

Create `src/links/interchange.test.js`:

```js
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/links/interchange.test.js`
Expected: FAIL. `linksToCsv` and `csvToDrafts` are not exported from `./index.js`, so every test fails with `... is not a function`.

- [ ] **Step 3: Implement `src/links/interchange.js`**

```js
import { toCsv, parseCsv } from '../utils/csv.js';
import { composeLink } from './compose.js';

const UTM_FIELDS = ['campaign', 'medium', 'source', 'term', 'content'];

const COLUMNS = [
  'created_by', 'created_at', 'short_url', 'full_url',
  ...UTM_FIELDS,
  'notes', 'url',
];

/**
 * Stored Links as the app's CSV format. `taggedUrl` derives each Link's Tagged
 * URL (ADR-0001), which is what a later import gives back (ADR-0008). The
 * header is written even for no Links, so an empty export is still a valid
 * file.
 */
export function linksToCsv(links, taggedUrl) {
  if (links.length === 0) return COLUMNS.join(',');

  return toCsv(links.map(link => {
    const values = {
      created_by: link.createdBy,
      created_at: link.createdAt,
      short_url: link.shortUrl,
      full_url: taggedUrl(link),
      campaign: link.campaign,
      medium: link.medium,
      source: link.source,
      term: link.term,
      content: link.content,
      notes: link.notes,
      url: link.url,
    };
    return Object.fromEntries(COLUMNS.map(column => [column, values[column] ?? '']));
  }));
}

function firstOf(record, ...columns) {
  for (const column of columns) {
    if (record[column]) return record[column];
  }
  return '';
}

/**
 * Reads CSV text as Link Drafts, composing each row under the Policy. A row's
 * own UTM columns win over any already on its URL (ADR-0002). Rows that cannot
 * become a Draft are reported by spreadsheet row number, the header being
 * row 1.
 */
export function csvToDrafts(text, policy) {
  const drafts = [];
  const skipped = [];

  parseCsv(text).forEach((raw, index) => {
    const row = index + 2;
    const record = Object.fromEntries(
      Object.entries(raw).map(([column, value]) => [column.toLowerCase(), value]),
    );

    const destination = firstOf(record, 'full_url', 'url');
    if (!destination) {
      skipped.push({ row, reason: 'No URL' });
      return;
    }

    const utm = {};
    for (const field of UTM_FIELDS) utm[field] = firstOf(record, `utm_${field}`, field);

    const result = composeLink(
      {
        destination,
        utm,
        customParameters: [],
        attributes: {},
        templateId: null,
        shortener: null,
        notes: record.notes || '',
        author: 'Import',
      },
      policy,
    );
    if (!result.ok) {
      skipped.push({ row, reason: result.violations[0].message });
      return;
    }

    drafts.push({ ...result.draft, shortUrl: record.short_url || '' });
  });

  return { drafts, skipped };
}
```

Add to `src/links/index.js`:

```js
export { linksToCsv, csvToDrafts } from './interchange.js';
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm run test:unit`
Expected: PASS — `Tests 88 passed (88)` (77 + 11).

- [ ] **Step 5: Write ADR-0008**

Create `docs/adr/0008-a-csv-round-trip-preserves-the-tagged-url.md`:

```markdown
# A CSV round-trip preserves the Tagged URL, not the whole Link

Exporting Links to CSV and importing the file gives back Links with the same Tagged URL, Short URL, UTM values and notes. It does not give back the whole Link: a Custom Parameter returns folded into the Destination rather than as a Custom Parameter, and Attributes are not exported at all.

The export writes a Tagged URL and the UTM values in separate columns, and import rebuilds each Link from those (ADR-0002). A Custom Parameter only survives inside the Tagged URL, so the imported Link carries it as part of its Destination. Composition adds UTM values after a Destination's existing query string, so a Link with Custom Parameters comes back with the same parameters and values in a different order: an equivalent URL, not byte-identical text. Links without Custom Parameters come back byte-identical.

## Consequences

Restoring the original order would mean changing where composition places UTM values for every Destination that already has a query string. Tagged URLs are derived on read (ADR-0001), so that would change the URLs of existing Links, some of them already published. The order difference is accepted instead. The round-trip test compares parameters, not text, for Links with Custom Parameters.

## Considered options

A lossless format, adding a Custom Parameters column and reading the Destination column ahead of the Tagged URL, would give back Custom Parameters as Custom Parameters. It was not chosen: it changes ADR-0002's column precedence and the documented import format. Exporting Attributes too would need mapping them back by name on import, including names that no longer exist.
```

- [ ] **Step 6: Commit**

```bash
git add src/links/interchange.js src/links/interchange.test.js src/links/index.js docs/adr/0008-a-csv-round-trip-preserves-the-tagged-url.md
git commit -m "feat: give the Link CSV format one module" -m "linksToCsv writes the Link columns; csvToDrafts reads them back, composing each row under the Policy and reporting skipped rows by spreadsheet row number. A round-trip gives back the same Tagged URL (ADR-0008)." -m "Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 3: Pages use the interchange module

**Files:**
- Modify: `tests/links.spec.js`
- Modify: `src/pages/LinksPage.jsx`
- Modify: `src/pages/QRCodesPage.jsx`
- Modify: `src/pages/ImportLinksModal.jsx`
- Modify: `src/utils/utm.js`

**Interfaces:**
- Consumes: `downloadCsv` from `src/utils/csv.js` (Task 1); `linksToCsv`, `csvToDrafts` from `src/links` (Task 2).

- [ ] **Step 1: Write the failing e2e spec**

Add inside `test.describe('Links Page', ...)` in `tests/links.spec.js`:

```js
  test('re-imports its own export with the note intact', async ({ page }) => {
    const note = 'first, "second"';
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://round-trip.test');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('rt-campaign');
    await page.locator(`${modal} input[placeholder*="Notes are saved"]`).fill(note);
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.getByRole('cell', { name: note, exact: true })).toHaveCount(1);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Export to CSV")').click(),
    ]);
    const file = await download.path();

    await page.locator('button:has-text("Import Links via CSV")').click();
    await page.locator(`${modal} input[type="file"]`).setInputFiles(file);
    await page.locator(`${modal} button:has-text("Continue")`).click();
    await expect(page.locator('text=Imported 1 links')).toBeVisible();

    await expect(page.getByRole('cell', { name: note, exact: true })).toHaveCount(2);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/links.spec.js -g "re-imports its own export"`
Expected: FAIL on the final `toHaveCount(2)`. It receives 1, because today's reader drops the quotes and the imported note reads `first, second`. If it fails anywhere earlier (e.g. no download event), stop and report NEEDS_CONTEXT with what you observed. Do not weaken the assertion.

- [ ] **Step 3: Links page and QR page export through the interchange module**

In `src/pages/LinksPage.jsx`:
- change `import { exportToCsv } from '../utils/csv';` to `import { downloadCsv } from '../utils/csv';`
- change `import { cloneLink, deleteLink, listLinks, attachQrCode } from '../links';` to `import { cloneLink, deleteLink, listLinks, attachQrCode, linksToCsv } from '../links';`
- replace `handleExport` with:

```js
  const handleExport = () => {
    downloadCsv(linksToCsv(filtered, taggedUrl), `utm-links-${Date.now()}.csv`);
    toast('Exported to CSV');
  };
```

In `src/pages/QRCodesPage.jsx`:
- change `import { exportToCsv } from '../utils/csv';` to `import { downloadCsv } from '../utils/csv';`
- add `linksToCsv` to the `from '../links'` import
- replace `handleExport` (in the `QRCodesPage` component) with:

```js
  const handleExport = () => {
    downloadCsv(linksToCsv(filtered, taggedUrl), `utm-qrcodes-${Date.now()}.csv`);
    toast('Exported');
  };
```

- [ ] **Step 4: Import modal reads through `csvToDrafts`**

In `src/pages/ImportLinksModal.jsx`:
- delete `import { parseCsvText } from '../utils/utm';`
- change `import { composeLink, saveLinks } from '../links';` to `import { csvToDrafts, saveLinks } from '../links';`
- add `import { downloadCsv } from '../utils/csv';`
- add, below the imports and above the component:

```js
const IMPORT_TEMPLATE =
  'full_url,short_url,utm_source,utm_campaign,utm_medium,utm_term,utm_content,notes\n' +
  'https://example.com,,google,summer-sale,cpc,brand,hero-banner,Example link';
```

- replace the whole `handleImport` with:

```js
  const handleImport = async () => {
    if (!file) { toast('Choose a CSV file first', 'error'); return; }
    const { drafts, skipped } = csvToDrafts(await file.text(), policy);
    if (drafts.length === 0) {
      toast(skipped.length === 0 ? 'No rows found in CSV' : 'No importable rows found', 'error');
      return;
    }

    await saveLinks(drafts);

    toast(
      skipped.length > 0
        ? `Imported ${drafts.length} links, skipped ${skipped.length}`
        : `Imported ${drafts.length} links`,
    );
    setFile(null);
    onClose();
  };
```

- replace the template button's whole inline `onClick` handler (the one that builds `tpl`, a Blob and a link) with `onClick={() => downloadCsv(IMPORT_TEMPLATE, 'utm-import-template.csv')}`. Leave its `className` and label unchanged.

In `src/utils/utm.js`, delete the whole `parseCsvText` function.

- [ ] **Step 5: Run the e2e spec to verify it passes**

Run: `npx playwright test tests/links.spec.js`
Expected: PASS, every spec in the file, including the new one.

- [ ] **Step 6: Verify**

Run: `grep -rn "parseCsvText\|exportToCsv" src/pages/LinksPage.jsx src/pages/QRCodesPage.jsx src/pages/ImportLinksModal.jsx src/utils/utm.js; npm run test:unit && npm run build`
Expected: no grep output; `Tests 88 passed (88)`; `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add tests/links.spec.js src/pages/LinksPage.jsx src/pages/QRCodesPage.jsx src/pages/ImportLinksModal.jsx src/utils/utm.js
git commit -m "feat: export and import Links through one CSV module" -m "The Links and QR pages export the same Link format through linksToCsv, and the import modal reads through csvToDrafts. The app now reads back its own export, including notes holding commas, quotes or line breaks, and the QR export keeps the Tagged URL." -m "Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 4: Verify and open the PR

- [ ] **Step 1: Full verification**

Run: `npm run test:unit && npm run build && npm test`
Expected: `Tests 88 passed (88)`; `✓ built`; e2e all passed, 0 failed. The suite is fully green on `main`, so any failure is a regression.

- [ ] **Step 2: Check the PR's state rules, then push and open the PR against `main`**

```bash
gh pr list --head feat/csv-interchange --state all
git push -u origin feat/csv-interchange
gh pr create --base main --title "One module for CSV interchange" --body-file <path-to-body>
```

The body must state: the two verified defects fixed, the module split, the round-trip guarantee with ADR-0008, the QR export change, and exact test results. End it with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
