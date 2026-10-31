import { stdout } from 'node:process';

/**
 * Pede ao terminal que reporte Shift+Enter com sequência própria (kitty CSI u e xterm
 * modifyOtherKeys). Terminais sem suporte ignoram o pedido.
 * Devolve a função que desfaz tudo (idempotente). Ela também roda sozinha ao sair do processo.
 *
 * Usar junto com installLegacyInput: com o protocolo ativo, Ctrl+C deixa de chegar como \x03.
 */
export function enableKeyboardProtocol(): () => void {
  if (!stdout.isTTY) return () => {};

  stdout.write('\x1b[>4;1m'); // modifyOtherKeys nível 1
  stdout.write('\x1b[>1u'); // kitty: "disambiguate escape codes"

  let restored = false;
  const restore = (): void => {
    if (restored) return;
    restored = true;
    stdout.write('\x1b[<u'); // kitty: desfaz
    stdout.write('\x1b[>4;0m'); // modifyOtherKeys: desfaz
  };

  // 'exit' cobre saída normal, process.exit() e erro não tratado.
  process.on('exit', restore);

  // Sinais só disparam 'exit' se forem tratados explicitamente.
  for (const [signal, code] of [
    ['SIGTERM', 143],
    ['SIGHUP', 129],
  ] as const) {
    process.on(signal, () => {
      restore();
      process.exit(code);
    });
  }

  return restore;
}
