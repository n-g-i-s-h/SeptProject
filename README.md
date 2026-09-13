# Meridian Atelier

A single-page scrollytelling site: a pinned canvas dissolves between five
procedurally-drawn scenes using a halftone dot effect, driven entirely by
scroll position. No images — every scene is drawn with math in
`src/MeridianAtelier.jsx`.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview   # to check the build locally
```

`npm run build` outputs static files to `dist/`, which you can deploy
anywhere that serves static sites (Netlify, Vercel, GitHub Pages, S3, etc.).

## Where to edit

- `src/MeridianAtelier.jsx` — everything lives here:
  - `SCENES` — the copy (headline/body/CTA) for each of the five scenes.
  - `paintHero`, `paintBotanical`, `paintSky`, `paintCraft`, `paintOutro` —
    the procedural background for each scene. Each takes a point `(u, v)`
    in 0..1 and returns an `[r, g, b]` color.
  - `Stage` — the canvas that reads scroll progress and draws the halftone
    dissolve between the current and next scene.
  - `SceneCopy` — the text overlay that crossfades alongside the dissolve.

To add a scene: add an entry to `SCENES` and a matching `paint*` function,
then add it to the `PAINTERS` array in the same position.

To swap in a real photo instead of a procedural background: load the image
into an offscreen canvas once, call `getImageData`, and replace a `paint*`
function's math with a pixel lookup at `(u * width, v * height)`.
