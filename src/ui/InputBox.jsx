import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

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

export default function InputBox({
  value,
  onChange,
  onSubmit,
  isStreaming,
  pickerOpen,
  pickerIndex,
  filteredCommands,
  onPickerIndexChange,
  onPickerSelect,
  onPickerClose,
}) {
  const color = isStreaming ? 'gray' : 'white';
  const cols = useTerminalWidth();
  const [cursor, setCursor] = useState(value.length);
  const internalChange = useRef(false);

  // Sync cursor to end on external value changes (submit clears, picker sets value)
  useEffect(() => {
    if (!internalChange.current) {
      setCursor(value.length);
    }
    internalChange.current = false;
  }, [value]);

  // Swallow all input while streaming
  useInput(() => {}, { isActive: isStreaming });

  // Picker navigation
  useInput((input, key) => {
    if (key.upArrow) {
      onPickerIndexChange(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      onPickerIndexChange(i => Math.min(filteredCommands.length - 1, i + 1));
    } else if (key.escape) {
      onPickerClose();
    } else if (key.return) {
      const selected = filteredCommands[Math.min(pickerIndex, filteredCommands.length - 1)];
      if (selected) onPickerSelect(selected.name);
    }
  }, { isActive: pickerOpen && filteredCommands.length > 0 && !isStreaming });

  // Text editing
  useInput((input, key) => {
    // Let picker handle navigation keys when open
    const pickerActive = pickerOpen && filteredCommands.length > 0;
    if (pickerActive && (key.upArrow || key.downArrow || key.escape)) return;

    if (key.return) {
      if (pickerActive) return;
      onSubmit(value);
      return;
    }
    if (key.backspace) {
      if (cursor > 0) {
        internalChange.current = true;
        onChange(value.slice(0, cursor - 1) + value.slice(cursor));
        setCursor(c => c - 1);
      }
      return;
    }
    if (key.delete) {
      if (cursor < value.length) {
        internalChange.current = true;
        onChange(value.slice(0, cursor) + value.slice(cursor + 1));
      }
      return;
    }
    if (key.leftArrow) {
      setCursor(c => Math.max(0, c - 1));
      return;
    }
    if (key.rightArrow) {
      setCursor(c => Math.min(value.length, c + 1));
      return;
    }
    if (key.ctrl) {
      if (input === 'a') { setCursor(0); return; }
      if (input === 'e') { setCursor(value.length); return; }
      if (input === 'u') {
        internalChange.current = true;
        onChange('');
        setCursor(0);
        return;
      }
      if (input === 'k') {
        internalChange.current = true;
        onChange(value.slice(0, cursor));
        return;
      }
      return;
    }
    if (key.meta) return;
    if (input) {
      internalChange.current = true;
      onChange(value.slice(0, cursor) + input + value.slice(cursor));
      setCursor(c => c + input.length);
    }
  }, { isActive: !isStreaming });

  // Layout: prompt '❯ ' is 2 chars, paddingX={1} adds 1 on each side
  const textWidth = Math.max(1, cols - 2 - 2);

  // Wrap value into display lines
  const displayLines = [];
  if (value.length === 0) {
    displayLines.push('');
  } else {
    for (let i = 0; i < value.length; i += textWidth) {
      displayLines.push(value.slice(i, i + textWidth));
    }
  }

  const cursorLine = Math.floor(cursor / textWidth);
  const cursorCol = cursor % textWidth;

  return (
    <Box
      flexDirection="column"
      width={cols}
      flexShrink={0}
      borderStyle="single"
      borderTop
      borderBottom
      borderLeft={false}
      borderRight={false}
      borderColor={color}
    >
      <Box flexDirection="row" paddingX={1}>
        <Text color="gray">{'❯ '}</Text>
        <Box flexDirection="column" flexGrow={1}>
          {displayLines.map((line, lineIdx) => {
            if (lineIdx === cursorLine && !isStreaming) {
              const before = line.slice(0, cursorCol);
              const atChar = line[cursorCol];
              const after = line.slice(cursorCol + 1);
              return (
                <Text key={lineIdx} color={color}>
                  {before}
                  <Text inverse>{atChar !== undefined ? atChar : ' '}</Text>
                  {after}
                </Text>
              );
            }
            return <Text key={lineIdx} color={color}>{line}</Text>;
          })}
        </Box>
      </Box>
    </Box>
  );
}
