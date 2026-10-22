# Demo video — 60 seconds

The recorded deliverable is checked in at `demo/artifacts/the-pessimist-demo.webm` (1280×720, 60.7s). It was captured against the local deterministic mock provider so no real API key or credit appears. The script below is the reproducible shot list.

The keyless sample at `/demo` is the safest recording path: it needs no API key and no network call. Record a second, optional segment with a real run if you have a key.

## Shot list

| Time | Screen | Action | Caption / voiceover |
|---|---|---|---|
| 0:00–0:05 | `/` hero | Hold on "Assume it fails." | "No one asks how content dies. The Pessimist does." |
| 0:05–0:12 | Composer | Click **Try with sample**; scroll the sample into view. | "Paste the draft. Choose the reader whose patience you are testing." |
| 0:12–0:20 | Settings | Show provider dropdown and the JSON-mode capability badge. | "Bring any model. The wrapper adapts JSON mode to the provider." |
| 0:20–0:27 | Settings | Show stateless-proxy notice and Direct Mode card. | "Your key is encrypted at rest. In proxy mode it is used per request and never stored server-side." |
| 0:27–0:35 | `/demo` | Scroll to the risk meter; open "How this number is made". | "The score is arithmetic — not a model's opinion. Failed critics reduce coverage; they do not become zeros." |
| 0:35–0:45 | `/demo` | Hover a critic card; click a quote's copy icon; show the exact-substring badge. | "Every failure needs a quote that exists in the draft. A hallucinated citation is rejected." |
| 0:45–0:53 | `/demo` | Scroll to the conflict panel; select the compliance fix. | "When two critics disagree, you choose. The rewrite never receives both." |
| 0:53–1:00 | `/demo` footer | Hold on final report; cut to wordmark. | "Assume it fails. Then fix it. The Pessimist." |

## Optional real run (adds 20–40s; keep the final video at 60s by trimming above)

1. In Settings choose OpenRouter, model `z-ai/glm-5.3-flash`, paste a key, test, save.
2. Return home, click **Try with sample**, then **Run pre-mortem**.
3. Show the four progress cards, then the report.
4. Click **Generate rewrite**, show the conflict gate and resolved fix, then the before/after diff.

## Capture notes

- The sample report is deterministic; it renders without an API key.
- The empty state includes both **Try with sample** and **View sample report**.
- Do not display a real API key. Use a disposable key and blur it if entered.
- Export with H.264/AAC, 1080p, 30fps, under 50 MB.
- The checked-in WebM is VP9 at 1280×720 and about 8 MB.
- Store alternate recordings in `demo/artifacts/`.

## Suggested title cards

- Opening: `THE PESSIMIST / Pre-mortem content analysis`
- Mid: `4 critics · exact evidence · deterministic risk`
- Closing: `Assume it fails. Then fix it.`
