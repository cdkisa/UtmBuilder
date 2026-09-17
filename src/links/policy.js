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
    .map(part => part.trim())
    .filter(Boolean);
}

/**
 * Folds every Rule into what is in force for each UTM field, most restrictive
 * winning (ADR-0004). The workspace's own settings are the floor each field
 * starts at,
 * so adding a Rule can only ever tighten what is allowed.
 */
function mergeRules(settings, rules) {
  const byField = {};
  for (const field of UTM_FIELDS) {
    byField[field] = {
      required: false,
      blocked: false,
      forceLowercase: Boolean(settings.forceLowercase),
      maxChars: null,
      prohibitedValues: new Set(),
    };
  }

  for (const rule of rules) {
    for (const field of UTM_FIELDS) {
      const config = rule?.config?.[field];
      if (!config) continue;

      const inForce = byField[field];
      if (config.forceLowercase) inForce.forceLowercase = true;
      if (config.required) inForce.required = true;
      if (config.blocked) inForce.blocked = true;

      const maxChars = maxCharsOf(config.maxChars);
      if (maxChars !== null) {
        inForce.maxChars =
          inForce.maxChars === null ? maxChars : Math.min(inForce.maxChars, maxChars);
      }

      for (const prohibited of listOf(config.prohibitedValues)) {
        inForce.prohibitedValues.add(prohibited.toLowerCase());
      }
    }
  }

  return byField;
}

/**
 * A Workspace Policy decides how UTM values are normalised and which Link
 * Intents are allowed. It carries the workspace's own settings together with
 * every Rule in force; see ADR-0004 for why all Rules apply at once, and
 * ADR-0005 for the Rule settings it deliberately does not enforce.
 */
export function createPolicy(settings = {}, rules = []) {
  const separator = SEPARATORS[settings.spaceChar] || '-';
  const rulesByField = mergeRules(settings, rules);

  // Normalising inserts the separator, so a workspace cannot prohibit the very
  // character it chose to stand in for spaces.
  const prohibitedChars = listOf(settings.prohibitedChars).filter(char => char !== separator);

  return {
    normalize(utm) {
      const normalised = {};
      for (const field of UTM_FIELDS) {
        const value = utm[field];
        if (value === undefined || value === null) continue;

        let result = String(value).replace(/\s+/g, separator);
        if (rulesByField[field].forceLowercase) result = result.toLowerCase();
        normalised[field] = result;
      }
      return normalised;
    },
    validate(intent = {}) {
      const utm = intent.utm || {};
      const violations = [];

      for (const field of UTM_FIELDS) {
        const inForce = rulesByField[field];
        const value = utm[field] == null ? '' : String(utm[field]);

        // A field both required and blocked is unsatisfiable; blocked wins, on
        // the same most-restrictive reading that merges the Rules (ADR-0004).
        if (inForce.blocked) {
          if (value) {
            violations.push({ field, message: `${LABELS[field]} may not be used.` });
          }
          continue;
        }

        if (inForce.required && !value) {
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

        if (inForce.maxChars !== null && value.length > inForce.maxChars) {
          violations.push({
            field,
            message: `${LABELS[field]} must be ${inForce.maxChars} characters or fewer.`,
          });
          continue;
        }

        if (inForce.prohibitedValues.has(value.toLowerCase())) {
          violations.push({ field, message: `${LABELS[field]} may not be "${value}".` });
        }
      }

      return violations;
    },
  };
}
