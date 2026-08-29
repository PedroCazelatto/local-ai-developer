1. If the state.json already has a model, use it. If we are on an empty machine, suggest one to download. Never pull a model without user approval. On an empty state, show every available model to the user and let it choose, thus removing the pickSmallestModel rule.
2. Create a new status 'failed'.
3. Retry from scratch
4. The loop commits the frontmatter itself via commitPaths.
5. A
6. C
70. I've changed the answer of #4.
7. Boot model-less and refuses to /models use to any model that does not have tools
8. C
9. C
10. As we are dropping the pickSmallestRule, show all the installed models for the user, and if none exists, print some recomendations and tell the user how to install a new model.
11. C
12. B
13. B
14. A
69. The list of models can show the toolless, but with a marker and it must not be selectable. When trying to select, remember the user that the model cant use tools and thus is unavailable, and ask if he wants to delete the model.
71. I've changed #10.
72. Research the minimum Ollama version and state it on README-INCONSISTENCIES.md
15. Docker must use the node version of .nvmrc. Follow option A.
16. Start only
17. C
18. B
19. Yes, use both (C)
20. A
21. No, you need to create a file with readme inconsistencies and I will fix them
73. Wrong. 'install' must also refuses.
74. Keep the range. If the user has a version 24, but older (like 24.1.0), it can still use the repo. Read from .nvmrc.
75. Read from .nvmrc (A).
76. A. Add to the Readme inconsistencies to warn about commands by hand not working correctly.
22. All six.
23. It is allowed to summarize.
24. The seed rule is always protected, what is summarized is only the model-user and model-model messages.
25. Reuse 0.75.
26. Give it the hook.
27. Yes for the sub-agent, but reuse summarization_fire.
E. Why cant we use the Ollama's tokenizer, just like we calculate the tokens used in the normal conversation?
28. 12k is a good cap.
29. A. Truncate.
30. C.
31. A.
32. C.
33. A is very similar to B, lets try to keep both.
34. A.
F. Lets unify all constants to just one, the maximum context available. Then all the sub-values must be derived from it, for example: instead of using 8k tokens for the debate, use 1/2 of the maximum context. You will help me finding these values.
68. As generation speed is nowhere near a big problem, lets keep 16k tokens.
35. A. Accept the hide.
36. Yes, ship it as its own fix.
37. A.
38. B. Lets use only time as the summarization will never let the tokens trigger to trip.
39. C. A fifth outcome as 'over_budget'.
40. B. End the batch that requires the stopped tasks to continue. All other tasks must be kept.
41. A.
42. A. .env only.
43. A. Unset = unlimited.
44. B. Fail open, with a high alarm.
45.
