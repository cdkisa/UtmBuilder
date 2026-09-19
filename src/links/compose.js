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

/** Assembles a Tagged URL. Every value reaching here is already normalised. */
function taggedUrlFor(destination, utm, customParameters) {
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
 * Derives the Tagged URL of a stored Link. Any `fullUrl` left on older rows is
 * ignored rather than trusted (ADR-0001). The Policy normalises here too, so a
 * Link stored before a setting or Rule changed reflects the change on read.
 * Pass the Link's Custom Parameter rows to have them included.
 */
export function taggedUrlOf(link, policy, customParameterRows = []) {
  const utm = policy.normalize({
    campaign: link.campaign,
    medium: link.medium,
    source: link.source,
    term: link.term,
    content: link.content,
  });
  const customParameters = customParameterRows.map(row => ({
    name: row.paramName,
    value: row.paramValue,
  }));

  return taggedUrlFor(withScheme(link.url), utm, customParameters);
}

/**
 * Tags a single Destination using a Link Intent's values, without producing a
 * Link. The HTML email path uses this to rewrite every href in a document.
 */
export function composeTaggedUrl(destination, intent, policy, deps = {}) {
  const cleaned = stripExistingUtm(withScheme(destination));
  // An unknown Template has nowhere to be reported here; composeLink reports
  // it when the Link is saved, so the preview uses the typed values alone.
  const utm = policy.normalize(resolveUtm(intent, deps).utm);
  const customParameters = (intent.customParameters || []).filter(p => p.name && p.value);

  return taggedUrlFor(cleaned, utm, customParameters);
}

/**
 * A Short URL records which Shortener the user picked. Nothing resolves it:
 * there is no redirect service behind any Shortener. See ADR-0003.
 */
function shortUrlFor(shortener, generateCode) {
  if (!shortener || !shortener.domain) return '';
  return `https://${shortener.domain}/${generateCode()}`;
}

const isTyped = value => value != null && String(value).trim() !== '';

/**
 * Layers a chosen Template's UTM values under the Intent's own (ADR-0007). A
 * field the user left blank takes the Template's value; a typed one always
 * wins. An unknown Template is reported, never silently dropped, but the
 * Intent's own values still come back so a preview can be drawn from them.
 */
function resolveUtm(intent, deps) {
  const typed = intent.utm || {};
  if (intent.templateId == null) return { utm: typed };

  const template = deps.templates ? deps.templates(intent.templateId) : undefined;
  if (!template) {
    return {
      utm: typed,
      violation: { field: 'template', message: 'The chosen Template no longer exists.' },
    };
  }

  const utm = {};
  for (const [field] of UTM_FIELDS) {
    if (isTyped(typed[field])) utm[field] = typed[field];
    else if (isTyped(template[field])) utm[field] = template[field];
  }
  return { utm };
}

export function composeLink(intent, policy, deps = {}) {
  const generateCode = deps.generateCode || defaultGenerateCode;
  const destination = stripExistingUtm(withScheme(intent.destination));
  const resolved = resolveUtm(intent, deps);
  const utm = policy.normalize(resolved.utm);
  const customParameters = (intent.customParameters || []).filter(p => p.name && p.value);

  const violations = [];
  if (!destination) {
    violations.push({ field: 'destination', message: 'URL is required' });
  }
  if (!intent.author) {
    violations.push({ field: 'author', message: 'An author is required.' });
  }
  if (resolved.violation) violations.push(resolved.violation);
  violations.push(...policy.validate({ ...intent, destination, utm }));

  if (violations.length > 0) return { ok: false, violations };

  return {
    ok: true,
    draft: {
      // What the user typed, with any Template's values beneath it, and not
      // what was normalised: normalising is a Policy decision that must stay
      // re-derivable (ADR-0001). The Template's values are snapshotted here so
      // editing the Template later changes no Link (ADR-0007).
      utm: resolved.utm,
      destination,
      customParameters,
      attributes: intent.attributes || {},
      templateId: intent.templateId ?? null,
      notes: intent.notes || '',
      author: intent.author,
      taggedUrl: taggedUrlFor(destination, utm, customParameters),
      shortUrl: shortUrlFor(intent.shortener, generateCode),
    },
  };
}
