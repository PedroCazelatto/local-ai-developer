/**
 * Converte uma tecla reportada pelo protocolo moderno (código + modificadores) no byte clássico
 * que o terminal enviaria sem o protocolo.
 *   Ctrl+C -> \x03 | Enter -> \r | Shift+Enter -> \n | Alt+x -> ESC x
 * Devolve `original` se a tecla não for conhecida.
 */
export function toLegacy(code: number, mods: number, original: string): string {
  const shift = (mods & 1) !== 0;
  const meta = (mods & 2) !== 0;
  const ctrl = (mods & 4) !== 0;

  let char: string;
  if (code === 13) char = shift ? '\n' : '\r';
  else if (code === 9) char = '\t';
  else if (code === 27) char = '\x1b';
  else if (code === 127) char = '\x7f';
  else if (code >= 32 && code < 127) {
    const c = String.fromCharCode(code);
    const lower = c.toLowerCase();
    if (ctrl && lower >= 'a' && lower <= 'z') {
      char = String.fromCharCode(lower.charCodeAt(0) - 96); // Ctrl+C -> \x03
    } else {
      char = shift ? c.toUpperCase() : c;
    }
  } else {
    return original; // tecla desconhecida: deixa como veio
  }

  return (meta ? '\x1b' : '') + char;
}
