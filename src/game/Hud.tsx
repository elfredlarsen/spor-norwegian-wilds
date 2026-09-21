import { useEffect, useRef, useState } from "react";
import { Leaf, Volume2, VolumeX, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { forestAudio } from "./audio";
import { useGameStore } from "./store";

function Joystick() {
  const origin = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const setJoystick = useGameStore((state) => state.setJoystick);
  const update = (clientX: number, clientY: number) => {
    const dx = Math.max(-1, Math.min(1, (clientX - origin.current.x) / 42));
    const dy = Math.max(-1, Math.min(1, (clientY - origin.current.y) / 42));
    setKnob({ x: dx * 30, y: dy * 30 });
    setJoystick(dx, dy);
  };
  const end = () => { setKnob({ x: 0, y: 0 }); setJoystick(0, 0); };
  return <div
    aria-label="Move fox"
    className="pointer-events-auto relative h-24 w-24 touch-none rounded-full border border-mist/40 bg-forest/25 shadow-soft backdrop-blur-sm md:hidden"
    onPointerDown={(event) => { origin.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); forestAudio.init(); }}
    onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event.clientX, event.clientY); }}
    onPointerUp={end}
    onPointerCancel={end}
  ><span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-mist/60 bg-moss/65 shadow-soft" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} /></div>;
}

export function Hud() {
  const action = useGameStore((state) => state.action);
  const explored = useGameStore((state) => state.explored);
  const setRestHeld = useGameStore((state) => state.setRestHeld);
  const requestSniff = useGameStore((state) => state.requestSniff);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState([45]);
  const [showVolume, setShowVolume] = useState(false);

  useEffect(() => {
    forestAudio.setVolume((volume[0] ?? 45) / 100);
  }, [volume]);

  const stateLabel = action === "resting" ? "Resting in the moss" : action === "sniffing" ? "Scenting the wind" : "Pine glade · Furuskog";
  return <TooltipProvider delayDuration={300}>
    <div className="pointer-events-none fixed inset-0 z-10 select-none text-mist">
      <div className="absolute left-5 top-5 md:left-8 md:top-7">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-mist/75"><Leaf className="size-3.5" /> Spor</div>
        <p className="mt-1 font-display text-lg text-mist/95">{stateLabel}</p>
      </div>

      <div className={`absolute left-1/2 top-8 -translate-x-1/2 text-center transition-opacity duration-1000 ${explored ? "opacity-0" : "opacity-80"}`}>
        <p className="hidden text-xs tracking-[0.08em] md:block">WASD to wander · Hold Space to rest · E to scent the wind</p>
        <p className="text-xs tracking-[0.08em] md:hidden">Wander gently. Pause when you wish.</p>
      </div>

      <div className="absolute right-5 top-5 flex items-start gap-2 md:right-8 md:top-7">
        {showVolume && <div className="pointer-events-auto mt-1 w-28 rounded-md border border-mist/25 bg-forest/55 px-3 py-3 shadow-soft backdrop-blur-md"><Slider aria-label="Master volume" value={volume} max={100} step={1} onValueChange={(next) => { forestAudio.init(); setVolume(next); }} /></div>}
        <Tooltip><TooltipTrigger asChild><Button aria-label="Adjust volume" variant="ghost" size="icon" className="pointer-events-auto border border-mist/20 bg-forest/35 text-mist hover:bg-forest/55 hover:text-mist" onClick={() => setShowVolume((shown) => !shown)}><Volume2 /></Button></TooltipTrigger><TooltipContent>Volume</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button aria-label={muted ? "Unmute nature sounds" : "Mute nature sounds"} variant="ghost" size="icon" className="pointer-events-auto border border-mist/20 bg-forest/35 text-mist hover:bg-forest/55 hover:text-mist" onClick={() => { forestAudio.init(); const next = !muted; setMuted(next); forestAudio.setMuted(next); }}>{muted ? <VolumeX /> : <Wind />}</Button></TooltipTrigger><TooltipContent>{muted ? "Unmute" : "Mute"}</TooltipContent></Tooltip>
      </div>

      <div className="absolute inset-x-5 bottom-6 flex items-end justify-between md:inset-x-8 md:bottom-8">
        <Joystick />
        <div className="pointer-events-auto ml-auto flex gap-2">
          <Button variant="ghost" className="h-12 border border-mist/25 bg-forest/40 px-4 text-mist shadow-soft backdrop-blur-md hover:bg-forest/60 hover:text-mist" onPointerDown={() => { forestAudio.init(); setRestHeld(true); }} onPointerUp={() => setRestHeld(false)} onPointerLeave={() => setRestHeld(false)} onPointerCancel={() => setRestHeld(false)}><Leaf /> Rest</Button>
          <Button variant="ghost" className="h-12 border border-mist/25 bg-forest/40 px-4 text-mist shadow-soft backdrop-blur-md hover:bg-forest/60 hover:text-mist" onClick={() => { forestAudio.init(); requestSniff(); }}><Wind /> Sniff</Button>
        </div>
      </div>
    </div>
  </TooltipProvider>;
}