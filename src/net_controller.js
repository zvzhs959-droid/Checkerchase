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

      // --- Visual driving for remote entities ---
      // We DO NOT run full gameplay/physics for remote players on clients.
      // Instead, we smoothly animate their rigs based on forwarded inputs + authoritative snapshots.
      const p = this.player;
      if (p) {
        // Update facing from input (helps shockwave direction + walk facing)
        const mx = this.state.x || 0;
        const my = this.state.y || 0;
        if (p.facing && (Math.abs(mx) > 0.05 || Math.abs(my) > 0.05)) {
          p.facing.set(mx, 0, my).normalize();
        }

        // If we're in a neutral locomotion state, choose IDLE vs WALK from input magnitude
        if (p.state === 'IDLE' || p.state === 'WALK') {
          const mag = Math.hypot(mx, my);
          p.state = (mag > 0.15) ? 'WALK' : 'IDLE';
        }

        // Advance animation timer locally for smooth playback between snapshots
        p.stateTimer = (p.stateTimer || 0) + dt;

        // Invuln flicker (visual only)
        if (p.mesh) {
          if (p.invulnTimer > 0) {
            p.mesh.visible = Math.floor(window.performance.now() / 50) % 2 === 0;
          } else {
            p.mesh.visible = true;
          }
          p.mesh.position.copy(p.position);
        }

        if (typeof p.updateVisuals === 'function') p.updateVisuals();
        if (typeof p.updateCosmetics === 'function') p.updateCosmetics(dt);
        if (typeof p.updatePowerupVisuals === 'function') p.updatePowerupVisuals(dt);
      }


      // 2. Run Player Simulation (Predictive Physics)
      // This moves the player based on inputs immediately
      this.player.update(dt, this);

      // 3. Reconciliation (Smooth Correction)
      // If we have a snapshot, nudge the player towards it to fix drift
      if (this.targetPos) {
          const dist = this.player.position.distanceTo(this.targetPos);
          
          // Thresholds
          const SNAP_DIST = 1.5;   // Teleport if too far (lag spike / respawn)
          const DRIFT_DIST = 0.02; // Ignore micro-jitters
          
          if (dist > SNAP_DIST) {
              // Hard Snap
              this.player.position.copy(this.targetPos);
              if (this.targetVel) this.player.velocity.copy(this.targetVel);
          } else if (dist > DRIFT_DIST) {
              // Smooth Lerp (Exponential Moving Average)
              // Adjust factor based on framerate (approx 10% per frame at 60fps)
              const lerpFactor = Math.min(1.0, 18.0 * dt); 
              
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

    /**
     * Override update to disable full simulation on remote clients.
     * This redefinition will shadow the previous update implementation.
     */
    update(dt) {
      if (!this.net) return;
      // 1. Get Latest Input (Prediction)
      const incoming = this.net.inputs[this.slot] || this.state;
      // Preserve last for edge-detect
      this.lastState = { ...this.state };
      // Sanitize incoming values; fallback to zero/false if undefined
      this.state = {
        x: (incoming && typeof incoming.x === 'number') ? incoming.x : 0,
        y: (incoming && typeof incoming.y === 'number') ? incoming.y : 0,
        attack: !!(incoming && incoming.attack),
        dash: !!(incoming && incoming.dash),
        hop: !!(incoming && incoming.hop)
      };
      const p = this.player;
      const isLocal = (this.net && typeof this.net.slot === 'number' && this.slot === this.net.slot);
      if (p) {
        if (!isLocal) {
          // --- Remote Visual Update ---
          // Advance timers for animation smoothness
          p.stateTimer = (p.stateTimer || 0) + dt;
          if (p.invulnTimer > 0) p.invulnTimer -= dt;
          // Powerup timer countdown (visual only)
          if (p.activePowerup) {
            p.activePowerup.timer -= dt;
            if (p.activePowerup.timer <= 0 && typeof p.removePowerup === 'function') {
              p.removePowerup();
            }
          }
          // Update mesh/shadow positions (position will be reconciled later)
          if (p.mesh) {
            p.mesh.position.copy(p.position);
            // Invuln flicker (visual only)
            if (p.invulnTimer > 0) {
              p.mesh.visible = (Math.floor(window.performance.now() / 50) % 2 === 0);
            } else {
              p.mesh.visible = true;
            }
          }
          if (p.shadow) {
            p.shadow.position.set(p.position.x, 0.02, p.position.z);
            const height = Math.max(0, p.position.y - 0.27);
            const sScale = Math.max(0, 1.0 - height * 0.8);
            p.shadow.scale.setScalar(sScale);
            p.shadow.visible = p.mesh && p.mesh.visible && p.state !== 'DEAD';
          }
          // Update visuals/cosmetics/powerup visuals
          if (typeof p.updateVisuals === 'function') p.updateVisuals();
          if (typeof p.updateCosmetics === 'function') p.updateCosmetics(dt);
          if (typeof p.updatePowerupVisuals === 'function') p.updatePowerupVisuals(dt);
        } else {
          // Local player: run full simulation
          this.player.update(dt, this);
        }
      }
      // 3. Reconciliation (Smooth Correction)
      if (this.targetPos) {
        const dist = this.player.position.distanceTo(this.targetPos);
        const SNAP_DIST = 1.5;
        const DRIFT_DIST = 0.02;
        if (dist > SNAP_DIST) {
          this.player.position.copy(this.targetPos);
          if (this.targetVel) this.player.velocity.copy(this.targetVel);
        } else if (dist > DRIFT_DIST) {
          const lerpFactor = Math.min(1.0, 18.0 * dt);
          this.player.position.lerp(this.targetPos, lerpFactor);
          if (this.targetVel) {
            this.player.velocity.lerp(this.targetVel, lerpFactor);
          }
        }
      }
    }
  }

  window.flux.NetController = NetController;
})();