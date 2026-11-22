/**
 * The conversation's folder, as the engine names it (domain/conversation.cjs):
 * in Ledger's system config directory — `LEDGER_CONFIG_DIR`, else
 * `.config/ledger` in the home directory — by the session id's safe
 * characters alone, so a `cd` or a resume elsewhere finds it all the same.
 *
 * No `$` here: a hook's `$` is never followed across an import, so each
 * module reads the environment and the files itself.
 */

/** The file the engine marks a conversation that runs Ledger with. */
export const MARKER = 'workflow'

/** The file the engine keeps the conversation's position in. */
export const POSITION = 'position.json'

/**
 * The file the engine names the place the conversation left for the start
 * menu in: while it stands, the conversation is at no place, whatever the
 * position still holds for its tasks in flight.
 */
export const LEFT = 'left.json'

/** The engine, where a project installs it, from the project's root. */
export const ENGINE = '.claude/skills/ledger-engine/scripts/engine.cjs'

/** How long a hook waits on the engine. */
export const ENGINE_TIMEOUT_MS = 15_000

/**
 * The folder of the conversation `id`, from the process's
 * `LEDGER_CONFIG_DIR` and `HOME`; null where they name neither directory.
 */
export function folderOf(
  configDir: string | undefined,
  home: string | undefined,
  id: string,
): string | null {
  const config = configDir || (home ? `${home}/.config/ledger` : null)

  return config === null
    ? null
    : `${config}/conversations/${id.replace(/[^A-Za-z0-9_-]/g, '')}`
}
