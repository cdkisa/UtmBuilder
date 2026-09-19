import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useWorkspace } from './useWorkspace';
import { taggedUrlOf, createPolicy, listCustomParams } from '../links';
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
  const customParamRows = useLiveQuery(listCustomParams, []) || [];

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

/**
 * Looks a Template up by id, for composition to resolve (ADR-0007). A page
 * uses this same lookup to show the chosen Template's values, so what the form
 * shows and what gets composed cannot disagree.
 */
export function useTemplateLookup() {
  const templates = useLiveQuery(() => db.templates.toArray(), []) || [];

  return useMemo(() => {
    const byId = new Map(templates.map(t => [t.id, t]));
    return id => byId.get(Number(id));
  }, [templates]);
}
