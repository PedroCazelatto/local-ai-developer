import importlib
import inspect
from collections.abc import Iterator
from pathlib import Path
from types import ModuleType
from typing import TYPE_CHECKING

from tools.base import BaseCommand, BaseTool, CommandResult, ToolContext

if TYPE_CHECKING:
    from core.session.orchestrator import SessionOrchestrator


_TOOLS_DIR = Path(__file__).parent
_SKIP = {"base.py", "factories.py", "__init__.py"}


def _load_modules() -> Iterator[tuple[str, ModuleType]]:
    for path in sorted(_TOOLS_DIR.glob("*.py")):
        if path.name in _SKIP:
            continue
        yield path.stem, importlib.import_module(f"tools.{path.stem}")


def _find_subclass(module: ModuleType, base: type) -> type | None:
    for _, obj in inspect.getmembers(module, inspect.isclass):
        if obj is base:
            continue
        if issubclass(obj, base) and obj.__module__ == module.__name__:
            return obj
    return None


def _require_description(module: ModuleType, name: str) -> str:
    description = getattr(module, "DESCRIPTION", None)
    if not isinstance(description, str) or not description.strip():
        raise ValueError(f"'{name}' is missing a module-level DESCRIPTION string")
    return description


class ToolFactory:
    """Loads every file in `tools/` that defines a `BaseTool` subclass."""

    def __init__(self) -> None:
        self._tools: dict[str, BaseTool] = {}
        self._descriptions: dict[str, str] = {}
        for name, module in _load_modules():
            cls = _find_subclass(module, BaseTool)
            if cls is None:
                continue
            self._tools[name] = cls()  # type: ignore[abstract]
            self._descriptions[name] = _require_description(module, name)

    @property
    def definitions(self) -> list[dict[str, object]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": self._descriptions[name],
                    "parameters": tool.parameters,
                },
            }
            for name, tool in self._tools.items()
        ]

    def call(self, name: str, ctx: ToolContext, args: dict[str, object]) -> str:
        tool = self._tools.get(name)
        if tool is None:
            return f"Error: Tool '{name}' not found."
        return tool.execute(ctx, **args)


class CommandFactory:
    """Loads every file in `tools/` that defines a `BaseCommand` subclass."""

    def __init__(self) -> None:
        self._commands: dict[str, BaseCommand] = {}
        self._descriptions: dict[str, str] = {}
        for name, module in _load_modules():
            cls = _find_subclass(module, BaseCommand)
            if cls is None:
                continue
            self._commands[name] = cls()  # type: ignore[abstract]
            self._descriptions[name] = _require_description(module, name)

    def names(self) -> list[str]:
        return sorted(self._commands.keys())

    def help(self) -> list[tuple[str, str]]:
        return [(name, self._descriptions[name]) for name in self.names()]

    def dispatch(self, user_input: str, orchestrator: "SessionOrchestrator") -> CommandResult:
        stripped = user_input.strip().lstrip("/")
        parts = stripped.split()
        if not parts:
            return CommandResult(message="Empty command")
        name, args = parts[0], parts[1:]
        command = self._commands.get(name)
        if command is None:
            return CommandResult(message=f"Unknown command: /{name}")
        return command.execute(args, orchestrator)
