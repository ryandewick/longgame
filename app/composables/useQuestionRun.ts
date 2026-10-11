/**
 * What this visit remembers about the questions on the Quests page: the answers given so far,
 * whether the player has put the questions off, and whether they have gone on to the smaller
 * ones. It is kept for the visit only. What an answer changes is saved with the account (its
 * ticks, and what it said "not yet" to); this is the running list beside the question card, the
 * prompt on Tonight staying out of the way, and the second round not being started unasked.
 */
export function useQuestionRun(): {
  /** The answers given this visit, oldest first. One may since have been undone on the tick list: see `answersStanding`. */
  answers: Readonly<Ref<readonly GivenAnswer[]>>
  /** Adds an answer. A second answer about the same quest or tier replaces the first. */
  recordAnswer: (answer: GivenAnswer) => void
  /** True once the player has put the questions off: the prompt on Tonight stays hidden until the next visit. */
  isPutOff: Readonly<Ref<boolean>>
  putOff: () => void
  /** True once the player has chosen to answer the smaller questions too. */
  isAnsweringSmaller: Readonly<Ref<boolean>>
  answerSmaller: () => void
} {
  const answers = useState<readonly GivenAnswer[]>('question-run-answers', () => [])
  const isPutOff = useState('question-run-put-off', () => false)
  const isAnsweringSmaller = useState('question-run-answering-smaller', () => false)

  function recordAnswer(answer: GivenAnswer): void {
    const { kind, name } = answer.requirement
    const earlier = answers.value.filter(
      ({ requirement }) => requirement.kind !== kind || requirement.name !== name,
    )
    answers.value = [...earlier, answer]
  }

  function putOff(): void {
    isPutOff.value = true
  }

  function answerSmaller(): void {
    isAnsweringSmaller.value = true
  }

  return {
    answers: readonly(answers),
    recordAnswer,
    isPutOff: readonly(isPutOff),
    putOff,
    isAnsweringSmaller: readonly(isAnsweringSmaller),
    answerSmaller,
  }
}
