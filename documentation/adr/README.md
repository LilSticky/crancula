# Architecture Decision Records

Decisions are recorded in [Michael Nygard's format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
(see [ADR 1](0001-record-architecture-decisions.md)). Never edit an accepted ADR; supersede it
with a new one and update both statuses here.

| # | Title | Status |
|---|-------|--------|
| 1 | [Record architecture decisions](0001-record-architecture-decisions.md) | Accepted |
| 2 | [Framework-free domain with adapters](0002-framework-free-domain.md) | Accepted |
| 3 | [In-memory state as source of truth, snapshots on disk](0003-memory-first-snapshots.md) | Accepted |
| 4 | [Strict Electron process boundary](0004-strict-electron-boundary.md) | Accepted |
| 5 | [MIDI in and SVG out first](0005-midi-in-svg-out-first.md) | Accepted |
| 6 | [Autonomous slices on branches, squash-merged](0006-autonomous-slices-squash-merge.md) | Superseded by 10 |
| 7 | [Node Vitest for the domain and the main process](0007-node-vitest-for-domain-and-main.md) | Accepted |
| 8 | [Snapshot write strategy](0008-snapshot-write-strategy.md) | Accepted |
| 9 | [Angular specs run in jsdom](0009-angular-specs-in-jsdom.md) | Accepted |
| 10 | [Merge through pull requests that reference issues](0010-merge-through-pull-requests.md) | Accepted |
| 11 | [UI preferences in localStorage](0011-ui-preferences-in-local-storage.md) | Accepted |
| 12 | [Bundle the Electron main process and preload](0012-bundle-electron-main-and-preload.md) | Accepted |
| 13 | [End-to-end tests in CI replace the manual walkthrough](0013-e2e-in-ci-replaces-manual-walkthrough.md) | Accepted |
| 14 | [Stay on current major versions with Dependabot](0014-current-major-versions-with-dependabot.md) | Accepted |
| 15 | [Issue triage with the Claude GitHub Action](0015-issue-triage-with-claude-action.md) | Accepted |
| 16 | [Dependabot pull requests merge themselves](0016-dependabot-pull-requests-merge-themselves.md) | Accepted |
