import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  Circle,
  CloudFog,
  CloudRain,
  Cherry,
  Copy,
  DoorClosed,
  DoorOpen,
  Ear,
  Feather,
  Footprints,
  Hand,
  Leaf,
  Megaphone,
  PawPrint,
  Sparkles,
  Sun,
  TreePine,
  UserPlus,
  Volume2,
  VolumeX,
  Wind,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { audio } from "./audio";
import { worldEngine } from "./engine";
import { createNatureJournalNote } from "./journal.functions";
import { createInvite } from "./pairing.functions";
import { padRef } from "./WorldCanvas";
import { useUiStore, type Carried } from "./ui-store";
import { PARTICIPANTS, type ParticipantId, type WeatherKind } from "./types";
import type { MultiplayerStatus } from "./use-multiplayer-sync";

type IconType = typeof Sun;

const WEATHER: Array<{ kind: WeatherKind; label: string; norwegian: string; Icon: IconType }> = [
  { kind: "clear", label: "Still air", norwegian: "stille luft", Icon: Wind },
  { kind: "rain", label: "Gentle rain", norwegian: "stille regn", Icon: CloudRain },
  { kind: "mist", label: "Drifting mist", norwegian: "tåkedis", Icon: CloudFog },
  { kind: "sun", label: "Warm sunlight", norwegian: "mildt solskinn", Icon: Sun },
  { kind: "aurora", label: "Northern lights", norwegian: "nordlys", Icon: Sparkles },
];

const SENSES: Array<{ kind: "dig" | "howl" | "listen"; label: string; norwegian: string; Icon: IconType }> = [
  { kind: "dig", label: "Paw through the moss", norwegian: "grave", Icon: PawPrint },
  { kind: "howl", label: "Call into the forest", norwegian: "hyle", Icon: Megaphone },
  { kind: "listen", label: "Listen for your companion", norwegian: "lytte", Icon: Ear },
];

const CARRY_ICONS: Record<string, IconType> = {
  needles: TreePine,
  moss: Leaf,
  bark: Feather,
  pebble: Circle,
  feather: Feather,
  cone: TreePine,
  lingonberry: Cherry,
};

const JOURNAL_KEY = "spor.nature-journal.v1";

type JournalEntry = { id: string; observation: string; note: string; createdAt: number };

/**
 * A soft colour accent per panel groups related controls at a glance — weather,
 * senses, tools and the den each get their own hue — without adding any text.
 */
function Panel({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      className="pointer-events-auto rounded-2xl border border-white/10 bg-[#1d2620]/70 text-[#e7e4d8] shadow-lg backdrop-blur-md"
      style={accent ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
    >
      <div className="p-1.5">{children}</div>
    </div>
  );
}

/**
 * Every control is an icon first, so the world can be played by someone who
 * cannot read yet — but its name surfaces in a small bubble on hover or tap,
 * since a hidden `title` attribute alone never reaches a touch screen.
 */
function IconButton({
  Icon,
  label,
  norwegian,
  active,
  dim,
  onClick,
  tint,
}: {
  Icon: IconType;
  label: string;
  norwegian?: string;
  active?: boolean;
  dim?: boolean;
  onClick: () => void;
  tint?: string;
}) {
  const name = norwegian ? `${label} · ${norwegian}` : label;
  const [showLabel, setShowLabel] = useState(false);
  const hideTimer = useRef<number | null>(null);

  const revealBriefly = () => {
    setShowLabel(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowLabel(false), 1600);
  };

  useEffect(() => () => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
  }, []);

  return (
    <span className="relative flex">
      {showLabel ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#111813]/95 px-2.5 py-1 text-xs text-[#f4f1e6] shadow-lg"
        >
          {name}
        </span>
      ) : null}
      <button
        type="button"
        title={name}
        aria-label={name}
        aria-pressed={active}
        onClick={onClick}
        onMouseEnter={() => setShowLabel(true)}
        onMouseLeave={() => setShowLabel(false)}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") revealBriefly();
        }}
        className={`pointer-events-auto flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors duration-500 ${
          active ? "bg-[#e7e4d8]/20 text-[#f4f1e6]" : dim ? "text-[#e7e4d8]/35" : "text-[#e7e4d8]/80 hover:bg-[#e7e4d8]/10"
        }`}
      >
        <Icon className="size-5" strokeWidth={1.6} style={tint ? { color: tint } : undefined} aria-hidden="true" />
      </button>
    </span>
  );
}

