from typing import TYPE_CHECKING

from tools.base import BaseCommand, CommandResult

if TYPE_CHECKING:
    from core.session.orchestrator import SessionOrchestrator

DESCRIPTION = "Clear the active persona's message history."


class ClearCommand(BaseCommand):
    def execute(self, args: list[str], orchestrator: "SessionOrchestrator") -> CommandResult:
        orchestrator.memory.clear()
        return CommandResult(message=f"Cleared memory for: {orchestrator.agent.role}")
