# PiPlate contribution rules

## User-facing changelog

- Keep `release.ts` notes short and useful to the person using PiPlate.
- Include only visible behavior changes, fixes, or new capabilities.
- Do not mention implementation details, internal migrations, dependencies, infrastructure, or developer workflow.

## Required mobile validation

- Every new feature and user-facing fix must be tested before publication in both of these profiles:
  - Android Chrome at a Galaxy S24-sized viewport (`412x915`), with touch enabled.
  - iPhone Safari at an iPhone 15-sized viewport (`393x852`), with touch and safe areas enabled.
- Check the complete interaction, not only the initial screen: scrolling, overlays, keyboard behavior, touch targets, safe areas, and persistence after reload.
- Run `npm run build` and the mobile browser test suite before publishing.
- Do not publish when either mobile profile fails.
