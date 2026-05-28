import { ThreadPrimitive } from '@assistant-ui/react';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { Composer } from './Composer';

export function Thread() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ThreadPrimitive.Root className="flex flex-col h-full overflow-hidden">
        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-6 py-4">
          <ThreadPrimitive.Empty>
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <div className="text-3xl opacity-20">◆</div>
              <p className="text-muted text-sm">Send a message to start the conversation.</p>
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{ UserMessage, AssistantMessage }}
          />
        </ThreadPrimitive.Viewport>

        <Composer />
      </ThreadPrimitive.Root>
    </div>
  );
}
