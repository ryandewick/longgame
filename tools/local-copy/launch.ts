// What "Long Game.bat" and the desktop shortcut run. With no argument: installs and builds when that is needed,
// starts the local copy and opens the browser. --check says by its exit code whether an install or a build is
// needed first, --prepare does only those, and --app-window shows Long Game in a window of its own (see app-window.ts).
import { NEEDS_PREPARING_EXIT_CODE, parseLaunchMode } from './app-window.ts'
import {
  isPrepared,
  launchLocalCopy,
  prepareLocalCopy,
  runAsAppWindow,
  runCommand,
} from './steps.ts'

const mode = parseLaunchMode(process.argv.slice(2))

if (mode === 'check') {
  await runCommand(() => {
    process.exit(isPrepared() ? 0 : NEEDS_PREPARING_EXIT_CODE)
  })
} else if (mode === 'prepare') {
  await runCommand(prepareLocalCopy)
} else if (mode === 'app-window') {
  await runCommand(runAsAppWindow, { errorsInDialog: true })
} else {
  await runCommand(launchLocalCopy)
}
