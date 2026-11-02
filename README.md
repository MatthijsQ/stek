# Stek

A private fishing app for Groningen: live conditions, a bite score per fish, spots within 20 km by bike, a catch log with photos, and badges.

- **Runs as:** a home-screen web app on GitHub Pages. There is no server and no account.
- **Your data:** catches, photos and your own spots stay on your phone (IndexedDB). Use Settings > Backup to save a copy.
- **Weather:** [Open-Meteo](https://open-meteo.com/) (CC BY 4.0, free for non-commercial use).
- **Rules:** Sportvisunie Veldgids and Kleine Lijst van VISwateren 2026. The VISplanner and your permit always win.

## Files

- `data.js`: species, spots, rules
- `engine.js`: scoring, water temperature estimate, learning, badges
- `app.js`, `styles.css`, `index.html`: the app
- `sw.js`, `manifest.webmanifest`: offline use and home-screen install

## Tests

    node test/engine.test.js
    NODE_PATH=$(npm root -g) node test/e2e.js
