import { useEffect, useState } from 'react';

/**
 * Follow a CSS media query from JavaScript.
 *
 * Most of the responsive work belongs in the stylesheet, but the cards carry
 * their dimensions in props (they draw pips at a size derived from the width),
 * so the one thing that genuinely has to know the viewport is the card scale.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Phone-sized: the table has to give up card size to fit. */
export function useIsNarrow(): boolean {
  return useMediaQuery('(max-width: 640px)');
}

/** No room for the chat beside the table, so it becomes a drawer. */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 900px)');
}
