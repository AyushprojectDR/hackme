# Multi-Agent Data Science Team

An autonomous data science pipeline where a team of specialized AI agents collaborates to analyze a dataset, generate training code, execute it, and retry with a different approach on failure — all without human intervention.

Each agent has its own personality, long-term memory, and persistent knowledge graph. Agents learn from past runs and never repeat failed approaches.

---

## How It Works

You give it a CSV file and a target column. The system does the rest:

```
Dataset → Analysis (parallel) → Plan → Generate Code → Execute → ✅ Done
                                                             ↓ (if fails)
                                              Expire memories → Re-evaluate → Retry
```

### The Agent Team

| Agent | Role | Personality |
|---|---|---|
| **Explorer** | EDA — patterns, correlations, key features | Curious, constructive |
| **Skeptic** | Data quality — outliers, leakage, missing values | Aggressively critical |
| **Statistician** | Distributions, hypothesis tests, multicollinearity | Pure neutral, rigorous |
| **Feature Engineer** | New features, encodings, transformations | Inventive |
| **Ethicist** | Bias, fairness, responsible AI concerns | Cautious observer |
| **Pragmatist** | Modeling plan — models to try, eval metric | Results-driven |
| **Devil's Advocate** | Challenges the plan, proposes alternatives | Maximally contrarian |
| **Optimizer** | Hyperparameter tuning, CV strategy, ensembles | Performance-obsessed |
| **Architect** | Deployment design, serving infra, monitoring | Systems-thinker |
| **CodeWriter** | Generates executable Python training scripts | Precise, code-only output |
| **Storyteller** | Final narrative for judges/stakeholders | Compelling, audience-aware |

---

## Memory Architecture

Each agent maintains **individual long-term memory** across runs — they remember what worked and what didn't.

### Three layers:

```
┌─────────────────────────────────────────────────┐
│  Working Memory (ContextManager)                │
│  Current run's shared log — all agents read it  │
│  Pinned entries (dataset summary) never trimmed  │
└─────────────────────────────────────────────────┘
           ↓ stored after each step
┌─────────────────────────────────────────────────┐
│  Long-term Memory (ChromaDB)                    │
│  Per-agent vector store — semantic recall       │
│  Expired facts filtered out automatically       │
│  Persists to: experiments/chroma_db/            │
└─────────────────────────────────────────────────┘
           ↓ indexed for lineage
┌─────────────────────────────────────────────────┐
│  Knowledge Graph (SQLite)                       │
│  Nodes = agent steps, Edges = relationships     │
│  Edge types: INFORMED_BY / RETRY_OF /           │
│              FAILURE_LED_TO / CROSS_RUN         │
│  Persists to: experiments/graph.db              │
└─────────────────────────────────────────────────┘
```

### Temporal Memory (key feature)
When a training run **fails**, all memories from that run are marked `expired`. Future recall queries automatically filter them out. The CodeWriter will never suggest a previously failed approach again.

### Two Recall Modes
- **Top-K recall** — standard similarity search (fast, used by most agents)
- **Insight Forge** — LLM decomposes the task into 3-4 sub-questions, runs parallel searches per sub-question, aggregates results (used by Explorer, Feature Engineer, Pragmatist, Optimizer, CodeWriter)

---

## Project Structure

```
hackathon/
├── agents/
│   ├── agent_config.py        # Behavioral profiles (stance, activity, sentiment)
│   ├── base.py                # BaseAgent — memory recall + storage wired in
│   ├── analyst_agents.py      # Explorer, Skeptic, Statistician, Ethicist
│   ├── planner_agents.py      # Pragmatist, DevilAdvocate, Architect, Optimizer
│   ├── coder_agent.py         # CodeWriter — generates executable Python
│   └── storyteller_agent.py
│
├── memory/
│   ├── context_manager.py     # Working memory for the current run
│   ├── vector_store.py        # ChromaDB wrapper with temporal expiry
│   ├── graph_store.py         # SQLite knowledge graph (nodes + edges)
│   └── agent_memory.py        # Per-agent recall/remember + insight_forge
│
├── execution/
│   ├── executor.py            # Runs generated code in subprocess, captures output
│   └── result_parser.py       # Parses METRICS: {...}, classifies error types
│
├── orchestration/
│   └── orchestrator.py        # Routes tasks, manages memory, drives retry loop
│
├── backends/
│   └── llm_backends.py        # Claude / OpenAI / local vLLM
│
├── prompts/
│   ├── analyst_prompts.py
│   ├── planner_prompts.py
│   ├── coder_prompts.py
│   └── orchestrator_prompt.py
│
├── experiments/               # Auto-created — stores scripts, context, DB files
├── main.py
└── requirements.txt
```

