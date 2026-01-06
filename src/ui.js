/**
 * STONEWAVE DUEL - UI SYSTEM
 * Handles HUD, Shop, and Award Sequences.
 *
 * SKETCHBOOK UI THEME
 * "Skewed Paraffin Rule-Drift" notebook/crayon aesthetic.
 */
(function() {
    window.flux = window.flux || {};

class UI {
        // --- INPUT HELPER ---
// --- INPUT HELPER ---
bindTap(element, callback) {
            let startX, startY;
            let isTap = false;
            let isTouching = false;

            element.addEventListener('touchstart', (e) => {
                isTouching = true;
                isTap = true;
                const t = e.changedTouches[0];
                startX = t.clientX;
                startY = t.clientY;
            }, { passive: true });

            element.addEventListener('touchmove', (e) => {
                if (!isTap) return;
                const t = e.changedTouches[0];
                const dx = t.clientX - startX;
                const dy = t.clientY - startY;
                if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
                    isTap = false;
                }
            }, { passive: true });

            const handleEnd = (e) => {
                // Reset touch flag after delay to block ghost clicks
                setTimeout(() => { isTouching = false; }, 500);

                if (isTap) {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    callback(e);
                }
                isTap = false;
            };

            element.addEventListener('touchend', handleEnd, { passive: false });
            element.addEventListener('touchcancel', () => { 
                isTap = false; 
                setTimeout(() => { isTouching = false; }, 500);
            }, { passive: true });

            element.addEventListener('click', (e) => {
                if (isTouching) return;
                e.stopPropagation();
                callback(e);
            });
        }

        constructor() {
            this.injectSketchbookTheme();

            // Main Container
            this.container = document.createElement('div');
            this.container.className = 'flux-ui-root';
            // Keep absolute positioning inline so it always works even if CSS is missing
            Object.assign(this.container.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: '100',
                overflow: 'hidden'
            });
            document.body.appendChild(this.container);

            // --- HUD ELEMENTS ---
            this.createHUD();

            // --- OVERLAYS ---
            this.createShopOverlay();
            this.createAwardOverlay();
            this.createPostGameMenu();
this.createPostGameMenu();
this.createMultiplayerMenu();
            this.createLobbyOverlay();
            this.createMainMenu(); // Add Main Menu
            // Flash Effect (White screen)
            this.flashEl = document.createElement('div');
            this.flashEl.className = 'sb-flash';
            Object.assign(this.flashEl.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                opacity: '0',
                pointerEvents: 'none',
                transition: 'opacity 0.2s ease-out',
                zIndex: '200'
            });
            this.container.appendChild(this.flashEl);

            // Message Overlay (Generic)
            this.msgEl = document.createElement('div');
            this.msgEl.className = 'sb-message';
            Object.assign(this.msgEl.style, {
                position: 'absolute',
                top: '140px', // Moved up (under top bar)
                width: '100%',
                textAlign: 'center',
                display: 'none',
                zIndex: '120', // Above top bar elements
                pointerEvents: 'none'
            });
            this.container.appendChild(this.msgEl);

            // --- 3D PREVIEW SETUP ---
            this.init3DPreview();

            // Initial Sync
            setTimeout(() => this.updateStars(), 100);
        }

init3DPreview() {
            // Scene for Shop Preview
            this.previewScene = new THREE.Scene();
            
            // Lights - Enhanced for Product Showcase
            const ambient = new THREE.AmbientLight(0xffffff, 0.7);
            const dir = new THREE.DirectionalLight(0xffffff, 1.1);
            dir.position.set(2, 5, 5);
            
            // Rim light for 3D pop
            const rim = new THREE.DirectionalLight(0xffd700, 0.4); 
            rim.position.set(-2, 3, -3);

            this.previewScene.add(ambient);
            this.previewScene.add(dir);
            this.previewScene.add(rim);

            // Camera - Centered on item height (approx 0.25)
            this.previewCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
            this.previewCamera.position.set(0, 0.35, 1.8); 
            this.previewCamera.lookAt(0, 0.25, 0);

            // Dedicated Mini Renderer (Transparent)
            this.miniRenderer = new THREE.WebGLRenderer({ 
                alpha: true, 
                antialias: true,
                precision: 'mediump'
            });
            this.miniRenderer.setSize(200, 200);
            this.miniRenderer.setPixelRatio(window.devicePixelRatio > 1 ? 1.5 : 1);
            this.miniRenderer.outputEncoding = THREE.sRGBEncoding;

            // State
            this.previewMesh = null;
        }

