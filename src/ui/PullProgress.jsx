import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { C } from './colors.js';

const BAR_WIDTH = 24;

function progressBar(pct) {
  const filled = Math.round((pct / 100) * BAR_WIDTH);
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
}

export default function PullProgress({ modelName, progress, status, done, error, onCancel }) {
  const { stdout } = useStdout();
  const cols = stdout?.columns || 80;

  useInput((_, key) => {
    if (key.escape && !done) onCancel();
  });

  const barColor = error ? 'red' : done ? C.teal : C.teal;
  const statusText = error || status || '';

  return (
    <Box
      flexDirection="column"
      width={cols}
      height={3}
      flexShrink={0}
      overflow="hidden"
      borderStyle="single"
      borderTop
      borderBottom
      borderLeft={false}
      borderRight={false}
      borderColor={error ? 'red' : C.teal}
    >
      <Box flexDirection="row" paddingX={1} gap={2}>
        <Text color={C.dim} wrap="truncate">{modelName}</Text>
        {!done && !error && <Text color={C.dim} wrap="truncate">esc to cancel</Text>}
      </Box>
      <Box flexDirection="row" paddingX={1} gap={2}>
        <Text color={barColor}>{progressBar(progress)}</Text>
        <Text color={C.dim}>{error ? '' : `${progress}%`}</Text>
        <Text color={error ? 'red' : C.dim} wrap="truncate">{statusText}</Text>
      </Box>
    </Box>
  );
}
