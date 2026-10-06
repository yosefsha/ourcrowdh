# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Instructions

Shared coding standards — design principles (SOLID, extensibility, industry conventions), repository layout, GitHub setup, and the React/TypeScript frontend.

@docs/coding-instructions.md

## Implementing an issue as a subagent

Applies whenever you are a subagent working a GitHub issue. Parallel agents share
one repository, so isolation is mandatory, and the task is not finished when the
code is written — it is finished when the reviewer is satisfied.

1. **Own branch, own worktree.** Never work in the main checkout. Start from the latest `main`:
   ```bash
   git fetch origin
   git worktree add ../ourcrowdh-worktrees/issue-<n> -b issue/<n>-<short-slug> origin/main
   ```
   If the harness already placed you in a fresh worktree, create the `issue/<n>-<short-slug>` branch there instead. Do all work, commits and pushes from that worktree.
2. **Implement** the issue as written, touching only the paths it owns (`docs/PLAN.md#file-ownership`). Local gates green before pushing: `lint`, `type-check`, `test`, `test:e2e` where applicable.
3. **Open the PR** with the `pr` skill (security gate first). Base `main`, title from the issue, body starts with `Closes #<n>`. Open it ready for review, not as a draft — drafts are not reviewed.
4. **Wait for CI and the review.** `gh pr checks <pr> --watch --interval 30` blocks until every check finishes (re-run it if your command times out). If the `Claude review` check **fails** (for example a missing `CLAUDE_CODE_OAUTH_TOKEN`), stop and report that — a review that never ran is not a clean review.
5. **Collect every finding**:
   - inline threads — unresolved ones are `isResolved: false`:
     ```bash
     gh api graphql -F o=yosefsha -F r=ourcrowdh -F n=<pr> -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved path line comments(first:20){nodes{author{login} body}}}}}}}'
     ```
   - the top-level findings comment of the latest review: `gh pr view <pr> --comments`
6. **Address each finding.** Fix it, or — for a SUGGESTION you decline — explain why in one or two sentences. Commit and push the fixes, then:
   - reply in each inline thread with what changed (commit SHA) or why it was declined, and resolve it:
     ```bash
     gh api graphql -f id=<threadId> -f body='<reply>' -f query='mutation($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id}}}'
     gh api graphql -f id=<threadId> -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}'
     ```
   - answer the top-level comment with one PR comment mapping each finding to its fix or reason.
   Never weaken a test or an assertion to satisfy a finding.
7. **Repeat from step 4.** Each push triggers a fresh review, which may raise new findings.
8. **Done** only when, for the latest commit: CI is green, the review has run, no inline thread is unresolved, and every CRITICAL and WARNING in the latest top-level review is fixed (SUGGESTIONs fixed or answered). Then report the PR URL and a short summary to the parent. Do not merge — merging is the human's call.

Escalate to the parent instead of looping when a finding contradicts `docs/PLAN.md`, `CONTEXT.md` or a decision recorded in the issue, or when the same finding returns after two fix attempts.

## Backend — TypeScript / NestJS

Backend standards for the NestJS stack — project structure, code style, configuration, testing, and the container runtime.

@docs/backend-nestjs-instructions.md
