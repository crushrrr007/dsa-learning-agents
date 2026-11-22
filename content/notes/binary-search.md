# Binary Search

Binary search halves a monotonic search space each step using `left`, `right`, and `mid`.

## Key ideas
- Keep an invariant: the answer (if it exists) always lies in `[left, right]`.
- On a sorted array, compare `nums[mid]` to the target and discard half.
- On an answer space (speeds, capacities), check a predicate and move the bound.
- Rotated sorted arrays still have one sorted half each step — search that half when it can hold the target.

## Common mistakes
- Off-by-one when updating `left = mid + 1` vs `right = mid`.
- Integer overflow concerns are rare in Python; still prefer clear mid formulas.
- Forgetting that an empty range means “not found”.

## Guiding question
After this comparison, which half is impossible?
