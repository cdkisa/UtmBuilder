# Tagged URL is derived, not stored

A Link's Tagged URL is computed from its Destination and tagging choices whenever it is needed, rather than persisted in the `fullUrl` column.

Storing it made that column a cache that could disagree with the Link it came from, most obviously when the workspace space-character setting changed after the fact. It also let the CSV importer's double-tagged string persist as the record's truth, which is how a parameter-doubling bug survived unnoticed.

## Consequences

Existing rows keep whatever `fullUrl` value they were written with. It is ignored rather than migrated, so no schema change is needed. Read sites that previously used the column, including search, export and QR generation, now compute the Tagged URL per Link.
