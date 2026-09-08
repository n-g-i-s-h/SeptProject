import React, { useCallback, useEffect, useRef, useState } from "react";
import monalisaSrc from "./assets/monalisa.jpg";
import killerduckSrc from "./assets/killerduck.jpg";
import sharkSrc from "./assets/shark.jpg";

const SCENES = [
  { id: "pear", number: "01", kicker: "MERIDIAN ATELIER / 2026", title: "Pear makes you appear.", body: "An editorial visual system where art, type and motion share the same stage.", image: monalisaSrc, theme: "blue" },
  { id: "shape", number: "02", kicker: "OBJECT / FORM", title: "Shape changes the story.", body: "Every scroll reveals a new composition without breaking the rhythm of the page.", image: killerduckSrc, theme: "cream" },
  { id: "depth", number: "03", kicker: "IMAGE / SPACE", title: "Move through the image.", body: "Scale and depth pull the viewer forward while the typography stays deliberately quiet.", image: sharkSrc, theme: "blue-dark" },
  { id: "contrast", number: "04", kicker: "MERIDIAN / CONTRAST", title: "Make the unexpected feel intentional.", body: "A restrained palette gives unusual imagery room to become the visual identity.", image: monalisaSrc, theme: "ink" },
  { id: "end", number: "05", kicker: "MERIDIAN ATELIER", title: "Keep looking.", body: "The experience is built one frame at a time.", image: killerduckSrc, theme: "cream", cta: "Back to beginning" },
];

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const smoothstep = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function Scene({ scene, index, sceneRefs, jumpToScene }) {
  return (
    <article ref={(node) => (sceneRefs.current[index] = node)} className={`scene scene-${scene.theme}`} aria-hidden="true">
      <div className="scene-grid" />
      <div className="scene-topline">
        <span>{scene.kicker}</span>
        <span>{scene.number} / {String(SCENES.length).padStart(2, "0")}</span>
      </div>
      <div className="scene-copy">
        <div className="copy-kicker">Selected work</div>
        <h1>{scene.title}</h1>
        <p>{scene.body}</p>
        {scene.cta && <button className="outline-button" onClick={() => jumpToScene(0)}>{scene.cta}<span>↗</span></button>}
      </div>
      <div className="scene-footer-note">Scroll / drag the page to explore</div>
    </article>
  );
}

