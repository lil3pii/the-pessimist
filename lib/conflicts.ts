import type { CriticId, CriticRunMap, FixConflict, FixOption } from "@/lib/types";

type Direction = "increase" | "decrease" | "neutral";

interface TopicRule {
  id: string;
  label: string;
  pattern: RegExp;
}

const TOPIC_RULES: readonly TopicRule[] = [
  {
    id: "claims",
    label: "claims and positioning",
    pattern:
      /claim|promise|guarantee|superlative|benefit|proof|keyword|message|positioning|offer|cure|result|testimonial/i,
  },
  {
    id: "length",
    label: "content length",
    pattern: /length|long|short|trim|concise|word count|expand|compress|verbos|preamble/i,
  },
  {
    id: "cta",
    label: "the call to action",
    pattern: /\bcta\b|call.to.action|button|ask|waitlist|sign.?up|demo request|friction/i,
  },
  {
    id: "evidence",
    label: "evidence and proof",
    pattern: /evidence|data|statistic|source|study|benchmark|cite|proof point|substantiat/i,
  },
  {
    id: "disclosure",
    label: "disclosures",
    pattern: /disclos|disclaimer|affiliate|sponsor|terms|privacy/i,
  },
  {
    id: "tone",
    label: "tone and certainty",
    pattern: /tone|hype|sensational|absolute|hedge|soften|qualify|certainty|urgency/i,
  },
];

const INCREASE = /\b(add|repeat|expand|emphasize|strengthen|include|elaborate|lengthen|more|double|restore|highlight|increase|introduce|insert)\b/i;
const DECREASE = /\b(remove|delete|cut|drop|avoid|eliminate|shorten|trim|reduce|soften|qualify|downplay|stop|strip|compress|de-?emphasize)\b/i;

function directionOf(text: string): Direction {
  const increases = INCREASE.test(text);
  const decreases = DECREASE.test(text);
  if (increases && !decreases) return "increase";
  if (decreases && !increases) return "decrease";
  return "neutral";
}

function topicsOf(text: string): TopicRule[] {
  return TOPIC_RULES.filter((topic) => topic.pattern.test(text));
}

export function detectFixConflicts(runs: CriticRunMap): FixConflict[] {
  const fixes: Array<FixOption & { direction: Direction; topics: TopicRule[] }> = [];
  for (const [critic, run] of Object.entries(runs) as Array<[CriticId, CriticRunMap[CriticId]]>) {
    if (run?.status !== "success") continue;
    const fix = run.result.suggested_fix.trim();
    if (!fix) continue;
    const topics = topicsOf(fix);
    if (topics.length === 0) continue;
    fixes.push({ critic, fix, direction: directionOf(fix), topics });
  }

  const conflicts = new Map<string, FixConflict>();

  for (let leftIndex = 0; leftIndex < fixes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < fixes.length; rightIndex += 1) {
      const left = fixes[leftIndex];
      const right = fixes[rightIndex];
      if (left.critic === right.critic) continue;
      if (left.direction === "neutral" || right.direction === "neutral") continue;
      if (left.direction === right.direction) continue;

      for (const topic of left.topics) {
        if (!right.topics.some((entry) => entry.id === topic.id)) continue;
        const id = `${topic.id}:${[left.critic, right.critic].sort().join("+")}`;
        if (conflicts.has(id)) continue;
        conflicts.set(id, {
          id,
          topic: topic.id,
          title: `Conflicting direction on ${topic.label}`,
          explanation:
            "These fixes pull the same dimension in opposite directions. Apply one now; the app will not silently blend them.",
          options: [left, right].map(({ critic, fix }) => ({ critic, fix })),
        });
      }
    }
  }

  return [...conflicts.values()];
}

/**
 * Builds the exact fix list handed to the rewrite. Conflicted fixes require an
 * explicit critic choice. Every non-conflicting successful fix is included.
 */
export function selectFixes(
  runs: CriticRunMap,
  conflicts: FixConflict[],
  resolutions: Record<string, CriticId | undefined>,
): { fixes: FixOption[]; unresolved: FixConflict[] } {
  const suppressed = new Set<FixOption>();
  const chosen: FixOption[] = [];
  const unresolved: FixConflict[] = [];

  for (const conflict of conflicts) {
    const chosenCritic = resolutions[conflict.id];
    const option = conflict.options.find((entry) => entry.critic === chosenCritic);
    if (!option) {
      unresolved.push(conflict);
      continue;
    }
    for (const candidate of conflict.options) {
      if (candidate.critic !== chosenCritic) suppressed.add(candidate);
    }
    chosen.push(option);
  }

  const extras: FixOption[] = [];
  for (const [critic, run] of Object.entries(runs) as Array<[CriticId, CriticRunMap[CriticId]]>) {
    if (run?.status !== "success") continue;
    const fix = { critic, fix: run.result.suggested_fix.trim() };
    if (!fix.fix) continue;
    if (chosen.some((entry) => entry.critic === critic && entry.fix === fix.fix)) continue;
    if (suppressed.has(fix)) continue;
    if (conflicts.some((conflict) => conflict.options.some((entry) => entry.critic === critic && entry.fix === fix.fix))) {
      continue;
    }
    extras.push(fix);
  }

  return { fixes: [...chosen, ...extras], unresolved };
}
