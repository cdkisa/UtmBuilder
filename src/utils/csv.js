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
