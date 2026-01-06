/**
 * STONEWAVE DUEL - TILE SYSTEM
 * Handles individual tile states and visuals.
 */
(function() {
    window.flux = window.flux || {};
    const config = window.flux.config;
    const STATES = config.TILES.STATES;

// Shared Geometry
    const _tileGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    
    // Shared Materials
// Shared Materials
    const _matSide = new THREE.MeshToonMaterial({ 
        color: config.TILES.COLORS.SIDE, 
        gradientMap: window.flux.toonGradient 
    });

// Outline Resources (Inverted Hull)
    const _matOutline = new THREE.MeshBasicMaterial({ 
        color: 0x000000, 
        side: THREE.BackSide 
    });


    // --- Texture Generation (Diamond Pattern) ---
// --- Texture Generation (Palette Based) ---
    function createTileTexture(palette) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // 1. Base (Deep Shadow - Gaps/Corners)
        ctx.fillStyle = palette.DEEP;
        ctx.fillRect(0, 0, 64, 64);

        // 2. Main Surface (Inset)
        ctx.fillStyle = palette.MAIN;
        ctx.fillRect(2, 2, 60, 60);

        // 3. Diamond Pattern
        // Draw Diamond Base
        ctx.beginPath();
        ctx.moveTo(32, 4);
        ctx.lineTo(60, 32);
        ctx.lineTo(32, 60);
        ctx.lineTo(4, 32);
        ctx.closePath();
        
        ctx.fillStyle = palette.SHADOW;
        ctx.fill();

        // 4. Diamond Highlights (Bevel)
        // Top-Left Edge (Highlight)
        ctx.beginPath();
        ctx.moveTo(32, 4);
        ctx.lineTo(4, 32);
        ctx.lineTo(32, 32);
        ctx.fillStyle = palette.HIGHLIGHT;
        ctx.fill();

        // Bottom-Right Edge (Deep Shadow)
        ctx.beginPath();
        ctx.moveTo(60, 32);
        ctx.lineTo(32, 60);
        ctx.lineTo(32, 32);
        ctx.fillStyle = palette.DEEP;
        ctx.fill();

        // Center Square (Main Color again)
        ctx.fillStyle = palette.MAIN;
        ctx.fillRect(24, 24, 16, 16);

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return tex;
    }

    const _texLight = createTileTexture(config.TILES.PALETTES.LIGHT);
    const _texDark = createTileTexture(config.TILES.PALETTES.DARK);
    
    // Grayscale Texture for Tinting (Preserves pattern when colored)
    const _texNeutral = createTileTexture({
        HIGHLIGHT: '#ffffff', // 255 (Max Brightness)
        MAIN: '#cccccc',      // 204 (Base Color)
        SHADOW: '#888888',    // 136 (Shadow)
        DEEP: '#444444'       // 68  (Deep Shadow)
    });

// --- Stone Texture (Granite + Diamond Pattern) ---
    function createStoneDiamondTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // 1. Base Concrete/Stone Grey (Noise Background)
        ctx.fillStyle = '#6e6e78'; 
        ctx.fillRect(0, 0, 64, 64);

        // Heavy Noise
        for(let i=0; i<400; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#50505a' : '#8c8c96';
            const x = Math.random() * 64;
            const y = Math.random() * 64;
            const s = 1 + Math.random() * 3;
            ctx.fillRect(x, y, s, s);
        }

        // 2. Overlay Diamond Structure (Semi-Transparent)
        const P = {
            DEEP: 'rgba(40, 40, 48, 0.8)',
            SHADOW: 'rgba(60, 60, 70, 0.5)',
            HIGHLIGHT: 'rgba(160, 160, 170, 0.5)'
        };

        // Border / Deep Corners
        ctx.strokeStyle = '#404048';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, 64, 64);

        // Diamond Shadow Base
        ctx.beginPath();
        ctx.moveTo(32, 4);
        ctx.lineTo(60, 32);
        ctx.lineTo(32, 60);
        ctx.lineTo(4, 32);
        ctx.closePath();
        ctx.fillStyle = P.SHADOW;
        ctx.fill();

        // Top-Left Highlight
        ctx.beginPath();
        ctx.moveTo(32, 4);
        ctx.lineTo(4, 32);
        ctx.lineTo(32, 32);
        ctx.fillStyle = P.HIGHLIGHT;
        ctx.fill();

        // Bottom-Right Deep
        ctx.beginPath();
        ctx.moveTo(60, 32);
        ctx.lineTo(32, 60);
        ctx.lineTo(32, 32);
        ctx.fillStyle = P.DEEP;
        ctx.fill();

        // Center Square (Stroke only to show noise)
        ctx.strokeStyle = P.SHADOW;
        ctx.lineWidth = 1;
        ctx.strokeRect(24.5, 24.5, 15, 15);

        // 3. Cracks / Weathering
        ctx.strokeStyle = '#303038';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        for(let i=0; i<3; i++) {
            ctx.beginPath();
            let cx = Math.random() * 64;
            let cy = Math.random() * 64;
            ctx.moveTo(cx, cy);
            for(let j=0; j<3; j++) {
                cx += (Math.random() - 0.5) * 20;
                cy += (Math.random() - 0.5) * 20;
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return tex;
    }

    const _texStone = createStoneDiamondTexture();

// --- SHARED MATERIAL SYSTEM (OPTIMIZED) ---
const _matLib = {
        STABLE_LIGHT: new THREE.MeshToonMaterial({ 
            color: 0xffffff, 
            map: _texLight, 
            gradientMap: window.flux.toonGradient 
        }),
        STABLE_DARK: new THREE.MeshToonMaterial({ 
            color: 0xffffff, 
            map: _texDark, 
            gradientMap: window.flux.toonGradient 
        }),
        STONE_LIGHT: new THREE.MeshToonMaterial({ 
            color: 0xffffff, 
            map: _texStone, 
            gradientMap: window.flux.toonGradient 
        }),
        STONE_DARK: new THREE.MeshToonMaterial({ 
            color: 0x888888, // Darker tint for dark tiles
            map: _texStone, 
            gradientMap: window.flux.toonGradient 
        }),
        FALLING: new THREE.MeshToonMaterial({ 
            color: 0xff0000, 
            gradientMap: window.flux.toonGradient 
        }),
        REFORMING: new THREE.MeshToonMaterial({ 
            color: 0x44aa44, 
            transparent: true, 
            opacity: 0.6,
            gradientMap: window.flux.toonGradient 
        }),
        CRACKED_DEFAULT: new THREE.MeshToonMaterial({
            color: 0xaa4444,
            map: _texNeutral, // Use pattern
            gradientMap: window.flux.toonGradient
        })
    };

    const _crackedCache = {};
    function _getCrackedMat(color) {
        if (!_crackedCache[color]) {
            _crackedCache[color] = new THREE.MeshToonMaterial({
                color: color,
                map: _texNeutral, // Use grayscale pattern to allow tinting while keeping detail
                gradientMap: window.flux.toonGradient
            });
        }
        return _crackedCache[color];
    }

class Tile {
        constructor(x, z, scene) {
            this.gridX = x;
            this.gridZ = z;
            this.state = STATES.STABLE;
            this.timer = 0;
            
            this.pendingState = null;
            this.pendingTimer = 0;
            
            this.isPermanent = false;
            this.owner = null;
            this.customColor = null;
            
            // Checkerboard
            this.isDark = (x + z) % 2 === 1;
            this.baseMat = this.isDark ? _matLib.STABLE_DARK : _matLib.STABLE_LIGHT;

            // Materials Array: [Right, Left, Top, Bottom, Front, Back]
            // We clone the array structure, but materials are shared references
            const materials = [
                _matSide, _matSide,
                this.baseMat, // Top (Index 2)
                _matSide, _matSide, _matSide
            ];

this.mesh = new THREE.Mesh(_tileGeo, materials);
            
            // Position
            this.baseY = -0.5;
            this.mesh.position.set(x, this.baseY, z);

            // Outline (Edges) - Restored
            this.outline = new THREE.Mesh(_tileGeo, _matOutline);
            this.outline.scale.setScalar(1.03); // Slight scale up for outline
            this.outline.userData.isOutline = true;
            this.outline.visible = config.PERFORMANCE.ENABLE_OUTLINES;
            this.mesh.add(this.outline);
            
            scene.add(this.mesh);
        }

setState(newState) {
            if (this.state === newState) return;

            this.state = newState;
            this.timer = 0;

            // Special Handling for FALLING: Preserve look, enable fade
if (this.state === STATES.FALLING) {
                // Clone materials to allow unique opacity without affecting others
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material = this.mesh.material.map(m => {
                        const c = m.clone();
                        c.transparent = true;
                        c.opacity = 1.0;
                        return c;
                    });
                }
                
                if (this.outline) {
                    this.outline.material = this.outline.material.clone();
                    this.outline.material.transparent = true;
                    this.outline.material.opacity = 1.0;
                }

                if (window.flux.particles) {
                    window.flux.particles.spawn('DEBRIS', this.mesh.position.clone(), 4, 0.4);
                }
                return; 
            }

            // Special Handling for REFORMING: Fade In (White/Normal look, not green)
            if (this.state === STATES.REFORMING) {
                this.mesh.visible = true;
                // Use Base Material (Stable look)
                this.mesh.material = [
                    _matSide, _matSide,
                    this.baseMat,
                    _matSide, _matSide, _matSide
                ];
                
                // Clone for transparency
                this.mesh.material = this.mesh.material.map(m => {
                    const c = m.clone();
                    c.transparent = true;
                    c.opacity = 0.0;
                    return c;
                });

                if (this.outline) {
                    this.outline.material = this.outline.material.clone();
                    this.outline.material.transparent = true;
                    this.outline.material.opacity = 0.0;
                }
                
                this.mesh.position.y = -3;
                return;
            }

            // Standard Logic: Reset to shared materials
            // Restore outline material to shared
            if (this.outline) {
                this.outline.material = _matOutline;
                this.outline.material.opacity = 1.0;
                this.outline.material.transparent = false;
            }

            // Determine Top Material
            let newTopMat = this.baseMat; // Default
            let visible = true;
            let yPos = this.baseY;
            let rot = {x:0, y:0, z:0};

            switch(this.state) {
                case STATES.STABLE:
                    newTopMat = this.baseMat;
                    this.customColor = null;
                    this.owner = null;
                    break;

                case STATES.CRACKED:
                    if (this.customColor !== null) {
                        newTopMat = _getCrackedMat(this.customColor);
                    } else {
                        newTopMat = _matLib.CRACKED_DEFAULT;
                    }
                    break;

                // FALLING handled above

                case STATES.MISSING:
                    visible = false;
                    break;

                case STATES.REFORMING:
                    newTopMat = _matLib.REFORMING;
                    yPos = -3;
                    break;
                
                case STATES.STONE:
                    newTopMat = this.isDark ? _matLib.STONE_DARK : _matLib.STONE_LIGHT;
                    break;
            }

            // Apply Changes
            this.mesh.visible = visible;
            if (visible) {
                // Reconstruct shared material array
                // [Right, Left, Top, Bottom, Front, Back]
                this.mesh.material = [
                    _matSide, _matSide,
                    newTopMat,
                    _matSide, _matSide, _matSide
                ];
                
                this.mesh.position.y = yPos;
                this.mesh.rotation.set(rot.x, rot.y, rot.z);
            }
        }

        update(dt) {
            this.timer += dt;

            if (this.pendingState !== null) {
                this.pendingTimer -= dt;
                if (this.pendingTimer <= 0) {
                    this.setState(this.pendingState);
                    this.pendingState = null;
                }
            }

            switch(this.state) {
                case STATES.CRACKED:
                    const shakeAmt = 0.05;
                    this.mesh.position.x = this.gridX + (Math.random() - 0.5) * shakeAmt;
                    this.mesh.position.z = this.gridZ + (Math.random() - 0.5) * shakeAmt;
                    break;

case STATES.FALLING:
                    this.mesh.position.y -= 20 * dt; 
                    this.mesh.position.x = this.gridX;
                    this.mesh.position.z = this.gridZ;
                    
                    // Fade Out Logic
                    // Fade from Y=-0.5 down to Y=-15
                    const fadeStart = -0.5;
                    const fadeEnd = -15.0;
                    const progress = (this.mesh.position.y - fadeStart) / (fadeEnd - fadeStart);
                    const opacity = 1.0 - Math.min(1.0, Math.max(0.0, progress));
                    
                    if (Array.isArray(this.mesh.material)) {
                        this.mesh.material.forEach(m => m.opacity = opacity);
                    }
                    if (this.outline) {
                        this.outline.material.opacity = opacity;
                    }

                    if (this.timer > 0.8) this.setState(STATES.MISSING);
                    break;

                case STATES.MISSING:
                    this.mesh.position.x = this.gridX;
                    this.mesh.position.z = this.gridZ;
                    if (!this.isPermanent && this.timer > config.ARENA.RETURN_TIME) {
                        this.setState(STATES.REFORMING);
                    }
                    break;

case STATES.REFORMING:
                    const reformTime = config.TILES.TIMING.REFORM_TO_STABLE;
                    if (this.timer >= reformTime) {
                        this.setState(STATES.STABLE);
                        if (window.flux.particles) {
                            const pos = this.mesh.position.clone();
                            pos.y = 0;
                            window.flux.particles.spawn('DUST', pos, 4, 0.5);
                        }
                    } else {
                        const progress = this.timer / reformTime;
                        const t = 1 - Math.pow(1 - progress, 3);
                        this.mesh.position.y = THREE.MathUtils.lerp(-3, this.baseY, t);
                        
                        // Fade In
                        const opacity = progress;
                        if (Array.isArray(this.mesh.material)) {
                            this.mesh.material.forEach(m => m.opacity = opacity);
                        }
                        if (this.outline) {
                            this.outline.material.opacity = opacity;
                        }
                    }
                    break;
            }
        }

        triggerFall(delay) {
            if (this.state === STATES.MISSING || this.state === STATES.FALLING) return;
            if (this.pendingState === STATES.FALLING) {
                if (delay < this.pendingTimer) this.pendingTimer = delay;
            } else {
                this.pendingState = STATES.FALLING;
                this.pendingTimer = delay;
            }
        }

        setCracked(owner) {
            this.owner = owner;
            this.customColor = owner.color;
            // Force update to apply color material
            this.setState(config.TILES.STATES.CRACKED);
            // If already cracked, setState might return early, so we force material update if needed
            if (this.state === config.TILES.STATES.CRACKED) {
                 this.mesh.material[2] = _getCrackedMat(this.customColor);
            }
        }
    }

window.flux.Tile = Tile;
})();