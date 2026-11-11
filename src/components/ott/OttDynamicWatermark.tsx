/**
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.2C: Dynamic Visible Watermarking Engine (Canvas Overlay)
 * 
 * Strict Architectural Invariants:
 * 1. Deterrence & Attribution: Dynamic visible overlay to identify content leaks, NOT media DRM.
 * 2. Privacy & Security: Renders strictly pseudonymous identifiers (WM-..., session hash, UTC clock).
 *    Never renders raw user account credentials, communications, JWT, HMAC secret, or storage URLs.
 * 3. Dynamic Movement: Translates across safe screen zones every interval to prevent static cropping.
 * 4. Safe Zones: Explicitly reserves bottom 25% for timeline scrubber controls and subtitle tracks.
 * 5. Retina / HiDPI Crispness: Device Pixel Ratio (DPR) scaled canvas with clean text shadow.
 * 6. Zero Memory Leak: Thoroughly cleans up animation frames, interval timers, and ResizeObservers on unmount.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface DynamicWatermarkProps {
  viewerPseudonym: string;
  sessionShortId: string;
  aspectRatio?: '16:9' | '9:16';
  intervalSeconds?: number;
  isActive?: boolean;
}

interface WatermarkPosition {
  x: number; // percentage (0 to 1)
  y: number; // percentage (0 to 1)
  opacity: number;
}

// 6 Safe grid zones avoiding bottom controls & subtitles (bottom 25%)
const SAFE_ZONES: Array<{ x: number; y: number }> = [
  { x: 0.08, y: 0.15 }, // Top-Left
  { x: 0.60, y: 0.15 }, // Top-Right
  { x: 0.10, y: 0.42 }, // Mid-Left
  { x: 0.58, y: 0.42 }, // Mid-Right
  { x: 0.32, y: 0.25 }, // Upper-Center
  { x: 0.25, y: 0.62 }, // Lower-Center (above controls/subtitles)
];

export const OttDynamicWatermark: React.FC<DynamicWatermarkProps> = ({
  viewerPseudonym,
  sessionShortId,
  aspectRatio = '16:9',
  intervalSeconds = 12,
  isActive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const positionTimerRef = useRef<any>(null);
  const clockTimerRef = useRef<any>(null);

  // Current and target position for smooth transition
  const currentPosRef = useRef<WatermarkPosition>({ x: 0.08, y: 0.15, opacity: 0.32 });
  const targetPosRef = useRef<WatermarkPosition>({ x: 0.08, y: 0.15, opacity: 0.32 });
  const [currentUtcClock, setCurrentUtcClock] = useState<string>(() =>
    new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  );

  const isVertical = aspectRatio === '9:16';

  // ---------------------------------------------------------------------------
  // 1. Shift Target Position Periodically
  // ---------------------------------------------------------------------------
  const selectNextSafePosition = useCallback(() => {
    // Pick a random zone different from current
    const availableZones = SAFE_ZONES;
    const randomIndex = Math.floor(Math.random() * availableZones.length);
    const selectedZone = availableZones[randomIndex];

    // Subtle random opacity variation between 0.24 and 0.40
    const randomOpacity = 0.24 + Math.random() * 0.16;

    targetPosRef.current = {
      x: selectedZone.x,
      y: selectedZone.y,
      opacity: randomOpacity,
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Clock Interval (updates timestamp string every second)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive) return;

    clockTimerRef.current = setInterval(() => {
      setCurrentUtcClock(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    }, 1000);

    return () => {
      if (clockTimerRef.current) clearInterval(clockTimerRef.current);
    };
  }, [isActive]);

  // ---------------------------------------------------------------------------
  // 3. Movement Interval (triggers position shift every intervalSeconds)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive) return;

    // Initial shift
    selectNextSafePosition();

    positionTimerRef.current = setInterval(() => {
      selectNextSafePosition();
    }, intervalSeconds * 1000);

    return () => {
      if (positionTimerRef.current) clearInterval(positionTimerRef.current);
    };
  }, [intervalSeconds, isActive, selectNextSafePosition]);

  // ---------------------------------------------------------------------------
  // 4. Canvas Render Loop with Device Pixel Ratio (DPR) Scaling
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    // Resize observer to keep canvas in exact sync with video bounds
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const dpr = window.devicePixelRatio || 1;
          canvas.width = Math.floor(width * dpr);
          canvas.height = Math.floor(height * dpr);
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const render = () => {
      if (!isRunning) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isActive || width <= 0 || height <= 0) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Smooth interpolation (lerp) toward target position & opacity
      const cur = currentPosRef.current;
      const tgt = targetPosRef.current;
      cur.x += (tgt.x - cur.x) * 0.05;
      cur.y += (tgt.y - cur.y) * 0.05;
      cur.opacity += (tgt.opacity - cur.opacity) * 0.05;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Safe Coordinates
      const posX = cur.x * width;
      const posY = cur.y * height;

      // Font styling (smaller on 9:16 vertical)
      const fontSize = isVertical ? Math.max(9, Math.floor(width * 0.028)) : Math.max(10, Math.floor(width * 0.014));
      const lineHeight = fontSize + 4;

      ctx.font = `600 ${fontSize}px "Courier New", Courier, monospace`;
      ctx.textBaseline = 'top';

      // High-contrast drop shadow for legibility against both white & dark frames
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Dual-line watermark format
      const line1 = `[AMF-SEC] ID: ${viewerPseudonym}`;
      const line2 = `SES: ${sessionShortId} • ${currentUtcClock}`;

      // Watermark semi-transparent fill
      ctx.fillStyle = `rgba(255, 255, 255, ${cur.opacity.toFixed(3)})`;
      ctx.fillText(line1, posX, posY);
      ctx.fillText(line2, posX, posY + lineHeight);

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      // Clear canvas on teardown
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [isActive, isVertical, viewerPseudonym, sessionShortId, currentUtcClock]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="ott-dynamic-watermark"
      className="absolute inset-0 pointer-events-none z-15 w-full h-full"
    />
  );
};
