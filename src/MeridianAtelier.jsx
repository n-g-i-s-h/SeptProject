import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import monalisaSrc from "./assets/jackedmonalisa.webp";
import killerduckSrc from "./assets/imagedos.jpg";
import sharkSrc from "./assets/kawaiishark.jpg";

/* ---------------------------------------------------------------------- */
/* Scene content                                                          */
/* ---------------------------------------------------------------------- */

const SCENES = [
  {
    bg: [17, 34, 84],
    lum: 0.18,
    eyebrow: "01",
    headline: "Scroll and see what happens.",
    body: "Five scenes. No plan. Some are drawn with math, some are just pictures we liked.",
    cta: "Keep going",
  },
  {
    bg: [90, 70, 45],
    lum: 0.4,
    eyebrow: "02",
    headline: "She's been skipping arm day for 500 years.",
    body: "Turns out the smile was never the interesting part.",
  },
  {
    bg: [186, 209, 227],
    lum: 0.78,
    eyebrow: "03",
    headline: "Diffusion is the whole art.",
    body: "Some things are only visible from a distance. Others sneak up on you.",
  },
  {
    bg: [222, 196, 60],
    lum: 0.78,
    eyebrow: "04",
    headline: "Small, yellow, and not to be trusted.",
    body: "He's smiling because he already knows how this ends.",
  },
  {
    bg: [173, 200, 227],
    lum: 0.82,
    eyebrow: "05",
    headline: "Sharp teeth, soft delivery.",
    body: "Say hi anyway.",
    cta: "Say hi",
    dark: true,
  },
];

/* ---------------------------------------------------------------------- */
/* Small math helpers                                                     */
/* ---------------------------------------------------------------------- */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);

/* ---------------------------------------------------------------------- */
/* Procedural scene painters — return [r,g,b] for a point u,v ∈ 0..1      */
/* ---------------------------------------------------------------------- */

function paintHero(u, v) {
  const bg = [17, 34, 84];
  const gold = [214, 165, 84];
  const cx = 0.7,
    cy = 0.36,
    r = 0.34;
  const d = Math.hypot(u - cx, v - cy) / r;
  const glow = clamp(1 - d, 0, 1);
  const t = Math.pow(glow, 1.6);
  const shade = clamp(1 - v * 0.25, 0, 1);
  return [
    lerp(bg[0] * shade, gold[0], t),
    lerp(bg[1] * shade, gold[1], t),
    lerp(bg[2] * shade, gold[2], t),
  ];
}

function paintSky(u, v) {
  const bg = [186, 209, 227];
  const white = [252, 252, 250];
  const blobs = [
    [0.22, 0.3, 0.22],
    [0.4, 0.42, 0.16],
    [0.68, 0.24, 0.26],
    [0.8, 0.55, 0.14],
    [0.5, 0.68, 0.2],
  ];
  let a = 0;
  for (const [cx, cy, r] of blobs) {
    const wob = Math.sin((u + cy) * 24) * 0.015;
    const d = Math.hypot(u - cx, v - cy + wob) / r;
    a = Math.max(a, clamp(1 - d, 0, 1));
  }
  const t = smoothstep(clamp(a, 0, 1));
  return [lerp(bg[0], white[0], t), lerp(bg[1], white[1], t), lerp(bg[2], white[2], t)];
}

/* ---------------------------------------------------------------------- */
/* Image loader — loads a photo once and hands back the raw <img>         */
/* element so the canvas can drawImage() it directly (smooth, cheap,      */
/* no manual pixel sampling needed for a plain crossfade)                 */
/* ---------------------------------------------------------------------- */

function useImageLoader(src) {
  const imgRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setReady(true);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return { imgRef, ready };
}

/* ---------------------------------------------------------------------- */
/* Canvas stage — plain smooth crossfade between the current and next     */
/* scene, offset by pointer parallax. Photos are drawn straight from the  */
/* source <img> (browser-smoothed, no pixelation); procedural scenes are  */
/* rendered into a small low-res buffer and scaled up, which reads as a   */
/* soft gradient rather than a blocky grid.                               */
/* ---------------------------------------------------------------------- */

