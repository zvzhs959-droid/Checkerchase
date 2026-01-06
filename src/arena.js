/**
 * STONEWAVE DUEL - ARENA SYSTEM
 * Manages the grid of tiles.
 */
(function() {
    window.flux = window.flux || {};
    const Tile = window.flux.Tile;
    const config = window.flux.config;

// --- Respawn Platform Class ---
    class RespawnPlatform {
        constructor(scene, x, z, player) {
            this.scene = scene;
            this.gridX = x;
            this.gridZ = z;
            this.player = player;
            this.active = true;
            this.occupied = true;
            this.timer = 0;
            
            // Visuals: Glowing safe zone
            const geo = new THREE.PlaneBufferGeometry(0.8, 0.8);
            const mat = new THREE.MeshBasicMaterial({ 
                color: 0x00ff00, // Green safe zone
                transparent: true, 
                opacity: 0.5,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            this.mesh = new THREE.Mesh(geo, mat);
            this.mesh.rotation.x = -Math.PI / 2;
this.mesh.position.set(x, 0.02, z); // Slightly above floor (0.0)
            
            scene.add(this.mesh);
        }

        update(dt) {
            if (!this.active) return;

            // Check if player is still on this tile
            // We use a loose distance check or grid check
            const px = Math.round(this.player.position.x);
            const pz = Math.round(this.player.position.z);
            const onPlatform = (px === this.gridX && pz === this.gridZ);

            if (this.occupied) {
                if (!onPlatform) {
                    // Player stepped off
                    this.occupied = false;
                    this.timer = config.ARENA.PLATFORM_DURATION;
                } else {
                    // Player is on platform: Maintain Invulnerability
                    // We force the player's invuln timer to stay up
                    this.player.invulnTimer = 0.1; 
                }
            } else {
                // Countdown to disappearance
                this.timer -= dt;
                // Fade out
                this.mesh.material.opacity = (this.timer / config.ARENA.PLATFORM_DURATION) * 0.5;
                
                if (this.timer <= 0) {
                    this.destroy();
                }
            }
        }

        destroy() {
            this.active = false;
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    }

class Arena {
        constructor(scene) {
            this.scene = scene;
            this.width = config.TILES.GRID_SIZE;
            this.height = config.TILES.GRID_SIZE;
            this.tiles = []; // 1D Array
            this.platforms = []; // Active respawn platforms
            
            // Shrink State
            this.shrinkLevel = 0;
            this.isShrinking = false;
            this.shrinkQueue = []; // Tiles to turn to stone
            this.shrinkTimer = 0;
            this.shrinkStage = 'IDLE'; // IDLE, TURNING_STONE, WAITING_FALL
            
            this.init();
        }

init() {
            console.log("FluxCode: Generating Arena...");
            
// Backing Plane - DISABLED to show Video Background through gaps
            // const planeGeo = new THREE.PlaneBufferGeometry(this.width, this.height);
            // const planeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            // const plane = new THREE.Mesh(planeGeo, planeMat);
            // plane.rotation.x = -Math.PI / 2;
            // plane.position.set((this.width-1)/2, -0.55, (this.height-1)/2); 
            // this.scene.add(plane);

            for (let z = 0; z < this.height; z++) {
                for (let x = 0; x < this.width; x++) {
                    const tile = new Tile(x, z, this.scene);
                    this.tiles.push(tile);
                }
            }
        }

        getTile(x, z) {
            if (x < 0 || x >= this.width || z < 0 || z >= this.height) return null;
            return this.tiles[x + z * this.width];
        }

        update(dt) {
            // Update Tiles
            for (let i = 0; i < this.tiles.length; i++) {
                this.tiles[i].update(dt);
            }

            // Update Platforms
            for (let i = this.platforms.length - 1; i >= 0; i--) {
                const p = this.platforms[i];
                p.update(dt);
                if (!p.active) {
                    this.platforms.splice(i, 1);
                }
            }
            
            // Update Shrink Logic
            this.updateShrink(dt);
        }

        // --- Shrink Logic (Kirby 64 Style) ---
triggerShrink() {
            if (this.isShrinking || this.shrinkLevel >= config.GAME.MAX_SHRINKS) return;

            console.log(`FluxCode: Starting Shrink Level ${this.shrinkLevel + 1}`);
            this.isShrinking = true;
            this.shrinkStage = 'TURNING_STONE';
            this.shrinkTimer = 0;
            
            // Calculate Ring
            const start = this.shrinkLevel; 
            const end = this.width - 1 - this.shrinkLevel;
            
            this.shrinkQueue = [];
            
            // Helper to add unique tiles to queue
            const add = (t) => {
                if (t) {
                    // Mark permanent IMMEDIATELY to prevent respawns if currently missing
                    t.isPermanent = true;
                    this.shrinkQueue.push(t);
                }
            };
            
            // Clockwise traversal
            for (let x = start; x < end; x++) add(this.getTile(x, start));
            for (let z = start; z < end; z++) add(this.getTile(end, z));
            for (let x = end; x > start; x--) add(this.getTile(x, end));
            for (let z = end; z > start; z--) add(this.getTile(start, z));
        }
        
        updateShrink(dt) {
            // Multiplayer: shrink is host-authoritative
            if (window.flux && window.flux.net && window.flux.net.slot !== 0) return;

            if (!this.isShrinking) return;
            
if (this.shrinkStage === 'TURNING_STONE') {
                this.shrinkTimer += dt;
                const interval = 0.06; // Slower sequence (User requested slower speed)
                
                let playedSound = false;

                // Process queue based on timer
                while (this.shrinkTimer > interval && this.shrinkQueue.length > 0) {
                    this.shrinkTimer -= interval;
                    const tile = this.shrinkQueue.shift();
                    if (tile) {
                        // If stable or cracked, turn to stone visual
                        if (tile.state === config.TILES.STATES.STABLE || tile.state === config.TILES.STATES.CRACKED) {
                            tile.setState(config.TILES.STATES.STONE);
                            
                            // Play SFX (Throttled to once per frame update to prevent stacking)
                            if (!playedSound && window.flux.audio) {
                                window.flux.audio.playSFX('STONE');
                                playedSound = true;
                            }

                            if (window.flux.particles) {
                                const p = tile.mesh.position.clone();
                                p.y = 0.5;
                                window.flux.particles.spawn('DUST', p, 2, 0.4);
                            }
                        }
                        // If reforming, cancel it and hide immediately (prevents ghost tiles)
                        else if (tile.state === config.TILES.STATES.REFORMING) {
                            tile.setState(config.TILES.STATES.MISSING);
                        }
                        // If already missing, it stays missing (isPermanent is already true, so it won't respawn)
                    }
                }
                
                if (this.shrinkQueue.length === 0) {
                    this.shrinkStage = 'WAITING_FALL';
                    this.shrinkTimer = 1.5; // "place for just a couple seconds"
                }
            }
            else if (this.shrinkStage === 'WAITING_FALL') {
                this.shrinkTimer -= dt;
                if (this.shrinkTimer <= 0) {
                    // FALL AT ONCE
                    const start = this.shrinkLevel;
                    const end = this.width - 1 - this.shrinkLevel;
                    
                    // Iterate all tiles in the ring (re-calculate or store? simple enough to iterate all tiles and check isPermanent + STONE)
                    for (let i = 0; i < this.tiles.length; i++) {
                        const t = this.tiles[i];
                        if (t.state === config.TILES.STATES.STONE) {
                            t.triggerFall(0); // Immediate fall
                        }
                    }
                    
                    this.shrinkLevel++;
                    this.isShrinking = false;
                    this.shrinkStage = 'IDLE';
                }
            }
        }

        // --- Respawn Logic ---
        getRespawnPos(avoidPos) {
            // "Always spawns on a stable tile farthest from opponent"
            const target = avoidPos || new THREE.Vector3(3.5, 0, 3.5); // Default center if no opponent
            
            let bestTile = null;
            let maxDistSq = -1;

            // Search only within valid bounds (respecting shrink)
            const start = this.shrinkLevel;
            const end = this.width - this.shrinkLevel;

            for (let z = start; z < end; z++) {
                for (let x = start; x < end; x++) {
                    const tile = this.getTile(x, z);
                    // MUST be stable to spawn on
                    if (tile && tile.state === config.TILES.STATES.STABLE) {
                        const dx = x - target.x;
                        const dz = z - target.z;
                        const dSq = dx*dx + dz*dz;
                        
                        if (dSq > maxDistSq) {
                            maxDistSq = dSq;
                            bestTile = tile;
                        }
                    }
                }
            }

            if (bestTile) {
                return new THREE.Vector3(bestTile.gridX, 0.5, bestTile.gridZ);
            }
            
            // Fallback: If NO stable tiles exist (rare/impossible unless game over), 
            // spawn in center and hope for the best (or maybe floating?)
            // For now, center.
            return new THREE.Vector3(3.5, 0.5, 3.5);
        }

        spawnRespawnPlatform(player, pos) {
            const x = Math.round(pos.x);
            const z = Math.round(pos.z);
            const platform = new RespawnPlatform(this.scene, x, z, player);
            this.platforms.push(platform);
            console.log(`FluxCode: Respawn Platform created at (${x}, ${z})`);
        }
    }

    window.flux.Arena = Arena;
})();