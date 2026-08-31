import { useEffect, useRef } from 'react';

export default function LotusDepthScene() {
  const sceneRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (reduceMotion || coarsePointer) return undefined;

    let frame = 0;
    const move = event => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        scene.style.setProperty('--lotus-x', x.toFixed(3));
        scene.style.setProperty('--lotus-y', y.toFixed(3));
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  return (
    <div ref={sceneRef} className="lotus-depth-scene" aria-hidden="true">
      <div className="lotus-depth-scene__glow lotus-depth-scene__glow--rose" />
      <div className="lotus-depth-scene__glow lotus-depth-scene__glow--jade" />
      <div className="lotus-depth-scene__leaf lotus-depth-scene__leaf--back" />
      <img className="lotus-depth-scene__art" src={`${import.meta.env.BASE_URL}lotus-watercolor.webp`} alt="" />
      <div className="lotus-depth-scene__leaf lotus-depth-scene__leaf--front" />
    </div>
  );
}