update(dt) {
            // Rotate Preview Mesh
            if (this.previewMesh) {
                this.previewMesh.rotation.y += 0.8 * dt; // Majestic rotation speed
                
                // Organic Bob (Realistic Sinus)
                const t = performance.now() / 1000;
                this.previewMesh.position.y = (Math.sin(t * 1.5) + Math.sin(t * 2.2)) * 0.03;

                // Render the mini scene
                if (this.miniRenderer && this.shopOverlay.style.display !== 'none') {
                    this.miniRenderer.render(this.previewScene, this.previewCamera);
                }
            }
        }

        // ------------------------------
        // THEME INJECTION
        // ------------------------------

        injectSketchbookTheme() {
            if (document.getElementById('sketchbook-ui-style')) return;

            const head = document.head || document.getElementsByTagName('head')[0];

            // Fonts
            const pre1 = document.createElement('link');
            pre1.rel = 'preconnect';
            pre1.href = 'https://fonts.googleapis.com';
            head.appendChild(pre1);

            const pre2 = document.createElement('link');
            pre2.rel = 'preconnect';
            pre2.href = 'https://fonts.gstatic.com';
            pre2.crossOrigin = 'anonymous';
            head.appendChild(pre2);

            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Space+Mono:wght@400;700&display=swap';
            head.appendChild(fontLink);

            // Filters (rough edges / waxy texture)
            if (!document.getElementById('sb-filter-defs')) {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('id', 'sb-filter-defs');
                svg.setAttribute('style', 'position:absolute;width:0;height:0;');
                svg.innerHTML = `
                    <filter id="rough-edges">
                        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
                    </filter>
                    <filter id="crayon-texture">
                        <feTurbulence type="turbulence" baseFrequency="0.5" numOctaves="2" result="grain" />
                        <feComposite operator="in" in="grain" in2="SourceGraphic" />
                    </filter>
                `;
                document.body.appendChild(svg);
            }

            // CSS
            const style = document.createElement('style');
            style.id = 'sketchbook-ui-style';
            style.textContent = `
/* ------------------------------
   SKETCHBOOK UI THEME
   ------------------------------ */
.flux-ui-root {
  --paper-bg: #fdfcf0;
  --line-blue: #a5d8ff;
  --margin-pink: #ffb3ba;
  --crayon-red: #ff4d6d;
  --crayon-blue: #2d7dd2;
  --crayon-green: #52b788;
  --crayon-yellow: #f9c74f;
  --ink: #2b2d42;
  --shadow: rgba(0,0,0,0.08);

  font-family: 'Gaegu', cursive;
  color: var(--ink);
}

.flux-ui-root * {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  cursor: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iI2ZmNGQ2ZCIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+"), auto;
}

/* Small badges (stars / timer) */
.sb-badge {
  background: var(--paper-bg);
  background-image: linear-gradient(var(--line-blue) 1px, transparent 1px);
  background-size: 100% 26px;
  border: 3px solid var(--ink);
  border-radius: 15px 50px 30px 5px / 10px 15px 50px 20px;
  box-shadow: 10px 10px 0 var(--shadow);
  padding: 6px 12px;
  filter: url(#rough-edges);
  pointer-events: none;
}
.sb-badge .mono {
  font-family: 'Space Mono', monospace;
  font-weight: 700;
}

.sb-topbar {
  position: absolute;
  top: -15px;
  left: -5%;
  width: 110%;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 25px calc(5% + 24px) 0 calc(5% + 24px);
  pointer-events: none;
  
  background: var(--paper-bg);
  background-image: linear-gradient(var(--line-blue) 1px, transparent 1px);
  background-size: 100% 24px;
  border-bottom: 6px solid var(--ink);
  border-radius: 0 0 180px 30px / 0 0 20px 200px; /* Aggressive asymmetry */
  box-shadow: 0 12px 0 var(--shadow);
  z-index: 90;
  transform: rotate(-3.5deg) skewY(1.2deg); /* Enhanced slant */
  transform-origin: top center;
}

.sb-stars {
  display: flex;
  align-items: center;
  font-size: 22px;
  font-weight: 700;
  color: var(--crayon-yellow);
  text-shadow: 2px 2px 0 var(--ink);
  filter: url(#rough-edges);
  transform: rotate(1.5deg);
}
.sb-stars .mono {
  font-family: 'Space Mono', monospace;
}

.sb-stock-container {
  display: flex;
  gap: 24px;
  align-items: center;
  transform: rotate(1.5deg);
}

.sb-stock {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
}

.sb-eliminated-x {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  font-family: 'Gaegu', cursive;
  font-size: 64px;
  font-weight: 700;
  color: var(--crayon-red);
  text-shadow: 3px 3px 0 rgba(0,0,0,0.15);
  pointer-events: none;
  z-index: 10;
  filter: url(#rough-edges);
  line-height: 0;
}

.sb-stock-name {
  font-family: 'Gaegu', cursive;
  font-size: 34px;
  font-weight: 700;
  opacity: 0.95;
  text-transform: uppercase;
  line-height: 0.8;
  margin-bottom: 4px;
  color: var(--ink);
  transform: rotate(-3deg);
  filter: url(#rough-edges);
  text-shadow: 2px 2px 0 rgba(0,0,0,0.1);
}

.sb-stock-lives {
  font-size: 18px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 2px;
  filter: drop-shadow(1px 1px 0 rgba(0,0,0,0.1));
}
/* Messages + flash */
/* Messages + flash */
.sb-message {
  font-family: 'Gaegu', cursive;
  font-weight: 700;
  font-size: clamp(3.5rem, 10vw, 6rem); /* Massive */
  line-height: 0.9;
  color: var(--ink);
  
  /* Thick white stroke + shadow for pop */
  text-shadow: 
    3px 3px 0 #fff, -3px -3px 0 #fff, 
    3px -3px 0 #fff, -3px 3px 0 #fff,
    3px 0 0 #fff, -3px 0 0 #fff,
    0 3px 0 #fff, 0 -3px 0 #fff,
    8px 8px 0 rgba(0,0,0,0.15);
    
  transform: rotate(-2deg);
  filter: url(#rough-edges);
  
  /* Entrance Animation */
  animation: sb-message-slam 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes sb-message-slam {
  0% { transform: scale(3) rotate(15deg); opacity: 0; }
  60% { transform: scale(0.9) rotate(-5deg); opacity: 1; }
  80% { transform: scale(1.05) rotate(-1deg); }
  100% { transform: scale(1) rotate(-2deg); }
}

.sb-flash { background: white; }

/* Overlay base */
.sb-overlay {
  position: absolute;
  inset: 0;
  display: none;
  pointer-events: auto;
  z-index: 150;
  background: radial-gradient(circle, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.82) 100%);
  touch-action: none;
}

/* Notebook canvas panel */
.notebook-canvas {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-0.5deg);
  width: min(1100px, 92vw);
  height: min(85vh, 92vh);
  background-color: var(--paper-bg);
  background-image: linear-gradient(var(--line-blue) 1px, transparent 1px);
  background-size: 100% 32px;
  border: 2px solid #eee;
  box-shadow: 20px 20px 0 var(--shadow);
  overflow: hidden;
  filter: url(#rough-edges);
}

.notebook-canvas::before {
  content: '';
  position: absolute;
  left: 60px;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: var(--margin-pink);
  opacity: 0.9;
}

.sb-canvas-pad {
  position: absolute;
  inset: 0;
  padding: 56px 34px 32px 84px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sb-header {
  position: relative;
  margin-bottom: 26px;
  transform: rotate(1.2deg);
}

.sb-entry {
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--crayon-blue);
}

.sb-title {
  font-size: clamp(2.2rem, 6vw, 4.4rem);
  margin: 0;
  color: var(--crayon-red);
  line-height: 0.85;
  letter-spacing: -1px;
  mix-blend-mode: multiply;
  filter: drop-shadow(4px 4px 0 rgba(255, 77, 109, 0.22));
}

.sb-subtitle {
  font-family: 'Space Mono', monospace;
  font-size: 0.9rem;
  text-transform: uppercase;
  background: var(--crayon-yellow);
  padding: 4px 12px;
  display: inline-block;
  margin-top: 10px;
  transform: rotate(-2deg);
  border: 2px solid var(--ink);
}

.sb-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 26px;
  align-items: start;
  flex: 1;
  min-height: 0;
}

.sb-grid > .sketch-card {
  height: 100%;
  min-height: 0;
}

.sketch-card {
  position: relative;
  padding: 22px;
  background: rgba(255,255,255,0.92);
  border: 4px solid var(--ink);
  border-radius: 15px 50px 30px 5px / 10px 15px 50px 20px;
  box-shadow: 12px 12px 0 var(--shadow);
  transition: transform 0.18s ease;
}

.sketch-card:hover { transform: rotate(0.6deg) scale(1.01); }

.card-green { border-color: var(--crayon-green); border-width: 6px; }
.card-blue { border-color: var(--crayon-blue); border-width: 6px; transform: rotate(-1.4deg); }

.data-label {
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 0.75rem;
  color: rgba(43,45,66,0.55);
  margin-bottom: 8px;
  display: block;
}

.scribble-box {
  position: absolute;
  top: -16px;
  right: -16px;
  width: 86px;
  height: 86px;
  background: var(--crayon-yellow);
  opacity: 0.25;
  mask-image: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAgMTBMMDkgMjBMMTcgMjhMMzAgMThMMjUgNDBMMTUgMzVMMTggNTVMNTAgNjBMMzAgODBMNzAgOTBMODAgNzBMODUgNDBMNzAgMzBMNjAgNTBMNDAgMjBaIiBmaWxsPSJibGFjayIvPjwvc3ZnPg==");
  z-index: 0;
  animation: sb-jitter 0.2s infinite;
}

/* Crayon buttons */
/* Paper Scrap Buttons */
/* Paper Scrap Buttons with Juice */
.crayon-btn {
  background: var(--paper-bg);
  border: 4px solid var(--ink);
  font-family: 'Gaegu', cursive;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--ink);
  padding: 12px 36px;
  position: relative;
  cursor: pointer;
  margin: 14px 0;
  transition: all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  user-select: none;
  
  /* Asymmetrical Organic Shape (Paper Scrap) */
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
  box-shadow: 6px 6px 0 rgba(0,0,0,0.15);
  transform: rotate(-1.5deg);
  
  /* Texture filter */
  filter: url(#rough-edges);
}

.crayon-btn:hover {
  transform: rotate(1.5deg) scale(1.1);
  box-shadow: 9px 9px 0 rgba(0,0,0,0.2);
  background: #fff;
  z-index: 10;
}

.crayon-btn:active {
  transform: scale(0.95) rotate(0deg);
  box-shadow: 2px 2px 0 rgba(0,0,0,0.15);
}

.crayon-btn[disabled] {
  opacity: 0.5;
  filter: grayscale(1);
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* Color Variants (Border + Text) */
.crayon-btn--red {
  border-color: var(--crayon-red);
  color: var(--crayon-red);
}

.crayon-btn--green {
  border-color: var(--crayon-green);
  color: var(--crayon-green);
}

.crayon-btn--yellow {
  border-color: var(--crayon-yellow);
  color: #d69e00; /* Darker gold for contrast on white */
}

.crayon-btn--ink {
  border-color: var(--ink);
  color: var(--ink);
}

.sb-icon-btn { 
  padding: 6px 14px; 
  font-size: 1.4rem; 
  border-width: 3px;
  border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; /* More blobby for icon */
}

/* Shop list rows */
.sb-shop-list {
  height: 100%;
  overflow: auto;
  padding-right: 6px;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}

.sb-shop-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.sb-shop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  margin: 10px 0;
  background: rgba(255,255,255,0.9);
  border: 3px solid rgba(43,45,66,0.65);
  border-radius: 14px 30px 20px 10px / 10px 14px 30px 20px;
  box-shadow: 8px 8px 0 var(--shadow);
  transform: rotate(-0.4deg);
  transition: transform 0.14s ease;
}

.sb-shop-row:hover { transform: rotate(0.2deg) scale(1.01); }
.sb-shop-row[data-equipped="true"] { border-color: var(--crayon-green); }
.sb-shop-row[data-owned="true"] { border-color: rgba(43,45,66,0.75); }

.sb-shop-price { font-family: 'Space Mono', monospace; font-weight: 700; }

/* Award */
.sb-award-star {
  font-size: clamp(72px, 12vw, 140px);
  color: var(--crayon-yellow);
  filter: drop-shadow(0 0 14px rgba(249,199,79,0.35));
  transform: scale(0);
  transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.sb-award-sub { font-size: 1.4rem; opacity: 0; transition: opacity 0.5s ease; }

.sb-continue {
  position: absolute;
  right: 26px;
  bottom: 26px;
  font-family: 'Gaegu', cursive;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--ink);
  background: var(--crayon-yellow);
  padding: 8px 24px;
  border: 3px solid var(--ink);
  border-radius: 20px 5px 20px 5px;
  box-shadow: 4px 4px 0 rgba(0,0,0,0.2);
  animation: sb-pulse 1.5s infinite;
  cursor: pointer;
}

@keyframes sb-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05) rotate(2deg); }
    100% { transform: scale(1); }
}

/* Post game */
.sb-postgame {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 110px;
  display: none;
  justify-content: center;
  gap: 18px;
  pointer-events: auto;
  z-index: 140;
}

/* Responsive */
@media (max-width: 768px) {
  .notebook-canvas::before { left: 40px; }
  .sb-canvas-pad { padding: 46px 18px 18px 54px; }
  .sb-grid { grid-template-columns: 1fr; }
  .sb-topbar { height: 80px; }
}

@keyframes sb-jitter {
  0% { transform: translate(0,0); }
  50% { transform: translate(1px, -1px); }
  100% { transform: translate(-1px, 1px); }
}

@keyframes sb-blink { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.85; } }

.reveal { animation: sb-reveal 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
@keyframes sb-reveal { from { opacity: 0; transform: translate(-50%, calc(-50% + 30px)) rotate(-5deg); } to { opacity: 1; transform: translate(-50%, -50%) rotate(-0.5deg); } }
`;
            head.appendChild(style);
        }

        // ------------------------------
        // HUD
        // ------------------------------

