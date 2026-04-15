import React from 'react';
import { Box, Text, Static } from 'ink';
import Message from './Message.jsx';
import Banner from './Banner.jsx';
import { C } from './colors.js';

// Completed messages use <Static> so they're permanently committed to stdout
// and live in the terminal's scrollback buffer. Only the streaming preview
// stays in Ink's live region.
export default function ChatView({ messages = [], streamingContent, isStreaming }) {
  return (
    <Box flexDirection="column">
      <Static items={messages}>
        {(item, i) => {
          if (item.role === 'welcome') {
            return <Banner key={i} />;
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

      {isStreaming && (
        <Box marginY={1}>
          <Text wrap="wrap">
            <Text color={C.teal}>{'● '}</Text>
            {streamingContent || <Text dimColor>...</Text>}
          </Text>
        </Box>
      )}
    </Box>
  );
}
