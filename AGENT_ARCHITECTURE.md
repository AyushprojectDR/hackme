# Agent Architecture Visualizations

## 1. AGENT TEAM STRUCTURE

```
┌────────────────────────────────────────────────────────────────┐
│                     MULTI-AGENT DATA SCIENCE TEAM              │
└────────────────────────────────────────────────────────────────┘

┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   EDA TEAM          │  │  PLANNING TEAM    │  │ EXECUTION TEAM   │
│  (Understanding)    │  │  (Designing)      │  │ (Building)       │
├─────────────────────┤  ├──────────────────┤  ├──────────────────┤
│ 🔍 Explorer         │  │ 📋 Pragmatist     │  │ 💻 CodeWriter    │
│    (Optimistic)     │  │    (Results-foc.) │  │    (Precise)     │
│                     │  │                  │  │                  │
│ ⚠️  Skeptic         │  │ 🚫 Devil's Adv.   │  │ 🏗️  Architect    │
│    (Critical)       │  │    (Contrarian)   │  │    (Systems)     │
│                     │  │                  │  │                  │
│ 📊 Statistician     │  │ ⚙️  Optimizer     │  │ 📖 Storyteller   │
│    (Rigorous)       │  │    (Performance)  │  │    (Narrative)   │
│                     │  │                  │  │                  │
│ ⚖️  Ethicist        │  │                  │  │                  │
│    (Cautious)       │  │                  │  │                  │
└─────────────────────┘  └──────────────────┘  └──────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                         ┌───────▼────────┐
                         │   ORCHESTRATOR │
                         │   (Manager)    │
                         └────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼────┐           ┌─────▼──────┐        ┌───────▼────┐
    │BuilderAg│           │LibraryInst.│        │  Memory    │
    │(creates │           │(auto-fix)  │        │  System    │
    │ tools)  │           │            │        │(learns)   │
    └─────────┘           └────────────┘        └────────────┘
```

---

## 2. AGENT LIFECYCLE (What Happens When An Agent Runs)

```
START
  │
  ├──────────────────────────────────────────────────────────┐
  │                                                          │
  ▼                                                          │
┌──────────────────────────────────┐                        │
│ 1️⃣  RECALL MEMORY               │                        │
│ (Search past experiences)       │                        │
│ • Top-3 similar past runs       │                        │
│ • What worked before?           │                        │
│ • What failed to avoid?         │                        │
│ • Insight Forge: multi-query    │                        │
└──────────────────────────────────┘                        │
  │                                                          │
  ▼                                                          │
┌──────────────────────────────────┐                        │
│ 2️⃣  BUILD CONTEXT               │                        │
│ (Gather current state)          │                        │
│ • Dataset summary (pinned)      │                        │
│ • User goal (pinned)            │                        │
│ • Previous agent outputs        │                        │
│ • Recalled memories             │                        │
│ • Errors to fix (if retry)      │                        │
└──────────────────────────────────┘                        │
  │                                                          │
  ▼                                                          │
┌──────────────────────────────────┐                        │
│ 3️⃣  INJECT PERSONALITY          │                        │
│ (Behavioral config)             │                        │
│ • Activity level (0-1)          │                        │
│ • Stance (opposing/supportive)  │                        │
│ • Sentiment bias (-1 to +1)     │                        │
└──────────────────────────────────┘                        │
  │                                                          │
  ▼                                                          │
┌──────────────────────────────────┐                        │
│ 4️⃣  LLM INFERENCE              │                        │
│ (Agent thinks + responds)       │                        │
│ • Claude processes everything  │                        │
│ • Generates analysis/plan/code │                        │
└──────────────────────────────────┘                        │
  │                                                          │
  ▼                                                          │
┌──────────────────────────────────┐                        │
│ 5️⃣  STORE MEMORY               │                        │
│ (Remember for future)           │                        │
│ • Success/failure tagged        │                        │
│ • Timestamp + temporal decay    │                        │
│ • Add to knowledge graph        │                        │
└──────────────────────────────────┘                        │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

Success? ──YES──┐
                │
                ▼
            [END]

Failed? ──YES──┐
               │
               ▼
        (Retry with error
         context injected)
              back to 2️⃣
```

