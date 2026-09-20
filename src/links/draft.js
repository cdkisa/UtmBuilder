import { nanoid } from 'nanoid';

const defaultGenerateCode = () => nanoid(7);

export const UTM_FIELDS = [
  ['campaign', 'utm_campaign'],
  ['medium', 'utm_medium'],
  ['source', 'utm_source'],
  ['term', 'utm_term'],
  ['content', 'utm_content'],
];

/** Assembles a Tagged URL. Every value reaching here is already normalised. */
export function taggedUrlFor(destination, utm, customParameters) {
  if (!destination) return '';

  const parts = [];
  for (const [field, key] of UTM_FIELDS) {
    const value = utm[field];
    if (!value) continue;
    parts.push(`${key}=${encodeURIComponent(String(value))}`);
  }

  for (const param of customParameters) {
    if (!param.name || !param.value) continue;
    parts.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(param.value)}`);
  }

  if (parts.length === 0) return destination;
  return destination + (destination.includes('?') ? '&' : '?') + parts.join('&');
}

/**
 * A Short URL records which Shortener the user picked. Nothing resolves it:
 * there is no redirect service behind any Shortener. See ADR-0003.
 */
export function shortUrlFor(shortener, generateCode = defaultGenerateCode) {
  if (!shortener || !shortener.domain) return '';
  return `https://${shortener.domain}/${generateCode()}`;
}

/**
 * Creates a LinkDraft from the resolved components of a Link Intent.
 * This encapsulates the construction logic for a Link Draft.
 */
export function createLinkDraft({
  utm,
  taggedUtm,
  destination,
  customParameters,
  attributes = {},
  templateId = null,
  notes = '',
  author,
  shortener,
  generateCode,
}) {
  return {
    utm,
    destination,
    customParameters,
    attributes,
    templateId,
    notes,
    author,
    taggedUrl: taggedUrlFor(destination, taggedUtm ?? utm, customParameters),
    shortUrl: shortUrlFor(shortener, generateCode),
  };
}
