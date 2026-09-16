# Short URLs are issued but never resolve

A Link's Short URL is composed from the selected Shortener's domain and a generated code. Nothing resolves it. This app runs entirely in the browser with no server, so there is no redirect service behind any Shortener.

We kept the Shortener picker rather than removing it, and made composition honour the chosen domain instead of hardcoding one, so a recorded Short URL at least reflects what the user picked.

## Consequences

A Short URL is a record of intent, not a working address. Anyone reading the code and assuming shortening works end to end is wrong. Making it work needs a redirect service that does not exist yet, and that is separate work, not a bug in composition.
