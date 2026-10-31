import { translateInput } from './translate-input.js';

const INSTALLED = Symbol.for('legacy-input-installed');

/**
 * Faz com que todo ouvinte de 'data' do stream (readline, input-fence...) receba bytes clássicos.
 * Chame UMA vez, antes de createInterface() e de qualquer emitKeypressEvents().
 */
export function installLegacyInput(stream: NodeJS.ReadStream): void {
  const flagged = stream as unknown as Record<symbol, boolean>;
  if (flagged[INSTALLED]) return;
  flagged[INSTALLED] = true;

  const originalEmit = stream.emit.bind(stream);
  stream.emit = ((event: string | symbol, ...args: unknown[]): boolean => {
    if (event === 'data' && args[0] !== undefined) {
      const isBuffer = Buffer.isBuffer(args[0]);
      const text = isBuffer ? (args[0] as Buffer).toString('utf8') : String(args[0]);
      if (text.includes('\x1b[')) {
        const translated = translateInput(text);
        args[0] = isBuffer ? Buffer.from(translated, 'utf8') : translated;
      }
    }
    return originalEmit(event, ...args);
  }) as typeof stream.emit;
}
