/**
 * The conversation's folder, as the engine names it (domain/conversation.cjs):
 * in the workflows' system config directory — `WORKFLOWS_CONFIG_DIR`, else
 * `.config/workflows` in the home directory — by the session id's safe
 * characters alone, so a `cd` or a resume elsewhere finds it all the same.
 *
 * No `$` here: a hook's `$` is never followed across an import, so each
 * module reads the environment and the files itself.
 */

/** The file the engine marks a conversation that runs the workflows with. */
export const MARKER = 'workflow'

/**
 * The folder of the conversation `id`, from the process's
 * `WORKFLOWS_CONFIG_DIR` and `HOME`; null where they name neither directory.
 */
export function folderOf(
  configDir: string | undefined,
  home: string | undefined,
  id: string,
): string | null {
  const config = configDir || (home ? `${home}/.config/workflows` : null)

  return config === null
    ? null
    : `${config}/conversations/${id.replace(/[^A-Za-z0-9_-]/g, '')}`
}
