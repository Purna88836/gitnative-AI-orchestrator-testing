# gitnative-AI-orchestrator-testing

This repository has two separate surfaces:

- **Orchestrator scaffold** for issue-driven agent execution. Start with [SETUP.md](./SETUP.md).
- **Todo demo workload** under [demo/todo-app/README.md](./demo/todo-app/README.md), a small dependency-light application used to exercise backend, frontend, QA, and docs changes together.

The Todo demo is intentionally isolated from the repository's core orchestration files so it can act as a realistic workload without complicating the scaffold itself. The current demo keeps the stack small: a Python standard-library server, plain HTML/CSS/JS assets, JSON-file persistence, and an isolated demo validation workflow.

Use the scaffold docs when you want to configure automation for another repository. Use the demo docs when you want to run, test, or inspect the Todo example itself.
