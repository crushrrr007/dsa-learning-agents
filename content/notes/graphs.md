# Graphs

A graph is nodes connected by edges. We usually store neighbors in an adjacency list.

## Key ideas
- DFS explores deeply along one path; BFS explores layer by layer.
- Mark nodes `visited` to avoid infinite loops on cycles.
- Shortest path in an unweighted graph is a BFS.

## Common mistakes
- Forgetting to mark visited before enqueue/recursion.
- Treating an undirected edge as only one direction in the adjacency list.
- Confusing connected components with a single traversal from one start node.

## Guiding question
When you leave a node, which neighbors are still safe to explore, and how do you prove you will not revisit them?
