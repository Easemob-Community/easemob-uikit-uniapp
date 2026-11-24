# Demo Local Login Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the supplied login values in an ignored Demo-local file and use them for another HarmonyOS device login.

**Architecture:** A Node-only reader loads ignored JSON at Vite startup and writes a real ignored TypeScript module. A pure TypeScript resolver merges device storage over those defaults for the existing login page. The physical module is required because HarmonyOS `[plugin:uts]` neither replaces the attempted global `define` nor resolves Vite virtual modules; its basename must differ from the JSON source to avoid resolver ambiguity.

**Tech Stack:** Node `node:test`, TypeScript, Vite config, uni-app x.

**Spec:** `docs/superpowers/specs/2026-11-24-demo-local-login-config-design.md`

## Global Constraints

- Real appKey/token values only enter ignored `local.credentials.*` files.
- No new runtime dependency; storage and successful login behavior remain unchanged.
- Existing workspace modifications must not be overwritten.

## Review Focus

- Missing local JSON must produce empty defaults; test the reader with a nonexistent path.
- Existing device credentials must win over generated defaults; test every field.
- Partial local JSON must not produce `undefined`; test normalization with empty and missing fields.
- The generated file must be directly importable; test it with a fake configuration.
- Credential-bearing JSON and TS files must stay absent from `git status`.
- Login success must be verified on the physical device, not inferred from a build.

---

### Task 1: Local configuration reader, module generator, and login default resolver

**Files:**
- Create: `demo/build/local-login-config.mjs`
- Create: `demo/common/login-config.ts`
- Create: `scripts/test-demo-login-config.mjs`

**Interfaces:**
- Produces: `readLocalLoginConfig(filePath: string): { appkey: string, userId: string, token: string }`.
- Produces: `writeLocalLoginConfigModule(filePath: string, config): void`.
- Produces: `resolveDemoLoginConfig(stored, defaults)` with the same string-field result; each stored nonempty field wins, otherwise the default or empty string is used.
- Produces: generated `DEMO_LOGIN_CONFIG: DemoLoginConfig` in `common/local.credentials.module.ts`.

- [x] Write tests for missing files, partial JSON normalization, physical-module import, default filling, and stored-value precedence.
- [x] Run `node --test scripts/test-demo-login-config.mjs`; confirm the new cases fail before each corresponding implementation.
- [x] Implement the minimal reader, generator, and resolver.
- [x] Re-run the test and confirm all five cases pass.

### Task 2: Generate and consume the Demo defaults

**Files:**
- Modify: `demo/vite.config.ts`
- Modify: `demo/pages/login/login.uvue`
- Create locally and ignore: `demo/common/local.credentials.json`
- Generate locally and ignore: `demo/common/local.credentials.module.ts`

**Interfaces:**
- Consumes: `readLocalLoginConfig`, `writeLocalLoginConfigModule`, `resolveDemoLoginConfig`, and generated `DEMO_LOGIN_CONFIG` from Task 1.

- [x] Generate `common/local.credentials.module.ts` at Vite startup from `common/local.credentials.json`.
- [x] Update `onLoad` to merge the three existing storage values over generated defaults.
- [x] Write the supplied values only to ignored local files, not tracked source or tests.
- [x] Run the Task 1 test, `scripts/uni.sh build web`, and `scripts/uni.sh build mp-weixin`; confirm success and inspect Git ignore status.

### Task 3: Repeat the HarmonyOS login

**Files:**
- No source changes.

- [x] Rerun the Demo on the connected Mate 60 Pro so the updated code is active.
- [x] Confirm all three fields exactly match the supplied values and submit login once.
- [x] Confirm the device enters an authenticated chat view without a login error.
- [x] Remove only temporary device screenshots/layouts and local verification artifacts created by this task.
