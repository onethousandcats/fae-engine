// ============================================================
// FAE ENGINE — Layer 6: Renderer / Scene Setup
// Pure Three.js boilerplate. No game logic lives here.
// This file only knows about pixels, cameras, and light.
// ============================================================

import * as THREE from "three";

export type SceneContext = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    raycaster: THREE.Raycaster;
};

// ------------------------------------------------------------
// createScene
// Sets up the Three.js scene, camera, lights, and renderer.
// Returns everything the rest of the renderer needs.
// ------------------------------------------------------------

export function createScene(container: HTMLElement): SceneContext {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // ----------------------------------------------------------
    // Camera — isometric-ish angled view, classic TBS framing
    // ----------------------------------------------------------
    const camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(8, 12, 14);
    camera.lookAt(0, 0, 0);

    // ----------------------------------------------------------
    // Renderer
    // ----------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // ----------------------------------------------------------
    // Lighting — ambient + directional for soft shadows
    // ----------------------------------------------------------
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.position.set(10, 20, 10);
    directional.castShadow = true;
    directional.shadow.mapSize.set(2048, 2048);
    scene.add(directional);

    // ----------------------------------------------------------
    // Raycaster — for click-to-select input later
    // ----------------------------------------------------------
    const raycaster = new THREE.Raycaster();

    // ----------------------------------------------------------
    // Resize handling
    // ----------------------------------------------------------
    window.addEventListener("resize", () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    return { scene, camera, renderer, raycaster };
}

// ------------------------------------------------------------
// startRenderLoop
// Standard requestAnimationFrame loop.
// Accepts a callback run every frame before rendering —
// this is where the renderer syncs visuals to game state.
// ------------------------------------------------------------

export function startRenderLoop(
    ctx: SceneContext,
    onFrame?: () => void
): void {
    function loop() {
        requestAnimationFrame(loop);
        onFrame?.();
        ctx.renderer.render(ctx.scene, ctx.camera);
    }
    loop();
}