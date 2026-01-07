/**
 * STONEWAVE DUEL - PSX RENDERER
 * Handles low-res rendering, integer scaling, and letterboxing.
 */
(function() {
    window.flux = window.flux || {};
const config = window.flux.config;
    const _rShakeVec = new THREE.Vector3(); // Reusable vector for shake

    class PSXRenderer {
constructor() {
            // Dynamic Resolution Setup
            // We fix the vertical resolution (INTERNAL_HEIGHT) and calculate width based on aspect ratio
            // This ensures consistent "pixel size" vertically, while filling the screen horizontally.
            this.internalHeight = config.RENDER.INTERNAL_HEIGHT; // 480
            
            // Calculate initial aspect and width
            const aspect = window.innerWidth / window.innerHeight;
            this.internalWidth = Math.floor(this.internalHeight * aspect);
            
            this.width = this.internalWidth;
            this.height = this.internalHeight;
            
// 0. Inject PSX Shader Logic (Global Patch)
            // Note: This bakes the initial resolution into the shader. 
            // Significant resizing might cause non-square pixels until reload, but this is acceptable for performance.
            // this.injectPSXShader(); // DISABLED: Global vertex wobble removed
            
            // 1. Core WebGL Renderer
this.renderer = new THREE.WebGLRenderer({ 
                antialias: false, 
                powerPreference: "high-performance",
                stencil: false,
                depth: true,
                precision: 'mediump' // OPTIMIZATION: Force medium precision for mobile GPUs
            });
            this.renderer.setPixelRatio(1); // OPTIMIZATION: Force 1:1 pixel ratio. High DPI is wasteful for pixel art upscale and kills mobile FPS.
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.autoClear = false;
            
            // Ensure canvas fills screen
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
this.renderer.domElement.style.display = 'block';
            this.renderer.domElement.style.zIndex = '0'; // Ensure canvas is behind UI
            this.renderer.domElement.style.position = 'absolute';
            this.renderer.domElement.style.top = '0';
            this.renderer.domElement.style.left = '0';
            
            document.body.appendChild(this.renderer.domElement);

// 2. Low-Res Render Target (The "PSX Buffer")
// Target A: Main Color Buffer (With Depth Texture)
            this.renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                format: THREE.RGBAFormat,
                depthBuffer: true
            });
            this.renderTarget.depthTexture = new THREE.DepthTexture();
            this.renderTarget.depthTexture.format = THREE.DepthFormat;
            this.renderTarget.depthTexture.type = THREE.UnsignedShortType;

            // Target B: Distortion Buffer (Velocity/Flow Map)
            this.distortionTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
                minFilter: THREE.LinearFilter, // Linear for smooth warp
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                depthBuffer: true
            });

            // 3. Game Scene (3D World)
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(config.RENDER.BG_COLOR);
            
            // Camera setup
this.camera = new THREE.PerspectiveCamera(config.RENDER.CAMERA.FOV, this.width / this.height, 0.1, 1000); 
            this.camera.position.set(config.RENDER.CAMERA.POS_X, config.RENDER.CAMERA.POS_Y, config.RENDER.CAMERA.POS_Z); 
            this.camera.lookAt(config.RENDER.CAMERA.LOOK_X, config.RENDER.CAMERA.LOOK_Y, config.RENDER.CAMERA.LOOK_Z);
            
// Camera Shake State
            this.basePos = this.camera.position.clone();
            this.baseQuat = this.camera.quaternion.clone(); // Store initial rotation
            this.shakeTrauma = 0;

// Toon Gradient Setup
            this.toonGradient = this.createToonGradient();

            // Environment (Sky/Ground)
            this.createEnvironment();

            // 4. Screen Scene (2D Quad for upscaling & composition)
            this.screenScene = new THREE.Scene();
            this.screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            
            const planeGeo = new THREE.PlaneBufferGeometry(2, 2);
            
            // Composite Shader (Distortion + Chromatic Aberration)
