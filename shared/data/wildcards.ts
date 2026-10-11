import type { Wildcard } from '../types/reset'
import { parseRequirements, requirementProblems } from '../domain/requirements'
import { DataSourceError } from './sources'

function wildcard(name: string, description: string, requirements = ''): Wildcard {
  const problems = requirementProblems(requirements)
  if (problems.length) throw new DataSourceError(problems.map((problem) => `${name}: ${problem}`))
  return { name, description, requirements: parseRequirements(requirements) }
}

/** Things to end a long session on. None of them is AFK, so an AFK night is dealt none. */
export const WILDCARDS: readonly Wildcard[] = [
  wildcard(
    'Boss trip',
    'Twenty minutes at whatever your gear and stats allow. Giant Mole if in doubt.',
  ),
  wildcard('Clue scroll', 'Do one from the bank, or go and get one. Any tier.'),
  wildcard('Slayer task', 'One task, start to finish.'),
  wildcard(
    'Lowest skill, fifteen minutes',
    'Whatever sits at the bottom of the list. No method required.',
  ),
  wildcard('Tempoross', 'One game. Fishing XP and a Fish barrel to pray for.', 's:fishing 35'),
  wildcard('Wintertodt', 'One game. Firemaking XP and a crate.', 's:firemaking 50'),
  wildcard(
    'Guardians of the Rift',
    'Two games. Pouches and the Raiments of the Eye.',
    'q:Temple of the Eye;s:runecraft 27',
  ),
  wildcard('Barbarian Assault', 'A few waves toward the torso.'),
  wildcard('Pest Control', 'Ten minutes of Void points.'),
  wildcard(
    'Mahogany Homes',
    'Three contracts. Cheap Construction and the Carpenter’s outfit.',
    's:construction 20',
  ),
]
