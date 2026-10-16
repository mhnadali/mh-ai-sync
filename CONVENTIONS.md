# CONVENTIONS.md - Aider Repository Guidelines
Project: AI-Augmented Project

## Overview
Multi-agent context-aware codebase configured via M.H. AI Sync.

## Build & Test Commands
- `install`: `npm install`
- `build`: `npm run build`
- `test`: `npm test`
- `lint`: `npm run lint`
- `dev`: `npm run dev`

## Code Style & Conventions
- Follow Clean Code and DRY principles.
- Write type-safe and self-documenting code with descriptive naming.
- Keep functions focused on a single responsibility.

## Git Conventions
- Use conventional commits (feat:, fix:, chore:, refactor:).
- Do not push broken builds or failing tests.
- Never push directly to main; pull requests only.

## Agent Directives & Constraints
- Preserve existing comments and docstrings.
- Always verify syntax and run test suites before finalizing changes.
- Prefer minimal and surgical edits over rewriting entire files.
- Never commit or hardcode secrets, tokens, or credentials.
