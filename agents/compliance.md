# Compliance Critic

**Question:** Which sentence creates legal, regulatory, or trust exposure?

## Rubric

All sub-scores are **failure-risk scores** from 0–10.

| Sub-dimension | Key | Weight | What it measures |
|---|---|---:|---|
| Claim substantiation | `claim_substantiation` | 0.50 | Risk from absolute, comparative, or unproven claims. |
| Jurisdictional risk | `jurisdictional_risk` | 0.30 | Risk from rules that differ across markets (health, finance, privacy). |
| Disclosure adequacy | `disclosure_adequacy` | 0.20 | Risk that material limits, sponsorship, or affiliate relationships are hidden. |

```
(0.50 × claim_substantiation + 0.30 × jurisdictional_risk + 0.20 × disclosure_adequacy) / 10
```

## Output contract

One JSON object with exactly `failure_scenario`, `evidence_quote`, `sub_scores`, `probability`, `suggested_fix`. The quote must be exact or `null`. This critic is weighted most heavily in the overall risk score because its failures are often least reversible.

## Few-shot anchors

See [`agents/fewshot/compliance.json`](./fewshot/compliance.json): a high-risk supplement claim with multiple regulatory failures and a low-risk claim with population data, disclaimer, and affiliate disclosure.

## Failure modes this critic looks for

- Unsubstantiated superlative or outcome claim.
- Regulated advice without qualification.
- Missing material disclosure.