---

## 3. MEMORY SYSTEM ARCHITECTURE

```
┌────────────────────────────────────────────────────────┐
│              AGENT MEMORY ECOSYSTEM                     │
└────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  LAYER 1: WORKING MEMORY                │
│  (Current Run Only)                     │
├─────────────────────────────────────────┤
│  Timeline of this run:                  │
│                                         │
│  📌 [Pinned] Dataset Summary            │
│  📌 [Pinned] User Goal/Task             │
│  ↓                                      │
│  [1] Explorer: "Found X patterns..."    │
│  [2] Skeptic: "But Y is noisy..."       │
│  [3] Pragmatist: "Let's try Z model..."│
│  [4] CodeWriter: "Generated script..."  │
│  ↓                                      │
│  [Context overflow → compaction]        │
│  (LLM summarizes oldest 60%)            │
│                                         │
│  Token-aware: drops oldest first        │
│  Max capacity: ~6000 tokens             │
└─────────────────────────────────────────┘
            ↓ saved after each step

┌─────────────────────────────────────────┐
│  LAYER 2: LONG-TERM MEMORY              │
│  (ChromaDB - Per Agent)                 │
├─────────────────────────────────────────┤
│  Persistent vector database:            │
│                                         │
│  📊 Run 1 (success):                    │
│     Feature: "Used PCA+XGBoost"         │
│     Score: 0.94 RMSE                    │
│     Temporal decay: 90 days             │
│                                         │
│  ❌ Run 2 (failed):                      │
│     Feature: "Tried deep learning"      │
│     Error: "OOM on GPU"                 │
│     Status: EXPIRED (don't repeat)      │
│     Decay: 3 days then removed          │
│                                         │
│  📊 Run 3 (success):                    │
│     Feature: "Used LightGBM tuning"     │
│     Improvement: +0.02 RMSE             │
│                                         │
│  [Hybrid Search: 55% BM25 + 45% vector] │
│  [MMR re-ranking for diversity]         │
└─────────────────────────────────────────┘
            ↓ indexed for lineage

┌─────────────────────────────────────────┐
│  LAYER 3: KNOWLEDGE GRAPH               │
│  (SQLite - System-wide)                 │
├─────────────────────────────────────────┤
│  Dependency graph of all decisions:     │
│                                         │
│    [Explorer node]                      │
│         │                               │
│         └──INFORMED_BY──> [Skeptic]     │
│                               │         │
│                    ┌──────────┘         │
│                    │                    │
│              INFORMED_BY                │
│                    │                    │
│                    ▼                    │
│           [Pragmatist node]             │
│                    │                    │
│        ┌───────────┼───────────┐        │
│        │           │           │        │
│   RETRY_OF  INFORMED_BY  FAILURE_LED_TO│
│        │           │           │        │
│        ▼           ▼           ▼        │
│   [Attempt 2] [CodeWriter] [DevAdv.]   │
│                                         │
│  Edges: INFORMED_BY, RETRY_OF,          │
│         FAILURE_LED_TO, CROSS_RUN       │
└─────────────────────────────────────────┘
```

---

## 4. AGENT INTERACTION FLOW (5 Phases)

