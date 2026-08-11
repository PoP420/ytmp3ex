---
name: kilo-short-reasoning
description: Strictly shortens the reasoning chain of any AI model used by the Kilo agent to reduce token usage, improve response speed, and lessen hallucination in both the model and the Kilo agent itself. Use when you need concise, lower-risk AI outputs and want to constrain reasoning depth.
---

# Kilo Short Reasoning

## Purpose

This skill enforces strictly shortened reasoning chains for any AI model invoked by the Kilo agent. Shorter reasoning reduces the opportunity for the model to fabricate details (hallucinate) and reduces the Kilo agent's own tendency to elaborate unnecessarily or confabulate explanations.

## Core Rules

1. **Trim reasoning before output.** If a model or agent generates intermediate reasoning steps, cut them to the minimum necessary to support the final answer. Never include speculative or unsupported reasoning chains.

2. **Prefer direct answers.** The model or the Kilo agent should answer the user's question directly. Do not produce preamble, self-reflection, or meta-commentary unless explicitly requested.

3. **Cap reasoning depth.** Limit the number of reasoning steps to the smallest count that produces a correct result. If a single step suffices, do not chain multiple steps.

4. **Hallucination guardrail.** After any reasoning step, verify every claim against the provided context or a verified source. If a claim cannot be verified, omit it entirely rather than guessing. Prefer an empty answer over a fabricated one.

5. **Minimize tool-use reasoning.** When the Kilo agent decides which tool to call, use the shortest valid reasoning path. Do not explore alternative tools or strategies unless the primary path fails.

## Reasoning Reduction Pattern

```
Before (long):
  "I think I should probably look at the code to understand what's happening. Let me first check the file structure, then maybe look at the function definition..."

After (short):
  "The function `foo` in `bar.cs` returns null when the input is empty."
```

## Hallucination Mitigation

- **Cite sources.** Every factual claim must reference the specific file, line, or document it comes from.
- **No confidence padding.** Do not add hedging language ("I believe," "probably," "it seems like") that introduces false uncertainty or disguise speculation.
- **Stop on uncertainty.** If the model or agent cannot confirm a fact, state that it is unknown and stop. Do not fill gaps with plausible-sounding but unverified information.
- **Separate fact from inference.** If inference is required, label it explicitly as such and keep it minimal.

## When to Apply

Use this skill whenever the Kilo agent or any integrated model is producing responses that are longer than necessary, contain speculative reasoning, or show signs of hallucination. This skill is especially useful for:

- Code analysis and file-reading tasks
- Command and tool selection
- Answer generation in response to user queries
- Reviewing or summarizing code and configuration

## Constraints

- No reasoning step may exceed 3 sentences.
- Total response reasoning must not exceed the minimum required to be correct.
- No fabricated references, file paths, or function names.
- No speculation presented as fact.