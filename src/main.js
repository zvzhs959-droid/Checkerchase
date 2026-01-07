/**
 * STONEWAVE DUEL - ENTRY POINT
 */
(function() {
// Wait for window load to ensure all scripts are parsed
    window.addEventListener('load', init);

    // Module-scoped reusable arrays/objects to prevent GC
    const _mAllPlayers = [];
    
    function _mPopulatePlayers() {
        _mAllPlayers.length = 0;
        if (window.flux.player) _mAllPlayers.push(window.flux.player);
        if (window.flux.cpus) {
            for (let i = 0; i < window.flux.cpus.length; i++) {
                if (window.flux.cpus[i].player) {
                    _mAllPlayers.push(window.flux.cpus[i].player);
                }
            }
        }
    }

    function init() {
        console.log("FluxCode: StoneWave Duel Initializing...");
        
        const renderer = window.flux.renderer;
        
        // --- Persistent Systems ---
        const input = new window.flux.Input();
        const ui = new window.flux.UI();
        window.flux.ui = ui;


// --- Online Multiplayer (WebRTC) ---
        // Initialize as null, waiting for UI interaction
        window.flux.net = null;

        // Bind UI Callbacks
ui.onHost = () => {
            console.log("FluxCode: Starting Host Mode...");
            if (window.flux.net) window.flux.net.destroy();
            
            // Host with default ID preference
            const net = new window.flux.NetClient({ 
                room: null,
                requestedHostId: window.flux.config.NET.DEFAULT_ROOM 
            });
            window.flux.net = net;
            setupNetworking(net);
        };

        ui.onJoin = (id) => {
            // Auto-join default if empty
            const targetId = id || window.flux.config.NET.DEFAULT_ROOM;
            console.log(`FluxCode: Joining Room ${targetId}...`);
            
            if (window.flux.net) window.flux.net.destroy();
            
            const net = new window.flux.NetClient({ room: targetId });
            window.flux.net = net;
            setupNetworking(net);
        };

        // Lobby Callbacks
        ui.onLobbyStart = () => {
            if (window.flux.net && window.flux.net.isHost) {
                window.flux.net.startGame();
                window.flux.startMatch();
                ui.hideLobby();
            }
        };

        ui.onLobbyLeave = () => {
            if (window.flux.net) {
                window.flux.net.destroy();
                window.flux.net = null;
            }
            ui.showMessage("LEFT LOBBY", 1500);
        };

function setupNetworking(net) {
            net.onError = (msg) => {
                console.error(msg);
                ui.showMessage(msg, 3000);
                ui.hideLobby();
            };

net.onHostId = (id) => {
                // Show Lobby
                ui.showLobby(true, id);
                
                // Copy to clipboard automatically for convenience
                const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
                navigator.clipboard.writeText(id).catch(() => {});
            };

            net.onReady = () => {
                // Connected. If Client, show Lobby waiting screen.
                if (!net.isHost) {
                    ui.showLobby(false, net.hostId || "...");
                    ui.showMessage(`CONNECTED!`, 1500);
                }
                // Update lobby list immediately
                ui.updateLobbyList(net.playersPresent, net.names, net.slotOpen, net.isHost);
            };
            
            net.onPresence = () => {
                // Update Lobby UI
                ui.updateLobbyList(net.playersPresent, net.names, net.slotOpen, net.isHost);
                // Also rebuild controllers if match is running (hot join?)
                if (window.flux.gameState) window.flux.rebuildControllers();
            };
            
            net.onStartMatch = (data) => {
                console.log("FluxCode: Match Starting!");
                ui.hideLobby();
                window.flux.startMatch(data || {});
            };


            net.onRestartMatch = (data) => {
                console.log("FluxCode: Match Restarting!");
                ui.hideLobby();
                window.flux.startMatch(data || {});
            };

            net.onSnapshot = (snap) => {
                applySnapshot(snap);
            };

            net.connect();
        }
        
        // Particle System (Persistent Pool)
        const particles = new window.flux.ParticleSystem(renderer.scene);
        window.flux.particles = particles;

        // --- Match State Containers ---
        window.flux.cpus = [];
        window.flux.currentShockwaveManager = null;

        // --- Helper Functions ---
function getColoredName(p) {
            const c = '#' + p.color.toString(16).padStart(6, '0');
            return `<span style="color:${c}">${p.label}</span>`;
        }

        function updateStockUI() {
            if (!window.flux.player) return;
            _mPopulatePlayers();
            ui.updateStocks(_mAllPlayers);
        }


        // --- Multiplayer Snapshot Helpers (Host-authoritative correction) ---
        function captureSnapshot() {
            const players = window.flux._players || [];
            const arena = window.flux.arena;
            const pwr = window.flux.powerups;

            const snap = { t: performance.now(), p: [] };

            // --- Players ---
            for (let i = 0; i < players.length; i++) {

                const pl = players[i];
                if (!pl) continue;
                snap.p[i] = {
                    x: pl.position.x, y: pl.position.y, z: pl.position.z,
                    vx: pl.velocity.x, vy: pl.velocity.y, vz: pl.velocity.z,
                    // Facing for VFX / shockwave direction (visual-only on clients)
                    fx: (pl.facing ? pl.facing.x : 0), fz: (pl.facing ? pl.facing.z : 1),

                    state: pl.state,
                    stateTimer: pl.stateTimer,
                    invulnTimer: pl.invulnTimer,

                    // Combat / powerup state (for visuals + remote animation correctness)
                    atk: (pl.attack ? { ty: pl.attack.type, a: !!pl.attack.active, tm: pl.attack.timer } : null),
                    ap: (pl.activePowerup ? { ty: pl.activePowerup.type, tm: pl.activePowerup.timer } : null),

                    lives: pl.lives,
                    dashes: pl.dashes,
                    kills: pl.kills
                };
            }

            // --- Arena / Tiles ---
            if (arena && arena.tiles) {
                snap.tiles = new Array(arena.tiles.length);
                for (let i = 0; i < arena.tiles.length; i++) {
                    const t = arena.tiles[i];
                    snap.tiles[i] = {
                        s: t.state,
                        tm: t.timer,
                        ps: t.pendingState,
                        pt: t.pendingTimer,
                        ip: t.isPermanent ? 1 : 0,
                        cc: (t.customColor === null || t.customColor === undefined) ? null : t.customColor
                    };
                }
                snap.arena = {
                    sl: arena.shrinkLevel || 0,
                    is: arena.isShrinking ? 1 : 0,
                    st: arena.shrinkStage || 'IDLE',
                    ti: arena.shrinkTimer || 0
                };

                // Respawn platforms
                if (arena.platforms) {
                    snap.plats = [];
                    for (let i = 0; i < arena.platforms.length; i++) {
                        const p = arena.platforms[i];
                        if (!p || !p.active) continue;
                        const ps = (p.player && players) ? players.indexOf(p.player) : -1;
                        snap.plats.push({
                            x: p.gridX,
                            z: p.gridZ,
                            o: p.occupied ? 1 : 0,
                            tm: p.timer,
                            ps: ps
                        });
                    }
                }
            }

            // --- Powerups ---
            if (pwr && pwr.powerups) {
                snap.pu = [];
                for (let i = 0; i < pwr.powerups.length; i++) {
                    const pu = pwr.powerups[i];
                    if (!pu || !pu.active) continue;
                    snap.pu.push({
                        id: pu.id || null,
                        ty: pu.type,
                        x: pu.mesh.position.x,
                        z: pu.mesh.position.z,
                        lt: pu.lifeTime
                    });
                }
            }

            
            // Forward latest per-slot inputs so NetControllers can animate remote players (walk/attacks) accurately.
            if (window.flux.net && window.flux.net.inputs) {
                // Shallow clone per slot to avoid accidental mutation
                snap.inp = window.flux.net.inputs.map(s => s ? ({ x: (s.x||0), y: (s.y||0), attack: !!s.attack, dash: !!s.dash, hop: !!s.hop }) : null);
            }
return snap;
        }

function applySnapshot(snap) {
            if (!snap || !snap.p) return;

            const players = window.flux._players || [];
            const localSlot = window.flux.localSlot || 0;

            // Update forwarded input states (used for NetController remote animation)
            if (snap.inp && window.flux.net) {
                window.flux.net.inputs = snap.inp;
            }

// --- Net Events (reliable one-shots / VFX) ---
if (snap.ev && Array.isArray(snap.ev)) {
    window.flux._seenNetEv = window.flux._seenNetEv || {};
    for (let i = 0; i < snap.ev.length; i++) {
        const ev = snap.ev[i];
        if (!ev || !ev.id) continue;
        if (window.flux._seenNetEv[ev.id]) continue;
        window.flux._seenNetEv[ev.id] = 1;

        if (ev.k === 'SW' && window.flux.currentShockwaveManager && window.flux.currentShockwaveManager.spawnFromNet) {
            window.flux.currentShockwaveManager.spawnFromNet(ev);
        }
    }
    // bound seen map to avoid unbounded growth
    const keys = Object.keys(window.flux._seenNetEv);
    if (keys.length > 200) {
        for (let k = 0; k < keys.length - 120; k++) delete window.flux._seenNetEv[keys[k]];
    }
}


            // Track whether stats changed so we can refresh UI
            let _uiDirty = false;


            // --- Players (Host-authoritative) ---
            for (let i = 0; i < players.length; i++) {
                const s = snap.p[i];
                const pl = players[i];
                const _prevLives = pl ? pl.lives : null;
                const _prevDashes = pl ? pl.dashes : null;
                const _prevState = pl ? pl.state : null;
                if (!s || !pl) continue;

                // If this player is controlled by a NetController, use it for smoothing.
                const controller = window.flux.cpus ? window.flux.cpus.find(c => c.player === pl) : null;

                // For the local player, we still accept host authority for EVERYTHING except
                // we reconcile position with smoothing so controls don't feel completely dead.
                const isLocal = (i === localSlot);

                if (controller && typeof controller.onSnapshot === 'function' && !isLocal) {
                    controller.onSnapshot(s);
                } else {
                    // Position reconciliation
                    const dx = s.x - pl.position.x;
                    const dy = s.y - pl.position.y;
                    const dz = s.z - pl.position.z;
                    const distSq = dx*dx + dy*dy + dz*dz;

                    if (isLocal) {
                        // If we're wildly off, hard snap. Otherwise nudge toward host.
                        if (distSq > 4.0) {
                            pl.position.set(s.x, s.y, s.z);
                        } else {
                            pl.position.x += dx * 0.35;
                            pl.position.y += dy * 0.35;
                            pl.position.z += dz * 0.35;
                        }
                    } else {
                        pl.position.set(s.x, s.y, s.z);
                    }

// Velocity/state:
// - Remote players: always accept authoritative state.
// - Local player (non-host): keep local control responsive; only accept critical authoritative states.
const __critical = (s.state === 'FALL' || s.state === 'DEAD');
if (!isLocal || __critical) {
    pl.velocity.set(s.vx, s.vy, s.vz);
    pl.state = s.state;
    pl.stateTimer = s.stateTimer;
} else {
    // Blend velocity gently toward host to prevent drift without ruining responsiveness
    pl.velocity.x = pl.velocity.x * 0.7 + s.vx * 0.3;
    pl.velocity.y = pl.velocity.y * 0.7 + s.vy * 0.3;
    pl.velocity.z = pl.velocity.z * 0.7 + s.vz * 0.3;
    // If we were in FALL locally but host says not, snap out immediately
    if (pl.state === 'FALL' && s.state !== 'FALL') {
        pl.state = s.state;
        pl.stateTimer = s.stateTimer;
        pl.position.set(s.x, s.y, s.z);
    }
}
pl.invulnTimer = s.invulnTimer;


// FALL stuck guard: if host reports a non-sensical FALL while clearly grounded, recover visuals
if (!isLocal && pl.state === 'FALL' && pl.position.y >= 0.22 && Math.abs(pl.velocity.y) < 0.2) {
    const sp2 = Math.hypot(pl.velocity.x, pl.velocity.z);
    pl.state = (sp2 > 0.15) ? 'WALK' : 'IDLE';
    pl.stateTimer = 0;
}

                    // Better remote walk animation: infer WALK from velocity if needed
                    if (!isLocal && (pl.state === 'IDLE' || pl.state === 'WALK')) {
                        const sp = Math.hypot(pl.velocity.x, pl.velocity.z);
                        pl.state = (sp > 0.15) ? 'WALK' : 'IDLE';
                    }

                    // Facing (for consistent VFX direction)
                    if (typeof s.fx === 'number' && typeof s.fz === 'number' && pl.facing) {
                        pl.facing.set(s.fx, 0, s.fz).normalize();
                        if (pl.facing.lengthSq() === 0) pl.facing.set(0, 0, 1);
                    }

                    // Attack state (visual correctness for remote clients)
                    if (s.atk && pl.attack) {
                        pl.attack.type = s.atk.ty;
                        pl.attack.active = !!s.atk.a;
                        pl.attack.timer = s.atk.tm || 0;
                    }

                    // Remote attack VFX: if the host says an attack just became active, spawn visuals once.
                    if (!isLocal && s.atk && pl.attack) {
                        const prevAtk = !!pl._netLastAtkActive;
                        const nowAtk = !!s.atk.a;
                        if (nowAtk && !prevAtk) {
                            // Ensure type is set before spawning
                            pl.attack.type = s.atk.ty;
                            pl.attack.active = true;
                            pl.attack.timer = s.atk.tm || 0;
                            if (typeof pl.performAttackEffect === 'function') {
                                pl.performAttackEffect({});
                            }
                        }
                        pl._netLastAtkActive = nowAtk;
                    }


                    // Powerup visual state
                    if (s.ap) {
                        // If we have a powerup mismatch, just set timers/type for visuals;
                        // gameplay is still host-auth via snapshots.
                        pl.activePowerup = pl.activePowerup || { type: s.ap.ty, timer: s.ap.tm };
                        pl.activePowerup.type = s.ap.ty;
                        pl.activePowerup.timer = s.ap.tm;
                    } else {
                        pl.activePowerup = null;
                    }

                    pl.lives = s.lives;
                    pl.dashes = s.dashes;
                    pl.kills = s.kills;

                    // UI refresh on stat changes
                    if (_prevLives !== pl.lives || _prevDashes !== pl.dashes) _uiDirty = true;

                    // If we just exited a FALL state, snap immediately to avoid lingering under-arena visuals
                    if (_prevState === 'FALL' && pl.state !== 'FALL') {
                        pl.position.set(s.x, s.y, s.z);
                    }

                    if (pl.mesh) pl.mesh.position.copy(pl.position);
                }
            }

            // --- World State (Tiles/Powerups/Platforms) ---
            // Only clients need to apply this (host is already authoritative).
            if (window.flux.net && window.flux.net.slot !== 0) {
                // Tiles / Arena shrink state
                if (snap.tiles && window.flux.arena && window.flux.arena.tiles) {
                    const arena = window.flux.arena;
                    const tiles = arena.tiles;
                    const st = snap.tiles;

                    for (let i = 0; i < tiles.length && i < st.length; i++) {
                        const tile = tiles[i];
                        const ts = st[i];
                        if (!tile || !ts) continue;

                        // Apply custom color before state so cracked mats can use it
                        tile.customColor = (ts.cc === null || ts.cc === undefined) ? null : ts.cc;
                        tile.isPermanent = !!ts.ip;

                        if (tile.state !== ts.s) {
                            tile.setState(ts.s);
                        }
                        // Restore timers
                        tile.timer = ts.tm || 0;
                        tile.pendingState = (ts.ps === undefined) ? null : ts.ps;
                        tile.pendingTimer = ts.pt || 0;
                    }

                    if (snap.arena) {
                        arena.shrinkLevel = snap.arena.sl || 0;
                        arena.isShrinking = !!snap.arena.is;
                        arena.shrinkStage = snap.arena.st || 'IDLE';
                        arena.shrinkTimer = snap.arena.ti || 0;
                    }

                    // Platforms: keyed sync by x,z
                    if (snap.plats) {
                        const key = (x,z)=>`${x},${z}`;
                        const existing = new Map();
                        for (let i = 0; i < arena.platforms.length; i++) {
                            const p = arena.platforms[i];
                            if (!p) continue;
                            existing.set(key(p.gridX, p.gridZ), p);
                        }
                        const keep = new Set();

                        for (let i = 0; i < snap.plats.length; i++) {
                            const ps = snap.plats[i];
                            if (!ps) continue;
                            const k = key(ps.x, ps.z);
                            keep.add(k);

                            let plat = existing.get(k);
                            if (!plat) {
                                // Create new platform
                                const pl = (ps.ps >= 0 && players[ps.ps]) ? players[ps.ps] : players[0];
                                const pos = new THREE.Vector3(ps.x, 0.5, ps.z);
                                arena.spawnRespawnPlatform(pl, pos);
                                plat = arena.platforms[arena.platforms.length - 1];
                            }
                            if (plat) {
                                plat.occupied = !!ps.o;
                                plat.timer = ps.tm || 0;
                                plat.active = true;
                                // Visual opacity for fade state
                                if (plat.mesh && plat.mesh.material) {
                                    if (!plat.occupied) {
                                        const dur = window.flux.config.ARENA.PLATFORM_DURATION;
                                        plat.mesh.material.opacity = (plat.timer / dur) * 0.5;
                                    } else {
                                        plat.mesh.material.opacity = 0.5;
                                    }
                                }
                            }
                        }

                        // Remove platforms not in snapshot
                        for (let i = arena.platforms.length - 1; i >= 0; i--) {
                            const p = arena.platforms[i];
                            if (!p) continue;
                            const k = key(p.gridX, p.gridZ);
                            if (!keep.has(k)) {
                                p.destroy();
                                arena.platforms.splice(i, 1);
                            }
                        }
                    }
                }

                // Powerups
                if (snap.pu && window.flux.powerups && typeof window.flux.powerups.syncFromSnapshot === 'function') {
                    window.flux.powerups.syncFromSnapshot(snap.pu);
                }
            }
        

            // Refresh stocks UI on clients when authoritative stats change
            if (_uiDirty) {
                try { updateStockUI(); } catch(e) {}
            }
}

        function checkWinCondition() {
            _mPopulatePlayers();
            const alive = _mAllPlayers.filter(p => p.lives > 0);
            
            if (alive.length === 1) {
                const winner = alive[0];
                
                // Slow motion finish
// Slow motion finish
                window.flux.gameState.timeScale = 0.2; 
                
                // Clear Powerups on win
                if (window.flux.powerups) {
                    window.flux.powerups.powerups.forEach(p => p.destroy());
                    window.flux.powerups.powerups = [];
                }

if (winner === window.flux.player) {
                    // VICTORY SEQUENCE
                    console.log(`FluxCode: Victory!`);
                    
                    // Set Animations
                    winner.setResultState('VICTORY');
                    alive.forEach(p => { if(p!==winner) p.setResultState('DEFEAT'); }); // Should be none alive but just in case
                    _mAllPlayers.forEach(p => {
                        if (p !== winner && p.lives <= 0) {
                            // Revive dead players for defeat animation? 
                            // Usually dead players are gone. Let's just animate the winner.
                        }
                    });

                    // Play Win Sound
                    window.flux.audio.playWin();

setTimeout(() => {
                        // VICTORY LOOP: Keep timeScale at 1.0 for animations, but disable game logic
                        window.flux.gameState.gameOver = true; 
                        
                        // Award Stars
                        const earned = window.flux.config.SHOP.REWARD_WIN;
                        const total = window.flux.storage.addStars(earned);
                        window.flux.ui.updateStars();
                        
                        window.flux.ui.showStarAward(earned, total);
                    }, 1500);

                } else {
                    // DEFEAT
                    ui.showMessage(`${getColoredName(winner)} WINS!`, 3000);
                    
                    // Set Animations
                    if (window.flux.player.lives > 0) window.flux.player.setResultState('DEFEAT');
                    winner.setResultState('VICTORY');
                    
                    window.flux.audio.playLose();

                    setTimeout(() => {
                        window.flux.ui.postGameMenu.style.display = 'flex';
                    }, 2000);
                }

            } else if (alive.length === 0) {
                ui.showMessage("DRAW!", 3000);
                setTimeout(() => {
                    window.flux.ui.postGameMenu.style.display = 'flex';
                }, 3000);
            }
        }

// --- Shared Constants ---
        const SLOT_COLORS = [0x0088FF, 0xFF3333, 0x00CC00, 0xFFAA00]; // Blue, Red, Green, Orange
        const SLOT_LABELS = ["P1", "P2", "P3", "P4"];

        // --- Rebuild Controllers (Global) ---
        window.flux.rebuildControllers = function() {
            const players = window.flux._players;
            if (!players || players.length === 0) return; // Safety check

            const net = window.flux.net;
            const localSlot = (net && typeof net.slot === 'number') ? net.slot : 0;

            window.flux.localSlot = localSlot;
            window.flux.player = players[localSlot];


            // Apply lobby slot config: closed empty slots spawn no CPU and can't be joined
            if (net && net.slotOpen) {
                for (let i = 0; i < 4; i++) {
                    if (!players[i]) continue;
                    const isRemote = !!(net.playersPresent && net.playersPresent[i]);
                    const isOpen = !!net.slotOpen[i];
                    if (!isRemote && !isOpen && i !== localSlot) {
                        players[i].lives = 0;
                        players[i].isDisabled = true;
                        if (players[i].mesh) players[i].mesh.visible = false;
                    } else {
                        // Re-enable if previously disabled (only if not dead in-match)
                        if (players[i].isDisabled) {
                            players[i].isDisabled = false;
                            if (players[i].mesh) players[i].mesh.visible = true;
                            if (players[i].lives <= 0 && i !== localSlot && (net && !net.playersPresent[i])) {
                                players[i].lives = window.flux.config.GAME.STARTING_LIVES;
                            }
                        }
                    }
                }
            }

            // Update labels from presence list (nice UI)
            for (let i = 0; i < 4; i++) {
                const nameFromNet = (net && net.names && net.names[i]) ? net.names[i] : "";
                if (players[i]) {
                    players[i].label = nameFromNet || SLOT_LABELS[i];
                }
            }

            
const controllers = [];

// --- LOCKSTEP: only simulate participating HUMAN slots (1v1 by default) ---
if (net && net.lockstepEnabled && window.flux.LockstepController) {
    const realSlots = (net.lsRealSlots && net.lsRealSlots.length) ? net.lsRealSlots.slice() : [0, 1];
    const lsMap = (net.lsMap && typeof net.lsMap === 'object') ? net.lsMap : {};

    // Local controller uses lockstep index (0..playerCount-1)
    window.flux.localController = new window.flux.LockstepController(players[localSlot], localSlot);
    window.flux.localController.slot = (typeof net.lsIndex === 'number')
        ? net.lsIndex
        : ((lsMap[localSlot] !== undefined) ? lsMap[localSlot] : 0);

    window.flux.localLSI = window.flux.localController.slot;

    // Remote human controllers: ONLY for participating slots
    for (let i = 0; i < realSlots.length; i++) {
        const rs = realSlots[i];
        if (rs === localSlot) continue;
        if (!players[rs]) continue;

        const c = new window.flux.LockstepController(players[rs], rs);
        c.slot = (lsMap[rs] !== undefined) ? lsMap[rs] : i;
        controllers.push(c);
    }

    // Hide / disable non-participating slots so we don't run AI (AI would break determinism)
    for (let s = 0; s < 4; s++) {
        if (!players[s]) continue;
        if (realSlots.indexOf(s) !== -1) {
            if (players[s].mesh) players[s].mesh.visible = true;
            continue;
        }
        players[s].lives = 0;
        players[s].state = 'DEAD';
        if (players[s].mesh) players[s].mesh.visible = false;
    }

} else {
    // Non-lockstep mode: original behavior (remote via NetController, otherwise CPU AI)
    window.flux.localController = null;
    window.flux.localLSI = null;

    for (let slot = 0; slot < 4; slot++) {
        if (slot === localSlot) continue;

        const isRemote = !!(net && net.playersPresent && net.playersPresent[slot]);
        if (isRemote && window.flux.NetController && !(net && net.lockstepEnabled)) {
            controllers.push(new window.flux.NetController(players[slot], net, slot));
        } else {
            // CPU fallback
            controllers.push(new window.flux.AIController(players[slot], window.flux.player));
        }
    }
}

window.flux.cpus = controllers;

            // Refresh UI
            updateStockUI();
        };

        // --- Start Match Function (Soft Reset) ---
        window.flux.startMatch = function(opts) {
            console.log("FluxCode: Starting Match...");
            
            // Hide Menu, Show HUD
            ui.hideMainMenu();
            // 1. Reset Renderer Scene (Clears old meshes, keeps lights/env)
            renderer.resetScene();
            
            // 2. Re-bind Persistent Objects to Scene
            particles.reset();
            particles.addToScene(renderer.scene);
            
            // Reset Powerups
            if (window.flux.powerups) {
                // Clear existing
                window.flux.powerups.powerups.forEach(p => p.destroy());
                window.flux.powerups.powerups = [];
            }
            
            // 3. Reset UI
            ui.reset();

            // --- LOCKSTEP DETERMINISM ---
            opts = opts || {};
            const net = window.flux.net;
            const useLockstep = !!(net && (opts.lockstep || net.lockstepEnabled));
            // Seed must match across peers for perfect determinism
            const seed = (typeof opts.seed === 'number')
                ? (opts.seed >>> 0)
                : ((net && typeof net.lockstepSeed === 'number') ? (net.lockstepSeed >>> 0) : 123456789);
if (window.flux.setSeed) window.flux.setSeed(seed);
            if (window.flux.useGameRng) window.flux.useGameRng();
            // Build controllers (will select LockstepController when net.lockstepEnabled)
            window.flux.rebuildControllers();
            // Create lockstep driver for multiplayer
            if (useLockstep && window.flux.Lockstep) {
                const realSlots = Array.isArray(opts.realSlots) ? opts.realSlots : (net && net.lsRealSlots ? net.lsRealSlots : [0,1]);
                const lsMap = (opts.lsMap && typeof opts.lsMap === 'object') ? opts.lsMap : (net && net.lsMap ? net.lsMap : {});
                const playerCount = (typeof opts.playerCount === 'number') ? (opts.playerCount|0) : (realSlots.length|0);
                // Reset lockstep to frame 0 every match start
                window.flux.lockstep = new window.flux.Lockstep({
                    slot: (net && typeof net.lsIndex === 'number') ? net.lsIndex : 0,
                    playerCount: playerCount,
                    inputDelay: 2,
                    send: (msg) => { if (window.flux.net) window.flux.net.sendLockstepInput(msg); },
                    onFrame: (frame, bitsBySlot, dtFixed) => {
                        // Apply frame inputs to controllers
                        if (window.flux.localController && typeof window.flux.localController.setBits === 'function') {
                            const __localLSI = (typeof window.flux.localLSI === 'number') ? window.flux.localLSI : ((net && typeof net.lsIndex === 'number') ? net.lsIndex : 0);
                            window.flux.localController.setBits(bitsBySlot[__localLSI]>>>0);
                        }
                        if (window.flux.cpus) {
                            for (let i = 0; i < window.flux.cpus.length; i++) {
                                const c = window.flux.cpus[i];
                                if (c && typeof c.setBits === 'function' && typeof c.slot === 'number') {
                                    c.setBits(bitsBySlot[c.slot]>>>0);
                                }
                            }
                        }
                        // Run one deterministic sim step
                        if (window.flux._gameTick) window.flux._gameTick(dtFixed);
                    }
                });

                window.flux.lockstepRealSlots = realSlots;
                window.flux.lockstepLsMap = lsMap;
                window.flux.localLSI = (net && typeof net.lsIndex === 'number') ? net.lsIndex : window.flux.localLSI;

                // Receive remote lockstep inputs
                if (window.flux.net) {
                    window.flux.net.onLockstepInput = (msg) => {
                        if (window.flux.lockstep) window.flux.lockstep.onNet(msg);
                    };
                    // Host also needs to broadcast its seed to clients in net.startGame (done in net.js)
                    if (window.flux.net.isHost) window.flux.net.lockstepSeed = seed;
                    else window.flux.net.lockstepSeed = seed;
                }

                // Force slots 2/3 disabled by default for true 1v1 determinism unless explicitly opened
                if (net && net.slotOpen) {
                    net.setSlotOpen(2, false);
                    net.setSlotOpen(3, false);
                }
            } else {
                window.flux.lockstep = null;
            }

            
            // 4. Initialize Game State
            window.flux.gameState = {
                gameOver: false, // New flag for victory loop
                hitstop: 0,
                timeScale: 1.0,
                roundTime: window.flux.config.GAME.ROUND_TIME,
                elapsedTime: 0,
                timeSinceLastFall: 0,
                nextShrinkTime: window.flux.config.GAME.SHRINK_START_TIME,
                onPlayerFall: function(playerEntity, attacker) {
                    if (attacker && attacker !== playerEntity) {
                        attacker.kills++;
                        window.flux.ui.showMessage(`${getColoredName(attacker)} KO'd ${getColoredName(playerEntity)}!`, 1500);
                    } else {
                        window.flux.ui.showMessage(`${getColoredName(playerEntity)} FELL!`, 1500);
                    }

                    updateStockUI();
                    
                    if (playerEntity.lives <= 0) {
                        checkWinCondition();
                    }
                }
            };

            // 5. Initialize Arena
            const arena = new window.flux.Arena(renderer.scene);
            window.flux.arena = arena;
            
            // 6. Initialize Shockwaves
            const shockwaveManager = new window.flux.ShockwaveManager(renderer.scene, arena);
            window.flux.currentShockwaveManager = shockwaveManager;
            
            // 6.5 Initialize Powerups
            const powerupManager = new window.flux.PowerupManager(renderer.scene, arena);
            window.flux.powerups = powerupManager;
            // 7. Initialize Players (4 Slots)
            const slotStartPos = [
                {x: 1.5, z: 1.5},
                {x: 6.5, z: 6.5},
                {x: 1.5, z: 6.5},
                {x: 6.5, z: 1.5}
            ];

            const players = [];
            for (let i = 0; i < 4; i++) {
                const p = new window.flux.Player(renderer.scene, arena, shockwaveManager, SLOT_COLORS[i], SLOT_LABELS[i]);
                p.position.set(slotStartPos[i].x, 0.5, slotStartPos[i].z);
                p.mesh.position.copy(p.position);
                players.push(p);
            }
            window.flux._players = players;

            // Default local player is slot 0 (P1) until net assigns a slot.
            window.flux.localSlot = 0;
            window.flux.player = players[0];

            // Build controllers for non-local slots (AI or NetController)
            window.flux.rebuildControllers();

            // If multiplayer is enabled, connect (only once) and bind callbacks (each match)
// If multiplayer is enabled, ensure controllers are built
            if (window.flux.net) {
                // Ensure controllers are built immediately for the new match
                window.flux.rebuildControllers();
                
                // If we are just starting, show message
                const pLabel = players[window.flux.localSlot].label;
                ui.showMessage(`ONLINE: ${pLabel}`, 1200);
            } else {
                // Single-player: just build AI controllers
                window.flux.rebuildControllers();
            }
// (Fixed Syntax Error: Duplicate else block removed)

            // 8. Initial UI Update
            updateStockUI();
            
            window.flux.ui.showMessage("READY?", 1000);
        };

        // --- Pause Menu Actions ---
        window.flux.requestRestartMatch = function() {
            const net = window.flux.net;
            if (net) {
                if (net.isHost) {
                    net.restartGame();
                    window.flux.startMatch();
                } else {
                    net.requestRestart();
                    if (window.flux.ui) window.flux.ui.showMessage("REQUESTED RESTART", 1200);
                }
            } else {
                window.flux.startMatch();
            }
        };

        window.flux.exitMatchToMenu = function() {
            // Disconnect networking (if any)
            try {
                if (window.flux.net) window.flux.net.destroy();
            } catch (e) {}
            window.flux.net = null;

            // Return to menu mode
            window.flux.gameState = null;
            if (window.flux.ui) window.flux.ui.showMainMenu();
        };


        // --- Game Loop ---
let lastTime = 0;
        let _fpsTimer = 0;
        let _frameCount = 0;

        let _snapTimer = 0;
        

        // --- Deterministic simulation tick (used by lockstep + singleplayer) ---
        window.flux._gameTick = function(delta) {
            if (window.flux.useGameRng) window.flux.useGameRng();
            // --- GAMEPLAY LOGIC ---
            
            let dt = Math.min(delta, 0.1);
            dt *= window.flux.gameState.timeScale;

            if (window.flux.gameState.hitstop > 0) {
                window.flux.gameState.hitstop -= delta;
                dt = 0; 
            }

            if (!window.flux.lockstep) input.update();

            // Updates
// Updates
const gs = window.flux.gameState;
            

            // If Game Over, skip logic but keep rendering/animating

            // If Game Over, skip logic but keep rendering/animating
            if (gs.gameOver) {
                if (window.flux.player) window.flux.player.update(dt, window.flux.localController || input);
                if (window.flux.cpus) window.flux.cpus.forEach(cpu => cpu.player.update(dt, {state:{}})); // Idle inputs
                return;
            }

            gs.roundTime -= dt;
            gs.timeSinceLastFall += dt;
            gs.elapsedTime += dt;

            // Shrink Logic (Host-authoritative in multiplayer)
            const __isHostAuth = (window.flux.lockstep || !window.flux.net || window.flux.net.slot === 0);
            // Shrink Logic
            if (gs.elapsedTime >= gs.nextShrinkTime && window.flux.arena.shrinkLevel < window.flux.config.GAME.MAX_SHRINKS) {
                if (__isHostAuth && !window.flux.arena.isShrinking) {
                    window.flux.arena.triggerShrink();
                    gs.nextShrinkTime = gs.elapsedTime + window.flux.config.GAME.SHRINK_INTERVAL + 2.0;
                }
            }

ui.updateTimer(gs.roundTime);
            
            // Throttle FPS update (every 0.5s)
            _frameCount++;
            _fpsTimer += dt;
            if (_fpsTimer >= 0.5) {
                ui.updateDebug(`FPS: ${Math.round(_frameCount / _fpsTimer)}`);
                _frameCount = 0;
                _fpsTimer = 0;
            }

            if (window.flux.arena) window.flux.arena.update(dt);
            if (window.flux.currentShockwaveManager) window.flux.currentShockwaveManager.update(dt);
// (Duplicate shockwaveManager update removed)
            if (window.flux.powerups) window.flux.powerups.update(dt, (window.flux.lockstep || !window.flux.net || window.flux.net.slot === 0));
            if (window.flux.particles) window.flux.particles.update(dt);
            

            if (window.flux.player) window.flux.player.update(dt, window.flux.localController || input);
            if (window.flux.cpus) window.flux.cpus.forEach(cpu => cpu.update(dt));

            // Collision Checks
// (Duplicate Collision Checks comment removed)
            if (window.flux.player && window.flux.cpus) {
                _mPopulatePlayers();
                
                for (let i = 0; i < _mAllPlayers.length; i++) {
                    const p1 = _mAllPlayers[i];
                    if (p1.state === 'DASH') {
                        for (let j = 0; j < _mAllPlayers.length; j++) {
                            const p2 = _mAllPlayers[j];
                            if (p1 !== p2) {
                                if (window.flux.lockstep || !window.flux.net || window.flux.net.slot === 0) {
                                    p1.checkDashHit(p2);
                                }
                            }
                        }
                    }
                }
            }





        
            if (window.flux.useFxRng) window.flux.useFxRng();
};

function animate(time) {
            requestAnimationFrame(animate);

            const delta = (time - lastTime) / 1000;
            lastTime = time;

            // If no GameState (Menu Mode), perform attract mode animation
            if (!window.flux.gameState) {
                // Orbit Camera
                const r = 14;
                const speed = 0.15;
                const t = time * 0.001;
                renderer.camera.position.x = Math.sin(t * speed) * r + 3.5;
                renderer.camera.position.z = Math.cos(t * speed) * r + 3.5;
                renderer.camera.position.y = 9;
                renderer.camera.lookAt(3.5, 0, 3.5);

                // Update UI + Arena visuals
                if (window.flux.ui) window.flux.ui.update(delta);
                if (window.flux.arena) window.flux.arena.update(delta);

                renderer.render();
                return;
            }

            // HUD/UI should animate even if lockstep is waiting
            if (window.flux.ui) window.flux.ui.update(delta);

            // LOCKSTEP: capture local input, send, and simulate only when inputs for all players are ready
            if (window.flux.lockstep) {
                input.update();
                window.flux.lockstep.submitLocalFromInput(input);
                window.flux.lockstep.tick();
                renderer.render();
                return;
            }

            // Singleplayer / non-lockstep fallback
            if (window.flux._gameTick) window.flux._gameTick(delta);

            renderer.render();
        }
        // renderer.render() is now called at top of loop

        // --- ENTRY POINT ---
        // Instead of starting match immediately, go to Menu Mode
        
        window.flux.startMenuMode = function() {
            console.log("FluxCode: Entering Menu Mode...");
            renderer.resetScene();
            
            // Create Arena for visuals
            const arena = new window.flux.Arena(renderer.scene);
            window.flux.arena = arena;
            
            // Show Menu UI
            ui.showMainMenu();
        };

        window.flux.startMenuMode();
        
        // Start Loop
        requestAnimationFrame(animate);
        
        console.log("FluxCode: System Online.");
}
}
)();