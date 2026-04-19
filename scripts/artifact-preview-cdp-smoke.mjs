#!/usr/bin/env node

import assert from 'node:assert/strict';

import { evalJSON, insertText, screenshot, waitFor } from '../tests/shared/cdp/cdp-helpers.mjs';
import {
  activeSurfaceExpression,
  authenticateDesktopPage,
  openDesktopPage,
  readActiveChatState,
  waitForChatComposer,
  waitForInteractiveChatComposer,
} from '../tests/shared/iclaw-app-helpers.mjs';

const PROMPT =
  process.env.ICLAW_ARTIFACT_PREVIEW_PROMPT ||
  '请读取并概览 artifact-preview-self-test/artifact-preview-self-test.pdf，并给出一句简短说明。';
const THREAD_SCREENSHOT =
  process.env.ICLAW_ARTIFACT_PREVIEW_THREAD_SCREENSHOT || '/tmp/iclaw-artifact-preview-thread.png';
const PANE_SCREENSHOT =
  process.env.ICLAW_ARTIFACT_PREVIEW_PANE_SCREENSHOT || '/tmp/iclaw-artifact-preview-pane.png';

async function main() {
  const page = await openDesktopPage();

  try {
    await authenticateDesktopPage(page);
    await waitForChatComposer(page.cdp);
    await waitForInteractiveChatComposer(page.cdp);

    const runtimeInfo = await evalJSON(
      page.cdp,
      `(() => ({
        tauriRuntime: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
        location: window.location.href,
      }))()`,
    );

    const before = await readActiveChatState(page.cdp);

    await evalJSON(
      page.cdp,
      activeSurfaceExpression(`
        const editor = activeWrapper?.querySelector('.iclaw-composer__editor');
        if (!(editor instanceof HTMLElement)) {
          return false;
        }
        editor.focus();
        return true;
      `),
    );
    await insertText(page.cdp, PROMPT);

    await waitFor(
      'prompt inserted into composer',
      async () => {
        const state = await readActiveChatState(page.cdp);
        return state.bodyText.includes(PROMPT.slice(0, 12)) || state.submitDisabled === false ? state : null;
      },
      10_000,
      300,
    );

    await evalJSON(
      page.cdp,
      activeSurfaceExpression(`
        const submit = activeWrapper?.querySelector('.iclaw-composer__submit');
        if (!(submit instanceof HTMLButtonElement)) {
          return false;
        }
        submit.click();
        return true;
      `),
    );

    const artifactCardState = await waitFor(
      'artifact card appears in active chat thread',
      async () =>
        evalJSON(
          page.cdp,
          activeSurfaceExpression(`
            const cards = Array.from(activeWrapper?.querySelectorAll('.chat-tool-card--clickable') || [])
              .filter((node) => node instanceof HTMLElement && node.dataset.iclawToolCard === 'artifact');
            const card = cards.find((node) => {
              const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
              return text.includes('.pdf') || text.includes('artifact-preview-self-test');
            }) || cards.at(-1) || null;
            if (!(card instanceof HTMLElement)) {
              return null;
            }
            const rect = card.getBoundingClientRect();
            return {
              title: card.querySelector('.chat-tool-card__title')?.textContent?.trim() || null,
              detail: card.querySelector('.chat-tool-card__detail')?.textContent?.trim() || null,
              rect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
            };
          `),
        ),
      90_000,
      1_000,
    );

    const threadScreenshot = await screenshot(page.cdp, THREAD_SCREENSHOT);

    const clicked = await evalJSON(
      page.cdp,
      activeSurfaceExpression(`
        const cards = Array.from(activeWrapper?.querySelectorAll('.chat-tool-card--clickable') || [])
          .filter((node) => node instanceof HTMLElement && node.dataset.iclawToolCard === 'artifact');
        const card = cards.find((node) => {
          const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
          return text.includes('.pdf') || text.includes('artifact-preview-self-test');
        }) || cards.at(-1) || null;
        if (!(card instanceof HTMLElement)) {
          return false;
        }
        card.click();
        return true;
      `),
    );
    assert.equal(clicked, true, 'failed to click artifact card');

    const previewState = await waitFor(
      'artifact preview pane reaches a terminal state',
      async () =>
        evalJSON(
          page.cdp,
          `(() => {
            const pane = document.querySelector('.iclaw-artifact-preview-pane');
            if (!(pane instanceof HTMLElement)) {
              return null;
            }
            const title = pane.querySelector('.iclaw-artifact-preview-pane__title')?.textContent?.trim() || null;
            const path = pane.querySelector('.iclaw-artifact-preview-pane__path')?.textContent?.trim() || null;
            const loading = Boolean(pane.querySelector('.iclaw-artifact-preview-pane__state--loading'));
            const hasPdfFrame = Boolean(pane.querySelector('.iclaw-artifact-preview-pane__pdf-shell iframe'));
            const hasErrorState = Boolean(pane.querySelector('.iclaw-artifact-preview-pane__state--error'));
            const hasOfficeState = Boolean(pane.querySelector('.iclaw-artifact-preview-pane__state--office'));
            const hasMarkdownState = Boolean(pane.querySelector('.iclaw-artifact-preview-pane__markdown-shell'));
            const hasTextState = Boolean(pane.querySelector('.iclaw-artifact-preview-pane__text-shell'));
            const hasHeaderAction = Boolean(pane.querySelector('.iclaw-artifact-preview-pane__open-button'));
            return title && !loading && (hasPdfFrame || hasErrorState || hasOfficeState || hasMarkdownState || hasTextState)
              ? { title, path, loading, hasPdfFrame, hasErrorState, hasOfficeState, hasMarkdownState, hasTextState, hasHeaderAction }
              : null;
          })()`,
        ),
      30_000,
      500,
    );

    const paneScreenshot = await screenshot(page.cdp, PANE_SCREENSHOT);

    console.log(
      JSON.stringify(
        {
          ok: true,
          runtimeInfo,
          prompt: PROMPT,
          before,
          artifactCardState,
          previewState,
          screenshots: {
            thread: threadScreenshot,
            pane: paneScreenshot,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
