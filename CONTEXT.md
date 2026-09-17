# UTM Builder

Composing and managing UTM-tagged campaign URLs. All data lives in the browser; there is no server.

## Language

### Links and URLs

**Link**:
A saved record pairing one Destination with the tagging choices applied to it, together with its Attributes, Custom Parameters and metadata. A Link is a record, never a URL string.
_Avoid_: url, campaign link

**Destination**:
The URL a Link sends people to, before any tagging is applied.
_Avoid_: base URL, target URL, original URL

**Tagged URL**:
A Destination with its UTM values and Custom Parameters applied. Derived from a Link, never typed by hand.
_Avoid_: full URL, generated URL, final URL

**Short URL**:
An optional shortened stand-in for a Link's Tagged URL.
_Avoid_: slug, short code

### Things attached to a Link

**Custom Parameter**:
A user-defined query parameter carried in the Tagged URL alongside the five UTM values.
_Avoid_: extra param, custom field

**Attribute**:
A user-defined field stored against a Link for filtering and organisation. An Attribute never appears in the Tagged URL.
_Avoid_: metadata, tag, custom field

### Composing a Link

**Link Intent**:
What a user is asking for: a Destination, UTM values, Custom Parameters, Attributes, a Template, a Shortener choice and notes. An Intent may be incomplete or invalid.
_Avoid_: form data, link request, payload

**Link Draft**:
A complete, valid Link that has not been saved yet, including its derived Tagged URL and any Short URL. Composing turns a Link Intent into either a Link Draft or a list of Violations.
_Avoid_: pending link, new link, candidate

**Violation**:
A reason a Link Intent cannot become a Link Draft, naming the field at fault. Composing produces either a Draft or Violations, never both.
_Avoid_: error, validation failure, issue

### Configured elsewhere, used when composing

**Parameter Preset**:
A saved suggested value for one of the five UTM fields, offered when composing a Link. Never write bare "Parameter": it is either a Parameter Preset or a Custom Parameter.
_Avoid_: parameter, preset value, suggestion

**Shortener**:
A configured domain that can issue Short URLs standing in for a Link's Tagged URL.
_Avoid_: link shortener service, redirector

**Rule**:
A named set of constraints on the five UTM fields, covering whether each is required or blocked, its maximum length and its prohibited values. A workspace may hold several, and all of them are in force together.
_Avoid_: validation rule, constraint, policy

**Workspace Policy**:
The whole of what a workspace permits when composing a Link: its space character and prohibited characters, together with every Rule in force. A Link Intent is composed subject to exactly one Policy.
_Avoid_: settings, config, workspace rules
