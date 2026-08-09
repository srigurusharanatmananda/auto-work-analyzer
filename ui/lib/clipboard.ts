'use client';

import toast from 'react-hot-toast';
import { messageFor } from './api';

/**
 * Copies text and reports the outcome.
 *
 * Five handlers across three files did this identically. The `catch` is the part
 * worth centralising: `navigator.clipboard.writeText` rejects when the document
 * is not focused or the page is not a secure context, and every one of those
 * call sites discarded the reason and showed its own generic sentence — so a
 * user on plain HTTP was told "Failed to copy report" with no hint that the
 * whole API was unavailable.
 *
 * @param label Names what was copied, e.g. "Summary". Used in both messages.
 */
export async function copyToClipboard(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`📋 ${label} copied to clipboard!`, { duration: 2000 });
  } catch (caught) {
    toast.error(messageFor(caught, `Failed to copy ${label.toLowerCase()}`));
  }
}
