# Trees

A binary tree node stores a value plus `left` and `right` child pointers.

## Key ideas
- Root is the top; leaves have no children.
- Traversals: preorder (node-left-right), inorder (left-node-right), postorder (left-right-node), level-order (BFS).
- Recursion matches the tree shape: solve left, solve right, combine.

## Common mistakes
- Forgetting the null base case.
- Mixing up left/right when rebuilding or searching.
- Using DFS when BFS (level-order) is required.

## Guiding question
What must be true about the left and right subtrees before you decide the answer at the current node?
