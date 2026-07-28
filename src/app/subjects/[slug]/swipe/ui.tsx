"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  finishDeck,
  postComment,
  saveCard,
  toggleStar,
  undoCard,
} from "./actions";

export interface Note {
  author: string;
  body: string;
  /** The course the note's author is on (always within your university). */
  course: string;
  sameCourse: boolean;
}

export interface Card {
  id: string;
  topic: string;
  name: string;
  description: string | null;
  targetDepth: string;
  estHours: number | null;
  answered: boolean;
  starred: boolean;
  comments: Note[];
}

type Dir = "yes" | "no" | "say" | "star";
type Depth = "awareness" | "procedural" | "fluency" | "proof";

const DEPTHS: { key: Depth; label: string; level: number }[] = [
  { key: "awareness", label: "Know it", level: 1 },
  { key: "procedural", label: "Apply it", level: 2 },
  { key: "fluency", label: "Master it", level: 3 },
  { key: "proof", label: "Prove it", level: 4 },
];
const DEPTH_LEVEL: Record<string, number> = {
  awareness: 1,
  procedural: 2,
  fluency: 3,
  proof: 4,
};
const DIFF = ["Easy", "Fine", "Manageable", "Tough", "Brutal"];

const REASONS: {
  key: "not_covered" | "not_reached" | "skipped";
  icon: string;
  title: string;
  sub: string;
  gap: boolean;
}[] = [
  {
    key: "not_covered",
    icon: "🚫",
    title: "My course never covered it",
    sub: "The university skipped it — this is a real gap.",
    gap: true,
  },
  {
    key: "not_reached",
    icon: "🕓",
    title: "We haven't reached it yet",
    sub: "Still to come — this won't count against your uni.",
    gap: false,
  },
  {
    key: "skipped",
    icon: "🙈",
    title: "I skipped it for now",
    sub: "It was taught; I just haven't done it.",
    gap: false,
  },
];

const THRESHOLD = 95;

