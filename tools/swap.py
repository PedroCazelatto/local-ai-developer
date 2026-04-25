from typing import TYPE_CHECKING

from tools.base import BaseCommand, CommandResult

if TYPE_CHECKING:
    from core.session.orchestrator import SessionOrchestrator

DESCRIPTION = "Switch the active persona. Usage: /swap <persona>"


class SwapCommand(BaseCommand):
    def execute(self, args: list[str], orchestrator: "SessionOrchestrator") -> CommandResult:
        if not args:
            return CommandResult(message="Usage: /swap <persona>")
        try:
            orchestrator.switch_agent(args[0])
        except ValueError as e:
            return CommandResult(message=str(e))
        return CommandResult(message=f"Switched to: {orchestrator.agent.role}")
