# Arrays

An array stores elements in contiguous memory. Access by index is O(1).

## Key ideas
- Indices start at 0 and end at `len(arr) - 1`.
- In-place algorithms update the array without allocating a second copy when possible.
- Common scans: left-to-right, reverse, and two-index swaps.

## Common mistakes
- Off-by-one errors at the last index.
- Mutating while iterating without a clear invariant.
- Assuming the array is sorted when it is not.

## Guiding question
Before writing a loop, what is the invariant you want true after each iteration?
