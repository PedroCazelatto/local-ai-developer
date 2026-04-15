import sys
from orchestrator.engine import OrchestratorEngine

def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python main.py <project_name>")
        sys.exit(1)

    project_name = sys.argv[1]
    engine = OrchestratorEngine(model_name="qwen2.5-coder:14b")

    try:
        engine.start()
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
