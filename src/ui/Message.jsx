import React from 'react';
import { Box, Text } from 'ink';
import { C } from './colors.js';

export default function Message({ role, content }) {
  const dotColor = role === 'user' ? C.white : C.teal;

  return (
    <Box marginY={1}>
      <Text wrap="wrap">
        <Text color={dotColor}>{'● '}</Text>
        {content}
      </Text>
    </Box>
  );
}
