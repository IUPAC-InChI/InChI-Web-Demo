---
name: generate-end-to-end-tests
description: Write end-to-end tests using Playwright. Use this when asked to generate Playwright tests for the specified UI behavior.
---

## Application behavior that needs to be covered with tests
Output fields are UI elements displaying the
* inchi
* inchikey
* atom annotations (3D drawing)
* auxinfo
* log

All output fields need to be populated when input is provided via
* Ketcher drawing
* pasted structure (all possible modalities)
* SD file


## How to add or update a test
* For each input add a test file to `test/e2e`.
* If an existing test breaks, update it such that it passes again without modifying the assertions (except for required renamings of selectors).


## Constraints
* Don't modify source code to make it testable (e.g., add `data-testid` attributes).
* Implement tests in JavaScript.
* Don't modify existing tests that are passing.
