from .base import BaseAgent
from prompts.planner_prompts import (
    PRAGMATIST_PROMPT, DEVIL_ADVOCATE_PROMPT, ARCHITECT_PROMPT, OPTIMIZER_PROMPT
)


class PragmatistAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__("Pragmatist", PRAGMATIST_PROMPT, llm)


class DevilAdvocateAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__("Devil's Advocate", DEVIL_ADVOCATE_PROMPT, llm)


class ArchitectAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__("Architect", ARCHITECT_PROMPT, llm)


class OptimizerAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__("Optimizer", OPTIMIZER_PROMPT, llm)
