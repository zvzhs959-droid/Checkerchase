// STONEWAVE DUEL - Multiplayer Relay Server
// Cloudflare Workers + Durable Objects
//
// Route:
//   GET /ws/<roomId>  -> WebSocket room
//
// Messages (JSON):
//   client -> server: { t:"join", name? }
//   client -> server: { t:"input", slot, seq, s:{x,y,attack,dash,hop} }
//   host   -> server: { t:"snapshot", snap:{...} }
//
// Server -> clients:
//   { t:"welcome", slot, players:[{slot,name}] }
//   { t:"presence", players:[{slot,name}] }
//   { t:"input", slot, s:{...} }        (relayed)
//   { t:"snapshot", snap:{...} }        (relayed)

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "stonewave-mp" });
    }

    // WebSocket room endpoint
    const m = url.pathname.match(/^\/ws\/([^\/]+)$/);
    if (m) {
      const roomId = decodeURIComponent(m[1]);

      // Durable Object ID per room
      const id = env.ROOM.idFromName(roomId);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    return json({ ok: false, error: "Not found" }, 404);
  },
};

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // in-memory room state
    this.sockets = new Set(); // WebSocket
    this.bySocket = new Map(); // ws -> {slot, name}
    this.names = ["", "", "", ""]; // slot -> name
  }

  async fetch(request) {
    // Only accept WebSocket upgrades here
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return json({ ok: false, error: "Expected WebSocket" }, 426);
    }

    // Enforce max 4 players
    const usedSlots = new Set();
    for (const v of this.bySocket.values()) usedSlots.add(v.slot);
    if (usedSlots.size >= 4) {
      return json({ ok: false, error: "Room full (4 players)" }, 429);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.sockets.add(server);

    // We'll assign slot after we receive join (so client can provide name)
    this.bySocket.set(server, { slot: null, name: "" });

    server.addEventListener("message", (evt) => this._onMessage(server, evt));
    server.addEventListener("close", () => this._onClose(server));
    server.addEventListener("error", () => this._onClose(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  _assignSlot() {
    const taken = new Set();
    for (const v of this.bySocket.values()) {
      if (typeof v.slot === "number") taken.add(v.slot);
    }
    for (let i = 0; i < 4; i++) {
      if (!taken.has(i)) return i;
    }
    return null;
  }

  _playersList() {
    const list = [];
    for (const v of this.bySocket.values()) {
      if (typeof v.slot === "number") {
        list.push({ slot: v.slot, name: v.name || ("P" + (v.slot + 1)) });
      }
    }
    list.sort((a, b) => a.slot - b.slot);
    return list;
  }

  _broadcast(obj, exceptSocket = null) {
    const payload = JSON.stringify(obj);
    for (const ws of this.sockets) {
      if (ws === exceptSocket) continue;
      try { ws.send(payload); } catch {}
    }
  }

  _onMessage(ws, evt) {
    let msg = null;
    try { msg = JSON.parse(evt.data); } catch { return; }

    // JOIN
    if (msg.t === "join") {
      const meta = this.bySocket.get(ws) || { slot: null, name: "" };

      if (meta.slot === null) {
        meta.slot = this._assignSlot();
        meta.name = (typeof msg.name === "string" && msg.name.trim())
          ? msg.name.trim().slice(0, 16)
          : ("P" + (meta.slot + 1));

        this.bySocket.set(ws, meta);
        this.names[meta.slot] = meta.name;

        // Welcome this socket
        try {
          ws.send(JSON.stringify({
            t: "welcome",
            slot: meta.slot,
            players: this._playersList()
          }));
        } catch {}

        // Broadcast presence to everyone
        this._broadcast({ t: "presence", players: this._playersList() });
      }

      return;
    }

    // INPUT RELAY
    if (msg.t === "input") {
      const meta = this.bySocket.get(ws);
      if (!meta || typeof meta.slot !== "number") return;

      // Only allow the sender to claim their own slot
      if (msg.slot !== meta.slot) return;

      // relay minimal payload
      this._broadcast({
        t: "input",
        slot: meta.slot,
        s: msg.s || {}
      }, ws);

      return;
    }

    // SNAPSHOT RELAY (host only)
    if (msg.t === "snapshot") {
      const meta = this.bySocket.get(ws);
      if (!meta || meta.slot !== 0) return;

      this._broadcast({
        t: "snapshot",
        snap: msg.snap || null
      }, ws);

      return;
    }

    // PING (ignored)
    if (msg.t === "ping") return;
  }

  _onClose(ws) {
    this.sockets.delete(ws);

    const meta = this.bySocket.get(ws);
    if (meta && typeof meta.slot === "number") {
      this.names[meta.slot] = "";
    }
    this.bySocket.delete(ws);

    // Broadcast updated presence
    this._broadcast({ t: "presence", players: this._playersList() });
  }
}
