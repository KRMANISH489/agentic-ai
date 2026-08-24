from __future__ import annotations

import argparse
import sys

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

from agentic_ai.agent import Agent
from agentic_ai.crew import Crew

console = Console()


def trace(line: str) -> None:
    console.print(f"[dim]{line}[/dim]")


def print_banner(mode: str) -> None:
    console.print(
        Panel.fit(
            "[bold cyan]Agentic AI[/bold cyan]\n"
            f"Mode: [yellow]{mode}[/yellow]\n"
            "Type a question. Commands: /reset  /quit",
            border_style="cyan",
        )
    )


def chat_loop(ask) -> None:
    while True:
        try:
            user = console.input("\n[bold green]You>[/bold green] ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\nBye.")
            return
        if not user:
            continue
        if user.lower() in {"/quit", "/exit", "quit", "exit"}:
            console.print("Bye.")
            return
        if user.lower() == "/reset":
            if hasattr(ask, "reset"):
                ask.reset()
            console.print("[yellow]Memory cleared.[/yellow]")
            continue

        with console.status("[cyan]Agent is thinking...[/cyan]"):
            answer = ask(user)
        console.print(Panel(Markdown(answer), title="Agent", border_style="magenta"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a Python Agentic AI assistant.")
    parser.add_argument(
        "--crew",
        action="store_true",
        help="Use Researcher + Writer multi-agent crew",
    )
    parser.add_argument(
        "-q",
        "--question",
        help="Ask one question and exit (no interactive chat)",
    )
    args = parser.parse_args()

    try:
        if args.crew:
            crew = Crew(on_trace=trace)
            ask = crew.run
            mode = "multi-agent crew"
        else:
            agent = Agent(on_trace=trace)
            ask = agent.ask
            mode = "single ReAct agent"
    except Exception as exc:
        console.print(f"[red]Startup failed:[/red] {exc}")
        console.print("Copy .env.example to .env and add a Groq (or other) API key.")
        return 1

    if args.question:
        answer = ask(args.question)
        console.print(Markdown(answer))
        return 0

    print_banner(mode)
    chat_loop(ask)
    return 0


if __name__ == "__main__":
    sys.exit(main())
