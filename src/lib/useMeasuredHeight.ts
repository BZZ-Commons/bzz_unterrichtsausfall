import { useCallback, useState } from 'react';

/**
 * Tracks the rendered (border-box) height of an element via ResizeObserver.
 *
 * Returns a callback ref to attach to the element and its current height in px
 * (0 until first measured). The height updates on every resize — including
 * responsive reflows and content changes — which makes it suitable for stacking
 * a second `sticky` element directly beneath a sticky header of variable height.
 */
export function useMeasuredHeight(): [(node: HTMLElement | null) => void, number] {
  const [height, setHeight] = useState(0);

  // React 19 callback ref: returning a cleanup disconnects the observer on unmount.
  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    // Synchronous first read so the height is correct on initial paint.
    setHeight(node.getBoundingClientRect().height);
    // Subsequent reads come straight off the entry — no extra layout read.
    const observer = new ResizeObserver(([entry]) => {
      const borderBox = entry?.borderBoxSize?.[0];
      setHeight(borderBox ? borderBox.blockSize : node.getBoundingClientRect().height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, height];
}
