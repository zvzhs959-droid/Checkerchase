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
            this.requestedHostId = opts.requestedHostId || null; // For fixed room IDs
            this.name = opts.name || ("P" + Math.floor(Math.random() * 999));
            
            this.slot = null; // Assigned by Host (0 if Host)
            this._connected = false;
            
            // Host State
            this.peers = {}; // connId -> { conn, slot }
            
            // Client State
            this.hostConn = null;

            // Shared State
            this.playersPresent = [false, false, false, false];
            this.names = ["", "", "", ""];
            this.inputs = [
                { x: 0, y: 0, attack: false, dash: false, hop: false },
                { x: 0, y: 0, attack: false, dash: false, hop: false },
                { x: 0, y: 0, attack: false, dash: false, hop: false },
                { x: 0, y: 0, attack: false, dash: false, hop: false }
            ];

            // Timers
            this._lastInputSend = 0;
            this._lastSnapshotSend = 0;

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
                    if (!this.playersPresent[i]) {
                        assignedSlot = i;
                        break;
                    }
                }

                if (assignedSlot === -1) {
                    console.warn("FluxNet: Room full, rejecting.");
                    conn.send({ type: 'ERROR', msg: 'Room Full' });
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
                    names: this.names
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
                this.inputs[slot] = data.state;
            } else if (data.type === 'HELLO') {
                // Client sending name
                this.names[slot] = data.name || `P${slot+1}`;
                this.broadcastPresence();
            }
        }

        broadcastPresence() {
            const msg = {
                type: 'PRESENCE',
                players: this.playersPresent,
                names: this.names
            };
            
            // Update local (Host) UI
            if (this.onPresence) this.onPresence();

            // Send to all clients
            for (const id in this.peers) {
                const p = this.peers[id];
                if (p.conn && p.conn.open) {
                    p.conn.send(msg);
                }
            }
        }

        // --- CLIENT LOGIC ---

        connectToHost(hostId) {
            console.log(`FluxNet: Connecting to Host ${hostId}...`);
            this.hostConn = this.peer.connect(hostId, { reliable: true });

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
            if (data.type === 'WELCOME') {
                this.slot = data.slot;
                this.playersPresent = data.players;
                this.names = data.names;
                
                console.log(`FluxNet: Joined as Slot ${this.slot}`);
                
                // Send Name back
                this.hostConn.send({ type: 'HELLO', name: this.name });
                
                if (this.onReady) this.onReady();
                if (this.onPresence) this.onPresence();

            } else if (data.type === 'PRESENCE') {
                this.playersPresent = data.players;
                this.names = data.names;
                if (this.onPresence) this.onPresence();

            } else if (data.type === 'SNAPSHOT') {
                if (this.onSnapshot) this.onSnapshot(data.snap);
            
            } else if (data.type === 'START_MATCH') {
                console.log("FluxNet: Host started match!");
                if (this.onStartMatch) this.onStartMatch();
            }
        }

        // --- TICK LOOP ---

        tick(time, inputState) {
            if (!this._connected) return;

            const now = performance.now();

            if (this.isHost) {
                // Host logic handled in main.js via sendSnapshot
            } else {
                // CLIENT: Send Input
                if (now - this._lastInputSend > config.NET.INPUT_INTERVAL) {
                    this._lastInputSend = now;
                    if (this.hostConn && this.hostConn.open) {
                        this.hostConn.send({
                            type: 'INPUT',
                            state: inputState
                        });
                    }
                }
            }
        }

sendSnapshot(snap) {
            if (!this.isHost) return;
            this.broadcast({ type: 'SNAPSHOT', snap: snap });
        }

        startGame() {
            if (!this.isHost) return;
            console.log("FluxNet: Broadcasting Start Match...");
            this.broadcast({ type: 'START_MATCH' });
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