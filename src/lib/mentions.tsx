import React from "react";
import { Link } from "react-router-dom";

export const MENTION_RE = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{1,24})/g;

export function extractMentionUsernames(text: string): string[] {
  const matches = text.match(MENTION_RE) || [];
  const usernames = matches
    .map((m) => {
      const at = m.lastIndexOf("@");
      return m.slice(at + 1);
    })
    .filter(Boolean)
    .map((u) => u.toLowerCase());

  return [...new Set(usernames)];
}

export function buildMentionMap(
  rows: Array<{ username?: string | null; user_id?: string | null }>
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const r of rows || []) {
    const username = r?.username ? String(r.username).toLowerCase() : "";
    const userId = r?.user_id ? String(r.user_id) : "";
    if (username && userId) next[username] = userId;
  }
  return next;
}

export function renderContentWithMentions(
  text: string,
  mentionMap: Record<string, string>,
  opts?: {
    canRemove?: boolean;
    onRemove?: (username: string) => void;
    className?: string;
    pillTextClassName?: string;
  }
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = new RegExp(MENTION_RE.source, "g");

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const full = match[0];
    const prefix = match[1] || "";
    const username = match[2];
    const atIndex = match.index + prefix.length;

    if (atIndex > lastIndex) parts.push(text.slice(lastIndex, atIndex));
    if (prefix) parts.push(prefix);

    const userId = mentionMap[username.toLowerCase()];
    const isAtStart = atIndex === 0;
    const padClass = isAtStart ? "" : "mx-0.5";

    const pillClass =
      opts?.className ??
      `inline-flex w-fit max-w-full items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[13px] font-semibold text-primary border border-primary/20 hover:bg-primary/25 align-baseline relative group ${padClass}`;
    const pillTextClass = opts?.pillTextClassName ?? "block max-w-full truncate";

    if (!userId) {
      // If we can't resolve, keep plain text (don't remove content).
      parts.push(`@${username}`);
      lastIndex = match.index + full.length;
      continue;
    }

    parts.push(
      <Link key={`${atIndex}-${username}`} to={`/profile/${userId}`} className={pillClass}>
        <span className={pillTextClass}>{username}</span>
        {opts?.canRemove && (
          <>
            <span className="pointer-events-none absolute right-0 top-0 h-full w-6 rounded-r-full bg-gradient-to-l from-primary/10 to-transparent opacity-0 group-hover:opacity-100" />
            <button
              type="button"
              title="Remove tag"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                opts?.onRemove?.(username);
              }}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-[18px] h-[18px] rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-primary/20 z-10"
            >
              <span className="text-[12px] leading-none">×</span>
            </button>
          </>
        )}
      </Link>
    );

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
