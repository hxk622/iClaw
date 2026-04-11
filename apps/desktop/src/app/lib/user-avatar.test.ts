import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveUserAvatarUrl } from './user-avatar.ts';

test('resolveUserAvatarUrl returns bare url when no revision exists', () => {
  assert.equal(
    resolveUserAvatarUrl({
      avatar_url: 'https://cdn.example.com/avatar.png',
    }),
    'https://cdn.example.com/avatar.png',
  );
});

test('resolveUserAvatarUrl appends cache-busting revision when present', () => {
  assert.equal(
    resolveUserAvatarUrl({
      avatar_url: 'https://cdn.example.com/avatar.png',
      avatarRevision: 123,
    }),
    'https://cdn.example.com/avatar.png?v=123',
  );
});

test('resolveUserAvatarUrl appends revision with existing query params', () => {
  assert.equal(
    resolveUserAvatarUrl({
      avatar_url: 'https://cdn.example.com/avatar.png?size=small',
      avatar_revision: 'abc',
    }),
    'https://cdn.example.com/avatar.png?size=small&v=abc',
  );
});
