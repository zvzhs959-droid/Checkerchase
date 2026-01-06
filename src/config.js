/**
 * STONEWAVE DUEL - CONFIGURATION
 * Based on Combat Bible & Systems Spec
 */
(function() {
    window.flux = window.flux || {};

    // Detect Mobile for Auto-Optimization
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const CONFIG = {
        // --- PERFORMANCE FLAGS ---
        PERFORMANCE: {
            IS_MOBILE: isMobile,
            ENABLE_OUTLINES: true,  // Forced ON per request
            USE_VIDEO_BG: false,    // Disabled for static image
            PARTICLE_MULTIPLIER: isMobile ? 0.5 : 1.0,
            RESOLUTION_SCALE: isMobile ? 0.75 : 1.0
        },
        // --- ONLINE MULTIPLAYER ---
NET: {
            // WebRTC Configuration
            // We use the default public PeerJS server for simplicity.
            
            // Networking Parameters (WebRTC)
            // High-speed updates for real-time combat
            SNAPSHOT_INTERVAL: 50,   // ms (20 Hz) - Host sends world state
            INPUT_INTERVAL: 16,      // ms (60 Hz) - Clients send input every frame
            
DEFAULT_ROOM: "STONEWAVE_TEST_LOBBY", // Default ID for quick testing
            TIMEOUT_SEC: 10          // Disconnect timeout
        },

        // --- RENDERER SETTINGS ---
        RENDER: {
            INTERNAL_WIDTH: 270,  // 9:16 Aspect Ratio (Portrait)
            INTERNAL_HEIGHT: 480,
            ASPECT_RATIO: 9/16,
            FPS_SIM: 60,
            FPS_ANIM: 60, 
            BG_COLOR: 0x1a1a2e, 
            BG_VIDEO_URL: 'https://files.catbox.moe/qt3x44.mp4',
            BG_IMAGE_URL: 'https://i.postimg.cc/K8yS7bCX/file-000000007d04722f9b8035c972c4dfa9.png',
            
            // Camera Settings (Zoomed out for mobile visibility)
CAMERA: {
                FOV: 60,
                POS_X: 3.5,
                POS_Y: 10.5, // Pulled back slightly for better mobile fit (was 9.5)
                POS_Z: 12.5, // Pulled back slightly (was 11.5)
                LOOK_X: 3.5,
                LOOK_Y: 0,
                LOOK_Z: 3.5  // Look at center
            }
        },

        // --- FRAME DATA (60 FPS) ---
        MOVEMENT: {
            WALK_SPEED: 4.2,
            WALK_ACCEL: 4,
            DASH: { STARTUP: 2, ACTIVE: 8, RECOVERY: 24 },
            HOP: { STARTUP: 3, ACTIVE: 22, RECOVERY: 6 },
            TURN: 20,
            MAX_DASHES: 3
        },

        MELEE: {
            JAB: { 
                STARTUP: 5, ACTIVE: 4, RECOVERY: 8, 
                HITSTOP: 6, PUSH: 1.0 
            },
            SHOULDER_CHECK: { 
                STARTUP: 0, 
                ACTIVE: 8, RECOVERY: 14, 
                HITSTOP: 8, PUSH: 2.0 
            },
            RITE_SMASH: { 
                STARTUP: 12, ACTIVE: 6, RECOVERY: 16, 
                HITSTOP: 10, PUSH: 2.5 
            },
            EDGE_STOMP: { 
                STARTUP: 0, 
                ACTIVE: 8, RECOVERY: 12, 
                PUSH: 1.5 
            }
        },
        STUN: {
            VELOCITY_Y: 8.5,
            KNOCKBACK: 8.0,
            FLASH_SPEED: 30
        },

        SHOCKWAVE: {
            FALL_DELAY: 0.25,
            FALL_SEQUENCE_MULT: 0.9,
            BASE: {
                STARTUP: 16,
                ACTIVE: 4, RECOVERY: 12,
                SPEED: 9.0,
                RANGE: 8,
                PUSH: 0.8
            },
            CHARGED: {
                HOLD_MIN: 10,
                STARTUP: 12, ACTIVE: 4, RECOVERY: 18,
                SPEED: 11.0, 
                RANGE: 10,
                PUSH: 1.2
            }
        },

        // --- POWERUPS ---
        POWERUPS: {
            SPAWN_CHANCE: 0.05, // Chance per second
            TYPES: {
                CRYSTAL: {
                    ID: 'CRYSTAL',
                    DURATION: 12.0,
                    KNOCKBACK_MULT: 2.0, // "knock them two blocks away"
                    DASH_INFINITE: true,
                    SHOCKWAVE_SPEED_MULT: 1.5,
                    COLOR: 0x00ffff
                },
                CAPE: {
                    ID: 'CAPE',
                    DURATION: 10.0,
                    SPEED_MULT: 1.3,
                    COLOR: 0xff3333
                }
            }
        },

        // --- TILE SYSTEM ---
        TILES: {
            STATES: {
                STABLE: 0,
                CRACKED: 1,
                FALLING: 2,
                MISSING: 3,
                REFORMING: 4,
                STONE: 5
            },
            TIMING: {
                CRACKED_TO_FALLING_LIGHT: 0.1,
                CRACKED_TO_FALLING_SMASH: 0.05,
                REFORM_TO_STABLE: 0.4
            },
            GRID_SIZE: 8,
            COLORS: {
                SIDE: 0x352116
            },
            PALETTES: {
                LIGHT: {
                    HIGHLIGHT: '#D8C79C',
                    MAIN: '#C7B181',
                    SHADOW: '#B09466',
                    DEEP: '#8F734E'
                },
                DARK: {
                    HIGHLIGHT: '#7A5A39',
                    MAIN: '#65452D',
                    SHADOW: '#4F3322',
                    DEEP: '#352116'
                }
            }
        },

        // --- GAME LOOP ---
        GAME: {
            ROUND_TIME: 99,
            SHRINK_START_TIME: 28,
            SHRINK_INTERVAL: 12.0,
            RESPAWN_INVULN: 2.0,
            MAX_SHRINKS: 2,
            STARTING_STOCK: 5
        },

        // --- ARENA SETTINGS ---
        ARENA: {
            TYPE: 'BASALT_CHESS',
            RETURN_TIME: 4.5,
            PLATFORM_DURATION: 2.0
        },
        
        // --- SHOP & CURRENCY ---
        SHOP: {
            REWARD_WIN: 1,
            ITEMS: {
                CROWN_GOLD: {
                    id: 'crown_gold',
                    name: 'Golden Crown',
                    cost: 1,
                    type: 'HEAD',
                    description: 'A golden symbol of victory.'
                },
                HALO_GOLD: {
                    id: 'halo_gold',
                    name: 'Golden Halo',
                    cost: 1,
                    type: 'HEAD',
                    description: 'Radiant divine energy.'
                },
                THE_ROY: {
                    id: 'the_roy',
                    name: 'The Roy',
                    cost: 3,
                    type: 'HEAD',
                    description: 'A distinguished horseshoe hairline.'
                },
                ANGEL_WINGS: {
                    id: 'angel_wings',
                    name: 'Angel Wings',
                    cost: 5,
                    type: 'BACK',
                    description: 'Flap over holes once per dash.'
                }
            }
        },
        
        // --- AUDIO SETTINGS ---
        AUDIO: {
            BGM_URL: 'https://files.catbox.moe/fjmzfs.mp3',
            VOLUME_BGM: 0.5,
SFX: {
                SHOCKWAVE: 'https://files.catbox.moe/33p5cl.mp3',
                DASH: 'https://files.catbox.moe/nivyui.mp3',
FALL: 'https://files.catbox.moe/35ccen.wav', // Repurposed VOICE_HURT
                
                // Victory Sounds (Randomized)
                VICTORY_1: 'https://files.catbox.moe/868f1e.wav', // hi!
                VICTORY_2: 'https://files.catbox.moe/v6pi2y.wav', // hii
                
                WIN: 'https://files.catbox.moe/fjmzfs.mp3', // Music/Jingle
                LOSE: 'https://files.catbox.moe/dy0tql.mp3',
                
                STONE: 'https://files.catbox.moe/gmvv92.wav', // turntostone
                
                // Voice / Actions
                GRUNT: 'https://files.catbox.moe/s2t8d1.wav', // Dash grunt
                VOICE_HURT: 'https://files.catbox.moe/35ccen.wav', // GETHIT
                
                EQUIP: 'https://files.catbox.moe/e0dtv7.wav', // purchasefromshop
                
                POWERUP_SPAWN: 'https://files.catbox.moe/nivyui.mp3',
                POWERUP_COLLECT: 'https://files.catbox.moe/33p5cl.mp3'
            },
            VOLUME_SFX: 0.7
        }
    };

    window.flux.config = CONFIG;
})();