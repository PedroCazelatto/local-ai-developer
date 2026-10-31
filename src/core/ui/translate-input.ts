import { toLegacy } from './to-legacy.js';

// kitty / CSI u: ESC [ código[:alternativas] ; modificadores[:evento] u
const CSI_U = /\x1b\[(\d+)(?::[\d:]*)?(?:;(\d+)(?::\d+)?)?u/g;
// xterm modifyOtherKeys: ESC [ 27 ; modificadores ; código ~
const MOD_OTHER = /\x1b\[27;(\d+);(\d+)~/g;

/** Troca, dentro de um trecho de entrada, as sequências modernas pelos bytes clássicos. */
export function translateInput(text: string): string {
  return text
    .replace(CSI_U, (m, code: string, mods?: string) => toLegacy(Number(code), Number(mods ?? 1) - 1, m))
    .replace(MOD_OTHER, (m, mods: string, code: string) => toLegacy(Number(code), Number(mods) - 1, m));
}
