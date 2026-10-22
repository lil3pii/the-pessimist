import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function truncate(value: string, max = 140): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Best-effort extraction of a JSON string field from a partial streaming
 * response. Used only for the live preview; the final value always comes from
 * Zod-validated JSON.
 */
export function partialJsonString(raw: string, key: string): string {
  const marker = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:\\s*"`);
  const match = marker.exec(raw);
  if (!match) return "";

  let index = match.index + match[0].length;
  let output = "";
  while (index < raw.length) {
    const char = raw[index];
    if (char === '"') break;
    if (char !== "\\") {
      output += char;
      index += 1;
      continue;
    }
    const next = raw[index + 1];
    if (!next) break;
    if (next === "n") output += "\n";
    else if (next === "t") output += "\t";
    else if (next === "r") output += "\r";
    else if (next === '"') output += '"';
    else if (next === "\\") output += "\\";
    else if (next === "/") output += "/";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next === "u") {
      const hex = raw.slice(index + 2, index + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
      output += String.fromCharCode(Number.parseInt(hex, 16));
      index += 4;
    } else {
      output += next;
    }
    index += 2;
  }
  return output;
}
