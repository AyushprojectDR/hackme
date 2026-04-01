"""
FastAPI backend — Multi-Agent DS Team
======================================
Replaces app.py (Streamlit).

Endpoints:
  GET  /api/creds              — load saved credentials
  POST /api/creds              — save credentials
  GET  /api/browse?dir=false   — open native file/folder picker
  POST /api/run                — start pipeline, returns { runId }
  WS   /ws/{run_id}            — stream log + state updates in real time
  GET  /api/result/{run_id}    — get final result / report

Run:
  pip install fastapi uvicorn[standard]
  python server.py
"""

from __future__ import annotations

import asyncio
import json
import os
import queue
import subprocess
import sys
import threading
import traceback
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="DS Agent Team API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────
# Credentials persistence
# ─────────────────────────────────────────────────────────────────────
CREDS_FILE = Path.home() / ".ds_agent_team.json"

def _load_creds() -> dict:
    try:
        if CREDS_FILE.exists():
            return json.loads(CREDS_FILE.read_text())
    except Exception:
        pass
    return {}

def _save_creds(data: dict):
    try:
        existing = _load_creds()
        existing.update(data)
        CREDS_FILE.write_text(json.dumps(existing, indent=2))
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────────
# File / folder picker (subprocess — avoids macOS main-thread crash)
# ─────────────────────────────────────────────────────────────────────
def _pick_path_sync(pick_dir: bool = False) -> str:
    script = f"""
import tkinter as tk
from tkinter import filedialog
root = tk.Tk(); root.withdraw(); root.wm_attributes("-topmost", True)
if {pick_dir}:
    p = filedialog.askdirectory(title="Select dataset folder")
else:
    p = filedialog.askopenfilename(
        title="Select dataset file",
        filetypes=[("Supported","*.csv *.tsv *.parquet *.feather *.json *.jsonl *.xlsx *.xls *.h5 *.zip *.tar *.gz"),("All","*.*")])
root.destroy(); print(p or "", end="")
"""
    try:
        r = subprocess.run([sys.executable, "-c", script],
                           capture_output=True, text=True, timeout=60)
        return r.stdout.strip()
    except Exception:
        return ""


# ─────────────────────────────────────────────────────────────────────
# Log → agent state parser
# ─────────────────────────────────────────────────────────────────────
_AGENT_KEYS = {
    "explorer":         "Explorer",
    "skeptic":          "Skeptic",
    "statistician":     "Statistician",
    "feature_engineer": "Feat.Eng",
    "feature engineer": "Feat.Eng",
    "ethicist":         "Ethicist",
    "pragmatist":       "Pragmatist",
    "devil_advocate":   "Devil's Adv",
    "devil's advocate": "Devil's Adv",
    "optimizer":        "Optimizer",
    "diagnostic":       "Diagnostic",
    "code_writer":      "CodeWriter",
    "codewriter":       "CodeWriter",
    "architect":        "Architect",
    "storyteller":      "Storyteller",
}

def _parse_log_line(line: str) -> dict:
    low = line.lower()
    phase = ""
    if   "phase 1" in low or "data understanding" in low: phase = "Phase 1 · Data Understanding"
    elif "phase 2" in low or "model design"       in low: phase = "Phase 2 · Model Design"
    elif "phase 3" in low or "code generation"    in low: phase = "Phase 3 · Code Generation"
    elif "phase 4" in low or "validation"         in low: phase = "Phase 4 · Validation"
    elif "phase 5" in low or "inference"          in low: phase = "Phase 5 · Inference"

    agent = ""
    for key, name in _AGENT_KEYS.items():
        if key in low:
            agent = name
            break

    return {"phase": phase, "agent": agent}


# ─────────────────────────────────────────────────────────────────────
# In-memory run store
# ─────────────────────────────────────────────────────────────────────
class RunState:
    def __init__(self):
        self.log_queue: queue.Queue = queue.Queue()
        self.result:   Optional[dict] = None
        self.error:    Optional[str]  = None
        self.done:     bool           = False

runs: dict[str, RunState] = {}


# ─────────────────────────────────────────────────────────────────────
# Stdout tee
# ─────────────────────────────────────────────────────────────────────
class _Tee:
    def __init__(self, q: queue.Queue, orig):
        self.q = q; self.orig = orig
    def write(self, t: str):
        if t: self.q.put(t)
        try: self.orig.write(t); self.orig.flush()
        except: pass
    def flush(self):
        try: self.orig.flush()
        except: pass
    def fileno(self): return self.orig.fileno()


