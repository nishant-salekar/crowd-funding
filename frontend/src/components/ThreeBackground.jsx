import { useEffect, useRef } from "react";
import * as THREE from "three";

// Create a texture mapped canvas to act as the coin faces
function createCoinTexture(symbol, bgColor, fontOverride) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Base colored background
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(256, 256, 240, 0, Math.PI * 2);
  ctx.fill();

  // Inner border
  ctx.lineWidth = 20;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.stroke();

  // Draw symbol text
  ctx.fillStyle = "#ffffff";
  const fontSize = fontOverride || "140px";
  ctx.font = `bold ${fontSize} Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Drop shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  
  ctx.fillText(symbol, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export default function ThreeBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // ── Scene & Camera ──────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 8;

    // ── Lighting (Smooth Torch) ─────────────────────────────────────────────
    const spotLight = new THREE.SpotLight(0xffffff, 400); // Drastically reduced intensity
    spotLight.position.copy(camera.position); 
    spotLight.angle = Math.PI / 6;    // Wider angle like a torch/flashlight
    spotLight.penumbra = 1.0;         // 1.0 = Maximum softness at the edges
    spotLight.decay = 2; 
    spotLight.distance = 60;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);

    scene.add(ambientLight);
    scene.add(spotLight);
    scene.add(spotLight.target); 

    // ── Floating Crypto & Tech Coins ─────────────────────────────────────────
    const coins = [];
    const coinData = [
      { symbol: "BTC", color: "#f7931a" },
      { symbol: "ETH", color: "#627eea" },
      { symbol: "MONAD", color: "#836ef9", font: "80px" },
      { symbol: "SOL", color: "#14f195" },
      { symbol: "AVAX", color: "#e84142" },
      { symbol: "HTML", color: "#d4c3b3", font: "110px" }, // White text on Beige background 
      { symbol: "CSS", color: "#1572b6", font: "120px" },
      { symbol: "JS", color: "#f7df1e", font: "150px" },
      { symbol: "REACT", color: "#61dafb", font: "90px" }
    ];

    const coinGeo = new THREE.CylinderGeometry(1, 1, 0.15, 64);

    for (let i = 0; i < 50; i++) {
      const data = coinData[i % coinData.length];
      const tex = createCoinTexture(data.symbol, data.color, data.font);
      
      const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.6 });
      const edgeMat = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.3, metalness: 0.8 });
      const coinMesh = new THREE.Mesh(coinGeo, [edgeMat, faceMat, faceMat]);
      
      coinMesh.position.set(
        (Math.random() - 0.5) * 30, 
        (Math.random() - 0.5) * 25, 
        (Math.random() - 0.5) * 20 - 5 
      );
      
      coinMesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      const scale = Math.random() * 0.5 + 0.3; 
      coinMesh.scale.set(scale, scale, scale);

      const speed = {
        y: -(Math.random() * 0.03 + 0.01), // Falling downwards (Raining effect)
        x: (Math.random() - 0.5) * 0.01,
        rotX: (Math.random() - 0.5) * 0.03,
        rotY: (Math.random() - 0.5) * 0.03,
        rotZ: (Math.random() - 0.5) * 0.03
      };

      scene.add(coinMesh);
      coins.push({ mesh: coinMesh, speed });
    }

    // ── Static Ground Coins (Stacked at the bottom) ─────────────────────────
    for (let i = 0; i < 40; i++) {
      const data = coinData[i % coinData.length];
      const tex = createCoinTexture(data.symbol, data.color, data.font);
      
      const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.5 });
      const edgeMat = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.4, metalness: 0.7 });
      const coinMesh = new THREE.Mesh(coinGeo, [edgeMat, faceMat, faceMat]);
      
      coinMesh.position.set(
        (Math.random() - 0.5) * 40,      // Wide horizontal scatter
        -12 + (Math.random() * 2),       // Accumulated near the bottom layout bounds
        (Math.random() - 0.5) * 20 - 5   // Deep Z spread for parallax
      );
      
      // Laid horizontally to mirror resting physics
      coinMesh.rotation.set(
        Math.PI / 2 + (Math.random() - 0.5) * 0.5,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.5
      );

      const scale = Math.random() * 0.5 + 0.3; 
      coinMesh.scale.set(scale, scale, scale);

      scene.add(coinMesh);
    }

    // ── Mouse Tracker (Smooth Aiming & Damping) ─────────────────────────────
    const mouse = new THREE.Vector2(0, 0);
    const vec3 = new THREE.Vector3();
    let isMouseActive = false;

    // Track both the current actual target of the light, and where we want it to go
    const currentTarget = new THREE.Vector3(0, 0, -10);
    const desiredTarget = new THREE.Vector3(0, 0, -10);

    const onMouseMove = (event) => {
      isMouseActive = true;
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      vec3.set(mouse.x, mouse.y, 0.5);
      vec3.unproject(camera);
      
      const dir = vec3.sub(camera.position).normalize();
      // Set the desired target position deep into the scene
      desiredTarget.copy(camera.position).add(dir.multiplyScalar(20));
    };

    // ── Animation Loop ───────────────────────────────────────────────────────
    let animId;
    const targetCameraPos = new THREE.Vector3(0, 0, 8); // Initial depth

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // 1. Damped Camera Parallax (Immersive 3D Depth)
      targetCameraPos.x = mouse.x * -1.5; // Shift opposite to mouse
      targetCameraPos.y = mouse.y * -1.5;
      camera.position.lerp(targetCameraPos, 0.03); // Buttery damping factor
      camera.lookAt(0, 0, -5); // Lock focus on center void

      // Keep light physically tethered to the damped camera
      spotLight.position.copy(camera.position);

      // 2. Damped Torch Light Aiming
      // If mouse never moved, let the torch lazily wander
      if (!isMouseActive) {
        const time = Date.now() * 0.0005;
        desiredTarget.set(
          Math.sin(time) * 10,
          Math.cos(time * 0.8) * 10,
          -10
        );
      }

      // Smoothly drag (lerp) the light beam towards the exact target
      currentTarget.lerp(desiredTarget, 0.04); 
      spotLight.target.position.copy(currentTarget);

      // 3. Raining Asset Physics
      coins.forEach(c => {
        c.mesh.position.y += c.speed.y;
        c.mesh.position.x += c.speed.x;
        c.mesh.rotation.x += c.speed.rotX;
        c.mesh.rotation.y += c.speed.rotY;
        c.mesh.rotation.z += c.speed.rotZ;

        // Reset to the top when they fall past the bottom
        if (c.mesh.position.y < -15) {
          c.mesh.position.y = 15;
          c.mesh.position.x = (Math.random() - 0.5) * 30;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100%", height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        background: "#000000",
      }}
    />
  );
}
