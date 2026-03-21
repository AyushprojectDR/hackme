from .base import BaseAgent
from prompts.analyst_prompts import (
    EXPLORER_PROMPT, SKEPTIC_PROMPT, STATISTICIAN_PROMPT, ETHICIST_PROMPT
)


class ExplorerAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__("Explorer", EXPLORER_PROMPT, llm)


class SkepticAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__("Skeptic", SKEPTIC_PROMPT, llm)


class StatisticianAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__("Statistician", STATISTICIAN_PROMPT, llm)


class EthicistAgent(BaseAgent):
    def __init__(self, llm):
        super().__init__("Ethicist", ETHICIST_PROMPT, llm)
