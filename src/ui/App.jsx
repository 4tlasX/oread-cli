import React, { useState, useCallback, useEffect } from 'react';
import { Box } from 'ink';
import ChatView from './ChatView.jsx';
import InputBox from './InputBox.jsx';
import CommandPicker from './CommandPicker.jsx';
import Pager from './Pager.jsx';
import { runChatTurn } from '../core/chatPipeline.js';
import { context } from '../core/engine.js';
import commandRegistry from '../commands/index.js';

function readStatusFromContext() {
  const settings = context.settingsManager?.getAll() || {};
  return {
    worldName: settings?.name || settings?.roleplay?.world?.name || 'oread',
    model: settings?.general?.selectedModel || process.env.OLLAMA_CHAT_MODEL || 'llama3.2',
    characterName: settings?.roleplay?._loadedCharacters?.[0]?.name || null,
  };
}

const COMMANDS = commandRegistry.getCommands();

// Parse input into picker mode and tokens
function parseInput(input) {
  if (!input.startsWith('/')) return { mode: 'none' };
  const hasTrailing = input.endsWith(' ');
  const words = input.trimEnd().split(/\s+/).filter(Boolean);
  const w0 = words[0] || ''; // command token  e.g. '/session'
  const w1 = words[1] || ''; // subcommand token e.g. 'delete'
  const w2 = words[2] || ''; // arg token

  if (words.length === 1 && !hasTrailing) return { mode: 'command', filter: w0 };
  if (words.length === 1 && hasTrailing)  return { mode: 'subcommand', cmd: w0, filter: '' };
  if (words.length === 2 && !hasTrailing) return { mode: 'subcommand', cmd: w0, filter: w1 };
  if (words.length === 2 && hasTrailing)  return { mode: 'arg', cmd: w0, sub: w1, filter: '' };
  if (words.length === 3 && !hasTrailing) return { mode: 'arg', cmd: w0, sub: w1, filter: w2 };
  return { mode: 'none' };
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [pagerContent, setPagerContent] = useState('');
  const [pagerPage,    setPagerPage]    = useState(0);
  const [status, setStatus] = useState(readStatusFromContext);
  const [sessionName, setSessionName] = useState('no session');

  // Picker
  const [pickerIndex, setPickerIndex] = useState(0);
  const [dynamicItems, setDynamicItems] = useState([]);

  const parsed = isStreaming ? { mode: 'none' } : parseInput(input);

  // Build the list shown in the picker
  const filteredCommands = (() => {
    if (parsed.mode === 'command') {
      return COMMANDS.filter(c => c.name.startsWith(parsed.filter.toLowerCase()));
    }
    if (parsed.mode === 'subcommand') {
      const cmd = COMMANDS.find(c => c.name === parsed.cmd);
      if (!cmd) return [];
      const f = parsed.filter.toLowerCase();
      const statics = (cmd.subcommands || [])
        .filter(s => !f || s.name.startsWith(f))
        .map(s => ({ ...s, itemType: 'subcommand' }));
      const dynamics = dynamicItems
        .filter(item => !f || item.name.startsWith(f) || item.description?.toLowerCase().includes(f))
        .map(item => ({ ...item, itemType: 'dynamic' }));
      return [...statics, ...dynamics];
    }
    if (parsed.mode === 'arg') {
      const f = parsed.filter.toLowerCase();
      return dynamicItems
        .filter(item => !f || item.name.startsWith(f) || item.description?.toLowerCase().includes(f))
        .map(item => ({ ...item, itemType: 'dynamic' }));
    }
    return [];
  })();

  const pickerOpen = parsed.mode !== 'none' && filteredCommands.length > 0;

  // Fetch dynamic args whenever picker mode/cmd/sub changes
  useEffect(() => {
    if (parsed.mode === 'subcommand' || parsed.mode === 'arg') {
      const cmd = COMMANDS.find(c => c.name === parsed.cmd);
      if (!cmd?.getDynamicArgs) { setDynamicItems([]); return; }
      const sub = parsed.mode === 'arg' ? (parsed.sub || '') : '';
      cmd.getDynamicArgs(context, sub).then(setDynamicItems).catch(() => setDynamicItems([]));
    } else {
      setDynamicItems([]);
    }
  }, [parsed.mode, parsed.cmd, parsed.sub]);

  // Reset picker index when list changes
  useEffect(() => {
    setPickerIndex(0);
  }, [input]);

  // On mount: load session name and run /status automatically
  useEffect(() => {
    context.sessionManager?.getCurrentSession().then(s => {
      setSessionName(s?.name || 'no session');
    });
    commandRegistry.execute('/status', context).then(({ output }) => {
      if (output) setMessages(prev => [...prev, { role: 'command', content: output }]);
    });
  }, []);

  const refreshStatus = useCallback(async () => {
    setStatus(readStatusFromContext());
    const session = await context.sessionManager?.getCurrentSession();
    setSessionName(session?.name || 'no session');
  }, []);

  const handleSubmit = useCallback(async (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInput('');

    if (trimmed.startsWith('/')) {
      const { output, action, content } = await commandRegistry.execute(trimmed, context);
      if (action === 'clear') { setMessages([]); }
      else if (action === 'pager' && content) { setPagerContent(content); setPagerPage(0); }
      else if (output) setMessages(prev => [...prev, { role: 'command', content: output }]);
      await refreshStatus();
      return;
    }

    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      let accumulated = '';
      for await (const chunk of runChatTurn({ userMessage: trimmed, context })) {
        accumulated += chunk;
        setStreamingContent(accumulated);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `[Error: ${err.message}]` }]);
    } finally {
      setStreamingContent('');
      setIsStreaming(false);
      await refreshStatus();
    }
  }, [refreshStatus]);

  // Handle picker item selection
  const handlePickerSelect = useCallback((item) => {
    if (parsed.mode === 'command') {
      const cmd = COMMANDS.find(c => c.name === item.name);
      if (cmd?.subcommands?.length > 0 || cmd?.getDynamicArgs) {
        setInput(item.name + ' ');
      } else {
        handleSubmit(item.name);
      }
    } else if (parsed.mode === 'subcommand') {
      if (item.itemType === 'subcommand') {
        setInput(parsed.cmd + ' ' + item.name + ' ');
      } else {
        handleSubmit(item.resolvedCommand ?? parsed.cmd + ' ' + item.name);
      }
    } else if (parsed.mode === 'arg') {
      handleSubmit(item.resolvedCommand ?? parsed.cmd + ' ' + parsed.sub + ' ' + item.name);
    }
  }, [parsed, handleSubmit]);

  const clampedIndex = Math.min(pickerIndex, Math.max(0, filteredCommands.length - 1));

  return (
    <Box flexDirection="column" width="100%">
      <ChatView
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
      />
      {pagerContent && (
        <Pager
          content={pagerContent}
          page={pagerPage}
          onNext={(total) => setPagerPage(p => p + 1 < total ? p + 1 : p)}
          onPrev={() => setPagerPage(p => Math.max(0, p - 1))}
          onClose={() => { setPagerContent(''); setPagerPage(0); }}
        />
      )}
      <InputBox
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isStreaming={isStreaming || !!pagerContent}
        pickerOpen={pickerOpen && !pagerContent}
        pickerIndex={clampedIndex}
        filteredCommands={filteredCommands}
        onPickerIndexChange={setPickerIndex}
        onPickerSelect={() => {
          const selected = filteredCommands[clampedIndex];
          if (selected) handlePickerSelect(selected);
        }}
        onPickerClose={() => setInput('')}
      />
      {pickerOpen && !pagerContent && (
        <CommandPicker commands={filteredCommands} selectedIndex={clampedIndex} />
      )}
    </Box>
  );
}