createHUD() {
            // Top Bar (Container)
            this.topBar = document.createElement('div');
            this.topBar.className = 'sb-topbar';
            this.container.appendChild(this.topBar);

            // Star Counter (Left side of Top Bar)
            this.starEl = document.createElement('div');
            this.starEl.className = 'sb-stars';
            this.starEl.innerHTML = `<span class="mono">★ 0</span>`;
            this.topBar.appendChild(this.starEl);

            // Stock Container (Right side of Top Bar)
            this.stockContainer = document.createElement('div');
            this.stockContainer.className = 'sb-stock-container';
            this.topBar.appendChild(this.stockContainer);
this.topBar.appendChild(this.stockContainer);

            // Net Button (Center)
            this.netBtn = document.createElement('div');
            this.netBtn.className = 'sb-badge';
            Object.assign(this.netBtn.style, {
                position: 'absolute',
                left: '50%',
                top: '20px',
                transform: 'translateX(-50%) rotate(1deg)',
                cursor: 'pointer',
                pointerEvents: 'auto',
                fontSize: '14px',
                padding: '4px 12px',
                zIndex: '100'
            });
            this.netBtn.innerHTML = `<span class="mono">NET MENU</span>`;
            this.bindTap(this.netBtn, () => this.toggleMultiplayer());
            this.topBar.appendChild(this.netBtn);
            // Timer (Bottom Left)
            this.timerEl = document.createElement('div');
            this.timerEl.className = 'sb-badge sb-timer';
            Object.assign(this.timerEl.style, {
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                fontSize: '32px',
                fontWeight: '700'
            });
            this.timerEl.innerHTML = `<span class="mono">99</span>`;
            this.container.appendChild(this.timerEl);

            // Debug
            this.debugEl = document.createElement('div');
            Object.assign(this.debugEl.style, {
                position: 'absolute',
                bottom: '6px',
                right: '8px',
                fontSize: '10px',
                opacity: '0.35',
                fontFamily: 'monospace',
                color: '#fff',
                textShadow: '1px 1px 0 #000'
            });
this.container.appendChild(this.debugEl);

// Outline Toggle REMOVED per user request (Always On)
}

        // ------------------------------
        // SHOP OVERLAY
        // ------------------------------

        createShopOverlay() {
            this.shopOverlay = document.createElement('div');
            this.shopOverlay.className = 'sb-overlay sb-shop';
            this.shopOverlay.style.zIndex = '150';

            // Notebook canvas
            this.shopCanvas = document.createElement('div');
            this.shopCanvas.className = 'notebook-canvas reveal';

            const pad = document.createElement('div');
            pad.className = 'sb-canvas-pad';
            this.shopCanvas.appendChild(pad);

            // Header
            const header = document.createElement('div');
            header.className = 'sb-header';
            header.innerHTML = `
                <div class="sb-entry">ENTRY_NO: 064</div>
                <h1 class="sb-title">Sketchbook<br>Shop</h1>
                <div class="sb-subtitle">Waxy Pigment Displacement</div>
            `;
            pad.appendChild(header);

            // Grid
            const grid = document.createElement('div');
            grid.className = 'sb-grid';
            pad.appendChild(grid);

            // Left Panel: Item List
            this.shopList = document.createElement('div');
            this.shopList.className = 'sketch-card card-green sb-shop-list';
            grid.appendChild(this.shopList);

            // Right Panel: Preview & Actions
            this.shopPreview = document.createElement('div');
            this.shopPreview.className = 'sketch-card card-blue sb-shop-preview';
            grid.appendChild(this.shopPreview);

            // Close Button
// Close Button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'crayon-btn crayon-btn--ink sb-icon-btn';
            closeBtn.innerText = '✖';
            Object.assign(closeBtn.style, {
                position: 'absolute',
                top: '12px',
                right: '12px',
                margin: '0',
                pointerEvents: 'auto'
            });
            this.bindTap(closeBtn, () => this.toggleShop());
            this.shopCanvas.appendChild(closeBtn);

            this.shopOverlay.appendChild(this.shopCanvas);
            this.container.appendChild(this.shopOverlay);
        }

        // ------------------------------
        // AWARD OVERLAY
        // ------------------------------

