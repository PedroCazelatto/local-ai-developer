# Local AI Developer

## What is this?

What a better way to learn how to code with an AI than to orchestrate AI Development?

This is my attempt to make AI iterate on code development, learning all the basics of prompt engineering, interaction isolation and many other things.

All of this while not spending a penny. Just using my RTX 3060 and electrical bill to run everything.

## Requirements

- Ollama App
- Docker
- Python3

## Commands

### To run the application

- `.\run.ps1 install` - To install everything
- `.\run.ps1 start <project-name>` - To start the application focused on _project-name_
- `.\run.ps1 stop` - To shutdown docker

### Application commands

These commands only run on the Rich Terminal

- `/switch [architect / dev]` - Change the model behavior
- `/clear` - Clear the terminal and resets model context
- `/models list` - To list all available Ollama models
- `/models pull <model-name>` - To download _model-name_ locally
- `exit / quit` - To stop the application

## Models used

I've selected some models to run locally, but you can choose the one that fits you the best:

1. qwen2.5-coder:14b
2. qwen3.5:27b
3. qwen3-coder:30b

Just change the model on `.env`

## AI Inference

To run the model, I'm using Ollama, as it manages the usage of VRAM and RAM seamlessly.

## AI Interaction Isolation

As of today, the best solution to let any model run while doing code is to isolate it. It should never have access to your full machine, be it running locally or on cloud.

So, Docker developed `Docker Sandbox`, a microVM isolated by hardware to the model act, greatly limiting all the mess that it could do. But it's still on experimental Docker, so I'm not using it yet.

Reference: https://www.docker.com/blog/docker-sandboxes-run-agents-in-yolo-mode-safely

Instead, I'm using Docker Standard as an alternative.

## AI Orchestrator

To control all the power of the model and guide it through the thinking process, I'm building this Python Orchestrator, some code to interface the project files and the model, as well as keeping the rest of the system secure.

### Human Interface

To interact with the AI I'm using Rich, a Python lib that can create elegant terminal interfaces.

## Folders structure

```
local-ai-developer/
├── main.py                 # Entry point for the CLI
├── orchestrator/           # The "Brains"
│   ├── index.py
│   ├── engine.py           # Main loop of chat and decisions
│   ├── docker-client.py    # Docker management
│   ├── ui.py               # Visual interface for the chat
│   └── tools/              # All the tools for the model
│       ├── list-files.py   # List all files of the project
│       ├── read-file.py    # Read one file of the project
│       ├── alter-file.py   # Apply changes to one file of the project
│       ...                 # Other tools that the model might need
├── rules/                  # Knowledge base for the model
│   ├── personas/           # Identities that the model assumes
│   ├── standards/          # Technical patterns to develop with
│   └── workflows/          # Explanation on how to generate some technical files
├── projects/               # Where all the projects resides. Each child is a git repo
│   ├── my-app-1/
│   ├── my-app-2/
│   ...
└── docker-compose.yml      # Base infrastructure
```

There is two reasons for the `projects` folder to exists:

1. Isolate the logic of the project from all the extra files for the models, as the project can be shipped independently
2. Single source of truth in one single repo for all the rules of development between all the projects, without the need to clone this repo for every new project or copy altered files if some rule changes.

