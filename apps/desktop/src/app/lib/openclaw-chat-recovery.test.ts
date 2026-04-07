import test from 'node:test';
import assert from 'node:assert/strict';

import {
  looksLikeOpenClawCompatibilityIssue,
  looksLikeOpenClawTransportIssue,
  resolveOpenClawChatRecoveryAction,
} from './openclaw-chat-recovery.ts';

test('looksLikeOpenClawTransportIssue matches websocket disconnect signals', () => {
  assert.equal(looksLikeOpenClawTransportIssue('Gateway websocket closed by peer'), true);
  assert.equal(looksLikeOpenClawTransportIssue('transport error while reading ws frame'), true);
  assert.equal(looksLikeOpenClawTransportIssue('unknown method: sessions.subscribe'), false);
});

test('looksLikeOpenClawCompatibilityIssue matches unsupported rpc signals', () => {
  assert.equal(looksLikeOpenClawCompatibilityIssue('unknown method: sessions.subscribe'), true);
  assert.equal(looksLikeOpenClawCompatibilityIssue('RPC unsupported on this runtime'), true);
  assert.equal(looksLikeOpenClawCompatibilityIssue('method not found'), true);
  assert.equal(looksLikeOpenClawCompatibilityIssue('gateway websocket closed'), false);
});

test('resolveOpenClawChatRecoveryAction escalates transport and compatibility recovery sanely', () => {
  assert.equal(resolveOpenClawChatRecoveryAction({attempt: 0, cause: 'transport'}), 'reconnect');
  assert.equal(resolveOpenClawChatRecoveryAction({attempt: 3, cause: 'transport'}), 'reconnect');
  assert.equal(resolveOpenClawChatRecoveryAction({attempt: 4, cause: 'transport'}), 'none');

  assert.equal(resolveOpenClawChatRecoveryAction({attempt: 0, cause: 'compatibility'}), 'reset-embedded');
  assert.equal(resolveOpenClawChatRecoveryAction({attempt: 1, cause: 'compatibility'}), 'reset-embedded');
  assert.equal(resolveOpenClawChatRecoveryAction({attempt: 2, cause: 'compatibility'}), 'force-reveal');

  assert.equal(resolveOpenClawChatRecoveryAction({attempt: 0, cause: 'render-stuck'}), 'reset-embedded');
  assert.equal(resolveOpenClawChatRecoveryAction({attempt: 1, cause: 'render-stuck'}), 'force-reveal');
});
