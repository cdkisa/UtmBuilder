import db from '../db.js';

const LINK_TABLES = () => [db.links, db.linkAttributes, db.linkCustomParams];

/**
 * Maps a Link Draft onto the stored row shape.
 *
 * The column is still called `url` for historical reasons; the interface calls
 * it the Destination and this is the only place the two names meet. The Tagged
 * URL is deliberately absent: it is derived on read (ADR-0001).
 */
function rowFor(draft) {
  return {
    url: draft.destination,
    shortUrl: draft.shortUrl || '',
    campaign: draft.utm.campaign || '',
    medium: draft.utm.medium || '',
    source: draft.utm.source || '',
    term: draft.utm.term || '',
    content: draft.utm.content || '',
    templateId: draft.templateId ?? null,
    notes: draft.notes || '',
    createdBy: draft.author,
    createdAt: new Date().toISOString(),
  };
}

function attributeRowsFor(linkId, attributes) {
  const rows = [];
  for (const [attributeId, raw] of Object.entries(attributes || {})) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value == null || String(value).trim() === '') continue;
      rows.push({ linkId, attributeId: Number(attributeId), value: String(value).trim() });
    }
  }
  return rows;
}

async function insert(draft) {
  const linkId = await db.links.add(rowFor(draft));

  const customParams = draft.customParameters.map(p => ({
    linkId,
    paramName: p.name,
    paramValue: p.value,
  }));
  if (customParams.length > 0) await db.linkCustomParams.bulkAdd(customParams);

  const attrs = attributeRowsFor(linkId, draft.attributes);
  if (attrs.length > 0) await db.linkAttributes.bulkAdd(attrs);

  return linkId;
}

/** Saves one Link Draft and its children in a single transaction. */
export function saveLink(draft) {
  return db.transaction('rw', LINK_TABLES(), () => insert(draft));
}

/**
 * Saves several Link Drafts in one transaction. A failure anywhere leaves
 * nothing behind, so a failed bulk create is safe to retry.
 */
export function saveLinks(drafts) {
  return db.transaction('rw', LINK_TABLES(), async () => {
    const ids = [];
    for (const draft of drafts) ids.push(await insert(draft));
    return ids;
  });
}

/** Deletes a Link together with its Custom Parameter and Attribute rows. */
export function deleteLink(linkId) {
  return db.transaction('rw', LINK_TABLES(), async () => {
    await db.linkCustomParams.where('linkId').equals(linkId).delete();
    await db.linkAttributes.where('linkId').equals(linkId).delete();
    await db.links.delete(linkId);
  });
}

/** Copies an existing Link and its children, crediting the given author. */
export function cloneLink(linkId, author) {
  return db.transaction('rw', LINK_TABLES(), async () => {
    const original = await db.links.get(linkId);
    if (!original) throw new Error(`No Link with id ${linkId}`);

    // `fullUrl` is dropped as well as the QR fields: older rows still carry a
    // stale one, and a new row must never be born with that cache (ADR-0001).
    const { id: _discarded, fullUrl, qrCode, qrDataUrl, qrDesignId, ...rest } = original;
    const copyId = await db.links.add({
      ...rest,
      // A Short URL identifies one Link, so a copy starts without one.
      shortUrl: '',
      createdBy: author,
      createdAt: new Date().toISOString(),
    });

    const params = await db.linkCustomParams.where('linkId').equals(linkId).toArray();
    if (params.length > 0) {
      await db.linkCustomParams.bulkAdd(
        params.map(p => ({ linkId: copyId, paramName: p.paramName, paramValue: p.paramValue })),
      );
    }

    const attrs = await db.linkAttributes.where('linkId').equals(linkId).toArray();
    if (attrs.length > 0) {
      await db.linkAttributes.bulkAdd(
        attrs.map(a => ({ linkId: copyId, attributeId: a.attributeId, value: a.value })),
      );
    }

    return copyId;
  });
}
