import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';

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

  // Swallow all input while streaming so keystrokes don't bleed to stdout
  useInput(() => {}, { isActive: isStreaming });

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

  const handleSubmit = useCallback((val) => {
    if (pickerOpen && filteredCommands.length > 0) return;
    onSubmit(val);
  }, [pickerOpen, filteredCommands.length, onSubmit]);

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
      borderColor={color}
    >
      <Box flexDirection="row" width={cols} height={1} paddingX={1} overflow="hidden">
        <Text color="gray" wrap="truncate">{'❯ '}</Text>
        <Box flexGrow={1} overflow="hidden">
          <TextInput value={value} onChange={onChange} onSubmit={handleSubmit} focus={!isStreaming} />
        </Box>
      </Box>
    </Box>
  );
}
