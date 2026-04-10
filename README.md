# Local AI Developer

## What is this?

What a better way to learn how to code with an AI than to orchestrate AI Development?

This is my attempt to make AI iterate on code development, learning all the basics of prompt engineering, interaction isolation and many other things.

All of this while not spending a penny. Just using my RTX 3060 and electrical bill to run everything.

## Requirements

- Ollama
- Dockers

## Commands

`docker compose up`

## Models used

I've selected some models to run locally, but you can choose the one that fits you the best:

1. qwen2.5-coder:14b
2. qwen3.5:27b
3. qwen3-coder:30b

## Inference

To run the model, I'm using Ollama, as it manages the usage of VRAM and RAM seamlessly.

## Interaction Isolation

As of today, the best solution to let any model run while doing code is to isolate it. It should never have access to your full machine, be it running locally or on cloud.

So, Docker developed `Docker Sandbox`, a microVM isolated by hardware to the model act, greatly limiting all the mess that it could do. But it's still on experimental Docker, so I'm not using it yet.

Reference: https://www.docker.com/blog/docker-sandboxes-run-agents-in-yolo-mode-safely


