# City Hustle: Lagos

A small 3D life-sim set in a stylised Lagos, built with three.js for start.ng. Plain static files, no build step.

## How to play
- Move with **WASD / arrow keys**, or tap/click the ground.
- Walk up to a building and press **E** (or the button that appears).
- Keep the six needs (hunger, energy, fun, social, hygiene, bladder) up. Low hunger or energy blocks work.
- **Yaba Tech Hub**: work a shift. **Mama Put Buka**: eat. **Home**: rest and freshen up. **Beach Club**: fun and gist. **Balogun Market**: a risky trade.
- Rent (₦15,000) is taken every Saturday at 9 AM Lagos time. The clock is real Lagos time and the sky follows it.
- Daily goals, a daily streak, levels (shifts pay more) and random events (go-slow, NEPA, gist) keep each session different.
- Score = total ₦ earned. Your best score and a top-10 board (🏆) are kept in `localStorage`, per user id (guests share one `guest` entry). They are stored on this device only.

## Run it
It is a folder of static files; `index.html` is at the top and all paths are relative.
- **Quick look (guest only):** `python3 -m http.server 8000` in this folder, open http://localhost:8000. Sign-in is off because the page is not on start.ng.
- **On start.ng:** upload the folder; it is served at `<folder-name>.start.ng`.
- **Local start.ng test:** follow the start.ng Worker steps (`wrangler.local.toml`, `r2 object put ... --local`), then open `http://<folder-name>.start.localhost:8787` with start.ng running at `http://start.localhost:5173`.
three.js 0.160.0 loads from jsDelivr through an import map in `index.html`, so the browser needs internet access.

## How it uses start.ng
All of it lives in `src/platform.js` (exports `START_NG`, `getCurrentUser()`, `onUserChange(fn)`, `signIn()`). The game asks a hidden `start.ng/connect` iframe who is signed in (`startng:whoami` → `startng:user`), checking origin, source window and request id, with a 3 s timeout. It never sees tokens or emails. It re-checks when the tab regains focus or becomes visible.
- Signed in: greets the player by name and applies their style.
- Signed out: "Sign in with start.ng" (returns to the game afterwards) or "Play as guest".
- Not on start.ng: guest only, with a note.

**Style mapping** (`normStyle` / `applyStyle` in `src/game.js`; unknown or missing values fall back to defaults):
- `primaryColor` → outfit, and the game UI accent
- `secondaryColor` → sash, hat, scarf and backpack colour, and the button colour
- `skinColor` → skin
- `hat`: none / cap / beanie / tophat / crown
- `accessory`: none / glasses / scarf / backpack

Other players in the same browser are drawn with their own style.

## Known limits
- Other players only appear across tabs of the same browser (BroadcastChannel). A real multiplayer backend is a next step.
- Progress and scores are local to the device.
