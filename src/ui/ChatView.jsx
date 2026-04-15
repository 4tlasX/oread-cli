import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import Message from './Message.jsx';
import Banner from './Banner.jsx';
import { C } from './colors.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const THINKING_WORDS = [
  'thinking', 'processing', 'pondering', 'reflecting', 'reasoning',
  'considering', 'contemplating', 'calculating', 'computing', 'analyzing',
  'synthesizing', 'deliberating', 'ruminating', 'cogitating', 'musing',
  'mulling', 'weighing', 'deciphering', 'formulating', 'assembling',
  'connecting the dots', 'crunching', 'inferring', 'deducing', 'extrapolating',
  'interpolating', 'hypothesizing', 'theorizing', 'speculating', 'evaluating',
  'assessing', 'examining', 'investigating', 'exploring', 'navigating',
  'untangling', 'unpacking', 'parsing', 'decoding', 'translating',
  'distilling', 'refining', 'calibrating', 'cross-referencing', 'correlating',
  'pattern matching', 'searching', 'sifting', 'filtering', 'sorting',
  'organizing', 'structuring', 'mapping', 'tracing', 'tracking',
  'following the thread', 'reading between the lines', 'zooming out', 'zooming in',
  'consulting the void', 'asking the universe', 'channeling wisdom',
  'divining', 'intuiting', 'sensing', 'feeling it out', 'vibing',
  'cooking', 'brewing', 'simmering', 'marinating', 'percolating',
  'hatching a plan', 'spinning up', 'warming up', 'loading', 'initializing',
  'bootstrapping', 'compiling thoughts', 'defragging', 'indexing',
  'wiring neurons', 'firing synapses', 'consulting the oracle',
  'reading the runes', 'checking the stars', 'gazing into the crystal ball',
  'shuffling thoughts', 'connecting synapses', 'chasing rabbits',
  'going deep', 'descending', 'spelunking', 'digging', 'excavating',
  'unearthing', 'surfacing', 'crystallizing', 'manifesting', 'conjuring',
  'summoning', 'invoking', 'materializing', 'dreaming up', 'imagining',
  'envisioning', 'picturing', 'modeling', 'simulating', 'projecting',
  'forecasting', 'anticipating', 'preparing', 'orchestrating', 'composing',
];

function useSpinner(active) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(id);
  }, [active]);
  return SPINNER_FRAMES[frame];
}


// Messages live in Ink's live render region (not Static) so the layout
// reflows correctly when the terminal is resized.
export default function ChatView({ messages = [], streamingContent, isStreaming }) {
  const spinner = useSpinner(isStreaming);
  const wordIndexRef = useRef(-1);
  const [thinkingWord, setThinkingWord] = useState(THINKING_WORDS[0]);

  useEffect(() => {
    if (isStreaming) {
      wordIndexRef.current = (wordIndexRef.current + 1) % THINKING_WORDS.length;
      setThinkingWord(THINKING_WORDS[wordIndexRef.current]);
    }
  }, [isStreaming]);

  return (
    <Box flexDirection="column" paddingBottom={2}>
      {messages.map((item, i) => {
        if (item.role === 'welcome') {
          return <Banner key={i} />;
        }
        if (item.role === 'command') {
          return (
            <Box key={i} paddingX={2} marginY={1}>
              <Text color={C.white} wrap="wrap">{item.content}</Text>
            </Box>
          );
        }
        return <Message key={i} role={item.role} content={item.content} />;
      })}

      {isStreaming && (
        <Box marginY={1}>
          <Text wrap="wrap">
            <Text color={C.teal}>{spinner} </Text>
            {streamingContent || <Text dimColor>{thinkingWord}...</Text>}
          </Text>
        </Box>
      )}
    </Box>
  );
}