```
INPUT: Dataset + Task Description
  │
  ▼
┌─────────────────────────────────────────────────┐
│ PHASE 1: DATA UNDERSTANDING                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  [BuilderAgent] → Inspect dataset               │
│      │                                          │
│      └─→ Is it images/audio/text?               │
│          YES → Write custom tools               │
│          → Spawn specialist agents              │
│          NO → Skip (use standard agents)        │
│                                                 │
│  [Explorer] → Find patterns                     │
│    ↓         (supported by memory)              │
│  [Skeptic] → Attack findings                    │
│    ↓        (opposite stance)                   │
│  [Statistician] → Validate with stats           │
│    ↓            (rigorous checks)               │
│  [Ethicist] → Flag bias/fairness                │
│              (cautious observer)                │
│                                                 │
└─────────────────────────────────────────────────┘
              ↓ all outputs → context
              ↓
┌─────────────────────────────────────────────────┐
│ PHASE 2: MODEL DESIGN                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Feature Engineer] → New features              │
│    ↓                  (insight_forge)           │
│  [Pragmatist] ──────→ Model plan                │
│    ↓                  (which models?)           │
│  [Devil's Advocate] → Challenges plan           │
│    ↓                  (maximally critical)      │
│  [Optimizer] ────────→ Tuning strategy          │
│                      (performance-obsessed)    │
│                                                 │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ PHASE 3: CODE GENERATION (Retry Loop)           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Attempt 1:                                     │
│  [CodeWriter] → Generate script                 │
│    ↓            (uses available tools)          │
│  [Execute] ────→ Run as subprocess              │
│    │                                            │
│    ├─ ImportError?                              │
│    │   → [LibraryInstaller] install pkg         │
│    │   → Re-run SAME script                     │
│    │                                            │
│    └─ Other error?                              │
│        → [Expire memories]                      │
│        → [Devil's Advocate] re-evaluate         │
│        → [Pragmatist] revise plan               │
│        → New run_id                             │
│        → Attempt 2...                           │
│                                                 │
│  Up to 4 total attempts                         │
│                                                 │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ PHASE 4: VALIDATION                             │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Skeptic] ──────→ Find problems                │
│  [Devil's Advocate] → Worst-case scenarios      │
│  [Statistician] ──→ Statistical validity        │
│                                                 │
│  (All agents attack the results)                │
│                                                 │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ PHASE 5: INFERENCE                              │
├─────────────────────────────────────────────────┤
│                                                 │
│  [CodeWriter] ──────→ Inference script          │
│  [Architect] ───────→ Deployment strategy       │
│  [Storyteller] ─────→ Final narrative           │
│                                                 │
│  (Package everything for submission)            │
│                                                 │
└─────────────────────────────────────────────────┘
              ↓
           OUTPUT
```

---

## 5. RETRY MECHANISM (Multi-Layer)

```
┌──────────────────────────────────────────────────────┐
│  FAILURE RECOVERY - 5 LAYERS OF RESILIENCE          │
└──────────────────────────────────────────────────────┘

Error in execution:
  │
  ├─ Layer 1: ImportError?
  │  └─→ [LibraryInstallerAgent]
  │      Detects: "ModuleNotFoundError: torch"
  │      Maps: torch → pytorch
  │      Action: pip install pytorch
  │      Retry: Same script (no outer retry consumed)
  │      Result: ✅ Success or ❌ Still fails → Layer 2
  │
  ├─ Layer 2: Tool Validation Error?
  │  └─→ [ToolValidator]
  │      Stage 1: ast.parse() → Syntax error?
  │      Stage 2: compile() → Structural error?
  │      Stage 3: subprocess import → Runtime error?
  │      If fails: LLM fixes + retry validation (up to 3x)
  │
  ├─ Layer 3: Agent Execution Error?
  │  └─→ [Orchestrator.step()]
  │      Error injected into task context
  │      Agent retried with full error visible
  │      Up to 2 retries per agent
  │
  ├─ Layer 4: Training Script Error?
  │  └─→ [CodeExecutor + Error Classification]
  │      Error type: OOM | ImportError | ValueError | timeout | ...
  │      For ImportError: → Layer 1
  │      For other: → Layer 5
  │
  └─ Layer 5: Code Generation Loop (Up to 4 attempts)
     ├─ Attempt 1: [CodeWriter] generates
     │            [Execute] runs
     │            ❌ Fails
     │
     ├─ Attempt 2: [Expire memories] (don't repeat mistake)
     │            [Devil's Advocate] critiques approach
     │            [Pragmatist] redesigns
     │            [CodeWriter] generates new code (fresh run_id)
     │            [Execute] runs
     │            ❌ Fails
     │
     ├─ Attempt 3: Different strategy
     │            [DevAdv] re-critiques
     │            [Pragmatist] new redesign
     │            [CodeWriter] new code
     │            ❌ Fails
     │
     └─ Attempt 4: Last attempt
                  ❌ Gives up
                  Output: "Best attempt: ..." (still useful)

RESULT: Fully autonomous recovery. No human intervention needed.
```

