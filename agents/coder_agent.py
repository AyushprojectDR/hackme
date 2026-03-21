"""
CodeWriter Agent — generates executable Python training scripts.
Outputs ONLY code. Supports memory recall from past runs.
"""

from langchain.schema import HumanMessage, SystemMessage
from prompts.coder_prompts import CODE_WRITER_PROMPT


class CodeWriterAgent:

    def __init__(self, llm):
        self.name   = "code_writer"
        self.llm    = llm
        self.memory = None

    def attach_memory(self, agent_memory):
        self.memory = agent_memory

    def run(
        self,
        context:      str,
        dataset_path: str,
        target_col:   str  = None,
        node_id:      str  = None,
        run_id:       str  = None,
    ) -> str:
        task = (
            f"Dataset path: {dataset_path}\n"
            + (f"Target column: {target_col}\n" if target_col else "")
            + "\nGenerate the complete training script. Output ONLY Python code, no markdown fences."
        )

        # Recall past code attempts
        memory_block = ""
        if self.memory and run_id:
            _, memory_block = self.memory.recall(task=task, run_id=run_id)

        context_block = context.strip() if context.strip() else "(No analysis yet.)"
        full_context  = f"{memory_block}\n\n{context_block}" if memory_block else context_block

        messages = [
            SystemMessage(content=CODE_WRITER_PROMPT),
            HumanMessage(content=f"CURRENT ANALYSIS LOG:\n{full_context}\n\nYOUR TASK:\n{task}"),
        ]
        response = self.llm.invoke(messages)
        raw = response.content.strip() if hasattr(response, "content") else str(response).strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        # Store in memory
        if self.memory and node_id and run_id:
            self.memory.remember(
                node_id=node_id,
                run_id=run_id,
                task=task,
                output=raw,
                role="code",
            )

        return raw
