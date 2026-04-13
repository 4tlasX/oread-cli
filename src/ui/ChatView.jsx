import React from 'react';
import { Box, Text, Static } from 'ink';
import Message from './Message.jsx';
import { C } from './colors.js';

const VERSION = '0.1.0';

// Completed messages use <Static> so they're permanently committed to stdout
// and live in the terminal's scrollback buffer. Only the streaming preview
// stays in Ink's live region.
export default function ChatView({ messages = [], streamingContent, isStreaming }) {
  return (
    <Box flexDirection="column">
      <Static items={messages}>
        {(item, i) => {
          if (item.role === 'welcome') {
            return (
              <Box key={i} flexDirection="column" paddingX={2} marginY={1}>
                <Text bold color={C.teal}>oread <Text color={C.dim}>v{VERSION}</Text></Text>
                <Text color={C.white}>Local-first LLM terminal  ·  Ollama · Anthropic · OpenAI · Gemini</Text>
                <Text color={C.dim}>/help for commands</Text>
              </Box>
            );
          }
          if (item.role === 'command') {
            return (
              <Box key={i} paddingX={2} marginY={1}>
                <Text color={C.white} wrap="wrap">{item.content}</Text>
              </Box>
            );
          }
          return <Message key={i} role={item.role} content={item.content} />;
        }}
      </Static>

      {isStreaming && streamingContent && (
        <Box marginY={1}>
          <Text wrap="wrap">
            <Text color={C.teal}>{'● '}</Text>
            {streamingContent}
          </Text>
        </Box>
      )}
    </Box>
  );
}