createAwardOverlay() {
            this.awardOverlay = document.createElement('div');
            this.awardOverlay.className = 'sb-overlay sb-award';
            this.awardOverlay.style.zIndex = '160';

            // Notebook canvas
            this.awardCanvas = document.createElement('div');
            this.awardCanvas.className = 'notebook-canvas reveal';

            const pad = document.createElement('div');
            pad.className = 'sb-canvas-pad';
            this.awardCanvas.appendChild(pad);

            // Header
            const header = document.createElement('div');
            header.className = 'sb-header';
            header.innerHTML = `
                <div class="sb-entry" style="color: var(--crayon-green)">SYSTEM: VICTORY</div>
                <h1 class="sb-title">Victory<br>Stamp</h1>
                <div class="sb-subtitle">Toothy Cellulose Pigment-Scuff</div>
            `;
            pad.appendChild(header);

            // Center card
            const card = document.createElement('div');
            card.className = 'sketch-card card-green';
            Object.assign(card.style, {
                maxWidth: '820px',
                margin: '0 auto',
                textAlign: 'center'
            });
            pad.appendChild(card);

            this.awardTitle = document.createElement('div');
            this.awardTitle.className = 'data-label';
            this.awardTitle.style.fontSize = '0.9rem';
            this.awardTitle.style.color = 'rgba(43,45,66,0.65)';
            this.awardTitle.innerText = '// VICTORY';
            card.appendChild(this.awardTitle);

            this.awardIcon = document.createElement('div');
            this.awardIcon.className = 'sb-award-star';
            this.awardIcon.innerText = '★';
            card.appendChild(this.awardIcon);

            this.awardSub = document.createElement('div');
            this.awardSub.className = 'sb-award-sub';
            this.awardSub.style.marginTop = '10px';
            card.appendChild(this.awardSub);

            const cont = document.createElement('div');
            cont.className = 'sb-continue';
            cont.innerText = 'TAP TO CONTINUE ➜';
            this.awardCanvas.appendChild(cont);

            // Click handlers
            const finish = () => this.finishAwardSequence();
            // Bind button specifically for immediate feedback
            this.bindTap(cont, finish);
            // Bind overlay background as fallback
            this.bindTap(this.awardOverlay, finish);

            this.awardOverlay.appendChild(this.awardCanvas);
            this.container.appendChild(this.awardOverlay);
        }

        // ------------------------------
        // POST GAME MENU
        // ------------------------------

