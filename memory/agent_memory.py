"""
AgentMemory — the interface each agent uses to recall and store memories.

Each agent has one AgentMemory instance. It wraps:
  - VectorStore  : ChromaDB collection for semantic recall
  - GraphStore   : SQLite graph for structural lineage

Usage inside an agent step:
  1. memories = agent_memory.recall(task, run_id)   → inject into context
  2. agent runs and produces output
  3. agent_memory.remember(node_id, run_id, task, output) → persist to ChromaDB + graph
"""

from typing import Optional
from .vector_store import VectorStore
from .graph_store  import GraphStore, INFORMED_BY, CROSS_RUN

TOP_K_RECALL = 3   # how many past memories to surface per step


def _format_memories(memories: list[dict]) -> str:
    """Format recalled memories into a compact block to inject into agent context."""
    if not memories:
        return ""
    lines = ["[RECALLED MEMORIES FROM PAST RUNS]"]
    for i, m in enumerate(memories, 1):
        status = "✅" if m["success"] else "❌"
        lines.append(
            f"\nMemory {i} {status} (similarity distance: {m['distance']:.3f})\n"
            f"Past task  : {m['task']}\n"
            f"Past output: {m['output'][:600]}{'...' if len(m['output']) > 600 else ''}"
        )
    lines.append("[END OF RECALLED MEMORIES]")
    return "\n".join(lines)


class AgentMemory:
    """
    Per-agent memory interface. One instance per agent.
    """

    def __init__(self, agent_name: str, vector_store: VectorStore, graph_store: GraphStore):
        self.agent_name   = agent_name
        self.vector_store = vector_store
        self.graph_store  = graph_store

    # ------------------------------------------------------------------ #
    # Recall — called BEFORE agent runs                                   #
    # ------------------------------------------------------------------ #

    def recall(self, task: str, run_id: str, top_k: int = TOP_K_RECALL) -> tuple[list[dict], str]:
        """
        Query ChromaDB for the most relevant past memories for this task.

        Returns:
            memories : list of memory dicts
            context_block : formatted string ready to prepend to agent context
        """
        memories = self.vector_store.recall(
            agent_name=self.agent_name,
            query=task,
            top_k=top_k,
            run_id_exclude=run_id,   # don't recall from the current run
        )
        return memories, _format_memories(memories)

    # ------------------------------------------------------------------ #
    # Remember — called AFTER agent runs                                  #
    # ------------------------------------------------------------------ #

    def remember(
        self,
        node_id:  str,
        run_id:   str,
        task:     str,
        output:   str,
        role:     str,
        success:  bool = True,
        metadata: dict = None,
    ):
        """
        Store agent output in ChromaDB (for future semantic recall)
        and add a node to the graph (for structural lineage).
        """
        # Store in ChromaDB
        self.vector_store.remember(
            agent_name=self.agent_name,
            node_id=node_id,
            run_id=run_id,
            task=task,
            output=output,
            success=success,
            metadata=metadata,
        )

        # Add node to graph
        self.graph_store.add_node(
            node_id=node_id,
            run_id=run_id,
            agent=self.agent_name,
            role=role,
            content=output,
            metadata=metadata or {},
        )

    def memory_size(self) -> int:
        return self.vector_store.agent_memory_size(self.agent_name)


class MemorySystem:
    """
    Factory that creates and holds one AgentMemory per agent.
    Passed to the Orchestrator so it can wire memories into each step.
    """

    def __init__(
        self,
        agent_names: list[str],
        persist_dir: str = "experiments/chroma_db",
        graph_db:    str = "experiments/graph.db",
    ):
        self.vector_store = VectorStore(persist_dir=persist_dir)
        self.graph_store  = GraphStore(db_path=graph_db)
        self.memories: dict[str, AgentMemory] = {
            name: AgentMemory(name, self.vector_store, self.graph_store)
            for name in agent_names
        }

    def get(self, agent_name: str) -> Optional[AgentMemory]:
        return self.memories.get(agent_name)

    def print_stats(self):
        gs = self.graph_store.stats()
        print(f"\n[MemorySystem] Graph: {gs['nodes']} nodes, {gs['edges']} edges, {gs['runs']} runs")
        for name, mem in self.memories.items():
            size = mem.memory_size()
            if size > 0:
                print(f"  {name:20s} → {size} memories in ChromaDB")