// Composite Shader (Distortion + Chromatic Aberration)
            // OPTIMIZATION: Dynamic shader generation based on platform
            const isMobile = config.PERFORMANCE.IS_MOBILE;
            
            let fragShader = `
                precision mediump float;
                uniform sampler2D tDiffuse;
                uniform sampler2D tDistort;
                uniform float uTime;
                varying vec2 vUv;
            `;

            if (!isMobile) {
                fragShader += `
                    uniform sampler2D tDepth;
                    uniform float cameraNear;
                    uniform float cameraFar;
                    uniform vec2 resolution;

                    float getLinearDepth(vec2 coord) {
                        float depth = texture2D(tDepth, coord).x;
                        float z_n = 2.0 * depth - 1.0;
                        float z_e = 2.0 * cameraNear * cameraFar / (cameraFar + cameraNear - z_n * (cameraFar - cameraNear));
                        return z_e;
                    }
                `;
            }

            fragShader += `
                void main() {
                    // Sample Distortion Map (RG = Vector, A = Strength)
                    vec4 dMap = texture2D(tDistort, vUv);
                    
                    // Decode flow vector (0..1 -> -1..1)
                    vec2 flow = dMap.xy - 0.5;
                    
                    // Strength comes from Alpha
                    float strength = dMap.a * dMap.a * 0.1; 
                    
                    vec2 warp = flow * strength;
                    
                    // Refraction (Warp the UVs)
                    vec2 distortedUv = vUv + warp;
                    distortedUv = clamp(distortedUv, 0.001, 0.999);
                    
                    vec4 color = texture2D(tDiffuse, distortedUv);
            `;

            if (!isMobile) {
                fragShader += `
// --- Depth Edge Detection (Silhouette) ---
                    // We use distortedUv to ensure the outline warps with the shockwave
                    float d = getLinearDepth(distortedUv);
                    
// THICKER OUTLINES: Sample further away (3.0x stride for chunky look)
                    vec2 texel = vec2(3.0 / resolution.x, 3.0 / resolution.y);
                    
                    float dRight = getLinearDepth(distortedUv + vec2(texel.x, 0.0));
                    float dUp = getLinearDepth(distortedUv + vec2(0.0, texel.y));
                    
                    float diff = length(vec2(d - dRight, d - dUp));
                    
                    // Threshold: Lowered to 0.5 to catch Player vs Floor (Perimeter Only)
                    float edge = step(0.5, diff);
                    
                    color.rgb = mix(color.rgb, vec3(0.0), edge);
`;
            }

            fragShader += `
                    gl_FragColor = color;
                }
            `;

            this.screenMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    tDiffuse: { value: this.renderTarget.texture },
                    tDepth: { value: this.renderTarget.depthTexture },
                    tDistort: { value: this.distortionTarget.texture },
                    uTime: { value: 0 },
                    cameraNear: { value: 0.1 },
                    cameraFar: { value: 1000.0 },
                    resolution: { value: new THREE.Vector2(this.width, this.height) }
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: fragShader,
                depthTest: false,
                depthWrite: false
            });
            
            this.screenQuad = new THREE.Mesh(planeGeo, this.screenMaterial);
this.screenScene.add(this.screenQuad);

// 5. Lighting
            this.createLights();

            // Bind resize
            window.addEventListener('resize', () => this.onResize());
            this.onResize(); // Initial sizing
        }

createLights() {
            // Toon Lighting Setup
            // Lower ambient to allow shadows to be dark
            // Strong directional to drive the toon bands
            const ambient = new THREE.AmbientLight(0xffffff, 0.6); 
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.9); 
            
            // Position light more frontally/top-down to illuminate faces and floor well
            dirLight.position.set(3.5, 12, 6); 
            
            this.scene.add(ambient);
            this.scene.add(dirLight);
        }

        createToonGradient() {
            // 3-Step Tone Map for Cel Shading
            const size = 256;
            const data = new Uint8Array(size);
            
            // Define bands (0..255 intensity)
            // 0.0 - 0.3: Shadow
            // 0.3 - 0.7: Mid
            // 0.7 - 1.0: Highlight
            for (let i = 0; i < size; i++) {
                const t = i / size;
                if (t < 0.3) {
                    data[i] = 120; // Shadow
                } else if (t < 0.7) {
                    data[i] = 200; // Mid
                } else {
                    data[i] = 255; // Highlight
                }
            }
            
            const tex = new THREE.DataTexture(data, size, 1, THREE.LuminanceFormat);
            tex.minFilter = THREE.NearestFilter;
            tex.magFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
            tex.needsUpdate = true;
            
            window.flux.toonGradient = tex;
            return tex;
        }

        resetScene() {
            // Clear all objects from scene
            while(this.scene.children.length > 0){ 
                this.scene.remove(this.scene.children[0]); 
            }
            // Re-populate environment and lights
            this.createEnvironment();
            this.createLights();
            // Bind resize
            window.addEventListener('resize', () => this.onResize());
            this.onResize(); // Initial sizing
        }

        injectPSXShader() {
            const w = this.width.toFixed(1);
            const h = this.height.toFixed(1);
            
            console.log(`FluxCode: Injecting PSX Vertex Jitter (Res: ${w}x${h})`);

            // Patch the project_vertex chunk to add vertex snapping
            // This modifies the vertex shader of ALL standard Three.js materials
// Patch the project_vertex chunk to add vertex snapping
            const targetString = 'gl_Position = projectionMatrix * mvPosition;';
            if (!THREE.ShaderChunk.project_vertex.includes(targetString)) {
                console.warn("FluxCode: PSX Shader Injection Failed - Target string not found.");
                return;
            }

            THREE.ShaderChunk.project_vertex = THREE.ShaderChunk.project_vertex.replace(
                targetString,
                `
                gl_Position = projectionMatrix * mvPosition;
                
                // --- PSX JITTER START ---
                if (gl_Position.w > 0.0) {
                    vec4 psx_pos = gl_Position;
                    psx_pos.xyz /= psx_pos.w;
                    
                    float psx_rw = ${w};
                    float psx_rh = ${h};
                    
                    psx_pos.x = floor(psx_pos.x * psx_rw * 0.5) / (psx_rw * 0.5);
                    psx_pos.y = floor(psx_pos.y * psx_rh * 0.5) / (psx_rh * 0.5);
                    
                    psx_pos.xyz *= psx_pos.w;
                    gl_Position = psx_pos;
                }
                // --- PSX JITTER END ---
                `
            );
        }