createPostGameMenu() {
            this.postGameMenu = document.createElement('div');
            this.postGameMenu.className = 'sb-postgame';

            const nextBtn = document.createElement('button');
            nextBtn.className = 'crayon-btn crayon-btn--green';
            nextBtn.innerText = 'NEXT MATCH';
            this.bindTap(nextBtn, () => {
                if (window.flux.startMatch) window.flux.startMatch();
                else location.reload();
            });

            const shopBtn = document.createElement('button');
            shopBtn.className = 'crayon-btn crayon-btn--red';
            shopBtn.innerText = 'OPEN SHOP';
this.bindTap(shopBtn, () => this.toggleShop());
            
            const mpBtn = document.createElement('button');
            mpBtn.className = 'crayon-btn crayon-btn--yellow';
            mpBtn.innerText = 'MULTIPLAYER';
            this.bindTap(mpBtn, () => this.toggleMultiplayer());

            this.postGameMenu.appendChild(nextBtn);
            this.postGameMenu.appendChild(mpBtn);
            this.postGameMenu.appendChild(shopBtn);

            this.postGameMenu.appendChild(nextBtn);
            this.postGameMenu.appendChild(shopBtn);
            this.container.appendChild(this.postGameMenu);
        }

        // ------------------------------
        // STATE
        // ------------------------------

        reset() {
            this.postGameMenu.style.display = 'none';
            this.awardOverlay.style.display = 'none';
            this.shopOverlay.style.display = 'none';
            this.msgEl.style.display = 'none';
            this.updateTimer(99);
            this.updateStars();
        }

        // ------------------------------
        // LOGIC
        // ------------------------------

        updateTimer(time) {
            const t = Math.ceil(time);
            // Keep markup so mono font stays
            this.timerEl.innerHTML = `<span class="mono">${t}</span>`;
            this.timerEl.style.borderColor = time < 27 ? 'var(--crayon-red)' : 'var(--ink)';
        }

        updateDebug(info) {
            this.debugEl.innerText = info;
        }

updateStocks(players) {
            this.stockContainer.innerHTML = '';
            players.forEach(p => {
                const slot = document.createElement('div');
                slot.className = 'sb-stock';
                const colorHex = '#' + p.color.toString(16).padStart(6, '0');

                const name = document.createElement('div');
                name.className = 'sb-stock-name';
                name.innerText = p.label;

                const lives = document.createElement('div');
                lives.className = 'sb-stock-lives';
                lives.style.color = colorHex;

                if (p.lives > 0) {
                    lives.innerText = '♥'.repeat(p.lives);
                } else {
                    lives.innerText = ''; // Clear hearts/text
                    
                    // Big Red X
                    const xMark = document.createElement('div');
                    xMark.className = 'sb-eliminated-x';
                    xMark.innerText = 'X';
                    slot.appendChild(xMark);
                    
                    // Dim the name slightly
                    name.style.opacity = '0.4';
                }

                slot.appendChild(name);
                slot.appendChild(lives);
                this.stockContainer.appendChild(slot);
            });
        }

showMessage(text, duration = 2000) {
            this.msgEl.innerHTML = text; // Changed to innerHTML for colored names
            this.msgEl.style.display = 'block';
            if (this.msgTimer) clearTimeout(this.msgTimer);
            this.msgTimer = setTimeout(() => {
                this.msgEl.style.display = 'none';
            }, duration);
        }

        updateStars() {
            const stars = window.flux.storage ? window.flux.storage.getStars() : 0;
            this.starEl.innerHTML = `<span class="mono">★ ${stars}</span>`;
        }

        triggerFlash() {
            this.flashEl.style.opacity = '1';
            setTimeout(() => {
                this.flashEl.style.opacity = '0';
            }, 100);
        }

        // ------------------------------
        // AWARD SEQUENCE
        // ------------------------------

        showStarAward(earned, total) {
            this.triggerFlash();
            this.awardOverlay.style.display = 'block';

            // Copy stays the same, just themed
            this.awardTitle.innerText = `// VICTORY  +${earned}`;
            this.awardSub.innerHTML = `<div style="font-family:'Space Mono', monospace; font-weight:700;">EARNED: +${earned}</div><div style="opacity:0.8; margin-top:6px;">TOTAL: <b>${total}</b> ★</div>`;

            // Reset animation
            this.awardIcon.style.transform = 'scale(0)';
            this.awardSub.style.opacity = '0';

            // Play animation
            setTimeout(() => {
                this.awardIcon.style.transform = 'scale(1)';
                if (window.flux.audio) window.flux.audio.playSFX('SHOCKWAVE');
            }, 200);

            setTimeout(() => {
                this.awardSub.style.opacity = '1';
            }, 800);
        }

        finishAwardSequence() {
            this.awardOverlay.style.display = 'none';
            this.postGameMenu.style.display = 'flex';
        }

        // ------------------------------
        // SHOP
        // ------------------------------

        toggleShop() {
            const isHidden = this.shopOverlay.style.display === 'none' || this.shopOverlay.style.display === '';
            if (isHidden) {
                this.shopOverlay.style.display = 'block';
                this.refreshShopList();
                this.selectItem(null);
if (window.flux.gameState) window.flux.gameState.timeScale = 0.0;
            } else {
                this.shopOverlay.style.display = 'none';
if (window.flux.gameState) window.flux.gameState.timeScale = 1.0;
            }
        }

        refreshShopList() {
            this.shopList.innerHTML = '';

            const head = document.createElement('div');
            head.innerHTML = `
              <span class="data-label">// AVAILABLE ITEMS</span>
              <div style="font-size:1.9rem; margin: 6px 0 8px 0; color: var(--crayon-blue);">Pick a doodad</div>
              <div style="font-family:'Space Mono', monospace; font-size: 0.85rem; opacity:0.7;">Tap an item to preview / buy / equip</div>
              <div style="height:10px"></div>
            `;
            this.shopList.appendChild(head);

            const items = window.flux.config.SHOP.ITEMS;
            const storage = window.flux.storage;

            for (const key in items) {
                const item = items[key];
                const owned = storage.hasItem(item.id);
const equipped = storage.isEquipped(item.id);

                const row = document.createElement('div');
                row.className = 'sb-shop-row';
                row.dataset.owned = owned ? 'true' : 'false';
row.dataset.equipped = equipped ? 'true' : 'false';
this.bindTap(row, () => {
                    window.flux.audio.playSFX('UI_CLICK');
                    this.selectItem(item);
                });

                const info = document.createElement('div');
                info.innerHTML = `<div style="font-size:1.35rem; font-weight:700; line-height:1;">${item.name}</div>`;
                if (owned) info.innerHTML += `<div style="font-family:'Space Mono', monospace; font-size:0.78rem; opacity:0.65; margin-top:4px;">${equipped ? 'EQUIPPED' : 'OWNED'}</div>`;
                else info.innerHTML += `<div style="font-family:'Space Mono', monospace; font-size:0.78rem; opacity:0.65; margin-top:4px;">COST</div>`;

                const price = document.createElement('div');
                price.className = 'sb-shop-price';
                price.innerText = owned ? '✔' : `${item.cost} ★`;
                price.style.color = owned ? 'var(--crayon-green)' : 'var(--crayon-yellow)';

                row.appendChild(info);
                row.appendChild(price);
                this.shopList.appendChild(row);
            }
        }

