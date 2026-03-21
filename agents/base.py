from langchain.schema import HumanMessage, SystemMessage


class BaseAgent:
    """
    Base class for all agents.

    If an AgentMemory is attached, the agent will:
      - recall relevant past memories before running (injected into context)
      - store its output after running
    """

    def __init__(self, name: str, system_prompt: str, llm):
        self.name          = name
        self.system_prompt = system_prompt
        self.llm           = llm
        self.memory        = None   # set by Orchestrator via attach_memory()

    def attach_memory(self, agent_memory):
        self.memory = agent_memory

    def run(
        self,
        context:  str,
        task:     str,
        node_id:  str  = None,
        run_id:   str  = None,
        role:     str  = "analysis",
        success:  bool = True,
    ) -> str:
        # 1. Recall relevant memories from past runs
        memory_block = ""
        if self.memory and run_id:
            _, memory_block = self.memory.recall(task=task, run_id=run_id)

        # 2. Build full context
        context_block = context.strip() if context.strip() else "(No analysis yet — you are going first.)"
        full_context  = (
            f"{memory_block}\n\n{context_block}" if memory_block else context_block
        )

        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=f"CURRENT ANALYSIS LOG:\n{full_context}\n\nYOUR TASK:\n{task}"),
        ]

        # 3. Run LLM
        response = self.llm.invoke(messages)
        output   = response.content.strip() if hasattr(response, "content") else str(response).strip()

        # 4. Store in memory
        if self.memory and node_id and run_id:
            self.memory.remember(
                node_id=node_id,
                run_id=run_id,
                task=task,
                output=output,
                role=role,
                success=success,
            )

        return output
