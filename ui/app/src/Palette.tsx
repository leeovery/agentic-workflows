// cmdk palette — navigation only (Phase 1: it does not act).
import { Command } from 'cmdk';

export function Palette({
  open,
  onClose,
  units,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  units: { name: string; type: string }[];
  onNavigate: (to: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center pt-32 z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Command
          className="w-[480px] rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl overflow-hidden font-sans"
          label="Navigate"
        >
          <Command.Input
            autoFocus
            placeholder="Go to…"
            className="w-full px-4 py-3 text-sm bg-transparent outline-none border-b border-stone-200 dark:border-stone-800"
          />
          <Command.List className="max-h-72 overflow-y-auto p-2 text-sm">
            <Command.Empty className="px-3 py-2 text-stone-400">Nothing matches.</Command.Empty>
            <Command.Item
              className="px-3 py-2 rounded cursor-pointer data-[selected=true]:bg-stone-100 dark:data-[selected=true]:bg-stone-800"
              onSelect={() => onNavigate('/lobby')}
            >
              Lobby
            </Command.Item>
            {units.map((u) => (
              <Command.Item
                key={u.name}
                className="px-3 py-2 rounded cursor-pointer data-[selected=true]:bg-stone-100 dark:data-[selected=true]:bg-stone-800"
                onSelect={() => onNavigate(`/c/${u.name}`)}
              >
                #{u.name} <span className="text-stone-400 ml-2">{u.type}</span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
