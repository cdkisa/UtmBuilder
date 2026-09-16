# On import, UTM columns beat an already-tagged URL

CSV import strips any UTM values already present on an incoming URL and re-applies them from that row's own UTM columns. The stripped URL becomes the Link's Destination.

The export format writes both a Tagged URL and separate UTM columns. Feeding the former back in and then tagging it from the latter appended every parameter a second time, so the app could not round-trip its own export.

## Considered options

Trusting the URL and ignoring the columns would also stop the doubling, but it silently discards any edit made to the columns in a spreadsheet, which is the main reason people export and re-import. Rejecting ambiguous rows was the third option and fails a file the app itself produced.
