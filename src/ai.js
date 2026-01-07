/**
 * STONEWAVE DUEL - AI CONTROLLER (OVERHAULED)
 * Advanced Utility-based AI with pathfinding awareness and aggression.
 */
(function() {
    window.flux = window.flux || {};

    // Reusable vectors for AI calculations
    const _aiVec = new THREE.Vector3();
    const _aiVec2 = new THREE.Vector3();
class AIController {
        constructor(playerEntity, target) {
            this.player = playerEntity;
            this.target = target; // Main opponent
            
            this.state = {
                x: 0, y: 0,
                attack: false,
                dash: false,
                hop: false
            };
            this.lastState = { ...this.state };
            
            // AI Parameters
            this.reactionTime = 0.1 + window.flux.rand() * 0.2; // Seconds to react
            this.reactionTimer = 0;
            
            this.moveTimer = 0;
            this.desiredPos = new THREE.Vector3();
            
            // Targeting
            this.retargetTimer = window.flux.rand() * 2.0; // Stagger initial scans

            // Personality
            this.personality = {
                aggression: 0.4 + window.flux.rand() * 0.6, // 0.4 - 1.0
                greed: 0.3 + window.flux.rand() * 0.7,      // Powerup hunger
                fear: window.flux.rand() * 0.5              // Tendency to flee
            };

            this.currentGoal = 'IDLE'; // IDLE, ATTACK, HUNT, FLEE, RECOVER
        }

update(dt) {
            if (!this.player || this.player.lives <= 0) return;
            
            // --- TARGETING UPDATE ---
            this.retargetTimer -= dt;

            // 1. Immediate Retaliation Check
            // If we were hit recently by someone who isn't our current target, switch to them.
            if (this.player.lastAttacker && 
                this.player.lastAttacker !== this.target && 
                this.player.lastAttacker.lives > 0) {
                
                // 70% chance to switch target to the aggressor
                if (window.flux.rand() < 0.7) {
                    this.target = this.player.lastAttacker;
                    this.retargetTimer = 3.0; // Focus on them for 3 seconds
                }
                // Clear it so we don't keep checking constantly
                this.player.lastAttacker = null; 
            }

            // 2. Periodic Scan / Dead Target Check
            if (!this.target || this.target.lives <= 0 || this.retargetTimer <= 0) {
                this.scanForTarget();
                // Reset timer (randomized 1.0 to 3.0 seconds)
                this.retargetTimer = 1.0 + window.flux.rand() * 2.0;
            }

            this.lastState = { ...this.state };
            this.reactionTimer -= dt;
            this.moveTimer -= dt;

            // Reset triggers
            this.state.attack = false;
            this.state.dash = false;
            this.state.hop = false;

            // 1. Emergency Reactions (Frame perfect safety checks)
            this.checkSafetyOverride();

            // 2. High Level Decision Making (Throttled by reaction time)
            if (this.reactionTimer <= 0) {
                this.reactionTimer = 0.25 + (window.flux.rand() * 0.2); // Slower reaction (Human-like)
                this.evaluateGoal();
                this.decideMove();
                this.decideCombat();
            }

            // 3. Execute Movement Input
            this.executeMovement();

            // Update Player Physics/Logic
            this.player.update(dt, this);
        }

        scanForTarget() {
            const players = window.flux._players || [];
            let bestTarget = null;
            let bestScore = -Infinity;
            
            for (const p of players) {
                if (p === this.player || p.lives <= 0) continue;
                
                let score = 0;
                const dist = this.player.position.distanceTo(p.position);
                
                // Prefer closer targets
                score -= dist;
                
                // Prefer targets with lower lives (Predatory)
                score -= p.lives * 2.0;
                
                // Slight persistence bias (if this was already our target, give bonus)
                if (p === this.target) score += 3.0;

                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = p;
                }
            }
            this.target = bestTarget;
        }

        evaluateGoal() {
            // Default
            this.currentGoal = 'ATTACK';

            // 1. Check Health/Safety
            const tile = this.getTileAt(this.player.position);
            if (this.isTileDangerous(tile)) {
                this.currentGoal = 'RECOVER'; // Get to safe ground ASAP
                return;
            }

            // 2. Check Powerups (Greed)
            if (this.personality.greed > 0.3) {
                const powerup = this.findNearestPowerup();
                if (powerup) {
                    this.currentGoal = 'HUNT';
                    this.targetPowerup = powerup;
                    return;
                }
            }

            // 3. Check Distance for Aggression vs Fear
            if (this.target) {
                const dist = this.player.position.distanceTo(this.target.position);
                if (dist < 2.0 && this.personality.fear > 0.6 && this.player.lives < 2) {
                    this.currentGoal = 'FLEE';
                }
            }
        }

        findNearestPowerup() {
            if (!window.flux.powerups || window.flux.powerups.powerups.length === 0) return null;
            let closest = null;
            let minDst = 999;
            for (const p of window.flux.powerups.powerups) {
                if (!p.active) continue;
                const d = this.player.position.distanceTo(p.mesh.position);
                if (d < minDst) {
                    minDst = d;
                    closest = p;
                }
            }
            return closest;
        }

        decideMove() {
            const currentPos = this.player.position;
            const moves = [
                { x: 0, z: 0 }, // Stay
                { x: 1, z: 0 }, { x: -1, z: 0 },
                { x: 0, z: 1 }, { x: 0, z: -1 }
            ];

            let bestMove = null;
            let bestScore = -Infinity;

            // Target Position based on Goal
            let targetPos = new THREE.Vector3(3.5, 0, 3.5); // Default center
            if (this.currentGoal === 'ATTACK' && this.target) targetPos = this.target.position;
            else if (this.currentGoal === 'HUNT' && this.targetPowerup) targetPos = this.targetPowerup.mesh.position;
            else if (this.currentGoal === 'FLEE' && this.target) {
                // Invert target vector relative to center
// Invert target vector relative to center
                const dir = _aiVec.copy(this.player.position).sub(this.target.position).normalize();
                targetPos = _aiVec2.copy(this.player.position).add(dir.multiplyScalar(4));
            }

            for (const m of moves) {
// Use _aiVec for calculation to avoid GC
                const checkPos = _aiVec.copy(currentPos);
                checkPos.x += m.x;
                checkPos.z += m.z;
                
                // Snap to grid center for evaluation
                checkPos.x = Math.round(checkPos.x);
                checkPos.z = Math.round(checkPos.z);

                const score = this.scorePosition(checkPos, targetPos);
                if (score > bestScore) {
                    bestScore = score;
                    // Store the best position in _aiVec2 so it persists across iterations
                    _aiVec2.copy(checkPos);
                    bestMove = _aiVec2; 
                }
            }

            if (bestMove) {
                this.desiredPos.copy(bestMove);
            }
        }

scorePosition(pos, targetPos) {
            const tile = this.getTileAt(pos);
            
            // 1. Safety (Critical)
            if (this.isTileDangerous(tile)) return -1000;

            let score = 0;

            // 2. Distance to Goal
            const dist = pos.distanceTo(targetPos);
            score -= dist * 1.5; // Reduced weight (was 2) to allow deviation

            // 3. Center Bias (Avoid edges)
            const distCenter = Math.sqrt((pos.x - 3.5)**2 + (pos.z - 3.5)**2);
            score -= distCenter * 0.5;

            // 4. Alignment Bonus (for attacks)
            if (this.currentGoal === 'ATTACK' && this.target) {
                const dx = Math.abs(pos.x - this.target.position.x);
                const dz = Math.abs(pos.z - this.target.position.z);
                if (dx < 0.5 || dz < 0.5) score += 3; // Reduced bonus
            }

            // 5. Crowding Penalty (New: Don't stack!)
            const players = window.flux._players || [];
            for (const p of players) {
                if (p === this.player) continue;
                if (p.lives <= 0) continue;

                const d = pos.distanceTo(p.position);
                // Avoid standing exactly where others are
                if (d < 1.1) {
                    score -= 8.0; // Heavy penalty for occupying same space
                }
            }

            // 6. Noise (Humanize/Imperfection)
            score += (window.flux.rand() - 0.5) * 2.5;

            return score;
        }

        decideCombat() {
            if (!this.target) return;

            const dist = this.player.position.distanceTo(this.target.position);
            const dx = Math.abs(this.player.position.x - this.target.position.x);
            const dz = Math.abs(this.player.position.z - this.target.position.z);
            const aligned = (dx < 0.5 || dz < 0.5);

            // Dash Attack
            if (this.currentGoal === 'ATTACK' || this.currentGoal === 'HUNT') {
                // If aligned and dash available
                if (aligned && this.player.dashes > 0) {
                    // Dash if close enough to hit, or far enough to close gap
                    // Don't dash if point blank (might overshoot?)
                    if (dist > 1.5 && dist < 6.0) {
                        if (window.flux.rand() < this.personality.aggression) {
                            // Face target
                            this.desiredPos.copy(this.target.position);
                            this.state.dash = true;
                            return;
                        }
                    }
                }
            }

            // Shockwave / Charge Attack
            if (this.currentGoal === 'ATTACK' && aligned && dist > 3.0) {
                if (window.flux.rand() < 0.05) { // Occasional
                    this.state.attack = true; // Tap for shockwave
                }
            }

            // Panic Attack (Close quarters)
            if (dist < 1.5 && window.flux.rand() < 0.1) {
                this.state.attack = true;
            }
        }

        checkSafetyOverride() {
            // Immediate check of current tile
            const currentTile = this.getTileAt(this.player.position);
            
            // Hop if about to fall
            if (currentTile && currentTile.state === window.flux.config.TILES.STATES.FALLING) {
                if (currentTile.timer > 0.5) { // Late stage falling
                    this.state.hop = true;
                    // Try to dash to safety if possible
                    if (this.player.dashes > 0) {
                        this.state.dash = true;
                    }
                }
            }
        }

        executeMovement() {
            const dx = this.desiredPos.x - this.player.position.x;
            const dz = this.desiredPos.z - this.player.position.z;
            
            this.state.x = 0;
            this.state.y = 0;
            
            // Deadzone
            if (Math.abs(dx) > 0.2) this.state.x = Math.sign(dx);
            if (Math.abs(dz) > 0.2) this.state.y = Math.sign(dz);
        }

        getTileAt(pos) {
            if (!window.flux.arena) return null;
            const x = Math.round(pos.x);
            const z = Math.round(pos.z);
            return window.flux.arena.getTile(x, z);
        }

        isTileDangerous(tile) {
            if (!tile) return true; // Void
            const S = window.flux.config.TILES.STATES;
            return tile.state === S.MISSING || 
                   tile.state === S.FALLING || 
                   tile.state === S.REFORMING ||
                   (tile.state === S.STONE && tile.isPermanent);
        }

        isJustPressed(btn) {
            return this.state[btn] && !this.lastState[btn];
        }
    }

    window.flux.AIController = AIController;
})();