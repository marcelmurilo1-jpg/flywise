import { cn } from "@/lib/utils";
import { useRef, useEffect, useCallback } from "react";

interface GlobeProps {
  className?: string;
  size?: number;
  dotColor?: string;
  arcColor?: string;
  markerColor?: string;
  autoRotateSpeed?: number;
  connections?: { from: [number, number]; to: [number, number] }[];
  markers?: { lat: number; lng: number; label?: string }[];
}

// Well-distributed markers — no two too close, cover all continents + Pacific
const DEFAULT_MARKERS = [
  // Americas
  { lat: -23.55, lng: -46.63, label: "São Paulo" },
  { lat: -12.05, lng: -77.04, label: "Lima" },
  { lat:  40.71, lng: -74.01, label: "Nova York" },
  { lat:  34.05, lng: -118.24, label: "Los Angeles" },
  { lat:  19.43, lng: -99.13, label: "Cidade do México" },
  { lat:  49.19, lng: -123.18, label: "Vancouver" },
  // Europe
  { lat:  51.51, lng:  -0.13, label: "Londres" },
  { lat:  41.90, lng:  12.49, label: "Roma" },
  { lat:  55.75, lng:  37.62, label: "Moscou" },
  // Africa / Middle East
  { lat:  25.20, lng:  55.27, label: "Dubai" },
  { lat:  -1.29, lng:  36.82, label: "Nairóbi" },
  { lat: -33.92, lng:  18.42, label: "Cidade do Cabo" },
  { lat:  41.01, lng:  28.98, label: "Istambul" },
  // Asia
  { lat:  28.61, lng:  77.21, label: "Delhi" },
  { lat:   1.36, lng: 103.82, label: "Singapura" },
  { lat:  35.68, lng: 139.69, label: "Tóquio" },
  // Oceania / Pacific
  { lat: -33.87, lng: 151.21, label: "Sydney" },
  { lat:  21.31, lng: -157.85, label: "Honolulu" },
];

const DEFAULT_CONNECTIONS: { from: [number, number]; to: [number, number] }[] = [
  // São Paulo hub
  { from: [-23.55, -46.63], to: [40.71,  -74.01] },   // SP → Nova York
  { from: [-23.55, -46.63], to: [51.51,   -0.13] },   // SP → Londres
  { from: [-23.55, -46.63], to: [-12.05, -77.04] },   // SP → Lima
  { from: [-23.55, -46.63], to: [-33.92,  18.42] },   // SP → Cidade do Cabo
  // North America
  { from: [40.71,  -74.01], to: [51.51,   -0.13] },   // NY → Londres
  { from: [34.05, -118.24], to: [40.71,  -74.01] },   // LA → NY
  { from: [34.05, -118.24], to: [35.68,  139.69] },   // LA → Tóquio
  { from: [34.05, -118.24], to: [21.31, -157.85] },   // LA → Honolulu
  { from: [49.19, -123.18], to: [34.05, -118.24] },   // Vancouver → LA
  { from: [19.43,  -99.13], to: [40.71,  -74.01] },   // México → NY
  { from: [21.31, -157.85], to: [35.68,  139.69] },   // Honolulu → Tóquio
  // Europe
  { from: [51.51,   -0.13], to: [41.01,   28.98] },   // Londres → Istambul
  { from: [51.51,   -0.13], to: [55.75,   37.62] },   // Londres → Moscou
  { from: [41.90,   12.49], to: [51.51,   -0.13] },   // Roma → Londres
  { from: [41.01,   28.98], to: [55.75,   37.62] },   // Istambul → Moscou
  // Middle East / Africa
  { from: [41.01,   28.98], to: [25.20,   55.27] },   // Istambul → Dubai
  { from: [25.20,   55.27], to: [28.61,   77.21] },   // Dubai → Delhi
  { from: [25.20,   55.27], to: [-1.29,   36.82] },   // Dubai → Nairóbi
  { from: [-1.29,   36.82], to: [-33.92,  18.42] },   // Nairóbi → Cidade do Cabo
  // Asia / Oceania
  { from: [28.61,   77.21], to: [1.36,   103.82] },   // Delhi → Singapura
  { from: [55.75,   37.62], to: [35.68,  139.69] },   // Moscou → Tóquio
  { from: [1.36,   103.82], to: [35.68,  139.69] },   // Singapura → Tóquio
  { from: [1.36,   103.82], to: [-33.87, 151.21] },   // Singapura → Sydney
  { from: [35.68,  139.69], to: [-33.87, 151.21] },   // Tóquio → Sydney
];

