import React from 'react';
import { Box, Text } from 'ink';

/**
 * Strip ANSI escape sequences and control characters from a display string.
 * World names, model names, and session names come from user-controlled JSON
 * and database values — they must not be passed raw to the terminal.
 */
function safe(str, fallback) {
  if (!str) return fallback;
  return str
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')  // CSI sequences
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '')  // OSC sequences
    .replace(/[\x00-\x1F\x7F]/g, '')  // control chars (keep printable only)
    || fallback;
}

export default function StatusBar({ worldName, model, sessionName }) {
  return (
    <Box paddingX={1} justifyContent="flex-start">
      <Text color="white" dimColor>{safe(sessionName, 'no session')}</Text>
      <Text color="gray">  •  </Text>
      <Text color="yellow">{safe(model, 'no model')}</Text>
      <Text color="gray">  •  </Text>
      <Text color="green">{safe(worldName, 'no world')}</Text>
      <Text color="gray">  </Text>
      <Text color="cyan" bold>[oread]</Text>
    </Box>
  );
}
