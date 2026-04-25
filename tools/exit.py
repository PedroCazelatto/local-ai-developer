from typing import TYPE_CHECKING

from tools.base import BaseCommand, CommandResult

if TYPE_CHECKING:
    from core.session.orchestrator import SessionOrchestrator

DESCRIPTION = "Exit the orchestrator session."


class ExitCommand(BaseCommand):
    def execute(self, args: list[str], orchestrator: "SessionOrchestrator") -> CommandResult:
        return CommandResult(exit=True)
