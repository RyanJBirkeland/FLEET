# Agent Manager

Pipeline agent lifecycle orchestration — drain loop, worktree management, watchdog, completion handling.
Source: `src/main/agent-manager/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `prompt-sections.ts` | Shared prompt section builders and constants used by all agent prompt builders | `CODING_AGENT_PREAMBLE`, `SPEC_DRAFTING_PREAMBLE`, `buildPersonalitySection`, `buildUpstreamContextSection`, `buildCrossRepoContractSection`, `buildBranchAppendix`, `buildRetryContext`, `buildScratchpadSection`, `truncateSpec` |
| `prompt-pipeline.ts` | Pipeline agent prompt builder | `buildPipelinePrompt`, `classifyTask`, `TaskClass` |
| `prompt-assistant.ts` | Assistant and adhoc agent prompt builder | `buildAssistantPrompt` |
| `prompt-synthesizer.ts` | Synthesizer agent prompt builder (single-turn spec generation) | `buildSynthesizerPrompt` |
| `prompt-copilot.ts` | Copilot agent prompt builder (interactive spec drafting) | `buildCopilotPrompt` |
| `prompt-composer.ts` | Central dispatcher — routes `BuildPromptInput` to per-agent builders | `buildAgentPrompt`, `BuildPromptInput`, `AgentType` |
| `prompt-constants.ts` | Truncation limits for all prompt builders | `PROMPT_TRUNCATION` |
