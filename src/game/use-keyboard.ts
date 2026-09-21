import { useEffect, useRef } from "react";
import { forestAudio } from "./audio";
import { useGameStore } from "./store";

export function useKeyboard() {
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      forestAudio.init();
      keys.current.add(event.code);
      if (event.code === "KeyE" && !event.repeat) useGameStore.getState().requestSniff();
      if (event.code === "Space") useGameStore.getState().setRestHeld(true);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        useGameStore.getState().markExplored();
      }
    };
    const onUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
      if (event.code === "Space") useGameStore.getState().setRestHeld(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  return keys;
}