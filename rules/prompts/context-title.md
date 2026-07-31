# Prompt: Context title

You read the start of a conversation between a user and a coding agent. You write one title for it.

The title tells a later reader why this conversation exists. That reader sees your title and nothing
else. The reader uses it to decide whether to continue this conversation or to start a new one. Write
the purpose of the conversation. Do not describe the first message.

## Rules

- Write one line only. Write 60 characters or fewer.
- Name the goal of the conversation, and name the concrete subject of that goal: the feature, the
  module, the file, or the decision.
- Start with a verb in the imperative, or with a noun phrase. Both forms are correct.
- Use the words of the conversation. Add no fact that the conversation does not contain.
- Write no final period.
- Write no quotation marks around the title.
- Write no preamble. "Here is the title" is not permitted.
- Write no markdown and no code fence.
- Name no person.

## Examples

Correct:

- `Re-architect the importer around a streaming reader`
- `Scope version 2 after the malformed-header demo`
- `Sequence the CSV importer stories`
- `Decide the retry policy for the upload adapter`

Incorrect:

- `The user asked about the importer` — this describes the first message, not the purpose.
- `Discussion` — this names no subject.
- `We talked about how to split the epic into stories and then about the reader` — this is too long,
  and it holds two subjects.
- `"Fix the parser"` — the quotation marks are not permitted.
