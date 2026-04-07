import React from 'react';
import { Box, Text } from 'ink';
import { C } from './colors.js';

const MAX_VISIBLE = 10;

export default function CommandPicker({ commands, selectedIndex }) {
  const clampedIndex = Math.min(selectedIndex, commands.length - 1);
  const start = Math.max(0, Math.min(clampedIndex - Math.floor(MAX_VISIBLE / 2), commands.length - MAX_VISIBLE));
  const visible = commands.slice(start, start + MAX_VISIBLE);

  return (
    <Box flexDirection="column" paddingX={2}>
      {visible.map((cmd, i) => {
        const absIndex = start + i;
        const isSelected = absIndex === clampedIndex;
        return (
          <Box key={cmd.name + i} flexDirection="row" gap={1}>
            <Text color={C.teal}>{isSelected ? '❯' : ' '}</Text>
            <Text color={C.teal} bold={isSelected}>{cmd.name.padEnd(18)}</Text>
            <Text color={C.dim}>{cmd.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
