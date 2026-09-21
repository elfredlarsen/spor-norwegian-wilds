import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { audio } from "./audio";
import { worldEngine } from "./engine";
import { createNatureJournalNote } from "./journal.functions";
import { padRef } from "./WorldCanvas";
import { useUiStore } from "./ui-store";
import { PARTICIPANTS, type ParticipantId, type PlacementKind, type WeatherKind } from "./types";

const WEATHER: Array<{ kind: WeatherKind; label: string; norwegian: string }> = [
  { kind: "clear", label: "Still air", norwegian: "stille luft" },
  { kind: "rain", label: "Gentle rain", norwegian: "stille regn" },
  { kind: "mist", label: "Drifting mist", norwegian: "tåkedis" },
  { kind: "sun", label: "Warm sunlight", norwegian: "mildt solskinn" },
];

const TOOLS: Array<{ kind: PlacementKind; label: string; norwegian: string }> = [
  { kind: "stone", label: "Place a stone", norwegian: "varde" },
  { kind: "flower", label: "Plant flowers", norwegian: "hvitveis" },
  { kind: "lantern", label: "Light a lantern", norwegian: "lykt" },
  { kind: "berry", label: "Leave glowing berries", norwegian: "glødende bær" },
];

const JOURNAL_KEY = "spor.nature-journal.v1";

type JournalEntry = { id: string; observation: string; note: string; createdAt: number };

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#1d2620]/70 p-2 text-[#e7e4d8] shadow-lg backdrop-blur-md">
      {children}
    </div>
  );
}

function SoftButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-left text-sm transition-colors duration-500 ${
        active ? "bg-[#e7e4d8]/18 text-[#f4f1e6]" : "text-[#e7e4d8]/75 hover:bg-[#e7e4d8]/10"
      }`}
    >
      {children}
    </button>
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

export function Hud() {
  const {
    participant,
    tool,
    weather,
    volume,
    muted,
    note,
    hintSeen,
    discovery,
    nearWater,
    setParticipant,
    setTool,
    setWeather,
    setVolume,
    setMuted,
    setDiscovery,
    requestSense,
  } = useUiStore();
  const lastVisit = useRef<Record<ParticipantId, number>>({ elder: 0, child: 0 });
  const writeJournalNote = useServerFn(createNatureJournalNote);
  const [journalOpen, setJournalOpen] = useState(false);
  const [observation, setObservation] = useState("");
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalBusy, setJournalBusy] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);

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

  const place = () => {
    audio.init();
    const position = worldEngine.position(participant);
    const offset = 26;
    worldEngine.place(
      tool,
      position.x + (Math.random() - 0.5) * offset,
      position.y + offset * 0.8,
      participant,
    );
    audio.placement(tool);
  };

  const switchParticipant = () => {
    audio.init();
    const next: ParticipantId = participant === "elder" ? "child" : "elder";
    const since = lastVisit.current[next];
    const traces = worldEngine.tracesFrom(participant, since);
    lastVisit.current[participant] = Date.now();
    setParticipant(next);
    if (traces.length > 0) {
      audio.discoveryResonance();
      setDiscovery(
        `Something was left here while you were away — ${traces.length} new ${
          traces.length === 1 ? "trace" : "traces"
        } to find.`,
      );
    }
  };

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
      <div className="absolute left-4 top-4 flex flex-col gap-2">
        <Panel>
          <p className="px-2 pb-1 pt-0.5 text-xs uppercase tracking-[0.3em] text-[#e7e4d8]/55">Spor</p>
          <SoftButton onClick={switchParticipant} title="Switch who is walking">
            {PARTICIPANTS[participant].label}
            <span className="block text-xs text-[#e7e4d8]/50">tap to swap companion</span>
          </SoftButton>
        </Panel>

        <Panel>
          <div className="flex flex-col">
            {WEATHER.map((item) => (
              <SoftButton
                key={item.kind}
                active={weather === item.kind}
                onClick={() => {
                  audio.init();
                  worldEngine.setWeather(item.kind, participant);
                  setWeather(item.kind);
                }}
              >
                {item.label}
                <span className="block text-xs italic text-[#e7e4d8]/45">{item.norwegian}</span>
              </SoftButton>
            ))}
          </div>
        </Panel>
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <Panel>
          <div className="grid grid-cols-4 gap-1">
            <SoftButton onClick={() => requestSense("sniff")} title="Scent the air and reveal a faint trail">
              Sniff<span className="block text-xs italic text-[#e7e4d8]/45">snuse</span>
            </SoftButton>
            <SoftButton onClick={() => requestSense("drink")} title="Drink quietly at the stream bank">
              <span className={nearWater ? "text-[#f4f1e6]" : "text-[#e7e4d8]/45"}>Drink</span>
              <span className="block text-xs italic text-[#e7e4d8]/45">drikke</span>
            </SoftButton>
            <SoftButton onClick={() => requestSense("dig")} title="Gently paw through deep moss">
              Paw<span className="block text-xs italic text-[#e7e4d8]/45">grave</span>
            </SoftButton>
            <SoftButton onClick={() => requestSense("rest")} title="Curl up and rest in the moss">
              Rest<span className="block text-xs italic text-[#e7e4d8]/45">hvile</span>
            </SoftButton>
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-col">
            {TOOLS.map((item) => (
              <SoftButton key={item.kind} active={tool === item.kind} onClick={() => setTool(item.kind)}>
                {item.label}
                <span className="block text-xs italic text-[#e7e4d8]/45">{item.norwegian}</span>
              </SoftButton>
            ))}
            <button
              type="button"
              onClick={place}
              className="pointer-events-auto mt-1 rounded-xl bg-[#e7e4d8]/18 px-3 py-2 text-sm text-[#f4f1e6] transition-colors hover:bg-[#e7e4d8]/28"
            >
              Leave it here
            </button>
          </div>
        </Panel>
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-3">
        <Panel>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setJournalOpen((open) => !open)}
            className="pointer-events-auto h-auto text-[#e7e4d8]/80 hover:bg-[#e7e4d8]/10 hover:text-[#f4f1e6]"
          >
            Naturdagbog <span className="text-xs italic opacity-55">naturdagbok</span>
          </Button>
        </Panel>
        <Panel>
          <div className="flex items-center gap-2 px-2 py-1">
            <button
              type="button"
              onClick={() => {
                audio.init();
                setMuted(!muted);
              }}
              className="pointer-events-auto text-sm text-[#e7e4d8]/75"
            >
              {muted ? "Sound off" : "Sound on"}
            </button>
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
            <Button type="button" variant="ghost" size="icon" onClick={() => setJournalOpen(false)} aria-label="Luk naturdagbog" className="text-[#e7e4d8]/70 hover:bg-[#e7e4d8]/10">×</Button>
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

      <div
        className={`absolute left-1/2 top-4 w-64 -translate-x-1/2 text-center text-sm text-[#e7e4d8]/80 transition-opacity duration-1000 md:w-auto ${
          hintSeen ? "opacity-0" : "opacity-100"
        }`}
      >
        Walk with the arrow keys, WASD, the pad — or simply tap where you want to go.
      </div>

      {note ? (
        <div className="absolute bottom-6 left-1/2 w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1d2620]/70 px-4 py-3 text-center text-sm text-[#e7e4d8]/85 shadow-lg backdrop-blur-md transition-opacity duration-700">
          <p className="text-[#f4f1e6]">
            {note.title} <span className="italic text-[#e7e4d8]/60">· {note.norwegian}</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#e7e4d8]/65">{note.note}</p>
        </div>
      ) : null}

      {discovery ? (
        <div className="absolute right-4 top-4 w-44 rounded-2xl border border-white/10 bg-[#1d2620]/70 px-4 py-3 text-center text-sm text-[#f0ecdf] shadow-lg backdrop-blur-md md:left-1/2 md:right-auto md:top-16 md:w-72 md:-translate-x-1/2">
          {discovery}
        </div>
      ) : null}
    </div>
  );
}
