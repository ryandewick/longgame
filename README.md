# Long Game

A free maxing planner for Old School RuneScape. Type your display name and it reads your levels from the public hiscores, hangs all 24 skillcapes on one rail, shows how far each is from 99, and deals training sessions from the methods your account has unlocked. Mains and ironmen are planned separately.

Live at [longgame.tools](https://longgame.tools).

Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.

## What is in here

| Path | What it is |
|---|---|
| `src/index.html`, `src/styles.css` | The page shell and every style |
| `src/js/` | The app, one file per job: `account.js` (what the account can do), `session.js` (dealing sessions), `rack.js`, `share.js`, `views/` (one file per screen), and so on. `main.js` starts it |
| `datasrc/` | The training methods, quests and resets, one JSON file per skill, each method with its wiki source |
| `tools/build_data.py` | Checks `datasrc/`, then writes the local build into `build/` |
| `tools/build_site.py` | Builds the public website into `site/`: the planner, a guide page per skill, the sitemap and the data export |
| `tools/dev_site.mjs` | Runs the website on your machine with the real relay code |
| `relay/worker.js`, `wrangler.toml` | The Cloudflare Worker that serves the site, looks players up on the hiscores and files method suggestions |
| `server/longgame.py`, `Long Game.bat` | A small local server for running it on your own machine |
| `assets/` | Skill icons, skillcape images and the RuneScape font (Jagex's property, see below), and the two open fonts |
| `DESIGN.md` | The design system: colours, type, components and the rules behind them |

### How the code is put together

There is no framework and no bundler. The files in `src/js/` are plain scripts that share one scope; the build joins them in a fixed order (listed in `tools/build_data.py`) inside a single function. A few names are used everywhere: `state` is the saved account, `k` is a skill key such as `'mining'`, `stat(k)` is that skill's level and XP, and a method is a row of `[level, name, xp/h, intensity, cost, requirements, note, extra]`. Code is formatted with Prettier (`npx prettier --write src relay tools/dev_site.mjs`).

## Run it on your own machine

Needs Python 3.

```
python tools/build_data.py
python server/longgame.py --open
```

Everything is saved in a `data/` folder at the top of the project. On Windows you can double-click `Long Game.bat` instead.

## Build and preview the website

Needs Python 3 and Node 18 or newer.

```
python tools/build_site.py
node tools/dev_site.mjs
```

Then open http://127.0.0.1:8793. The address and repository the site uses are set in `site.config.json`.

## Deploy

```
python tools/build_site.py
npx wrangler deploy
```

The suggestion form needs two settings on the Worker: `GITHUB_REPO` in `wrangler.toml`, and a `GITHUB_TOKEN` secret (a fine-grained token with Issues: write on that one repository), stored with `npx wrangler secret put GITHUB_TOKEN`.

## Adding or correcting a method

Methods live in `datasrc/methods/<skill>.json`. Each one needs a level, a name, an XP rate where the wiki gives one, how much attention it takes, what it requires, and the wiki page it comes from. Run `python tools/build_data.py --check` to validate. Suggestions sent from the site arrive as issues labelled `method suggestion`; check each against the wiki before adding it.

## Quests and diaries

The hiscores do not list quests, so players tick them by hand. The OSRS Wiki's WikiSync service is not used: the wiki does not permit third-party use of it.

## Credits and licences

- **Game assets** (skill icons, skillcape images, the RuneScape font) belong to Jagex Limited and are used under Jagex's Fan Content Policy. They are not covered by any licence in this repository.
- **Training data** in `datasrc/` is adapted from the [Old School RuneScape Wiki](https://oldschool.runescape.wiki/) and is licensed [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/), the same as the wiki.
- **GSAP** (`vendor/gsap.min.js`) is used under its own licence.

Long Game is free and has no adverts, donations or paid features.
