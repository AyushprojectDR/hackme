"""
VectorStore — ChromaDB wrapper for per-agent persistent memory.

Each agent gets its own ChromaDB collection.
Embeddings use sentence-transformers all-MiniLM-L6-v2 (local, no API key).
Falls back gracefully if ChromaDB is unavailable.
"""

import os
import uuid
from datetime import datetime
from typing import Optional

try:
    import chromadb
    from chromadb.utils import embedding_functions
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False


CHROMA_PERSIST_DIR = os.path.join("experiments", "chroma_db")
EMBED_MODEL        = "all-MiniLM-L6-v2"   # dim=384, fast, local


class VectorStore:
    """
    Wraps ChromaDB. Each agent gets its own persistent collection.

    Collection naming: agent_{agent_name_sanitized}
      e.g.  explorer → agent_explorer
            devil's advocate → agent_devils_advocate
    """

    def __init__(self, persist_dir: str = CHROMA_PERSIST_DIR):
        self.available = CHROMA_AVAILABLE
        if not self.available:
            print("[VectorStore] chromadb not installed — long-term memory disabled.")
            return

        os.makedirs(persist_dir, exist_ok=True)
        self.client = chromadb.PersistentClient(path=persist_dir)
        self._embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBED_MODEL
        )
        self._collections: dict = {}

    # ------------------------------------------------------------------ #
    # Collection management                                                #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _col_name(agent_name: str) -> str:
        """Sanitize agent name to a valid ChromaDB collection name."""
        return "agent_" + (
            agent_name.lower()
            .replace("'", "")
            .replace(" ", "_")
            .replace("-", "_")
        )

    def _get_collection(self, agent_name: str):
        col_name = self._col_name(agent_name)
        if col_name not in self._collections:
            self._collections[col_name] = self.client.get_or_create_collection(
                name=col_name,
                embedding_function=self._embed_fn,
                metadata={"agent": agent_name},
            )
        return self._collections[col_name]

    # ------------------------------------------------------------------ #
    # Store a memory                                                       #
    # ------------------------------------------------------------------ #

    def remember(
        self,
        agent_name: str,
        node_id:    str,
        run_id:     str,
        task:       str,
        output:     str,
        success:    bool = True,
        metadata:   dict = None,
    ):
        if not self.available:
            return

        collection = self._get_collection(agent_name)
        meta = {
            "node_id":   node_id,
            "run_id":    run_id,
            "task":      task[:500],        # ChromaDB metadata has size limits
            "success":   str(success),
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            **(metadata or {}),
        }

        # Embed and store the output text
        collection.add(
            ids=[node_id],
            documents=[output],
            metadatas=[meta],
        )

    # ------------------------------------------------------------------ #
    # Recall relevant memories                                             #
    # ------------------------------------------------------------------ #

    def recall(
        self,
        agent_name: str,
        query:      str,
        top_k:      int = 3,
        run_id_exclude: Optional[str] = None,
    ) -> list[dict]:
        """
        Returns top_k most relevant past memories for an agent.
        Each result: {"output": str, "task": str, "run_id": str, "distance": float}
        """
        if not self.available:
            return []

        collection = self._get_collection(agent_name)
        count = collection.count()
        if count == 0:
            return []

        where = None
        if run_id_exclude:
            where = {"run_id": {"$ne": run_id_exclude}}

        results = collection.query(
            query_texts=[query],
            n_results=min(top_k, count),
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        memories = []
        docs      = results["documents"][0]
        metas     = results["metadatas"][0]
        distances = results["distances"][0]

        for doc, meta, dist in zip(docs, metas, distances):
            memories.append({
                "output":   doc,
                "task":     meta.get("task", ""),
                "run_id":   meta.get("run_id", ""),
                "success":  meta.get("success", "True") == "True",
                "distance": round(dist, 4),
            })

        return memories

    # ------------------------------------------------------------------ #
    # Utility                                                              #
    # ------------------------------------------------------------------ #

    def agent_memory_size(self, agent_name: str) -> int:
        if not self.available:
            return 0
        return self._get_collection(agent_name).count()

    def list_agents(self) -> list[str]:
        if not self.available:
            return []
        return [c.name for c in self.client.list_collections()]
