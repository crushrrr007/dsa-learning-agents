# Linked Lists

Each node stores a value and a `next` pointer to another node (or None).

## Key ideas
- No random access: reach the k-th node in O(k) by following links.
- Reverse by rewiring `next` pointers carefully; keep `prev`, `curr`, `nxt`.
- Cycle detection: Floyd's tortoise and hare (slow moves 1, fast moves 2).

## Common mistakes
- Losing the rest of the list when rewiring without saving `nxt`.
- Not handling empty lists or single-node lists.
- Comparing nodes by value when identity (object) matters for cycles.

## Guiding question
Before changing `curr.next`, which reference do you still need to keep?