/** Approximate land mask — multiple bounding boxes per continent */
function isLand(lat: number, lng: number): boolean {
  // North America
  if (lat >= 24 && lat <= 70 && lng >= -128 && lng <= -52) return true;
  if (lat >=  7 && lat <= 24 && lng >=  -92 && lng <= -77) return true;  // Central America
  if (lat >= 59 && lat <= 83 && lng >=  -55 && lng <= -14) return true;  // Greenland
  // South America
  if (lat >= -55 && lat <= 12 && lng >= -82 && lng <= -34) return true;
  // Europe
  if (lat >= 35 && lat <= 71 && lng >= -10 && lng <= 32) return true;
  if (lat >= 55 && lat <= 71 && lng >=  15 && lng <= 32) return true;   // Scandinavia east
  if (lat >= 36 && lat <= 42 && lng >=  28 && lng <= 37) return true;   // Turkey west
  // Africa
  if (lat >= -35 && lat <= 37 && lng >= -17 && lng <= 52) return true;
  if (lat >= -25 && lat <= -12 && lng >=  43 && lng <= 50) return true; // Madagascar
  // Middle East / Arabian Peninsula
  if (lat >= 12 && lat <= 42 && lng >= 26 && lng <= 63) return true;
  // Russia / Central Asia
  if (lat >= 48 && lat <= 77 && lng >=  26 && lng <= 180) return true;
  if (lat >= 50 && lat <= 70 && lng >= -180 && lng <= -160) return true; // far east Russia
  // South Asia
  if (lat >=  5 && lat <= 37 && lng >=  60 && lng <= 100) return true;
  // Southeast Asia mainland + islands
  if (lat >=  0 && lat <= 28 && lng >=  92 && lng <= 110) return true;
  if (lat >= -8 && lat <= 22 && lng >= 100 && lng <= 142) return true;
  // East Asia
  if (lat >= 18 && lat <= 53 && lng >= 100 && lng <= 135) return true;
  if (lat >= 30 && lat <= 46 && lng >= 129 && lng <= 146) return true;  // Japan
  // Australia + New Zealand
  if (lat >= -43 && lat <= -10 && lng >= 113 && lng <= 154) return true;
  if (lat >= -47 && lat <= -34 && lng >= 166 && lng <= 178) return true;
  return false;
}

function latLngToXYZ(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return [
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

function rotateY(x: number, y: number, z: number, angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos + z * sin, y, -x * sin + z * cos];
}

function rotateX(x: number, y: number, z: number, angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x, y * cos - z * sin, y * sin + z * cos];
}

function project(x: number, y: number, z: number, cx: number, cy: number, fov: number): [number, number, number] {
  const scale = fov / (fov + z);
  return [x * scale + cx, y * scale + cy, z];
}

function slerp(
  p1: [number, number, number],
  p2: [number, number, number],
  t: number
): [number, number, number] {
  const dot = Math.max(-1, Math.min(1, p1[0]*p2[0] + p1[1]*p2[1] + p1[2]*p2[2]));
  const omega = Math.acos(dot);
  if (Math.abs(omega) < 0.001) {
    return [p1[0] + t*(p2[0]-p1[0]), p1[1] + t*(p2[1]-p1[1]), p1[2] + t*(p2[2]-p1[2])];
  }
  const sinO = Math.sin(omega);
  const s1 = Math.sin((1 - t) * omega) / sinO;
  const s2 = Math.sin(t * omega) / sinO;
  return [s1*p1[0] + s2*p2[0], s1*p1[1] + s2*p2[1], s1*p1[2] + s2*p2[2]];
}

