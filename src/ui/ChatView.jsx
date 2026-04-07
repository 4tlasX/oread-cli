import React from 'react';
import { Box, Text, Static } from 'ink';
import Message from './Message.jsx';
import Banner from './Banner.jsx';
import { C } from './colors.js';

const BANNER_ITEM = { _banner: true };

export default function ChatView({ messages, streamingContent, isStreaming }) {

  // Banner is the permanent first Static item — it ejects once and stays at the top of the log
  const staticItems = [BANNER_ITEM, ...messages];

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Static items={staticItems}>
        {(item, i) => {
          if (item._banner) return <Banner key="banner" />;
          if (item.role === 'command') return (
            <Box key={i} paddingX={2} marginY={1}>
              <Text color={C.white} wrap="wrap">{item.content}</Text>
            </Box>
          );
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