onResize() {
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const aspect = winW / winH;
            
            // Recalculate internal width to match aspect ratio
            // Height stays fixed at 480 for consistent vertical FOV/Pixel density
            this.height = this.internalHeight;
            this.width = Math.floor(this.height * aspect);

// Resize the low-res buffers
            this.renderTarget.setSize(this.width, this.height);
            this.distortionTarget.setSize(this.width, this.height);
            
            // Update resolution uniform for edge detection
            if (this.screenMaterial) {
                this.screenMaterial.uniforms.resolution.value.set(this.width, this.height);
            }

            // Resize the actual canvas to fill the window
            this.renderer.setSize(winW, winH);
            
            // Update Camera
            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix();
            
            // Force styles just in case
            const canvas = this.renderer.domElement;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            
            console.log(`FluxCode: Resized. Internal: ${this.width}x${this.height}, Window: ${winW}x${winH}`);
        }

hasDistortionObjects() {
            // Check Shockwaves
            if (window.flux.currentShockwaveManager && window.flux.currentShockwaveManager.waves.length > 0) return true;
            
            // Check Players for Crystal Powerup (which has distortion mesh)
            if (window.flux._players) {
                for(let i=0; i<window.flux._players.length; i++) {
                    const p = window.flux._players[i];
                    if (p.activePowerup && p.activePowerup.type === 'CRYSTAL') return true;
                }
            }
            return false;
        }

        render() {
            // Update Uniforms
            const time = performance.now() / 1000;
            this.screenMaterial.uniforms.uTime.value = time;

            // Video background handles its own animation

// 0. Apply Camera Shake
            // Always reset orientation to base first to fix menu-orbit drift
            this.camera.quaternion.copy(this.baseQuat);

            if (this.shakeTrauma > 0) {
                this.shakeTrauma = Math.max(0, this.shakeTrauma - 0.05); // Decay
                const shake = this.shakeTrauma * this.shakeTrauma; // Quadratic falloff
                const maxOffset = 0.5;
                const maxRoll = 0.05;
                
                _rShakeVec.set(
                    (window.flux.rand() - 0.5) * maxOffset * shake,
                    (window.flux.rand() - 0.5) * maxOffset * shake,
                    (window.flux.rand() - 0.5) * maxOffset * shake
                );
                
                this.camera.position.copy(this.basePos).add(_rShakeVec);
                // Apply roll locally on top of base quaternion
                this.camera.rotateZ((window.flux.rand() - 0.5) * maxRoll * shake);
            } else {
                this.camera.position.copy(this.basePos);
            }

            // --- PASS 1: Main Scene (Layer 0) ---
            this.renderer.setRenderTarget(this.renderTarget);
            // Use config color for clear, as scene.background is a Texture
            this.renderer.setClearColor(config.RENDER.BG_COLOR || 0x000000, 1);
            this.renderer.clear();
            
            this.camera.layers.set(0); // See standard objects
            this.renderer.render(this.scene, this.camera);

            // --- PASS 2: Distortion Map (Layer 1) ---
            // OPTIMIZATION: Skip render pass if no distortion objects exist
            this.renderer.setRenderTarget(this.distortionTarget);
            this.renderer.setClearColor(0x000000, 0); // Clear to transparent black
            this.renderer.clear();

            if (this.hasDistortionObjects()) {
                const savedBg = this.scene.background;
                this.scene.background = null; // Hide background for distortion pass
                
                this.camera.layers.set(1); // See distortion objects
                this.renderer.render(this.scene, this.camera);

                // Restore background and layers
                this.scene.background = savedBg;
                this.camera.layers.enableAll();
            } else {
                // Ensure layers are reset even if we skipped
                this.camera.layers.enableAll();
            }

            // --- PASS 3: Composite to Screen ---
            this.renderer.setRenderTarget(null);
            this.renderer.clear();
            this.renderer.render(this.screenScene, this.screenCamera);
        }
        createEnvironment() {
            // Cleanup previous
            if (this.scene.background && this.scene.background.dispose) {
                // Don't dispose if it's the gradient texture we might reuse, but for now simple cleanup
                this.scene.background.dispose();
            }
            if (this.bgVideo) {
                this.bgVideo.pause();
                this.bgVideo.src = "";
                this.bgVideo.load();
                if (this.bgVideo.parentNode) this.bgVideo.parentNode.removeChild(this.bgVideo);
                this.bgVideo = null;
            }

            // 1. Establish Gradient Fallback (Immediate Visuals)
            // This ensures the user never sees a black screen while video loads
            const createGradient = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 2;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');
                const grad = ctx.createLinearGradient(0, 0, 0, 64);
                grad.addColorStop(0.0, '#0b0b1a'); // Deep Space Top
                grad.addColorStop(0.5, '#1a1a2e'); // Mid
                grad.addColorStop(1.0, '#2d2d44'); // Horizon
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 2, 64);
                
                const tex = new THREE.CanvasTexture(canvas);
                tex.magFilter = THREE.LinearFilter;
                tex.minFilter = THREE.LinearFilter;
                tex.generateMipmaps = false;
                return tex;
            };

