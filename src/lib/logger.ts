/**
 * Simple structured logger for Ironhold.
 * In production, replace with pino/winston if needed.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function formatMessage(level: LogLevel, module: string, message: string): string {
  const ts = new Date().toISOString()
  return `[${ts}] [${level.toUpperCase()}] [${module}] ${message}`
}

const logger = {
  debug(module: string, message: string, data?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('debug', module, message), data ?? '')
    }
  },

  info(module: string, message: string, data?: unknown) {
    console.info(formatMessage('info', module, message), data ?? '')
  },

  warn(module: string, message: string, data?: unknown) {
    console.warn(formatMessage('warn', module, message), data ?? '')
  },

  error(module: string, message: string, error?: unknown) {
    console.error(formatMessage('error', module, message), error ?? '')
  },
}

export default logger
