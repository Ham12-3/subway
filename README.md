# Lane Runner

A three-lane endless runner in the browser, built as a testbed for
[Jev](https://docs.typesafe.ai/), TypeSafe's decision model. The point is not the
game: it is watching an AI make real decisions under time pressure, and being
able to see exactly why it did what it did.

Two modes are planned:

- **Human mode** — you play with the arrow keys. This works today.
- **Jev mode** — several times a second the game sends Jev a snapshot of the
  track and asks one question: `left`, `right`, `jump`, `roll` or `none`. Jev
  answers with a choice, a probability for every option, and a confidence score.
  Not built yet.

## Status

| Step | What                             | State |
| ---- | -------------------------------- | ----- |
| 1    | Monorepo, config, tooling        | Done  |
| 2    | Simulation, spawner, tests       | Done  |
| 3    | Three.js renderer and Human mode | Done  |
| 4    | Server and Jev mode              | To do |
| 5    | Decision HUD and JSONL logging   | To do |

Nothing here talks to the Jev API yet.

## Running it

Needs Node 22 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. (Once the server exists, this one command will
start both halves.)

### Controls

| Key                | Action          |
| ------------------ | --------------- |
| `←` `→` or `A` `D` | Change lane     |
| `↑` `W` or `Space` | Jump            |
| `↓` or `S`         | Roll            |
| `R`                | Start a new run |

Add `?seed=42` to the URL to play a specific course. The same seed always
generates the same track.

## The rules

You run forward automatically and speed up slowly, from 11 to 24 m/s. Three
kinds of obstacle each force a different decision:

- **Low barrier** (orange) — jump it
- **High barrier** (purple) — roll under it
- **Train** (grey) — neither works; change lane

Coins come in trails down a lane. Score is distance plus coins. Hitting anything
ends the run.

## How it is put together

```
packages/shared/     Types, zod schemas and the config shared by client and server
apps/client/
  src/sim/           The simulation. Pure TypeScript, no Three.js
  src/render/        The renderer. Only reads state, never changes it
  src/input/         Keyboard handling
  src/hud/           On-screen readouts
apps/server/         Node + Express, the only place that will talk to Jev (to do)
```

### Simulation and rendering are kept apart

The simulation is a pure function: `step(state, action, dt)` returns the next
state. It imports nothing from Three.js, and an ESLint rule fails the build if
anyone tries. The renderer is handed a state and draws it; it cannot change a
run. This is what makes the simulation testable without a browser, and what will
let Jev drive exactly the same game a human plays.

### Runs are reproducible

A fixed 60 ticks per second, and a seeded random generator whose state lives
inside the game state rather than in a module variable. So a run is fully
described by its seed plus the list of actions taken, and replaying that gives
back an identical run, tick for tick. There is a test for this.

### The spawner cannot generate an impossible course

The spawner keeps a **corridor**: one lane per row that the player can always
reach and always get past. The rules it follows:

1. The corridor moves at most one lane between rows, so it is always one
   sideways move away.
2. The corridor lane never holds a train, only nothing or a barrier that can be
   jumped or rolled.
3. The corridor never moves into a lane that held a train at the previous row,
   so the sideways move is never blocked part-way.
4. Rows are spaced further apart than the longest jump or roll plus a reaction
   margin, so there is always time to act.

This is checked by a property test that runs a solver over randomly seeded
courses. The solver shares no code with the spawner: it walks every player state
reachable on every tick using the real collision and timing functions, and
reports the first tick where every branch is dead. A negative control (three
trains abreast) proves the solver can actually fail a course.

### All tunable numbers live in one file

`packages/shared/src/config.ts` holds every number the game uses: lane width,
speeds, jump and roll durations, spawn rates, camera placement. Game code reads
from it and never hard-codes a number of its own.

zod validates the config when it loads, including cross-field rules that would
otherwise become silent bugs:

- a barrier must be longer than the distance covered in one tick, or the player
  could pass straight through it
- a train must be shorter than the smallest row gap, or obstacle rows overlap
- the smallest row gap must exceed the longest jump or roll plus a reaction
  margin

### Failures are visible

No silent fallbacks anywhere. A bad seed in the URL stops the game and says so
on screen rather than quietly picking another one. When Jev mode arrives, a
failed API call will pause the game and show the real error with a Retry button;
it will never swap in a scripted bot.

## Tests

```bash
npm test
```

55 tests covering movement, jump and roll timing, every combination of obstacle
and player state, the speed curve, coin collection, replay determinism, and the
spawner's solvability guarantee.

```bash
npm run typecheck
```

```bash
npm run lint
```

TypeScript strict mode, no `any`.

## Jev integration (planned)

The server will be the only place holding the API key. It reads
`TYPESAFE_API_KEY` from `.env` (copy `.env.example`), validated with zod at
startup; a missing key means the server refuses to start and prints what is
missing. Human mode does not need the server at all.

The call is a single Choice question against
[`POST /v1/systemone`](https://docs.typesafe.ai/api):

```json
{
  "model": "jev-latest",
  "state": {
    "current_lane": "middle",
    "player_state": "running",
    "speed_m_per_s": 14.5,
    "lanes": {
      "left": { "obstacles": [{ "type": "train", "time_to_impact_ms": 0 }] },
      "middle": { "obstacles": [{ "type": "low_barrier", "time_to_impact_ms": 380 }] },
      "right": { "obstacles": [] }
    }
  },
  "questions": {
    "action": {
      "type": "choice",
      "instructions": "Pick the one action to take now so the runner does not hit an obstacle.",
      "criteria": {
        "left": "Move one lane left. Does nothing in the left lane.",
        "right": "Move one lane right. Does nothing in the right lane.",
        "jump": "Jump. Passes over a low_barrier. Hits a high_barrier or a train.",
        "roll": "Roll. Passes under a high_barrier. Hits a low_barrier or a train.",
        "none": "Keep running in the current lane."
      }
    }
  }
}
```

The reply carries the chosen option, the full probability distribution and a
confidence score. The plan for acting on it:

- one request in flight at a time
- a reply for a snapshot older than a maximum age is discarded as stale
- the action is taken only if confidence clears a threshold, adjustable with a
  slider; below it the runner does nothing and the HUD says "low confidence".
  That is intended behaviour, not a fallback
- every decision is logged to a JSONL file with its request id, the snapshot,
  the probabilities, the latency, whether it was acted on, and whether the run
  survived the next two seconds

## Artwork

All original. Everything on screen is a plain shape with a flat colour.
