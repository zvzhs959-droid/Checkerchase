/**
 * STONEWAVE DUEL - SHOCKWAVE SYSTEM
 * A massive, V-formation energy wave.
 */
(function() {
    window.flux = window.flux || {};
    const config = window.flux.config;

    // --- TEXTURE GENERATION (HIGH ENERGY) ---
    const _waveTexture = (function() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // 1. Background (Transparent)
        ctx.clearRect(0, 0, 512, 256);

        // 2. Base Glow (Vertical Gradient)
        const gradV = ctx.createLinearGradient(0, 0, 0, 256);
        gradV.addColorStop(0, 'rgba(255,255,255,0)');
        gradV.addColorStop(0.2, 'rgba(255,255,255,0.2)');
        gradV.addColorStop(0.5, 'rgba(255,255,255,0.9)'); // Core
        gradV.addColorStop(0.8, 'rgba(255,255,255,0.2)');
        gradV.addColorStop(1, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = gradV;
        ctx.fillRect(0, 0, 512, 256);

        // 3. Energy Streaks (Horizontal Motion Blur)
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 120; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 256;
            const w = 50 + Math.random() * 150; // Long streaks
            const h = 2 + Math.random() * 6;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.4})`;
            ctx.fillRect(x, y, w, h);
        }

const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        
        // Fix: Disable mipmaps to prevent transparency bleed at distance (facing up)
        // This keeps the glow bright even when the wave moves away from the camera
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;

        // Fix: Enable Anisotropy for grazing angles (prevents texture disappearing when viewed edge-on)
        if (window.flux.renderer && window.flux.renderer.renderer) {
            tex.anisotropy = window.flux.renderer.renderer.capabilities.getMaxAnisotropy();
        }
        
        return tex;
    })();

    // --- GEOMETRY (V-FORMATION) ---
    // A chevron shape standing up.
// --- GEOMETRY (V-FORMATION - HERCULEAN SCALE) ---
    // A massive chevron shape standing up.
const _vGeo = (function() {
        const geo = new THREE.BufferGeometry();
        
        // --- ARROWHEAD GEOMETRY CONFIGURATION ---
        // Re-oriented to fly Point-First (Tip at +Z) for proper "Wake" physics.
        // Added Back Cap for visibility from behind.
        
const W = 0.5;         // Wing Width (Horizontal) - Reduced (was 0.8)
        const FinW = 0.15;     // Fin Base Width (Tent thickness)
        const H = 0.4;         // Fin Height - Reduced significantly (was 1.4)
        const L_Lead = 0.5;    // Local Z Front (Tip) - Points to Target (+Z)
        const L_Trail = -0.5;  // Local Z Back (Tail) - Trailing (-Z)
        const Lean = -0.4;     // Lean back (Top trails bottom)

        const vertices = [];
        const uvs = [];

        // Helper: Push Triangle
        const addTri = (p1, p2, p3, uv1, uv2, uv3) => {
            vertices.push(...p1, ...p2, ...p3);
            uvs.push(...uv1, ...uv2, ...uv3);
        };

        // --- 1. HORIZONTAL BASE (The Wake) ---
        // V-shape lying on the ground.
        // U: Flow (0 Front -> 1 Back). V: Center (0.5) -> Edge (0/1).
        
        // Left Wing
        addTri(
            [0, 0, L_Lead],    [-W, 0, L_Trail],   [0, 0, L_Trail],
            [0, 0.5],          [1, 0.0],           [1, 0.5]
        );
        
        // Right Wing
        addTri(
            [0, 0, L_Lead],    [0, 0, L_Trail],    [W, 0, L_Trail],
            [0, 0.5],          [1, 0.5],           [1, 1.0]
        );

        // --- 2. VERTICAL FIN (The Crest) ---
        // Tent shape rising from the center spine.
        
        const BF_L = [-FinW, 0, L_Lead];    // Bottom Front Left (At Tip)
        const BF_R = [FinW, 0, L_Lead];     // Bottom Front Right (At Tip)
        const BB_L = [-FinW, 0, L_Trail];   // Bottom Back Left (At Tail)
        const BB_R = [FinW, 0, L_Trail];    // Bottom Back Right (At Tail)
        
        const TF = [0, H, L_Lead + Lean];   // Top Front
        const TB = [0, H, L_Trail + Lean];  // Top Back
        
        // Left Face
        addTri(BF_L, BB_L, TB, [0, 0.0], [1, 0.0], [1, 0.5]);
        addTri(BF_L, TB, TF,   [0, 0.0], [1, 0.5], [0, 0.5]);
        
        // Right Face
        addTri(BF_R, BB_R, TB, [0, 1.0], [1, 1.0], [1, 0.5]);
        addTri(BF_R, TB, TF,   [0, 1.0], [1, 0.5], [0, 0.5]);

        // --- 3. BACK CAP (CRITICAL FIX) ---
        // Closes the "Tent" at the trailing edge.
        // This face looks towards -Z (Back), making the wave visible when moving away.
        addTri(
            BB_L, BB_R, TB,
            [1, 0.2], [1, 0.8], [1, 0.5] // Map to bright section of texture
        );
        
        // --- 4. FRONT CAP ---
        // Closes the tip.
        addTri(
            BF_L, TF, BF_R, 
            [0, 0.2], [0, 0.5], [0, 0.8]
        );

        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.computeVertexNormals();
        
return geo;
    })();

    // --- GEOMETRY (WAKE ONLY - FLAT) ---
    const _geoWake = (function() {
        const geo = new THREE.BufferGeometry();
        const W = 0.7; // Slightly wider than V-Geo
        const L_Lead = 0.5;
        const L_Trail = -0.5;
        
        const vertices = [];
        const uvs = [];
        const addTri = (p1, p2, p3, uv1, uv2, uv3) => {
            vertices.push(...p1, ...p2, ...p3);
            uvs.push(...uv1, ...uv2, ...uv3);
        };

        // Left Wing
        addTri([0, 0, L_Lead], [-W, 0, L_Trail], [0, 0, L_Trail], [0, 0.5], [1, 0.0], [1, 0.5]);
        // Right Wing
        addTri([0, 0, L_Lead], [0, 0, L_Trail], [W, 0, L_Trail], [0, 0.5], [1, 0.5], [1, 1.0]);

        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.computeVertexNormals();
        return geo;
    })();

// --- GRAVITY DISTORTION SHADER ---
// --- FLOW MAP SHADER (For Distortion Pass) ---
    const _flowShader = {
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                // Inflate slightly to encompass the visual mesh
                vec3 pos = position + normal * 0.2;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uOpacity;
            varying vec2 vUv;

            // Simple Hash Noise
            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }

            void main() {
                vec2 uv = vUv;
                
                // Animate Noise Flow - Turbulent Wake
                float time = uTime * 5.0;
                
                // Generate Flow Vectors
                // Create a swirling wake pattern
                float n1 = noise(uv * 5.0 - vec2(0.0, time)); 
                float n2 = noise(uv * 5.0 + vec2(time * 0.5, 0.0)); 
                
                vec2 flow = vec2(n1, n2);
                
                // Alpha Masking - Soft edges to blend into the world
                float alpha = smoothstep(0.0, 0.3, uv.x) * (1.0 - smoothstep(0.7, 1.0, uv.x));
                alpha *= smoothstep(0.0, 0.3, uv.y) * (1.0 - smoothstep(0.7, 1.0, uv.y));
                
                // Pulse intensity
                float pulse = 0.8 + 0.2 * sin(time * 3.0);
                
                // Output: RG = Flow, A = Strength
                // Multiply by uOpacity for trail fading
                gl_FragColor = vec4(flow, 0.0, alpha * pulse * uOpacity);
            }
        `
};

    // --- OBJECT POOL FOR TRAILS ---
    // Eliminates runtime allocation for high-frequency trail segments
    const _trailPool = (function() {
        const pool = [];
        const MAX_POOL_SIZE = 300; 

        return {
            get: function() {
                if (pool.length > 0) {
                    return pool.pop();
                }
                
                // Create new set if pool empty
                // 1. Distortion Material (Shader)
                const mat = new THREE.ShaderMaterial({
                    vertexShader: _flowShader.vertexShader,
                    fragmentShader: _flowShader.fragmentShader,
                    uniforms: {
                        uTime: { value: 0 },
                        uOpacity: { value: 1.0 }
                    },
                    transparent: true,
                    side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(undefined, mat); // Geometry set on use
                mesh.layers.set(1); // Distortion Layer

                // 2. Visual Material (Basic)
                const visMat = new THREE.MeshBasicMaterial({
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                const visMesh = new THREE.Mesh(undefined, visMat);

                return { mesh, material: mat, visMesh, visMaterial: visMat };
            },
            
            release: function(item) {
                if (pool.length < MAX_POOL_SIZE) {
                    // Reset basic state
                    item.mesh.visible = true;
                    item.visMesh.visible = true;
                    item.mesh.scale.set(1,1,1);
                    item.visMesh.scale.set(1,1,1);
                    
                    // Detach from scene to be safe
                    if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
                    if (item.visMesh.parent) item.visMesh.parent.remove(item.visMesh);

                    pool.push(item);
                } else {
                    // Overflow: Dispose
                    item.material.dispose();
                    item.visMaterial.dispose();
                }
            }
        };
    })();

class Shockwave {
        constructor(scene, arena) {
            this.scene = scene;
            this.arena = arena;
            
            this.active = false;
            this.mesh = new THREE.Group();
            
            // Texture (Cloned for independent UV scrolling)
            this.texture = _waveTexture.clone();
            this.texture.wrapS = THREE.RepeatWrapping;
            this.texture.wrapT = THREE.RepeatWrapping;
            this.texture.repeat.set(1, 1);

            // Materials (Created once, properties updated in init)
            this.matCore = new THREE.MeshBasicMaterial({
                map: this.texture,
                color: 0xffffff,
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            
            this.matMain = new THREE.MeshBasicMaterial({
                map: this.texture,
                color: 0xffffff,
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            
            this.matGlow = new THREE.MeshBasicMaterial({
                map: this.texture,
                color: 0xffffff,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            // Meshes
            this.core = new THREE.Mesh(_vGeo, this.matCore);
            this.core.scale.set(0.7, 0.8, 0.7);
            this.mesh.add(this.core);

            this.main = new THREE.Mesh(_vGeo, this.matMain);
            this.mesh.add(this.main);

            this.glow = new THREE.Mesh(_vGeo, this.matGlow);
            this.glow.scale.set(1.4, 1.3, 1.4);
            this.mesh.add(this.glow);

            this.scene.add(this.mesh);
            this.mesh.visible = false;
            
            this.trails = [];
            this.hitTiles = [];
            
            // State
            this.owner = null;
            this.type = null;
            this.geometry = _vGeo;
        }

        init(owner, type, options = {}) {
            this.owner = owner;
            this.type = type;
            this.active = true;
            this.isMoving = true;
            this.distanceTraveled = 0;
            this.aliveTime = 0;
            this.trailTimer = 0;
            this.hitTiles.length = 0;
            
            // Options
            this.geometry = options.geometry || _vGeo;
            let speedMult = options.speedMult || 1.0;

            // CRYSTAL POWERUP: Faster Shockwaves
            if (owner.activePowerup && owner.activePowerup.type === 'CRYSTAL') {
                speedMult *= config.POWERUPS.TYPES.CRYSTAL.SHOCKWAVE_SPEED_MULT;
            }

            const conf = config.SHOCKWAVE[type];
            this.speed = conf.SPEED * speedMult;
            this.maxRange = conf.RANGE;
            
            // 1. Direction
            const forward = owner.getForward();
            this.direction = new THREE.Vector3();
            if (Math.abs(forward.x) > Math.abs(forward.z)) {
                this.direction.set(Math.sign(forward.x), 0, 0);
            } else {
                this.direction.set(0, 0, Math.sign(forward.z));
            }

            // Brightness Adjustment based on direction
            const isSideMove = Math.abs(this.direction.x) > 0.1;
            const opacityMult = isSideMove ? 0.5 : 1.0;

            // 2. Start Position
            const gridX = Math.round(owner.position.x);
            const gridZ = Math.round(owner.position.z);
            this.position = new THREE.Vector3(gridX, 0.1, gridZ);
            this.position.add(this.direction.clone().multiplyScalar(0.8));
            
            // --- VISUALS UPDATE ---
            
            // Color Logic
            let baseC = new THREE.Color(owner.color);
            if (owner.activePowerup && owner.activePowerup.type === 'CRYSTAL') {
                baseC.setHex(0x00ffff);
            }

            const hsl = {};
            baseC.getHSL(hsl);
            
            // Update Materials
            this.matCore.color.setHSL(hsl.h, 0.5, 0.95);
            this.matCore.opacity = 1.0 * opacityMult;

            this.matMain.color.setHSL(hsl.h, 1.0, 0.75);
            this.matMain.opacity = 1.0 * opacityMult;

            this.matGlow.color.setHSL(hsl.h, 1.0, 0.5);
            this.matGlow.opacity = 0.5 * opacityMult;

            // Update Geometry
            this.core.geometry = this.geometry;
            this.main.geometry = this.geometry;
            this.glow.geometry = this.geometry;

            // Reset Transforms
            this.mesh.position.copy(this.position);
            const target = this.position.clone().add(this.direction);
            this.mesh.lookAt(target);
            this.mesh.scale.setScalar(1);
            this.mesh.rotation.z = 0;
            this.mesh.visible = true;
            
            // Reset Texture Offset
            this.texture.offset.set(0, 0);
            
            // Logic Reset
            this.lastTileX = -999;
            this.lastTileZ = -999;
        }

        update(dt) {
            if (!this.active) return;

            this.aliveTime += dt;

            // --- 1. Update Trails ---
            for (let i = this.trails.length - 1; i >= 0; i--) {
                const t = this.trails[i];
                t.life -= dt;
                
                // Sync time for flow effect
                t.material.uniforms.uTime.value = this.aliveTime;
                
                const progress = Math.max(0, t.life / 0.45);
                t.material.uniforms.uOpacity.value = progress;
                
                const heightScale = Math.pow(progress, 2.5) * 1.5; 
                t.mesh.scale.y = heightScale;
                
                if (t.visMaterial) {
                    t.visMaterial.opacity = progress * 0.4;
                    if (t.visMesh) t.visMesh.scale.y = heightScale;
                }
                
                if (t.life <= 0) {
                    _trailPool.release(t);
                    this.trails.splice(i, 1);
                }
            }

            // If wave is finished and trails are gone, deactivate
            if (!this.isMoving) {
                if (this.trails.length === 0) {
                    this.reset();
                }
                return;
            }

            // --- 2. Main Wave Animation ---
            this.texture.offset.x -= dt * 2.5;
            const growth = 1.0 + (this.distanceTraveled * 0.01); 
            const pulse = 1.0 + Math.sin(this.aliveTime * 15) * 0.05;
            this.mesh.scale.setScalar(growth * pulse);
            this.mesh.rotation.z = (Math.random() - 0.5) * 0.08;

            // --- 3. Spawn Trail ---
            this.trailTimer += dt;
            if (this.trailTimer > 0.04) {
                this.trailTimer = 0;
                this.spawnTrailSegment();
            }

            // --- 4. Particles ---
            if (window.flux.particles) {
                const px = -this.direction.z;
                const pz = this.direction.x;
                const offset = 0.4;
                
                if (Math.random() > 0.2) {
                    const p1 = this.position.clone();
                    p1.x += px * offset; p1.z += pz * offset; p1.y = 0.1;
                    window.flux.particles.spawn('SPARK', p1, 1, 0.2);
                }
                if (Math.random() > 0.2) {
                    const p2 = this.position.clone();
                    p2.x -= px * offset; p2.z -= pz * offset; p2.y = 0.1;
                    window.flux.particles.spawn('SPARK', p2, 1, 0.2);
                }
            }

            // --- 5. Movement ---
            const moveDist = this.speed * dt;
            const startPos = this.position.clone();
            this.position.addScaledVector(this.direction, moveDist);
            this.distanceTraveled += moveDist;
            this.mesh.position.copy(this.position);

            // --- 6. Logic ---
            if (this.distanceTraveled >= this.maxRange) {
                this.finish();
                return;
            }

            // Collision Check
            const axis = this.direction.x !== 0 ? 'x' : 'z';
            const dirSign = this.direction[axis] > 0 ? 1 : -1;
            let currentVal = Math.round(startPos[axis]);
            const targetVal = Math.round(this.position[axis]);
            let t = currentVal;
            let reached = false;

            while (!reached) {
                const tx = axis === 'x' ? t : Math.round(this.position.x);
                const tz = axis === 'z' ? t : Math.round(this.position.z);

                if (tx !== this.lastTileX || tz !== this.lastTileZ) {
                    this.lastTileX = tx;
                    this.lastTileZ = tz;
                    const tile = this.arena.getTile(tx, tz);
                    if (tile) {
                        this.processTileHit(tile);
                    } else {
                        this.finish();
                        return;
                    }
                }
                if (t === targetVal) reached = true;
                else t += dirSign;
            }
        }
        
        spawnTrailSegment() {
            const item = _trailPool.get();
            
            // Distortion
            item.mesh.geometry = this.geometry;
            item.mesh.position.copy(this.mesh.position);
            item.mesh.rotation.copy(this.mesh.rotation);
            item.mesh.scale.set(2.4, 1.5, 2.4); 
            item.material.uniforms.uOpacity.value = 0.8;
            this.scene.add(item.mesh);

            // Visual
            item.visMesh.geometry = this.geometry;
            item.visMesh.position.copy(this.mesh.position);
            item.visMesh.rotation.copy(this.mesh.rotation);
            item.visMesh.scale.set(2.4, 1.5, 2.4); 
            
            item.visMaterial.map = this.texture;
            item.visMaterial.color.copy(this.matMain.color); // Use calculated color
            item.visMaterial.opacity = 0.4;
            this.scene.add(item.visMesh);

            item.life = 0.45;
            this.trails.push(item); 
        }

        processTileHit(tile) {
            const STATES = config.TILES.STATES;
            if (tile.state === STATES.STABLE || tile.state === STATES.CRACKED) {
                tile.setCracked(this.owner);
                this.hitTiles.push(tile);
                window.flux.renderer.addShake(0.15);
            }
        }

        finish() {
            if (!this.isMoving) return;
            
            this.isMoving = false;
            this.mesh.visible = false;
            
            const fallDelay = config.SHOCKWAVE.FALL_DELAY;
            const seqMult = config.SHOCKWAVE.FALL_SEQUENCE_MULT;
            const rippleDuration = this.aliveTime * seqMult;
            const count = this.hitTiles.length;
            
            if (count > 0) {
                this.hitTiles.forEach((tile, index) => {
                    const progress = count > 1 ? index / (count - 1) : 0;
                    const delay = fallDelay + (progress * rippleDuration);
                    tile.triggerFall(delay);
                });
            }
        }

        reset() {
            this.active = false;
            this.mesh.visible = false;
            
            // Release trails
            for (let i = 0; i < this.trails.length; i++) {
                _trailPool.release(this.trails[i]);
            }
            this.trails.length = 0;
        }
    }

    class ShockwaveManager {
        constructor(scene, arena) {
            this.scene = scene;
            this.arena = arena;
            this.waves = []; // Active waves
            this.pool = [];  // Inactive waves
        }

        getWave() {
            if (this.pool.length > 0) {
                return this.pool.pop();
            }
            return new Shockwave(this.scene, this.arena);
        }

        spawn(owner, type) {
            // 1. Main Wave (Fast, Full V-Shape)
            const w1 = this.getWave();
            w1.init(owner, type, { geometry: _vGeo });
            this.waves.push(w1);

            // 2. Under Wave (Slow, Flat Wake)
            const w2 = this.getWave();
            w2.init(owner, type, { geometry: _geoWake, speedMult: 0.55 });
            this.waves.push(w2);

            console.log(`FluxCode: Spawned Dual Shockwave (${type}) [Active: ${this.waves.length}, Pool: ${this.pool.length}]`);
        }

        update(dt) {
            for (let i = this.waves.length - 1; i >= 0; i--) {
                const w = this.waves[i];
                w.update(dt);
                if (!w.active) {
                    // Return to pool
                    this.pool.push(w);
                    this.waves.splice(i, 1);
                }
            }
        }
    }

    window.flux.ShockwaveManager = ShockwaveManager;

    // Expose Distortion Factory for other effects (e.g. Crystal Powerup)
    window.flux.createDistortionMesh = function() {
        const geo = new THREE.PlaneBufferGeometry(1, 1);
        const mat = new THREE.ShaderMaterial({
            vertexShader: _flowShader.vertexShader,
            fragmentShader: _flowShader.fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uOpacity: { value: 1.0 }
            },
            transparent: true,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.layers.set(1); // Distortion Layer
        return mesh;
    };
})();