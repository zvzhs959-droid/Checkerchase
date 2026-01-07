/**
 * STONEWAVE DUEL - AUDIO SYSTEM
 * Handles Background Music and interaction-based autoplay.
 */
(function() {
    window.flux = window.flux || {};
    
class AudioManager {
        constructor() {
            const config = window.flux.config;
            
            // Setup BGM
            this.bgm = new Audio(config.AUDIO.BGM_URL);
            this.bgm.loop = true;
            this.bgm.volume = config.AUDIO.VOLUME_BGM;
            
            // Setup SFX Library
            this.sfxLibrary = {};
            this.sfxVolume = config.AUDIO.VOLUME_SFX || 0.6;
            
            if (config.AUDIO.SFX) {
                for (const [key, url] of Object.entries(config.AUDIO.SFX)) {
                    const audio = new Audio(url);
                    audio.volume = this.sfxVolume;
                    this.sfxLibrary[key] = audio;
                }
            }

            this.isPlaying = false;
this.hasInteracted = false;
            this.lastPlayed = {}; // Throttle map
            
            // Browser Autoplay Policy Handling
            // We must wait for a user interaction before playing audio in most browsers
            this.bindInteractionEvents();
        }

        bindInteractionEvents() {
            const unlockAudio = () => {
                if (this.hasInteracted) return;
                this.hasInteracted = true;
                
                console.log("FluxCode: Interaction detected, starting Audio...");
                this.playBGM();
                
                // Cleanup listeners once triggered
                window.removeEventListener('click', unlockAudio);
                window.removeEventListener('keydown', unlockAudio);
                window.removeEventListener('touchstart', unlockAudio);
            };

            // Listen for any common interaction
            window.addEventListener('click', unlockAudio);
            window.addEventListener('keydown', unlockAudio);
            window.addEventListener('touchstart', unlockAudio);
        }

        playBGM() {
            // Attempt to play
            const promise = this.bgm.play();
            
            if (promise !== undefined) {
                promise.then(() => {
                    this.isPlaying = true;
                    console.log("FluxCode: BGM Playing");
                }).catch(error => {
                    console.warn("FluxCode: BGM Autoplay prevented. Waiting for interaction.");
                    this.isPlaying = false;
                });
            }
        }

        stopBGM() {
            this.bgm.pause();
            this.bgm.currentTime = 0;
            this.isPlaying = false;
        }

playSFX(key) {
            if (!this.hasInteracted) return; 
            
            // 1. Throttle (Prevent stacking/phasing)
            // Ensures we don't play the exact same sound multiple times in the same frame or very quickly
            const now = performance.now();
            const throttleTime = 60; // ms
            if (this.lastPlayed[key] && (now - this.lastPlayed[key] < throttleTime)) {
                return;
            }
            this.lastPlayed[key] = now;

// Voice Frequency Throttling (1 in 3 chance)
            // Removed VICTORY sounds so they always play on win
            const voiceKeys = ['GRUNT', 'VOICE_HURT']; 
            if (voiceKeys.includes(key) && window.flux.rand() > 0.33) return;

let sourceKey = key;
            if (key === 'UI_CLICK') sourceKey = 'STONE'; // Reuse Stone sound for UI

            const baseAudio = this.sfxLibrary[sourceKey];
            if (baseAudio) {
                const sound = baseAudio.cloneNode();
                
                // --- Variations & Pitch ---
                // Default: No variation (Consistent for Dash/UI as requested)
                let rate = 1.0;
                let pitchVar = 0.0; 
                let vol = this.sfxVolume;

                // Reduce volume for voice clips (50%)
                const allVoiceKeys = ['GRUNT', 'VOICE_HURT', 'VICTORY_1', 'VICTORY_2', 'FALL', 'VOICE_HI'];
                if (allVoiceKeys.includes(key)) {
                    vol *= 0.5;
                }

                if (key === 'SHOCKWAVE') {
                    rate = 0.9; 
                    pitchVar = 0.5; // 0.9 -> 1.4
                    vol *= 0.9 + window.flux.rand() * 0.2;
                } 
else if (key === 'FALL') {
                    // Random range 1.0 - 1.3 (High pitch scream)
                    rate = 1.0; 
                    pitchVar = 0.3; 
                }
                else if (key === 'VOICE_HI') {
                    rate = 1.3; 
                    pitchVar = 0.6;
                }
                else if (key === 'STONE') {
                    rate = 0.5; 
                    pitchVar = 0.5; // 0.5 -> 1.0
                    vol *= 0.6; 
                }
                else if (key === 'UI_CLICK') {
                    rate = 2.0; // High pitch click
                    pitchVar = 0.1;
                    vol *= 0.4; // Quieter
                }

                // Apply Pitch Shift
                // Default to FALSE (Tape effect) for most things to keep the PSX style
                // We ensure FALL uses this too so the pitch wobbles with the speed
                let preservePitch = false;
                
                if (sound.preservesPitch !== undefined) sound.preservesPitch = preservePitch;
                sound.mozPreservesPitch = preservePitch;
                sound.webkitPreservesPitch = preservePitch;
                
                // Final Rate Calculation
                sound.playbackRate = rate + (window.flux.rand() * pitchVar);
                sound.volume = Math.min(1.0, vol);

                sound.play().catch(() => {});

                // --- Fade Out for Fall ---
// --- Fade Out for Fall ---
                if (key === 'FALL') {
                    const fadeTime = 3500; // Extended duration (3.5s)
                    const steps = 35;
                    const intervalTime = fadeTime / steps;
                    
                    const startVol = sound.volume;
                    const startRate = sound.playbackRate;
                    let time = 0;

                    const fadeInterval = setInterval(() => {
                        time += intervalTime;
                        const progress = time / fadeTime; // 0.0 -> 1.0
                        
                        if (progress >= 1.0) {
                            sound.volume = 0;
                            clearInterval(fadeInterval);
                            return;
                        }

                        // Volume Fade: Linear to keep it audible longer
                        sound.volume = Math.max(0, startVol * (1.0 - progress));

                        // "Drawn out": Slow down playback (Doppler effect)
                        // Drop rate significantly in the second half
                        const rateDrop = progress * 0.5; // Reduce up to 50%
                        sound.playbackRate = Math.max(0.1, startRate * (1.0 - rateDrop));

                    }, intervalTime);
                    
                    sound.onended = () => clearInterval(fadeInterval);
                }
                // console.warn(`FluxCode: SFX '${key}' not found.`);
            }
        }

playWin() {
            this.stopBGM();
            // Randomly pick one of the "Hi!" victory sounds
            const key = window.flux.rand() > 0.5 ? 'VICTORY_1' : 'VICTORY_2';
            this.playSFX(key);
        }

        playLose() {
            this.stopBGM();
            this.playSFX('LOSE');
        }

        playVoice(type = 'HI') {
            this.playSFX(`VOICE_${type}`);
        }
    }

    // Initialize immediately so it's ready for the first click
    window.flux.audio = new AudioManager();
})();