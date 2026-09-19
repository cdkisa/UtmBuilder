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
 * become a Draft are reported by record number, the header being record 1,
 * with blank lines not counted.
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
