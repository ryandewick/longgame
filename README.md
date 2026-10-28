# Long Game

**A free maxing planner for Old School RuneScape.** Type your display name and see all 24 skillcapes on one rail, how far each is from 99, and a training session built for your account tonight.

**The website is offline.** Jagex's Fan Content Policy does not permit software or applications that use Jagex property, and Jagex confirmed in October 2026 that this includes Long Game, free and unofficial as it is. It now runs only as a [local copy](#run-a-local-copy) on your own machine.

![Every skillcape on one rail, filling toward 99](public/og.png)

Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.

## Why I built it

I kept logging in to Old School RuneScape, standing at the bank, doing nothing, and logging off again. Not because there was nothing to do, but because deciding what to do was the hard part. Long Game makes that decision before I log in: it looks at what my account can do and tells me what tonight's session is.

## What it does

- **Shows the whole grind at once.** Every skill is a cape that fills with colour as you level, with the levels and hours left to max.
- **Deals you a session.** Say how long you have and how much attention you can spare, and it deals timed blocks from AFK, semi-AFK or active methods your account has actually unlocked, plus any farm or birdhouse runs that are due. It can end the session on the next quest or diary step worth doing.
- **Plans for mains and ironmen separately.** It tells them apart from the hiscores. Ironmen get ironman routes, with no method that needs the Grand Exchange.
- **Keeps every account you play.** Add your main, your ironman and any alts, and switch between them from your name at the top. Each keeps its own stats, ticks, sessions, history and settings.
- **Asks only what it needs to.** The hiscores do not list quests or diaries, so it asks a few yes or no questions about the ones that would change your plan.
- **Tracks what you gained.** Finish a session and it tallies the XP, keeps a 14-day history and counts your streak.
- **Has a guide for every skill.** Every training method, with levels, XP rates and requirements.

## Using it

