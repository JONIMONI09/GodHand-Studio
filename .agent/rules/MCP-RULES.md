# MCP Tools & Proactive Memory Guidelines (MCP-RULES.md)

**Scope:** Global & GodHand Studio | **Last Updated:** 2026-10-19

## Available MCP Tooling

### 1. Persistent Memory (`persistent-memory-plugin_persistent-memory`)
- **`get_user_profile()`**: Fetches consolidated profile rules, past corrections, and user directives across workspaces.
- **`search_past_memory(query, limit)`**: Executes BM25 semantic and keyword queries across indexed conversation histories.
- **CLI Sync & Consolidation**:
  ```powershell
  python C:\Users\ggjon\.gemini\config\plugins\persistent-memory-plugin\scripts\harness.py update
  python C:\Users\ggjon\.gemini\config\plugins\persistent-memory-plugin\scripts\consolidate.py
  ```

### 2. Sequential Thinking (`sequential-thinking`)
- **`sequentialthinking`**: Structured, multi-step chain-of-thought analysis for complex debugging, architecture planning, and verification.

### 3. CodeGraph Exploration (`codegraph`)
- **`codegraph_explore`**: Semantic code graph navigation for resolving complex symbol call-hierarchies and dynamic dispatches before blind grepping.

---

## Inception Protocol & Synchronization
1. At the start of every task, query `get_user_profile()` and `search_past_memory()`.
2. Proactively capture learnings in `.agent/rules/LEARNING.md`.
3. When requested by the user, trigger `harness.py update` and `consolidate.py` to persist knowledge permanently across all IDE sessions.