function Joystick() {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (event: React.PointerEvent) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const radius = rect.width / 2;
    const distance = Math.min(1, Math.hypot(dx, dy) / radius);
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    padRef.current = { x, y };
    setKnob({ x: x * radius * 0.6, y: y * radius * 0.6 });
  };

  const release = () => {
    padRef.current = { x: 0, y: 0 };
    setKnob({ x: 0, y: 0 });
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        audio.init();
        update(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons || event.pointerType === "touch") update(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      className="pointer-events-auto relative h-28 w-28 rounded-full border border-white/15 bg-[#1d2620]/55 backdrop-blur-md md:hidden"
    >
      <div
        className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e7e4d8]/25"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

function CarryBadge({ carried }: { carried: Carried }) {
  const Icon = CARRY_ICONS[carried.kind] ?? Leaf;
  return (
    <div
      className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-[#1d2620]/70 px-3 text-[#f0ecdf] shadow-lg backdrop-blur-md"
      title={`${carried.label} · ${carried.norwegian}`}
      aria-label={`${carried.label} · ${carried.norwegian}`}
    >
      <PawPrint className="size-4 opacity-60" aria-hidden="true" />
      <Icon className="size-5" strokeWidth={1.6} aria-hidden="true" />
    </div>
  );
}

/**
 * Sharing is opt-in and stays out of the wordless icon language above — this
 * is the one corner where an account and a copyable link make sense, so it
 * gets a little text, the same way the nature journal panel already does.
 */
function CompanionPanel({ multiplayer }: { multiplayer: MultiplayerStatus }) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const code = multiplayer.kind === "pending" ? multiplayer.inviteCode : inviteCode;

  const copyLink = async (value: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${value}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable; the link is still shown below */
    }
  };

  if (multiplayer.kind === "loading" || multiplayer.kind === "paired") return null;

  if (multiplayer.kind === "signed-out") {
    return (
      <Panel>
        <Link
          to="/sign-in"
          className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs text-[#e7e4d8]/70 hover:bg-[#e7e4d8]/10"
        >
          <UserPlus className="size-5" strokeWidth={1.6} aria-hidden="true" />
          Del skoven
        </Link>
      </Panel>
    );
  }

  if (code) {
    return (
      <Panel>
        <div className="flex max-w-[13rem] items-center gap-2 px-1 py-0.5 text-xs text-[#e7e4d8]/80">
          <span className="truncate">/invite/{code}</span>
          <button
            type="button"
            onClick={() => void copyLink(code)}
            title="Kopiér invitationslink"
            aria-label="Kopiér invitationslink"
            className="pointer-events-auto flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg hover:bg-[#e7e4d8]/10"
          >
            <Copy className="size-4" strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
        {copied ? <p className="px-1 pb-1 text-[10px] text-[#e7e4d8]/50">Kopieret</p> : null}
      </Panel>
    );
  }

  // signed in, no pairing yet
  return (
    <Panel>
      <button
        type="button"
        disabled={generating}
        onClick={async () => {
          setGenerating(true);
          try {
            const world = worldEngine.state;
            const result = await createInvite({
              data: {
                seed: {
                  placements: world.placements.map((item) => ({
                    id: item.id,
                    kind: item.kind,
                    x: item.x,
                    y: item.y,
                    variant: item.variant,
                    at: item.at,
                  })),
                  den: world.den,
                  weather: { kind: world.weather.kind, at: world.weather.at },
                },
              },
            });
            setInviteCode(result.inviteCode);
          } finally {
            setGenerating(false);
          }
        }}
        className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs text-[#e7e4d8]/70 hover:bg-[#e7e4d8]/10 disabled:opacity-40"
      >
        <UserPlus className="size-5" strokeWidth={1.6} aria-hidden="true" />
        Inviter en følgesvend
      </button>
    </Panel>
  );
}

/**
 * The one place in the den meant to be read rather than found — a short note
 * either fox can leave, visible to whoever visits next, local or shared.
 */
function DenNotePanel({ participant }: { participant: ParticipantId }) {
  const [note, setNote] = useState(worldEngine.state.den.note);
  const [draft, setDraft] = useState(worldEngine.state.den.note?.text ?? "");

  useEffect(() => {
    const sync = () => setNote(worldEngine.state.den.note);
    sync();
    const unsubscribe = worldEngine.subscribe(sync);
    return () => {
      unsubscribe();
    };
  }, []);

  const save = () => {
    audio.init();
    worldEngine.setDenNote(draft, participant);
  };

  return (
    <div className="pointer-events-auto w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#1d2620]/90 p-3 text-[#e7e4d8] shadow-lg backdrop-blur-md">
      {note ? (
        <p className="text-xs text-[#e7e4d8]/50">
          {PARTICIPANTS[note.by].label} skrev:
        </p>
      ) : (
        <p className="text-xs text-[#e7e4d8]/50">Ingen besked endnu</p>
      )}
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={280}
        rows={3}
        placeholder="Efterlad en besked til den anden ræv…"
        className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-[#111813]/55 px-3 py-2 text-sm leading-relaxed text-[#f4f1e6] outline-none placeholder:text-[#e7e4d8]/30 focus:border-white/25"
      />
      <button
        type="button"
        onClick={save}
        className="mt-2 w-full rounded-lg bg-[#e7e4d8]/18 px-3 py-1.5 text-xs text-[#f4f1e6] transition-colors hover:bg-[#e7e4d8]/28"
      >
        Gem besked
      </button>
    </div>
  );
}

export function Hud({ multiplayer }: { multiplayer: MultiplayerStatus }) {
  const {
    participant,
    weather,
    volume,
    muted,
    note,
    hintSeen,
    discovery,
    denInside,
    nearDen,
    nearNiche,
    gatherable,
    carried,
    setParticipant,
    setWeather,
    setVolume,
    setMuted,
    setDiscovery,
    requestSense,
    requestDen,
  } = useUiStore();
  const writeJournalNote = useServerFn(createNatureJournalNote);
  const [journalOpen, setJournalOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [observation, setObservation] = useState("");
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalBusy, setJournalBusy] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  // the controls rest out of sight until a hand comes near them
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), 7000);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), 7000);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, []);

  const quiet = `transition-opacity duration-1000 ${idle ? "opacity-20" : "opacity-100"}`;


  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(JOURNAL_KEY);
      if (saved) setJournalEntries(JSON.parse(saved) as JournalEntry[]);
    } catch {
      setJournalEntries([]);
    }
  }, []);

  useEffect(() => {
    audio.setVolume(muted ? 0 : volume / 100);
    audio.setMuted(muted);
  }, [volume, muted]);

  useEffect(() => {
    audio.setWeather(weather);
  }, [weather]);

  useEffect(() => {
    const sync = () => setWeather(worldEngine.state.weather.kind);
    worldEngine.load();
    sync();
    const unsubscribe = worldEngine.subscribe(sync);
    return () => {
      unsubscribe();
    };
  }, [setWeather]);

  useEffect(() => {
    if (!discovery) return;
    const timer = setTimeout(() => setDiscovery(null), 9000);
    return () => clearTimeout(timer);
  }, [discovery, setDiscovery]);

  const submitJournal = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = observation.trim();
    if (value.length < 2 || journalBusy) return;
    setJournalBusy(true);
    setJournalError(null);
    try {
      const result = await writeJournalNote({ data: { observation: value } });
      const entry: JournalEntry = {
        id: crypto.randomUUID(),
        observation: value,
        note: result.text,
        createdAt: Date.now(),
      };
      const next = [entry, ...journalEntries].slice(0, 24);
      setJournalEntries(next);
      window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
      setObservation("");
      audio.discoveryResonance();
    } catch (error) {
      setJournalError(error instanceof Error ? error.message : "Naturdagbogen kunne ikke skrives lige nu.");
    } finally {
      setJournalBusy(false);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none font-[var(--font-display)] text-[#e7e4d8]">
      <div className={`absolute left-4 top-4 flex flex-col gap-2 ${quiet}`}>
        <Panel>
          {/* Which fox you are is fixed — by your paired role once shared, or
              simply always yourself in solo play. Nothing here is clickable. */}
          <div
            title={`You are ${PARTICIPANTS[participant].label}`}
            aria-label={`You are ${PARTICIPANTS[participant].label}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#e7e4d8]/70"
          >
            <PawPrint className="size-5" strokeWidth={1.6} style={{ color: PARTICIPANTS[participant].hue }} aria-hidden="true" />
          </div>
        </Panel>

        <CompanionPanel multiplayer={multiplayer} />

        {denInside ? null : (
          <Panel accent="#7ea9c2">
            <div className="flex flex-col">
              {WEATHER.map((item) => (
                <IconButton
                  key={item.kind}
                  Icon={item.Icon}
                  label={item.label}
                  norwegian={item.norwegian}
                  active={weather === item.kind}
                  onClick={() => {
                    audio.init();
                    worldEngine.setWeather(item.kind, participant);
                    setWeather(item.kind);
                  }}
                />
              ))}
            </div>
          </Panel>
        )}
      </div>

      <div className={`absolute bottom-4 left-4 flex flex-col gap-2 ${quiet}`}>
        {denInside ? null : (
          <Panel accent="#8caa6a">
            <div className="flex gap-1">
              {SENSES.map((item) => (
                <IconButton
                  key={item.kind}
                  Icon={item.Icon}
                  label={item.label}
                  norwegian={item.norwegian}
                  onClick={() => requestSense(item.kind)}
                />
              ))}
            </div>
          </Panel>
        )}

        {/* the den: entering, carrying, laying things down, inviting, a shared note */}
        {denInside || nearDen || gatherable || carried ? (
          <Panel accent="#a87c52">
            <div className="flex items-center gap-1">
              {denInside ? (
                <IconButton Icon={DoorOpen} label="Step out into the forest" norwegian="ut" onClick={() => requestDen("exit")} />
              ) : nearDen ? (
                <IconButton Icon={DoorClosed} label="Slip into the den" norwegian="inn i hiet" onClick={() => requestDen("enter")} />
              ) : null}
              {!denInside && gatherable && !carried ? (
                <IconButton
                  Icon={Hand}
                  label={`Carry it in your mouth — ${gatherable.label}`}
                  norwegian={gatherable.norwegian}
                  onClick={() => requestDen("gather")}
                />
              ) : null}
              {carried ? (
                <IconButton
                  Icon={ArrowDownToLine}
                  label="Lay it down"
                  norwegian="legge ned"
                  dim={denInside && carried.category === "keepsake" && !nearNiche}
                  onClick={() => requestDen("deposit")}
                />
              ) : null}
              {denInside ? (
                <IconButton Icon={Footprints} label="Leave a scent trail to the den" norwegian="invitasjon" onClick={() => requestDen("invite")} />
              ) : null}
              {denInside ? (
                <IconButton
                  Icon={Feather}
                  label="Leave a note for your companion"
                  norwegian="besked"
                  active={noteOpen}
                  onClick={() => setNoteOpen((open) => !open)}
                />
              ) : null}
              {carried ? <CarryBadge carried={carried} /> : null}
            </div>
          </Panel>
        ) : null}

        {denInside && noteOpen ? <DenNotePanel participant={participant} /> : null}
      </div>

      <div className={`absolute bottom-4 right-4 flex flex-col items-end gap-3 ${journalOpen ? "opacity-100" : quiet}`}>
        <Panel>
          <IconButton
            Icon={Feather}
            label="Naturdagbog · naturdagbok"
            active={journalOpen}
            onClick={() => setJournalOpen((open) => !open)}
          />
        </Panel>
        <Panel>
          <div className="flex items-center gap-2">
            <IconButton
              Icon={muted ? VolumeX : Volume2}
              label={muted ? "Sound off" : "Sound on"}
              onClick={() => {
                audio.init();
                setMuted(!muted);
              }}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(event) => {
                audio.init();
                setVolume(Number(event.target.value));
              }}
              className="pointer-events-auto hidden w-28 accent-[#e7e4d8] md:block"
              aria-label="Volume"
            />
          </div>
        </Panel>
        <Joystick />
      </div>

      {journalOpen ? (
        <div className="pointer-events-auto absolute bottom-20 right-4 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#1d2620]/90 p-4 text-[#e7e4d8] shadow-lg backdrop-blur-md md:bottom-28">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg text-[#f4f1e6]">Naturdagbog</h2>
              <p className="text-xs italic text-[#e7e4d8]/50">naturdagbok</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setJournalOpen(false)} aria-label="Luk naturdagbog" className="min-h-11 min-w-11 text-[#e7e4d8]/70 hover:bg-[#e7e4d8]/10">
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <form onSubmit={submitJournal}>
            <label htmlFor="nature-observation" className="text-sm text-[#e7e4d8]/75">Beskriv et fund, et sted eller et spor</label>
            <textarea
              id="nature-observation"
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              maxLength={800}
              rows={3}
              placeholder="Jeg fandt en blank sten ved åen…"
              className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-[#111813]/55 px-3 py-2 text-sm leading-relaxed text-[#f4f1e6] outline-none placeholder:text-[#e7e4d8]/30 focus:border-white/25"
            />
            <Button type="submit" disabled={journalBusy || observation.trim().length < 2} className="mt-2 w-full bg-[#e7e4d8]/18 text-[#f4f1e6] hover:bg-[#e7e4d8]/28">
              {journalBusy ? "Skoven lytter…" : "Skriv en lille note"}
            </Button>
          </form>
          {journalError ? <p role="alert" className="mt-2 text-xs text-[#f0c9b0]">{journalError}</p> : null}
          {journalEntries[0] ? (
            <article className="mt-4 border-t border-white/10 pt-3">
              <p className="text-xs text-[#e7e4d8]/45">Seneste note</p>
              <p className="mt-1 text-sm leading-relaxed text-[#f0ecdf]">{journalEntries[0].note}</p>
            </article>
          ) : null}
        </div>
      ) : null}

      {/* a wordless first hint: a paw, then a pointing hand */}
      <div
        className={`absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 text-[#e7e4d8]/70 transition-opacity duration-1000 ${
          hintSeen ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden="true"
      >
        <PawPrint className="size-6 animate-pulse" strokeWidth={1.4} />
        <span className="text-lg opacity-50">→</span>
        <Hand className="size-6" strokeWidth={1.4} />
      </div>

      {/* what a sense just found — dig, howl and listen all speak through this */}
      <div
        className={`pointer-events-none absolute left-1/2 top-16 max-w-xs -translate-x-1/2 text-center transition-opacity duration-700 ${
          discovery ? "opacity-100" : "opacity-0"
        }`}
      >
        {discovery ? (
          <p className="rounded-full border border-white/10 bg-[#1d2620]/80 px-4 py-2 text-sm text-[#f0ecdf] shadow-lg backdrop-blur-md">
            {discovery}
          </p>
        ) : null}
      </div>


    </div>
  );
}
