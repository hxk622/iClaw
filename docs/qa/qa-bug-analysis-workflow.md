# QA Bug Analysis Workflow

## 1. Purpose

This workflow standardizes how QA submits a bug screenshot and how Codex analyzes the issue against the current codebase in `C:\hexun\code\iClaw`.

The goal is not only to rewrite the observed symptom, but to:

- map the issue to the likely module and code path
- distinguish symptom from root-cause class
- produce a stable bug report output
- assign a consistent priority level

## 2. Scope

This workflow is intended for:

- desktop UI bugs
- chat interaction bugs
- startup / auth / runtime bootstrap bugs
- rendering bugs
- state synchronization bugs
- configuration-driven behavior bugs
- interaction regressions discovered during QA

This workflow is not intended for:

- pure product requirement discussions without a defect symptom
- performance benchmarking reports without a concrete bug symptom
- security disclosures that require a separate incident process
- backend-only data correctness investigations without any user-visible bug entry point

## 3. QA Input Requirements

When QA requests a bug analysis, provide as much of the following as possible.

Required:

- project path
- screenshot or screenshots
- observed symptom

Recommended:

- reproduction steps
- actual result
- expected result
- reproduction frequency
- affected page or module if known
- whether the issue blocks further operation

Use this template:

```text
Project: C:\hexun\code\iClaw
Observed symptom: <one-sentence summary>
Steps to reproduce:
1. ...
2. ...
3. ...

Actual result: ...
Expected result: ...
Repro frequency: always / often / sometimes / once
Blocking impact: yes / no
Notes: ...
```

If only screenshots are available, QA may use the short form:

```text
Analyze this bug from the screenshot against C:\hexun\code\iClaw.
Observed symptom: ...
```

## 4. Codex Execution Rules

When this workflow is triggered, Codex must:

1. Treat the current repository as the primary source of truth.
2. Start from the visible symptom in the screenshot and infer the likely module.
3. Search the codebase for:
   - matching UI copy
   - related component names
   - state variables
   - event listeners
   - persistence / runtime / gateway / startup logic
4. Analyze whether the issue is primarily:
   - rendering
   - state management
   - startup gating
   - async timing
   - path resolution
   - visibility / minimize / restore lifecycle
   - API / runtime integration
   - configuration mismatch
5. Prefer concrete file-backed reasoning over generic guesses.
6. Distinguish carefully between:
   - user-visible symptom
   - likely cause category
   - direct code trigger
   - unverified hypothesis
7. If the code strongly suggests multiple possible causes, say so explicitly and identify the leading one.
8. Do not propose code fixes unless the QA request explicitly asks for a fix.
9. End with a structured bug report output.

## 5. Standard Analysis Steps

Codex should follow this sequence:

1. Identify the user-visible symptom from the screenshot and QA text.
2. Locate the related screen, component, or state card in the repository.
3. Locate the state machine or async chain behind that screen.
4. Determine whether the bug is:
   - false error state
   - stale loading state
   - masked content
   - missing render hydration
   - lost subscription / event stream
   - blocked UI due to overlay / mask / transition gate
   - permanent failure
   - transient failure shown as terminal failure
5. Estimate impact:
   - cosmetic only
   - degraded workflow
   - current feature blocked
   - current page blocked
   - app-wide blocked
6. Assign priority according to the rules in Section 6.
7. Produce the final bug output according to Section 7.

## 6. Priority Rules

Priority must be assigned by actual impact, not by wording severity in the UI.

### P0

Use `P0` when the bug causes any of the following:

- app-wide freeze, hang, or unusable state
- core user path fully blocked with no practical self-recovery
- startup cannot proceed for most users
- data corruption or severe cross-user / cross-session leakage
- user cannot continue operation except by force quitting or restarting

Typical examples:

- entire desktop surface becomes unclickable
- chat page freezes and sidebar / navigation also stop working
- login or startup path hard-blocks the entire app

### P1

Use `P1` when:

