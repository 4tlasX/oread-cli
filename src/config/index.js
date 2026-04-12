import path from 'path';

const PROJECT_ROOT = process.env.OREAD_ROOT || path.resolve('.');

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3002', 10),
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
  OLLAMA_CHAT_MODEL: process.env.OLLAMA_CHAT_MODEL || 'llama3.2',
  OLLAMA_EXTRACTION_MODEL: process.env.OLLAMA_EXTRACTION_MODEL || 'phi4-mini',
  NOMI_MODEL: process.env.NOMI_MODEL ? `nomi-${process.env.NOMI_MODEL}` : null,
  KINDROID_MODEL: process.env.KINDROID_MODEL ? `kindroid-${process.env.KINDROID_MODEL}` : null,
  DATA_DIR: path.join(PROJECT_ROOT, 'data'),
};
