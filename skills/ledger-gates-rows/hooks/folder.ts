/**
 * The conversation's folder, as the engine names it (domain/conversation.cjs):
 * in Ledger's system config directory — `LEDGER_CONFIG_DIR`, else
 * `.config/ledger` in the home directory — by the session id's safe
 * characters alone, so a `cd` or a resume elsewhere finds it all the same.
 *
 * No `$` here: a hook's `$` is never followed across an import, so each
 * module reads the environment and the files itself.
 */

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
