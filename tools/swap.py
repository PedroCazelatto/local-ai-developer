from typing import TYPE_CHECKING

from tools.base import BaseCommand, CommandResult

if TYPE_CHECKING:
    from core.session.orchestrator import SessionOrchestrator

DESCRIPTION = "Switch the active phase. Usage: /swap <phase>"


class SwapCommand(BaseCommand):
    def execute(self, args: list[str], orchestrator: "SessionOrchestrator") -> CommandResult:
        if not args:
            return CommandResult(message="Usage: /swap <phase>")
        try:
            orchestrator.switch_agent(args[0])
        except ValueError as e:
            return CommandResult(message=str(e))
        return CommandResult(message=f"Switched to: {orchestrator.agent.role}")
