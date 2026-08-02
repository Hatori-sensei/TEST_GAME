---
description: Describe when these instructions should be loaded by the agent based on task context
# applyTo: 'Describe when these instructions should be loaded by the agent based on task context' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---

<!-- Tip: Use /create-instructions in chat to generate content with agent assistance -->

Strict Separation of Concerns (Architecture Rule)

Do NOT mix DOM/UI state management code with the HTML5 Canvas high-performance rendering loop.

Keep Vue component logic and Canvas rendering logic strictly decoupled to guarantee a stable 60 FPS performance.

Preserve User Configurations & Custom Parameters

Do NOT modify, alter, or reset developer-defined numerical values, constants, or UI parameters (e.g., the 82% judgment line Y-position, custom speed ratios) unless explicitly instructed.

Only modify the specific buggy sections or requested features; leave all user-adjusted parameters untouched.

Rigorous Simulation & Zero-Error Code Delivery

If the user reports an error or code failure, re-examine and simulate the entire logic flow from scratch to identify the exact root cause.

Provide fully verified, optimal, and 100% working code.

Concise & Direct Output Format

Omit unnecessary conversational filler, process explanations, or step-by-step meta-commentary (e.g., "I checked this 10 times...").

Get straight to the point: provide the core reason for the fix and the exact, production-ready code with clear file paths.