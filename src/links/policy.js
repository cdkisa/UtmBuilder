const UTM_FIELDS = ['campaign', 'medium', 'source', 'term', 'content'];

const SEPARATORS = { underscore: '_', plus: '+' };

const LABELS = {
  campaign: 'Campaign',
  medium: 'Medium',
  source: 'Source',
  term: 'Term',
  content: 'Content',
};

/**
 * The Rules page stores a maximum length as free text, so anything that is not
 * a positive whole number means "no maximum" rather than zero.
 */
function maxCharsOf(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** The Rules page stores lists as free text separated by commas. */
function listOf(raw) {
  if (raw === undefined || raw === null) return [];
  return String(raw)
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

/**
 * Folds every Rule into one constraint per UTM field, most restrictive winning
 * (ADR-0004). The workspace's own settings are the floor each field starts at,
 * so adding a Rule can only ever tighten what is allowed.
 */
function mergeConstraints(settings, rules) {
  const merged = {};
  for (const field of UTM_FIELDS) {
    merged[field] = {
      required: false,
      blocked: false,
      forceLowercase: Boolean(settings.forceLowercase),
      maxChars: null,
      prohibitedValues: new Set(),
    };
  }

  for (const entry of rules) {
    for (const field of UTM_FIELDS) {
      const config = entry?.config?.[field];
      if (!config) continue;

      const constraint = merged[field];
      if (config.forceLowercase) constraint.forceLowercase = true;
      if (config.required) constraint.required = true;
      if (config.blocked) constraint.blocked = true;

      const maxChars = maxCharsOf(config.maxChars);
      if (maxChars !== null) {
        constraint.maxChars =
          constraint.maxChars === null ? maxChars : Math.min(constraint.maxChars, maxChars);
      }

      for (const prohibited of listOf(config.prohibitedValues)) {
        constraint.prohibitedValues.add(prohibited.toLowerCase());
      }
    }
  }

  return merged;
}

/**
 * A Workspace Policy decides how UTM values are normalised and which Link
 * Intents are allowed. It carries the workspace's own settings together with
 * every Rule in force; see ADR-0004 for why all Rules apply at once, and
 * ADR-0005 for the Rule settings it deliberately does not enforce.
 */
export function createPolicy(settings = {}, rules = []) {
  const separator = SEPARATORS[settings.spaceChar] || '-';
  const prohibitedChars = listOf(settings.prohibitedChars);
  const constraints = mergeConstraints(settings, rules);

  return {
    normalize(utm) {
      const normalised = {};
      for (const field of UTM_FIELDS) {
        const value = utm[field];
        if (value === undefined || value === null) continue;

        let result = String(value).replace(/\s+/g, separator);
        if (constraints[field].forceLowercase) result = result.toLowerCase();
        normalised[field] = result;
      }
      return normalised;
    },
    validate(intent = {}) {
      const utm = intent.utm || {};
      const violations = [];

      for (const field of UTM_FIELDS) {
        const constraint = constraints[field];
        const value = utm[field] == null ? '' : String(utm[field]);

        // A field both required and blocked is unsatisfiable; blocked wins, on
        // the same most-restrictive reading that merges the Rules (ADR-0004).
        if (constraint.blocked) {
          if (value) {
            violations.push({ field, message: `${LABELS[field]} may not be used.` });
          }
          continue;
        }

        if (constraint.required && !value) {
          violations.push({ field, message: `${LABELS[field]} is required.` });
          continue;
        }

        if (!value) continue;

        const offending = prohibitedChars.find(char => value.includes(char));
        if (offending) {
          violations.push({
            field,
            message: `${LABELS[field]} may not contain "${offending}".`,
          });
          continue;
        }

        if (constraint.maxChars !== null && value.length > constraint.maxChars) {
          violations.push({
            field,
            message: `${LABELS[field]} must be ${constraint.maxChars} characters or fewer.`,
          });
          continue;
        }

        if (constraint.prohibitedValues.has(value.toLowerCase())) {
          violations.push({ field, message: `${LABELS[field]} may not be "${value}".` });
        }
      }

      return violations;
    },
  };
}
