---
name: namespace-guard
description: Own the single public command surface of this plugin so colliding names from the source projects are not re-emitted.
---

# Namespace Guard

The source projects this plugin draws from collided on names the host resolves
globally. This plugin exposes each of those once, owned here.

## Resolved collisions

- `review` (command-namespace) from fixture-org/frontend-craft-plugin, fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin - Namespaced under the generated plugin: "review" is re-exposed once, owned by the orchestration layer, and the source-specific variants are not re-emitted.
- `PostToolUse:Write` (duplicate-hook) from fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin - Resolved by selection: only fixture-org/browser-qa-plugin entered the stack, so the collision on "PostToolUse:Write" no longer exists.
- `viewports` (configuration-conflict) from fixture-org/frontend-craft-plugin, fixture-org/browser-qa-plugin - Namespaced under the generated plugin: "viewports" is re-exposed once, owned by the orchestration layer, and the source-specific variants are not re-emitted.
- `baseUrl` (configuration-conflict) from fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin - Resolved by selection: only fixture-org/browser-qa-plugin entered the stack, so the collision on "baseUrl" no longer exists.
- `.qa/` (filesystem-conflict) from fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin - Resolved by selection: only fixture-org/browser-qa-plugin entered the stack, so the collision on ".qa/" no longer exists.
- `node` (incompatible-dependency) from fixture-org/frontend-craft-plugin, fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin, pa11y/pa11y, microsoft/playwright-mcp, GoogleChrome/lighthouse - Resolved: require node >= 20, which satisfies every declared floor. No capability is dropped.

## Rules

1. Do not re-expose a source project's original command, hook, or agent name.
2. A new public name must not shadow one already listed above.
3. If a collision cannot be resolved by naming, report it instead of silently
   letting the host pick a winner.
