/**
 * STONEWAVE DUEL - POWERUP SYSTEM
 * Handles spawning, rendering, and collection of items.
 */
(function() {
    window.flux = window.flux || {};
    const config = window.flux.config;

    // --- SHARED RESOURCES ---
    const _geoCrystal = new THREE.OctahedronGeometry(0.25, 0);
    const _matCrystal = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.8,
        blending: THREE.AdditiveBlending 
    });
    const _matCrystalCore = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const _geoCape = new THREE.PlaneBufferGeometry(0.4, 0.4);
    const _matCape = new THREE.MeshBasicMaterial({ 
        color: 0xff3333, 
        side: THREE.DoubleSide 
    });

    const _axisY = new THREE.Vector3(0, 1, 0);

    class Powerup {
        constructor(type, x, z, scene) {
            this.type = type; // 'CRYSTAL' or 'CAPE'
            this.scene = scene;
            this.active = true;
            this.lifeTime = 15.0; // Despawn after 15s if not collected

            this.mesh = new THREE.Group();
            this.mesh.position.set(x, 0.5, z);

            // Visuals
            if (type === 'CRYSTAL') {
                const outer = new THREE.Mesh(_geoCrystal, _matCrystal);
                const inner = new THREE.Mesh(_geoCrystal, _matCrystalCore);
                inner.scale.setScalar(0.5);
                this.mesh.add(outer);
                this.mesh.add(inner);
                
                // Light
                const light = new THREE.PointLight(0x00ffff, 1, 3);
                this.mesh.add(light);
            } 
            else if (type === 'CAPE') {
                const cape = new THREE.Mesh(_geoCape, _matCape);
                this.mesh.add(cape);
            }

            // Shadow
            const shadowGeo = new THREE.PlaneBufferGeometry(0.4, 0.4);
            const shadowMat = new THREE.MeshBasicMaterial({ 
                color: 0x000000, 
                transparent: true, 
                opacity: 0.3,
                depthWrite: false
            });
            const shadow = new THREE.Mesh(shadowGeo, shadowMat);
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.y = -0.48;
            this.mesh.add(shadow);

            scene.add(this.mesh);
            
            // Spawn Effect
            if (window.flux.particles) {
                window.flux.particles.spawn('SPARK', this.mesh.position, 5, 0.5);
            }
            window.flux.audio.playSFX('POWERUP_SPAWN');
        }

        update(dt) {
            this.lifeTime -= dt;
            if (this.lifeTime <= 0) {
                this.destroy();
                return;
            }

            // Animation
            const time = performance.now() / 1000;
            this.mesh.position.y = 0.5 + Math.sin(time * 3) * 0.1;
            this.mesh.rotation.y += dt * 2.0;

            if (this.type === 'CAPE') {
                // Make cape wave a bit
                this.mesh.rotation.x = Math.sin(time * 5) * 0.2;
            }
        }

        collect(player) {
            if (!this.active) return;
            
            console.log(`FluxCode: ${player.label} collected ${this.type}`);
            player.applyPowerup(this.type);
            
            // FX
            if (window.flux.particles) {
                window.flux.particles.spawn('STAR', this.mesh.position, 8, 1.0, this.type === 'CRYSTAL' ? 0x00ffff : 0xff3333);
            }
            window.flux.audio.playSFX('POWERUP_COLLECT');

            this.destroy();
        }

        destroy() {
            this.active = false;
            this.scene.remove(this.mesh);
            // Geometries/Materials are shared, don't dispose
        }
    }

    class PowerupManager {
        constructor(scene, arena) {
            this.scene = scene;
            this.arena = arena;
            this.powerups = [];
            this.spawnTimer = 0;
        }

        update(dt) {
            // 1. Update Existing
            for (let i = this.powerups.length - 1; i >= 0; i--) {
                const p = this.powerups[i];
                p.update(dt);
                if (!p.active) {
                    this.powerups.splice(i, 1);
                } else {
                    // Check Collision with players
                    this.checkCollection(p);
                }
            }

            // 2. Spawn Logic
            // Only spawn if fewer than 2 items exist
            if (this.powerups.length < 2) {
                this.spawnTimer += dt;
                // Chance check every second
                if (this.spawnTimer > 1.0) {
                    this.spawnTimer = 0;
                    if (Math.random() < config.POWERUPS.SPAWN_CHANCE) {
                        this.spawnRandom();
                    }
                }
            }
        }

        checkCollection(powerup) {
            const players = window.flux._players || [];
            for (const p of players) {
                if (p.lives > 0 && p.state !== 'DEAD' && p.state !== 'FALL') {
                    const dist = p.position.distanceTo(powerup.mesh.position);
                    if (dist < 0.8) {
                        powerup.collect(p);
                        break; // Only one player collects
                    }
                }
            }
        }

        spawnRandom() {
            // Find a stable tile
            const arena = this.arena;
            const candidates = [];
            
            // Don't spawn on edges (too risky)
            const margin = 1;
            for (let z = margin; z < arena.height - margin; z++) {
                for (let x = margin; x < arena.width - margin; x++) {
                    const tile = arena.getTile(x, z);
                    if (tile && tile.state === config.TILES.STATES.STABLE) {
                        // Check if occupied by player or other powerup
                        let occupied = false;
                        // Check powerups
                        for (const p of this.powerups) {
                            if (Math.round(p.mesh.position.x) === x && Math.round(p.mesh.position.z) === z) occupied = true;
                        }
                        // Check players (rough)
                        const players = window.flux._players || [];
                        for (const pl of players) {
                            if (pl.position.distanceTo(new THREE.Vector3(x, 0, z)) < 1.0) occupied = true;
                        }

                        if (!occupied) candidates.push(tile);
                    }
                }
            }

            if (candidates.length === 0) return;

            const tile = candidates[Math.floor(Math.random() * candidates.length)];
            const type = Math.random() > 0.5 ? 'CRYSTAL' : 'CAPE';
            
            const p = new Powerup(type, tile.gridX, tile.gridZ, this.scene);
            this.powerups.push(p);
            
            console.log(`FluxCode: Spawned ${type} at ${tile.gridX}, ${tile.gridZ}`);
        }
    }

    window.flux.PowerupManager = PowerupManager;
})();