function Stage({ sceneIndex, localT, parallax, reducedMotion, visuals }) {
  const canvasRef = useRef(null);
  const scratchRef = useRef(null);

  const drawLayer = useCallback((ctx, visual, w, h, aspect, alpha, padScale) => {
    if (alpha <= 0.001) return;
    ctx.globalAlpha = alpha;

    const dw = w * padScale;
    const dh = h * padScale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;

    if (visual.type === "image" && visual.imgRef.current) {
      const img = visual.imgRef.current;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const imgAspect = iw / ih;
      let sx, sy, sw, sh;
      if (imgAspect > aspect) {
        sh = ih;
        sw = ih * aspect;
        sy = 0;
        sx = (iw - sw) / 2;
      } else {
        sw = iw;
        sh = iw / aspect;
        sx = 0;
        sy = (ih - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    } else if (visual.type === "image") {
      ctx.fillStyle = `rgb(${visual.fallback.join(",")})`;
      ctx.fillRect(dx, dy, dw, dh);
    } else {
      if (!scratchRef.current) scratchRef.current = document.createElement("canvas");
      const buf = scratchRef.current;
      const bw = 160;
      const bh = Math.max(1, Math.round(bw / aspect));
      if (buf.width !== bw || buf.height !== bh) {
        buf.width = bw;
        buf.height = bh;
      }
      const bctx = buf.getContext("2d");
      const imgData = bctx.createImageData(bw, bh);
      const paint = visual.paint;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const u = (x + 0.5) / bw;
          const v = (y + 0.5) / bh;
          const [r, g, b] = paint(u, v);
          const idx = (y * bw + x) * 4;
          imgData.data[idx] = r;
          imgData.data[idx + 1] = g;
          imgData.data[idx + 2] = b;
          imgData.data[idx + 3] = 255;
        }
      }
      bctx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buf, 0, 0, bw, bh, dx, dy, dw, dh);
    }
    ctx.globalAlpha = 1;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    const aspect = w / h;

    ctx.clearRect(0, 0, w, h);

    const from = visuals[sceneIndex];
    const to = visuals[Math.min(sceneIndex + 1, visuals.length - 1)];
    const t = smoothstep(localT);

    // Layers are drawn slightly oversized and then nudged by the parallax
    // translate, so the pan never reveals an empty edge.
    const padScale = reducedMotion ? 1 : 1.06;
    const px = reducedMotion ? 0 : parallax.x * w * 0.035;
    const py = reducedMotion ? 0 : parallax.y * h * 0.025;

    ctx.save();
    ctx.translate(px, py);
    drawLayer(ctx, from, w, h, aspect, 1, padScale);
    drawLayer(ctx, to, w, h, aspect, t, padScale);
    ctx.restore();
  }, [sceneIndex, localT, parallax, reducedMotion, visuals, drawLayer]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* ---------------------------------------------------------------------- */
/* Text layer — crossfades headline/body/cta between the two scenes       */
/* ---------------------------------------------------------------------- */

function SceneCopy({ scene, opacity, dark, parallax, reducedMotion }) {
  const shiftX = reducedMotion ? 0 : parallax.x * -8;
  const shiftY = reducedMotion ? 0 : parallax.y * -6;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "0 7vw 12vh",
        opacity,
        transform: `translate3d(${shiftX}px, ${(1 - opacity) * 14 + shiftY}px, 0)`,
        pointerEvents: opacity > 0.6 ? "auto" : "none",
        color: dark ? "#181410" : "#f7f3ea",
        "--fg": dark ? "#181410" : "#f7f3ea",
        "--bg": dark ? "#f7f3ea" : "#181410",
      }}
    >
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, letterSpacing: "0.02em", opacity: 0.6, marginBottom: 18 }}>
        {scene.eyebrow} / 05
      </div>
      <h2
        style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 500,
          fontSize: "clamp(2rem, 5vw, 3.6rem)",
          lineHeight: 1.05,
          maxWidth: 620,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {scene.headline}
      </h2>
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "clamp(0.95rem, 1.3vw, 1.1rem)",
          lineHeight: 1.55,
          maxWidth: 420,
          marginTop: 22,
          opacity: 0.85,
        }}
      >
        {scene.body}
      </p>
      {scene.cta && (
        <button className="cta-btn" style={{ marginTop: 34, width: "fit-content" }}>
          {scene.cta}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Main page                                                              */
/* ---------------------------------------------------------------------- */

export default function MeridianAtelier() {
  const stageRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef({
    displayedFloat: 0,
    targetFloat: 0,
    displayedParallax: { x: 0, y: 0 },
    targetParallax: { x: 0, y: 0 },
  });
  const reducedMotionRef = useRef(false);

  const [render, setRender] = useState({
    sceneIndex: 0,
    localT: 0,
    navDark: false,
    parallax: { x: 0, y: 0 },
  });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0, visible: false });

  // Scene 1 (Mona Lisa), scene 3 (knife duck), scene 4 (shark) are real
  // photos; scenes 0 and 2 stay procedural.
  const monalisa = useImageLoader(monalisaSrc);
  const killerduck = useImageLoader(killerduckSrc);
  const shark = useImageLoader(sharkSrc);

  const visuals = useMemo(
    () => [
      { type: "procedural", paint: paintHero },
      { type: "image", imgRef: monalisa.imgRef, fallback: SCENES[1].bg },
      { type: "procedural", paint: paintSky },
      { type: "image", imgRef: killerduck.imgRef, fallback: SCENES[3].bg },
      { type: "image", imgRef: shark.imgRef, fallback: SCENES[4].bg },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monalisa.ready, killerduck.ready, shark.ready]
  );

  useEffect(() => {
    reducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const computeTargetFloat = useCallback(() => {
    const el = stageRef.current;
    if (!el) return 0;
    const stageTop = el.offsetTop;
    const scrollable = el.offsetHeight - window.innerHeight;
    let p = scrollable > 0 ? (window.scrollY - stageTop) / scrollable : 0;
    p = clamp(p, 0, 1);
    return p * (SCENES.length - 1);
  }, []);

  const ensureLoop = useCallback(() => {
    if (rafRef.current) return;
    const step = () => {
      const s = stateRef.current;
      s.targetFloat = computeTargetFloat();

      const reduced = reducedMotionRef.current;
      const easing = reduced ? 1 : 0.15;
      const parallaxEasing = reduced ? 1 : 0.1;

      s.displayedFloat = lerp(s.displayedFloat, s.targetFloat, easing);
      s.displayedParallax.x = lerp(s.displayedParallax.x, s.targetParallax.x, parallaxEasing);
      s.displayedParallax.y = lerp(s.displayedParallax.y, s.targetParallax.y, parallaxEasing);

      const floatDelta = Math.abs(s.targetFloat - s.displayedFloat);
      const parallaxDelta =
        Math.abs(s.targetParallax.x - s.displayedParallax.x) +
        Math.abs(s.targetParallax.y - s.displayedParallax.y);

      let idx = Math.floor(s.displayedFloat);
      if (idx >= SCENES.length - 1) idx = SCENES.length - 2;
      if (idx < 0) idx = 0;
      const localT = clamp(s.displayedFloat - idx, 0, 1);
      const lum = lerp(SCENES[idx].lum, SCENES[idx + 1].lum, localT);

      setRender({
        sceneIndex: idx,
        localT,
        navDark: lum > 0.55,
        parallax: { x: s.displayedParallax.x, y: s.displayedParallax.y },
      });

      if (floatDelta > 0.0008 || parallaxDelta > 0.0008) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [computeTargetFloat]);

  useEffect(() => {
    const onScroll = () => ensureLoop();
    window.addEventListener("scroll", onScroll, { passive: true });
    ensureLoop();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [ensureLoop]);

  const handlePointerMove = useCallback(
    (e) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - Math.max(rect.top, 0)) / window.innerHeight - 0.5;
      stateRef.current.targetParallax = { x: clamp(relX, -0.5, 0.5), y: clamp(relY, -0.5, 0.5) };
      setCursorPos({ x: e.clientX, y: e.clientY, visible: true });
      ensureLoop();
    },
    [ensureLoop]
  );

  const handlePointerLeave = useCallback(() => {
    stateRef.current.targetParallax = { x: 0, y: 0 };
    setCursorPos((p) => ({ ...p, visible: false }));
    ensureLoop();
  }, [ensureLoop]);

  const jumpToScene = useCallback((i) => {
    const el = stageRef.current;
    if (!el) return;
    const scrollable = el.offsetHeight - window.innerHeight;
    const targetP = i / (SCENES.length - 1);
    window.scrollTo({ top: el.offsetTop + targetP * scrollable, behavior: "smooth" });
  }, []);

  const { sceneIndex, localT, navDark, parallax } = render;
  const textT = smoothstep(localT);
  const fromScene = SCENES[sceneIndex];
  const toScene = SCENES[Math.min(sceneIndex + 1, SCENES.length - 1)];
  const navColor = navDark ? "#181410" : "#f7f3ea";

  return (
    <div style={{ background: "#f4f0e7", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Inter:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        button:focus-visible, .nav-link:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }

        .cta-btn {
          padding: 13px 26px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          border: 1px solid var(--fg);
          background: transparent;
          color: var(--fg);
          cursor: pointer;
          border-radius: 2px;
          transition: background 0.25s ease, color 0.25s ease;
        }
        .cta-btn:hover { background: var(--fg); color: var(--bg); }

        .nav-link {
          position: relative;
          opacity: 0.85;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          left: 0; right: 0; bottom: -4px;
          height: 1px;
          background: currentColor;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.25s ease;
        }
        .nav-link:hover { opacity: 1; }
        .nav-link:hover::after { transform: scaleX(1); }

        .book-btn {
          border: 1px solid var(--fg);
          padding: 8px 16px;
          border-radius: 2px;
          background: transparent;
          color: var(--fg);
          font: inherit;
          cursor: pointer;
          transition: background 0.25s ease, color 0.25s ease;
        }
        .book-btn:hover { background: var(--fg); color: var(--bg); }

        .scene-dot {
          border: none;
          padding: 0;
          cursor: pointer;
          background: var(--fg);
          border-radius: 50%;
          transition: width 0.2s, height 0.2s, opacity 0.2s;
        }

        @media (hover: hover) {
          .cursor-dot { display: block; }
        }
        @media (hover: none) {
          .cursor-dot { display: none; }
        }
      `}</style>

      {/* Nav */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "26px 7vw",
          color: navColor,
          "--fg": navColor,
          "--bg": navDark ? "#f7f3ea" : "#181410",
        }}
      >
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, letterSpacing: "-0.01em" }}>
          Gallery of Nonsense
        </span>
        <nav style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 13.5 }}>
          <span className="nav-link">Scenes</span>
          <span className="nav-link">About</span>
          <button className="book-btn">Say hi</button>
        </nav>
      </header>

      {/* Pinned scrollytelling stage */}
      <div
        ref={stageRef}
        style={{ position: "relative", height: `${SCENES.length * 100}vh` }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
          <Stage
            sceneIndex={sceneIndex}
            localT={localT}
            parallax={parallax}
            reducedMotion={reducedMotionRef.current}
            visuals={visuals}
          />
          <SceneCopy scene={fromScene} opacity={1 - textT} dark={fromScene.dark} parallax={parallax} reducedMotion={reducedMotionRef.current} />
          <SceneCopy scene={toScene} opacity={textT} dark={toScene.dark} parallax={parallax} reducedMotion={reducedMotionRef.current} />

          {/* progress dots — click to jump to a scene */}
          <div
            style={{
              position: "absolute",
              right: "5vw",
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              zIndex: 5,
              "--fg": navColor,
            }}
          >
            {SCENES.map((_, i) => {
              const active = i === sceneIndex || (i === sceneIndex + 1 && localT > 0.5);
              const size = active ? 7 : 5;
              return (
                <button
                  key={i}
                  className="scene-dot"
                  aria-label={`Go to scene ${i + 1}`}
                  onClick={() => jumpToScene(i)}
                  style={{ width: size, height: size, opacity: active ? 0.95 : 0.4 }}
                />
              );
            })}
          </div>

          {sceneIndex === 0 && localT < 0.15 && (
            <div
              style={{
                position: "absolute",
                left: "7vw",
                bottom: "4vh",
                color: navColor,
                fontSize: 12.5,
                letterSpacing: "0.02em",
                opacity: 1 - localT / 0.15,
              }}
            >
              Scroll
            </div>
          )}
        </div>
      </div>

      {/* Cursor-follow dot — auto-contrasts via blend mode, desktop only */}
      <div
        className="cursor-dot"
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 20,
          height: 20,
          marginLeft: -10,
          marginTop: -10,
          borderRadius: "50%",
          background: "#ffffff",
          mixBlendMode: "difference",
          pointerEvents: "none",
          zIndex: 50,
          opacity: cursorPos.visible ? 1 : 0,
          transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`,
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Footer */}
      <footer
        style={{
          background: "#181410",
          color: "#f4f0e7",
          padding: "80px 7vw 50px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 40,
        }}
      >
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, maxWidth: 320 }}>
          Gallery of Nonsense
        </div>
        <div style={{ display: "flex", gap: 60, fontSize: 13.5, opacity: 0.75 }}>
          <div>
            <div style={{ marginBottom: 10, opacity: 0.5 }}>Made of</div>
            <div>Math</div>
            <div>Memes</div>
          </div>
          <div>
            <div style={{ marginBottom: 10, opacity: 0.5 }}>Write</div>
            <div>hello@example.com</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
