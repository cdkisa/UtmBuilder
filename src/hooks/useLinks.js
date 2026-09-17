import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useWorkspace } from './useWorkspace';
import { taggedUrlOf, createPolicy } from '../links';
import db from '../db';

/** Who the app is acting as. Every Link Intent must name an author. */
export function useCurrentAuthor() {
  const members = useLiveQuery(() => db.members.toArray(), []) || [];
  return members.find(m => m.isAdmin)?.email || 'Admin';
}

/**
 * The Workspace Policy that composing a Link is subject to: the workspace's own
 * settings together with every Rule in force (ADR-0004).
 */
export function useLinkPolicy() {
  const { settings } = useWorkspace();
  const rules = useLiveQuery(() => db.rules.toArray(), []) || [];

  return useMemo(() => createPolicy(settings, rules), [settings, rules]);
}

/**
 * A Tagged URL is derived, never stored (ADR-0001). This loads what deriving
 * needs — the Policy and every Custom Parameter row — and returns a function
 * from a stored Link to its Tagged URL.
 */
export function useTaggedUrl() {
  const policy = useLinkPolicy();
  const customParamRows = useLiveQuery(() => db.linkCustomParams.toArray(), []) || [];

  const paramsByLink = useMemo(() => {
    const byLink = new Map();
    for (const row of customParamRows) {
      if (!byLink.has(row.linkId)) byLink.set(row.linkId, []);
      byLink.get(row.linkId).push(row);
    }
    return byLink;
  }, [customParamRows]);

  return useMemo(
    () => (link) => taggedUrlOf(link, policy, paramsByLink.get(link.id) || []),
    [policy, paramsByLink],
  );
}
