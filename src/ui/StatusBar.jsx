import React from 'react';
import { Box, Text } from 'ink';

export default function StatusBar({ worldName, model, sessionName }) {
  return (
    <Box paddingX={1} justifyContent="flex-end">
      <Text color="white" dimColor>{sessionName || 'no session'}</Text>
      <Text color="gray">  •  </Text>
      <Text color="yellow">{model || 'no model'}</Text>
      <Text color="gray">  •  </Text>
      <Text color="green">{worldName || 'no world'}</Text>
      <Text color="gray">  </Text>
      <Text color="cyan" bold>[oread]</Text>
    </Box>
  );
}
