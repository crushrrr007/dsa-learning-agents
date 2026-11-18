# Two Pointers

Use two indices that move based on a rule until they meet or cross.

## Patterns
- Opposite ends: `left = 0`, `right = n - 1` for sorted arrays or palindromes.
- Same direction: slow/fast for partitioning or removing duplicates.
- Compare values at the pointers; move the pointer that restores the invariant.

## Complexity
Often O(n) time and O(1) extra space instead of nested O(n²) loops.

## Common mistakes
- Moving the wrong pointer after a comparison.
- Forgetting to check `left < right` before indexing.
- Updating both pointers when only one should move.

## Guiding question
After comparing `arr[left]` and `arr[right]`, which pointer must move to make progress?