export function SwipeDeck({
  subjectSlug,
  subjectName,
  cards,
  answeredAtStart,
  myCourse,
}: {
  subjectSlug: string;
  subjectName: string;
  cards: Card[];
  answeredAtStart: number;
  /** The signed-in student's course, used to label their own notes. */
  myCourse: string;
}) {
  // Start on the first unanswered card so the deck resumes where you left off.
  const firstUnanswered = Math.max(
    0,
    cards.findIndex((c) => !c.answered),
  );
  const [i, setI] = useState(
    cards.every((c) => c.answered) ? cards.length : firstUnanswered,
  );
  const [done, setDone] = useState(answeredAtStart);
  const [stars, setStars] = useState<Set<string>>(
    () => new Set(cards.filter((c) => c.starred).map((c) => c.id)),
  );
  const [local, setLocal] = useState<Record<string, Card["comments"]>>({});
  const [sheet, setSheet] = useState<null | "yes" | "no" | "say">(null);
  const [diff, setDiff] = useState(3);
  const [depth, setDepth] = useState<Depth | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [, startTransition] = useTransition();

  const card = cards[i];
  const topRef = useRef<HTMLDivElement | null>(null);

  const commentsFor = useCallback(
    (c: Card) => local[c.id] ?? c.comments,
    [local],
  );

  function advance() {
    setHistory((h) => [...h, i]);
    setDone((d) => d + 1);
    setI((n) => n + 1);
    setSheet(null);
    setDiff(3);
    setDepth(null);
    setReason(null);
  }

  function openFor(dir: Dir) {
    if (!card) return;
    if (dir === "star") {
      const next = new Set(stars);
      const on = !next.has(card.id);
      on ? next.add(card.id) : next.delete(card.id);
      setStars(next);
      startTransition(() => {
        void toggleStar({ subjectSlug, subtopicId: card.id, starred: on });
      });
      return;
    }
    if (dir === "say") return setSheet("say");
    setSheet(dir === "yes" ? "yes" : "no");
  }

  function commitYes(withDetail: boolean) {
    if (!card) return;
    const payload = {
      subjectSlug,
      subtopicId: card.id,
      studied: true as const,
      difficulty: withDetail ? diff : null,
      studiedDepth: withDetail ? depth : null,
    };
    startTransition(() => {
      void saveCard(payload);
    });
    advance();
  }
  function commitNo() {
    if (!card || !reason) return;
    startTransition(() => {
      void saveCard({
        subjectSlug,
        subtopicId: card.id,
        studied: false as const,
        reason: reason as "not_covered" | "not_reached" | "skipped",
      });
    });
    advance();
  }
  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setI(prev);
    setDone((d) => Math.max(0, d - 1));
    startTransition(() => {
      void undoCard({ subjectSlug, subtopicId: cards[prev].id });
    });
  }

  // Keyboard: arrows mirror the four gestures.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (sheet || !card) return;
      const map: Record<string, Dir> = {
        ArrowRight: "yes",
        ArrowLeft: "no",
        ArrowUp: "say",
        ArrowDown: "star",
      };
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        openFor(d);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pct = Math.round((done / cards.length) * 100);

  // Where this card sits in the subject's topics — orientation across ~100 cards.
  const topicNames = Array.from(new Set(cards.map((c) => c.topic)));
  const topicIdx = card ? topicNames.indexOf(card.topic) + 1 : 0;
  const topicLeft = card
    ? cards.slice(i).filter((c) => c.topic === card.topic).length
    : 0;

  if (!card) {
    return (
      <DeckDone
        subjectSlug={subjectSlug}
        subjectName={subjectName}
        starCount={stars.size}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-6 pt-4">
        {/* header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/subjects/${subjectSlug}/survey`}
            className="text-xs font-medium text-zinc-500 underline-offset-4 hover:underline"
          >
            ← Exit
          </Link>
          <span className="text-xs font-semibold tabular-nums text-zinc-500">
            {Math.min(done + 1, cards.length)}/{cards.length}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-emerald-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            className="text-xs font-semibold text-zinc-500 disabled:opacity-30"
          >
            ↺ Undo
          </button>
        </div>

        {/* where you are in the subject */}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="rounded-full bg-zinc-200/70 px-2 py-0.5 font-bold tabular-nums dark:bg-zinc-800">
            Topic {topicIdx}/{topicNames.length}
          </span>
          <span className="truncate">{card.topic.replace(/^\d+\.\s*/, "")}</span>
          <span className="ml-auto shrink-0 tabular-nums">
            {topicLeft} left here
          </span>
        </div>

        {/* deck */}
        <div
          ref={topRef}
          className="relative mt-3 h-[23rem] flex-none before:absolute before:-inset-x-6 before:-top-4 before:bottom-6 before:rounded-[2rem] before:bg-gradient-to-b before:from-cyan-500/10 before:to-transparent before:blur-2xl"
        >
          {cards
            .slice(i, i + 3)
            .map((c, idx) => (
              <CardFace
                key={c.id}
                card={c}
                offset={idx}
                starred={stars.has(c.id)}
                commentCount={commentsFor(c).length}
                onSwipe={idx === 0 ? openFor : undefined}
              />
            ))
            .reverse()}
        </div>

        {/* actions */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <ActBtn
            tone="rose"
            label="Didn't study"
            onClick={() => openFor("no")}
            big
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </ActBtn>
          <ActBtn tone="cyan" label="Notes" onClick={() => openFor("say")}>
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.7L3 21l1.9-5A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
          </ActBtn>
          <ActBtn
            tone="amber"
            label="Save"
            onClick={() => openFor("star")}
            filled={stars.has(card.id)}
          >
            <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" />
          </ActBtn>
          <ActBtn
            tone="emerald"
            label="Studied it"
            onClick={() => openFor("yes")}
            big
          >
            <path d="M20 6 9 17l-5-5" />
          </ActBtn>
        </div>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
          Swipe <b className="text-emerald-600 dark:text-emerald-400">right</b>{" "}
          studied · <b className="text-rose-600 dark:text-rose-400">left</b>{" "}
          didn&apos;t ·{" "}
          <b className="text-cyan-700 dark:text-cyan-400">up</b> notes ·{" "}
          <b className="text-amber-600 dark:text-amber-400">down</b> save
        </p>

        <div className="flex-1" />
        <button
          type="button"
          onClick={() => startTransition(() => finishDeck(subjectSlug))}
          className="mt-4 w-full rounded-xl border border-zinc-300 bg-white/70 py-2.5 text-xs font-semibold text-zinc-600 backdrop-blur transition hover:border-cyan-600 hover:text-cyan-700 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300"
        >
          Finish here — save what I&apos;ve done
        </button>
      </div>

      {/* sheets */}
      {sheet && <Scrim onClick={() => setSheet(null)} />}

      <Sheet open={sheet === "yes"}>
        <h3 className="text-lg font-extrabold tracking-tight">
          You studied it 👍
        </h3>
        <p className="mt-1 text-sm text-zinc-500">{card.name}</p>

        <SheetLabel>How hard was it?</SheetLabel>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={diff}
          onChange={(e) => setDiff(Number(e.target.value))}
          className="deck-lever w-full"
          aria-label="Difficulty"
        />
        <div className="flex justify-between text-[11px] text-zinc-500">
          <span>Easy</span>
          <span>Brutal</span>
        </div>
        <p className="mt-1 text-center text-sm font-bold">{DIFF[diff - 1]}</p>

        <SheetLabel>How deep did you go?</SheetLabel>
        <div className="grid grid-cols-4 gap-2">
          {DEPTHS.map((d) => {
            const on = depth === d.key;
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={on}
                onClick={() => setDepth(on ? null : d.key)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition ${
                  on
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                    : "border-zinc-200 dark:border-zinc-700"
                }`}
              >
                <Meter level={d.level} tone={on ? "emerald" : "zinc"} />
                <span className="text-[11px] font-bold">{d.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => commitYes(true)}
          className="mt-5 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500"
        >
          Save &amp; next →
        </button>
        <button
          type="button"
          onClick={() => commitYes(false)}
          className="mt-2 w-full py-1 text-xs font-semibold text-zinc-500"
        >
          Just mark it studied
        </button>
      </Sheet>

      <Sheet open={sheet === "no"}>
        <h3 className="text-lg font-extrabold tracking-tight">
          You haven&apos;t studied it
        </h3>
        <p className="mt-1 text-sm text-zinc-500">{card.name}</p>
        <SheetLabel>Which is it?</SheetLabel>
        <div className="grid gap-2">
          {REASONS.map((r) => {
            const on = reason === r.key;
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={on}
                onClick={() => setReason(r.key)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                  on
                    ? r.gap
                      ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30"
                      : "border-cyan-600 bg-cyan-50 dark:bg-cyan-950/30"
                    : "border-zinc-200 dark:border-zinc-700"
                }`}
              >
                <span className="text-lg leading-tight">{r.icon}</span>
                <span>
                  <span className="block text-[13.5px] font-bold">
                    {r.title}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-zinc-500">
                    {r.sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!reason}
          onClick={commitNo}
          className="mt-5 w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-40"
        >
          Save &amp; next →
        </button>
      </Sheet>

      <Sheet open={sheet === "say"}>
        <NoteSheet
          subjectSlug={subjectSlug}
          card={card}
          comments={commentsFor(card)}
          onPosted={(body) =>
            setLocal((m) => ({
              ...m,
              [card.id]: [
                { author: "You", body, course: myCourse, sameCourse: true },
                ...commentsFor(card),
              ],
            }))
          }
          onClose={() => setSheet(null)}
        />
      </Sheet>

      <style>{`
        @keyframes deckSheetIn{from{transform:translateY(102%)}to{transform:translateY(0)}}
        .deck-sheet-in{animation:deckSheetIn .3s cubic-bezier(.32,.72,0,1) both}
        /* No opacity here: a translucent top card lets the one behind bleed
           through, which looks like a rendering bug. Motion only. */
        @keyframes deckCardIn{from{transform:translateY(18px) scale(.97)}
          to{transform:translateY(0) scale(1)}}
        .deck-card-in{animation:deckCardIn .32s cubic-bezier(.32,.72,0,1) both}
        @media (prefers-reduced-motion:reduce){
          .deck-sheet-in,.deck-card-in{animation:none}}
        .deck-lever{-webkit-appearance:none;appearance:none;height:26px;background:transparent;cursor:pointer}
        .deck-lever::-webkit-slider-runnable-track{height:8px;border-radius:8px;
          background:linear-gradient(90deg,#10b981,#f59e0b 55%,#f43f5e)}
        .deck-lever::-moz-range-track{height:8px;border-radius:8px;
          background:linear-gradient(90deg,#10b981,#f59e0b 55%,#f43f5e)}
        .deck-lever::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;margin-top:-9px;
          border-radius:50%;background:#fff;border:3px solid #18181b;box-shadow:0 2px 6px rgba(0,0,0,.25)}
        .deck-lever::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid #18181b}
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ card */

function CardFace({
  card,
  offset,
  starred,
  commentCount,
  onSwipe,
}: {
  card: Card;
  offset: number;
  starred: boolean;
  commentCount: number;
  onSwipe?: (dir: Dir) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const badges = useRef<Record<Dir, HTMLSpanElement | null>>({
    yes: null,
    no: null,
    say: null,
    star: null,
  });
  const drag = useRef({ on: false, sx: 0, sy: 0, dx: 0, dy: 0 });

  // Peeking cards sit lower and narrower so the stack reads as a real deck.
  const rest = `translateY(${offset * 14}px) scale(${1 - offset * 0.05})`;

  function setBadge(d: Dir, v: number) {
    const el = badges.current[d];
    if (el) el.style.opacity = String(v);
  }
  function clearBadges() {
    (["yes", "no", "say", "star"] as Dir[]).forEach((d) => setBadge(d, 0));
  }

  function down(e: React.PointerEvent) {
    if (!onSwipe) return;
    drag.current = { on: true, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 };
    ref.current?.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.on || !ref.current) return;
    d.dx = e.clientX - d.sx;
    d.dy = e.clientY - d.sy;
    ref.current.style.transition = "none";
    ref.current.style.transform = `translate(${d.dx}px, ${d.dy}px) rotate(${d.dx * 0.055}deg)`;
    const hx = Math.abs(d.dx) > Math.abs(d.dy);
    setBadge("yes", hx && d.dx > 0 ? Math.min(1, d.dx / THRESHOLD) : 0);
    setBadge("no", hx && d.dx < 0 ? Math.min(1, -d.dx / THRESHOLD) : 0);
    setBadge("say", !hx && d.dy < 0 ? Math.min(1, -d.dy / THRESHOLD) : 0);
    setBadge("star", !hx && d.dy > 0 ? Math.min(1, d.dy / THRESHOLD) : 0);
  }
  function up() {
    const d = drag.current;
    if (!d.on || !ref.current) return;
    d.on = false;
    const hx = Math.abs(d.dx) > Math.abs(d.dy);
    let dir: Dir | null = null;
    if (hx && d.dx > THRESHOLD) dir = "yes";
    else if (hx && d.dx < -THRESHOLD) dir = "no";
    else if (!hx && d.dy < -THRESHOLD) dir = "say";
    else if (!hx && d.dy > THRESHOLD) dir = "star";

    ref.current.style.transition =
      "transform .28s cubic-bezier(.32,.72,0,1), opacity .28s";
    if (dir === "yes" || dir === "no") {
      ref.current.style.transform = `translate(${dir === "yes" ? 640 : -640}px, 70px) rotate(${dir === "yes" ? 30 : -30}deg)`;
      ref.current.style.opacity = "0";
    } else {
      ref.current.style.transform = rest;
    }
    clearBadges();
    if (dir) onSwipe?.(dir);
  }

  const level = DEPTH_LEVEL[card.targetDepth] ?? 1;

  return (
    <div
      ref={ref}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{
        transform: rest,
        zIndex: 10 - offset,
        opacity: offset > 1 ? 0.55 : 1,
        touchAction: onSwipe ? "none" : undefined,
        // Cards glide up the stack as the one above is answered. The drag
        // handler overrides this while a finger is down.
        transition: "transform .3s cubic-bezier(.32,.72,0,1), opacity .3s",
      }}
      className={`absolute inset-0 flex select-none flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_18px_44px_-20px_rgba(24,34,52,.35)] dark:border-zinc-800 dark:bg-zinc-900 ${
        onSwipe ? "deck-card-in cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      {/* hairline of colour at the top edge — ties the card to the app */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-cyan-600 via-emerald-500 to-amber-400"
      />
      <Badge ref={(el) => void (badges.current.yes = el)} kind="yes" />
      <Badge ref={(el) => void (badges.current.no = el)} kind="no" />
      <Badge ref={(el) => void (badges.current.say = el)} kind="say" />
      <Badge ref={(el) => void (badges.current.star = el)} kind="star" />

      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-cyan-700 dark:text-cyan-400">
        {card.topic}
      </p>
      <h2 className="mt-2.5 text-[26px] font-extrabold leading-[1.15] tracking-tight text-balance">
        {card.name}
      </h2>
      {card.description && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-500">
          {card.description}
        </p>
      )}

      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 bottom-8 select-none text-[7rem] font-black leading-none text-zinc-900/[0.03] dark:text-white/[0.04]"
      >
        {card.topic.split(".")[0]}
      </span>

      <div className="relative mt-auto flex flex-wrap items-center gap-2 pt-4 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 font-semibold dark:bg-zinc-800">
          <Meter level={level} tone="cyan" />
          {DEPTHS[level - 1].label} · target
        </span>
        {card.estHours != null && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold dark:bg-zinc-800">
            ~{card.estHours}h
          </span>
        )}
        {commentCount > 0 && (
          <span className="rounded-full bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
            💬 {commentCount}
          </span>
        )}
        {starred && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            ★ saved
          </span>
        )}
      </div>
    </div>
  );
}

const BADGE_STYLE: Record<Dir, { text: string; cls: string }> = {
  yes: {
    text: "Studied",
    cls: "left-5 top-5 -rotate-12 border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60",
  },
  no: {
    text: "Didn't",
    cls: "right-5 top-5 rotate-12 border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/60",
  },
  say: {
    text: "Notes",
    cls: "left-1/2 top-5 -translate-x-1/2 border-cyan-600 text-cyan-700 bg-cyan-50 dark:bg-cyan-950/60",
  },
  star: {
    text: "Save",
    cls: "left-1/2 bottom-5 -translate-x-1/2 border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/60",
  },
};

const Badge = function Badge({
  kind,
  ref,
}: {
  kind: Dir;
  ref: (el: HTMLSpanElement | null) => void;
}) {
  const s = BADGE_STYLE[kind];
  return (
    <span
      ref={ref}
      style={{ opacity: 0 }}
      className={`pointer-events-none absolute rounded-xl border-[2.5px] px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wide ${s.cls}`}
    >
      {s.text}
    </span>
  );
};

function Meter({ level, tone }: { level: number; tone: "cyan" | "emerald" | "zinc" }) {
  const on =
    tone === "cyan"
      ? "bg-cyan-600"
      : tone === "emerald"
        ? "bg-emerald-500"
        : "bg-zinc-400";
  return (
    <span className="inline-flex items-end gap-[2px]" aria-hidden>
      {[1, 2, 3, 4].map((x) => (
        <span
          key={x}
          className={`w-[3px] rounded-full ${x <= level ? on : "bg-zinc-300 dark:bg-zinc-600"}`}
          style={{ height: 3 + x * 2 }}
        />
      ))}
    </span>
  );
}

/* --------------------------------------------------------------- controls */

const TONES = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
  cyan: "text-cyan-700 dark:text-cyan-400",
  amber: "text-amber-600 dark:text-amber-400",
};

function ActBtn({
  tone,
  label,
  onClick,
  children,
  big,
  filled,
}: {
  tone: keyof typeof TONES;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  big?: boolean;
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid place-items-center rounded-full border border-zinc-200 bg-white shadow-md transition active:scale-90 dark:border-zinc-700 dark:bg-zinc-900 ${
        big ? "h-14 w-14" : "h-11 w-11"
      } ${TONES[tone]}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={big ? "h-6 w-6" : "h-5 w-5"}
      >
        {children}
      </svg>
    </button>
  );
}

function Scrim({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="fixed inset-0 z-40 bg-zinc-900/45 backdrop-blur-[2px]"
    />
  );
}

/**
 * Bottom sheet. Only mounted while open — so closed sheets never leave stray
 * focusable controls (or duplicate buttons) in the DOM. Slides up on mount.
 */
function Sheet({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="deck-sheet-in fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[86vh] max-w-md overflow-y-auto rounded-t-3xl border-t border-zinc-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-zinc-300 dark:bg-zinc-600" />
      {children}
    </div>
  );
}

function SheetLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-zinc-500">
      {children}
    </p>
  );
}

