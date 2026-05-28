import { ComposerPrimitive, useThread } from '@assistant-ui/react';

export function Composer() {
  const { isRunning } = useThread();

  return (
    <div className="border-t border-border p-4 shrink-0">
      <ComposerPrimitive.Root className="flex items-end gap-2 rounded-xl border border-border bg-surface-overlay px-3 py-2 focus-within:border-accent/50 transition-colors">
        <ComposerPrimitive.Input
          className="flex-1 bg-transparent text-sm text-gray-100 placeholder:text-muted resize-none outline-none max-h-40 min-h-[1.5rem] leading-relaxed"
          placeholder="Message the agent…"
          autoFocus
        />
        <div className="flex items-center gap-1.5 shrink-0">
          {isRunning && (
            <ComposerPrimitive.Cancel className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-surface transition-colors">
              Stop
            </ComposerPrimitive.Cancel>
          )}
          <ComposerPrimitive.Send className="rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 text-white text-sm font-medium transition-colors">
            Send
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
}
