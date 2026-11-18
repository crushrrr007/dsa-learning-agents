# Sliding Window

Maintain a contiguous window `[left, right]` and slide it across the array.

## Patterns
- Fixed size: window length stays constant.
- Variable size: expand `right`, shrink `left` when a constraint breaks.
- Track window state with a sum, count map, or set.

## Complexity
Each index enters and leaves the window at most once → O(n).

## Common mistakes
- Expanding forever without shrinking when invalid.
- Double-counting the element at `right`.
- Using a window when the problem needs non-contiguous choices.

## Guiding question
What quantity must stay valid inside the window, and when should `left` advance?
