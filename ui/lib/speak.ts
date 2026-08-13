import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import type { LearnLanguage } from '@/types';

/**
 * Speaks `text` via `POST /api/learn/speak` and plays the result. Shared by
 * `learn/page.tsx` (per-lesson audio) and `learn/chanting/page.tsx`
 * (per-phrase/per-verse audio) — same backend route, same error handling,
 * one place to fix rather than two independently-drifting copies.
 *
 * Callers own their own loading-state flag around this call (each page's
 * own `audioLoading`) since that's UI presentation, not shared behavior.
 * A 503 or non-JSON/JSON-error response is toasted here directly, so a
 * caller's own catch block only needs to handle a genuinely thrown error
 * (a network failure, or `audio.play()` rejecting) — matching what both
 * pages already did before this was extracted.
 */
export async function speakLearnText(language: LearnLanguage, text: string): Promise<void> {
  // Not `api.post` — that unwraps the `{success, data}` JSON envelope, and
  // this route returns raw audio bytes. `rawRequest` gets the same
  // Authorization header and 401-refresh-and-retry as every other call
  // without reimplementing either.
  const response = await api.rawRequest('/learn/speak', {
    method: 'POST',
    body: { language, text },
  });

  if (!response.ok) {
    if (response.status === 503) {
      toast.error("Text-to-speech isn't set up yet");
      return;
    }

    let message = 'Failed to play audio';
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      // Not JSON — fall back to the generic message.
    }
    toast.error(message);
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
}
