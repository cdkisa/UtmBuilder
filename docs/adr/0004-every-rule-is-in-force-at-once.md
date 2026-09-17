# Every Rule is in force at once

Every Rule a workspace holds applies to every Link Intent, merged so the most restrictive setting wins: a field is required or blocked if any Rule says so, its maximum length is the smallest any Rule sets, and its prohibited values are the union of all of them. Nothing selects an active Rule.

The Rules page presents each Rule as a separately named, separately expandable grid, which reads like a set of presets waiting for a picker. There is no picker, no field marking one Rule active, and nothing associating a Rule with a Member or a Template. Merging them was the only reading that required no new schema and no new UI.

## Consequences

Adding a Rule can only tighten what is allowed, never loosen it, so a freshly created all-default Rule changes nothing. A workspace with no Rules composes exactly as it did before Rules were enforced, which is the state every workspace starts in. A field that one Rule marks required and another marks blocked is unsatisfiable; blocked wins, on the same most-restrictive reading.

## Considered options

Adding an `enabled` flag per Rule, or choosing one active Rule in the workspace settings, would match how the page looks today. Both need a schema field and a control that does not exist, and both allow a second Rule to silently loosen the first.
