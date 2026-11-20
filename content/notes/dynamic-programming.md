# Dynamic Programming

DP solves overlapping subproblems once and stores the answers.

## Key ideas
- Define what `dp[i]` (or `dp[i][j]`) means in one sentence.
- Find the recurrence: how a larger state uses smaller solved states.
- Bottom-up fills a table; top-down uses memoized recursion.

## Common mistakes
- Unclear state definition.
- Wrong iteration order (using a state before it is computed).
- Recomputing the same subproblem without a table or memo.

## Guiding question
What does one cell of your DP table represent, and which previously filled cells does it need?
