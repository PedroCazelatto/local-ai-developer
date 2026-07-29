---
name: simplified-technical-english
description: ASD-STE100 Simplified Technical English for every document you write — one meaning per word, short active sentences (20 words procedural, 25 descriptive), no -ing verb forms, one instruction per sentence, warnings before the step, no dropped articles. Use when writing or reviewing a README, a spec, a task file, a code comment, a commit intent, or a review issue.
---

# Standard: Simplified Technical English (ASD-STE100)

Write every document in Simplified Technical English: a controlled vocabulary and short active sentences that a reader parses correctly on the first pass.

ASD-STE100 is the aerospace and defence specification for technical writing. It has two parts: a set of writing rules, and a dictionary of approximately 900 approved words, each with one approved meaning and one approved part of speech. The dictionary is not shipped with this project. Apply the rules below, and apply the one-word-one-meaning discipline to every word you choose.

## Where this applies

- Applies to: `README.md`, `PRODUCT_SPEC.md`, the epic and story `README.md` files, the task files under `backlog/`, code comments and doc-comments, the `intent` line you pass to `commit_changes`, and the issues in a review verdict.
- Does not apply to: your replies to the user in the terminal, code identifiers, literal command output, and quoted error text. Never rewrite a quotation to fit this standard.

## Words

- **One word, one meaning, one part of speech.** Choose one sense of a word and never use it another way in the same document. `close` is a verb ("close the file"), so do not also write "a close match".
- **The same thing gets the same word, every time.** Never vary a term for style. A reader who sees a new word looks for a new thing.
- **Use the plainest word that fits.** `use` not `utilize`, `start` not `initiate` or `commence`, `make sure` not `ensure`, `about` not `regarding`, `before` not `prior to`, `after` not `subsequent to`, `enough` not `sufficient`, `try` not `attempt`, `do` not `perform`, `let` not `permit`, `must` not `shall`, `show` not `display`.
- **Technical names and technical verbs are always allowed.** `mutex`, `deserialize`, `git rebase`, and every identifier in the codebase stay as they are. The standard limits the general vocabulary, never the domain vocabulary.
- **Write no contractions.** `do not`, not `don't`. `it is`, not `it's`.
- **Write no slang, no idiom, and no metaphor.** "the build is green" becomes "the build passes".
- **Spell out an abbreviation the first time it appears** in a document, then use the abbreviation.

## Verbs

- **Use only these forms:** the infinitive, the imperative, the simple present, the simple past, and the simple future.
- **Write no `-ing` verb form.** "When installing the package" becomes "When you install the package". An `-ing` word that is a technical name, such as `logging` or `caching`, is correct.
- **Write no perfect tense.** "The Worker has written the tests" becomes "The Worker wrote the tests".
- **Use the active voice.** "The file is read by the loader" becomes "The loader reads the file". Use the passive voice in descriptive text only when the actor is genuinely unknown.
- **Name the actor.** A sentence with no subject hides who does the work.

## Sentences and paragraphs

- **A procedural sentence has 20 words maximum. A descriptive sentence has 25 words maximum.**
- **One instruction per sentence.** Two actions become two sentences, or a numbered list.
- **A paragraph has 6 sentences maximum,** and a descriptive paragraph starts with its topic sentence.
- **Keep every word that makes the grammar clear:** the articles `a`, `an`, and `the`, and the relative pronouns `that`, `which`, and `who`. Never drop words to shorten a sentence: "Open file, check status" becomes "Open the file. Then check the status."
- **Write no more than 3 nouns in a row.** "session context window token count" becomes "the number of tokens in the session context window".
- **Split a sentence that needs `and` twice.** One idea per sentence.
- **Write no `and/or`.** Write "A, or B, or both".

## Procedures and warnings

- **Write a step as a command:** "Run `npm run typecheck`." Do not write "The typecheck should be run."
- **Put a warning or a caution before the step it applies to,** never after it. A warning that the reader finds after the damage is useless.
- **Start a warning with the command that prevents the harm,** then give the reason: "Do not run the full app to test a change. It burns a large number of tokens."
- **Use a numbered list for an ordered procedure and a bulleted list for an unordered set.** Do not hide a sequence inside a paragraph.

## Examples

**Do:** `Run the tests inside the project container. The container has the toolchain; the host does not.`
**Don't:** `Testing should be performed within the containerized environment, as the requisite tooling has been provisioned there rather than on the host.` — passive voice, an `-ing` form, a perfect tense, one 24-word sentence, and four long words where short ones fit.

**Do:** `The loader reads the file on every call.`
**Don't:** `The file is read by the loader on a per-invocation basis.`

**Do:** `Warning: Do not delete the task file before its commit lands. The deletion is the record that the work shipped.`
**Don't:** `Note that prematurely removing the task file may result in issues.` — vague noun ("issues"), an `-ing` form, and a hedge ("may") where the rule is absolute.

**Do:** `Set order first. Then set depends_on to match it.`
**Don't:** `Set the order and depends_on fields, making sure they are consistent with each other.`
