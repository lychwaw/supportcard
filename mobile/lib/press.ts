import type { ViewStyle } from 'react-native';

/**
 * Press feedback.
 *
 * A control that doesn't acknowledge the finger until its action completes
 * reads as broken, even when it isn't — the gap between touch and response is
 * where an interface stops feeling like an object and starts feeling like a
 * form being submitted. Feedback belongs on press-down, not on release.
 *
 * These wrap the two conventions already dominant in this codebase (a 0.97
 * scale on surfaces, a fade on icon buttons) so new controls inherit them
 * instead of each picking a slightly different number — there were seven
 * different scale values and six different opacities before this existed.
 *
 *   <Pressable style={pressScale({ padding: 16, borderRadius: 14 })} />
 *   <Pressable style={pressFade({ padding: 4 })} />
 */

type Base = ViewStyle | undefined;

/** Surfaces you push: cards, rows, primary buttons. */
export const pressScale = (base?: Base) =>
  ({ pressed }: { pressed: boolean }): ViewStyle => ({
    ...base,
    transform: [{ scale: pressed ? 0.97 : 1 }],
  });

/** Things too small to scale convincingly: icon buttons, text links, chevrons. */
export const pressFade = (base?: Base) =>
  ({ pressed }: { pressed: boolean }): ViewStyle => ({
    ...base,
    opacity: pressed ? 0.55 : 1,
  });

/** Both, for large tappable cards where the scale alone is easy to miss. */
export const pressCard = (base?: Base) =>
  ({ pressed }: { pressed: boolean }): ViewStyle => ({
    ...base,
    opacity: pressed ? 0.9 : 1,
    transform: [{ scale: pressed ? 0.98 : 1 }],
  });
