// npm run build:local: builds a local copy into .output-local.
import { buildLocalCopy, runCommand } from './steps.ts'

await runCommand(buildLocalCopy)
