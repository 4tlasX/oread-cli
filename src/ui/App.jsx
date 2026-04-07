import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box } from 'ink';
import ChatView from './ChatView.jsx';
import InputBox from './InputBox.jsx';
import StatusBar from './StatusBar.jsx';
import CommandPicker from './CommandPicker.jsx';
import SelectOverlay from './SelectOverlay.jsx';
import PullProgress from './PullProgress.jsx';
import Pager from './Pager.jsx';
// Note: stdout.js helpers are intentionally NOT used post-mount.
// Direct process.stdout.write after Ink mounts corrupts Ink's log-update line tracking,
// causing duplicated InputBox/StatusBar. All post-mount messages flow through <Static> in ChatView.
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

function parseInput(input) {
  if (!input.startsWith('/')) return { mode: 'none' };
  const hasTrailing = input.endsWith(' ');
  const words = input.trimEnd().split(/\s+/).filter(Boolean);
  const w0 = words[0] || '';
  const w1 = words[1] || '';
  const w2 = words[2] || '';

  if (words.length === 1 && !hasTrailing) return { mode: 'command', filter: w0 };
  if (words.length === 1 && hasTrailing)  return { mode: 'subcommand', cmd: w0, filter: '' };
  if (words.length === 2 && !hasTrailing) return { mode: 'subcommand', cmd: w0, filter: w1 };
  if (words.length === 2 && hasTrailing)  return { mode: 'arg', cmd: w0, sub: w1, filter: '' };
  if (words.length === 3 && !hasTrailing) return { mode: 'arg', cmd: w0, sub: w1, filter: w2 };
  return { mode: 'none' };
}

export default function App() {
  // messages kept in state for pager only — display goes direct to stdout
  const [messages, setMessages] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [pagerContent, setPagerContent] = useState('');
  const [pagerPage, setPagerPage] = useState(0);
  const [status, setStatus] = useState(readStatusFromContext);
  const [sessionName, setSessionName] = useState('no session');

  const [pickerIndex, setPickerIndex] = useState(0);
  const [dynamicItems, setDynamicItems] = useState([]);
  const [selectOverlay, setSelectOverlay] = useState(null);
  const [pullState, setPullState] = useState(null);
  const pullCancelledRef = useRef(false);

  const parsed = isStreaming ? { mode: 'none' } : parseInput(input);

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

  useEffect(() => {
    setPickerIndex(0);
  }, [input]);

  // On mount: load session + print initial status
  useEffect(() => {
    context.sessionManager?.getCurrentSession().then(s => {
      setSessionName(s?.name || 'no session');
    });
    commandRegistry.execute('/status', context).then(({ output }) => {
      if (output) {
        setMessages(prev => [...prev, { role: 'command', content: output }]);
      }
    });
  }, []);

  const refreshStatus = useCallback(async () => {
    setStatus(readStatusFromContext());
    const session = await context.sessionManager?.getCurrentSession();
    setSessionName(session?.name || 'no session');
  }, []);

  const startPull = useCallback(async (modelName) => {
    pullCancelledRef.current = false;
    setPullState({ modelName, progress: 0, status: 'Starting...', done: false, error: null });
    try {
      const stream = await context.ollamaService.pullModel(modelName);
      for await (const chunk of stream) {
        if (pullCancelledRef.current) break;
        const progress = chunk.total ? Math.round((chunk.completed / chunk.total) * 100) : 0;
        setPullState(prev => ({ ...prev, progress, status: chunk.status || '' }));
      }
      if (!pullCancelledRef.current) {
        setPullState(prev => ({ ...prev, progress: 100, status: 'Complete!', done: true }));
        context.settingsManager.set('general.selectedModel', modelName);
        await refreshStatus();
        setTimeout(() => {
          setPullState(null);
          setMessages(prev => [...prev, { role: 'command', content: `Pulled and set model: ${modelName}` }]);
        }, 1500);
      } else {
        setPullState(null);
      }
    } catch (err) {
      setPullState(prev => ({ ...prev, status: err.message, error: err.message, done: true }));
      setTimeout(() => setPullState(null), 3000);
    }
  }, [refreshStatus]);

  // Defensive: also re-read session name whenever the message log changes,
  // in case a command updated the session without going through refreshStatus.
  useEffect(() => {
    let cancelled = false;
    context.sessionManager?.getCurrentSession().then(s => {
      if (!cancelled) setSessionName(s?.name || 'no session');
    });
    return () => { cancelled = true; };
  }, [messages.length]);

  const handleSubmit = useCallback(async (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInput('');

    if (trimmed.startsWith('/')) {
      const { output, action, content } = await commandRegistry.execute(trimmed, context);
      if (action === 'clear') {
        setMessages([]);
      } else if (action === 'pager' && content) {
        setPagerContent(content);
        setPagerPage(0);
      } else if (action === 'select' && content) {
        setSelectOverlay(content);
        return;
      } else if (action === 'pull' && content) {
        startPull(content.modelName);
        return;
      } else if (output) {
        setMessages(prev => [...prev, { role: 'command', content: output }]);
      }
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
      const errMsg = `[Error: ${err.message}]`;
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
    } finally {
      setStreamingContent('');
      setIsStreaming(false);
      await refreshStatus();
    }
  }, [refreshStatus]);

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
      <ChatView messages={messages} streamingContent={streamingContent} isStreaming={isStreaming} />
      {pagerContent && (
        <Pager
          content={pagerContent}
          page={pagerPage}
          onNext={(total) => setPagerPage(p => p + 1 < total ? p + 1 : p)}
          onPrev={() => setPagerPage(p => Math.max(0, p - 1))}
          onClose={() => { setPagerContent(''); setPagerPage(0); }}
        />
      )}
      {pullState ? (
        <PullProgress
          modelName={pullState.modelName}
          progress={pullState.progress}
          status={pullState.status}
          done={pullState.done}
          error={pullState.error}
          onCancel={() => { pullCancelledRef.current = true; setPullState(null); }}
        />
      ) : selectOverlay ? (
        <SelectOverlay
          label={selectOverlay.label}
          items={selectOverlay.items}
          onSelect={(value) => {
            setSelectOverlay(null);
            handleSubmit(selectOverlay.resolveCommand(value));
          }}
          onClose={() => setSelectOverlay(null)}
        />
      ) : (
        <>
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
        </>
      )}
      <StatusBar worldName={status.worldName} model={status.model} sessionName={sessionName} />
    </Box>
  );
}