export function InteractiveGlobe({
  className,
  size = 600,
  dotColor = "rgba(100, 180, 255, ALPHA)",
  arcColor = "rgba(100, 180, 255, 0.5)",
  markerColor = "rgba(100, 220, 255, 1)",
  autoRotateSpeed = 0.002,
  connections = DEFAULT_CONNECTIONS,
  markers = DEFAULT_MARKERS,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotYRef = useRef(0.3);
  const rotXRef = useRef(0.15);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startRotY: number;
    startRotX: number;
    prevX: number;
    prevY: number;
  }>({ active: false, startX: 0, startY: 0, startRotY: 0, startRotX: 0, prevX: 0, prevY: 0 });
  const velYRef = useRef(0);
  const velXRef = useRef(0);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const dotsRef = useRef<[number, number, number][]>([]);

  useEffect(() => {
    const dots: [number, number, number][] = [];
    const numCandidates = 3500;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < numCandidates; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / numCandidates);
      const x = Math.cos(theta) * Math.sin(phi);
      const y = Math.cos(phi);
      const z = Math.sin(theta) * Math.sin(phi);
      // Convert back to lat/lng for land check
      const lat = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI;
      const thetaLng = Math.atan2(z, -x);
      let lng = thetaLng * 180 / Math.PI - 180;
      if (lng > 180) lng -= 360;
      if (lng < -180) lng += 360;
      // Keep land dots; keep ~6% of ocean dots for a faint ocean texture
      if (isLand(lat, lng) || Math.random() < 0.06) {
        dots.push([x, y, z]);
      }
    }
    dotsRef.current = dots;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.38;
    const fov = 600;

    if (!dragRef.current.active) {
      // Auto-rotate + inertia decay
      rotYRef.current += autoRotateSpeed + velYRef.current;
      const newRx = rotXRef.current + velXRef.current;
      rotXRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newRx));
      velYRef.current *= 0.92;
      velXRef.current *= 0.92;
      if (Math.abs(velYRef.current) < 0.00005) velYRef.current = 0;
      if (Math.abs(velXRef.current) < 0.00005) velXRef.current = 0;
    }

    timeRef.current += 0.015;
    const time = timeRef.current;

    ctx.clearRect(0, 0, w, h);

    // Outer glow
    const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.5);
    glowGrad.addColorStop(0, "rgba(60, 140, 255, 0.03)");
    glowGrad.addColorStop(1, "rgba(60, 140, 255, 0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    // Globe outline
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(100, 180, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const ry = rotYRef.current;
    const rx = rotXRef.current;

    // Dots
    for (const dot of dotsRef.current) {
      let [x, y, z] = dot;
      x *= radius; y *= radius; z *= radius;
      [x, y, z] = rotateX(x, y, z, rx);
      [x, y, z] = rotateY(x, y, z, ry);
      const [sx, sy] = project(x, y, z, cx, cy, fov);
      const depthAlpha = Math.max(0.04, (1 - z / radius) / 2);
      const dotSize = 1 + depthAlpha * 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, dotSize, 0, Math.PI * 2);
      ctx.fillStyle = dotColor.replace("ALPHA", depthAlpha.toFixed(2));
      ctx.fill();
    }

    // Arcs — great circle interpolation
    const STEPS = 48;
    for (const conn of connections) {
      const [lat1, lng1] = conn.from;
      const [lat2, lng2] = conn.to;
      const r = radius;

      const raw1 = latLngToXYZ(lat1, lng1, 1);
      const raw2 = latLngToXYZ(lat2, lng2, 1);

      const pts: [number, number, number][] = [];
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS;
        const [ux, uy, uz] = slerp(raw1, raw2, t);
        let x = ux * r, y = uy * r, z = uz * r;
        [x, y, z] = rotateX(x, y, z, rx);
        [x, y, z] = rotateY(x, y, z, ry);
        pts.push(project(x, y, z, cx, cy, fov));
      }

      const anyVisible = pts.some(([,, z]) => z <= radius * 0.3);
      if (!anyVisible) continue;

      ctx.beginPath();
      let started = false;
      for (const [sx, sy, sz] of pts) {
        if (sz > radius * 0.3) { started = false; continue; }
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Traveling dot
      const t = (Math.sin(time * 1.2 + lat1 * 0.1) + 1) / 2;
      const [ux, uy, uz] = slerp(raw1, raw2, t);
      let tx = ux * r, ty2 = uy * r, tz = uz * r;
      [tx, ty2, tz] = rotateX(tx, ty2, tz, rx);
      [tx, ty2, tz] = rotateY(tx, ty2, tz, ry);
      if (tz <= radius * 0.3) {
        const [dotX, dotY] = project(tx, ty2, tz, cx, cy, fov);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
        ctx.fillStyle = markerColor;
        ctx.fill();
      }
    }

    // Markers
    for (const marker of markers) {
      let [x, y, z] = latLngToXYZ(marker.lat, marker.lng, radius);
      [x, y, z] = rotateX(x, y, z, rx);
      [x, y, z] = rotateY(x, y, z, ry);
      if (z > radius * 0.1) continue;
      const [sx, sy] = project(x, y, z, cx, cy, fov);
      const pulse = Math.sin(time * 2 + marker.lat) * 0.5 + 0.5;
      // Outer pulse ring
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + pulse * 5, 0, Math.PI * 2);
      ctx.strokeStyle = markerColor.replace("1)", `${0.18 + pulse * 0.14})`);
      ctx.lineWidth = 1;
      ctx.stroke();
      // Core dot
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = markerColor;
      ctx.fill();
      if (marker.label) {
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillStyle = markerColor.replace("1)", "0.65)");
        ctx.fillText(marker.label, sx + 9, sy + 3);
      }
    }

    animRef.current = requestAnimationFrame(draw);
  }, [dotColor, arcColor, markerColor, autoRotateSpeed, connections, markers]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startRotY: rotYRef.current,
      startRotX: rotXRef.current,
      prevX: e.clientX,
      prevY: e.clientY,
    };
    velYRef.current = 0;
    velXRef.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newRotY = dragRef.current.startRotY - dx * 0.006;
    const newRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2,
      dragRef.current.startRotX + dy * 0.006
    ));
    // Track velocity (incremental delta, exponential smoothing)
    const dvY = -(e.clientX - dragRef.current.prevX) * 0.006;
    const dvX = (e.clientY - dragRef.current.prevY) * 0.006;
    velYRef.current = velYRef.current * 0.5 + dvY * 0.5;
    velXRef.current = velXRef.current * 0.5 + dvX * 0.5;
    dragRef.current.prevX = e.clientX;
    dragRef.current.prevY = e.clientY;
    rotYRef.current = newRotY;
    rotXRef.current = newRotX;
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
    // Velocity already set — inertia kicks in via draw loop
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full h-full cursor-grab active:cursor-grabbing touch-none", className)}
      style={{ width: size, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}
