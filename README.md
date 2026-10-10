# Long Game

A free maxing planner for Old School RuneScape. Type your display name and it reads your levels from the public hiscores, hangs all 24 skillcapes on one rail, shows how far each is from 99, and deals training sessions from the methods your account has unlocked. Mains and ironmen are planned separately.

Live at [longgame.tools](https://longgame.tools).

Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.

## What is in here

| Path | What it is |
|---|---|
| `head.html`, `app.js` | The app: all styles, and the planner and every view |
| `datasrc/` | The training methods, quests and resets, one JSON file per skill, each method with its wiki source |
| `tools/build_data.py` | Checks `datasrc/` and writes `data.js` and the single-page local build `longgame.html` |
| `tools/build_site.py` | Builds the public website into `site/`: the planner, a guide page per skill, the sitemap and the data export |
| `relay/worker.js`, `wrangler.toml` | The Cloudflare Worker that serves the site, looks players up on the hiscores and files method suggestions |
| `longgame.py`, `Long Game.bat` | A small local server for running it on your own machine |
| `assets/osrs/` | Skill icons, skillcape images and the RuneScape font (Jagex's property, see below) |

## Run it on your own machine

Needs Python 3.

```
python tools/build_data.py
python longgame.py --open
```

Everything is saved in a `data/` folder beside `longgame.py`.

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
