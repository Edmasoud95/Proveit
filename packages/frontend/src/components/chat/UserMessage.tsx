import { MessagePrimitive } from '@assistant-ui/react';

export function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end my-4">
      <div className="bg-surface-overlay border border-border/60 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm text-gray-100">
        <MessagePrimitive.Parts
          components={{
            Text: ({ text }) => <span className="whitespace-pre-wrap">{text}</span>,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}
