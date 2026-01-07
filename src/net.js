/**
 * STONEWAVE DUEL - PEERJS NETWORKING (WebRTC)
 * High-performance P2P networking.
 * 
 * ARCHITECTURE:
 * - HOST (Slot 0): Authoritative. Simulates world, accepts inputs, broadcasts snapshots.
 * - CLIENT (Slot 1-3): Sends inputs, receives snapshots/presence.
 */
(function () {
    window.flux = window.flux || {};
    const config = window.flux.config;

class NetClient {
        constructor(opts) {
            this.isHost = false;
            this.myId = null;
            this.hostId = opts.room || null; // If present, we are Client
            this.lockstepEnabled = true;
            this.lockstepSeed = 0;
            this.onLockstepInput = null;
            this.requestedHostId = opts.requestedHostId || null; // For fixed room IDs
            this.name = opts.name || ("P" + Math.floor(window.flux.rand() * 999));
            
            this.slot = null; // Assigned by Host (0 if Host)
            this._connected = false;
            
            // Host State
            this.peers = {}; // connId -> { conn, slot }
            
            // Client State
            this.hostConn = null;

            // Shared State
            this.playersPresent = [false, false, false, false];
            this.names = ["", "", "", ""];
            this.slotOpen = [true, true, true, true]; // Host can close slots; clients receive via presence
            this._inputSeq = 0; // client->host input sequence

            this.inputs = [
                { x: 0, y: 0, attack: false, dash: false, hop: false },
                { x: 0, y: 0, attack: false, dash: false, hop: false },
                { x: 0, y: 0, attack: false, dash: false, hop: false },
                { x: 0, y: 0, attack: false, dash: false, hop: false }
            ];

            // Timers
            this._lastInputSend = 0;
            this._lastSnapshotSend = 0;
            // Action latches (helps with UDP-style drops / unreliable datachannels)
            this._latchAttack = 0;
            this._latchDash = 0;
            this._latchHop = 0;
            this._latchHold = 0.14; // seconds to keep a button 'held' after a press
            this._lastTickNow = 0;

            this._lastInputSeq = [0,0,0,0];
            this._lastInputTime = [0,0,0,0];

            // Callbacks
            this.onReady = null;     // Connected and slotted (Go to Lobby)
            this.onPresence = null;  // Player list updated
            this.onSnapshot = null;  // World update received
            this.onHostId = null;    // (Host Only) ID assigned
            this.onStartMatch = null; // Match starting
}

        isConnected() {
            return this._connected;
        }

        connect() {
            console.log("FluxNet: Initializing PeerJS...");
            
            // Safety Timeout (10s)
            this._connTimeout = setTimeout(() => {
                if (!this._connected && !this.myId) {
                    console.error("FluxNet: Connection timed out.");
                    if (this.onError) this.onError("CONNECTION TIMEOUT");
                    this.destroy();
                }
            }, 10000);

            // Helper to initialize peer with retry logic
            const initPeer = (idToUse = null) => {
                // Clean up previous attempt if any
                if (this.peer) {
                    // Remove listeners to prevent duplicate firing during destroy
                    this.peer.removeAllListeners();
                    this.peer.destroy();
                    this.peer = null;
                }

                const peer = new Peer(idToUse, { 
                    // Increase debug while testing (0 = none, 1 = errors, 2 = warnings, 3 = all)
                    debug: 2,
                    // IMPORTANT: Your previous STUN-only config made many real-world networks
                    // (especially cellular / symmetric NAT) unable to connect. Include TURN.
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' },
                            // PeerJS Cloud TURN (helps when direct P2P is impossible)
                            { urls: 'turn:0.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' }
                        ],
                        sdpSemantics: 'unified-plan'
                    }
                });

                peer.on('open', (id) => {
                    clearTimeout(this._connTimeout);
                    this.myId = id;
                    console.log(`FluxNet: Peer Open. ID: ${id}`);

                    if (this.hostId) {
                        // --- CLIENT MODE ---
                        this.isHost = false;
                        this.connectToHost(this.hostId);
                    } else {
                        // --- HOST MODE ---
                        this.isHost = true;
                        this.slot = 0;
                        this.playersPresent[0] = true;
                        this.names[0] = this.name;
                        this._connected = true;
                        
                        console.log("FluxNet: Hosting Match.");
                        if (this.onHostId) this.onHostId(id);
                        if (this.onReady) this.onReady(); // Go to Lobby
                        if (this.onPresence) this.onPresence();
                    }
                });

                peer.on('connection', (conn) => {
                    if (this.isHost) {
                        this.handleIncomingConnection(conn);
                    } else {
                        conn.close();
                    }
                });

                peer.on('error', (err) => {
                    console.error("FluxNet: Peer Error", err);
                    
                    // Retry logic for unavailable ID (Fallback to random)
                    if (err.type === 'unavailable-id' && idToUse !== null) {
                        console.log("FluxNet: Requested ID taken. Falling back to random ID.");
                        // Do not clear timeout yet, we are retrying
                        // Small delay to ensure previous peer cleanup
                        setTimeout(() => initPeer(null), 100);
                        return;
                    }

                    // For other errors, fail
                    clearTimeout(this._connTimeout);
                    if (this.onError) this.onError(`NET ERROR: ${err.type}`);
                });
                
                this.peer = peer;
            };

            // Start with requested ID if Host, otherwise random (null)
            initPeer(this.hostId ? null : this.requestedHostId);
        }

        // --- HOST LOGIC ---

        handleIncomingConnection(conn) {
            console.log(`FluxNet: Incoming connection from ${conn.peer}`);

            conn.on('open', () => {
                // Find a slot
                let assignedSlot = -1;
                for (let i = 1; i < 4; i++) {
                    if (!this.playersPresent[i] && this.slotOpen[i]) {
                        assignedSlot = i;
                        break;
                    }
                }

                if (assignedSlot === -1) {
                    console.warn("FluxNet: Room full, rejecting.");
                    conn.send({ type: 'ERROR', msg: 'Room Full / Slots Closed' });
                    setTimeout(() => conn.close(), 500);
                    return;
                }

                // Register
                this.peers[conn.peer] = { conn, slot: assignedSlot };
                this.playersPresent[assignedSlot] = true;
                this.names[assignedSlot] = "Joining..."; // Will update on handshake

                // Send Welcome Packet
                conn.send({
                    type: 'WELCOME',
                    slot: assignedSlot,
                    players: this.playersPresent,
                    names: this.names,
                    slotOpen: this.slotOpen
                });

                // Listen for data
                conn.on('data', (data) => this.handleHostData(assignedSlot, data));
                
                conn.on('close', () => {
                    console.log(`FluxNet: Client ${assignedSlot} disconnected.`);
                    this.playersPresent[assignedSlot] = false;
                    this.names[assignedSlot] = "";
                    delete this.peers[conn.peer];
                    this.broadcastPresence();
                });
            });
        }

        
handleHostData(slot, data) {
    if (data.type === 'INPUT') {
        // Legacy snapshot-based input (kept for compatibility)
        this.inputs[slot] = data.state;
        if (typeof data.seq === 'number') this._lastInputSeq[slot] = data.seq;
        if (typeof data.t === 'number') this._lastInputTime[slot] = data.t;

    } else if (data.type === 'REQ_RESTART') {
        // A client asked to restart. For now, auto-accept.
        this.restartGame();

    } else if (data.type === 'LSI') {
        // Lockstep input from a client.
        // Rewrite sender slot into LOCKSTEP index (0..playerCount-1) so the sim never waits on a non-participating real slot.
        const idx = (this.lsMap && this.lsMap[slot] !== undefined) ? this.lsMap[slot] : slot;
        data.s = idx; // enforce lockstep index

        // Forward to all clients (including sender; harmless)
        this.broadcast(data);
        if (this.onLockstepInput) this.onLockstepInput(data);

    } else if (data.type === 'HELLO') {
        // Client sending name
        this.names[slot] = data.name || `P${slot+1}`;
        this.broadcastPresence();
    }
}

// --- CLIENT LOGIC ---

        connectToHost(hostId) {
            console.log(`FluxNet: Connecting to Host ${hostId}...`);
            this.hostConn = this.peer.connect(hostId, { reliable: false });

            this.hostConn.on('open', () => {
                console.log("FluxNet: Connected to Host.");
                this._connected = true;
            });

            this.hostConn.on('data', (data) => this.handleClientData(data));

            this.hostConn.on('close', () => {
                console.log("FluxNet: Disconnected from Host.");
                this._connected = false;
                if (window.flux.ui) window.flux.ui.showMessage("DISCONNECTED", 3000);
            });
            
            this.hostConn.on('error', (err) => {
                console.error("FluxNet: Connection Error", err);
            });
        }


handleClientData(data) {
    if (!data || !data.type) return;

    if (data.type === 'WELCOME') {
        this.slot = data.slot;
        // Default lockstep index equals real slot until host sends mapping.
        this.lsIndex = this.slot;

        this.playersPresent = data.players;
        this.names = data.names;
        if (data.slotOpen) this.slotOpen = data.slotOpen;

        console.log(`FluxNet: Joined as Slot ${this.slot}`);

        // Send Name back
        if (this.hostConn && this.hostConn.open) {
            this.hostConn.send({ type: 'HELLO', name: this.name });
        }

        if (this.onReady) this.onReady();

    } else if (data.type === 'PRESENCE') {
        this.playersPresent = data.players;
        this.names = data.names;
        if (data.slotOpen) this.slotOpen = data.slotOpen;
        if (this.onPresence) this.onPresence();

    } else if (data.type === 'SNAPSHOT') {
        if (this.onSnapshot) this.onSnapshot(data.snap);

    } else if (data.type === 'LSI') {
        if (this.onLockstepInput) this.onLockstepInput(data);

    } else if (data.type === 'START_MATCH') {
        console.log("FluxNet: Host started match!");
        if (data && data.lockstep) {
            this.lockstepEnabled = true;
            this.lockstepSeed = (data.seed >>> 0);
            this.lsRealSlots = Array.isArray(data.realSlots) ? data.realSlots.slice() : null;
            this.lsMap = (data.lsMap && typeof data.lsMap === 'object') ? data.lsMap : null;
            if (this.lsMap && typeof this.slot === 'number' && this.lsMap[this.slot] !== undefined) {
                this.lsIndex = this.lsMap[this.slot];
            }
        }
        if (this.onStartMatch) this.onStartMatch(data);

    } else if (data.type === 'RESTART_MATCH') {
        console.log("FluxNet: Host restarted match!");
        if (data && data.lockstep) {
            this.lockstepEnabled = true;
            this.lockstepSeed = (data.seed >>> 0);
            this.lsRealSlots = Array.isArray(data.realSlots) ? data.realSlots.slice() : this.lsRealSlots;
            this.lsMap = (data.lsMap && typeof data.lsMap === 'object') ? data.lsMap : this.lsMap;
            if (this.lsMap && typeof this.slot === 'number' && this.lsMap[this.slot] !== undefined) {
                this.lsIndex = this.lsMap[this.slot];
            }
        }
        if (this.onRestartMatch) this.onRestartMatch(data);

    } else if (data.type === 'ERROR') {
        if (this.onError) this.onError(data.msg || "NET ERROR");
    }
}

sendLockstepInput(msg) {
    if (!msg) return;

    // Ensure msg carries LOCKSTEP slot index, not real slot.
    if (this.isHost) {
        msg.s = 0;
        // Host broadcasts its own lockstep inputs to clients and also loops back locally
        this.broadcast(msg);
        if (this.onLockstepInput) this.onLockstepInput(msg);
    } else if (this.hostConn && this.hostConn.open) {
        // Client: stamp its lockstep index if known
        if (typeof this.lsIndex === 'number') msg.s = this.lsIndex;
        this.hostConn.send(msg);
    }
}


        requestRestart() {
            if (this.isHost) {
                this.restartGame();
                return;
            }
            if (this.hostConn && this.hostConn.open) {
                this.hostConn.send({ type: 'REQ_RESTART' });
            }
        }

        sendSnapshot(snap) {
            if (!this.isHost) return;
            this.broadcast({ type: 'SNAPSHOT', snap: snap });
        }

        
startGame() {
    if (!this.isHost) return;

    // Lockstep seed shared to all peers so simulation is identical.
    const seed = (Date.now() ^ ((window.flux.rand()*0x7fffffff)|0)) >>> 0;
    this.lockstepSeed = seed;

    // Choose participating human slots: host (0) + first connected client slot (could be 1/2/3 depending on open slots)
    const realSlots = [0];
    for (let i = 1; i < 4; i++) {
        if (this.playersPresent[i]) { realSlots.push(i); break; }
    }

    if (realSlots.length < 2) {
        console.warn("FluxNet: Cannot start lockstep match: no opponent connected.");
        if (this.onError) this.onError("Need 1 opponent to start online match.");
        return;
    }

    // Map real slot -> lockstep index (0..playerCount-1)
    const lsMap = {};
    for (let i = 0; i < realSlots.length; i++) lsMap[realSlots[i]] = i;

    this.lsRealSlots = realSlots.slice();
    this.lsMap = lsMap;
    this.lsIndex = 0; // host is always index 0

    const playerCount = realSlots.length;

    console.log("FluxNet: Broadcasting Start Match (LOCKSTEP)...");
    this.broadcast({ type: 'START_MATCH', lockstep: true, seed, playerCount, realSlots, lsMap });
}

        setSlotOpen(slot, open) {
            if (!this.isHost) return;
            if (slot === 0) return; // Host slot always occupied
            this.slotOpen[slot] = !!open;
            this.broadcastPresence();
        }

        toggleSlotOpen(slot) {
            if (!this.isHost) return;
            this.setSlotOpen(slot, !this.slotOpen[slot]);
        }

        
restartGame() {
    if (!this.isHost) return;
    const realSlots = (this.lsRealSlots && this.lsRealSlots.length) ? this.lsRealSlots.slice() : [0, 1];
    const lsMap = (this.lsMap) ? this.lsMap : (function(){
        const m = {};
        for (let i = 0; i < realSlots.length; i++) m[realSlots[i]] = i;
        return m;
    })();

    console.log("FluxNet: Broadcasting Restart Match (LOCKSTEP)...");
    this.broadcast({ type: 'RESTART_MATCH', lockstep: true, seed: this.lockstepSeed, playerCount: realSlots.length, realSlots, lsMap });
}

        broadcast(msg) {
            for (const id in this.peers) {
                const p = this.peers[id];
                if (p.conn && p.conn.open) {
                    p.conn.send(msg);
                }
            }
        }
destroy() {
            if (this._connTimeout) clearTimeout(this._connTimeout);
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            this._connected = false;
            // Clear callbacks
            this.onReady = null;
            this.onPresence = null;
            this.onSnapshot = null;
            this.onError = null;
        }
    }

    window.flux.NetClient = NetClient;
})();