- a core feature is blocked or badly broken
- the current task cannot continue normally
- the bug is high-frequency or stable
- recovery is possible only by switching context, retrying, or restarting later

Typical examples:

- chat cannot continue but the rest of the app still works
- repeated false startup failure page, but app eventually recovers
- artifact preview or core panel fails in a main workflow

### P2

Use `P2` when:

- the feature still works with a workaround
- impact is limited to one module or one edge workflow
- there is visible user friction but not a hard block

Typical examples:

- a panel fails to preview one kind of content
- one save path is inconsistent but retry works
- one section shows stale data until refresh

### P3

Use `P3` when:

- the issue is cosmetic or low-impact
- wording, style, layout, or minor interaction is wrong
- user can complete the task without meaningful obstruction

Typical examples:

- wrong placeholder copy
- alignment issue
- non-blocking visual glitch

## 7. Required Output Format

Every workflow run must end with the following sections in this order.

### 7.1 Conclusion

One short paragraph stating what class of bug this appears to be.

### 7.2 Priority

Output:

```text
Bug Priority: P0 / P1 / P2 / P3
```

Follow with one concise reason.

### 7.3 Bug Title

One line suitable for Jira / Tapd / ZenTao.

### 7.4 Bug Description

Write a formal defect description that includes:

- trigger condition
- actual result
- expected result
- user impact

### 7.5 Code Analysis

Include:

- key files
- important state or condition checks
- why the observed symptom can happen in the current implementation

Prefer file references when possible.

## 8. Recommended Output Template

Use this template:

```text
Conclusion
<short conclusion>

Bug Priority: Px
<reason>

Bug Title
<title>

Bug Description
<formal description>

Code Analysis
1. ...
2. ...
3. ...
```

## 9. Confidence Guidance

If the root cause is strongly supported by code, say it directly.

If the root cause is only partially supported, use wording such as:

- "most likely"
- "leading cause appears to be"
- "code strongly suggests"

Do not present speculation as confirmed fact.

## 10. Screenshot Handling Guidance

When analyzing screenshots, Codex should pay attention to:

- exact UI copy
- loading / error / empty / disabled state wording
- whether the page is blocked by a mask, overlay, or modal
- whether the bug is local to one panel or global to the whole surface
- whether the symptom suggests missing content, stale content, or blocked interaction

If multiple screenshots are provided, compare them in chronological order if possible.

## 11. Project-Specific Guidance for iClaw

For this repository, prioritize these locations when the symptom appears in desktop chat or startup flows:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/app/components/OpenClawChatSurface.tsx`
- `apps/desktop/src/app/components/FirstRunSetupPanel.tsx`
- `apps/desktop/src/app/lib/startup-gate.ts`
- `apps/desktop/src/app/lib/tauri-runtime-config.ts`
- `apps/desktop/src-tauri/src/main.rs`

Follow repository guardrails:

- do not assume OpenClaw kernel is the first place to change
- first inspect wrapper / integration layers around OpenClaw
- distinguish frontend origin `1520`, control-plane backend `2130`, and local runtime `2126`

## 12. Example Trigger

Example QA request:

```text
Analyze this bug from the screenshot against C:\hexun\code\iClaw.
Observed symptom: During smart chat, after minimizing and restoring the window, the page stays in "outputting" state and becomes unclickable.
Actual result: Message stops rendering and the sidebar also cannot be clicked.
Expected result: Chat should continue rendering and the page should remain interactive.
Repro frequency: often
Blocking impact: yes
```

Expected response shape:

- conclude whether this is a render / state-sync / startup / runtime integration bug
- assign `P0` to `P3`
- provide one final title
- provide one final bug description
- explain the most relevant code path

## 13. Acceptance Standard

This workflow is working as intended when:

- two similar bugs receive similar priority judgments
- the output consistently separates symptom from cause
- the bug title is directly usable in a tracking system
- the bug description is formal enough for engineering handoff
- the analysis references real repository files instead of generic assumptions