function Artwork({ progress, pointer, reducedMotion }) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const mapsRef = useRef([]);
  const imageDataRef = useRef([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const readyRef = useRef(false);
  const rafRef = useRef(0);
  const progressRef = useRef(progress);
  const pointerRef = useRef(pointer);
  const reducedRef = useRef(reducedMotion);

  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { pointerRef.current = pointer; }, [pointer]);
  useEffect(() => { reducedRef.current = reducedMotion; }, [reducedMotion]);

  const seeded = (n) => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const loadImages = useCallback(async () => {
    const images = await Promise.all(SCENES.map(scene => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = scene.image;
    })));
    imageDataRef.current = images;
    readyRef.current = images.some(Boolean);
  }, []);

  useEffect(() => {
    loadImages();
    return () => { readyRef.current = false; };
  }, [loadImages]);

  const buildMaps = useCallback((w, h) => {
    if (!readyRef.current) return;
    const mobile = w < 700;
    const cols = mobile ? 58 : 86;
    const rows = mobile ? 74 : 108;
    const sampleW = cols;
    const sampleH = rows;
    const boxW = Math.min(w * (mobile ? 0.68 : 0.50), mobile ? 520 : 650);
    const boxH = Math.min(h * (mobile ? 0.58 : 0.76), mobile ? 520 : 760);
    const left = w - boxW - w * (mobile ? 0.03 : 0.075);
    const top = (h - boxH) * 0.5;

    mapsRef.current = SCENES.map((scene, sceneIndex) => {
      const image = imageDataRef.current[sceneIndex];
      if (!image) return [];
      const off = document.createElement('canvas');
      off.width = sampleW;
      off.height = sampleH;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      const ir = image.naturalWidth / image.naturalHeight;
      const br = sampleW / sampleH;
      let dw, dh, dx, dy;
      if (ir > br) {
        dh = sampleH; dw = dh * ir; dx = (sampleW - dw) / 2; dy = 0;
      } else {
        dw = sampleW; dh = dw / ir; dx = 0; dy = (sampleH - dh) / 2;
      }
      ctx.drawImage(image, dx, dy, dw, dh);
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
      const points = [];
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const px = Math.min(sampleW - 1, gx);
          const py = Math.min(sampleH - 1, gy);
          const idx = (py * sampleW + px) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3] / 255;
          const seed = seeded((sceneIndex + 1) * 100000 + gy * cols + gx);
          // Keep enough particles in dark areas while avoiding completely empty pixels.
          const luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
          const alpha = a * (0.34 + 0.52 * (0.35 + luminance));
          points.push({
            x: left + (gx / (cols - 1)) * boxW,
            y: top + (gy / (rows - 1)) * boxH,
            r, g, b, alpha,
            seed,
            size: 0.65 + seed * 1.05,
            angle: seed * Math.PI * 2,
            drift: 18 + seed * 70,
          });
        }
      }
      return points;
    });
    sizeRef.current = { w: Math.round(w), h: Math.round(h) };
  }, []);

  const draw = useCallback(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || !readyRef.current) return;
    const rect = root.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw; canvas.height = ch;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      sizeRef.current = { w: 0, h: 0 };
    }
    if (sizeRef.current.w !== Math.round(w) || sizeRef.current.h !== Math.round(h)) buildMaps(w, h);
    const maps = mapsRef.current;
    if (!maps.length) return;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const p = clamp(progressRef.current);
    const scaled = p * (SCENES.length - 1);
    const fromIndex = Math.min(SCENES.length - 2, Math.floor(scaled));
    const local = scaled >= SCENES.length - 1 ? 1 : clamp(scaled - fromIndex);
    const toIndex = Math.min(fromIndex + 1, SCENES.length - 1);
    const from = maps[fromIndex] || [];
    const to = maps[toIndex] || [];
    const count = Math.max(from.length, to.length);
    const ease = easeInOut(local);
    const burst = reducedRef.current ? 0 : Math.sin(Math.PI * local);
    const ptr = pointerRef.current;

    // One particle corresponds to the same normalized image cell in both images.
    // This is the important difference from V6: there is no second image layer
    // underneath. The picture itself is reconstructed entirely from particles.
    for (let i = 0; i < count; i++) {
      const a = from[i];
      const b = to[i];
      if (!a && !b) continue;
      const source = a || b;
      const target = b || a;
      const phase = source.angle + i * 0.017;

      const baseX = source.x + (target.x - source.x) * ease;
      const baseY = source.y + (target.y - source.y) * ease;
      const radialX = Math.cos(phase) * source.drift * burst;
      const radialY = Math.sin(phase * 1.31) * source.drift * 0.78 * burst;
      const mouseX = ptr.x * 14 * Math.sin(phase * 1.7) * burst;
      const mouseY = ptr.y * 10 * Math.cos(phase * 1.2) * burst;
      const x = baseX + radialX + mouseX;
      const y = baseY + radialY + mouseY;

      // Particles disappear around the midpoint, producing a real dissolve
      // rather than two opaque pictures sitting on top of each other.
      const envelope = 0.18 + 0.82 * Math.abs(local - 0.5) * 2;
      const fade = local < 0.5 ? 1 - local * 1.65 : 0.18 + (local - 0.5) * 1.64;
      const colorT = local < 0.5 ? 0 : ease;
      const r = Math.round((a?.r ?? target.r) * (1 - colorT) + (b?.r ?? source.r) * colorT);
      const g = Math.round((a?.g ?? target.g) * (1 - colorT) + (b?.g ?? source.g) * colorT);
      const bl = Math.round((a?.b ?? target.b) * (1 - colorT) + (b?.b ?? source.b) * colorT);
      const alpha = Math.max(0, (a?.alpha ?? b?.alpha ?? 0.5) * fade * envelope * (0.78 + (b?.alpha ?? 0.5) * 0.32));
      const size = source.size * (1 + burst * 0.55);

      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${bl},${alpha.toFixed(3)})`;
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [buildMaps]);

  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    const resize = () => { sizeRef.current = { w: 0, h: 0 }; };
    window.addEventListener('resize', resize);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [draw]);

  return (
    <div ref={rootRef} className="artwork-stage">
      <canvas ref={canvasRef} className="particle-art" aria-hidden="true" />
    </div>
  );
}

export default function MeridianAtelier() {
  const storyRef = useRef(null);
  const sceneRefs = useRef([]);
  const rafRef = useRef(0);
  const targetProgress = useRef(0);
  const currentProgress = useRef(0);
  const pointerTarget = useRef({ x: 0, y: 0 });
  const pointerCurrent = useRef({ x: 0, y: 0 });
  const [renderState, setRenderState] = useState({ progress: 0, pointer: { x: 0, y: 0 } });
  const [activeScene, setActiveScene] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const getProgress = useCallback(() => {
    const el = storyRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const travel = Math.max(1, el.offsetHeight - window.innerHeight);
    return clamp(-rect.top / travel);
  }, []);

  const animate = useCallback(() => {
    // Read the real scroll position every frame. This avoids relying on a
    // scroll event to drive the artwork and fixes the previous stuck state.
    targetProgress.current = getProgress();
    const target = targetProgress.current;
    currentProgress.current = reducedMotion ? target : currentProgress.current + (target - currentProgress.current) * 0.12;
    pointerCurrent.current.x += (pointerTarget.current.x - pointerCurrent.current.x) * 0.09;
    pointerCurrent.current.y += (pointerTarget.current.y - pointerCurrent.current.y) * 0.09;
    const p = currentProgress.current;
    const scaled = p * (SCENES.length - 1);
    const next = clamp(Math.round(scaled), 0, SCENES.length - 1);
    setActiveScene(old => old === next ? old : next);
    setRenderState({ progress: p, pointer: { ...pointerCurrent.current } });

    sceneRefs.current.forEach((scene, index) => {
      if (!scene) return;
      const distance = scaled - index;
      const abs = Math.abs(distance);
      const opacity = abs >= 1 ? 0 : 1 - smoothstep(abs);
      const active = index === next;
      scene.style.opacity = opacity.toFixed(4);
      scene.style.visibility = opacity > 0.001 ? "visible" : "hidden";
      scene.style.pointerEvents = active && opacity > 0.85 ? "auto" : "none";
      const copy = scene.querySelector(".scene-copy");
      if (copy) {
        const enter = active ? 1 - opacity : 1;
        copy.style.opacity = active ? String(clamp(1 - enter * 1.4)) : "0";
        copy.style.transform = `translate3d(${pointerCurrent.current.x * -10}px, ${enter * 28}px, 0) scale(${0.985 + opacity * 0.015})`;
      }
    });

    rafRef.current = requestAnimationFrame(animate);
  }, [getProgress, reducedMotion]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  const jumpToScene = useCallback((index) => {
    const story = storyRef.current;
    if (!story) return;
    const travel = story.offsetHeight - window.innerHeight;
    window.scrollTo({ top: story.offsetTop + travel * (index / (SCENES.length - 1)), behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);

  return (
    <main className="atelier-v6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Playfair+Display:wght@400;500&display=swap');
        :root{font-family:'DM Sans',sans-serif;font-synthesis:none}*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;background:#0b43b5}.atelier-v6{overflow:clip;min-height:100vh}.topbar{position:fixed;inset:0 0 auto;height:78px;z-index:80;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(22px,4vw,64px);color:#fff;mix-blend-mode:difference}.brand{font-family:'Playfair Display',serif;font-size:18px;letter-spacing:-.04em}.topbar nav{display:flex;gap:28px;text-transform:uppercase;font-size:10px;letter-spacing:.16em}.topbar button{border:0;background:none;color:inherit;cursor:pointer;padding:8px 0}.story{position:relative;height:${SCENES.length * 125}vh}.sticky{position:sticky;top:0;height:100vh;overflow:hidden;isolation:isolate}.scene{position:absolute;inset:0;padding:clamp(92px,9vh,130px) clamp(24px,5vw,76px) clamp(28px,5vh,58px);opacity:0;visibility:hidden;will-change:opacity}.scene-blue{background:#0b43b5;color:#fff}.scene-cream{background:#eee9dc;color:#151515}.scene-blue-dark{background:#102a57;color:#f5f1e8}.scene-ink{background:#121212;color:#f2efe7}.scene-grid{position:absolute;inset:-4%;pointer-events:none;opacity:.12;background-image:linear-gradient(rgba(255,255,255,.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.2) 1px,transparent 1px);background-size:25vw 25vh;mask-image:linear-gradient(to bottom,transparent,black 18%,black 82%,transparent)}.scene-cream .scene-grid{background-image:linear-gradient(rgba(0,0,0,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.13) 1px,transparent 1px)}.scene-topline{position:absolute;top:7.5vh;left:clamp(24px,5vw,76px);right:clamp(24px,5vw,76px);display:flex;justify-content:space-between;font-size:9px;line-height:1;letter-spacing:.18em;text-transform:uppercase;opacity:.7}.scene-copy{position:absolute;z-index:30;left:clamp(24px,7vw,108px);top:50%;width:min(43vw,610px);transform:translateY(-50%);will-change:transform,opacity}.copy-kicker{margin-bottom:18px;font-size:9px;text-transform:uppercase;letter-spacing:.2em;opacity:.55}.scene-copy h1{margin:0;max-width:680px;font-family:'Playfair Display',serif;font-size:clamp(48px,7vw,112px);line-height:.86;letter-spacing:-.065em;font-weight:400;text-wrap:balance}.scene-copy p{width:min(360px,80%);margin:30px 0 0;font-size:13px;line-height:1.65;opacity:.72}.outline-button{margin-top:30px;padding:11px 17px;border:1px solid currentColor;border-radius:999px;background:transparent;color:inherit;cursor:pointer;display:inline-flex;gap:16px;align-items:center;font-size:11px}.particle-wrap{position:absolute;z-index:20;top:0;right:-2%;width:min(68vw,980px);height:100%;pointer-events:none}.artwork-stage{position:relative;width:100%;height:100%}.particle-art{position:absolute;inset:0;display:block;width:100%;height:100%;mix-blend-mode:normal}.progress{position:fixed;z-index:90;right:clamp(18px,3vw,44px);top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:12px}.progress button{width:6px;height:6px;border:0;padding:0;border-radius:50%;background:currentColor;color:#fff;opacity:.35;cursor:pointer}.progress button.active{opacity:1;transform:scale(1.7)}.progress-dark{color:#111}.closing{min-height:70vh;padding:12vh clamp(24px,7vw,108px);background:#eee9dc;color:#151515;display:flex;flex-direction:column;justify-content:space-between}.closing h2{margin:0;max-width:950px;font-family:'Playfair Display',serif;font-weight:400;font-size:clamp(58px,9vw,150px);line-height:.84;letter-spacing:-.07em}.closing small{font-size:10px;text-transform:uppercase;letter-spacing:.16em;opacity:.6}
        @media(max-width:800px){.topbar{height:68px}.topbar nav{gap:15px}.scene{padding:84px 20px 28px}.scene-topline{top:7%;left:20px;right:20px}.scene-copy{left:20px;top:auto;bottom:12%;width:calc(100% - 40px);transform:none}.scene-copy h1{max-width:88%;font-size:clamp(46px,13vw,74px)}.scene-copy p{margin-top:20px;width:min(330px,75%)}.particle-wrap{top:2%;right:-15%;width:118vw;height:66vh}.progress{right:12px}.copy-kicker{margin-bottom:12px}}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{transition-duration:.01ms!important;animation-duration:.01ms!important}}
      `}</style>
      <header className="topbar"><div className="brand">Meridian Atelier</div><nav><button onClick={() => jumpToScene(0)}>Work</button><button onClick={() => jumpToScene(SCENES.length - 1)}>About</button></nav></header>
      <section ref={storyRef} className="story" aria-label="Meridian Atelier visual story">
        <div className="sticky">
          {SCENES.map((scene, index) => <Scene key={scene.id} scene={scene} index={index} sceneRefs={sceneRefs} jumpToScene={jumpToScene} />)}
          <div className="particle-wrap">
            <Artwork progress={renderState.progress} pointer={renderState.pointer} reducedMotion={reducedMotion} />
          </div>
          <div className={`progress ${SCENES[activeScene].theme === "cream" ? "progress-dark" : ""}`}>{SCENES.map((scene, index) => <button key={scene.id} className={activeScene === index ? "active" : ""} aria-label={`Go to scene ${index + 1}`} onClick={() => jumpToScene(index)} />)}</div>
        </div>
      </section>
      <footer className="closing"><small>Meridian Atelier / Visual direction</small><h2>Make the scroll worth taking.</h2></footer>
    </main>
  );
}
