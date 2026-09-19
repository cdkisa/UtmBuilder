# The Link store owns the Attribute cascade

Deleting an Attribute definition also deletes every value Links held for it, and `src/links/store.js` does both in one transaction through `deleteAttribute`. The Attributes page no longer touches either table.

The cascade already existed in two places: `deleteLink` cleared a Link's child rows, and the Attributes page re-implemented the same sweep from the other direction. Two copies of a cascade drift, and the page's copy was two separate statements, so a failure between them left `linkAttributes` rows pointing at an Attribute that no longer existed. Nothing in the app can name such a row: the Attributes page lists definitions, and a Link renders its values by looking each `attributeId` up.

Putting it in the Link store means that module now touches `attributes`, a table that is otherwise none of its business. That is the price of the cascade living once, and the Link store is the side that knows what a `linkId`/`attributeId` row is for.

## Consequences

Deleting an Attribute is destructive across saved Links and cannot be undone; the page's confirm prompt is the only thing standing in front of it. An Attribute that a hundred Links carry disappears from all of them at once, silently, because the Links themselves are untouched and nothing reports how many values went with it.

## Considered options

Leaving `db.attributes.delete` on the page and exposing only the child-row sweep keeps the Link store strictly on its three tables, but the delete stays two transactions and the page still has to sequence them correctly. A separate Attributes module owning `db.attributes` and calling into the Link store draws the boundary properly, at the cost of a second seam this change did not otherwise need; it remains the way out if Attributes grow behaviour of their own.
