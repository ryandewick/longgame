// What "Long Game.bat" runs: installs and builds when that is needed, starts the local copy and opens the browser.
import { launchLocalCopy, runCommand } from './steps.ts'

await runCommand(launchLocalCopy)
