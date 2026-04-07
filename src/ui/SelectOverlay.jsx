import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { C } from './colors.js';

function Chevron({ isSelected }) {
  return (
    <Box marginRight={1}>
      <Text color={C.teal}>{isSelected ? '❯' : ' '}</Text>
    </Box>
  );
}

export default function SelectOverlay({ label, items, onSelect, onClose }) {
  useInput((_, key) => {
    if (key.escape) onClose();
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={C.dim}>{label}</Text>
      <SelectInput items={items} onSelect={({ value }) => onSelect(value)} indicatorComponent={Chevron} />
    </Box>
  );
}
