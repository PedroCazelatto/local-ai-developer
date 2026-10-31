/** Confirmação de saída por duplo Ctrl+C. */
export interface ExitGuard {
  /** Um Ctrl+C ocioso: arma a janela e avisa, ou confirma a saída se ela já estiver armada. */
  press(): void;
  /** Desarma a janela (outra tecla foi digitada, ou a sessão está encerrando). */
  disarm(): void;
}
