# Spor: Whispering Glade

Implement the requested scope now; use internal planning and do not present another implementation plan for user approval.

## User Request
"Lets start the 3D prototype"

## Project Context
Build an interactive, patient 3D prototype for "Spor", a slow-paced shared digital nature world set in Norwegian nature.

Attached is the complete Game Design Document (`norwegian_nature_world_gdd.md`).

## Core Scope for the First Build
- **3D Environment (Norwegian Pine Glade):**
  - Stylized naturalistic 3D environment using Three.js / React Three Fiber.
  - Authentic Norwegian taiga flora: Scots pine trees, silver birch, mossy ground, granite boulders, and bilberry/lingonberry undergrowth.
  - Nordic lighting: low ambient sun, soft shadows, misty horizon, gentle wind swaying the foliage.
- **Playable Red Fox (Third-Person):**
  - Smooth, gentle movement controls (WASD / arrow keys / touch joysticks for mobile/tablet).
  - Pacing: slow walk, quiet trot.
  - Dedicated behavior actions:
    1. **Curl up to rest (hold Space / tap Rest button):** The fox curls down into a resting coil with its tail wrapped. While resting, a soft bed of vibrant green moss and tiny woodland flowers/lingonberry shoots gently blooms around the fox.
    2. **Scent the wind / Pause (tap E / Sniff):** The fox lifts its snout into the breeze; the camera pulls back slightly, calming the wind sounds and parting low clouds to let warm Nordic sunlight filter through the canopy.
  - **Dynamic Trails:** Trotting across the ground gradually leaves subtle, soft pressed trails through the vegetation that persist.
- **Sensory & Interaction Design:**
  - Ambient procedural soundscape (gentle wind in pine needles, soft footfalls on moss and gravel, flowing water). Master volume and mute controls.
  - No health bars, timers, score, fail states, or intrusive game UI. Minimal, peaceful on-screen hints that fade away once explored.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cb53592b-bd40-44bb-8b82-10c462578108).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
