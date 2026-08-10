import { useEffect, useRef } from 'react';

const MAX_RIPPLES = 34;

export default function WaterRippleBackdrop() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let lastTime = performance.now();
    let rainTimer = 0;
    let lastPointer = { x: -100, y: -100 };
    const ripples = [];
    const drops = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const addRipple = (x, y, strength = 1, tone = 'leaf') => {
      ripples.push({ x, y, radius: 2, life: 1, speed: 25 + strength * 19, strength, tone });
      if (ripples.length > MAX_RIPPLES) ripples.splice(0, ripples.length - MAX_RIPPLES);
    };

    const addRainDrop = () => {
      const x = width * (0.04 + Math.random() * 0.92);
      const targetY = height * (0.12 + Math.random() * 0.78);
      drops.push({ x, y: targetY - 20 - Math.random() * 28, targetY, life: 1 });
    };

    const onPointerMove = event => {
      if (coarsePointer) return;
      const distance = Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
      if (distance < 42) return;
      lastPointer = { x: event.clientX, y: event.clientY };
      addRipple(event.clientX, event.clientY, 0.48, 'lotus');
    };

    const onPointerDown = event => {
      addRipple(event.clientX, event.clientY, 1.12, 'lotus');
      setTimeout(() => addRipple(event.clientX, event.clientY, 0.82, 'leaf'), 110);
      setTimeout(() => addRipple(event.clientX, event.clientY, 0.56, 'lotus'), 220);
    };

    const drawRipple = ripple => {
      const alpha = Math.max(0, ripple.life) * (0.12 + ripple.strength * 0.08);
      const color = ripple.tone === 'lotus' ? `rgba(198, 102, 128, ${alpha})` : `rgba(73, 128, 91, ${alpha})`;
      context.save();
      context.translate(ripple.x, ripple.y);
      context.scale(1, 0.48);
      context.beginPath();
      context.arc(0, 0, ripple.radius, 0, Math.PI * 2);
      context.strokeStyle = color;
      context.lineWidth = 1.05 + ripple.life * 0.55;
      context.stroke();
      context.restore();
    };

    const render = now => {
      const delta = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;
      context.clearRect(0, 0, width, height);

      rainTimer += delta;
      if (rainTimer > 0.34 + Math.random() * 0.28) {
        rainTimer = 0;
        addRainDrop();
      }

      for (let index = drops.length - 1; index >= 0; index -= 1) {
        const drop = drops[index];
        drop.y += 250 * delta;
        drop.life -= delta * 1.7;
        context.beginPath();
        context.moveTo(drop.x, drop.y - 9);
        context.lineTo(drop.x - 1.5, drop.y);
        context.strokeStyle = `rgba(83, 130, 99, ${Math.max(0, drop.life) * 0.13})`;
        context.lineWidth = 1;
        context.stroke();
        if (drop.y >= drop.targetY || drop.life <= 0) {
          addRipple(drop.x, drop.targetY, 0.55 + Math.random() * 0.35, Math.random() > 0.65 ? 'lotus' : 'leaf');
          drops.splice(index, 1);
        }
      }

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        ripple.radius += ripple.speed * delta;
        ripple.life -= delta * (0.42 + ripple.strength * 0.07);
        drawRipple(ripple);
        if (ripple.life <= 0) ripples.splice(index, 1);
      }

      if (!document.hidden) animationFrame = requestAnimationFrame(render);
    };

    const onVisibility = () => {
      if (!document.hidden && !animationFrame && !reduceMotion) {
        lastTime = performance.now();
        animationFrame = requestAnimationFrame(render);
      } else if (document.hidden) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    };

    resize();
    if (!reduceMotion) animationFrame = requestAnimationFrame(render);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 z-40 pointer-events-none opacity-90" />;
}
