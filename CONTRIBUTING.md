# Contributing to Bài Chắn

[English](CONTRIBUTING.md) · [Tiếng Việt: README và luật chơi](README.vi.md)

This project implements a 120-card family variant. Other families may play differently. Please describe differences as variants and include the source of a rule before proposing it as a change to the default game.

## Share a ruleset

Use the [family rules questionnaire](https://bai-chan-rules.white-violet-3211.workers.dev/?lang=en). Questionnaire submissions are private and need no GitHub account. Please leave out contact details; credit names only with the respondent’s permission. A complete example of a deal, turn, claim, or winning hand is particularly useful.

## Improve the game

Open an issue for a bug or proposed behavior change before a large pull request. For code changes, add or update the relevant rule test and verify both practice and multiplayer paths. Keep the English and Vietnamese UI text aligned. The [README](README.md) describes local setup; the [public rules overview](docs/public-rules.md) and [Vietnamese rules](docs/public-rules.vi.md) record the current rules and unresolved choices. Update both language versions and the website's English and Vietnamese pages when rules change.

Family questionnaire responses and private game logs are deliberately excluded from the repository. Do not add secrets or player data to issues, pull requests, or commits.

## License and media

The source code and project documentation are MIT licensed. The illustrated card faces and generated voice/effect files are included so the game can run, but they are not covered by the MIT grant; please ask before reusing those media files in another project.
