# 3D Hallenplaner MD

Statische GitHub-Pages-Version des 3D-Hallenplaners.

## GitHub Upload

Lade den Inhalt dieses Ordners in ein GitHub-Repository hoch. `index.html` muss im Repository-Root liegen, damit GitHub Pages die Seite direkt starten kann.

Wichtige Dateien und Ordner:

- `index.html` - Einstiegspunkt der Seite
- `app.js` - komplette Planer-Logik
- `app.local.js` - Doppelklick-Fallback fuer lokale `file://`-Starts
- `styles.css` - Layout und Design
- `Assets/` - Logo, UI-Grafiken und Materialbilder
- `models/` - 3D-Modelle, Hallenmodelle, Thumbnails und Manifest
- `models/model-data-chunks.js` und `models/model-data-*.js` - eingebettete GLB-Daten fuer den lokalen Doppelklick-Start
- `.nojekyll` - sorgt dafür, dass GitHub Pages alle Dateien unverändert ausliefert

## GitHub Pages

In GitHub unter `Settings > Pages` als Quelle den Branch mit diesem Ordnerinhalt wählen, normalerweise `main` und `/root`.

Die Seite nutzt Three.js über CDN und lädt alle eigenen Modelle lokal aus `models/`.

Bei einem lokalen Doppelklick auf `index.html` nutzt die Seite automatisch die eingebetteten Modelldaten, weil Chrome direkte GLB-Dateizugriffe ueber `file://` blockieren kann.