selectItem(item) {
            this.shopPreview.innerHTML = '';

            // 1. Setup 3D Preview Container
            const previewContainer = document.createElement('div');
            Object.assign(previewContainer.style, {
                width: '200px',
                height: '200px',
                margin: '0 auto',
                position: 'relative',
                background: 'radial-gradient(circle, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.1) 100%)',
                borderRadius: '50%',
                border: '3px dashed var(--ink)',
                overflow: 'hidden',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)'
            });
            this.shopPreview.appendChild(previewContainer);
            
            // Attach Mini Renderer Canvas
            if (this.miniRenderer) {
                this.miniRenderer.domElement.style.display = 'block';
                previewContainer.appendChild(this.miniRenderer.domElement);
            }

            // Update Scene
            if (this.previewMesh) {
                this.previewScene.remove(this.previewMesh);
                this.previewMesh = null;
            }

            if (!item) {
                // Remove canvas if no item selected to show placeholder text clearly
                if (this.miniRenderer && this.miniRenderer.domElement.parentNode) {
                    this.miniRenderer.domElement.parentNode.removeChild(this.miniRenderer.domElement);
                }
                
                this.shopPreview.innerHTML += `
                  <div style="font-size:2.1rem; color: var(--crayon-red); margin: 12px 0 8px 0; transform: rotate(-2deg);">Select an item</div>
                  <div style="font-family:'Space Mono', monospace; opacity:0.7; font-size: 0.9rem;">Tap list to preview.</div>
                `;
                return;
            }

            // Create Mesh based on Item ID
            this.previewMesh = this.createCosmeticMesh(item.id);
            if (this.previewMesh) {
                this.previewScene.add(this.previewMesh);
                // Reset rotation
                this.previewMesh.rotation.set(0, 0, 0);
            }

            const storage = window.flux.storage;
            const owned = storage.hasItem(item.id);
            const equipped = storage.isEquipped(item.id);

            this.shopPreview.innerHTML += `<span class="data-label" style="margin-top:10px">// ITEM</span>`;

            // Name
            const name = document.createElement('div');
            name.style.fontSize = '2.2rem';
            name.style.fontWeight = '700';
            name.style.color = 'var(--ink)';
            name.style.marginBottom = '4px';
            name.innerText = item.name;
            this.shopPreview.appendChild(name);

            // Desc
            const desc = document.createElement('div');
            desc.style.fontSize = '1.25rem';
            desc.style.lineHeight = '1.3';
            desc.style.opacity = '0.8';
            desc.style.marginTop = '10px';
            desc.innerText = item.description;
            this.shopPreview.appendChild(desc);

            // Action Button
            const btn = document.createElement('button');
            btn.className = 'crayon-btn';
            btn.style.marginTop = '22px';

            if (owned) {
                if (equipped) {
                    btn.innerText = 'UNEQUIP';
                    btn.classList.add('crayon-btn--ink');
                    this.bindTap(btn, () => {
                        storage.unequipItem(item.id);
                        this.refreshShopList();
                        this.selectItem(item);
                    });
                } else {
                    btn.innerText = 'EQUIP';
                    btn.classList.add('crayon-btn--green');
                    this.bindTap(btn, () => {
                        storage.equipItem(item.id);
                        window.flux.audio.playSFX('EQUIP');
                        this.selectItem(item);
                    });
                }
            } else {
                const canAfford = storage.getStars() >= item.cost;
                btn.innerText = `BUY FOR ${item.cost} ★`;
                btn.classList.add('crayon-btn--yellow');
                btn.disabled = !canAfford;

                if (canAfford) {
                    this.bindTap(btn, () => {
                        if (storage.spendStars(item.cost)) {
                            storage.unlockItem(item.id);
                            this.updateStars();
                            this.refreshShopList();
                            this.selectItem(item);
                            window.flux.audio.playSFX('EQUIP'); // Feedback
                        }
                    });
                }
            }

            this.shopPreview.appendChild(btn);

            // Status
            const status = document.createElement('div');
            status.style.marginTop = '10px';
            status.style.fontFamily = "'Space Mono', monospace";
            status.style.fontSize = '0.85rem';
            status.style.opacity = '0.7';
            status.innerText = owned ? (equipped ? 'Equipped on your fighter.' : 'In your collection.') : 'Not owned.';
            this.shopPreview.appendChild(status);
        }
