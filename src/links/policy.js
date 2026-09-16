/**
 * A Policy decides how UTM values are normalised and which Link Intents are
 * allowed. Today it only carries the workspace space character; the Workspace
 * Policy work fills in the rest without changing this interface.
 */
export function createPolicy(settings = {}) {
  const spaceChar = settings.spaceChar || 'hyphen';

  return {
    separator: spaceChar === 'underscore' ? '_' : spaceChar === 'plus' ? '+' : '-',
    normalize(utm) {
      return utm;
    },
    validate() {
      return [];
    },
  };
}
