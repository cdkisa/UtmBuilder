# Rules govern composing, not the form

A Rule's `required`, `blocked`, `forceLowercase`, `maxChars` and `prohibitedValues` settings are enforced by the Workspace Policy when a Link is composed. Its `canType`, `hidden` and `customInstructions` settings shape the builder form rather than the Tagged URL, and `unique` would have to read every saved Link, so none of those four is enforced.

Keeping enforcement to the first five puts the whole of it behind the Policy a Link Intent is already composed against. Each of the remaining four needs something the Policy does not have: a way to reach the form, or a way to query saved Links. Folding either in would widen the Policy for no gain in what it can decide.

## Consequences

Those four columns are editable on the Rules page and affect nothing. That is deliberate, not an oversight, and it is the reason a Rule cannot currently hide a field or enforce uniqueness.
