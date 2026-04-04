import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveInitialPrimaryView, resolveRequestedPrimaryViewFromUrl } from './chat-navigation-resolution.ts';

test('resolveRequestedPrimaryViewFromUrl forces chat for explicit /chat entry', () => {
  assert.equal(resolveRequestedPrimaryViewFromUrl('http://127.0.0.1:1520/chat?session=main'), 'chat');
  assert.equal(resolveRequestedPrimaryViewFromUrl('http://127.0.0.1:1520/cron'), null);
});

test('resolveInitialPrimaryView prefers explicit chat url over persisted non-chat scene', () => {
  assert.equal(
    resolveInitialPrimaryView({
      persistedPrimaryView: 'cron',
      fallbackPrimaryView: 'chat',
      availablePrimaryViews: ['chat', 'cron', 'task-center'],
      location: 'http://127.0.0.1:1520/chat?session=main',
    }),
    'chat',
  );
});

test('resolveInitialPrimaryView restores persisted supported view when url does not override it', () => {
  assert.equal(
    resolveInitialPrimaryView({
      persistedPrimaryView: 'task-center',
      fallbackPrimaryView: 'chat',
      availablePrimaryViews: ['chat', 'cron', 'task-center'],
      location: 'http://127.0.0.1:1520/',
    }),
    'task-center',
  );
});

test('resolveInitialPrimaryView falls back when persisted view is unsupported', () => {
  assert.equal(
    resolveInitialPrimaryView({
      persistedPrimaryView: 'unknown',
      fallbackPrimaryView: 'chat',
      availablePrimaryViews: ['chat', 'cron', 'task-center'],
      location: 'http://127.0.0.1:1520/',
    }),
    'chat',
  );
});