---

## Setup

```bash
git clone <repo>
cd hackathon
pip install -r requirements.txt
```

Set your API key:
```bash
export ANTHROPIC_API_KEY=your_key_here
# or
export OPENAI_API_KEY=your_key_here
```

---

## Usage

### Advisory only (no code execution)

```bash
# Fixed 7-round pipeline
python main.py --dataset data.csv --provider claude --mode manual

# Orchestrator LLM decides each step
python main.py --dataset data.csv --provider claude --mode auto
```

### Full autonomous training loop

```bash
# Analyze → generate code → execute → retry on failure
python main.py --dataset data.csv --provider claude --mode train --target price

# With options
python main.py \
  --dataset    data.csv \
  --provider   claude \
  --mode       train \
  --target     SalePrice \
  --retries    4 \
  --save-log

# Disable long-term memory (useful for first test)
python main.py --dataset data.csv --provider claude --mode train --no-memory
```

### Other LLM backends

```bash
# OpenAI
python main.py --dataset data.csv --provider openai --model gpt-4o-mini --mode train

# Local vLLM server
python main.py --dataset data.csv --provider local --base-url http://localhost:8000/v1 --mode train
```

---

## CLI Arguments

| Argument | Default | Description |
|---|---|---|
| `--dataset` | required | Path to CSV file |
| `--provider` | `claude` | LLM provider: `claude`, `openai`, `local` |
| `--model` | provider default | Model name override |
| `--base-url` | — | Base URL for local vLLM server |
| `--mode` | `manual` | Pipeline mode: `manual`, `auto`, `train` |
| `--target` | — | Target column name (train mode) |
| `--retries` | `4` | Max training retry attempts |
| `--no-memory` | off | Disable ChromaDB long-term memory |
| `--save-log` | off | Save context log to JSON |

---

## Training Loop Detail

```
Phase 1 — Analysis (parallel)
  Explorer + Skeptic + Statistician run simultaneously
  → Feature Engineer
  → Pragmatist (modeling plan)

Phase 2 — Training Loop (up to --retries attempts)
  CodeWriter generates Python script
  → Executor runs it in subprocess (5 min timeout)
  → If SUCCESS: break → Phase 3
  → If FAIL:
      Expire memories from failed run (temporal memory)
      Devil's Advocate proposes different approach
      Pragmatist revises plan
      New run_id assigned
      Loop back to CodeWriter

Phase 3 — Finalize
  Storyteller summarizes everything
  Context saved to experiments/context_{run_id}.json
  Graph stats printed
```

### Generated Script Contract

The CodeWriter produces scripts that follow this contract:
- Print metrics as: `METRICS: {"accuracy": 0.95, "f1": 0.94}`
- Save model to `trained_model.pkl`
- Exit `0` on success, `1` on failure

---

## Agent Behavioral Profiles

Agents have more than a system prompt — they have a behavioral config that shapes how they respond:

```python
# Example: Skeptic is maximally critical
AgentConfig(
    activity_level = 0.7,
    stance         = "opposing",    # actively pushes back
    sentiment_bias = -0.7,          # frames everything negatively
)

# Explorer is thorough and constructive
AgentConfig(
    activity_level    = 0.9,        # exhaustive responses
    stance            = "supportive",
    sentiment_bias    = 0.6,
    use_insight_forge = True,       # multi-query memory recall
)
```

These are injected as `BEHAVIORAL PARAMETERS` into each agent's system prompt at runtime.

---

## Experiments Directory

After running, `experiments/` will contain:

```
experiments/
├── chroma_db/              # Per-agent ChromaDB collections (persists across runs)
├── graph.db                # SQLite knowledge graph
├── train_attempt_1.py      # Generated training scripts
├── train_attempt_2.py
└── context_{run_id}.json   # Full context log for each run
```