function NoteSheet({
  subjectSlug,
  card,
  comments,
  onPosted,
  onClose,
}: {
  subjectSlug: string;
  card: Card;
  comments: Note[];
  onPosted: (body: string) => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"course" | "uni">("course");
  const [pending, startTransition] = useTransition();

  // Every note here is already from the student's own university; this only
  // narrows further to their exact course.
  const shown =
    scope === "course" ? comments.filter((c) => c.sameCourse) : comments;

  return (
    <>
      <h3 className="text-lg font-extrabold tracking-tight">Notes on this</h3>
      <p className="mt-1 text-sm text-zinc-500">{card.name}</p>

      <SheetLabel>Your note</SheetLabel>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="e.g. our lecturer only did the easy cases — the exam wanted more."
        className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-cyan-600 dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        type="button"
        disabled={!body.trim() || pending}
        onClick={() => {
          const v = body.trim();
          startTransition(async () => {
            await postComment({ subjectSlug, subtopicId: card.id, body: v });
            onPosted(v);
            setBody("");
          });
        }}
        className="mt-2.5 w-full rounded-xl bg-cyan-800 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:opacity-40"
      >
        {pending ? "Posting…" : "Post note"}
      </button>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-zinc-500">
          From your university
        </p>
        {/* Notes never leave your university; this narrows to your own course. */}
        <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {(["course", "uni"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                scope === s
                  ? "bg-white text-cyan-800 shadow-sm dark:bg-zinc-950 dark:text-cyan-300"
                  : "text-zinc-500"
              }`}
            >
              {s === "course" ? "My course" : "Whole uni"}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-[13px] text-zinc-500">
          {scope === "course" && comments.length > 0
            ? "No notes from your course yet — try “Whole uni”."
            : "No notes yet — yours would be the first."}
        </p>
      ) : (
        <ul>
          {shown.map((c, n) => (
            <li
              key={n}
              className="flex gap-3 border-t border-zinc-100 py-3 dark:border-zinc-800"
            >
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-500 dark:bg-zinc-800">
                {c.author.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] text-zinc-500">
                  {c.author}
                  <span className="mx-1.5 opacity-40">·</span>
                  <span
                    className={
                      c.sameCourse
                        ? "font-semibold text-cyan-700 dark:text-cyan-400"
                        : ""
                    }
                  >
                    {c.course}
                  </span>
                </span>
                <span className="block text-[13px] leading-snug">{c.body}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full py-1.5 text-xs font-semibold text-zinc-500"
      >
        Close
      </button>
    </>
  );
}

function DeckDone({
  subjectSlug,
  subjectName,
  starCount,
}: {
  subjectSlug: string;
  subjectName: string;
  starCount: number;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="text-5xl">🎉</span>
      <h1 className="text-2xl font-extrabold tracking-tight">Deck cleared</h1>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        That&apos;s all of {subjectName}. Your answers feed the coverage map for
        your university and course
        {starCount > 0 ? ` — and you saved ${starCount} to revisit` : ""}.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => finishDeck(subjectSlug))}
        className="w-full rounded-xl bg-cyan-800 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "See my results →"}
      </button>
      <Link
        href={`/subjects/${subjectSlug}/swipe`}
        className="text-xs font-semibold text-zinc-500 underline-offset-4 hover:underline"
      >
        Go through the deck again
      </Link>
    </main>
  );
}
