"""Example: Researcher + Writer crew on a single goal."""

from agentic_ai.crew import Crew


def main() -> None:
    crew = Crew(on_trace=print)
    print(crew.run("Explain Agentic AI in simple Hindi-English, with 3 real use cases."))


if __name__ == "__main__":
    main()
