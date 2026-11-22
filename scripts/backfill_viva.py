#!/usr/bin/env python3
"""Backfill problem-specific viva rubrics into content/problems/*.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROBLEMS = ROOT / "content" / "problems"


def viva3(
    q1: str,
    p1: list[str],
    q2: str,
    p2: list[str],
    q3: str,
    p3: list[str],
    m1: int = 2,
    m2: int = 2,
    m3: int = 2,
) -> list[dict]:
    return [
        {"question": q1, "expected_points": p1, "min_points": m1},
        {"question": q2, "expected_points": p2, "min_points": m2},
        {"question": q3, "expected_points": p3, "min_points": m3},
    ]


def viva2(
    q1: str,
    p1: list[str],
    q2: str,
    p2: list[str],
    m1: int = 2,
    m2: int = 2,
) -> list[dict]:
    return [
        {"question": q1, "expected_points": p1, "min_points": m1},
        {"question": q2, "expected_points": p2, "min_points": m2},
    ]


# Hand-authored rubrics keyed by problem id.
VIVA: dict[str, list[dict]] = {
    # ---- arrays ----
    "two-sum": viva3(
        "What is the time cost of your hash-map Two Sum versus checking every pair?",
        ["O(n) single pass with a hash map", "brute pair check is O(n^2)", "each lookup is amortized O(1)"],
        "Which edge case breaks a naive scan that returns the first index twice?",
        ["cannot reuse the same index", "need i < j", "value may appear once only"],
        "Why store seen values as you scan instead of after the full pass?",
        ["complement may already be behind you", "one pass finds both indices", "map holds value→index so far"],
    ),
    "contains-duplicate": viva3(
        "How does a set check for duplicates in linear time?",
        ["O(n) scan", "membership test is amortized O(1)", "space O(n) for the set"],
        "What happens on an empty list or a list of length one?",
        ["no duplicates possible", "return false", "loop never finds a clash"],
        "Why does seeing a value already in the set prove a duplicate immediately?",
        ["set stores values already visited", "second insert attempt means repeat", "no need to finish the array"],
    ),
    "valid-anagram": viva3(
        "Why is counting characters O(n) rather than sorting both strings?",
        ["one pass over each string", "sort would be O(n log n)", "fixed alphabet still linear"],
        "What edge case makes two strings unequal before you finish counting?",
        ["different lengths", "cannot be anagrams", "early false"],
        "Why must every character frequency match, not just the set of letters?",
        ["extra repeats break anagrams", "counts must be identical", "presence alone is not enough"],
    ),
    "group-anagrams": viva3(
        "What is the cost of grouping n words of length k with sorted signatures?",
        ["O(n k log k) if sort each word", "hash map of signature→group", "output rebuild is O(n)"],
        "How do you keep the required canonical order of groups and words?",
        ["sort letters inside each word for the key", "sort strings inside each group", "sort groups by first member"],
        "Why do two different words share a bucket when their sorted forms match?",
        ["anagrams share letter multiset", "sorted key identical", "map collects them together"],
    ),
    "top-k-frequent": viva3(
        "How can you get the k most frequent values faster than sorting the whole array?",
        ["count frequencies in O(n)", "bucket or heap by count", "avoid full O(n log n) value sort when possible"],
        "What happens when several values share the same frequency?",
        ["canonical tie-break by sorting value", "still return exactly k", "stable ordering rule in the statement"],
        "Why does a frequency map let you decide which values belong in the answer?",
        ["map value→count", "select the k largest counts", "ignore rare keys"],
    ),
    "product-except-self": viva3(
        "Why is a prefix/suffix product scan O(n) time and how do you avoid division?",
        ["left products then right products", "two linear passes", "no division by nums[i]"],
        "What breaks if you try to divide the total product by nums[i] when a zero appears?",
        ["division by zero", "multiple zeros make every entry zero", "prefix/suffix still works with zeros"],
        "Why does out[i] equal (product of left side) times (product of right side)?",
        ["excludes nums[i]", "left prefix ends at i-1", "right suffix starts at i+1"],
    ),
    "maximum-subarray": viva3(
        "What is the time cost of Kadane versus trying every subarray?",
        ["Kadane O(n)", "brute O(n^2)", "one running best ending here"],
        "Why must the subarray be nonempty, and what do you return for an all-negative array?",
        ["at least one element", "largest single element if all negative", "cannot take empty sum"],
        "When do you reset the running sum instead of extending it?",
        ["when extending hurts", "start fresh at current index", "track global max each step"],
    ),
    "best-time-buy-sell-stock": viva3(
        "How does one forward scan find the best buy/sell pair in O(n)?",
        ["track minimum price so far", "profit = price - min", "update best profit"],
        "What do you return when prices only fall?",
        ["profit zero", "never sell at a loss", "no positive difference"],
        "Why is remembering the lowest price behind you enough to judge today's sell?",
        ["best buy is the min so far", "future days handled later", "single pass sufficient"],
    ),
    "longest-consecutive-sequence": viva3(
        "How do you get longer than sorting when finding consecutive runs?",
        ["hash set of values", "only start a run at a missing left neighbor", "O(n) expected"],
        "What happens with duplicates in nums?",
        ["set removes duplicates", "length counts distinct values", "repeats do not extend a run"],
        "Why only expand a streak when num-1 is absent?",
        ["ensures each run starts once", "avoids recounting middles", "amortized linear work"],
    ),
    "move-zeros": viva3(
        "What is the time and extra-space cost of the two-write-pointer scan?",
        ["O(n) time", "O(1) extra space", "single pass over arr"],
        "How do you keep the relative order of nonzero values?",
        ["write nonzeros from the left in order", "fill remaining with zeros", "stable among nonzeros"],
        "Why can you overwrite zeros early without losing information?",
        ["zeros are reconstructed at the end", "only nonzero values must be preserved in order", "write index trails read"],
    ),
    "remove-duplicates-sorted": viva3(
        "Why is the same-direction write pointer O(n) on a sorted array?",
        ["each index visited once", "write unique values forward", "O(1) extra memory"],
        "What is the result length when every element is identical?",
        ["length 1", "only first value kept", "write pointer barely moves"],
        "Why does sorting make comparing to the previous unique value enough?",
        ["duplicates sit adjacent", "unsorted would need a set", "next different value is the next unique"],
    ),
    "reverse-array": viva3(
        "What is the time and space cost of swapping from both ends?",
        ["O(n) time", "O(1) extra space", "about n/2 swaps"],
        "What happens on an empty list or a single-element list?",
        ["already reversed", "loop does not run", "return same object"],
        "Why stop when left meets or passes right?",
        ["middle already placed", "further swaps undo work", "two pointers cross"],
    ),
    # ---- two-pointers ----
    "valid-palindrome": viva3(
        "Why can two pointers check a palindrome in linear time?",
        ["one left and one right", "each character visited once", "O(1) extra space"],
        "What happens when the string length is 0 or 1?",
        ["vacuously true", "pointers meet immediately", "return true"],
        "Why do you move inward only after a matching pair?",
        ["mismatch means false", "matched ends shrink the range", "invariant: outer checked"],
    ),
    "two-sum-sorted": viva3(
        "How do opposite ends find a target sum in O(n) on a sorted array?",
        ["left smallest right largest", "move left if sum too small", "move right if sum too large"],
        "Why must you not reuse the same index?",
        ["i < j required", "one element cannot pair with itself", "pointers start at different ends"],
        "Why does sorting let you discard half the possibilities each move?",
        ["monotonic sums", "increasing left raises sum", "decreasing right lowers sum"],
    ),
    "three-sum": viva3(
        "What is the typical time cost of fixing one value and scanning with two pointers?",
        ["O(n^2)", "outer loop times linear two-pointer", "sorting O(n log n) upfront"],
        "How do you avoid duplicate triplets in the output?",
        ["skip equal values after a pick", "canonical sorted triples", "dedupe on each pointer move"],
        "Why advance the left pointer when the sum is too small?",
        ["array sorted", "larger left value increases sum", "right moves when sum too big"],
    ),
    "container-with-most-water": viva3(
        "Why is the two-pointer area search O(n) instead of O(n^2) pairs?",
        ["start at both ends", "move the shorter side", "each index discarded once"],
        "What area do you get when all heights are zero?",
        ["area zero", "min height zero", "no water"],
        "Why move the pointer at the shorter line rather than the taller one?",
        ["width shrinks either way", "taller side cannot increase min height alone", "short side is the bottleneck"],
    ),
    "trapping-rain-water": viva3(
        "How can two pointers trap water in O(n) time and O(1) extra space?",
        ["track left_max and right_max", "fill from the side with smaller max", "single pass"],
        "What happens on a strictly increasing height array?",
        ["no water trapped", "left_max always grows", "nothing bounded on the right yet"],
        "Why does water at i equal max_so_far - height[i] on the bounded side?",
        ["water level set by the lower bounding max", "bar itself displaces that much", "cannot exceed the opposite bound"],
    ),
    "squares-of-sorted-array": viva3(
        "Why fill the output from the right with two pointers on a sorted (possibly negative) array?",
        ["largest square is at an end", "compare abs of left and right", "O(n) merge into result"],
        "Where do zeros go in the squared output?",
        ["near the front", "zero square is smallest", "pointers meet around zero"],
        "Why can a negative left value beat a positive right value for the next largest square?",
        ["square depends on magnitude", "more negative means larger square", "compare absolute values"],
    ),
    "sort-colors": viva3(
        "What is the time and space cost of the Dutch-national-flag three-way partition?",
        ["O(n) one pass", "O(1) extra space", "three pointers low mid high"],
        "What if the array contains only 2s?",
        ["high shrinks to the start", "mid never swaps a 0 or 1", "still sorted"],
        "Why swap 0s to the left and 2s to the right while scanning mid?",
        ["keeps 1s in the middle band", "invariant on [0,low) and (high,end]", "mid explores unknowns"],
    ),

    # ---- sliding-window ----
    "max-sum-subarray-k": viva3(
        "Why is a fixed window of size k O(n) instead of resuming each window from scratch?",
        ["slide by removing left and adding right", "O(n) total", "each element enters and leaves once"],
        "What if n < k?",
        ["no valid window", "cannot form size k", "handle as empty/invalid per statement"],
        "Why does subtracting the leaving element keep the sum correct?",
        ["window membership changes by one", "old left no longer counted", "new right is included"],
    ),
    "maximum-average-subarray": viva3(
        "How do you find the maximum average of a length-k window in linear time?",
        ["track window sum", "average = sum/k", "slide across the array"],
        "What edge case appears when k equals the array length?",
        ["only one window", "answer is the full average", "loop barely slides"],
        "Why maximizing the sum is enough to maximize the average for fixed k?",
        ["k constant", "sum and average share the same argmax", "no need to compare averages separately"],
    ),
    "permutation-in-string": viva3(
        "Why does a fixed window the size of s1 detect a permutation in s2 in linear time?",
        ["window length = len(s1)", "compare character counts", "slide across s2"],
        "What happens when s2 is shorter than s1?",
        ["impossible", "return false", "no window fits"],
        "Why matching frequency counts proves a permutation?",
        ["same multiset of characters", "order inside the window does not matter", "counts equal means rearrangement"],
    ),
    "longest-unique-window": viva3(
        "How does a variable window find the longest substring without repeats in O(n)?",
        ["expand right", "shrink left on duplicate", "each index moves at most once"],
        "What is the answer for an empty string or all unique characters?",
        ["empty → 0", "all unique → full length", "window never shrinks if unique"],
        "Why move left past the previous index of a repeated character?",
        ["restores uniqueness", "discard the old occurrence", "invariant: window has distinct chars"],
    ),
    "longest-repeating-character-replacement": viva3(
        "What is the cost of the variable window that tracks the richest character count?",
        ["O(n) with a count map", "window valid when length - maxf <= k", "left advances when invalid"],
        "What if k is 0?",
        ["no changes allowed", "longest run of identical chars", "shrink on any mismatch"],
        "Why is length - max_frequency the number of replacements needed?",
        ["keep the most common char", "others must change", "k budgets those changes"],
    ),
    "min-window-sum-at-least-k": viva3(
        "How does shrinking a variable window find the shortest subarray with sum ≥ k?",
        ["expand right to grow sum", "shrink left while sum still ≥ k", "track min length"],
        "What do you return when no subarray reaches k?",
        ["0 or sentinel per statement", "never update the minimum", "full scan still fails"],
        "Why can you shrink from the left greedily once the sum is large enough?",
        ["removing left only decreases sum", "shorter window is better", "stop when sum would fall below k"],
    ),
    "minimum-window-substring": viva3(
        "Why is the minimum window covering all of t typically O(|s| + |t|) with counts?",
        ["expand until need satisfied", "shrink while still covering", "each pointer moves once"],
        "What if t has characters that never appear in s?",
        ["impossible", "return empty string", "need counter never hits zero"],
        "Why track how many distinct requirements are currently satisfied?",
        ["know when window is valid", "increment when a count hits its target", "decrement when shrinking breaks a target"],
    ),
    # ---- linked-lists ----
    "reverse-linked-list": viva3(
        "What is the time and space cost of iteratively reversing a linked list?",
        ["O(n) time", "O(1) extra pointers", "each next rewired once"],
        "What are the head and next of an empty list or a one-node list after reverse?",
        ["empty stays empty", "single node remains head", "loop body skipped"],
        "Why must you save curr.next before rewiring curr.next to prev?",
        ["otherwise lose the rest of the list", "prev becomes new predecessor", "advance curr to saved next"],
    ),
    "merge-two-sorted-lists": viva3(
        "Why is merging two sorted lists linear in their combined length?",
        ["one pass with two pointers", "always take the smaller head", "O(1) extra besides output links"],
        "What if one list is empty?",
        ["answer is the other list", "dummy next points to remaining", "no comparisons needed"],
        "Why attach the remainder of the non-exhausted list at the end?",
        ["already sorted", "all its values are ≥ last chosen", "no further interleaving"],
    ),
    "has-cycle": viva3(
        "How do fast and slow pointers detect a cycle in O(n) time and O(1) space?",
        ["slow one step fast two", "meet ⇒ cycle", "no extra set of nodes"],
        "What happens on an empty list or a single node without a self-loop?",
        ["no cycle", "fast becomes null", "return false"],
        "Why must they eventually meet if a cycle exists?",
        ["fast closes the gap inside the loop", "relative speed one", "cannot skip forever"],
    ),
    "find-middle": viva3(
        "Why does fast advancing twice as fast land slow on the middle?",
        ["fast reaches end when slow at mid", "O(n) time", "O(1) space"],
        "What middle do you pick for an even-length list?",
        ["follow the problem’s convention", "often the second middle", "fast null check chooses it"],
        "Why is no length counter required?",
        ["two pointers encode the ratio", "single pass enough", "length unknown upfront"],
    ),
    "remove-nth-node-from-end": viva3(
        "How does a lead pointer n steps ahead remove the nth-from-end in one pass?",
        ["gap of n between pointers", "when lead hits end, drop follower’s next", "O(n) time"],
        "What if n equals the length of the list?",
        ["remove the head", "dummy node helps", "new head is old second"],
        "Why does the gap of n place follower just before the victim?",
        ["lead at null means follower at predecessor", "rewire next", "victim unlinked"],
    ),
    "palindrome-linked-list": viva3(
        "How can you check a palindrome list in O(n) time and O(1) extra space?",
        ["find middle", "reverse second half", "compare halves"],
        "What about a one-node or two-node list?",
        ["one node true", "two nodes compare equality", "middle finding still works"],
        "Why reverse only the second half?",
        ["compare forward vs reversed tail", "first half stays intact", "values must mirror"],
    ),
    "add-two-numbers": viva3(
        "Why is adding digit-by-digit with a carry O(max(m, n))?",
        ["one pass over both lists", "carry is 0 or 1 mostly", "output length at most max+1"],
        "What if the final carry is still 1 after both lists end?",
        ["append an extra node", "value 1", "do not drop the carry"],
        "Why process least-significant digits first as given?",
        ["lists already store reverse order", "carry flows to the next more significant digit", "matches paper addition"],
    ),
    "reorder-list": viva3(
        "Outline the O(n) reorder: middle, reverse, merge.",
        ["find mid", "reverse second half", "interleave nodes"],
        "What happens on lists of length 0, 1, or 2?",
        ["already ordered", "little or no merge work", "mid finding handles shorts"],
        "Why split before reversing the second half?",
        ["avoid cycles", "first half ends with null", "clean interleave"],
    ),
    # ---- trees ----
    "max-depth-binary-tree": viva3(
        "What is the time cost of a recursive max-depth walk?",
        ["visit each node once", "O(n) time", "stack O(h)"],
        "What is the depth of an empty tree?",
        ["0", "null base case", "no nodes"],
        "Why is depth 1 + max(left, right)?",
        ["edge down to a child", "taller subtree wins", "combine after recursion"],
    ),
    "invert-binary-tree": viva3(
        "Why is inverting a binary tree O(n)?",
        ["swap every node’s children", "each node once", "recursion or BFS"],
        "What happens at a null node?",
        ["return null", "base case", "nothing to swap"],
        "Why swap left and right before or after recursing still works?",
        ["all nodes eventually swapped", "structure mirrored", "order of subtree invert commuting"],
    ),
    "same-tree": viva3(
        "How do you compare two trees in linear time?",
        ["recurse on pairs of nodes", "values and structure", "O(n)"],
        "When are two null roots considered the same?",
        ["both empty", "true", "structure matches"],
        "Why does a null vs non-null mismatch fail immediately?",
        ["shapes differ", "no need to compare values", "short-circuit false"],
    ),
    "subtree-of-another-tree": viva3(
        "What is a typical cost to test whether subRoot appears inside root?",
        ["walk root", "same-tree checks at candidates", "O(n m) worst case"],
        "What if subRoot is null or root is null?",
        ["null subtree often true", "null root only if subRoot null", "follow statement"],
        "Why must values and structure both match for a subtree?",
        ["same-tree on the aligned roots", "extra child breaks it", "isomorphism of that fragment"],
    ),
    "binary-tree-level-order-traversal": viva3(
        "Why is BFS level order O(n)?",
        ["each node enqueued once", "queue by levels", "output size n"],
        "What does an empty tree return?",
        ["empty list", "no levels", "queue never starts"],
        "Why snapshot the queue size at the start of a level?",
        ["know how many nodes belong to this level", "children go to next level", "clean grouping"],
    ),
    "balanced-binary-tree": viva3(
        "How can you detect height-balance in one O(n) DFS?",
        ["return height or -1 sentinel", "check |left-right| <= 1", "bubble failure up"],
        "Is a single-node tree balanced?",
        ["yes", "height 1 or 0 convention consistent", "no children skew"],
        "Why abort early when a subtree returns unbalanced?",
        ["whole tree fails", "no need for further height", "propagate sentinel"],
    ),
    "diameter-of-binary-tree": viva3(
        "Why can diameter be found in one DFS that returns heights?",
        ["path through node = left height + right height", "track global max", "O(n)"],
        "What is the diameter of a single-node tree?",
        ["0", "no edges", "heights zero"],
        "Why is the longest path not always through the root?",
        ["deepest path may sit in a subtree", "update global at every node", "root-only would miss it"],
    ),
    "validate-binary-search-tree": viva3(
        "How do bounds (low, high) validate a BST in O(n)?",
        ["each node in (low, high)", "left gets high=node", "right gets low=node"],
        "What fails if you only compare a node to its direct children?",
        ["deeper violation possible", "need ancestor bounds", "classic counterexample"],
        "Why are the allowed ranges open at the node’s value?",
        ["BST forbids duplicates or strict inequality", "left must be < node", "right must be > node"],
    ),
    "kth-smallest-element-in-a-bst": viva3(
        "Why does inorder traversal of a BST yield sorted values?",
        ["left root right", "BST invariant", "kth in sorted order"],
        "What if k = 1?",
        ["leftmost node", "minimum", "inorder first visit"],
        "Why can you stop once you have visited k nodes?",
        ["further nodes are larger", "early exit", "no full traversal required"],
    ),
    "lowest-common-ancestor-of-a-bst": viva3(
        "How do you find the LCA in a BST without scanning the whole tree?",
        ["walk from root", "both values on one side → go there", "split → current is LCA"],
        "What if one value is the ancestor of the other?",
        ["ancestor is the LCA", "walk stops at that node", "still correct"],
        "Why does a split in BST search paths identify the LCA?",
        ["paths diverge there", "shared prefix ends", "all ancestor properties hold"],
    ),
    # ---- graphs ----
    "number-of-islands": viva3(
        "Why is DFS/BFS flood-fill O(m n) on the grid?",
        ["each cell visited once", "mark land as seen", "islands counted at new lands"],
        "What does an all-water grid return?",
        ["0 islands", "never start a flood", "no '1' cells"],
        "Why mark a cell visited when you start flooding it?",
        ["avoid recounting", "prevent revisiting neighbors", "connects the component"],
    ),
    "flood-fill": viva3(
        "What is the time cost of flooding a connected same-color region?",
        ["O(m n) worst case", "each cell at most once", "DFS or BFS"],
        "What if the starting cell already has the new color?",
        ["nothing to do", "avoid infinite loop", "return grid unchanged"],
        "Why only recolor 4-neighbors with the original color?",
        ["connectivity rule", "different colors block the flood", "keeps other regions intact"],
    ),
    "max-area-of-island": viva3(
        "How do you compute the largest island area in O(m n)?",
        ["flood each unvisited land", "count cells per component", "track max"],
        "What is the area when there is no land?",
        ["0", "max stays 0", "no floods start"],
        "Why add 1 for the current cell plus recursive neighbor areas?",
        ["cell is land", "neighbors extend the island", "disjoint cells counted once via visited"],
    ),
    "bfs-shortest-path": viva3(
        "Why does BFS give the shortest path length in an unweighted graph?",
        ["explore by distance layers", "first time reached is minimal hops", "queue order"],
        "What if the destination is unreachable?",
        ["return -1 or sentinel", "queue empties", "never dequeued target"],
        "Why mark visited when enqueuing rather than when dequeuing?",
        ["avoid duplicate queue entries", "first enqueue is shortest", "keeps BFS efficient"],
    ),
    "rotting-oranges": viva3(
        "Why is multi-source BFS natural for rotting oranges?",
        ["all initial rotten in the queue", "minutes = layers", "fresh count tracks remaining"],
        "What if a fresh orange is sealed away from any rotten one?",
        ["impossible", "return -1", "fresh remain after BFS"],
        "Why process the queue level by level?",
        ["one minute per layer", "simultaneous rot", "distance from nearest rotten"],
    ),
    "course-schedule": viva3(
        "How does topological sort detect whether all courses can be finished?",
        ["Kahn or DFS cycle detect", "indegrees / visiting state", "cycle ⇒ false"],
        "What about a graph with no edges?",
        ["all courses ok", "any order", "return true"],
        "Why does a remaining node with indegree > 0 after Kahn mean failure?",
        ["cycle holds references", "cannot take that course", "topo incomplete"],
    ),
    "graph-valid-tree": viva3(
        "What two properties make an undirected graph a tree?",
        ["connected", "n-1 edges or acyclic", "exactly one way between nodes"],
        "What if edges > n-1?",
        ["cycle exists", "not a tree", "reject"],
        "Why does Union-Find failing a unite prove a cycle?",
        ["endpoints already same component", "extra edge", "breaks tree"],
    ),
    "count-components": viva3(
        "How do you count connected components in O(n + m)?",
        ["DFS/BFS from unvisited nodes", "each start is a component", "mark visited"],
        "What is the count for n nodes and no edges?",
        ["n components", "each node alone", "loop starts n times"],
        "Why not start a new DFS from an already visited node?",
        ["already counted", "would double-count", "belongs to prior component"],
    ),
    # ---- dynamic-programming ----
    "climb-stairs": viva3(
        "Why is climbing stairs a linear DP instead of exponential recursion?",
        ["dp[i]=dp[i-1]+dp[i-2]", "each i once", "O(n) time"],
        "What are the base answers for 1 and 2 steps?",
        ["1 way for 1", "2 ways for 2", "seed the recurrence"],
        "Why does the recurrence add the previous two states?",
        ["last step size 1 or 2", "disjoint cases", "cover all paths"],
    ),
    "fibonacci-dp": viva3(
        "How does bottom-up Fibonacci avoid the exponential recursion tree?",
        ["store prior two values", "each n computed once", "O(n) time O(1) space possible"],
        "What are F(0) and F(1)?",
        ["0 and 1", "base cases", "start the loop"],
        "Why is F(n) = F(n-1) + F(n-2) enough?",
        ["definition of Fibonacci", "overlapping subproblems reused", "no missing branches"],
    ),
    "house-robber": viva3(
        "Why does House Robber use a choose/skip DP in linear time?",
        ["dp[i]=max(dp[i-1], dp[i-2]+nums[i])", "O(n)", "cannot take adjacent"],
        "What if the array has one house?",
        ["take that value", "base case", "no adjacency issue"],
        "Why is skipping the previous house sometimes better?",
        ["taking i-1 blocks i", "max of skip vs take", "local choice builds global opt"],
    ),
    "house-robber-ii": viva3(
        "How do you handle the circular constraint with two linear robber passes?",
        ["rob range [0..n-2]", "rob range [1..n-1]", "take the max"],
        "What about n = 1?",
        ["only one house", "return that value", "ranges collapse"],
        "Why can the first and last houses not both be robbed?",
        ["they are adjacent in a circle", "two passes exclude one end each", "covers both options"],
    ),
    "coin-change": viva3(
        "What does dp[x] represent in coin change, and what is the time cost?",
        ["fewest coins for amount x", "O(amount * coins)", "min over coin transitions"],
        "What do you return when amount cannot be formed?",
        ["-1", "dp stays at infinity sentinel", "unreachable state"],
        "Why does trying each coin from a reachable x preserve optimality?",
        ["optimal substructure", "min of candidates", "unlimited coin use"],
    ),
    "word-break": viva3(
        "What does a True at dp[i] mean in word break?",
        ["prefix s[:i] can be segmented", "dict word ending at i", "O(n^2) typical"],
        "What about an empty string?",
        ["dp[0]=True", "vacuous segmentation", "base for later"],
        "Why check every j < i with dp[j] and s[j:i] in the dict?",
        ["split after a good prefix", "word completes the gap", "OR over splits"],
    ),
    "longest-increasing-subsequence": viva3(
        "What is a simple O(n^2) DP for LIS length?",
        ["dp[i]=max over j<i with nums[j]<nums[i]", "plus one", "answer max dp"],
        "What is LIS length for a strictly decreasing array?",
        ["1", "no ascent", "each dp[i]=1"],
        "Why only extend from a strictly smaller previous value?",
        ["strictly increasing required", "equal values blocked", "subsequence order preserved"],
    ),
    "unique-paths": viva3(
        "Why is the grid path count DP O(m n)?",
        ["dp[r][c]=from above + from left", "each cell once", "only right/down moves"],
        "How many paths exist in a 1×n grid?",
        ["exactly 1", "only right moves", "fill first row with ones"],
        "Why are the first row and column all ones?",
        ["only one way along the border", "no choice of turns", "base for the recurrence"],
    ),
    "longest-common-subsequence": viva3(
        "What does dp[i][j] mean for LCS of two prefixes?",
        ["LCS length of text1[:i] and text2[:j]", "O(m n) fill", "match → +1 diagonal else max"],
        "What is LCS length when one string is empty?",
        ["0", "first row/col zeros", "nothing to match"],
        "Why do equal characters take the diagonal + 1?",
        ["extend a common subsequence", "use that match", "otherwise skip a char via max"],
    ),
    "decode-ways": viva3(
        "What recurrence counts decode ways for a digit string?",
        ["single digit 1-9", "two-digit 10-26", "dp[i] sum of valid priors"],
        "Why does a leading zero make the whole string invalid?",
        ["no mapping for 0 alone", "cannot start a code", "dp stays 0"],
        "When can you use two digits ending at i?",
        ["value between 10 and 26", "previous prefix nonzero ways", "add dp[i-2]"],
    ),
    # ---- stack ----
    "valid-parentheses": viva3(
        "Why does a stack validate brackets in O(n)?",
        ["push openers", "pop on matching closer", "empty at end"],
        "What fails on a single closing bracket or an unclosed opener?",
        ["stack empty on closer", "leftover openers", "return false"],
        "Why must the popped opener match the closer’s type?",
        ["ordering nested correctly", "wrong type means mismatch", "LIFO remembers latest opener"],
    ),
    "daily-temperatures": viva3(
        "How does a monotonic stack compute next warmer days in O(n)?",
        ["store indices decreasing by temp", "pop when warmer found", "difference of indices"],
        "What answer do you store when no warmer day exists?",
        ["0", "index left on stack", "end of array"],
        "Why keep the stack decreasing in temperature?",
        ["first warmer is the next greater", "discard colder days that can never be answers", "amortized one pop each"],
    ),
    "evaluate-reverse-polish-notation": viva3(
        "Why is RPN evaluation with a stack O(n) in the tokens?",
        ["push numbers", "pop two on operator", "one pass"],
        "How does division truncate toward zero here?",
        ["int(a/b) in Python 3 via trunc", "not floor for negatives", "match the statement"],
        "Why is the right operand popped before the left?",
        ["stack LIFO", "expression order", "a op b needs a then b"],
    ),
    "largest-rectangle-in-histogram": viva3(
        "How does a monotonic stack find the largest rectangle in O(n)?",
        ["increasing heights indices", "pop when smaller bar arrives", "width from new bounds"],
        "What about a single bar or all equal heights?",
        ["area = height * 1 or n", "stack drains at end", "sentinel zero helps"],
        "Why does a smaller bar to the right bound the width of taller bars?",
        ["cannot extend past a shorter neighbor", "pop computes area", "left bound is new stack top"],
    ),
    "generate-parentheses": viva3(
        "What constrains adding '(' vs ')' while generating n pairs?",
        ["open < n to add '('", "close < open to add ')'", "build only valid prefixes"],
        "Why return the strings in lexicographic order?",
        ["statement requires sorted", "canonical grading", "sort at the end if needed"],
        "Why never allow more closers than openers in a prefix?",
        ["would be invalid", "balance invariant", "stack view of openers"],
    ),
    # ---- binary-search ----
    "binary-search": viva3(
        "Why is classic binary search O(log n) on a sorted array?",
        ["halve the range each step", "mid comparison", "left/right move"],
        "What do you return when the target is absent?",
        ["-1", "range becomes empty", "left > right"],
        "Why must the array be sorted for this discard to be safe?",
        ["order decides which half can hold target", "unsorted breaks the invariant", "mid comparison meaningless otherwise"],
    ),
    "search-insert-position": viva3(
        "How does binary search also find the insertion index?",
        ["same left/right loop", "final left is insert point", "O(log n)"],
        "Where do you insert a value smaller than all elements?",
        ["index 0", "left stays 0", "all mids go right"],
        "Why is left the correct insertion index when the target is missing?",
        ["first index with value >= target", "invariants on the bounds", "keeps sorted order"],
    ),
    "search-a-2d-matrix": viva3(
        "How do you binary-search a row-major sorted matrix in O(log(m n))?",
        ["treat as 1D index", "mid → row=mid//cols col=mid%cols", "compare to target"],
        "What if the matrix has a single cell?",
        ["one comparison", "return equality", "left=right=0"],
        "Why is flattening valid here?",
        ["rows sorted and row starts increase", "global sorted order", "1D binary search applies"],
    ),
    "koko-eating-bananas": viva3(
        "Why binary-search the eating speed on a monotonic feasibility check?",
        ["higher k always finishes by h if lower does", "search min k", "O(n log maxpile)"],
        "What is the smallest possible k you should consider?",
        ["1", "at least one banana per hour", "left bound"],
        "Why can you discard speeds above a feasible mid?",
        ["looking for minimum", "right = mid", "still feasible region shrinks down"],
    ),
    "find-minimum-in-rotated-sorted-array": viva3(
        "How do you find the minimum in a rotated sorted array in O(log n)?",
        ["compare mid to right", "go toward the unsorted half", "left/right converge"],
        "What if the array was never rotated?",
        ["already sorted", "nums[left] is min", "mid < right always"],
        "Why does nums[mid] > nums[right] mean the min is to the right of mid?",
        ["rotation cut on the right", "left side is large sorted run", "discard mid and left"],
    ),
    "search-in-rotated-sorted-array": viva3(
        "How do you search a target in a rotated sorted array in O(log n)?",
        ["identify sorted half", "see if target lies inside", "discard the other half"],
        "What if the target is missing?",
        ["-1", "range empties", "never equal mid"],
        "Why is one of the two halves always sorted after rotation?",
        ["single pivot cut", "mid falls in a monotone side", "enables binary decision"],
    ),

}


def pattern_fallback(problem: dict) -> list[dict]:
    """Topic/pattern-aware fallback when an id is missing from VIVA."""
    title = problem["title"]
    pattern = problem.get("pattern") or "this pattern"
    topic = problem.get("topic") or "this topic"
    fn = problem.get("function_name") or "the function"
    return viva3(
        f"For {title}, what time complexity should a solid {pattern} solution target, and why?",
        [
            f"better than brute force for {title}",
            f"{pattern} keeps work near-linear or log-factor",
            "name the big-O of the main loop",
        ],
        f"Name a key edge case for {title} (empty/minimal input, duplicates, or boundaries) and the correct behavior.",
        [
            "identify a boundary input",
            "state the correct return value",
            f"relate it to {fn}",
        ],
        f"In one sentence, why does the core {pattern} step in {title} make progress without breaking correctness?",
        [
            f"explain the key update in {pattern}",
            "invariant or discarded region",
            f"ties back to {topic}",
        ],
    )


def enrich(problem: dict) -> list[dict]:
    pid = problem["id"]
    if pid in VIVA:
        return VIVA[pid]
    return pattern_fallback(problem)


def apply_topic(topic: str) -> int:
    count = 0
    for path in sorted(PROBLEMS.glob("*.json")):
        data = json.loads(path.read_text())
        if data.get("topic") != topic:
            continue
        data["viva"] = enrich(data)
        path.write_text(json.dumps(data, indent=2) + "\n")
        count += 1
    return count


def main(argv: list[str]) -> None:
    topics = argv[1:] or [
        "arrays",
        "two-pointers",
        "sliding-window",
        "linked-lists",
        "trees",
        "graphs",
        "dynamic-programming",
        "stack",
        "binary-search",
    ]
    for topic in topics:
        n = apply_topic(topic)
        print(f"{topic}: {n} problems updated")


if __name__ == "__main__":
    main(sys.argv)