# ─────────────────────────────────────────────────────────────────────
# Pipeline runner
# ─────────────────────────────────────────────────────────────────────
def _run_pipeline(cfg: dict) -> dict:
    from backends.llm_backends    import get_llm
    from backends.fallback        import build_fallback_llm
    from agents import (ExplorerAgent, SkepticAgent, StatisticianAgent, EthicistAgent,
                        PragmatistAgent, DevilAdvocateAgent, ArchitectAgent, OptimizerAgent,
                        StorytellerAgent, CodeWriterAgent)
    from agents.agent_config        import AGENT_CONFIGS
    from agents.base                import BaseAgent
    from agents.builder_agent       import BuilderAgent
    from execution.executor         import CodeExecutor
    from memory.agent_memory        import MemorySystem
    from orchestration.orchestrator import Orchestrator
    from orchestration.registry     import AgentRegistry
    from phases.discovery           import DatasetDiscovery
    from tool_registry              import ToolRegistry
    from prompts.planner_prompts    import FEATURE_ENGINEER_PROMPT

    exp_dir = cfg.get("experiment_dir", "experiments")
    os.makedirs(exp_dir, exist_ok=True)

    if cfg["provider"] == "claude"  and cfg.get("api_key"): os.environ["ANTHROPIC_API_KEY"] = cfg["api_key"]
    if cfg["provider"] == "openai"  and cfg.get("api_key"): os.environ["OPENAI_API_KEY"]    = cfg["api_key"]

    print(f"\n📂 Scanning dataset: {cfg['dataset_path']}")
    disc    = DatasetDiscovery()
    profile = disc.scan(cfg["dataset_path"])
    print(f"   Files : {len(profile.files)}  |  Types : {', '.join(profile.types_present)}")
    ds_sum  = disc.format_profile(profile)

    llm_kw = {}
    if cfg.get("server_url"): llm_kw["base_url"] = cfg["server_url"]
    llm = get_llm(cfg["provider"], model=cfg.get("model"), **llm_kw)

    agents = {
        "explorer":         ExplorerAgent(llm,      config=AGENT_CONFIGS["explorer"]),
        "skeptic":          SkepticAgent(llm,        config=AGENT_CONFIGS["skeptic"]),
        "statistician":     StatisticianAgent(llm,   config=AGENT_CONFIGS["statistician"]),
        "feature_engineer": BaseAgent("Feature Engineer", FEATURE_ENGINEER_PROMPT, llm, config=AGENT_CONFIGS["feature_engineer"]),
        "ethicist":         EthicistAgent(llm,       config=AGENT_CONFIGS["ethicist"]),
        "pragmatist":       PragmatistAgent(llm,     config=AGENT_CONFIGS["pragmatist"]),
        "devil_advocate":   DevilAdvocateAgent(llm,  config=AGENT_CONFIGS["devil_advocate"]),
        "optimizer":        OptimizerAgent(llm,      config=AGENT_CONFIGS["optimizer"]),
        "architect":        ArchitectAgent(llm,      config=AGENT_CONFIGS["architect"]),
        "storyteller":      StorytellerAgent(llm,    config=AGENT_CONFIGS["storyteller"]),
        "code_writer":      CodeWriterAgent(llm,     config=AGENT_CONFIGS["code_writer"]),
    }

    mem = (MemorySystem(agent_names=list(agents.keys()),
                        persist_dir=os.path.join(exp_dir, "chroma_db"),
                        graph_db=os.path.join(exp_dir, "graph.db"))
           if cfg.get("enable_memory", True) else None)

    mode     = cfg.get("mode", "phases")
    ne       = mode in ("train", "phases")
    executor = CodeExecutor(work_dir=exp_dir) if ne else None
    trdir    = os.path.join(exp_dir, "tool_registry")
    tool_reg = ToolRegistry(registry_dir=trdir) if ne else None
    registry = AgentRegistry(max_concurrent=cfg.get("max_agents", 5),
                              persist_path=os.path.join(exp_dir, "registry.json"))
    builder  = BuilderAgent(llm=llm, tool_registry=tool_reg) if cfg.get("enable_builder", True) else None

    orch = Orchestrator(agents=agents, llm=llm, executor=executor, memory_system=mem,
                        registry=registry, tool_registry=tool_reg, builder_agent=builder,
                        task_description=cfg.get("task_description", ""))

    absp = os.path.abspath(cfg["dataset_path"])
    tgt  = cfg.get("target_col") or None
    ret  = int(cfg.get("max_retries", 4))

    if   mode == "manual": orch.run_manual(ds_sum)
    elif mode == "auto":   orch.run_auto(ds_sum)
    elif mode == "train":  orch.run_training_loop(dataset_summary=ds_sum, dataset_path=absp, target_col=tgt, max_retries=ret, experiment_dir=exp_dir)
    elif mode == "phases": orch.run_phases(dataset_summary=ds_sum, dataset_path=absp, target_col=tgt, max_retries=ret, experiment_dir=exp_dir, dataset_profile=profile)

    lp = os.path.join(exp_dir, f"context_{orch.run_id}.json")
    orch.context.save(lp)

    entries = [
        {"role": e.role, "agent": e.agent, "content": e.content,
         "metadata": e.metadata if isinstance(e.metadata, dict) else {}}
        for e in orch.context.entries
    ]
    return {"run_id": orch.run_id, "log_path": lp, "exp_dir": exp_dir, "entries": entries}


