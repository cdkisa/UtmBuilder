# One module for CSV interchange

Candidate 2 of the 16 September 2026 architecture review.

## Problem

Knowledge of the Link CSV format is spread across four files, and none of it has a unit test:

- `src/utils/utm.js` holds `exportToCsv`, which serialises and triggers the browser download in one function, and `parseCsvText`, the reader.
- `LinksPage.jsx` and `QRCodesPage.jsx` each build their own column set; the QR page's leaves out the Tagged URL, Short URL, term, content and notes.
- `ImportLinksModal.jsx` owns the import column precedence (ADR-0002) inline, plus its own copy of the download code for the template file.

The writer and reader disagree, so the app cannot read back its own export. Verified with the current code:

- A note containing a line break is written quoted, but the reader splits on every line break. `"line one\nline two"` becomes a row whose note is `line one` plus a bogus row whose URL is `line two`, which imports as a junk Link.
- A `"` inside a value is dropped: `say "hi"` reads back as `say hi`.

## Decisions

1. **What round-trips is the Tagged URL.** Exporting Links and importing the file yields Links with the same Tagged URL, Short URL, UTM values and notes.
   - Byte-identical for Links without Custom Parameters.
   - For Links with Custom Parameters, the same parameters and values, possibly reordered: a Custom Parameter comes back folded into the Destination, and composition places UTM values after a Destination's existing query. Forcing the old order would change where composition puts UTM values for every Destination with a query string, and since Tagged URLs are derived on read (ADR-0001), that would rewrite existing, possibly published URLs.
   - Attributes are not exported, as today.
2. **Two layers.** A generic, DOM-free CSV module, and a Link interchange module built on it. The browser download is the only DOM code.
3. **The QR page exports the same Link format as the Links page.** Its list is a filtered set of Links, and its export becomes importable.
4. **Import headers match case-insensitively.** Column precedence is unchanged from ADR-0002.
5. **A row with no Destination is reported as skipped,** not silently dropped.
6. **Exporting an empty list writes a header-only file** rather than silently downloading nothing.

## Design

### `src/utils/csv.js` — generic CSV

All CSV code leaves `src/utils/utm.js`, which keeps only the clipboard and date helpers.

- `toCsv(rows)`: an array of objects in, CSV text out. Headers are the first row's keys; lines are joined with `\n`. A value containing `,`, `"`, `\n` or `\r` is wrapped in `"`, with each `"` doubled. A value with leading or trailing whitespace is quoted too, since unquoted values are trimmed on read. `null` and `undefined` write as empty. An empty array returns `''`.
- `parseCsv(text)`: CSV text in, an array of objects keyed by header (each header trimmed) out.
  - A leading byte-order mark (U+FEFF) is removed.
  - Fields may be quoted; inside quotes, `""` is a literal `"`, and commas and line breaks are literal.
  - Records end at `\n` or `\r\n` outside quotes.
  - A record whose fields are all empty (a blank line) is ignored.
  - Missing trailing cells read as `''`; extra cells are ignored.
  - Unquoted field values are trimmed; quoted ones are kept exactly.
  - An unclosed quote runs to the end of the text.
  - Fewer than two records (no header, or header only) returns `[]`.
- `downloadCsv(text, filename)`: the only DOM code. It creates a `text/csv` Blob and clicks a temporary link.
- `exportToCsv(data, filename)`: kept for the five non-Link pages (Attributes, Shorteners, Members, Parameters, Templates) as `if (!data.length) return; downloadCsv(toCsv(data), filename)`. Its behaviour is unchanged; only their import path changes.

### `src/links/interchange.js` — the Link CSV shape

- `linksToCsv(links, taggedUrl)`: `taggedUrl` is a function from a stored Link to its Tagged URL (what `useTaggedUrl()` returns).
  - Columns, in order: `created_by, created_at, short_url, full_url, campaign, medium, source, term, content, notes, url`, from `createdBy, createdAt, shortUrl, taggedUrl(link), campaign, medium, source, term, content, notes, url`. Missing values write as empty.
  - It always writes the header row, so an empty list yields a header-only file.
- `csvToDrafts(text, policy)` returns `{ drafts, skipped }`, where `skipped` is `[{ row, reason }]`.
  - Records come from `parseCsv`; header names are lowercased before matching.
  - The Destination is `full_url`, falling back to `url`. Each UTM value is `utm_<field>`, falling back to `<field>`, for campaign, medium, source, term and content. This is ADR-0002, unchanged.
  - Each record is composed with `composeLink` under the given Policy: no Custom Parameters, no Attributes, no Template, no Shortener, notes from `notes`, author `'Import'`.
  - A composed Draft's `shortUrl` is replaced by the record's `short_url` (or `''`).
  - A record with no Destination is skipped with reason `'No URL'`. A record that fails composition is skipped with its first Violation's message.
  - `row` is the record number: header = 1, first data record = 2. A multi-line quoted value counts as one record, and blank lines are not counted.
- Both are exported from `src/links/index.js`.

### Pages

- **`LinksPage.jsx`:** `handleExport` becomes `downloadCsv(linksToCsv(filtered, taggedUrl), \`utm-links-${Date.now()}.csv\`)`, then the existing toast.
- **`QRCodesPage.jsx`:** `handleExport` becomes the same call, with filename `utm-qrcodes-${Date.now()}.csv`, then the existing toast. It already has `taggedUrl`.
- **`ImportLinksModal.jsx`:** read the file and call `csvToDrafts(text, policy)`, then:
  - no drafts and no skipped → toast `No rows found in CSV` (error);
  - no drafts but some skipped → toast `No importable rows found` (error);
  - otherwise `saveLinks(drafts)`, then toast `Imported N links` or `Imported N links, skipped M`.

  The template download uses `downloadCsv` with the existing template text. The documented header line is unchanged.
- **Other five pages:** import `exportToCsv` from `../utils/csv`.

## Out of scope

- Exporting or importing Attributes or Custom Parameters as their own columns.
- Any change to composition or to how Tagged URLs order their parameters.
- The non-Link pages' own export columns.

## Testing

Unit tests are written first.

`src/utils/csv.test.js`:
- quoting on write;
- each parse rule above;
- `parseCsv(toCsv(rows))` returning the rows for values holding commas, quotes, line breaks and all three together.

`src/links/interchange.test.js`:
- column set and order;
- the header-only empty export;
- ADR-0002: a Tagged `full_url` plus UTM columns yields no duplicated parameter, and the columns win;
- `utm_*` and bare aliases;
- case-insensitive headers;
- a no-Destination skip and a Violation skip, each with the right row number, including after a multi-line record;
- `short_url` carried over;
- author `'Import'`;
- **the round-trip guarantee:**
  - Links whose notes contain line breaks, quotes and commas come back with byte-identical Tagged URL, Short URL, UTM values and notes;
  - a Link with a Custom Parameter comes back with the same Tagged URL parameters (compared as parsed `URLSearchParams`, order-insensitive) and the same origin and path.

End-to-end: one spec creates a Link whose note holds a comma and quotes (`first, "second"`; the notes field is a single-line input, so line breaks are covered by the unit tests), exports it from the Links page, imports the downloaded file, and expects two Links carrying that exact note.

## Docs

- ADR-0008, "A CSV round-trip preserves the Tagged URL, not the whole Link": decision 1 and the lossless alternative that was rejected.
