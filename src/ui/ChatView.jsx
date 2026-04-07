import React from 'react';
import { Box, Text } from 'ink';
import Message from './Message.jsx';
import { C } from './colors.js';

// Render messages inline (no <Static>) so Ink fully owns the live region.
// This makes resize handling clean: Ink redraws everything on every render,
// nothing leaks into scrollback, and log-update's line counting stays accurate.
export default function ChatView({ messages = [], streamingContent, isStreaming }) {
  return (
    <Box flexDirection="column">
      {messages.map((item, i) => {
        if (item.role === 'command') {
          return (
            <Box key={i} paddingX={2} marginY={1}>
              <Text color={C.white} wrap="wrap">{item.content}</Text>
            </Box>
          );
        }
        return <Message key={i} role={item.role} content={item.content} />;
      })}

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
