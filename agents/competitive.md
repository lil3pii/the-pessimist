# Competitive Critic

**Question:** Why would anyone choose this over the alternative — including doing nothing?

## Rubric

All sub-scores are **failure-risk scores** from 0–10.

| Sub-dimension | Key | Weight | What it measures |
|---|---|---:|---|
| Differentiation | `differentiation` | 0.40 | Risk that the content occupies the same generic position as everyone else. |
| Specificity vs. generic claims | `specificity` | 0.30 | Risk from claims that could describe any product in the category. |
| Evidence of uniqueness | `evidence_uniqueness` | 0.30 | Risk that unique mechanisms, data, or proof points are absent. |

```
(0.40 × differentiation + 0.30 × specificity + 0.30 × evidence_uniqueness) / 10
```

## Output contract

One JSON object with exactly `failure_scenario`, `evidence_quote`, `sub_scores`, `probability`, `suggested_fix`. Quote exactly or return `null`.

## Few-shot anchors

See [`agents/fewshot/competitive.json`](./fewshot/competitive.json): an interchangeable "all-in-one platform" page and a low-risk engineering post with a named mechanism, benchmark, and explicit tradeoff.

## Failure modes this critic looks for

- Interchangeable category copy.
- Features stated without a differentiated mechanism.
- No proof that the alternative is worse.
