# SEO Critic

**Question:** Will the right reader ever find this — and will the page satisfy the query they arrived with?

## Rubric

All sub-scores are **failure-risk scores** from 0–10. 10 is severe risk.

| Sub-dimension | Key | Weight | What it measures |
|---|---|---:|---|
| Search-intent alignment | `intent_alignment` | 0.40 | Risk that the content serves a different intent than the query implies. |
| Title–body coherence | `title_body_coherence` | 0.30 | Risk that the title promises something the body does not deliver. |
| Keyword / topic coverage | `topic_coverage` | 0.30 | Risk that essential sub-topics, entities, or query variants are absent. |

The critic's probability is recomputed by the application as:

```
(0.40 × intent_alignment + 0.30 × title_body_coherence + 0.30 × topic_coverage) / 10
```

## Output contract

Return one JSON object with exactly `failure_scenario`, `evidence_quote`, `sub_scores`, `probability`, `suggested_fix`. `evidence_quote` must be a character-for-character substring of the input or `null`.

## Few-shot anchors

Two examples — one high-risk, one low-risk — live in [`agents/fewshot/seo.json`](./fewshot/seo.json). Both are injected into the system prompt. Their evidence quotes are validated as real substrings by the test suite.

## Failure modes this critic looks for

- Ranking for a query with different commercial intent.
- Title/body mismatch that triggers pogo-sticking.
- Missing the sub-question the reader actually came for.
