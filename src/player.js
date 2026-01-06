/**
 * STONEWAVE DUEL - PLAYER CONTROLLER
 * Handles physics, movement state machine, and combat.
 */
(function() {
    window.flux = window.flux || {};
    const config = window.flux.config;
    const MELEE = config.MELEE;
    
// Temp vectors to avoid GC
    const _inputVec = new THREE.Vector3();
    const _forward = new THREE.Vector3();
    const _dustVec = new THREE.Vector3();
    
    // Optimization: Reusable vectors for physics/logic
    const _pVec1 = new THREE.Vector3();
    const _pVec2 = new THREE.Vector3();

    // Optimization: Reusable limb vectors
    const _vFL = new THREE.Vector3();
    const _vFR = new THREE.Vector3();
    const _vHL = new THREE.Vector3();
    const _vHR = new THREE.Vector3();
    // Helper: Frames to Seconds
    const f2s = function(f) { return f / 60; };

// --- PSX / N64 STYLE GEOMETRY (OPTIMIZED) ---
    // Body: Low-poly sphere (12x8) - Reduces vertex count significantly (~75%)
    const _geoBody = new THREE.SphereGeometry(0.35, 12, 8);
    
    // Arms: Very low poly nubs (5x4)
    const _geoArm = new THREE.SphereGeometry(0.12, 5, 4);
    
    // Feet: Low poly ovals (5x4)
    const _geoFoot = new THREE.SphereGeometry(0.15, 5, 4);

    // --- COSMETICS ---
const _matGold = new THREE.MeshLambertMaterial({ 
        color: 0xFFD700, 
        emissive: 0x332200,
        flatShading: true 
    });
const _matHair = new THREE.MeshLambertMaterial({ 
        color: 0x6D4C41, // Lighter Medium Brown (Bushier look)
        flatShading: true 
    });
    // Halo: Optimized to 4 radial segments (square tube) and 8 tubular segments (octagon ring)
    const _geoHalo = new THREE.TorusGeometry(0.2, 0.03, 4, 8);
    // Crown: 5 segments is already low poly enough
const _geoCrown = new THREE.CylinderGeometry(0.2, 0.15, 0.15, 5);
// The Roy Resources (Frizzy Hair + Strands)
    const _geoRoyCurl = new THREE.DodecahedronGeometry(0.1, 0); 
    const _geoRoyStrand = new THREE.TorusGeometry(0.34, 0.015, 3, 12, Math.PI); // Arch
    // Angel Wings: Flattened Cone/Box
    const _geoWing = new THREE.BoxGeometry(0.15, 0.4, 0.05);

    // --- SHARED SHADOW RESOURCES ---
    const _geoShadow = new THREE.PlaneBufferGeometry(0.7, 0.7);
    const _texShadow = (function() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(0,0,0,0.6)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    })();
    const _matShadow = new THREE.MeshBasicMaterial({ 
        map: _texShadow,
        transparent: true, 
        opacity: 0.4,
        depthWrite: false
    });
    
    // --- OUTLINE MATERIAL ---
    const _matOutline = new THREE.MeshBasicMaterial({ 
        color: 0x000000, 
        side: THREE.BackSide 
    });

    class Player {
        constructor(scene, arena, shockwaveManager, color = 0x507D98, label = "P1") {
            this.scene = scene;
            this.arena = arena;
            this.shockwaveManager = shockwaveManager;
            
            this.label = label;
            this.color = color;
            this.lives = config.GAME.STARTING_STOCK;
            this.dashes = config.MOVEMENT.MAX_DASHES;
            this.kills = 0;
            
            // --- Visuals (Composite Mesh) ---
            this.mesh = new THREE.Group();
            
            // 1. Face Texture Generation
            // We bake the player color into the texture so we can have white eyes
            this.texFaceNormal = this.createFaceTexture(color, 'NORMAL');
            this.texFaceStunned = this.createFaceTexture(color, 'STUNNED');
            
            // Body
            // Use White base so texture colors show correctly
            this.matBody = new THREE.MeshToonMaterial({ 
                map: this.texFaceNormal,
                color: 0xffffff,
                gradientMap: window.flux.toonGradient
            });
            
            this.body = new THREE.Mesh(_geoBody, this.matBody);
            this.body.position.y = 0.0;
            // Rotate body -90 deg Y so the face (drawn at UV center) looks forward (Z+)
            this.body.rotation.y = -Math.PI / 2; 
this.createOutline(this.body, 1.15); // Add Outline (Thicker: 1.15)
            this.mesh.add(this.body);

            // Feet (Crimson Red - Kirby Style)
            const footColor = 0xAA2222; // More vibrant red
            this.matFeet = new THREE.MeshToonMaterial({ 
                color: footColor,
                gradientMap: window.flux.toonGradient
            });
            
            this.footL = new THREE.Mesh(_geoFoot, this.matFeet);
            this.footL.scale.set(1.0, 0.6, 0.8); // Half length
            this.footL.position.set(-0.2, -0.32, 0.0); // Centered
this.createOutline(this.footL, 1.30); // Add Outline (Thicker: 1.30)
            this.mesh.add(this.footL);

            this.footR = new THREE.Mesh(_geoFoot, this.matFeet);
            this.footR.scale.set(1.0, 0.6, 0.8);
            this.footR.position.set(0.2, -0.32, 0.0);
this.createOutline(this.footR, 1.30); // Add Outline (Thicker: 1.30)
            this.mesh.add(this.footR);

            // Hands
            this.matArms = new THREE.MeshToonMaterial({ 
                color: color,
                gradientMap: window.flux.toonGradient
            });
            
            this.handL = new THREE.Mesh(_geoArm, this.matArms);
            this.handL.position.set(-0.32, 0.0, 0.1);
this.createOutline(this.handL, 1.40); // Thicker outline for small hands
            this.mesh.add(this.handL);

            this.handR = new THREE.Mesh(_geoArm, this.matArms);
            this.handR.position.set(0.32, 0.0, 0.1);
this.createOutline(this.handR, 1.40);
            this.mesh.add(this.handR);

            // Shadow
// Shadow (Independent Mesh)
            this.shadow = new THREE.Mesh(_geoShadow, _matShadow);
            this.shadow.rotation.x = -Math.PI / 2;
            this.shadow.position.y = 0.02; // Just above ground
            this.scene.add(this.shadow); // Add to scene, not player mesh

            // --- Physics ---
            // Center Y at 0.35 (Radius)
            this.position = new THREE.Vector3(3.5, 0.27, 3.5); // Lowered for scale
            this.velocity = new THREE.Vector3();
            this.mesh.position.copy(this.position);
            this.mesh.scale.setScalar(0.76); // Global Scale (76%)
            
            this.scene.add(this.mesh);

            // --- State ---
            this.state = 'IDLE'; 
            this.stateTimer = 0;
            this.invulnTimer = 0;
            
            // --- Cosmetics ---
this.currentCosmetics = { HEAD: null, BACK: null };
            this.cosmeticMeshes = { HEAD: null, BACK: null };
            
            // Combat State
            this.chargeTimer = 0;
            this.prevState = null; 
            this.jabCount = 0;     
            this.jabResetTimer = 0;
            
            this.attack = {
                type: null, 
                stage: null, 
                timer: 0,
                hasHit: false,
                startupPenalty: 0,
data: null
            };
            
            // --- Powerups ---
            this.activePowerup = null; // { type, timer, visualMesh }
            this.powerupVisuals = new THREE.Group();
            this.body.add(this.powerupVisuals);

// --- Constants ---
            this.MAX_SPEED = config.MOVEMENT.WALK_SPEED;
            const accelTime = config.MOVEMENT.WALK_ACCEL / 60;
            this.ACCEL = this.MAX_SPEED / accelTime;
            this.FRICTION = this.ACCEL * 2.5; 
            this.dustTimer = 0;
            this.facing = new THREE.Vector3(0, 0, 1); 
        }

createOutline(mesh, scale = 1.05) {
            // Always create to allow runtime toggling, but hide if disabled initially
            const outline = new THREE.Mesh(mesh.geometry, _matOutline);
            outline.scale.setScalar(scale);
            outline.userData.isOutline = true;
            outline.visible = config.PERFORMANCE.ENABLE_OUTLINES;
            mesh.add(outline);
            return outline;
        }

update(dt, input) {
            if (this.state === 'DEAD') return;

            // 1. Timers
            this.stateTimer += dt;
            if (this.invulnTimer > 0) this.invulnTimer -= dt;
            if (this.jabResetTimer > 0) this.jabResetTimer -= dt;
if (this.jabResetTimer <= 0) this.jabCount = 0;

            // Powerup Timer
            if (this.activePowerup) {
                this.activePowerup.timer -= dt;
                if (this.activePowerup.timer <= 0) {
                    this.removePowerup();
                }
            }

            // 2. State Logic
            switch(this.state) {
                case 'IDLE':
                case 'WALK':
                    this.checkCombatInput(input);
                    // Only move if we didn't just start an action
                    if (this.state === 'IDLE' || this.state === 'WALK') {
                        this.handleMovement(dt, input);
                        this.checkGround();
                    }
                    break;
                
                case 'DASH':
                    // Cannot interrupt a dash with a dash (already dashing)
                    this.checkCombatInput(input);
                    if (this.state === 'DASH') {
                        this.handleDash(dt);
                        this.checkGround();
                    }
                    break;

                case 'DASH_RECOVERY':
                    // Dash Cancel Allowed
                    if (this.checkDashInterrupt(input)) break;
                    
                    this.handleDashRecovery(dt);
                    this.checkGround();
                    break;

                case 'HOP':
                    // Dash Cancel Allowed (Air Dash)
                    if (this.checkDashInterrupt(input)) break;

                    this.checkCombatInput(input);
                    if (this.state === 'HOP') {
                        this.handleHop(dt);
                    }
                    break;

                case 'CHARGING':
                    // Dash Cancel Allowed
                    if (this.checkDashInterrupt(input)) break;

                    this.handleCharging(dt, input);
                    this.checkGround();
                    break;

                case 'ATTACK':
                    // Dash Cancel Allowed (Animation Cancel)
                    if (this.checkDashInterrupt(input)) break;

                    this.handleAttack(dt);
                    // Apply friction during attack
                    this.velocity.multiplyScalar(0.85); 
                    this.checkGround();
                    break;

                case 'FALL':
                    this.handleFall(dt);
                    break;

                case 'STUNNED':
                    this.handleStunned(dt);
                    this.checkGround();
                    break;
            }

            // 3. Physics Integration
            // Apply velocity to position (except during FALL which handles pos manually)
            if (this.state !== 'FALL') {
                this.position.addScaledVector(this.velocity, dt);
                this.enforcePerimeter();
            }
            
            // 4. Sync Mesh
this.mesh.position.copy(this.position);
            
            // Sync Shadow
            if (this.shadow) {
                this.shadow.position.set(this.position.x, 0.02, this.position.z);
                // Scale shadow based on height (fake ambient occlusion)
                const height = Math.max(0, this.position.y - 0.27); // 0.27 is ground level center
                const sScale = Math.max(0, 1.0 - height * 0.8);
                this.shadow.scale.setScalar(sScale);
                this.shadow.visible = this.mesh.visible && this.state !== 'DEAD';
            }
            
            // 5. Visuals (Invuln Flicker)
            if (this.invulnTimer > 0) {
                this.mesh.visible = Math.floor(window.performance.now() / 50) % 2 === 0;
            } else {
                this.mesh.visible = true;
            }
            this.updateVisuals();
            
            // 6. Cosmetics
this.updateCosmetics(dt);
            this.updatePowerupVisuals(dt);
        }

updateCosmetics(dt) {
            // Only P1 gets cosmetics from storage
            if (this.label !== "P1") return;

            const equipped = window.flux.storage ? window.flux.storage.getEquippedSlots() : { HEAD: null, BACK: null };
            
            // Iterate Slots
            ['HEAD', 'BACK'].forEach(slot => {
                const itemId = equipped[slot];
                
                // If changed
                if (itemId !== this.currentCosmetics[slot]) {
                    // Remove old
                    if (this.cosmeticMeshes[slot]) {
                        this.body.remove(this.cosmeticMeshes[slot]);
                        this.cosmeticMeshes[slot] = null;
                    }

                    // Add new
                    if (itemId) {
                        this.cosmeticMeshes[slot] = this.createCosmeticMesh(itemId);
                        if (this.cosmeticMeshes[slot]) {
                            this.body.add(this.cosmeticMeshes[slot]);
                        }
                    }
                    this.currentCosmetics[slot] = itemId;
                }

                // Animate
                const mesh = this.cosmeticMeshes[slot];
                if (mesh) {
                    const time = window.performance.now() / 1000;
                    
                    if (itemId === 'halo_gold') {
                         mesh.position.y = 0.35 + (Math.sin(time * 2) + Math.cos(time * 3.1)) * 0.02;
                         mesh.rotation.z = time * 0.5;
} else if (itemId === 'angel_wings') {
                        // Flap Wings
                        const flap = Math.sin(time * 12) * 0.2; 
                        // Left Wing (Base -2.5). Flap towards back (-PI) means subtracting
                        mesh.children[0].rotation.y = -2.5 - Math.abs(flap);
                        // Right Wing (Base 2.5). Flap towards back (PI) means adding
                        mesh.children[1].rotation.y = 2.5 + Math.abs(flap);
                    }
                }
            });
        }

        createCosmeticMesh(id) {
            let mesh = null;

            if (id === 'crown_gold') {
                mesh = new THREE.Mesh(_geoCrown, _matGold);
                mesh.position.set(0, 0.35, 0); 
                mesh.rotation.y = Math.PI / 5;
            } 
else if (id === 'halo_gold') {
                mesh = new THREE.Group();
                const r1 = new THREE.Mesh(_geoHalo, _matGold);
                mesh.add(r1);
                const r2 = new THREE.Mesh(_geoHalo, _matGold);
                r2.scale.setScalar(0.75);
                mesh.add(r2);
                const r3 = new THREE.Mesh(_geoHalo, _matGold);
                r3.scale.setScalar(1.25);
                mesh.add(r3);
                mesh.rotation.x = Math.PI / 2; // Lay flat
                mesh.position.set(0, 0.35, 0); 
            }
else if (id === 'the_roy') {
                mesh = new THREE.Group();
                // Frizzy Hair Logic
                const numCurls = 16;
                const startAngle = 0.7; 
                const endAngle = Math.PI * 2 - 0.7;
for(let i=0; i<numCurls; i++) {
                    const t = i / (numCurls - 1);
                    const angle = startAngle + t * (endAngle - startAngle);
                    const m = new THREE.Mesh(_geoRoyCurl, _matHair);
                    const r = 0.33;
                    // Raised Y from 0.1 to 0.25 for proper hairline height
                    m.position.set(Math.cos(angle)*r, 0.25+(Math.random()-0.5)*0.06, Math.sin(angle)*r);
                    m.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
                    m.scale.setScalar(0.8 + Math.random() * 0.4);
                    mesh.add(m);
                }
const s1 = new THREE.Mesh(_geoRoyStrand, _matHair);
                s1.position.set(0, 0.15, -0.12); // Moved further back
                s1.rotation.y = Math.PI/2 - 0.25; 
                mesh.add(s1);
                
                const s2 = new THREE.Mesh(_geoRoyStrand, _matHair);
                s2.position.set(0, 0.15, 0.12); // Moved further forward
                s2.rotation.y = Math.PI/2 + 0.25; 
                s2.scale.setScalar(1.1); // Larger arch to clear the first one if they cross
                mesh.add(s2);
            }
            else if (id === 'angel_wings') {
                mesh = new THREE.Group();
                // Improved Wing Geometry (3 Feathers per wing)
                const featherGeo = new THREE.BoxGeometry(0.12, 0.4, 0.04);
                const matWing = new THREE.MeshToonMaterial({ 
                    color: 0xffffff, 
                    gradientMap: window.flux.toonGradient 
                });

                const createWing = (isRight) => {
                    const wingGroup = new THREE.Group();
                    const dir = isRight ? 1 : -1;
                    
                    // Feather 1 (Top/Inner)
                    const f1 = new THREE.Mesh(featherGeo, matWing);
                    f1.position.set(dir * 0.1, 0.1, 0);
                    f1.rotation.z = dir * -0.2;
                    wingGroup.add(f1);

                    // Feather 2 (Mid)
                    const f2 = new THREE.Mesh(featherGeo, matWing);
                    f2.position.set(dir * 0.22, 0.0, 0);
                    f2.rotation.z = dir * -0.5;
                    f2.scale.setScalar(0.9);
                    wingGroup.add(f2);

                    // Feather 3 (Bottom/Outer)
                    const f3 = new THREE.Mesh(featherGeo, matWing);
                    f3.position.set(dir * 0.3, -0.12, 0);
                    f3.rotation.z = dir * -0.8;
                    f3.scale.setScalar(0.8);
                    wingGroup.add(f3);

                    return wingGroup;
                };

const left = createWing(true); // Use dir=1 (extending +X)
                // Position on Back (-X), Left (+Z)
                left.position.set(-0.25, 0.15, 0.12); 
                // Rotate to point Back-Left (-X, +Z). Approx -2.5 rad
                left.rotation.y = -2.5; 
                left.rotation.x = 0.1; 
                left.scale.y = -1; // Flip upside down
                
                const right = createWing(true); // Use dir=1
                // Position on Back (-X), Right (-Z)
                right.position.set(-0.25, 0.15, -0.12); 
                // Rotate to point Back-Right (-X, -Z). Approx 2.5 rad
                right.rotation.y = 2.5; 
                right.rotation.x = 0.1;
                right.scale.y = -1; // Flip upside down
                
                mesh.add(left);
                mesh.add(right);
            }

            return mesh;
        }

        applyPowerup(type) {
            const P = config.POWERUPS.TYPES[type];
            if (!P) return;

            // Remove existing if any
            if (this.activePowerup) this.removePowerup();

            this.activePowerup = {
                type: type,
                timer: P.DURATION
            };

            // Visuals
            if (type === 'CRYSTAL') {
                // Prism Shell
                const geo = new THREE.IcosahedronGeometry(0.5, 0);
                const mat = new THREE.MeshNormalMaterial({ 
                    wireframe: true, 
                    transparent: true, 
                    opacity: 0.5,
                    blending: THREE.AdditiveBlending
                });
                const mesh = new THREE.Mesh(geo, mat);
                this.powerupVisuals.add(mesh);
this.activePowerup.visualMesh = mesh;
                
                // Crystal Distortion Effect
                if (window.flux.createDistortionMesh) {
                    this.crystalDistortion = window.flux.createDistortionMesh();
                    this.crystalDistortion.rotation.x = -Math.PI / 2;
                    this.crystalDistortion.scale.setScalar(1.5);
                    this.crystalDistortion.position.y = 0.1;
                    this.mesh.add(this.crystalDistortion);
                }
                
                // Infinite Dashes Logic handled in startDash
                // Restore dashes immediately
                this.dashes = config.MOVEMENT.MAX_DASHES;
                
                window.flux.ui.showMessage(`${this.label} GOT CRYSTAL!`, 1500);
            }
else if (type === 'CAPE') {
                // Cape Mesh
                const geo = new THREE.PlaneBufferGeometry(0.4, 0.6, 2, 4);
                // Translate geometry so origin is at the top edge (neck pivot)
                geo.translate(0, -0.3, 0);
                
                const mat = new THREE.MeshToonMaterial({ 
                    color: 0xff3333, 
                    side: THREE.DoubleSide,
                    gradientMap: window.flux.toonGradient
                });
                const mesh = new THREE.Mesh(geo, mat);
                
                // Position at neck (higher Y) and back of sphere
                mesh.position.set(-0.32, 0.28, 0); 
                
                // Rotate to face back (-X)
                // Base rotation: Y = -90 deg.
                mesh.rotation.set(0, -Math.PI / 2, 0);

                this.powerupVisuals.add(mesh);
                this.activePowerup.visualMesh = mesh;
                
                window.flux.ui.showMessage(`${this.label} GOT CAPE!`, 1500);
            }
        }

        removePowerup() {
            if (!this.activePowerup) return;
            
            // Cleanup Visuals
            while(this.powerupVisuals.children.length > 0){ 
                this.powerupVisuals.remove(this.powerupVisuals.children[0]); 
            }
            
            if (this.crystalDistortion) {
                this.mesh.remove(this.crystalDistortion);
                this.crystalDistortion = null;
            }
            
            this.activePowerup = null;
            window.flux.audio.playSFX('POWERUP_COLLECT'); // Play sound on expire too? Maybe just silence.
        }

        updatePowerupVisuals(dt) {
            if (!this.activePowerup || !this.activePowerup.visualMesh) return;
            
            const time = performance.now() / 1000;
            const mesh = this.activePowerup.visualMesh;

            if (this.activePowerup.type === 'CRYSTAL') {
                mesh.rotation.x = time;
                mesh.rotation.y = time * 1.5;
                mesh.scale.setScalar(1.0 + Math.sin(time * 5) * 0.1);

                if (this.crystalDistortion) {
                    this.crystalDistortion.material.uniforms.uTime.value = time;
                    this.crystalDistortion.material.uniforms.uOpacity.value = 0.2; // Subtle distortion
                }
            }
else if (this.activePowerup.type === 'CAPE') {
                // Flap based on velocity
                const speed = this.velocity.length();
                const flapSpeed = 5 + speed * 2;
                const flapAmp = 0.2 + (speed / this.MAX_SPEED) * 0.5;
                
                // Flap around X axis (since Y is rotated -90, X is the horizontal hinge)
                // Base angle to flare it out slightly away from body
                let baseAngle = 0.2; 
                
                // Lift up when moving fast
                if (speed > 1) {
                    baseAngle += 0.8; // Fly behind
                }
                
                mesh.rotation.x = baseAngle + Math.sin(time * flapSpeed) * flapAmp;
            }
        }
createFaceTexture(colorHex, expression = 'NORMAL') {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 64; 
            const ctx = canvas.getContext('2d');
            
            // 1. Fill Background with Player Color
            const c = new THREE.Color(colorHex);
            ctx.fillStyle = `rgb(${Math.floor(c.r*255)}, ${Math.floor(c.g*255)}, ${Math.floor(c.b*255)})`;
            ctx.fillRect(0,0, 128, 64);
            
            // Helper for ellipses
            const ellipse = (cx, cy, rx, ry, fill) => {
                ctx.fillStyle = fill;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.fill();
            };

            // 2. Draw Face (Centered at 64, 32)
            const eyeY = 26;
            
            if (expression === 'NORMAL') {
                // Eyes (Vertical Ovals)
                const eyeW = 2.0;
                const eyeH = 5.0;
                
                // Eye Whites
                ellipse(58, eyeY, eyeW, eyeH, '#000000'); 
                ellipse(70, eyeY, eyeW, eyeH, '#000000');

                // Iris
                const gradL = ctx.createLinearGradient(58, eyeY - eyeH, 58, eyeY + eyeH);
                gradL.addColorStop(0, '#000000');
                gradL.addColorStop(1, '#000088');
                
                ellipse(58, eyeY, eyeW * 0.8, eyeH * 0.9, '#000000'); 
                
                // Shine
                ellipse(58, eyeY - 2.5, eyeW * 0.5, eyeH * 0.3, '#ffffff');

                // Right Eye
                ellipse(70, eyeY, eyeW * 0.8, eyeH * 0.9, '#000000');
                ellipse(70, eyeY - 2.5, eyeW * 0.5, eyeH * 0.3, '#ffffff');
                
                // Mouth (Small smile)
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(64, 36, 2, 0.2, Math.PI - 0.2); 
                ctx.stroke();
            } 
            else if (expression === 'STUNNED') {
                // Eyes Shut (> <)
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Left Eye (>)
                ctx.beginPath();
                ctx.moveTo(56, eyeY - 3);
                ctx.lineTo(60, eyeY);
                ctx.lineTo(56, eyeY + 3);
                ctx.stroke();
                
                // Right Eye (<)
                ctx.beginPath();
                ctx.moveTo(72, eyeY - 3);
                ctx.lineTo(68, eyeY);
                ctx.lineTo(72, eyeY + 3);
                ctx.stroke();
                
                // Mouth (Open O)
                ctx.fillStyle = '#440000';
                ctx.beginPath();
                ctx.arc(64, 38, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Cheeks (Blush) - Always present
            ctx.globalAlpha = 0.8;
            ellipse(46, 34, 5, 2.5, '#ff3333');
            ellipse(82, 34, 5, 2.5, '#ff3333');
            ctx.globalAlpha = 1.0;

            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            return tex;
        }

updateVisuals() {
            const dt = 1/60;
            const time = window.performance.now() / 1000;
            
            // --- 1. Base Transforms & Reset ---
            // Reset body orientation (preserve the -90 Y rotation for face)
            this.body.rotation.set(0, -Math.PI / 2, 0);
            this.body.position.set(0, 0, 0);
            this.body.scale.set(1, 1, 1);

            // Default Limb Positions (Relative to parent mesh)
            const footBaseY = -0.32;
            const footBaseZ = 0.0; 
            const handBaseY = 0.0;
            const handBaseZ = 0.15; 

            // Reset reusable vectors
            _vFL.set(-0.2, footBaseY, footBaseZ);
            _vFR.set(0.2, footBaseY, footBaseZ);
            _vHL.set(-0.32, handBaseY, handBaseZ);
            _vHR.set(0.32, handBaseY, handBaseZ);

            // --- 2. Animation State Machine ---
            
if (this.state === 'IDLE') {
                const breath = Math.sin(time * 2.0);
                const scaleAmt = 0.015;
                this.body.scale.y = 1.0 + breath * scaleAmt;
                this.body.scale.x = 1.0 - breath * scaleAmt;
                this.body.scale.z = 1.0 - breath * scaleAmt;
                _vHL.y += breath * 0.005;
                _vHR.y += breath * 0.005;
            }
            else if (this.state === 'WALK') {
                const walkSpeed = 18; 
                const phase = this.stateTimer * walkSpeed;
                const sin = Math.sin(phase);
                const cos = Math.cos(phase);
                _vFL.z -= cos * 0.2; 
                _vFL.y += Math.max(0, sin) * 0.15; 
                _vFR.z -= Math.cos(phase + Math.PI) * 0.2;
                _vFR.y += Math.max(0, Math.sin(phase + Math.PI)) * 0.15;
                this.body.position.y = Math.abs(sin) * 0.03;
                _vHL.y += sin * 0.08; _vHL.z -= cos * 0.08;
                _vHR.y += Math.sin(phase + Math.PI) * 0.08; _vHR.z -= Math.cos(phase + Math.PI) * 0.08;
                this.body.rotation.x = cos * 0.05; 
            }
            else if (this.state === 'DASH') {
                this.body.scale.set(0.8, 0.8, 1.4);
                _vHR.set(0.1, 0.1, 0.45);
                _vHL.set(-0.3, -0.1, -0.3);
                const dashPhase = this.stateTimer * 40;
                _vFL.z = -0.3 + Math.cos(dashPhase) * 0.1;
                _vFL.y += Math.abs(Math.sin(dashPhase)) * 0.1;
                _vFR.z = -0.3 + Math.cos(dashPhase + Math.PI) * 0.1;
                _vFR.y += Math.abs(Math.sin(dashPhase + Math.PI)) * 0.1;
            }
            else if (this.state === 'DASH_RECOVERY') {
                const wobbleSpeed = 25;
                const wobbleAmt = 0.3;
                this.mesh.rotation.z = Math.sin(this.stateTimer * wobbleSpeed) * wobbleAmt;
                this.body.position.y = Math.sin(this.stateTimer * 15) * 0.05;
                this.body.scale.set(1.1, 0.8, 1.1);
                _vHL.y = -0.2 + Math.sin(this.stateTimer * 20) * 0.1;
                _vHR.y = -0.2 + Math.cos(this.stateTimer * 20) * 0.1;
                _vHL.z = 0.1; _vHR.z = 0.1;
            }
            else if (this.state === 'HOP') {
                _vHL.y = 0.3; _vHL.x -= 0.1;
                _vHR.y = 0.3; _vHR.x += 0.1;
                _vFL.y += 0.1; _vFL.z -= 0.05;
                _vFR.y += 0.1; _vFR.z -= 0.05;
            }
            else if (this.state === 'VICTORY') {
                // Jumping excited
                const jump = Math.abs(Math.sin(time * 10));
                this.body.position.y = jump * 0.5;
                _vHL.y = 0.5; _vHR.y = 0.5; // Hands up
                _vFL.y = -0.3 + jump * 0.2; _vFR.y = -0.3 + jump * 0.2;
                this.mesh.rotation.y += dt * 2; // Spin
            }
            else if (this.state === 'DEFEAT') {
                // Kicking dirt / Looking down
                this.body.rotation.x = 0.4; // Look down
                _vHL.y = -0.2; _vHR.y = -0.2;
                // Kick dirt animation
                const kick = Math.sin(time * 5);
                if (kick > 0.5) {
                    _vFL.z = 0.2; _vFL.y = 0.1;
                } else {
                    _vFL.z = 0; _vFL.y = -0.32;
                }
            }
            else if (this.state === 'ATTACK') {
                if (this.attack.stage === 'STARTUP') {
                    // Anticipation: RAISE HANDS HIGH
                    this.body.scale.set(0.9, 1.15, 0.9); // Stretch vertically
                    this.body.position.y = 0.1;
                    
                    // Hands way up
                    _vHL.set(-0.2, 0.4, 0.0);
                    _vHR.set(0.2, 0.4, 0.0);
                    
                    // Feet tiptoe?
                    _vFL.y -= 0.05; _vFR.y -= 0.05;
                }
                else if (this.attack.stage === 'ACTIVE') {
                    // Release: SLAM DOWN
                    this.body.scale.set(1.3, 0.6, 1.3);
                    this.body.position.y = -0.2;
                    
                    // Hands on ground, forward
                    _vHL.set(-0.35, -0.3, 0.35);
                    _vHR.set(0.35, -0.3, 0.35);
                    
                    // Feet splayed
                    _vFL.x -= 0.1; _vFR.x += 0.1;
                }
                else if (this.attack.stage === 'RECOVERY') {
                    // Rising back up
                    const progress = this.attack.timer / (this.attack.data.RECOVERY / 60);
                    this.body.scale.y = 0.6 + (0.4 * progress);
                    this.body.position.y = -0.2 + (0.2 * progress);
                    
                    // Hands returning
                    _vHL.y = -0.3 + (0.3 * progress);
                    _vHR.y = -0.3 + (0.3 * progress);
                }
            }
            else if (this.state === 'FALL') {
                // Flail
                const flail = this.stateTimer * 25;
                _vHL.y = Math.sin(flail) * 0.2;
                _vHR.y = Math.cos(flail) * 0.2;
                _vFL.y += Math.cos(flail) * 0.1;
                _vFR.y += Math.sin(flail) * 0.1;
                
                // Spin the whole body mesh locally
                this.body.rotation.x = this.stateTimer * 10;
            }
            else if (this.state === 'STUNNED') {
                // Flail Arms
                const flail = this.stateTimer * 40; // Fast
                _vHL.y = 0.3 + Math.sin(flail) * 0.2;
                _vHL.x = -0.4;
                _vHR.y = 0.3 + Math.cos(flail) * 0.2;
                _vHR.x = 0.4;
                
                // Legs dangle
                _vFL.y = -0.4; _vFL.x = -0.1;
                _vFR.y = -0.4; _vFR.x = 0.1;
                
                // Spin/Wobble body
                this.body.rotation.z = Math.sin(this.stateTimer * 20) * 0.2;
                this.body.rotation.x = -0.2; // Look up slightly
            }

            // --- 3. Apply Transforms ---
            this.footL.position.copy(_vFL);
            this.footR.position.copy(_vFR);
            this.handL.position.copy(_vHL);
            this.handR.position.copy(_vHR);

            // --- 4. Procedural Tilt (Velocity Based) ---
            const maxTilt = 0.2;
            const tiltSpeed = 12;
            const targetRotX = (this.velocity.z / this.MAX_SPEED) * maxTilt;
            const targetRotZ = -(this.velocity.x / this.MAX_SPEED) * maxTilt;
            
            this.mesh.rotation.x += (targetRotX - this.mesh.rotation.x) * tiltSpeed * dt;
            this.mesh.rotation.z += (targetRotZ - this.mesh.rotation.z) * tiltSpeed * dt;

            // --- 5. Emissive / Color States ---
            this.updateEmissive();
        }

        updateEmissive() {
            if (this.state === 'CHARGING') {
                this.matBody.emissive.setHex(0x555500); // Yellow charge
                this.mesh.position.x += (Math.random() - 0.5) * 0.05; // Shake
            }
            else if (this.state === 'ATTACK' && this.attack.stage === 'ACTIVE') {
                this.matBody.emissive.setHex(0x550000); // Red flash
            }
            else if (this.state === 'DASH') {
                this.matBody.emissive.setHex(0x002222); // Subtle cyan
}
            else if (this.state === 'STUNNED') {
                // Flash White
                const flash = Math.sin(this.stateTimer * config.STUN.FLASH_SPEED);
                if (flash > 0) {
                    this.matBody.emissive.setHex(0x444444); // Greyish white flash
                } else {
                    this.matBody.emissive.setHex(0x000000);
                }
            }
            else {

                this.matBody.emissive.setHex(0x000000);
            }
        }

// createShadowTexture removed (Optimized to shared _texShadow)

        checkCombatInput(input) {
            // 1. Air Attack (Edge Stomp)
            if (this.state === 'HOP' && input.isJustPressed('attack')) {
                this.startAttack('EDGE_STOMP');
                return;
            }

            // 2. Ground/Dash Attack (Charge Logic)
            if (input.state.attack) {
                if (this.state === 'DASH' || this.state === 'IDLE' || this.state === 'WALK') {
                    this.startCharging(input);
                }
            }
        }

startCharging(input) {
            if (this.state === 'CHARGING') return;
            
            if (input) {
                let inX = input.state.x;
                let inY = input.state.y;
                
                // Enforce 4-way to match movement logic
                if (inX !== 0 && inY !== 0) {
                    if (Math.abs(inY) > Math.abs(inX)) inX = 0;
                    else inY = 0;
                }
                
                if (Math.abs(inX) > 0.1 || Math.abs(inY) > 0.1) {
                    this.facing.set(inX, 0, inY).normalize();
                    this.mesh.rotation.y = Math.atan2(this.facing.x, this.facing.z);
                }
            }

            this.prevState = this.state;
            this.state = 'CHARGING';
            this.chargeTimer = 0;
            this.velocity.set(0,0,0); // Stop movement
        }

        handleCharging(dt, input) {
            this.chargeTimer += dt;
            
            // Release?
            if (!input.state.attack) {
                const isHold = this.chargeTimer > 0.2;
                const fromDash = this.prevState === 'DASH';
                
                // --- Resolve Attack Type ---
                let type = null;
                let penalty = 0;

                if (fromDash) {
                    if (!isHold) {
                        type = 'SHOULDER_CHECK'; // Dash + Tap
                    } else {
                        type = 'SHOCKWAVE_CHARGED'; 
                        penalty = 2/60;
                    }
                } else {
                    // Normal State
                    if (!isHold) {
                        type = 'SHOCKWAVE_BASE'; 
                    } else {
                        type = 'RITE_SMASH';
                    }
                }

                if (type) {
                    this.startAttack(type);
                    this.attack.startupPenalty = penalty;
                } else {
                    this.state = 'IDLE';
                }
            }
        }

        startAttack(type) {
            this.state = 'ATTACK';
            this.attack.type = type;
            this.attack.stage = 'STARTUP';
            this.attack.timer = 0;
            this.attack.hasHit = false;
            this.attack.startupPenalty = 0;
            
            // Resolve data
            let data = MELEE[type] || config.SHOCKWAVE[type.replace('SHOCKWAVE_', '')];
            
            // Jab Chaining Logic
            if (type === 'JAB') {
                this.jabCount = (this.jabCount + 1) % 3; 
                this.jabResetTimer = 1.0; 
            } else {
                this.jabCount = 0;
            }

            this.attack.data = data; 

            if (!data) {
                console.warn(`FluxCode: No data found for attack type '${type}'`);
                this.state = 'IDLE';
                return;
            }
            
            // Instant Active checks
            if (type === 'SHOULDER_CHECK' || type === 'EDGE_STOMP') {
                if (data.STARTUP === 0) {
                    this.attack.stage = 'ACTIVE';
                }
            }
            
            console.log(`FluxCode: Player used ${type}`);
        }

        handleAttack(dt) {
            const data = this.attack.data;
            if (!data) {
                this.state = 'IDLE';
                return;
            }

            this.attack.timer += dt;
            
            let duration = 0;
            
            if (this.attack.stage === 'STARTUP') {
                duration = f2s(data.STARTUP) + this.attack.startupPenalty;
                if (this.attack.timer >= duration) {
                    this.attack.stage = 'ACTIVE';
                    this.attack.timer = 0;
                    this.performAttackEffect(data); 
                }
            }
            else if (this.attack.stage === 'ACTIVE') {
                duration = f2s(data.ACTIVE);
                
                if (!this.attack.hasHit) {
                    this.checkHit(data);
                }

                if (this.attack.timer >= duration) {
                    this.attack.stage = 'RECOVERY';
                    this.attack.timer = 0;
                }
            }
            else if (this.attack.stage === 'RECOVERY') {
                duration = f2s(data.RECOVERY);
                // Jab 3rd hit penalty
                if (this.attack.type === 'JAB' && this.jabCount === 2) {
                    duration += 4/60;
                }
                if (this.attack.timer >= duration) {
                    this.state = 'IDLE';
                }
            }
        }

performAttackEffect(data) {
            // _forward is populated by getForward()
            this.getForward(); 
            // Copy to _pVec1 to use as direction
            _pVec1.copy(_forward);
            
            // 1. Spawn Shockwaves
            if (this.attack.type.startsWith('SHOCKWAVE')) {
                const waveType = this.attack.type.replace('SHOCKWAVE_', '');
                this.shockwaveManager.spawn(this, waveType);
                window.flux.renderer.addShake(0.2); // Small shake on fire
                window.flux.audio.playSFX('SHOCKWAVE');
            }

            // 2. Tile Effects (Melee)
            // Target pos = position + forward * 1.0
            const targetPos = _pVec2.copy(this.position).addScaledVector(_pVec1, 1.0);
            const tx = Math.round(targetPos.x);
            const tz = Math.round(targetPos.z);
            const targetTile = this.arena.getTile(tx, tz);
            
            const px = Math.round(this.position.x);
            const pz = Math.round(this.position.z);
            const underTile = this.arena.getTile(px, pz);

            if (this.attack.type === 'SHOULDER_CHECK') {
                if (targetTile && targetTile.state === config.TILES.STATES.STABLE) {
                    targetTile.setState(config.TILES.STATES.CRACKED);
targetTile.triggerFall(config.TILES.TIMING.CRACKED_TO_FALLING_LIGHT);
                    window.flux.renderer.addShake(0.4); // Big shake on impact
                    window.flux.particles.spawn('SPARK', targetPos, 5);
                }
            }
            else if (this.attack.type === 'RITE_SMASH') {
                if (targetTile) {
                    if (targetTile.state === config.TILES.STATES.STABLE) {
                        targetTile.setState(config.TILES.STATES.CRACKED);
                        targetTile.triggerFall(config.TILES.TIMING.CRACKED_TO_FALLING_SMASH);
                    } else if (targetTile.state === config.TILES.STATES.CRACKED) {
                        targetTile.triggerFall(config.TILES.TIMING.CRACKED_TO_FALLING_SMASH);
                    }
                }
            }
            else if (this.attack.type === 'EDGE_STOMP') {
                if (underTile) {
                    this.advanceTileState(underTile);
                }
            }
        }

advanceTileState(tile) {
            const S = config.TILES.STATES;
            const T = config.TILES.TIMING;
            
            // Claim ownership when stomping
            if (tile.state === S.STABLE) {
                tile.setCracked(this);
                tile.triggerFall(T.CRACKED_TO_FALLING_SMASH);
            }
            else if (tile.state === S.CRACKED) {
                // Override ownership if already cracked
                tile.setCracked(this);
                tile.triggerFall(T.CRACKED_TO_FALLING_SMASH);
            }
        }

        checkHit(data) {
            // Placeholder for hit detection
        }

getForward() {
            return _forward.copy(this.facing);
        }

        // --- Movement Logic ---
handleMovement(dt, input) {
             _inputVec.set(input.state.x, 0, input.state.y);
             
             // 4-Way Lock: Remove diagonals (D-Pad Feel)
             if (_inputVec.x !== 0 && _inputVec.z !== 0) {
                 if (Math.abs(_inputVec.z) > Math.abs(_inputVec.x)) {
                     _inputVec.x = 0;
                 } else {
                     _inputVec.z = 0;
                 }
             }

             if (_inputVec.lengthSq() > 1) _inputVec.normalize();
             
if (input.isJustPressed('dash')) {
                 if (this.dashes > 0) {
                     this.startDash(_inputVec);
                 } else {
                     // Visual feedback for empty dash?
                     // For now just console/debug
                     console.log("FluxCode: Out of dashes!");
                 }
                 return;
             }
             if (input.isJustPressed('hop')) {
                 this.startHop();
                 return;
             }
 
             if (_inputVec.lengthSq() > 0.1) {
                 this.state = 'WALK';
                 
                 // Update Facing & Rotation
                 this.facing.copy(_inputVec).normalize();
                 this.mesh.rotation.y = Math.atan2(this.facing.x, this.facing.z);

const targetVel = _inputVec.multiplyScalar(this.MAX_SPEED);
                 
                 // CAPE SPEED BOOST
                 if (this.activePowerup && this.activePowerup.type === 'CAPE') {
                     targetVel.multiplyScalar(config.POWERUPS.TYPES.CAPE.SPEED_MULT);
                 }
                 
                 // Turn Assist: Double acceleration if trying to reverse direction
                 let effectiveAccel = this.ACCEL;
                 if (this.velocity.lengthSq() > 0.1) {
                     const dot = _inputVec.dot(this.velocity.clone().normalize());
                     if (dot < -0.5) effectiveAccel *= 2.0;
                 }

                 const diff = targetVel.sub(this.velocity);
                 const maxChange = effectiveAccel * dt;
                 
                 if (diff.length() > maxChange) {
                     diff.setLength(maxChange);
                 }
                 this.velocity.add(diff);

                 // Dust Trail
                 this.dustTimer -= dt;
                 if (this.dustTimer <= 0) {
                     this.dustTimer = 0.15; // Every 0.15s
                     
                     // Spawn at the grounded foot (lowest local Y)
                     let targetFoot = this.footL;
                     if (this.footR.position.y < this.footL.position.y) {
                         targetFoot = this.footR;
                     } else if (Math.abs(this.footR.position.y - this.footL.position.y) < 0.01) {
                         targetFoot = Math.random() > 0.5 ? this.footL : this.footR;
                     }

                     targetFoot.getWorldPosition(_dustVec);
                     _dustVec.y = 0.05; // Force to ground level
                     
                     window.flux.particles.spawn('DUST', _dustVec, 1, 0.3);
                 }
             } else {
                 this.state = 'IDLE';
                 const speed = this.velocity.length();
                 if (speed > 0) {
                     const drop = this.FRICTION * dt;
                     const newSpeed = Math.max(0, speed - drop);
                     this.velocity.multiplyScalar(newSpeed / speed);
                 }
             }
        }

startDash(dirVec) {
            this.state = 'DASH';
            this.stateTimer = 0;
            
            // CRYSTAL: Infinite Dashes
            if (this.activePowerup && this.activePowerup.type === 'CRYSTAL') {
                // Do not consume dash
            } else {
                this.dashes--; // Consume dash
            }
            
            console.log(`FluxCode: Dashed! Remaining: ${this.dashes}`);
            
            let dashDir = dirVec.clone();
            if (dashDir.lengthSq() === 0) {
                dashDir = this.getForward();
            }
            dashDir.normalize();
            
            // --- CRITICAL: SNAP FACING TO DASH DIRECTION ---
            // Player must physically face the direction they are dashing
            this.facing.copy(dashDir);
            this.mesh.rotation.y = Math.atan2(this.facing.x, this.facing.z);
            
            this.velocity.copy(dashDir).multiplyScalar(18);

            // Initial Burst
            const pPos = this.position.clone();
            pPos.y = 0.2;
            window.flux.particles.spawn('STAR', pPos, 3, 0.5);
            
            // CRYSTAL: Extra particles
            if (this.activePowerup && this.activePowerup.type === 'CRYSTAL') {
                 window.flux.particles.spawn('STAR', pPos, 5, 0.8, 0x00ffff);
            }

            window.flux.particles.spawn('DUST', pPos, 5, 0.8);
            
window.flux.audio.playSFX('DASH');
            window.flux.audio.playSFX('GRUNT');
        }

handleDash(dt) {
            const activeTime = config.MOVEMENT.DASH.ACTIVE / 60;
            
            // --- SPEED LINES ---
            // Emit particles aligned with dash direction
            if (this.stateTimer % 0.05 < dt) { // Throttle emission
                // Use _pVec1 for position
                _pVec1.copy(this.position);
                _pVec1.y = 0.3;
                // Random offset around player
                _pVec1.x += (Math.random() - 0.5) * 0.5;
                _pVec1.z += (Math.random() - 0.5) * 0.5;
                
                // Velocity opposite to facing
                // Use _pVec2 for velocity
                _pVec2.copy(this.facing).multiplyScalar(-1); 
                
                // Pass velocity to spawn for alignment
                window.flux.particles.spawn('SPEED_LINE', _pVec1, 1, 0, 0xffffff);
            }

            // --- ANGEL WINGS PASSIVE ---
            // Auto-hop over holes
            if (this.currentCosmeticId === 'angel_wings') {
                const checkDist = 1.0;
const checkPos = _pVec1.copy(this.position).addScaledVector(this.facing, checkDist);
                const tx = Math.round(checkPos.x);
                const tz = Math.round(checkPos.z);
                const tile = this.arena.getTile(tx, tz);
                
                // If tile is dangerous (Missing/Falling)
                if (!tile || tile.state === config.TILES.STATES.MISSING || tile.state === config.TILES.STATES.FALLING) {
                    // Trigger Hop
                    this.startHop();
                    // Visual feedback
// Visual feedback
                    window.flux.particles.spawn('STAR', this.position.clone(), 5, 0.5);
                    window.flux.audio.playSFX('DASH'); // Flap sound?
                    return; // Exit dash state
                }
            }

            if (this.stateTimer > activeTime) {
                this.state = 'DASH_RECOVERY';
                this.stateTimer = 0;
                this.velocity.multiplyScalar(0.5); 
                this.mesh.rotation.z = 0;
const endPos = _pVec1.copy(this.position);
                endPos.y = 0.5; 
                window.flux.particles.spawn('STAR', endPos, 4, 0.6); 
            }
        }

        checkDashInterrupt(input) {
            if (input.isJustPressed('dash')) {
                if (this.dashes > 0) {
                    // Calculate direction from input
                    _inputVec.set(input.state.x, 0, input.state.y);
                    
                    // Enforce 4-Way
                    if (_inputVec.x !== 0 && _inputVec.z !== 0) {
                        if (Math.abs(_inputVec.z) > Math.abs(_inputVec.x)) _inputVec.x = 0;
                        else _inputVec.z = 0;
                    }

                    if (_inputVec.lengthSq() > 1) _inputVec.normalize();
                    
                    this.startDash(_inputVec);
                    return true;
                } else {
                    // Out of dashes feedback?
                }
            }
            return false;
        }

        handleDashRecovery(dt) {
            // High Friction (Incapacitated)
            const friction = this.FRICTION * 2.0; 
            const speed = this.velocity.length();
            if (speed > 0) {
                const drop = friction * dt;
                const newSpeed = Math.max(0, speed - drop);
                this.velocity.multiplyScalar(newSpeed / speed);
            }

            const recoveryTime = config.MOVEMENT.DASH.RECOVERY / 60;
            if (this.stateTimer > recoveryTime) {
                this.state = 'IDLE';
            }
        }

        startHop() {
            this.state = 'HOP';
            this.stateTimer = 0;
            this.velocity.y = 8; 
        }

        handleHop(dt) {
            this.velocity.y -= 25 * dt;
if (this.position.y <= 0.27 && this.velocity.y < 0) {
                this.position.y = 0.27;
                this.velocity.y = 0;
                this.state = 'IDLE';
                this.checkGround(); 
            }
        }

checkGround() {
            const tx = Math.round(this.position.x);
            const tz = Math.round(this.position.z);
            const tile = this.arena.getTile(tx, tz);
            
            if (!tile || tile.state === config.TILES.STATES.MISSING || tile.state === config.TILES.STATES.FALLING) {
                // Check for killer attribution
                if (tile && tile.owner && tile.owner !== this) {
                    this.lastAttacker = tile.owner;
                }
                this.startFall();
            }
        }

startFall() {
            if (this.state === 'FALL') return;
            this.state = 'FALL';
            this.velocity.set(0, 0, 0); 
            window.flux.audio.playSFX('FALL');
        }

        handleFall(dt) {
            this.position.y -= 15 * dt;
            if (this.position.y < -5) {
this.onDeath();
                window.flux.renderer.addShake(0.6); // Huge shake on death
            }
}

        handleStunned(dt) {
            // Gravity
            this.velocity.y -= 25 * dt;
            
            // Friction on X/Z (Air resistance)
            this.velocity.x *= 0.95;
            this.velocity.z *= 0.95;

            // Land?
            if (this.position.y <= 0.27 && this.velocity.y < 0) {
                this.position.y = 0.27;
                this.velocity.y = 0;
                this.velocity.x = 0;
                this.velocity.z = 0;
                this.state = 'IDLE';
                this.matBody.map = this.texFaceNormal; // Restore face
                
                // Small landing dust
                const pPos = this.position.clone();
                pPos.y = 0.1;
                window.flux.particles.spawn('DUST', pPos, 3, 0.4);
            }
        }

applyStun(attacker, knockbackOverride = null) {
            if (this.state === 'STUNNED' || this.state === 'DEAD' || this.invulnTimer > 0) return;
            
            this.state = 'STUNNED';
            this.stateTimer = 0;
            
            // Pop up
            this.velocity.y = config.STUN.VELOCITY_Y;
            
            // Knockback (Away from attacker)
const dir = _pVec1.copy(this.position).sub(attacker.position).normalize();
            // If stacked, random dir
            if (dir.lengthSq() === 0) dir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
            
            const force = knockbackOverride !== null ? knockbackOverride : config.STUN.KNOCKBACK;

            this.velocity.x = dir.x * force;
            this.velocity.z = dir.z * force;
            
            // Visuals
            this.matBody.map = this.texFaceStunned;
            window.flux.particles.spawn('STAR', this.position.clone().add(new THREE.Vector3(0,0.5,0)), 5, 0.5);
            // Sound removed per request (no VOICE_HURT on dash hit)
            
            // Attribution
            this.lastAttacker = attacker;
            
            console.log(`FluxCode: ${this.label} STUNNED by ${attacker.label} (Force: ${force})`);
        }

        checkDashHit(target) {
            if (this.state !== 'DASH') return;
            
const dist = this.position.distanceTo(target.position);
            if (dist < 0.8) {
                // Reduced Knockback Force
                // Previous 18.0 was sending players flying 6+ blocks.
                // 5.0 should result in ~1.5 blocks of slide with current friction.
                let force = 5.0;
                
                // CRYSTAL: 2 Block Knockback
                if (this.activePowerup && this.activePowerup.type === 'CRYSTAL') {
                    force *= config.POWERUPS.TYPES.CRYSTAL.KNOCKBACK_MULT;
                    // Add extra flash/shake
                    window.flux.renderer.addShake(0.5);
                    window.flux.particles.spawn('STAR', target.position, 10, 1.0, 0x00ffff);
                }

                target.applyStun(this, force);
            }
        }
// (Cleaned up comments)
onDeath() {
            this.lives--;
            
            if (window.flux.gameState && window.flux.gameState.onPlayerFall) {
                window.flux.gameState.onPlayerFall(this, this.lastAttacker);
            }
            this.lastAttacker = null; // Reset

            if (this.lives > 0) {
                this.respawn();
            } else {
                this.eliminate();
            }
        }

        eliminate() {
            this.state = 'DEAD';
            this.mesh.visible = false;
            this.position.set(0, -100, 0); 
            console.log(`FluxCode: ${this.label} ELIMINATED`);
            window.flux.ui.showMessage(`${this.label} OUT!`);
        }

        respawn() {
const spawnPos = this.arena.getRespawnPos(new THREE.Vector3(3.5, 0, 3.5));
            
            this.position.copy(spawnPos);
            this.velocity.set(0, 0, 0);
this.state = 'IDLE';
            this.matBody.map = this.texFaceNormal;
            this.dashes = config.MOVEMENT.MAX_DASHES; // Reset dashes on respawn
            this.mesh.position.copy(this.position);
            this.mesh.visible = true;
            
            this.arena.spawnRespawnPlatform(this, spawnPos);
            
            console.log(`FluxCode: ${this.label} Respawned (${this.lives} lives left)`);
        }
enforcePerimeter() {
            const width = this.arena.width;
            const STATES = config.TILES.STATES;
const playerRadius = 0.25 * 0.76; // Scaled radius

            // Current Grid Position
            const px = this.position.x;
            const pz = this.position.z;
            const tx = Math.round(px);
            const tz = Math.round(pz);
            
            const currentTile = this.arena.getTile(tx, tz);
            
            // We only perform wall collision if we are currently on a 'Safe' tile.
            // If we are on a Falling/Missing tile, we are already doomed (handled by checkGround),
            // so we shouldn't get stuck on walls while falling.
            const isSafe = currentTile && (
                currentTile.state === STATES.STABLE || 
                currentTile.state === STATES.CRACKED || 
                currentTile.state === STATES.STONE
            );

            if (isSafe) {
                // Helper to check if a neighbor is a "Wall" (Hole or Void)
                const checkWall = (dx, dz) => {
                    const neighbor = this.arena.getTile(tx + dx, tz + dz);
                    // Treat as wall if:
                    // 1. It's null (Void/Off-map)
                    // 2. It's MISSING (Hole)
                    // 3. It's FALLING (Already triggered, acts as hole for entry)
                    // 4. It's REFORMING (Not solid yet)
                    if (!neighbor || 
                        neighbor.state === STATES.MISSING || 
                        neighbor.state === STATES.FALLING || 
                        neighbor.state === STATES.REFORMING) {
                        return true; 
                    }
                    return false;
                };

                // --- Collision Resolution (AABB vs Grid Walls) ---
                
                // East (x+1)
                if (checkWall(1, 0)) {
                    const wallX = tx + 0.5; // Left edge of the neighbor
                    if (this.position.x + playerRadius > wallX) {
                        this.position.x = wallX - playerRadius;
                        this.velocity.x = 0;
                    }
                }
                // West (x-1)
                if (checkWall(-1, 0)) {
                    const wallX = tx - 0.5; // Right edge of the neighbor
                    if (this.position.x - playerRadius < wallX) {
                        this.position.x = wallX + playerRadius;
                        this.velocity.x = 0;
                    }
                }
                // South (z+1)
                if (checkWall(0, 1)) {
                    const wallZ = tz + 0.5; // Top edge of neighbor
                    if (this.position.z + playerRadius > wallZ) {
                        this.position.z = wallZ - playerRadius;
                        this.velocity.z = 0;
                    }
                }
                // North (z-1)
                if (checkWall(0, -1)) {
                    const wallZ = tz - 0.5; // Bottom edge of neighbor
                    if (this.position.z - playerRadius < wallZ) {
                        this.position.z = wallZ + playerRadius;
                        this.velocity.z = 0;
                    }
                }
            }

            // Global Safety Clamp (Just in case of tunneling)
            // Keeps player within the absolute maximum grid coordinates
            if (this.position.x < -0.4) this.position.x = -0.4;
            if (this.position.x > width - 0.6) this.position.x = width - 0.6;
            if (this.position.z < -0.4) this.position.z = -0.4;
            if (this.position.z > width - 0.6) this.position.z = width - 0.6;
}

        setResultState(result) {
            if (this.state === 'DEAD') return;
            this.state = result; // 'VICTORY' or 'DEFEAT'
            this.velocity.set(0,0,0);
            this.mesh.visible = true;
            this.matBody.map = this.texFaceNormal;
}
    }

    window.flux.toggleOutlines = function() {
        config.PERFORMANCE.ENABLE_OUTLINES = !config.PERFORMANCE.ENABLE_OUTLINES;
        const enabled = config.PERFORMANCE.ENABLE_OUTLINES;
        console.log(`FluxCode: Outlines set to ${enabled}`);

        const updateRoot = (root) => {
            if (!root) return;
            root.traverse(child => {
                if (child.userData.isOutline) {
                    child.visible = enabled;
                }
            });
        };

        // Update Players
        if (window.flux.player) updateRoot(window.flux.player.mesh);
        if (window.flux.cpus) window.flux.cpus.forEach(cpu => updateRoot(cpu.player.mesh));
        
        // Update Arena Tiles
        if (window.flux.arena && window.flux.arena.tiles) {
            window.flux.arena.tiles.forEach(t => updateRoot(t.mesh));
        }
        
        return enabled;
    };

    window.flux.Player = Player;
})();