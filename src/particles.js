/**
 * STONEWAVE DUEL - PARTICLE SYSTEM (OPTIMIZED)
 * Uses THREE.InstancedMesh for massive performance gains.
 * Reduces hundreds of draw calls to ~4.
 */
(function() {
    window.flux = window.flux || {};

    // Shared Helper for Matrix Calculation
    const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
    const _pVel = new THREE.Vector3(); // Reusable velocity vector

    // --- GEOMETRIES ---
const _geoDust = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const _geoDebris = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const _geoSpark = new THREE.PlaneBufferGeometry(0.3, 0.3);
    const _geoStar = new THREE.PlaneBufferGeometry(0.4, 0.4);
    const _geoLine = new THREE.BoxGeometry(0.05, 0.05, 1.2); // Speed Line

    // --- TEXTURES ---
    const _texStarSheet = new THREE.TextureLoader().load('https://i.postimg.cc/pdFG9pJF/ezgif-com-gif-to-sprite-converter-(28).png');
    _texStarSheet.magFilter = THREE.NearestFilter;
    _texStarSheet.minFilter = THREE.NearestFilter;
    // Note: Repeat is handled in shader for InstancedMesh

    // --- MATERIALS ---
    const _matDust = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.6 
    });
    
    const _matDebris = new THREE.MeshBasicMaterial({ 
        color: 0xffffff // Vertex colors will tint this
    });

    const _matSpark = new THREE.MeshBasicMaterial({ 
        color: 0xffff00, 
        transparent: true, 
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    // Custom Shader for Star Sprites (Instanced)
// Custom Shader for Star Sprites (Instanced)
    const _matStarShader = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: _texStarSheet }
        },
        vertexColors: true, // Enable vertex color support
        vertexShader: `
            attribute float aFrame;
            varying vec2 vUv;
            varying vec3 vColor;
            
            void main() {
                #ifdef USE_INSTANCING_COLOR
                    vColor = instanceColor;
                #else
                    vColor = vec3(1.0);
                #endif
                
                // Sprite Sheet Logic (4 frames horizontal)
                float frames = 4.0;
                float frameWidth = 1.0 / frames;
                
                vUv = uv;
                vUv.x = (vUv.x * frameWidth) + (aFrame * frameWidth);
                
                // Billboard Logic (Face Camera)
                // Extract scale from instance matrix
                vec4 col0 = instanceMatrix[0];
                vec4 col1 = instanceMatrix[1];
                vec4 col2 = instanceMatrix[2];
                float sx = length(col0.xyz);
                float sy = length(col1.xyz);
                float sz = length(col2.xyz);

                // Reconstruct View-Aligned Matrix
                // We use the modelViewMatrix directly but replace rotation with identity
                // This is a simplified billboard approach for InstancedMesh
                
                vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                
                // Offset by vertex position scaled
                mvPosition.xy += position.xy * vec2(sx, sy);
                
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            varying vec3 vColor;
            uniform sampler2D map;
            
            void main() {
                vec4 tex = texture2D(map, vUv);
                gl_FragColor = vec4(tex.rgb * vColor, tex.a);
                if (gl_FragColor.a < 0.1) discard;
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    /**
     * Generic Batch for Instanced Particles
     */
    class ParticleBatch {
        constructor(scene, geometry, material, maxCount) {
            this.maxCount = maxCount;
            this.count = 0;
            
            // Data Arrays
            this.data = [];
            for(let i=0; i<maxCount; i++) {
                this.data.push({
                    active: false,
                    life: 0,
                    maxLife: 1,
                    position: new THREE.Vector3(),
                    velocity: new THREE.Vector3(),
                    rotationSpeed: new THREE.Vector3(),
                    scale: 1.0,
                    rotation: new THREE.Euler()
                });
            }

            // Mesh
            this.mesh = new THREE.InstancedMesh(geometry, material, maxCount);
            this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.mesh.frustumCulled = false; // Always update
            scene.add(this.mesh);
            
            // Initialize all to scale 0 (hidden)
            for(let i=0; i<maxCount; i++) {
                _dummy.position.set(0, -9999, 0);
                _dummy.scale.set(0, 0, 0);
                _dummy.updateMatrix();
                this.mesh.setMatrixAt(i, _dummy.matrix);
            }
        }

spawn(pos, vel, life, scale, colorHex = null, rotation = null) {
            // Find first inactive
            let p = null;
            let index = -1;
            
            // Simple linear search
            for(let i=0; i<this.maxCount; i++) {
                if (!this.data[i].active) {
                    p = this.data[i];
                    index = i;
                    break;
                }
            }
            
            if (!p) {
                index = Math.floor(Math.random() * this.maxCount);
                p = this.data[index];
            }

            p.active = true;
            p.life = life;
            p.maxLife = life;
            p.position.copy(pos);
            p.velocity.copy(vel);
            p.scale = scale;
            
            if (rotation) {
                p.rotation.copy(rotation);
                p.rotationSpeed.set(0, 0, 0);
            } else {
                // Random rotation
                p.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
                p.rotationSpeed.set(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                );
            }

            // Set Color
            if (colorHex !== null) {
                _color.setHex(colorHex);
                this.mesh.setColorAt(index, _color);
                if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
            }
        }

        update(dt) {
            let dirty = false;
            
            for(let i=0; i<this.maxCount; i++) {
                const p = this.data[i];
                if (!p.active) continue;

                p.life -= dt;
                if (p.life <= 0) {
                    p.active = false;
                    // Hide
                    _dummy.position.set(0, -9999, 0);
                    _dummy.scale.set(0, 0, 0);
                    _dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, _dummy.matrix);
                    dirty = true;
                    continue;
                }

                // Physics
                p.velocity.y -= 20 * dt; // Gravity
                p.position.addScaledVector(p.velocity, dt);

                // Rotation
                p.rotation.x += p.rotationSpeed.x * dt;
                p.rotation.y += p.rotationSpeed.y * dt;
                p.rotation.z += p.rotationSpeed.z * dt;

                // Scale (Fade out)
                const progress = p.life / p.maxLife;
                const currentScale = p.scale * progress;

                // Update Matrix
                _dummy.position.copy(p.position);
                _dummy.rotation.copy(p.rotation);
                _dummy.scale.setScalar(currentScale);
                _dummy.updateMatrix();
                
                this.mesh.setMatrixAt(i, _dummy.matrix);
                dirty = true;
            }

            if (dirty) {
                this.mesh.instanceMatrix.needsUpdate = true;
            }
        }
        
        reset() {
            for(let i=0; i<this.maxCount; i++) {
                this.data[i].active = false;
                _dummy.position.set(0, -9999, 0);
                _dummy.scale.set(0, 0, 0);
                _dummy.updateMatrix();
                this.mesh.setMatrixAt(i, _dummy.matrix);
            }
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    /**
     * Specialized Batch for Stars (Sprite Animation)
     */
    class StarBatch extends ParticleBatch {
        constructor(scene, maxCount) {
            super(scene, _geoStar, _matStarShader, maxCount);
            
            // Add custom attribute for frames
            const frames = new Float32Array(maxCount);
            this.mesh.geometry.setAttribute('aFrame', new THREE.InstancedBufferAttribute(frames, 1));
        }

spawn(pos, vel, life, scale, colorHex = null, rotation = null) {
            super.spawn(pos, vel, life, scale, colorHex, rotation);
            // Parent spawn handles data and matrix/color
            // We don't need to set aFrame here, it's calculated in update
        }

        update(dt) {
            let dirtyMatrix = false;
            let dirtyAttribute = false;
            const frameAttr = this.mesh.geometry.attributes.aFrame;

            for(let i=0; i<this.maxCount; i++) {
                const p = this.data[i];
                if (!p.active) continue;

                p.life -= dt;
                if (p.life <= 0) {
                    p.active = false;
                    _dummy.position.set(0, -9999, 0);
                    _dummy.scale.set(0, 0, 0);
                    _dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, _dummy.matrix);
                    dirtyMatrix = true;
                    continue;
                }

                // Physics
                p.velocity.y -= 20 * dt;
                p.position.addScaledVector(p.velocity, dt);

                // No rotation update needed (Billboard shader handles facing)
                // But we can use rotation Z for spin if we wanted to pass it to shader
                // For now, keep it simple.

                // Scale
                const progress = p.life / p.maxLife;
                const currentScale = p.scale * progress;

                // Update Matrix
                _dummy.position.copy(p.position);
                _dummy.rotation.set(0,0,0); // Reset rotation, shader handles billboard
                _dummy.scale.setScalar(currentScale);
                _dummy.updateMatrix();
                this.mesh.setMatrixAt(i, _dummy.matrix);
                dirtyMatrix = true;

                // Update Frame
                // 4 Frames: 0, 1, 2, 3
                const lifePct = 1.0 - progress; // 0 -> 1
                const frame = Math.floor(lifePct * 4);
                const clampedFrame = Math.max(0, Math.min(3, frame));
                
                if (frameAttr.getX(i) !== clampedFrame) {
                    frameAttr.setX(i, clampedFrame);
                    dirtyAttribute = true;
                }
            }

            if (dirtyMatrix) this.mesh.instanceMatrix.needsUpdate = true;
            if (dirtyAttribute) frameAttr.needsUpdate = true;
        }
    }

    class ParticleSystem {
constructor(scene) {
            this.scene = scene;
            
            const config = window.flux.config;
            const mult = config.PERFORMANCE.PARTICLE_MULTIPLIER || 1.0;

            // Helper to scale max counts (Minimum 20 to prevent breakage)
            const getLimit = (base) => Math.floor(Math.max(20, base * mult));

            // Initialize Batches
            this.batches = {
DUST: new ParticleBatch(scene, _geoDust, _matDust, getLimit(200)),
                DEBRIS: new ParticleBatch(scene, _geoDebris, _matDebris, getLimit(200)),
                SPARK: new ParticleBatch(scene, _geoSpark, _matSpark, getLimit(100)),
                STAR: new StarBatch(scene, getLimit(200)),
                SPEED_LINE: new ParticleBatch(scene, _geoLine, _matSpark, getLimit(50))
            };
        }

spawn(type, pos, count = 1, spread = 0.5, color = null) {
            // Apply performance multiplier
            const mult = window.flux.config.PERFORMANCE.PARTICLE_MULTIPLIER || 1.0;
            const effectiveCount = Math.ceil(count * mult);
            if (effectiveCount <= 0) return;

            // Map types to batches
            let batch = null;
            let baseColor = null;
            let rotation = null;

            if (type === 'DUST') batch = this.batches.DUST;
            else if (type === 'DEBRIS') batch = this.batches.DEBRIS;
            else if (type === 'SPARK') batch = this.batches.SPARK;
            else if (type === 'STAR' || type === 'TRAIL') batch = this.batches.STAR;
            else if (type === 'SPEED_LINE') batch = this.batches.SPEED_LINE;

            if (!batch) return;

            for (let i = 0; i < effectiveCount; i++) {
                // Config
// Reuse _pVel
                _pVel.set(
                    (Math.random() - 0.5) * spread * 5,
                    Math.random() * 3 + 2,
                    (Math.random() - 0.5) * spread * 5
                );
                const vel = _pVel;
                let life = 0.5 + Math.random() * 0.5;
                let scale = 1.0;
                let pColor = color;
                rotation = null;

                // Specific Overrides
                if (type === 'DUST') {
vel.y = Math.random() * 1;
                    life = 0.4;
                } 
                else if (type === 'DEBRIS') {
                    if (!pColor) pColor = Math.random() > 0.5 ? 0x553311 : 0xaa8855;
                    scale = 0.8 + Math.random() * 0.5;
                } 
                else if (type === 'SPARK') {
vel.multiplyScalar(2);
                    life = 0.2;
                } 
                else if (type === 'STAR') {
vel.set(
                        (Math.random() - 0.5) * 4,
                        4 + Math.random() * 3,
                        (Math.random() - 0.5) * 4
                    );
                    life = 0.5;
                    scale = 1.0 + Math.random() * 1.5;
                    if (!pColor) pColor = 0xffffff;
                } 
                else if (type === 'TRAIL') {
vel.set(
                        (Math.random() - 0.5) * spread, 
                        Math.random() * 0.5, 
                        (Math.random() - 0.5) * spread
                    );
                    life = 0.6;
                    scale = 0.6 + Math.random() * 0.6;
                    if (!pColor) pColor = 0xffffff;
                }
                else if (type === 'SPEED_LINE') {
                    // Speed lines move opposite to velocity (simulated wind)
                    // We assume 'spread' passed in is actually the direction vector for this type
                    // Or we just randomize around a generic axis? 
                    // Better: The caller should pass the velocity direction in 'spread' if possible, 
                    // but 'spread' is a number. 
                    // Let's assume for SPEED_LINE, we just spawn them static but oriented, 
                    // and they fade out fast.
                    
                    // Actually, let's make them move backwards fast.
                    // We need the player's forward direction. 
                    // Hack: We'll assume the caller sets 'vel' correctly if they call batch.spawn directly,
                    // but here we are in the generic spawner.
                    // Let's just make them explode outwards for now if no direction is known,
                    // OR, we rely on the caller to use spawn() with specific velocity logic if they want alignment.
                    // But to support the "Particle emission during dash" requirement easily:
                    
                    // We will orient them flat on XZ and random Y rotation?
                    // No, speed lines should align with movement.
                    // Let's use the velocity passed in 'vel' to determine rotation.
                    
                    // For SPEED_LINE, we expect 'vel' to be the movement direction.
                    // We will set the rotation to look at velocity.
                    
                    life = 0.15;
                    scale = 0.5 + Math.random() * 0.5;
                    if (!pColor) pColor = 0xffffff;
                    
                    // Orient along velocity
                    if (vel.lengthSq() > 0.01) {
                        rotation = new THREE.Euler();
                        // Create a lookAt matrix
                        _dummy.lookAt(vel);
                        rotation.setFromRotationMatrix(_dummy.matrix);
                    }
                }

batch.spawn(pos, vel, life, scale, pColor, rotation);
            }
        }

        update(dt) {
            for (const key in this.batches) {
                this.batches[key].update(dt);
            }
        }

        reset() {
            for (const key in this.batches) {
                this.batches[key].reset();
            }
        }

        addToScene(scene) {
            // Re-add meshes if scene changes (soft reset)
            this.scene = scene;
            for (const key in this.batches) {
                const mesh = this.batches[key].mesh;
                if (!scene.children.includes(mesh)) {
                    scene.add(mesh);
                }
            }
        }
    }

    window.flux.ParticleSystem = ParticleSystem;
})();