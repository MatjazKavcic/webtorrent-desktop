# AGENTS.md

This repository is a personal fork of [webtorrent/webtorrent-desktop](https://github.com/webtorrent/webtorrent-desktop).

## Remotes

- `origin` — https://github.com/MatjazKavcic/webtorrent-desktop (this fork)
- `upstream` — https://github.com/webtorrent/webtorrent-desktop (original project, fetch only)

## Git rules

- Push only to `origin`.
- Never push to `upstream`, and never create pull requests on the upstream repository.
- Local clones should keep pushing to upstream disabled:

  ```bash
  git remote set-url --push upstream DISABLED
  ```

## Syncing with upstream

1. `git fetch upstream && git fetch origin`
2. Make sure local `master` matches `origin/master` (fast-forward if behind).
3. `git merge upstream/master` with the message `Merge branch 'webtorrent:master' into master`.
4. Resolve conflicts in favor of the fork's own changes, taking upstream version bumps where they are newer. For `package-lock.json`, keep the fork's version and regenerate it with `npm install`.
5. `npm test` (standard + depcheck) must pass.
6. `git push origin master`.
