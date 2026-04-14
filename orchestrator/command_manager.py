import importlib
import os

class CommandManager:
    def __init__(self, orchestrator):
        self.orc = orchestrator
        self.commands_path = os.path.join(os.path.dirname(__file__), "commands")

    def execute(self, user_input):
        parts = user_input.strip().split(" ")
        cmd_name = parts[0][1:].lower()
        args = parts[1:]

        try:
            cmd_dir = os.path.join(self.commands_path, cmd_name)

            if os.path.isdir(cmd_dir):
                sub_cmd = args[0].lower() if args else "help"
                sub_args = args[1:]
                module = importlib.import_module(f"orchestrator.commands.{cmd_name}.{sub_cmd}")
                return module.run(self.orc, sub_args)

            module = importlib.import_module(f"orchestrator.commands.{cmd_name}")
            return module.run(self.orc, args)

        except (ImportError, ModuleNotFoundError):
            self.orc.ui.error(f"Command '/{cmd_name}' not found.")
            return False
        except Exception as e:
            self.orc.ui.error(f"Error executing command: {str(e)}")
            return False
