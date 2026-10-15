import { config } from '../config.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[config.logger.level] ?? LEVELS.info;

const emit = (level, message, context = {}) => {
  if (!config.logger.enabled || LEVELS[level] > current) return;
  const line = {
    at: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  const target = level === 'error' ? process.stderr : process.stdout;
  target.write(`${JSON.stringify(line)}\n`);
};

export const logger = {
  error: (message, context) => emit('error', message, context),
  warn: (message, context) => emit('warn', message, context),
  info: (message, context) => emit('info', message, context),
  debug: (message, context) => emit('debug', message, context),
};