Start a [local copy](#run-a-local-copy) and type your display name. There is no account to create.

- **It only needs your name.** It looks you up on the public hiscores. It never asks for a password and cannot touch your account.
- **Your data stays with you.** Sessions, ticks and XP history are kept in your own browser, for every account you add. You can export an account from Settings and import it again on another browser. The website counts visits with Cloudflare Web Analytics, which sets no cookies and does not follow you to other sites.
- **It is free.** No adverts, no donations, no paid features.

If you would rather keep your saves on your own machine, you can [run a local copy](#run-a-local-copy).

## Missing a method, or found a mistake?

The list of methods is not complete. Every method in it was checked against the Old School RuneScape Wiki, and there will be good ones I have missed. Rates are the wiki's and assume its setups, so your own will vary.

If you know a method that should be there, use "Suggest a method" on the Methods page or any guide page of the site, or [open an issue](https://github.com/ryandewick/longgame/issues). I check each one against the wiki before adding it, so a link to the wiki page helps.

---

## For developers

Long Game is a [Nuxt 4](https://nuxt.com) app in strict TypeScript, tested with Vitest and deployed as a Cloudflare Worker.

### How the code is put together

- **The rules of the game are pure functions** in `shared/domain`. They are handed the account, the time and the random source, so they are unit tested without a browser.
- **Four Pinia stores** hold the state and ask the domain for everything derived from it: `account`, `session` and `history` hold the open account, and `account-list` keeps every saved account.
- **Components only draw.** Each owns one BEM block named after the component and takes its colours and spacing from the tokens in `app/assets/styles/tokens.scss`.
- **Server routes are thin**, with their checks in `server/utils` as tested functions.
- **One codebase runs two ways:** the public website on Cloudflare, and a local copy on Node that keeps saves on disk.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the details, and [DESIGN.md](DESIGN.md) is the design system.

### What is in here

| Path                                 | What it is                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `app/`                               | The Nuxt app: pages, components, stores, composables and styles                                 |
| `shared/domain/`                     | The rules: what an account can do, how long a skill will take, how a session is dealt           |
| `shared/data/`, `shared/types/`      | The training data as typed objects, built from `datasrc/`, and the types everything shares      |
| `server/`                            | The API routes (hiscores, account type, suggestions) and the sitemap, robots.txt and llms files |
| `datasrc/`                           | The training methods, quests and resets as JSON, each method with its wiki source               |
| `tests/`                             | The rules, the data, the text each screen shows, and the server's checks                        |
| `public/assets/`                     | Skill icons, skillcape images and the RuneScape font (Jagex's property), and the two open fonts |
| `modules/`, `wrangler.jsonc`         | The Cloudflare setup                                                                            |
| `tools/local-copy/`, `Long Game.bat` | Running a copy on your own machine                                                              |

### Getting started

Needs Node 24.11 or newer. With nvm, `nvm use` picks the version up from `.nvmrc`.

```
npm install
npm run dev
```

Then open the address it prints. Saves are kept in the browser, as on the live site.

### Checks

```
npm run check
```

That runs ESLint, the type check and every test. `npm run format` formats the code with Prettier.

### Build and deploy

The website is one Cloudflare Worker. Cloudflare serves the prerendered pages and static files, and the Worker answers `/api/*` and draws any page that was not prerendered.

```
npm run build:site      build with Nitro's cloudflare-module preset
npm run preview:site    run that build under Cloudflare's runtime on this machine (no login needed)
npm run deploy          refuses while the site is offline
```

While the site is offline, `longgame.tools` serves a holding page instead (`placeholder/worker.js`, deployed with `npm run deploy:placeholder`). The holding page answers 410 Gone for every old address, so search engines drop them.

The suggestion form needs one secret on the Worker, `NUXT_GITHUB_TOKEN`: a fine-grained GitHub token with Issues: write on the repository that receives suggestions. Store it with `npx wrangler secret put NUXT_GITHUB_TOKEN`. Until it is set, the form answers that suggestions are not switched on.

### Run a local copy

A local copy is the same app on your own machine, with your sessions and XP history saved to disk.

On Windows, double-click `Long Game.bat`. The first run installs what it needs and builds, which takes a few minutes. After that it starts straight away and rebuilds by itself when the code has changed. It opens http://localhost:8765/ in your browser.

To have it open like a desktop app instead, in a window of its own with no tabs, no address bar and no console, make a shortcut that runs:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "<project>\tools\local-copy\open-app.ps1"
```

It opens Long Game in a Chrome app window (Edge when Chrome is not installed), and closing that window stops it. The window opens narrow, to sit beside the game client, and after that wherever you last left it, at that size. A console shows only while it installs or builds after the code has changed, and a problem is shown in a message box.

On anything else:

```
npm install
npm run build:local
npm run start:local
```

Saves are in the `.data` folder at the top of the project: every account in `accounts.json`, each XP history in `snapshots/`. To move an account between the website and a local copy, export it from Settings on one and import it on the other. To use another port, set `LONGGAME_PORT` first.

### Adding or correcting a method

Methods live in `datasrc/methods/<skill>.json`. Each one needs a level, a name, an XP rate where the wiki gives one, how much attention it takes, what it requires, and the wiki page it comes from. `npm run test` validates them and lists everything wrong with a file. Suggestions sent from the site arrive as GitHub issues labelled `method suggestion`.

### Quests and diaries

The hiscores do not list quests or diaries, and the OSRS Wiki does not permit other tools to use its service that reads them from the game. So there is no syncing: the app asks the player about the quests and diaries that would change their plan, and keeps a full tick list for the rest.

A quest cannot be finished before the quests it requires, so one answer settles several: ticking a quest ticks the quests it requires, and unticking one unticks the quests that require it. A diary tier's reward cannot be claimed before the tiers below it, nor without the quests its tasks need, so ticking a tier ticks those too. Some quests count once only started (Fairytale II for the fairy rings): their tick box has a started state between not done and done. Every quest not done says whether you are ready for it, naming the boost that covers a level you are short of, or what it still needs, and under the diary grid each diary's next tier says the same. The Next part of the page suggests what to do: the quests that take the most training time off for the time they take, the next unlocks in your Optimal quest guide's order, and the diary tiers you can claim. The Goals part shows how far you are from Barrows gloves, the fairy rings and 28 other milestones, and from the quest point and achievement diary capes. Tonight can end a session of an hour or more on one step from Next, the first that fits in half the session, in the wildcard's place; when you press Done it asks whether you finished it and ticks it for you. Settings can switch it off. Those chains, and the levels each quest needs, are in `datasrc/quest_facts.json`: the game's whole quest list, miniquests included, where each entry records the wiki page and revision it was read from. What each diary tier's tasks need is in `datasrc/diary_facts.json`, and the boosts that may count toward a quest's or a tier's level are in `datasrc/boosts.json`. `npm run test` fails if a quest a method or reset names is missing from them.

## How this was built

Long Game was built with AI assistance. I set the direction and made the product and design decisions, and used Claude Code to write most of the code, which I review. Other projects on my profile are written entirely by hand, so I'm noting the difference here.

## Credits and licences

- **The code** is under the [MIT Licence](LICENSE). That covers the source code only, not the game assets or the training data below.
- **Game assets** (skill icons, the skillcape, quest point cape and achievement diary cape images, the quest and diary icons, the RuneScape font) belong to Jagex Limited and are used under Jagex's Fan Content Policy. They are not covered by the MIT Licence or any other licence in this repository.
- **Training data** in `datasrc/` is adapted from the [Old School RuneScape Wiki](https://oldschool.runescape.wiki/) and is licensed [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/), the same as the wiki. That includes the quest facts (`datasrc/quest_facts.json`): what each quest needs and which quests require which, read from each quest's own page; the diary facts (`datasrc/diary_facts.json`), read from each diary's page; the boosts (`datasrc/boosts.json`), each one's size and what making it takes, read from its page; and the goals (`datasrc/quest_goals.json`), the milestones the wiki's two Optimal quest guides reach, each with the quests and diary tiers it needs. The step at which each guide does a quest or reaches a goal is in the quest facts and the goals, and the order of both guides, steps and XP only, is kept as a test fixture (`tests/fixtures/quest-orders.json`) under the same licence.
- **GSAP** (the `gsap` package) is used under its own licence.
- **Figtree and Poppins**, the two open fonts, are under the SIL Open Font Licence. The licence texts are in `public/assets/fonts`.

Long Game is free and has no adverts, donations or paid features.
