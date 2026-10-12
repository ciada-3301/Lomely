"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export default function Hero3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 80;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Geometry 1: Starfield / Atmospheric Particle Dust
    const particlesCount = 700;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 160;
    }

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(posArray, 3)
    );

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.8,
      color: 0xf59e0b, // Amber highlight
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Geometry 2: Geometric Torus Lattice (Architectural depth)
    const torusGeometry = new THREE.TorusGeometry(32, 1.2, 16, 100);
    const torusMaterial = new THREE.MeshBasicMaterial({
      color: 0x22222a,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const torusMesh = new THREE.Mesh(torusGeometry, torusMaterial);
    torusMesh.rotation.x = Math.PI / 3;
    scene.add(torusMesh);

    // Geometry 3: Secondary Outer Ring (Cold Titanium)
    const outerRingGeometry = new THREE.RingGeometry(48, 48.4, 64);
    const outerRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x3f3f46,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
    });
    const outerRingMesh = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
    outerRingMesh.rotation.x = Math.PI / 4;
    scene.add(outerRingMesh);

    // Mouse movement parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - window.innerWidth / 2) * 0.03;
      mouseY = (event.clientY - window.innerHeight / 2) * 0.03;
    };

    window.addEventListener("mousemove", onMouseMove);

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", onResize);

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera follow
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;
      camera.position.x = targetX;
      camera.position.y = -targetY;
      camera.lookAt(scene.position);

      // Subtle rotations
      particlesMesh.rotation.y = elapsedTime * 0.03;
      torusMesh.rotation.z = elapsedTime * 0.04;
      torusMesh.rotation.y = elapsedTime * 0.02;
      outerRingMesh.rotation.z = -elapsedTime * 0.02;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      torusGeometry.dispose();
      torusMaterial.dispose();
      outerRingGeometry.dispose();
      outerRingMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-35"
      aria-hidden="true"
    />
  );
}
