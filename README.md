# Stek

A personal fishing app for Groningen: live conditions, a bite score per fish, general tips, a catch log with photos, and badges. There are no spots, maps or shared data. The earlier version with spots is on the `personal-with-spots` branch.

- **Runs as:** a home-screen web app on GitHub Pages. There is no server and no account.
- **Your data:** catches and photos stay on your phone (IndexedDB). Use Settings > Backup to save a copy.
- **Weather:** [Open-Meteo](https://open-meteo.com/) (CC BY 4.0, free for non-commercial use).
- **Rules:** Sportvisunie Veldgids and Kleine Lijst van VISwateren 2026. The VISplanner and your permit always win.

## Files

- `data.js`: species, tips, entry limits, rules
- `engine.js`: scoring, water temperature estimate, learning, badges
- `fish.js`: a silhouette for each fish
- `app.js`, `styles.css`, `index.html`: the app
- `sw.js`, `manifest.webmanifest`: offline use and home-screen install

## Tests

    node test/engine.test.js
    NODE_PATH=$(npm root -g) node test/e2e.js
