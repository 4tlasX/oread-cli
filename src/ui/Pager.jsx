import React, { useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { C } from './colors.js';

export default function Pager({ content, page, onNext, onPrev, onClose }) {
  const { stdout } = useStdout();
  const termHeight = stdout?.rows || 24;
  const termWidth  = stdout?.columns || 80;

  // Reserve rows for the nav bar + a little breathing room
  const pageHeight = termHeight - 4;

  const pages = useMemo(() => {
    const lines = content.split('\n');
    const chunks = [];
    for (let i = 0; i < lines.length; i += pageHeight) {
      chunks.push(lines.slice(i, i + pageHeight).join('\n'));
    }
    return chunks.length ? chunks : [''];
  }, [content, pageHeight]);

  const total = pages.length;
  const currentPage = Math.min(page, total - 1);

  useInput((input, key) => {
    if (key.return || input === ' ' || key.downArrow || key.pageDown) {
      if (currentPage >= total - 1) onClose();
      else onNext(total);
    } else if (input === 'b' || key.upArrow || key.pageUp) onPrev();
    else if (input === 'q' || key.escape) onClose();
  });

  const navLeft  = `  page ${currentPage + 1} of ${total}`;
  const navRight = `[space] next  [b] back  [q] close  `;
  const divLen   = Math.max(0, termWidth - navLeft.length - navRight.length);

  return (
    <Box flexDirection="column">
      <Text color={C.white}>{pages[currentPage]}</Text>
      <Box flexDirection="row">
        <Text color={C.teal}>{navLeft}</Text>
        <Text color={C.dim}>{'  ' + '─'.repeat(divLen)}</Text>
        <Text color={C.dim}>{navRight}</Text>
      </Box>
    </Box>
  );
}
