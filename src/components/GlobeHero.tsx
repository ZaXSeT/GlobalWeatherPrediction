"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

// A self-contained globe: solid core, wireframe shell, and a faint atmosphere. No
// external textures or assets, which keeps it CSP-friendly and fully offline. Purely
// decorative - see LazyGlobe for why it is lazy-loaded and never blocks the
// security-relevant parts of the app.
function Globe() {
  const group = useRef<Group>(null);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.12;
  });

  return (
    <group ref={group} rotation={[0.35, 0, 0.18]}>
      <mesh>
        <sphereGeometry args={[2.02, 64, 64]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} metalness={0.15} />
      </mesh>

      <mesh>
        <icosahedronGeometry args={[2.16, 5]} />
        <meshBasicMaterial color="#d1d1d6" wireframe transparent opacity={0.6} />
      </mesh>

      <mesh scale={1.14}>
        <sphereGeometry args={[2.16, 32, 32]} />
        <meshBasicMaterial color="#e5e5ea" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

export default function GlobeHero() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.4], fov: 45 }}
      dpr={[1, 2]}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 4, 6]} intensity={2.2} />
      <Globe />
    </Canvas>
  );
}