---

## 6. BEHAVIORAL PERSONALITY SPACE

```
                    ┌─── ACTIVITY LEVEL ────┐
                    │  0 = Silent            │
                    │  1 = Extremely verbose │
                    └────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
            ┌───▼──────┐  ┌──▼────┐  ┌────▼──┐
            │ STANCE   │  │AGENT  │  │SENTIMENT
            │PERSONALITY
            ├──────────┤  │CONFIG │  │BIAS
            │Support   │  │       │  │-1: Critical
            │Oppose    │  │       │  │ 0: Neutral
            │Neutral   │  │       │  │+1: Constructive
            │Observer  │  │       │  │
            └──────────┘  └───┬───┘  └────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
    ┌────▼────────┐     ┌──────▼──────┐     ┌───────▼────┐
    │ EXPLORER    │     │ SKEPTIC     │     │ PRAGMATIST │
    ├─────────────┤     ├─────────────┤     ├────────────┤
    │Activity: 0.9│     │Activity: 0.7│     │Activity: 0.8
    │Stance: Supp.│     │Stance: Opp. │     │Stance: Neut.
    │Sentiment:0.6│     │Sentiment:-0.7     │Sentiment: 0
    │Insight:True │     │Insight:False      │Insight:True
    │             │     │             │     │            │
    │ Result:     │     │Result:      │     │Result:     │
    │ Thorough,   │     │ Aggressive, │     │ Balanced,  │
    │ Optimistic, │     │ Critical,   │     │ Action-    │
    │ Constructive│     │ Concise     │     │ oriented   │
    └─────────────┘     └─────────────┘     └────────────┘
```

---

## 7. ORCHESTRATION MODES

```
┌──────────────────────────────────────────────────────┐
│  3 ORCHESTRATION MODES - Pick Your Own Adventure    │
└──────────────────────────────────────────────────────┘

MODE 1: MANUAL
────────────────
User perspective: Advisory only (no code execution)
Agent sequence: FIXED pipeline
  1. Explorer → Find patterns
  2. Skeptic → Find problems
  3. Pragmatist → Propose solution
  4-7. [cycle repeats]
  Last: Storyteller → Final narrative
Status: Read-only analysis

Usage: For understanding data before decision-making


MODE 2: AUTO
──────────────
User perspective: Let LLM decide what to do next
Agent sequence: DYNAMIC (LLM chooses)
  Orchestrator LLM: "Who should go next based on current context?"
  → Could be CodeWriter, could be Devil's Advocate, etc.
  → Each step's output influences next decision
Status: Adaptive analysis


MODE 3: PHASES
─────────────────
User perspective: Full 5-phase pipeline with code execution
Agent sequence: 5 INDEPENDENT PHASES (can re-run individual phase)

  ┌─ Phase 1: Data Understanding
  ├─ Phase 2: Model Design
  ├─ Phase 3: Code Generation (with retry loop)
  ├─ Phase 4: Validation
  └─ Phase 5: Inference

Status: Fully autonomous end-to-end analysis
Benefit: Can re-run from phase 2 if you change model design
```

