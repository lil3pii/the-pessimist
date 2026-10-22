# Behavioral Critic

**Question:** Where does attention die?

## Rubric

All sub-scores are **failure-risk scores** from 0–10.

| Sub-dimension | Key | Weight | What it measures |
|---|---|---:|---|
| CTA timing vs. awareness | `cta_timing` | 0.40 | Risk that the ask arrives before the reader is ready, or after momentum is lost. |
| Length vs. patience | `length_patience` | 0.30 | Risk that length exceeds the patience the persona brings. |
| Cognitive load | `cognitive_load` | 0.30 | Risk from density, jargon, weak hierarchy, or competing asks. |

```
(0.40 × cta_timing + 0.30 × length_patience + 0.30 × cognitive_load) / 10
```

## Output contract

One JSON object with exactly `failure_scenario`, `evidence_quote`, `sub_scores`, `probability`, `suggested_fix`. Quote exactly or return `null`.

## Few-shot anchors

See [`agents/fewshot/behavioral.json`](./fewshot/behavioral.json): a company-history preamble with a premature waitlist CTA, and a concise value-first page with the ask after proof.

## Failure modes this critic looks for

- Premature CTA before value is established.
- Long preamble before the first useful sentence.
- Too many competing actions in one view.
