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

const DEFAULT_MARKERS = [
  { lat: -23.55, lng: -46.63, label: "São Paulo" },
  { lat: 40.71,  lng: -74.01, label: "New York" },
  { lat: 34.05,  lng: -118.24, label: "Los Angeles" },
  { lat: 51.51,  lng: -0.13,  label: "London" },
  { lat: 25.20,  lng: 55.27,  label: "Dubai" },
  { lat: 19.08,  lng: 72.88,  label: "Mumbai" },
  { lat: 35.68,  lng: 139.69, label: "Tokyo" },
  { lat: -33.87, lng: 151.21, label: "Sydney" },
  { lat: -33.92, lng: 18.42,  label: "Cape Town" },
  { lat: -1.29,  lng: 36.82,  label: "Nairobi" },
];

const DEFAULT_CONNECTIONS: { from: [number, number]; to: [number, number] }[] = [
  { from: [-23.55, -46.63], to: [40.71,  -74.01] },  // SP → NY
  { from: [-23.55, -46.63], to: [51.51,  -0.13]  },  // SP → London
  { from: [-23.55, -46.63], to: [-33.92, 18.42]  },  // SP → Cape Town
  { from: [40.71,  -74.01], to: [51.51,  -0.13]  },  // NY → London
  { from: [34.05, -118.24], to: [40.71,  -74.01] },  // LA → NY
  { from: [34.05, -118.24], to: [35.68,  139.69] },  // LA → Tokyo
  { from: [51.51,  -0.13],  to: [25.20,  55.27]  },  // London → Dubai
  { from: [51.51,  -0.13],  to: [-33.92, 18.42]  },  // London → Cape Town
  { from: [25.20,  55.27],  to: [19.08,  72.88]  },  // Dubai → Mumbai
  { from: [25.20,  55.27],  to: [-1.29,  36.82]  },  // Dubai → Nairobi
  { from: [19.08,  72.88],  to: [35.68,  139.69] },  // Mumbai → Tokyo
  { from: [35.68,  139.69], to: [-33.87, 151.21] },  // Tokyo → Sydney
  { from: [-1.29,  36.82],  to: [-33.92, 18.42]  },  // Nairobi → Cape Town
];

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
  const rotYRef = useRef(0.4);
  const rotXRef = useRef(0.3);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startRotY: number;
    startRotX: number;
  }>({ active: false, startX: 0, startY: 0, startRotY: 0, startRotX: 0 });
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const dotsRef = useRef<[number, number, number][]>([]);

  useEffect(() => {
    const dots: [number, number, number][] = [];
    const numDots = 1200;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < numDots; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / numDots);
      dots.push([
        Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
      ]);
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
      rotYRef.current += autoRotateSpeed;
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
      if (z > 0) continue;
      const [sx, sy] = project(x, y, z, cx, cy, fov);
      const depthAlpha = Math.max(0.1, 1 - (z + radius) / (2 * radius));
      const dotSize = 1 + depthAlpha * 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, dotSize, 0, Math.PI * 2);
      ctx.fillStyle = dotColor.replace("ALPHA", depthAlpha.toFixed(2));
      ctx.fill();
    }

    // Arcs — great circle interpolation
    const STEPS = 40;
    for (const conn of connections) {
      const [lat1, lng1] = conn.from;
      const [lat2, lng2] = conn.to;
      const r = radius;

      // Unit vectors on sphere surface
      const raw1 = latLngToXYZ(lat1, lng1, 1);
      const raw2 = latLngToXYZ(lat2, lng2, 1);

      // Build projected points along great circle
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS;
        const [ux, uy, uz] = slerp(raw1, raw2, t);
        let x = ux * r, y = uy * r, z = uz * r;
        [x, y, z] = rotateX(x, y, z, rx);
        [x, y, z] = rotateY(x, y, z, ry);
        pts.push(project(x, y, z, cx, cy, fov));
      }

      // Only draw if at least one point is facing front
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

      // Traveling dot along great circle
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
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + pulse * 4, 0, Math.PI * 2);
      ctx.strokeStyle = markerColor.replace("1)", `${0.2 + pulse * 0.15})`);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = markerColor;
      ctx.fill();
      if (marker.label) {
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = markerColor.replace("1)", "0.6)");
        ctx.fillText(marker.label, sx + 8, sy + 3);
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
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    rotYRef.current = dragRef.current.startRotY - dx * 0.005;
    rotXRef.current = Math.max(-1, Math.min(1, dragRef.current.startRotX - dy * 0.005));
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full h-full cursor-grab active:cursor-grabbing", className)}
      style={{ width: size, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}
