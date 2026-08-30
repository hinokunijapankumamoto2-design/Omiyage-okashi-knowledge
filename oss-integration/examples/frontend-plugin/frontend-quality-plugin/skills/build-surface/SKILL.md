---
name: build-surface
description: Produce or modify the web artifact this plugin is about, applying the design and implementation capabilities in the stack.
---

# Build Surface

Produces and modifies the artifact this plugin is about.

## Capabilities in scope

- **Visual Design** (`visual-design`)
- **Frontend Implementation** (`frontend-implementation`)
- **Responsive Design** (`responsive-design`)

## Procedure

1. Establish what is being built and against which viewports (see
   `viewports` in the plugin configuration).
2. Make the change.
3. Hand off to the Verify layer. This skill does not judge its own output -
   that separation is why the plugin exists.

## Rules

- Do not declare the work finished. Only the Verify layer can do that.
- Record any decision you made that the goal did not specify, so it can be
  challenged rather than inherited silently.
