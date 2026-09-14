# CV Instructions

## Principles

- The repository is the source of truth.
- Never commit secrets, tokens, passwords, API keys, or private keys.
- Local `.env` files are ignored and must not be committed.
- `main` is stable (AGENTS historically said `master`; this repo uses `main`).
- Feature branches use `PRODUCT-00XXX`.

## Feature workflow

When asked to work on a feature `PRODUCT-XXXXX`, always start by:

1. Switch to `main` and pull the latest changes (`git checkout main && git pull`).
2. Create a branch named `PRODUCT-XXXXX` from `main`.
3. Continue working on the feature in that branch.

When a feature is **finished**, do not wait for “dale”. Ship it:

## Validation

