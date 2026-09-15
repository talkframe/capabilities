# Contributing capability packs

Talkframe capability packs are data-first extensions. A contribution lives in `capabilities/<id>/` and uses a stable dotted id such as `science.timeline`.

## Pack structure

- `capability.json` contains the id, integer version, distribution tier, name, summary, selection guidance, JSON inputs, asset slots, timing, examples, license, author and implementation metadata.
- `example-storyboard.json` is a complete storyboard that exercises the capability and passes the standalone contract validator.
- `definition.json` is required for an L1 declarative implementation. It may use only the bounded elements, actions, expressions, simulations and checks accepted by the current contract.
- L2 packs may add licensed data assets described by `capability.json`. Network-loaded assets and executable code are not accepted.
- L3 code implementations are reviewed and maintained in the private engine. This repository may list their inert metadata, but does not contain their source code.

Keep paths relative to the repository. Do not include local absolute paths, private documents, job output, credentials, or product-specific brand assets.

## Licensing

Every contribution must use MIT or CC BY 4.0. The repository's contracts and validation tools use MIT; exported built-in capability packs, examples, templates and bundled assets use CC BY 4.0. Record the real author and source for contributed assets; a signature or metadata field does not prove originality.

Run the repository validation workflow before requesting review. Structural validation confirms contract compatibility. Maintainers separately review licensing, scope and content quality before a pack enters the verified index.

## Submission

Open a pull request containing one focused capability or template change and its example. Explain the intended use, limits, license, validation result and any visual checks that remain.

Submission without a GitHub account is planned. The signed file-based intake flow is not available yet; until it is documented here, no alternate upload channel is supported.
