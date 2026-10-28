// npm run start:local: starts the local copy that `npm run build:local` built, on http://localhost:8765/.
// Add --open to open it in the browser as well.
import { runCommand, startLocalCopy } from './steps.ts'

await runCommand(async () => {
  await startLocalCopy({ openBrowser: process.argv.includes('--open') })
})
