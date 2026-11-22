# Stack

A stack is last-in, first-out (LIFO). In Python a list's `append` / `pop` is enough.

## Key ideas
- Push adds to the top; pop removes from the top.
- Matching problems push openers and pop on closers.
- A monotonic stack keeps values in sorted order on the stack to answer next-greater / next-smaller queries in linear time.

## Common mistakes
- Forgetting to check emptiness before pop.
- Using the wrong comparison for a monotonic stack (strict vs non-strict).
- Truncation direction when evaluating division in RPN.

## Guiding question
What does the top of the stack represent at this moment?
