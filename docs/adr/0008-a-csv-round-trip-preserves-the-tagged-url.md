# A CSV round-trip preserves the Tagged URL, not the whole Link

Exporting Links to CSV and importing the file gives back Links with the same Tagged URL, Short URL, UTM values and notes. It does not give back the whole Link: a Custom Parameter returns folded into the Destination rather than as a Custom Parameter, and Attributes are not exported at all.

The export writes a Tagged URL and the UTM values in separate columns, and import rebuilds each Link from those (ADR-0002). A Custom Parameter only survives inside the Tagged URL, so the imported Link carries it as part of its Destination. Composition adds UTM values after a Destination's existing query string, so a Link with Custom Parameters comes back with the same parameters and values in a different order: an equivalent URL, not byte-identical text. Links without Custom Parameters come back byte-identical, provided their Destination's query is in the form composition writes. Import re-serialises a query string, so values are equal once decoded, but their percent-encoding may differ.

## Consequences

Restoring the original order would mean changing where composition places UTM values for every Destination that already has a query string. Tagged URLs are derived on read (ADR-0001), so that would change the URLs of existing Links, some of them already published. The order difference is accepted instead. The round-trip test compares parameters, not text, for Links with Custom Parameters.

## Considered options

A lossless format, adding a Custom Parameters column and reading the Destination column ahead of the Tagged URL, would give back Custom Parameters as Custom Parameters. It was not chosen: it changes ADR-0002's column precedence and the documented import format. Exporting Attributes too would need mapping them back by name on import, including names that no longer exist.
