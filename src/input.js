/**
 * STONEWAVE DUEL - INPUT SYSTEM
 * Handles Keyboard and Touch inputs.
 */
(function() {
    window.flux = window.flux || {};

    class Input {
        constructor() {
            this.state = {
                x: 0,
                y: 0,
                attack: false,
                dash: false,
                hop: false
            };
            
            // Previous frame state for edge detection
            this.lastState = { ...this.state };

            // Keyboard Map
            this.keys = {};
            
            // Touch Data
this.touch = {
                active: false, // Joystick active
                originX: 0,
                originY: 0,
                currX: 0,
                currY: 0,
                id: null,
                
                // Right side (Swipe/Tap)
                rightId: null,
                rightStartX: 0,
                rightStartY: 0,
                rightStartTime: 0
            };
            
            // One-shot inputs (consumed in update)
            this.oneShot = {
                attack: false,
                dash: false,
                hop: false,
                dir: null // {x, y}
            };

            this.bindEvents();
        }

bindEvents() {
            // Prevent browser zooming/scrolling globally
            window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
            window.addEventListener('contextmenu', (e) => e.preventDefault());

            // Keyboard
            window.addEventListener('keydown', (e) => {
                this.keys[e.code] = true;
            });
            window.addEventListener('keyup', (e) => {
                this.keys[e.code] = false;
            });

            // Touch (Virtual Joystick - Left Half)
            // We attach to window to catch drags outside canvas
            window.addEventListener('touchstart', (e) => this.onTouchStart(e), {passive: false});
            window.addEventListener('touchmove', (e) => this.onTouchMove(e), {passive: false});
            window.addEventListener('touchend', (e) => this.onTouchEnd(e), {passive: false});
        }

onTouchStart(e) {
            // UI Safety: Ignore touches on DOM elements (Shop, Buttons, etc)
            // Only process touches on the Game Canvas
            if (e.target.tagName !== 'CANVAS') return;

            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                const halfWidth = window.innerWidth / 2;

                if (t.clientX < halfWidth) {
                    // Left Side - Joystick
                    if (!this.touch.active) {
                        this.touch.active = true;
                        this.touch.id = t.identifier;
                        this.touch.originX = t.clientX;
                        this.touch.originY = t.clientY;
                        this.touch.currX = t.clientX;
                        this.touch.currY = t.clientY;
                    }
                } else {
                    // Right Side - Swipe/Tap Tracker
                    if (this.touch.rightId === null) {
                        this.touch.rightId = t.identifier;
                        this.touch.rightStartX = t.clientX;
                        this.touch.rightStartY = t.clientY;
                        this.touch.rightStartTime = performance.now();
                    }
                }
            }
        }

        onTouchMove(e) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === this.touch.id) {
                    this.touch.currX = t.clientX;
                    this.touch.currY = t.clientY;
                }
            }
        }

        onTouchEnd(e) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                
                // Joystick Release
                if (t.identifier === this.touch.id) {
                    this.touch.active = false;
                    this.touch.id = null;
                    this.touch.currX = this.touch.originX;
                    this.touch.currY = this.touch.originY;
                } 
                
                // Right Side Release (Swipe/Tap Logic)
                if (t.identifier === this.touch.rightId) {
                    const dt = performance.now() - this.touch.rightStartTime;
                    const dx = t.clientX - this.touch.rightStartX;
                    const dy = t.clientY - this.touch.rightStartY;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    this.touch.rightId = null;

                    // Swipe Detection (Thresholds: >30px dist, <500ms time)
                    if (dist > 30 && dt < 500) {
                        // Determine Cardinal Direction
                        let sx = 0, sy = 0;
                        if (Math.abs(dx) > Math.abs(dy)) {
                            sx = Math.sign(dx);
                        } else {
                            sy = Math.sign(dy);
                        }
                        
                        // Queue Swipe Action
                        this.oneShot.dir = { x: sx, y: sy };
this.oneShot.dash = true;
                    } 
                    // Tap Detection
                    else if (dt < 500) {
                        const height = window.innerHeight;
                        if (t.clientY > height * 0.5) {
                            this.oneShot.attack = true; // Bottom: Attack
                        } else {
                            this.oneShot.dash = true; // Top: Dash
                        }
                    }
                }
            }
        }

        update() {
            // Save last state
            this.lastState = { ...this.state };

            // 1. Directional Input
            let dx = 0;
            let dy = 0;

            // Keyboard
            if (this.keys['ArrowUp'] || this.keys['KeyW']) dy -= 1;
            if (this.keys['ArrowDown'] || this.keys['KeyS']) dy += 1;
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
            if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;

            // Touch Joystick
// Touch Joystick (Strict 4-Way D-Pad Logic)
            if (this.touch.active) {
                const threshold = 10; // pixels deadzone
                const diffX = this.touch.currX - this.touch.originX;
                const diffY = this.touch.currY - this.touch.originY;

                // Determine Dominant Axis
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    // Horizontal Dominant
                    if (Math.abs(diffX) > threshold) dx = Math.sign(diffX);
                } else {
                    // Vertical Dominant
                    if (Math.abs(diffY) > threshold) dy = Math.sign(diffY);
                }
            }

            this.state.x = dx;
            this.state.y = dy;

// 2. Actions
            this.state.attack = this.keys['Space'] || this.keys['KeyJ'] || this.oneShot.attack;
            this.state.dash = this.keys['ShiftLeft'] || this.keys['KeyK'] || this.oneShot.dash; 
            this.state.hop = this.keys['KeyL'] || this.keys['KeyI'] || this.oneShot.hop;

            // 3. Swipe Override (Direction)
            if (this.oneShot.dir) {
                this.state.x = this.oneShot.dir.x;
                this.state.y = this.oneShot.dir.y;
            }

            // Reset One-Shots
            this.oneShot.attack = false;
            this.oneShot.dash = false;
            this.oneShot.hop = false;
this.oneShot.dir = null;
        }

        isJustPressed(btn) {
            return this.state[btn] && !this.lastState[btn];
        }
    }

    window.flux.Input = Input;
})();