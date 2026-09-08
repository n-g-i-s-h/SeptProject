# Meridian Atelier — Rebuild V7

V7 fixes the stuck artwork transition from V4/V7.

## What changed
- The main animation loop reads the actual scroll position continuously instead of depending on scroll events.
- The background artwork has two real image layers that crossfade while the particle field morphs between them.
- Particles disperse in the middle of each scene transition and reconverge into the next image.
- The particle canvas and image layers share the same composition on the right side.
- Scene text remains isolated so it cannot stack.
- Responsive and reduced-motion support remain included.

## Run
```bash
npm install
npm run dev
```


V7 replaces the layered-image approach with a single particle-rendered artwork. Each image is sampled on a shared normalized grid so particles move from corresponding source cells into target cells. The midpoint is deliberately sparse, creating the visible dissolve/reform seen in the reference direction.
