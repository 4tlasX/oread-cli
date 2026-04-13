import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { C } from './colors.js';

const MAX_VISIBLE = 5;

export default function SelectOverlay({ label, items, onSelect, onClose }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const total = items.length;
  const clamped = Math.min(selectedIndex, total - 1);

  const start = Math.max(0, Math.min(clamped - Math.floor(MAX_VISIBLE / 2), total - MAX_VISIBLE));
  const visible = items.slice(start, start + MAX_VISIBLE);
  const above = start;
  const below = Math.max(0, total - (start + MAX_VISIBLE));

  useInput((_, key) => {
    if (key.escape) {
      onClose();
    } else if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => Math.min(total - 1, i + 1));
    } else if (key.return) {
      const selected = items[clamped];
      if (selected) onSelect(selected.value);
    }
  });

  return (
    <Box flexDirection="column" paddingX={2}>
      {label && <Text color={C.dim}>{label}</Text>}
      {above > 0 && (
        <Text color={C.dim}>  ↑ {above} more</Text>
      )}
      {visible.map((item, i) => {
        const absIndex = start + i;
        const isSelected = absIndex === clamped;
        return (
          <Box key={item.value + absIndex} flexDirection="row" gap={1}>
            <Text color={C.teal}>{isSelected ? '❯' : ' '}</Text>
            <Text color={C.teal} bold={isSelected}>{item.label}</Text>
          </Box>
        );
      })}
      {below > 0 && (
        <Text color={C.dim}>  ↓ {below} more</Text>
      )}
    </Box>
  );
}
