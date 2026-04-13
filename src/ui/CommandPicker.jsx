import React from 'react';
import { Box, Text } from 'ink';
import { C } from './colors.js';

const MAX_VISIBLE = 5;
const NAME_COL = 18;

export default function CommandPicker({ commands, selectedIndex }) {
  const total = commands.length;
  const clampedIndex = Math.min(selectedIndex, total - 1);

  // Keep the window centered on the selected item
  const start = Math.max(0, Math.min(clampedIndex - Math.floor(MAX_VISIBLE / 2), total - MAX_VISIBLE));
  const visible = commands.slice(start, start + MAX_VISIBLE);

  const above = start;
  const below = Math.max(0, total - (start + MAX_VISIBLE));

  return (
    <Box flexDirection="column" paddingX={2}>
      {above > 0 && (
        <Text color={C.dim}>  ↑ {above} more</Text>
      )}
      {visible.map((cmd, i) => {
        const absIndex = start + i;
        const isSelected = absIndex === clampedIndex;
        return (
          <Box key={cmd.name + absIndex} flexDirection="row">
            <Text color={C.teal} bold={isSelected}>{(isSelected ? '> ' : '  ') + cmd.name.padEnd(NAME_COL)}</Text>
            <Text color={C.dim} wrap="truncate">  {(cmd.description || '').split('\n')[0]}</Text>
          </Box>
        );
      })}
      {below > 0 && (
        <Text color={C.dim}>  ↓ {below} more</Text>
      )}
    </Box>
  );
}
