import test from 'node:test';
import assert from 'node:assert/strict';

import { buildArtifactWorkspaceNameCandidates } from './artifact-workspace-path.ts';

test('buildArtifactWorkspaceNameCandidates strips workspace prefix from absolute openclaw paths', () => {
  const candidates = buildArtifactWorkspaceNameCandidates(
    '~/.openclaw/apps/caiclaw/workspace/skills/A股数据工具包/SKILL.md',
    '/Users/xingkaihan/.openclaw/apps/caiclaw/workspace',
  );

  assert.deepEqual(
    candidates.slice(0, 3),
    [
      'skills/A股数据工具包/SKILL.md',
      '.openclaw/apps/caiclaw/workspace/skills/A股数据工具包/SKILL.md',
      '~/.openclaw/apps/caiclaw/workspace/skills/A股数据工具包/SKILL.md',
    ],
  );
});

test('buildArtifactWorkspaceNameCandidates keeps relative workspace paths usable', () => {
  const candidates = buildArtifactWorkspaceNameCandidates(
    './skills/us-data/SKILL.md',
    '/Users/xingkaihan/.openclaw/apps/caiclaw/workspace',
  );

  assert.equal(candidates[0], 'skills/us-data/SKILL.md');
});
