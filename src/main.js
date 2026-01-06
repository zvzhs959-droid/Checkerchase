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
            
            net.onStartMatch = () => {
                console.log("FluxCode: Match Starting!");
                ui.hideLobby();
                window.flux.startMatch();
            };


            net.onRestartMatch = () => {
                console.log("FluxCode: Match Restarting!");
                ui.hideLobby();
                window.flux.startMatch();
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
            const snap = { t: performance.now(), p: [] };

            for (let i = 0; i < players.length; i++) {
                const pl = players[i];
                if (!pl) continue;
                snap.p[i] = {
                    x: pl.position.x, y: pl.position.y, z: pl.position.z,
                    vx: pl.velocity.x, vy: pl.velocity.y, vz: pl.velocity.z,
                    state: pl.state,
                    stateTimer: pl.stateTimer,
                    invulnTimer: pl.invulnTimer,
                    lives: pl.lives,
                    dashes: pl.dashes,
                    kills: pl.kills
                };
            }
            return snap;
        }

function applySnapshot(snap) {
            if (!snap || !snap.p) return;

            const players = window.flux._players || [];
            const localSlot = window.flux.localSlot || 0;

            for (let i = 0; i < players.length; i++) {
                if (i === localSlot) continue; // never override local prediction

                const s = snap.p[i];
                const pl = players[i];
                if (!s || !pl) continue;

                // Check if this player is controlled by a NetController
                // We look in the cpus array (which contains all non-local controllers)
                const controller = window.flux.cpus ? window.flux.cpus.find(c => c.player === pl) : null;

                if (controller && typeof controller.onSnapshot === 'function') {
                    // Delegate to controller for smoothing
                    controller.onSnapshot(s);
                } else {
                    // Fallback: Hard Snap (e.g. for simple dummies or debug)
                    pl.position.set(s.x, s.y, s.z);
                    pl.velocity.set(s.vx, s.vy, s.vz);
                    pl.state = s.state;
                    pl.stateTimer = s.stateTimer;
                    pl.invulnTimer = s.invulnTimer;
                    pl.lives = s.lives;
                    pl.dashes = s.dashes;
                    pl.kills = s.kills;
                    pl.mesh.position.copy(pl.position);
                }
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
            for (let slot = 0; slot < 4; slot++) {
                if (slot === localSlot) continue;

                const isRemote = !!(net && net.playersPresent && net.playersPresent[slot]);
                if (isRemote && window.flux.NetController) {
                    controllers.push(new window.flux.NetController(players[slot], net, slot));
                } else {
                    // CPU fallback
                    controllers.push(new window.flux.AIController(players[slot], window.flux.player));
                }
            }
            window.flux.cpus = controllers;

            // Refresh UI
            updateStockUI();
        };

        // --- Start Match Function (Soft Reset) ---
        window.flux.startMatch = function() {
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
        
function animate(time) {
            requestAnimationFrame(animate);

            const delta = (time - lastTime) / 1000;
            lastTime = time;

            // Always render the scene (Background, Arena, etc.)
            renderer.render();

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
                
                // Update UI (Preview meshes)
                if (window.flux.ui) window.flux.ui.update(delta);
                
                // Update Arena (for tile animations if any)
                if (window.flux.arena) window.flux.arena.update(delta);
                
                return;
            }

            // --- GAMEPLAY LOGIC ---
            
            let dt = Math.min(delta, 0.1);
            dt *= window.flux.gameState.timeScale;

            if (window.flux.gameState.hitstop > 0) {
                window.flux.gameState.hitstop -= delta;
                dt = 0; 
            }

            input.update();

            // Updates
// Updates
const gs = window.flux.gameState;
            
            // UI Update (for 3D Preview) - Use unscaled delta so UI animates while game is paused
            if (window.flux.ui) window.flux.ui.update(delta);

            // If Game Over, skip logic but keep rendering/animating

            // If Game Over, skip logic but keep rendering/animating
            if (gs.gameOver) {
                if (window.flux.player) window.flux.player.update(dt, input);
                if (window.flux.cpus) window.flux.cpus.forEach(cpu => cpu.player.update(dt, {state:{}})); // Idle inputs
                renderer.render();
                return;
            }

            gs.roundTime -= dt;
            gs.timeSinceLastFall += dt;
            gs.elapsedTime += dt;

            // Shrink Logic
            if (gs.elapsedTime >= gs.nextShrinkTime && window.flux.arena.shrinkLevel < window.flux.config.GAME.MAX_SHRINKS) {
                if (!window.flux.arena.isShrinking) {
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
            if (window.flux.powerups) window.flux.powerups.update(dt);
            if (window.flux.particles) window.flux.particles.update(dt);
            
            if (window.flux.net) window.flux.net.tick(time, input.state);

            if (window.flux.player) window.flux.player.update(dt, input);
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
                                p1.checkDashHit(p2);
                            }
                        }
                    }
                }
            }



// Host snapshots (Frequency defined in config)
            if (window.flux.net && window.flux.net.slot === 0) {
                _snapTimer += dt;
                const snapInterval = (window.flux.config.NET.SNAPSHOT_INTERVAL || 200) / 1000;
                if (_snapTimer >= snapInterval) {
                    _snapTimer = 0;
                    window.flux.net.sendSnapshot(captureSnapshot());
                }
            }
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