createCosmeticMesh(id) {
            // Re-use the player's cosmetic generation logic for consistency
            const _matGold = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0x332200 });
            const _matWing = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: window.flux.toonGradient });
            const _matHair = new THREE.MeshLambertMaterial({ color: 0x6D4C41, flatShading: true });

            let mesh = null;

            if (id === 'crown_gold') {
                mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.2, 5), _matGold);
                mesh.rotation.x = 0.2;
            } else if (id === 'halo_gold') {
                mesh = new THREE.Group();
                const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 4, 8), _matGold);
                const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 4, 8), _matGold);
                r2.scale.setScalar(0.75);
                const r3 = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 4, 8), _matGold);
                r3.scale.setScalar(1.25);
                mesh.add(r1); mesh.add(r2); mesh.add(r3);
                mesh.rotation.x = Math.PI / 2; // Lay flat
                mesh.rotation.y = 0.5;
            } else if (id === 'the_roy') {
                mesh = new THREE.Group();
                const geoCurl = new THREE.DodecahedronGeometry(0.1, 0);
                const geoStrand = new THREE.TorusGeometry(0.34, 0.015, 3, 12, Math.PI);
                const numCurls = 16;
                const startAngle = 0.7; 
                const endAngle = Math.PI * 2 - 0.7;
                for(let i=0; i<numCurls; i++) {
                    const t = i / (numCurls - 1);
                    const angle = startAngle + t * (endAngle - startAngle);
                    const m = new THREE.Mesh(geoCurl, _matHair);
                    const r = 0.33;
                    m.position.set(Math.cos(angle)*r, 0.25+(Math.random()-0.5)*0.06, Math.sin(angle)*r);
                    m.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
                    m.scale.setScalar(0.8 + Math.random() * 0.4);
                    mesh.add(m);
                }
const s1 = new THREE.Mesh(geoStrand, _matHair);
                s1.position.set(0, 0.15, -0.12); 
                s1.rotation.y = Math.PI/2 - 0.25;
                mesh.add(s1);
                
                const s2 = new THREE.Mesh(geoStrand, _matHair);
                s2.position.set(0, 0.15, 0.12); 
                s2.rotation.y = Math.PI/2 + 0.25; 
                s2.scale.setScalar(1.1);
                mesh.add(s2);
            } else if (id === 'angel_wings') {
                mesh = new THREE.Group();
                const featherGeo = new THREE.BoxGeometry(0.12, 0.4, 0.04);
                
                const createWing = (isRight) => {
                    const wingGroup = new THREE.Group();
                    const dir = isRight ? 1 : -1;
                    const f1 = new THREE.Mesh(featherGeo, _matWing);
                    f1.position.set(dir * 0.1, 0.1, 0); f1.rotation.z = dir * -0.2;
                    wingGroup.add(f1);
                    const f2 = new THREE.Mesh(featherGeo, _matWing);
                    f2.position.set(dir * 0.22, 0.0, 0); f2.rotation.z = dir * -0.5; f2.scale.setScalar(0.9);
                    wingGroup.add(f2);
                    const f3 = new THREE.Mesh(featherGeo, _matWing);
                    f3.position.set(dir * 0.3, -0.12, 0); f3.rotation.z = dir * -0.8; f3.scale.setScalar(0.8);
                    wingGroup.add(f3);
                    return wingGroup;
                };

                const wLeft = createWing(true);
                wLeft.position.set(-0.25, 0.15, 0.12);
                wLeft.rotation.y = -2.5;
                wLeft.rotation.x = 0.1;
                wLeft.scale.y = -1; // Flip upside down

                const wRight = createWing(true);
                wRight.position.set(-0.25, 0.15, -0.12);
                wRight.rotation.y = 2.5;
                wRight.rotation.x = 0.1;
                wRight.scale.y = -1; // Flip upside down
                
                mesh.add(wLeft);
                mesh.add(wRight);
            }

            if (mesh) {
                mesh.scale.setScalar(1.5);
            }
            return mesh;
        }