def _thread_runner(run_id: str, cfg: dict):
    state = runs[run_id]
    old   = sys.stdout
    sys.stdout = _Tee(state.log_queue, old)
    try:
        state.result = _run_pipeline(cfg)
    except Exception:
        state.error = traceback.format_exc()
        state.log_queue.put(f"\n❌ ERROR:\n{state.error}")
    finally:
        sys.stdout = old
        state.log_queue.put(None)  # sentinel


# ─────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────

@app.get("/api/creds")
def get_creds():
    c = _load_creds()
    # Never send the full key to the frontend — send masked version
    key = c.get("api_key", "")
    masked = ("•" * min(len(key), 40)) if key else ""
    return {
        "provider":   c.get("provider", "claude"),
        "hasKey":     bool(key),
        "maskedKey":  masked,
        "serverUrl":  c.get("server_url", ""),
    }


class CredsPayload(BaseModel):
    provider:  str
    api_key:   str = ""
    server_url: str = ""

@app.post("/api/creds")
def save_creds(body: CredsPayload):
    _save_creds({"provider": body.provider, "api_key": body.api_key, "server_url": body.server_url})
    return {"ok": True}


@app.get("/api/browse")
async def browse(dir: bool = False):
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, lambda: _pick_path_sync(dir))
    return {"path": result}


class RunPayload(BaseModel):
    provider:         str
    api_key:          str = ""
    server_url:       str = ""
    dataset_path:     str
    task_description: str = ""
    mode:             str = "phases"
    target_col:       str = ""
    model:            str = ""
    max_retries:      int = 4
    max_agents:       int = 5
    enable_memory:    bool = True
    enable_builder:   bool = True
    experiment_dir:   str = "experiments"

@app.post("/api/run")
def start_run(body: RunPayload):
    run_id = str(uuid.uuid4())[:8]
    runs[run_id] = RunState()

    cfg = body.model_dump()
    cfg["provider"] = "local" if cfg["provider"] == "local (vLLM)" else cfg["provider"]
    cfg["target_col"] = cfg["target_col"] or None
    cfg["model"]      = cfg["model"]      or None

    t = threading.Thread(target=_thread_runner, args=(run_id, cfg), daemon=True)
    t.start()
    return {"runId": run_id}


@app.websocket("/ws/{run_id}")
async def websocket_endpoint(ws: WebSocket, run_id: str):
    await ws.accept()
    state = runs.get(run_id)
    if not state:
        await ws.send_json({"type": "error", "message": "Unknown run ID"})
        await ws.close()
        return

    current_phase = ""
    ever_active: list[str] = []

    try:
        while True:
            try:
                msg = state.log_queue.get_nowait()
            except queue.Empty:
                if state.done:
                    break
                await asyncio.sleep(0.05)
                continue

            if msg is None:
                state.done = True
                continue

            # Send raw log chunk
            await ws.send_json({"type": "log", "text": msg})

            # Parse for structured state update
            for line in msg.splitlines():
                parsed = _parse_log_line(line)
                if parsed["phase"] and parsed["phase"] != current_phase:
                    current_phase = parsed["phase"]
                    await ws.send_json({"type": "phase", "phase": current_phase})
                if parsed["agent"]:
                    if parsed["agent"] not in ever_active:
                        ever_active.append(parsed["agent"])
                    await ws.send_json({
                        "type":        "agent",
                        "agent":       parsed["agent"],
                        "everActive":  ever_active,
                    })

        # Pipeline finished — send final result
        if state.error:
            await ws.send_json({"type": "done", "error": state.error})
        else:
            await ws.send_json({"type": "done", "error": None, "runId": run_id})

    except WebSocketDisconnect:
        pass


@app.get("/api/result/{run_id}")
def get_result(run_id: str):
    state = runs.get(run_id)
    if not state:
        return {"error": "Unknown run ID"}
    if not state.done and not state.result:
        return {"error": "Still running"}
    if state.error:
        return {"error": state.error}
    return state.result


# ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
