import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import { C } from './colors.js';

function useTerminalWidth() {
  const { stdout } = useStdout();
  const [cols, setCols] = useState(stdout?.columns || 80);
  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setCols(stdout.columns || 80);
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);
  return cols;
}

export default function Message({ role, content }) {
  const cols = useTerminalWidth();
  const bubbleWidth = Math.floor(cols * 0.75);

  const isUser = role === 'user';
  const borderColor = isUser ? C.dim : C.teal;

  return (
    <Box marginY={1} justifyContent={isUser ? 'flex-end' : 'flex-start'}>
      <Box borderStyle="round" borderColor={borderColor} paddingX={2} paddingY={1} width={bubbleWidth}>
        <Text wrap="wrap" color={C.white}>
          {content}
        </Text>
      </Box>
    </Box>
  );
}
