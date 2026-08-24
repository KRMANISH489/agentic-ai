from __future__ import annotations

from agentic_ai.agent import Agent
from agentic_ai.llm import LLM
from agentic_ai.prefs import load_prefs
from agentic_ai.tools import tools_by_names


RESEARCHER_PROMPT = """You are a Researcher agent.
Gather facts using weather, web_search, and wikipedia_summary.
Return a structured brief:
- Key facts (bullets)
- Numbers / dates
- Sources (URLs)
Do not write a polished final essay. Just the research brief.
If the user is only greeting, do not use tools. Return a one-line note that it is a greeting.
"""

WRITER_PROMPT = """You are a Writer agent.
You receive a research brief. Turn it into a clear, useful answer for the user.
Cite sources. Do not invent facts that are not in the brief.
You may use calculator or current_time if needed. Do not search again unless the brief is empty.
"""


class Crew:
    """Two-agent team: Researcher collects facts, Writer produces the final answer."""

    def __init__(self, on_trace=None) -> None:
        llm = LLM()
        installed = set(load_prefs()["installed_tools"])
        all_tools = tools_by_names(list(installed))
        research_tools = [
            t
            for t in all_tools
            if t.name in {"web_search", "wikipedia_summary", "weather", "github"}
        ]
        writer_tools = [
            t
            for t in all_tools
            if t.name in {"calculator", "current_time", "notes_write", "unit_convert", "text_stats"}
        ]

        self.researcher = Agent(
            name="Researcher",
            system_prompt=RESEARCHER_PROMPT,
            tools=research_tools,
            llm=llm,
            on_trace=on_trace,
        )
        self.writer = Agent(
            name="Writer",
            system_prompt=WRITER_PROMPT,
            tools=writer_tools,
            llm=llm,
            on_trace=on_trace,
        )

    def apply_user(self, user: dict | None) -> None:
        self.researcher.apply_user(user, RESEARCHER_PROMPT)
        self.writer.apply_user(user, WRITER_PROMPT)

    def run(self, goal: str) -> str:
        brief = self.researcher.ask(
            f"Research this request thoroughly and return a brief:\n\n{goal}"
        )
        return self.writer.ask(
            f"User request:\n{goal}\n\nResearch brief:\n{brief}\n\nWrite the final answer."
        )

    def reset(self) -> None:
        self.researcher.reset()
        self.writer.reset()
