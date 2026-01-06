/**
 * STONEWAVE DUEL - NET CONTROLLER
 * Makes a remote player look like a local "Input" or "AIController" to Player.update(dt, input).
 * Handles Input Prediction + Server Reconciliation (Smoothing).
 */
(function () {
  window.flux = window.flux || {};

  class NetController {
    constructor(playerEntity, netClient, slot) {
      this.player = playerEntity;
      this.net = netClient;
      this.slot = slot;

      // Input State
      this.state = { x: 0, y: 0, attack: false, dash: false, hop: false };
      this.lastState = { x: 0, y: 0, attack: false, dash: false, hop: false };

      // Snapshot / Interpolation State
      this.targetPos = null;
      this.targetVel = null;
    }

    /**
     * Called when a snapshot arrives from the host.
     * We store this as the "Truth" to drift towards.
     */
    onSnapshot(snap) {
        if (!snap) return;

        // Store authoritative position/velocity
        this.targetPos = new THREE.Vector3(snap.x, snap.y, snap.z);
        this.targetVel = new THREE.Vector3(snap.vx, snap.vy, snap.vz);

        // Sync critical stats immediately (Authoritative)
        this.player.lives = snap.lives;
        this.player.kills = snap.kills;
        
        // Sync state if it's a major state change (e.g. Death/Stun)
        // We avoid overriding transient states like ATTACK to prevent animation jitter,
        // unless the deviation is significant or critical.
        if (snap.state === 'DEAD' || snap.state === 'STUNNED' || snap.state === 'FALL') {
            if (this.player.state !== snap.state) {
                this.player.state = snap.state;
                this.player.stateTimer = snap.stateTimer;
            }
        }
    }

    update(dt) {
      if (!this.net) return;

      // 1. Get Latest Input (Prediction)
      const incoming = this.net.inputs[this.slot] || this.state;

      // Preserve last for edge-detect
      this.lastState = { ...this.state };

      this.state = {
        x: incoming.x || 0,
        y: incoming.y || 0,
        attack: !!incoming.attack,
        dash: !!incoming.dash,
        hop: !!incoming.hop
      };

      // 2. Run Player Simulation (Predictive Physics)
      // This moves the player based on inputs immediately
      this.player.update(dt, this);

      // 3. Reconciliation (Smooth Correction)
      // If we have a snapshot, nudge the player towards it to fix drift
      if (this.targetPos) {
          const dist = this.player.position.distanceTo(this.targetPos);
          
          // Thresholds
          const SNAP_DIST = 2.0;   // Teleport if too far (lag spike / respawn)
          const DRIFT_DIST = 0.05; // Ignore micro-jitters
          
          if (dist > SNAP_DIST) {
              // Hard Snap
              this.player.position.copy(this.targetPos);
              if (this.targetVel) this.player.velocity.copy(this.targetVel);
          } else if (dist > DRIFT_DIST) {
              // Smooth Lerp (Exponential Moving Average)
              // Adjust factor based on framerate (approx 10% per frame at 60fps)
              const lerpFactor = Math.min(1.0, 6.0 * dt); 
              
              this.player.position.lerp(this.targetPos, lerpFactor);
              
              // Also blend velocity to keep momentum consistent
              if (this.targetVel) {
                  this.player.velocity.lerp(this.targetVel, lerpFactor);
              }
          }
      }
    }

    // Interface for Player class
    isJustPressed(btn) {
      return this.state[btn] && !this.lastState[btn];
    }
  }

  window.flux.NetController = NetController;
})();