import { nanoid } from 'nanoid';

const defaultGenerateCode = () => nanoid(7);

const UTM_FIELDS = [
  ['campaign', 'utm_campaign'],
  ['medium', 'utm_medium'],
  ['source', 'utm_source'],
  ['term', 'utm_term'],
  ['content', 'utm_content'],
];

function withScheme(destination) {
  const trimmed = (destination || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const UTM_KEYS = UTM_FIELDS.map(([, key]) => key);

/**
 * Removes any UTM values already present on a URL, so the Intent's own values
 * are the only ones that end up on the Tagged URL. See ADR-0002.
 */
function stripExistingUtm(url) {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return url;

  const base = url.slice(0, queryStart);
  const [query, ...hashParts] = url.slice(queryStart + 1).split('#');
  const hash = hashParts.length ? `#${hashParts.join('#')}` : '';

  const params = new URLSearchParams(query);
  for (const key of UTM_KEYS) params.delete(key);

  const remaining = params.toString();
  return remaining ? `${base}?${remaining}${hash}` : `${base}${hash}`;
}

function taggedUrlFor(destination, utm, customParameters, policy) {
  if (!destination) return '';

  const parts = [];
  for (const [field, key] of UTM_FIELDS) {
    const value = utm[field];
    if (!value) continue;
    parts.push(`${key}=${encodeURIComponent(String(value).replace(/\s+/g, policy.separator))}`);
  }

  for (const param of customParameters) {
    if (!param.name || !param.value) continue;
    parts.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(param.value)}`);
  }

  if (parts.length === 0) return destination;
  return destination + (destination.includes('?') ? '&' : '?') + parts.join('&');
}

/**
 * Derives the Tagged URL of a stored Link. Any `fullUrl` left on older rows is
 * ignored rather than trusted (ADR-0001). Pass the Link's Custom Parameter rows
 * to have them included.
 */
export function taggedUrlOf(link, policy, customParameterRows = []) {
  const utm = {
    campaign: link.campaign,
    medium: link.medium,
    source: link.source,
    term: link.term,
    content: link.content,
  };
  const customParameters = customParameterRows.map(row => ({
    name: row.paramName,
    value: row.paramValue,
  }));

  return taggedUrlFor(withScheme(link.url), utm, customParameters, policy);
}

/**
 * Tags a single Destination using a Link Intent's values, without producing a
 * Link. The HTML email path uses this to rewrite every href in a document.
 */
export function composeTaggedUrl(destination, intent, policy) {
  const cleaned = stripExistingUtm(withScheme(destination));
  const utm = policy.normalize(intent.utm || {});
  const customParameters = (intent.customParameters || []).filter(p => p.name && p.value);

  return taggedUrlFor(cleaned, utm, customParameters, policy);
}

/**
 * A Short URL records which Shortener the user picked. Nothing resolves it:
 * there is no redirect service behind any Shortener. See ADR-0003.
 */
function shortUrlFor(shortener, generateCode) {
  if (!shortener || !shortener.domain) return '';
  return `https://${shortener.domain}/${generateCode()}`;
}

export function composeLink(intent, policy, deps = {}) {
  const generateCode = deps.generateCode || defaultGenerateCode;
  const destination = stripExistingUtm(withScheme(intent.destination));
  const utm = policy.normalize(intent.utm || {});
  const customParameters = (intent.customParameters || []).filter(p => p.name && p.value);

  const violations = [];
  if (!destination) {
    violations.push({ field: 'destination', message: 'URL is required' });
  }
  if (!intent.author) {
    violations.push({ field: 'author', message: 'An author is required.' });
  }
  violations.push(...policy.validate({ ...intent, destination, utm }));

  if (violations.length > 0) return { ok: false, violations };

  return {
    ok: true,
    draft: {
      destination,
      utm,
      customParameters,
      attributes: intent.attributes || {},
      templateId: intent.templateId ?? null,
      notes: intent.notes || '',
      author: intent.author,
      taggedUrl: taggedUrlFor(destination, utm, customParameters, policy),
      shortUrl: shortUrlFor(intent.shortener, generateCode),
    },
  };
}