createMultiplayerMenu() {
            this.mpOverlay = document.createElement('div');
            this.mpOverlay.className = 'sb-overlay sb-mp';
            this.mpOverlay.style.zIndex = '155';
            this.mpOverlay.style.display = 'none';

            this.mpCanvas = document.createElement('div');
            this.mpCanvas.className = 'notebook-canvas reveal';
            
            const pad = document.createElement('div');
            pad.className = 'sb-canvas-pad';
            this.mpCanvas.appendChild(pad);

            // Header
            const header = document.createElement('div');
            header.className = 'sb-header';
            header.innerHTML = `
                <div class="sb-entry">ENTRY_NO: 099</div>
                <h1 class="sb-title">Net<br>Lobby</h1>
                <div class="sb-subtitle">P2P Frequency Modulation</div>
            `;
            pad.appendChild(header);

            // Content
            const content = document.createElement('div');
            Object.assign(content.style, {
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                paddingBottom: '40px'
            });
            pad.appendChild(content);

            // Host Section
const hostBtn = document.createElement('button');
            hostBtn.className = 'crayon-btn crayon-btn--green';
            hostBtn.innerText = 'HOST MATCH';
            this.bindTap(hostBtn, () => {
                this.showMessage("INITIALIZING HOST...", 2000);
                if (this.onHost) this.onHost();
                this.toggleMultiplayer();
            });
            content.appendChild(hostBtn);

            // Divider
            const div = document.createElement('div');
            div.innerText = '- OR -';
            div.style.fontFamily = "'Space Mono', monospace";
            div.style.opacity = '0.5';
            content.appendChild(div);

            // Join Section
            const joinContainer = document.createElement('div');
            Object.assign(joinContainer.style, {
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center'
            });

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'ROOM ID (Optional)';
            Object.assign(input.style, {
                padding: '12px',
                border: '3px solid var(--ink)',
                borderRadius: '10px',
                fontFamily: "'Space Mono', monospace",
                fontSize: '1.2rem',
                width: '220px',
                outline: 'none',
                background: '#fff',
                textAlign: 'center',
                textTransform: 'uppercase'
            });
            
const joinBtn = document.createElement('button');
            joinBtn.className = 'crayon-btn crayon-btn--blue';
            joinBtn.innerText = 'JOIN';
            joinBtn.style.margin = '0';
            this.bindTap(joinBtn, () => {
                const id = input.value.trim();
                const targetName = id || "PUBLIC LOBBY";
                
                // Immediate Feedback
                this.showMessage(`CONNECTING TO<br>${targetName}`, 3000);

                if (this.onJoin) {
                    this.onJoin(id); 
                    this.toggleMultiplayer();
                }
            });

            joinContainer.appendChild(input);
            joinContainer.appendChild(joinBtn);
            content.appendChild(joinContainer);

            // Close
            const closeBtn = document.createElement('button');
            closeBtn.className = 'crayon-btn crayon-btn--ink sb-icon-btn';
            closeBtn.innerText = '✖';
            Object.assign(closeBtn.style, {
                position: 'absolute',
                top: '12px',
                right: '12px',
                margin: '0',
                pointerEvents: 'auto'
            });
            this.bindTap(closeBtn, () => this.toggleMultiplayer());
            this.mpCanvas.appendChild(closeBtn);

            this.mpOverlay.appendChild(this.mpCanvas);
            this.container.appendChild(this.mpOverlay);
        }

        createLobbyOverlay() {
            this.lobbyOverlay = document.createElement('div');
            this.lobbyOverlay.className = 'sb-overlay sb-lobby';
            this.lobbyOverlay.style.zIndex = '160';
            this.lobbyOverlay.style.display = 'none';

            this.lobbyCanvas = document.createElement('div');
            this.lobbyCanvas.className = 'notebook-canvas reveal';
            
            const pad = document.createElement('div');
            pad.className = 'sb-canvas-pad';
            this.lobbyCanvas.appendChild(pad);

            // Header
            const header = document.createElement('div');
            header.className = 'sb-header';
            header.innerHTML = `
                <div class="sb-entry">STATUS: WAITING</div>
                <h1 class="sb-title">Staging<br>Area</h1>
                <div class="sb-subtitle" id="lobby-room-id">ROOM: ...</div>
            `;
            pad.appendChild(header);

            // Player List
            this.lobbyList = document.createElement('div');
            Object.assign(this.lobbyList.style, {
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                margin: '30px 0',
                width: '100%',
                maxWidth: '500px',
                alignSelf: 'center'
            });
            pad.appendChild(this.lobbyList);

            // Action Area
            this.lobbyActions = document.createElement('div');
            Object.assign(this.lobbyActions.style, {
                marginTop: 'auto',
                display: 'flex',
                justifyContent: 'center',
                gap: '20px'
            });
            pad.appendChild(this.lobbyActions);

            // Start Button (Host Only)
            this.lobbyStartBtn = document.createElement('button');
            this.lobbyStartBtn.className = 'crayon-btn crayon-btn--green';
            this.lobbyStartBtn.innerText = 'START MATCH';
            this.bindTap(this.lobbyStartBtn, () => {
                if (this.onLobbyStart) this.onLobbyStart();
            });
            this.lobbyActions.appendChild(this.lobbyStartBtn);

            // Cancel Button
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'crayon-btn crayon-btn--red';
            cancelBtn.innerText = 'LEAVE';
            this.bindTap(cancelBtn, () => {
                if (this.onLobbyLeave) this.onLobbyLeave();
                this.hideLobby();
            });
            this.lobbyActions.appendChild(cancelBtn);

            this.lobbyOverlay.appendChild(this.lobbyCanvas);
            this.container.appendChild(this.lobbyOverlay);
        }

        showLobby(isHost, roomId) {
            this.lobbyOverlay.style.display = 'block';
            this.lobbyStartBtn.style.display = isHost ? 'block' : 'none';
            document.getElementById('lobby-room-id').innerText = `ROOM: ${roomId}`;
            this.updateLobbyList([], []); // Clear initially
        }

        hideLobby() {
            this.lobbyOverlay.style.display = 'none';
        }

        updateLobbyList(playersPresent, names) {
            this.lobbyList.innerHTML = '';
            const labels = ["P1 (HOST)", "P2", "P3", "P4"];
            const colors = ["#0088FF", "#FF3333", "#00CC00", "#FFAA00"];

            for (let i = 0; i < 4; i++) {
                const row = document.createElement('div');
                row.className = 'sb-shop-row'; // Reuse style
                
                const isPresent = playersPresent[i];
                const name = names[i] || "Waiting...";
                
                row.style.opacity = isPresent ? '1' : '0.5';
                row.style.borderColor = isPresent ? colors[i] : '#ccc';

                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="font-weight:700; color:${colors[i]}">${labels[i]}</div>
                        <div style="font-family:'Space Mono', monospace;">${name}</div>
                    </div>
                    <div>${isPresent ? 'READY' : '...'}</div>
                `;
                this.lobbyList.appendChild(row);
            }
        }

        toggleMultiplayer() {
            const isHidden = this.mpOverlay.style.display === 'none' || this.mpOverlay.style.display === '';
            if (isHidden) {
                this.mpOverlay.style.display = 'block';
                if (window.flux.gameState) window.flux.gameState.timeScale = 0.0;
            } else {
                this.mpOverlay.style.display = 'none';
                if (window.flux.gameState) window.flux.gameState.timeScale = 1.0;
            }
}

        // ------------------------------
        // MAIN MENU
        // ------------------------------

        createMainMenu() {
            this.mainMenu = document.createElement('div');
            this.mainMenu.className = 'sb-overlay'; 
            // Z-Index below Shop(150)/MP(155) but above HUD(100)
            this.mainMenu.style.zIndex = '145'; 
            this.mainMenu.style.background = 'rgba(253, 252, 240, 0.9)'; // Opaque paper
            this.mainMenu.style.display = 'flex';
            this.mainMenu.style.flexDirection = 'column';
            this.mainMenu.style.alignItems = 'center';
            this.mainMenu.style.justifyContent = 'center';
            
            // Title
            const title = document.createElement('h1');
            title.className = 'sb-title';
            title.style.fontSize = 'clamp(3.5rem, 12vw, 7rem)';
            title.style.marginBottom = '5px';
            title.style.lineHeight = '0.85';
            title.style.textAlign = 'center';
            title.style.transform = 'rotate(-3deg)';
            title.innerHTML = 'STONEWAVE<br>DUEL';
            this.mainMenu.appendChild(title);
            
            const sub = document.createElement('div');
            sub.className = 'sb-subtitle';
            sub.innerText = 'Physics-Based Tile Smasher';
            sub.style.marginBottom = '50px';
            sub.style.fontSize = '1.1rem';
            this.mainMenu.appendChild(sub);
            
            // Buttons
            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.flexDirection = 'column';
            btnContainer.style.gap = '15px';
            btnContainer.style.width = 'min(300px, 80vw)';
            
            // Single Player
            const playBtn = document.createElement('button');
            playBtn.className = 'crayon-btn crayon-btn--green';
            playBtn.innerText = 'SINGLE PLAYER';
            this.bindTap(playBtn, () => {
                window.flux.audio.playSFX('UI_CLICK');
                this.hideMainMenu();
                window.flux.startMatch();
            });
            
            // Multiplayer
            const mpBtn = document.createElement('button');
            mpBtn.className = 'crayon-btn crayon-btn--blue';
            mpBtn.innerText = 'MULTIPLAYER';
            this.bindTap(mpBtn, () => {
                window.flux.audio.playSFX('UI_CLICK');
                this.toggleMultiplayer(); 
            });
            
            // Shop
            const shopBtn = document.createElement('button');
            shopBtn.className = 'crayon-btn crayon-btn--red';
            shopBtn.innerText = 'CUSTOMIZE';
            this.bindTap(shopBtn, () => {
                window.flux.audio.playSFX('UI_CLICK');
                this.toggleShop();
            });

            btnContainer.appendChild(playBtn);
            btnContainer.appendChild(mpBtn);
            btnContainer.appendChild(shopBtn);
            
            this.mainMenu.appendChild(btnContainer);
            this.container.appendChild(this.mainMenu);
        }

        showMainMenu() {
            this.mainMenu.style.display = 'flex';
            this.topBar.style.display = 'none';
            this.timerEl.style.display = 'none';
            this.msgEl.style.display = 'none';
        }

        hideMainMenu() {
            this.mainMenu.style.display = 'none';
            this.topBar.style.display = 'flex';
            this.timerEl.style.display = 'block';
        }
    }

    window.flux.UI = UI;

    window.flux.UI = UI;
})();