// Set Gradient immediately
            this.scene.background = createGradient();

            // 2. Attempt Image Load (Priority)
            if (config.RENDER.BG_IMAGE_URL) {
                const loader = new THREE.TextureLoader();
                loader.setCrossOrigin('anonymous');
                loader.load(config.RENDER.BG_IMAGE_URL, (tex) => {
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    this.scene.background = tex;
                    console.log("FluxCode: Background Image Loaded.");
                });
                return;
            }

            if (!config.PERFORMANCE.USE_VIDEO_BG) return;

            // 2. Attempt Video Load
            const video = document.createElement('video');
            video.src = config.RENDER.BG_VIDEO_URL;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';
            
            // DOM Insertion (Hidden) - Required for some mobile autoplay policies
            video.style.position = 'absolute';
            video.style.width = '1px';
            video.style.height = '1px';
            video.style.opacity = '0';
            video.style.pointerEvents = 'none';
            video.style.zIndex = '-1';
            document.body.appendChild(video);

            const videoTexture = new THREE.VideoTexture(video);
            videoTexture.minFilter = THREE.LinearFilter;
            videoTexture.magFilter = THREE.LinearFilter;
            videoTexture.format = THREE.RGBAFormat;

            // 3. Swap to Video ONLY when playing
            const onPlay = () => {
                console.log("FluxCode: Video BG active. Swapping texture.");
                this.scene.background = videoTexture;
                video.removeEventListener('play', onPlay);
            };
            video.addEventListener('play', onPlay);

            // Error Handling
            video.onerror = (e) => {
                console.warn("FluxCode: Video BG failed. Keeping gradient.", e);
                // Gradient is already set, so we just do nothing.
            };

            // Autoplay Logic
            const attemptPlay = () => {
                video.play().catch(e => {
                    console.warn("FluxCode: Autoplay blocked. Waiting for interaction.");
                    const onInteract = () => {
                        video.play();
                        window.removeEventListener('click', onInteract);
                        window.removeEventListener('touchstart', onInteract);
                        window.removeEventListener('keydown', onInteract);
                    };
                    window.addEventListener('click', onInteract);
                    window.addEventListener('touchstart', onInteract);
                    window.addEventListener('keydown', onInteract);
                });
            };
            attemptPlay();

            this.bgVideo = video;
        }

        addShake(amount) {
            this.shakeTrauma = Math.min(1.0, this.shakeTrauma + amount);
        }
    }

    window.flux.renderer = new PSXRenderer();
})();