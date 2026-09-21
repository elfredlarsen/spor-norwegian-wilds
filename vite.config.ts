// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// The dev devtools plugin injects a `data-tsd-source` prop into every JSX element.
// react-three-fiber rejects unknown dashed props on three.js objects, which crashes
// the 3D scene, so strip the injected prop from the 3D source files.
const stripDevtoolsSourceIn3D = {
  name: "strip-devtools-source-in-3d",
  enforce: "post" as const,
  transform(code: string, id: string) {
    if (!id.includes("/src/game/")) return null;
    if (!code.includes("data-tsd-source")) return null;
    return {
      code: code.replace(/"data-tsd-source":\s*"[^"]*",?\s*/g, ""),
      map: null,
    };
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [stripDevtoolsSourceIn3D],
  },
});
