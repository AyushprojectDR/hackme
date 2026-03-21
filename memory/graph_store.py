"""
GraphStore — SQLite-backed directed graph of agent steps.

Nodes : one per agent invocation (id, run_id, agent, role, content_summary, timestamp)
Edges : directed relationships between nodes (e.g. explorer→pragmatist, failure→devil_advocate)

Edge types:
  INFORMED_BY   — agent B read agent A's output in the same run
  RETRY_OF      — this node is a retry attempt of a previous node
  FAILURE_LED_TO — a failure node caused the creation of this recovery node
  CROSS_RUN     — a memory recalled from a different run influenced this node
"""

import json
import sqlite3
import uuid
from datetime import datetime
from typing import Optional


SCHEMA = """
CREATE TABLE IF NOT EXISTS nodes (
    id           TEXT PRIMARY KEY,
    run_id       TEXT NOT NULL,
    agent        TEXT NOT NULL,
    role         TEXT NOT NULL,
    summary      TEXT,
    timestamp    TEXT NOT NULL,
    metadata     TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS edges (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    from_node    TEXT NOT NULL,
    to_node      TEXT NOT NULL,
    edge_type    TEXT NOT NULL,
    timestamp    TEXT NOT NULL,
    FOREIGN KEY(from_node) REFERENCES nodes(id),
    FOREIGN KEY(to_node)   REFERENCES nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_nodes_run    ON nodes(run_id);
CREATE INDEX IF NOT EXISTS idx_nodes_agent  ON nodes(agent);
CREATE INDEX IF NOT EXISTS idx_edges_from   ON edges(from_node);
CREATE INDEX IF NOT EXISTS idx_edges_to     ON edges(to_node);
"""

# Edge type constants
INFORMED_BY    = "INFORMED_BY"
RETRY_OF       = "RETRY_OF"
FAILURE_LED_TO = "FAILURE_LED_TO"
CROSS_RUN      = "CROSS_RUN"


class GraphStore:
    """
    Persists and queries the agent-step graph.
    Thread-safe via connection-per-call pattern.
    """

    def __init__(self, db_path: str = "experiments/graph.db"):
        import os
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    # ------------------------------------------------------------------ #
    # Nodes                                                                #
    # ------------------------------------------------------------------ #

    def add_node(
        self,
        run_id:   str,
        agent:    str,
        role:     str,
        content:  str,
        metadata: dict = None,
        node_id:  str  = None,
    ) -> str:
        nid = node_id or str(uuid.uuid4())[:12]
        # Store only a short summary in the graph (full content lives in ChromaDB)
        summary = content[:500].replace("\n", " ")
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO nodes(id, run_id, agent, role, summary, timestamp, metadata) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (nid, run_id, agent, role, summary,
                 datetime.now().isoformat(timespec="seconds"),
                 json.dumps(metadata or {}))
            )
        return nid

    def get_node(self, node_id: str) -> Optional[dict]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
        return dict(row) if row else None

    # ------------------------------------------------------------------ #
    # Edges                                                                #
    # ------------------------------------------------------------------ #

    def add_edge(self, from_node: str, to_node: str, edge_type: str = INFORMED_BY):
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO edges(from_node, to_node, edge_type, timestamp) VALUES (?, ?, ?, ?)",
                (from_node, to_node, edge_type, datetime.now().isoformat(timespec="seconds"))
            )

    # ------------------------------------------------------------------ #
    # Traversal                                                            #
    # ------------------------------------------------------------------ #

    def get_run_nodes(self, run_id: str) -> list[dict]:
        """All nodes in a run, in chronological order."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM nodes WHERE run_id = ? ORDER BY timestamp", (run_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_parents(self, node_id: str) -> list[dict]:
        """All nodes that have an edge pointing TO this node."""
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT n.* FROM nodes n
                   JOIN edges e ON e.from_node = n.id
                   WHERE e.to_node = ?""",
                (node_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_children(self, node_id: str) -> list[dict]:
        """All nodes this node points to."""
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT n.* FROM nodes n
                   JOIN edges e ON e.to_node = n.id
                   WHERE e.from_node = ?""",
                (node_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_ancestors(self, node_id: str, max_depth: int = 4) -> list[dict]:
        """BFS walk up the graph — useful to find the lineage of a node."""
        visited, queue, result = set(), [node_id], []
        depth = 0
        while queue and depth < max_depth:
            next_queue = []
            for nid in queue:
                if nid in visited:
                    continue
                visited.add(nid)
                parents = self.get_parents(nid)
                for p in parents:
                    result.append(p)
                    next_queue.append(p["id"])
            queue = next_queue
            depth += 1
        return result

    def get_run_path(self, run_id: str) -> list[dict]:
        """
        Returns nodes + edges for a run as a simple path list:
        [{"node": {...}, "edge_type": str | None}, ...]
        """
        nodes = {n["id"]: n for n in self.get_run_nodes(run_id)}
        with self._connect() as conn:
            edges = conn.execute(
                """SELECT e.* FROM edges e
                   JOIN nodes n ON e.from_node = n.id
                   WHERE n.run_id = ?
                   ORDER BY e.timestamp""",
                (run_id,)
            ).fetchall()

        path = []
        for node in nodes.values():
            out_edges = [dict(e) for e in edges if e["from_node"] == node["id"]]
            path.append({"node": node, "out_edges": out_edges})
        return path

    # ------------------------------------------------------------------ #
    # Stats                                                                #
    # ------------------------------------------------------------------ #

    def stats(self) -> dict:
        with self._connect() as conn:
            n_nodes = conn.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
            n_edges = conn.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
            n_runs  = conn.execute("SELECT COUNT(DISTINCT run_id) FROM nodes").fetchone()[0]
        return {"nodes": n_nodes, "edges": n_edges, "runs": n_runs}

    def print_run(self, run_id: str):
        path = self.get_run_path(run_id)
        print(f"\n{'='*60}")
        print(f"  GRAPH: run {run_id}  ({len(path)} nodes)")
        print(f"{'='*60}")
        for entry in path:
            n = entry["node"]
            edges_out = [f"→ {e['to_node']} [{e['edge_type']}]" for e in entry["out_edges"]]
            print(f"  [{n['id']}] {n['agent'].upper():20s} | {n['role']:15s} | {n['timestamp']}")
            for e in edges_out:
                print(f"          {e}")
