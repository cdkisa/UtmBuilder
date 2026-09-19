# A Template is applied when composing, and snapshotted

Composing a Link resolves its Template: each UTM field the Link Intent leaves blank takes the Template's value, and a typed value always wins. The saved Link stores the resolved values, so it holds the Template's values as they were when the Link was composed. `templateId` stays on the row only as a record of where the values came from.

Both composing pages used to copy a Template's values into their form fields, with identical code, and never looked at the Template again. Clearing a Template reset only its id, so its values stayed behind and were saved onto the next Link. Resolving the Template during composition, rather than copying it into the form, puts the precedence rule in one place with one set of tests, and leaves nothing behind to clear.

Snapshotting departs from ADR-0001, which derives a Link's Tagged URL on every read so that a change to the workspace settings applies to existing Links. A Template is different: a Link made from it may already be printed on a QR code or sent in an email, and editing the Template must not change a URL that is already published.

## Consequences

A blank field means "use the Template", so a field cannot be deliberately left empty while a Template that sets it is chosen; clearing the Template is the only way to drop its values. A Template chosen and then deleted before saving is reported as a Violation, not dropped silently. Editing or deleting a Template changes no existing Link.

## Considered options

Keeping a live reference, storing only what was typed and filling in the Template's values whenever the Tagged URL is derived, would follow ADR-0001 more closely. It was rejected because editing a Template would silently rewrite every URL made from it, and deleting one would strip values from Links already in use.
