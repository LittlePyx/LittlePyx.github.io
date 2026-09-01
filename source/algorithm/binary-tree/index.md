---
title: 代码随想录刷题笔记：二叉树递归体系
date:
top_img: /img/algorithm-header-code.webp
description: 二叉树递归体系刷题笔记，整理前中后序遍历、层序遍历、深度高度、路径问题、构造二叉树、BST 和最近公共祖先。
categories:
  - Notes
  - Algorithm
tags:
  - LeetCode
  - CodeThinking
  - Python
  - Binary Tree
  - Recursion
toc: true
toc_number: false
katex: true
---

<div class="algorithm-module-nav algorithm-module-nav-top">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/stack-queue/">上一篇：栈与队列</a>
  <a href="/algorithm/backtracking/">下一篇：回溯算法模板</a>
</div>

## 1. 怎么看二叉树题

二叉树题最重要的不是记住很多遍历代码，而是想清楚：**当前节点要从左右子树拿什么信息，又要把什么信息返回给父节点。**

链表题考“指针怎么变”，数组题考“下标怎么动”，二叉树题考“递归怎么分工”。每个节点都可以看成一个小问题：

- 我在当前节点要做什么？
- 左子树和右子树分别能给我什么？
- 我要把什么结果返回给上一层？

LeetCode 里的树节点通常长这样：

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
```

刷二叉树题时，我先按题目目标分类：

- 要输出节点顺序：前序、中序、后序、层序。
- 要算高度、深度、节点数、是否平衡：重点是递归返回值。
- 要判断两棵树是否相同、是否对称、是否翻转：重点是成对比较。
- 要找路径、路径和、所有根到叶子路径：重点是回溯和叶子节点判断。
- 要构造树：重点是用遍历序列切分左右子树。
- 遇到 BST：优先利用中序有序、左小右大。
- 要找最近公共祖先：重点是“左右子树有没有目标节点”。

二叉树递归可以先记一句话：**先定义函数含义，再写空节点，再处理左右子树，最后组织返回值。** 不要一上来就写代码，先把递归函数当成一个可靠工具。

## 2. 遍历顺序：递归里当前节点放在哪里

前序、中序、后序的区别，本质是当前节点 `root` 的处理位置：

```text
前序：中 左 右
中序：左 中 右
后序：左 右 中
```

[144. 二叉树的前序遍历](https://leetcode.cn/problems/binary-tree-preorder-traversal/) 要返回前序遍历结果。前序适合“先处理当前节点，再处理子树”的场景，比如复制树、序列化树、从根开始传递状态。

```python
def preorder_traversal(root: TreeNode | None) -> list[int]:
    ans = []

    def dfs(node: TreeNode | None) -> None:
        if not node:
            return

        ans.append(node.val)
        dfs(node.left)
        dfs(node.right)

    dfs(root)
    return ans
```

这里 `dfs(node)` 的含义是：把以 `node` 为根的子树按前序加入 `ans`。空节点什么都不做。

[94. 二叉树的中序遍历](https://leetcode.cn/problems/binary-tree-inorder-traversal/) 对普通二叉树只是遍历顺序，对 BST 特别重要，因为 BST 的中序遍历是递增序列。

```python
def inorder_traversal(root: TreeNode | None) -> list[int]:
    ans = []

    def dfs(node: TreeNode | None) -> None:
        if not node:
            return

        dfs(node.left)
        ans.append(node.val)
        dfs(node.right)

    dfs(root)
    return ans
```

[145. 二叉树的后序遍历](https://leetcode.cn/problems/binary-tree-postorder-traversal/) 适合“先拿左右子树结果，再处理当前节点”的题，比如高度、平衡二叉树、删除树、判断子树信息。

```python
def postorder_traversal(root: TreeNode | None) -> list[int]:
    ans = []

    def dfs(node: TreeNode | None) -> None:
        if not node:
            return

        dfs(node.left)
        dfs(node.right)
        ans.append(node.val)

    dfs(root)
    return ans
```

复习遍历时不要只背“三种顺序”。真正做题时要问：当前节点的答案能不能在访问左右子树前确定？如果能，偏前序；如果必须依赖左右子树返回值，偏后序；如果是 BST，先想中序。

## 3. 迭代遍历：栈保存还没处理完的节点

递归本质上依赖系统调用栈。迭代写法就是自己维护一个栈。

前序迭代比较直观：弹出当前节点，先记录它，再把右孩子、左孩子依次入栈。因为栈是后进先出，左孩子后入栈，反而会先被处理。

```python
def preorder_traversal(root: TreeNode | None) -> list[int]:
    if not root:
        return []

    stack = [root]
    ans = []

    while stack:
        node = stack.pop()
        ans.append(node.val)

        if node.right:
            stack.append(node.right)
        if node.left:
            stack.append(node.left)

    return ans
```

中序迭代更像“沿着左边一路走到底，然后回头处理节点，再去右边”：

```python
def inorder_traversal(root: TreeNode | None) -> list[int]:
    stack = []
    ans = []
    cur = root

    while cur or stack:
        while cur:
            stack.append(cur)
            cur = cur.left

        cur = stack.pop()
        ans.append(cur.val)
        cur = cur.right

    return ans
```

这段代码里，`stack` 保存的是“左链上还没处理的祖先节点”。当 `cur` 走到空，说明左边已经到底了，这时弹出最近的祖先处理，再转向它的右子树。

后序迭代可以用“前序变形再反转”：前序是中左右，如果我们改成中右左，最后反转就是左右中。

```python
def postorder_traversal(root: TreeNode | None) -> list[int]:
    if not root:
        return []

    stack = [root]
    ans = []

    while stack:
        node = stack.pop()
        ans.append(node.val)

        if node.left:
            stack.append(node.left)
        if node.right:
            stack.append(node.right)

    return ans[::-1]
```

迭代遍历的易错点是入栈顺序。前序要得到中左右，所以入栈时先右后左；后序变形要得到中右左，所以入栈时先左后右。

## 4. 层序遍历：队列按层推进

层序遍历不是递归主导，而是队列主导。队列里放当前层还没处理的节点；每次循环先固定当前队列长度，这个长度就是这一层的节点数。

[102. 二叉树的层序遍历](https://leetcode.cn/problems/binary-tree-level-order-traversal/) 要按层返回节点值：

```python
from collections import deque


def level_order(root: TreeNode | None) -> list[list[int]]:
    if not root:
        return []

    q = deque([root])
    ans = []

    while q:
        level = []
        size = len(q)

        for _ in range(size):
            node = q.popleft()
            level.append(node.val)

            if node.left:
                q.append(node.left)
            if node.right:
                q.append(node.right)

        ans.append(level)

    return ans
```

这里 `size = len(q)` 必须在进入当前层循环之前固定。因为循环过程中会不断把下一层节点加进队列，如果直接 `while q` 处理，就会把多层混在一起。

很多层序题都是这个框架的变形：

- [107. 二叉树的层序遍历 II](https://leetcode.cn/problems/binary-tree-level-order-traversal-ii/)：最后把 `ans` 反转。
- [199. 二叉树的右视图](https://leetcode.cn/problems/binary-tree-right-side-view/)：每层取最后一个节点。
- [637. 二叉树的层平均值](https://leetcode.cn/problems/average-of-levels-in-binary-tree/)：每层求和除以节点数。
- [515. 在每个树行中找最大值](https://leetcode.cn/problems/find-largest-value-in-each-tree-row/)：每层取最大值。
- [116. 填充每个节点的下一个右侧节点指针](https://leetcode.cn/problems/populating-next-right-pointers-in-each-node/)：每层把相邻节点连起来。

层序题的关键不是“会用队列”，而是明确每次循环处理的是一整层，还是单个节点。如果题目出现“每一层”“最底层”“右视图”“层平均”，优先想层序。

## 5. 高度、深度、节点数：先设计返回值

二叉树递归题里，返回值设计比代码更重要。

[104. 二叉树的最大深度](https://leetcode.cn/problems/maximum-depth-of-binary-tree/) 要求从根到最远叶子节点的节点数。函数可以定义成：`max_depth(node)` 返回以 `node` 为根的树的最大深度。

```python
def max_depth(root: TreeNode | None) -> int:
    if not root:
        return 0

    left = max_depth(root.left)
    right = max_depth(root.right)

    return max(left, right) + 1
```

这就是后序：先拿左右子树深度，再加上当前节点这一层。

[111. 二叉树的最小深度](https://leetcode.cn/problems/minimum-depth-of-binary-tree/) 容易错。最小深度是到最近叶子节点的深度，叶子节点必须左右孩子都为空。不能简单写 `min(left, right) + 1`，因为如果某一边为空，深度是 0，但这不是一条到叶子的路径。

```python
def min_depth(root: TreeNode | None) -> int:
    if not root:
        return 0

    if not root.left:
        return min_depth(root.right) + 1

    if not root.right:
        return min_depth(root.left) + 1

    return min(min_depth(root.left), min_depth(root.right)) + 1
```

比如只有右孩子的一条链，左子树深度是 0，但不能说最小深度是 1，因为根节点不是叶子。

[110. 平衡二叉树](https://leetcode.cn/problems/balanced-binary-tree/) 要判断每个节点左右子树高度差是否不超过 1。普通写法每个节点都反复算高度，容易变成 $O(n^2)$。更好的写法是让递归返回高度；如果子树已经不平衡，就返回 `-1` 作为失败信号。

```python
def is_balanced(root: TreeNode | None) -> bool:
    def height(node: TreeNode | None) -> int:
        if not node:
            return 0

        left = height(node.left)
        if left == -1:
            return -1

        right = height(node.right)
        if right == -1:
            return -1

        if abs(left - right) > 1:
            return -1

        return max(left, right) + 1

    return height(root) != -1
```

这里 `height(node)` 的含义不是单纯返回高度，而是：如果以 `node` 为根的子树平衡，返回高度；否则返回 `-1`。这就是二叉树题里很常见的“返回值带状态”。

[222. 完全二叉树的节点个数](https://leetcode.cn/problems/count-complete-tree-nodes/) 可以普通递归数节点：

```python
def count_nodes(root: TreeNode | None) -> int:
    if not root:
        return 0

    return count_nodes(root.left) + count_nodes(root.right) + 1
```

如果利用完全二叉树性质，还可以判断左右边界高度是否相同。若相同，说明这棵子树是满二叉树，节点数直接是 `2 ** height - 1`；否则继续递归。

```python
def count_nodes(root: TreeNode | None) -> int:
    if not root:
        return 0

    left = root.left
    right = root.right
    left_height = 1
    right_height = 1

    while left:
        left_height += 1
        left = left.left

    while right:
        right_height += 1
        right = right.right

    if left_height == right_height:
        return 2 ** left_height - 1

    return count_nodes(root.left) + count_nodes(root.right) + 1
```

这类题复习时先问：函数返回的是单个数字，还是带失败信号的数字？当前节点的结果是否依赖左右子树？如果依赖，通常就是后序。

## 6. 翻转、对称、相同：成对处理左右子树

[226. 翻转二叉树](https://leetcode.cn/problems/invert-binary-tree/) 要把每个节点的左右孩子交换。当前节点要做的事很简单：交换左右孩子，然后递归处理左右子树。

```python
def invert_tree(root: TreeNode | None) -> TreeNode | None:
    if not root:
        return None

    root.left, root.right = root.right, root.left
    invert_tree(root.left)
    invert_tree(root.right)

    return root
```

这题可以前序，也可以后序。只要每个节点都交换一次，顺序并不敏感。

[101. 对称二叉树](https://leetcode.cn/problems/symmetric-tree/) 不是比较一个节点的左孩子和右孩子值这么简单，而是比较两棵子树是否镜像：

- 左子树的左边，要和右子树的右边相同。
- 左子树的右边，要和右子树的左边相同。

```python
def is_symmetric(root: TreeNode | None) -> bool:
    def compare(left: TreeNode | None, right: TreeNode | None) -> bool:
        if not left and not right:
            return True

        if not left or not right:
            return False

        if left.val != right.val:
            return False

        return compare(left.left, right.right) and compare(left.right, right.left)

    if not root:
        return True

    return compare(root.left, root.right)
```

这题最容易错的是递归方向。如果写成 `compare(left.left, right.left)`，那是在比较同向结构，不是镜像结构。

[100. 相同的树](https://leetcode.cn/problems/same-tree/) 和对称二叉树很像，只是比较方向不同：

```python
def is_same_tree(p: TreeNode | None, q: TreeNode | None) -> bool:
    if not p and not q:
        return True

    if not p or not q:
        return False

    if p.val != q.val:
        return False

    return is_same_tree(p.left, q.left) and is_same_tree(p.right, q.right)
```

成对递归题的关键是把两个节点一起传进去。每一层先处理空节点情况，再比较当前值，最后比较下一层结构。

## 7. 路径题：路径列表跟着递归进出

路径题通常从根节点出发，走到叶子节点。这里最容易混的是“什么时候算一条完整路径”。只有当前节点是叶子节点时，也就是 `not node.left and not node.right`，根到当前节点的路径才完整。

[257. 二叉树的所有路径](https://leetcode.cn/problems/binary-tree-paths/) 要返回所有根到叶子的路径：

```python
def binary_tree_paths(root: TreeNode | None) -> list[str]:
    if not root:
        return []

    ans = []
    path = []

    def dfs(node: TreeNode) -> None:
        path.append(str(node.val))

        if not node.left and not node.right:
            ans.append("->".join(path))
        else:
            if node.left:
                dfs(node.left)
            if node.right:
                dfs(node.right)

        path.pop()

    dfs(root)
    return ans
```

这里 `path.append` 和 `path.pop` 是一对。进入节点时加入路径，离开节点时撤销选择。这和回溯的思想一样。

[112. 路径总和](https://leetcode.cn/problems/path-sum/) 要判断是否存在一条根到叶子路径，使路径和等于 `targetSum`。可以递归传剩余目标值：

```python
def has_path_sum(root: TreeNode | None, target_sum: int) -> bool:
    if not root:
        return False

    if not root.left and not root.right:
        return target_sum == root.val

    rest = target_sum - root.val

    return has_path_sum(root.left, rest) or has_path_sum(root.right, rest)
```

注意空节点返回 `False`，不是判断 `target_sum == 0`。因为题目要求路径必须到叶子节点，空节点不是合法路径。

[113. 路径总和 II](https://leetcode.cn/problems/path-sum-ii/) 要返回所有满足条件的路径。这时不仅要判断，还要保存路径：

```python
def path_sum(root: TreeNode | None, target_sum: int) -> list[list[int]]:
    ans = []
    path = []

    def dfs(node: TreeNode | None, rest: int) -> None:
        if not node:
            return

        path.append(node.val)

        if not node.left and not node.right and rest == node.val:
            ans.append(path[:])
        else:
            dfs(node.left, rest - node.val)
            dfs(node.right, rest - node.val)

        path.pop()

    dfs(root, target_sum)
    return ans
```

这里 `ans.append(path[:])` 很重要。不能直接 `ans.append(path)`，因为 `path` 后面会继续被修改，最后答案里的路径会被一起改掉。

路径题的复习重点是三个条件：

- 是否必须从根开始？
- 是否必须到叶子结束？
- 是只判断存在性，还是要返回所有路径？

这三个问题决定递归参数和返回方式。

## 8. 构造二叉树：用根节点切分左右区间

构造树题的核心是：找到根节点，然后把剩下的节点切成左子树和右子树。

[105. 从前序与中序遍历序列构造二叉树](https://leetcode.cn/problems/construct-binary-tree-from-preorder-and-inorder-traversal/) 中，前序第一个元素一定是根节点；在中序里找到根节点位置，左边就是左子树，右边就是右子树。

下面用 `preorder = [3, 9, 20, 15, 7]`、`inorder = [9, 3, 15, 20, 7]` 演示一次。按“下一步”看：每次先从前序区间拿根，再去中序区间找到根的位置，用左子树数量反推出前序里的左右区间。

<div id="build-tree-demo" class="algo-demo build-tree-demo">
  <div class="algo-demo-title">
    <span>前序 + 中序构造二叉树演示</span>
    <span class="algo-pill">preorder = [3, 9, 20, 15, 7]</span>
    <span class="algo-pill">inorder = [9, 3, 15, 20, 7]</span>
  </div>

  <div class="build-array-panel">
    <div class="build-array-row">
      <span class="build-array-label">preorder</span>
      <div class="build-token-row" data-preorder-row></div>
    </div>
    <div class="build-array-row">
      <span class="build-array-label">inorder</span>
      <div class="build-token-row" data-inorder-row></div>
    </div>
  </div>

  <div class="algo-stats">
    <span class="algo-stat">阶段 <strong data-phase>准备</strong></span>
    <span class="algo-stat">根 <strong data-root>-</strong></span>
    <span class="algo-stat">left_size <strong data-left-size>-</strong></span>
    <span class="algo-stat">pre <strong data-pre-range>-</strong></span>
    <span class="algo-stat">in <strong data-in-range>-</strong></span>
  </div>

  <div class="build-tree-layout">
    <div class="build-tree-canvas">
      <svg viewBox="0 0 640 260" role="img" aria-label="前序和中序构造二叉树演示" data-tree-svg></svg>
    </div>
    <div class="build-detail-panel" data-detail></div>
  </div>

  <div class="algo-note" data-note></div>

  <div class="algo-controls">
    <button type="button" data-prev>上一步</button>
    <button type="button" data-next>下一步</button>
    <button type="button" data-play>播放</button>
    <button type="button" data-reset>重置</button>
    <span class="algo-step" data-step></span>
  </div>

  <script>
    (() => {
      const root = document.getElementById('build-tree-demo')
      if (!root) return

      const preorder = [3, 9, 20, 15, 7]
      const inorder = [9, 3, 15, 20, 7]

      const treeNodes = {
        3: { x: 320, y: 52 },
        9: { x: 188, y: 138 },
        20: { x: 452, y: 138 },
        15: { x: 382, y: 224 },
        7: { x: 522, y: 224 },
      }
      const treeEdges = [
        [3, 9],
        [3, 20],
        [20, 15],
        [20, 7],
      ]

      const steps = [
        {
          phase: '准备',
          rootValue: '-',
          leftSize: '-',
          preRange: [0, 4],
          inRange: [0, 4],
          built: [],
          detail: [
            '先看整棵树：preorder[0..4] 和 inorder[0..4] 表示同一批节点。',
            '前序负责告诉我们“根是谁”，中序负责告诉我们“左右子树怎么切”。',
          ],
          note: '构造树的递归函数可以理解成：用一段 preorder 和一段 inorder，拼出这一棵子树。',
        },
        {
          phase: '取整棵树的根',
          rootValue: 3,
          leftSize: 1,
          preRange: [0, 4],
          inRange: [0, 4],
          preRoot: 0,
          inRoot: 1,
          built: [3],
          activeNode: 3,
          detail: [
            'preorder[0] = 3，所以 3 是整棵树的根。',
            '在 inorder 里找到 3，位置是 1。',
            'inorder 中 3 左边有 1 个节点，所以 left_size = 1。',
          ],
          note: '前序第一个元素永远是当前子树的根。这里先把根节点 3 放进树里。',
        },
        {
          phase: '切开根 3 的左右子树',
          rootValue: 3,
          leftSize: 1,
          preRange: [0, 4],
          inRange: [0, 4],
          preRoot: 0,
          inRoot: 1,
          preLeft: [1, 1],
          preRight: [2, 4],
          inLeft: [0, 0],
          inRight: [2, 4],
          built: [3],
          activeNode: 3,
          detail: [
            '左子树有 1 个节点，所以 preorder[1..1] 是左子树。',
            '剩下 preorder[2..4] 是右子树。',
            'inorder[0..0] 是左子树，inorder[2..4] 是右子树。',
          ],
          note: '这一步最关键：中序切出左右范围，left_size 决定前序里左子树占几个位置。',
        },
        {
          phase: '构造左子树',
          rootValue: 9,
          leftSize: 0,
          preRange: [1, 1],
          inRange: [0, 0],
          preRoot: 1,
          inRoot: 0,
          built: [3, 9],
          activeNode: 9,
          detail: [
            '现在递归构造左子树：preorder[1..1]、inorder[0..0]。',
            'preorder[1] = 9，所以 9 是左子树的根。',
            '这一段只有一个节点，9 就是叶子节点。',
          ],
          note: '区间里只剩一个节点时，直接生成叶子节点。左子树完成后，回到根 3 继续构造右子树。',
        },
        {
          phase: '构造右子树的根',
          rootValue: 20,
          leftSize: 1,
          preRange: [2, 4],
          inRange: [2, 4],
          preRoot: 2,
          inRoot: 3,
          built: [3, 9, 20],
          activeNode: 20,
          detail: [
            '现在递归构造右子树：preorder[2..4]、inorder[2..4]。',
            'preorder[2] = 20，所以 20 是这棵右子树的根。',
            '在 inorder[2..4] 里，20 左边有 1 个节点。',
          ],
          note: '递归进入右子树后，规则完全一样：先拿当前前序区间的第一个值当根。',
        },
        {
          phase: '切开 20 的左右子树',
          rootValue: 20,
          leftSize: 1,
          preRange: [2, 4],
          inRange: [2, 4],
          preRoot: 2,
          inRoot: 3,
          preLeft: [3, 3],
          preRight: [4, 4],
          inLeft: [2, 2],
          inRight: [4, 4],
          built: [3, 9, 20],
          activeNode: 20,
          detail: [
            '20 的左子树在 inorder 里是 [15]，右子树是 [7]。',
            'left_size = 1，所以 preorder[3..3] 是左子树。',
            'preorder[4..4] 是右子树。',
          ],
          note: '不要硬背边界，先问左子树有几个节点，再去前序里数出同样多的位置。',
        },
        {
          phase: '构造 20 的左孩子',
          rootValue: 15,
          leftSize: 0,
          preRange: [3, 3],
          inRange: [2, 2],
          preRoot: 3,
          inRoot: 2,
          built: [3, 9, 20, 15],
          activeNode: 15,
          detail: [
            '递归构造 20 的左子树：preorder[3..3]、inorder[2..2]。',
            'preorder[3] = 15，所以生成节点 15。',
            '区间长度为 1，15 是叶子节点。',
          ],
          note: '15 接到 20 的左边。这个小区间构造完后返回上一层。',
        },
        {
          phase: '构造 20 的右孩子',
          rootValue: 7,
          leftSize: 0,
          preRange: [4, 4],
          inRange: [4, 4],
          preRoot: 4,
          inRoot: 4,
          built: [3, 9, 20, 15, 7],
          activeNode: 7,
          detail: [
            '递归构造 20 的右子树：preorder[4..4]、inorder[4..4]。',
            'preorder[4] = 7，所以生成节点 7。',
            '区间长度为 1，7 是叶子节点。',
          ],
          note: '7 接到 20 的右边。到这里所有非空区间都处理完了。',
        },
        {
          phase: '完成',
          rootValue: 3,
          leftSize: '-',
          preRange: [0, 4],
          inRange: [0, 4],
          built: [3, 9, 20, 15, 7],
          activeNode: null,
          detail: [
            '整棵树构造完成。',
            '最终结构是：3 的左孩子是 9，右孩子是 20；20 的左右孩子分别是 15 和 7。',
            '以后遇到这类题，就按“前序定根，中序切左右，left_size 推边界”走。',
          ],
          note: '构造树的本质不是记公式，而是每层递归都在回答：根是谁？左边几个节点？右边从哪里开始？',
        },
      ]

      const els = {
        preorderRow: root.querySelector('[data-preorder-row]'),
        inorderRow: root.querySelector('[data-inorder-row]'),
        treeSvg: root.querySelector('[data-tree-svg]'),
        detail: root.querySelector('[data-detail]'),
        phase: root.querySelector('[data-phase]'),
        rootValue: root.querySelector('[data-root]'),
        leftSize: root.querySelector('[data-left-size]'),
        preRange: root.querySelector('[data-pre-range]'),
        inRange: root.querySelector('[data-in-range]'),
        note: root.querySelector('[data-note]'),
        step: root.querySelector('[data-step]'),
        prev: root.querySelector('[data-prev]'),
        next: root.querySelector('[data-next]'),
        play: root.querySelector('[data-play]'),
        reset: root.querySelector('[data-reset]'),
      }

      let index = 0
      let timer = null

      function inRange(indexValue, range) {
        return Array.isArray(range) && indexValue >= range[0] && indexValue <= range[1]
      }

      function rangeText(range) {
        if (!Array.isArray(range)) return '-'
        if (range[0] > range[1]) return '空'
        return `${range[0]}..${range[1]}`
      }

      function tokenRole(i, step, type) {
        const rootIndex = type === 'preorder' ? step.preRoot : step.inRoot
        const leftRange = type === 'preorder' ? step.preLeft : step.inLeft
        const rightRange = type === 'preorder' ? step.preRight : step.inRight

        if (i === rootIndex) return type === 'preorder' ? '根' : 'mid'
        if (inRange(i, leftRange)) return '左'
        if (inRange(i, rightRange)) return '右'
        return inRange(i, type === 'preorder' ? step.preRange : step.inRange) ? '当前' : ''
      }

      function renderTokens(row, values, step, type) {
        const activeRange = type === 'preorder' ? step.preRange : step.inRange
        const rootIndex = type === 'preorder' ? step.preRoot : step.inRoot
        const leftRange = type === 'preorder' ? step.preLeft : step.inLeft
        const rightRange = type === 'preorder' ? step.preRight : step.inRight

        row.innerHTML = values.map((value, i) => {
          const classes = ['build-token']
          if (inRange(i, activeRange)) classes.push('active-range')
          if (inRange(i, leftRange)) classes.push('left-part')
          if (inRange(i, rightRange)) classes.push('right-part')
          if (i === rootIndex) classes.push('root-part')
          if (!inRange(i, activeRange) && !inRange(i, leftRange) && !inRange(i, rightRange)) classes.push('inactive')

          const role = tokenRole(i, step, type)
          return `
            <div class="${classes.join(' ')}">
              <span class="build-token-value">${value}</span>
              <span class="build-token-index">i=${i}</span>
              <span class="build-token-role">${role}</span>
            </div>
          `
        }).join('')
      }

      function renderTree(step) {
        const built = new Set(step.built)
        const active = step.activeNode
        const radius = 22
        const edgeMarkup = treeEdges
          .filter(([from, to]) => built.has(from) && built.has(to))
          .map(([from, to]) => {
            const a = treeNodes[from]
            const b = treeNodes[to]
            return `<line class="build-tree-edge" x1="${a.x}" y1="${a.y + radius}" x2="${b.x}" y2="${b.y - radius}"></line>`
          })
          .join('')

        const nodeMarkup = Object.entries(treeNodes)
          .filter(([value]) => built.has(Number(value)))
          .map(([value, point]) => {
            const nodeValue = Number(value)
            const state = nodeValue === active ? 'active' : 'done'
            return `
              <g class="build-tree-node ${state}">
                <circle class="build-tree-node-circle" cx="${point.x}" cy="${point.y}" r="${radius}"></circle>
                <text class="build-tree-node-value" x="${point.x}" y="${point.y + 6}">${value}</text>
              </g>
            `
          })
          .join('')

        els.treeSvg.innerHTML = `
          <text class="build-tree-caption" x="320" y="22">正在生成的二叉树</text>
          ${edgeMarkup}
          ${nodeMarkup}
        `
      }

      function renderDetail(step) {
        els.detail.innerHTML = `
          <div class="build-detail-title">当前递归怎么想</div>
          ${step.detail.map(item => `<p>${item}</p>`).join('')}
        `
      }

      function render() {
        const step = steps[index]
        renderTokens(els.preorderRow, preorder, step, 'preorder')
        renderTokens(els.inorderRow, inorder, step, 'inorder')
        renderTree(step)
        renderDetail(step)

        els.phase.textContent = step.phase
        els.rootValue.textContent = step.rootValue
        els.leftSize.textContent = step.leftSize
        els.preRange.textContent = rangeText(step.preRange)
        els.inRange.textContent = rangeText(step.inRange)
        els.note.textContent = step.note
        els.step.textContent = `第 ${index + 1} / ${steps.length} 步`
        els.prev.disabled = index === 0
        els.next.disabled = index === steps.length - 1
      }

      function stop() {
        if (!timer) return
        window.clearInterval(timer)
        timer = null
        els.play.textContent = '播放'
      }

      function next() {
        if (index < steps.length - 1) {
          index += 1
          render()
        } else {
          stop()
        }
      }

      els.prev.addEventListener('click', () => {
        stop()
        index = Math.max(0, index - 1)
        render()
      })

      els.next.addEventListener('click', () => {
        stop()
        next()
      })

      els.reset.addEventListener('click', () => {
        stop()
        index = 0
        render()
      })

      els.play.addEventListener('click', () => {
        if (timer) {
          stop()
          return
        }
        if (index === steps.length - 1) index = 0
        render()
        els.play.textContent = '暂停'
        timer = window.setInterval(next, 1500)
      })

      render()
    })()
  </script>
</div>

所以构造树不是凭空造节点，而是不断重复这件事：

```text
前序：拿第一个元素当根
中序：用根的位置切开左右子树
数量：用左子树节点数，反推出前序里的左右边界
```

为了避免反复切片，可以用下标区间。先用哈希表记录中序值到下标的映射：

```python
def build_tree(preorder: list[int], inorder: list[int]) -> TreeNode | None:
    pos = {value: i for i, value in enumerate(inorder)}

    def build(pre_l: int, pre_r: int, in_l: int, in_r: int) -> TreeNode | None:
        if pre_l > pre_r:
            return None

        root_val = preorder[pre_l]
        root = TreeNode(root_val)
        mid = pos[root_val]
        left_size = mid - in_l

        root.left = build(pre_l + 1, pre_l + left_size, in_l, mid - 1)
        root.right = build(pre_l + left_size + 1, pre_r, mid + 1, in_r)

        return root

    return build(0, len(preorder) - 1, 0, len(inorder) - 1)
```

这题最容易错的是区间边界。建议固定左闭右闭区间：

```text
preorder[pre_l ... pre_r]
inorder[in_l ... in_r]
```

在 Python 代码里我们没有真的切片，而是用下标表示。`left_size = mid - in_l` 是左子树节点数量。

区间可以照着这张图推：

```text
preorder:  [root | 左子树 left_size 个 | 右子树]
             ^
             pre_l

inorder:   [左子树 | root | 右子树]
                     ^
                     mid

左子树：
preorder: pre_l + 1             到 pre_l + left_size
inorder:  in_l                  到 mid - 1

右子树：
preorder: pre_l + left_size + 1 到 pre_r
inorder:  mid + 1               到 in_r
```

[106. 从中序与后序遍历序列构造二叉树](https://leetcode.cn/problems/construct-binary-tree-from-inorder-and-postorder-traversal/) 类似，只是后序最后一个元素是根节点。仍然用中序切分左右子树。

下面用同一棵树再演示一次：

<div id="postorder-build-demo" class="algo-demo build-tree-demo postorder-build-demo">
  <div class="algo-demo-title">
    <span>中序 + 后序构造二叉树演示</span>
    <span class="algo-pill">inorder = [9, 3, 15, 20, 7]</span>
    <span class="algo-pill">postorder = [9, 15, 7, 20, 3]</span>
  </div>

  <div class="build-array-panel">
    <div class="build-array-row">
      <span class="build-array-label">inorder</span>
      <div class="build-token-row" data-inorder-row></div>
    </div>
    <div class="build-array-row">
      <span class="build-array-label">postorder</span>
      <div class="build-token-row" data-postorder-row></div>
    </div>
  </div>

  <div class="algo-stats">
    <span class="algo-stat">阶段 <strong data-phase>准备</strong></span>
    <span class="algo-stat">根 <strong data-root>-</strong></span>
    <span class="algo-stat">left_size <strong data-left-size>-</strong></span>
    <span class="algo-stat">right_size <strong data-right-size>-</strong></span>
    <span class="algo-stat">in <strong data-in-range>-</strong></span>
    <span class="algo-stat">post <strong data-post-range>-</strong></span>
  </div>

  <div class="build-tree-layout">
    <div class="build-tree-canvas">
      <svg viewBox="0 0 640 260" role="img" aria-label="中序和后序构造二叉树演示" data-tree-svg></svg>
    </div>
    <div class="build-detail-panel" data-detail></div>
  </div>

  <div class="algo-note" data-note></div>

  <div class="algo-controls">
    <button type="button" data-prev>上一步</button>
    <button type="button" data-next>下一步</button>
    <button type="button" data-play>播放</button>
    <button type="button" data-reset>重置</button>
    <span class="algo-step" data-step></span>
  </div>

  <script>
    (() => {
      const root = document.getElementById('postorder-build-demo')
      if (!root) return

      const inorder = [9, 3, 15, 20, 7]
      const postorder = [9, 15, 7, 20, 3]

      const treeNodes = {
        3: { x: 320, y: 52 },
        9: { x: 188, y: 138 },
        20: { x: 452, y: 138 },
        15: { x: 382, y: 224 },
        7: { x: 522, y: 224 },
      }
      const treeEdges = [
        [3, 9],
        [3, 20],
        [20, 15],
        [20, 7],
      ]

      const steps = [
        {
          phase: '准备',
          rootValue: '-',
          leftSize: '-',
          rightSize: '-',
          inRange: [0, 4],
          postRange: [0, 4],
          built: [],
          detail: [
            '现在换成中序 + 后序。中序仍然负责切左右子树。',
            '后序的顺序是左、右、根，所以当前后序区间的最后一个元素就是根。',
          ],
          note: '这类题的关键变化是根节点位置：前序看区间开头，后序看区间结尾。',
        },
        {
          phase: '取整棵树的根',
          rootValue: 3,
          leftSize: 1,
          rightSize: 3,
          inRange: [0, 4],
          postRange: [0, 4],
          inRoot: 1,
          postRoot: 4,
          built: [3],
          activeNode: 3,
          detail: [
            'postorder[4] = 3，所以 3 是整棵树的根。',
            '去 inorder 里找到 3，位置是 1。',
            '3 左边有 1 个节点，右边有 3 个节点。',
          ],
          note: '后序不是从左边拿根，而是从当前区间的最右边拿根。',
        },
        {
          phase: '切开根 3 的左右子树',
          rootValue: 3,
          leftSize: 1,
          rightSize: 3,
          inRange: [0, 4],
          postRange: [0, 4],
          inRoot: 1,
          postRoot: 4,
          inLeft: [0, 0],
          inRight: [2, 4],
          postLeft: [0, 0],
          postRight: [1, 3],
          built: [3],
          activeNode: 3,
          detail: [
            'inorder[0..0] 是左子树，inorder[2..4] 是右子树。',
            '左子树有 1 个节点，所以 postorder[0..0] 是左子树。',
            '根 3 已经占了 postorder[4]，中间 postorder[1..3] 就是右子树。',
          ],
          note: '后序区间里，根在最后；根前面仍然是左子树区间 + 右子树区间。',
        },
        {
          phase: '构造左子树',
          rootValue: 9,
          leftSize: 0,
          rightSize: 0,
          inRange: [0, 0],
          postRange: [0, 0],
          inRoot: 0,
          postRoot: 0,
          built: [3, 9],
          activeNode: 9,
          detail: [
            '递归构造左子树：inorder[0..0]、postorder[0..0]。',
            'postorder[0] = 9，所以 9 是这棵小子树的根。',
            '区间里只有一个节点，9 是叶子节点。',
          ],
          note: '叶子节点就是递归的最小非空问题：一个区间只对应一个节点。',
        },
        {
          phase: '构造右子树的根',
          rootValue: 20,
          leftSize: 1,
          rightSize: 1,
          inRange: [2, 4],
          postRange: [1, 3],
          inRoot: 3,
          postRoot: 3,
          built: [3, 9, 20],
          activeNode: 20,
          detail: [
            '现在处理右子树：inorder[2..4]、postorder[1..3]。',
            'postorder[3] = 20，所以 20 是右子树的根。',
            '在 inorder[2..4] 中，20 左边 1 个节点，右边 1 个节点。',
          ],
          note: '注意这里不是看 postorder[1]，而是看当前后序区间的右端 postorder[3]。',
        },
        {
          phase: '切开 20 的左右子树',
          rootValue: 20,
          leftSize: 1,
          rightSize: 1,
          inRange: [2, 4],
          postRange: [1, 3],
          inRoot: 3,
          postRoot: 3,
          inLeft: [2, 2],
          inRight: [4, 4],
          postLeft: [1, 1],
          postRight: [2, 2],
          built: [3, 9, 20],
          activeNode: 20,
          detail: [
            'inorder 里 20 左边是 [15]，右边是 [7]。',
            'left_size = 1，所以 postorder[1..1] 是左子树。',
            'right_size = 1，所以 postorder[2..2] 是右子树；postorder[3] 是根 20。',
          ],
          note: '中序切出左右数量，后序用数量把根前面的区间再切成左、右两段。',
        },
        {
          phase: '构造 20 的左孩子',
          rootValue: 15,
          leftSize: 0,
          rightSize: 0,
          inRange: [2, 2],
          postRange: [1, 1],
          inRoot: 2,
          postRoot: 1,
          built: [3, 9, 20, 15],
          activeNode: 15,
          detail: [
            '递归构造 20 的左子树：inorder[2..2]、postorder[1..1]。',
            'postorder[1] = 15，所以生成节点 15。',
            '它是单节点区间，直接返回给 20.left。',
          ],
          note: '15 接到 20 的左边。',
        },
        {
          phase: '构造 20 的右孩子',
          rootValue: 7,
          leftSize: 0,
          rightSize: 0,
          inRange: [4, 4],
          postRange: [2, 2],
          inRoot: 4,
          postRoot: 2,
          built: [3, 9, 20, 15, 7],
          activeNode: 7,
          detail: [
            '递归构造 20 的右子树：inorder[4..4]、postorder[2..2]。',
            'postorder[2] = 7，所以生成节点 7。',
            '它返回给 20.right。',
          ],
          note: '7 接到 20 的右边。右子树也完成了。',
        },
        {
          phase: '完成',
          rootValue: 3,
          leftSize: '-',
          rightSize: '-',
          inRange: [0, 4],
          postRange: [0, 4],
          built: [3, 9, 20, 15, 7],
          detail: [
            '整棵树构造完成。',
            '前序 + 中序和中序 + 后序构造出来的是同一棵树。',
            '差别只是根节点来源：前序取左端，后序取右端；切左右子树都依赖中序。',
          ],
          note: '复习时抓住一句话：后序右端定根，中序定位根，左子树数量决定后序左区间和右区间的边界。',
        },
      ]

      const els = {
        inorderRow: root.querySelector('[data-inorder-row]'),
        postorderRow: root.querySelector('[data-postorder-row]'),
        treeSvg: root.querySelector('[data-tree-svg]'),
        detail: root.querySelector('[data-detail]'),
        phase: root.querySelector('[data-phase]'),
        rootValue: root.querySelector('[data-root]'),
        leftSize: root.querySelector('[data-left-size]'),
        rightSize: root.querySelector('[data-right-size]'),
        inRange: root.querySelector('[data-in-range]'),
        postRange: root.querySelector('[data-post-range]'),
        note: root.querySelector('[data-note]'),
        step: root.querySelector('[data-step]'),
        prev: root.querySelector('[data-prev]'),
        next: root.querySelector('[data-next]'),
        play: root.querySelector('[data-play]'),
        reset: root.querySelector('[data-reset]'),
      }

      let index = 0
      let timer = null

      function inSpan(i, range) {
        return Array.isArray(range) && i >= range[0] && i <= range[1]
      }

      function rangeText(range) {
        if (!Array.isArray(range)) return '-'
        if (range[0] > range[1]) return '空'
        return `${range[0]}..${range[1]}`
      }

      function tokenRole(i, step, type) {
        const rootIndex = type === 'postorder' ? step.postRoot : step.inRoot
        const leftRange = type === 'postorder' ? step.postLeft : step.inLeft
        const rightRange = type === 'postorder' ? step.postRight : step.inRight

        if (i === rootIndex) return type === 'postorder' ? '根' : 'mid'
        if (inSpan(i, leftRange)) return '左'
        if (inSpan(i, rightRange)) return '右'
        return inSpan(i, type === 'postorder' ? step.postRange : step.inRange) ? '当前' : ''
      }

      function renderTokens(row, values, step, type) {
        const activeRange = type === 'postorder' ? step.postRange : step.inRange
        const rootIndex = type === 'postorder' ? step.postRoot : step.inRoot
        const leftRange = type === 'postorder' ? step.postLeft : step.inLeft
        const rightRange = type === 'postorder' ? step.postRight : step.inRight

        row.innerHTML = values.map((value, i) => {
          const classes = ['build-token']
          if (inSpan(i, activeRange)) classes.push('active-range')
          if (inSpan(i, leftRange)) classes.push('left-part')
          if (inSpan(i, rightRange)) classes.push('right-part')
          if (i === rootIndex) classes.push('root-part')
          if (!inSpan(i, activeRange) && !inSpan(i, leftRange) && !inSpan(i, rightRange)) classes.push('inactive')

          const role = tokenRole(i, step, type)
          return `
            <div class="${classes.join(' ')}">
              <span class="build-token-value">${value}</span>
              <span class="build-token-index">i=${i}</span>
              <span class="build-token-role">${role}</span>
            </div>
          `
        }).join('')
      }

      function renderTree(step) {
        const built = new Set(step.built)
        const active = step.activeNode
        const radius = 22
        const edgeMarkup = treeEdges
          .filter(([from, to]) => built.has(from) && built.has(to))
          .map(([from, to]) => {
            const a = treeNodes[from]
            const b = treeNodes[to]
            return `<line class="build-tree-edge" x1="${a.x}" y1="${a.y + radius}" x2="${b.x}" y2="${b.y - radius}"></line>`
          })
          .join('')

        const nodeMarkup = Object.entries(treeNodes)
          .filter(([value]) => built.has(Number(value)))
          .map(([value, point]) => {
            const nodeValue = Number(value)
            const state = nodeValue === active ? 'active' : 'done'
            return `
              <g class="build-tree-node ${state}">
                <circle class="build-tree-node-circle" cx="${point.x}" cy="${point.y}" r="${radius}"></circle>
                <text class="build-tree-node-value" x="${point.x}" y="${point.y + 6}">${value}</text>
              </g>
            `
          })
          .join('')

        els.treeSvg.innerHTML = `
          <text class="build-tree-caption" x="320" y="22">正在生成的二叉树</text>
          ${edgeMarkup}
          ${nodeMarkup}
        `
      }

      function renderDetail(step) {
        els.detail.innerHTML = `
          <div class="build-detail-title">当前递归怎么想</div>
          ${step.detail.map(item => `<p>${item}</p>`).join('')}
        `
      }

      function render() {
        const step = steps[index]
        renderTokens(els.inorderRow, inorder, step, 'inorder')
        renderTokens(els.postorderRow, postorder, step, 'postorder')
        renderTree(step)
        renderDetail(step)

        els.phase.textContent = step.phase
        els.rootValue.textContent = step.rootValue
        els.leftSize.textContent = step.leftSize
        els.rightSize.textContent = step.rightSize
        els.inRange.textContent = rangeText(step.inRange)
        els.postRange.textContent = rangeText(step.postRange)
        els.note.textContent = step.note
        els.step.textContent = `第 ${index + 1} / ${steps.length} 步`
        els.prev.disabled = index === 0
        els.next.disabled = index === steps.length - 1
      }

      function stop() {
        if (!timer) return
        window.clearInterval(timer)
        timer = null
        els.play.textContent = '播放'
      }

      function next() {
        if (index < steps.length - 1) {
          index += 1
          render()
        } else {
          stop()
        }
      }

      els.prev.addEventListener('click', () => {
        stop()
        index = Math.max(0, index - 1)
        render()
      })

      els.next.addEventListener('click', () => {
        stop()
        next()
      })

      els.reset.addEventListener('click', () => {
        stop()
        index = 0
        render()
      })

      els.play.addEventListener('click', () => {
        if (timer) {
          stop()
          return
        }
        if (index === steps.length - 1) index = 0
        render()
        els.play.textContent = '暂停'
        timer = window.setInterval(next, 1500)
      })

      render()
    })()
  </script>
</div>

区别只是根节点的位置变了：前序的根在最前面，后序的根在最后面。真正切左右子树，还是靠中序。

```python
def build_tree(inorder: list[int], postorder: list[int]) -> TreeNode | None:
    pos = {value: i for i, value in enumerate(inorder)}

    def build(in_l: int, in_r: int, post_l: int, post_r: int) -> TreeNode | None:
        if in_l > in_r:
            return None

        root_val = postorder[post_r]
        root = TreeNode(root_val)
        mid = pos[root_val]
        left_size = mid - in_l

        root.left = build(in_l, mid - 1, post_l, post_l + left_size - 1)
        root.right = build(mid + 1, in_r, post_l + left_size, post_r - 1)

        return root

    return build(0, len(inorder) - 1, 0, len(postorder) - 1)
```

构造树题不要先背公式。先画出根节点在哪里，再问：左子树有几个节点？右子树从哪里开始？只要数量算对，边界就能推出来。

## 9. BST：中序有序是第一反应

二叉搜索树 BST 的性质是：左子树所有节点值小于当前节点，右子树所有节点值大于当前节点。它最重要的推论是：**中序遍历得到递增序列。**

[700. 二叉搜索树中的搜索](https://leetcode.cn/problems/search-in-a-binary-search-tree/) 可以利用大小关系决定往哪边走：

```python
def search_bst(root: TreeNode | None, val: int) -> TreeNode | None:
    if not root:
        return None

    if root.val == val:
        return root

    if val < root.val:
        return search_bst(root.left, val)

    return search_bst(root.right, val)
```

[98. 验证二叉搜索树](https://leetcode.cn/problems/validate-binary-search-tree/) 不能只检查当前节点和左右孩子。错误写法是：

```python
# 错误直觉：只比较 root.left.val < root.val < root.right.val
```

因为 BST 要求的是整棵左子树都小于根，整棵右子树都大于根。最稳的方式是中序遍历，检查序列是否严格递增：

```python
def is_valid_bst(root: TreeNode | None) -> bool:
    prev = None

    def inorder(node: TreeNode | None) -> bool:
        nonlocal prev

        if not node:
            return True

        if not inorder(node.left):
            return False

        if prev is not None and node.val <= prev:
            return False

        prev = node.val

        return inorder(node.right)

    return inorder(root)
```

注意是严格递增，所以 `node.val <= prev` 就不合法。

[530. 二叉搜索树的最小绝对差](https://leetcode.cn/problems/minimum-absolute-difference-in-bst/) 也是中序。中序相邻两个值的差，才可能是最小差：

```python
def get_minimum_difference(root: TreeNode | None) -> int:
    prev = None
    ans = float("inf")

    def inorder(node: TreeNode | None) -> None:
        nonlocal prev, ans

        if not node:
            return

        inorder(node.left)

        if prev is not None:
            ans = min(ans, node.val - prev)

        prev = node.val
        inorder(node.right)

    inorder(root)
    return ans
```

[501. 二叉搜索树中的众数](https://leetcode.cn/problems/find-mode-in-binary-search-tree/) 也可以中序处理，因为相同值会连续出现。只需要维护当前值出现次数和最大次数。

```python
def find_mode(root: TreeNode | None) -> list[int]:
    prev = None
    count = 0
    max_count = 0
    ans = []

    def update(value: int) -> None:
        nonlocal prev, count, max_count, ans

        if prev == value:
            count += 1
        else:
            prev = value
            count = 1

        if count == max_count:
            ans.append(value)
        elif count > max_count:
            max_count = count
            ans = [value]

    def inorder(node: TreeNode | None) -> None:
        if not node:
            return

        inorder(node.left)
        update(node.val)
        inorder(node.right)

    inorder(root)
    return ans
```

BST 题先想中序；如果是查找、插入、删除，再想大小关系往左还是往右走。

## 10. 最近公共祖先：左右子树分别找目标

[236. 二叉树的最近公共祖先](https://leetcode.cn/problems/lowest-common-ancestor-of-a-binary-tree/) 给一棵普通二叉树和两个节点 `p`、`q`，要求找到它们最近的公共祖先。

递归函数可以定义成：在以 `node` 为根的子树里寻找 `p` 或 `q`，如果找到了就返回对应节点；如果左右子树各找到一个，说明当前节点就是最近公共祖先。

```python
def lowest_common_ancestor(
    root: TreeNode | None,
    p: TreeNode,
    q: TreeNode,
) -> TreeNode | None:
    if not root or root == p or root == q:
        return root

    left = lowest_common_ancestor(root.left, p, q)
    right = lowest_common_ancestor(root.right, p, q)

    if left and right:
        return root

    return left if left else right
```

这段代码的返回值有三种含义：

- 返回 `None`：这棵子树里没有 `p` 或 `q`。
- 返回 `p` 或 `q`：这棵子树里找到了其中一个目标。
- 返回某个祖先节点：这棵子树里已经找到了最近公共祖先。

如果左右都非空，说明 `p` 和 `q` 分别在当前节点两侧，当前节点就是答案。如果只有一边非空，就把那边的结果往上返回。

[235. 二叉搜索树的最近公共祖先](https://leetcode.cn/problems/lowest-common-ancestor-of-a-binary-search-tree/) 可以利用 BST 性质。若 `p` 和 `q` 都小于当前节点，就去左边；都大于当前节点，就去右边；否则当前节点就是分叉点。

```python
def lowest_common_ancestor(
    root: TreeNode,
    p: TreeNode,
    q: TreeNode,
) -> TreeNode:
    cur = root

    while cur:
        if p.val < cur.val and q.val < cur.val:
            cur = cur.left
        elif p.val > cur.val and q.val > cur.val:
            cur = cur.right
        else:
            return cur
```

普通二叉树的 LCA 依赖后序返回值；BST 的 LCA 依赖大小关系找分叉点。看到题目是不是 BST，要马上切换思路。

## 11. 复习总览

- 二叉树题先定义递归函数含义：当前节点要返回什么给父节点。
- 前序是中左右，适合先处理当前节点；中序是左中右，BST 中序递增；后序是左右中，适合依赖左右子树结果的题。
- 迭代遍历用栈模拟递归，前序入栈先右后左，中序沿左链压栈。
- 层序遍历用 `deque`，每层开始前固定 `size = len(q)`。
- 最大深度是 `max(left, right) + 1`；最小深度要注意空子树不能当作叶子路径。
- 平衡二叉树可以让递归返回高度，若不平衡返回 `-1`。
- 翻转二叉树每个节点交换左右孩子；对称二叉树要比较外侧和内侧。
- 路径题要判断是否必须到叶子；保存路径时 `append` 和 `pop` 要成对出现。
- 构造树题先找根节点，再用中序位置切分左右子树，重点是区间边界。
- BST 题先想中序有序；验证 BST 要检查全局递增，不是只看父子节点。
- 最近公共祖先：普通二叉树看左右子树返回值，BST 看 `p`、`q` 和当前节点的大小关系。

二叉树题越往后越像“递归语义设计题”。复习时不要急着背整段代码，先用一句话说清楚函数的返回值。只要返回值定义稳，空节点、左右子树和当前节点的逻辑都会顺下来。

<div class="algorithm-module-nav algorithm-module-nav-bottom">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/stack-queue/">上一篇：栈与队列</a>
  <a href="/algorithm/backtracking/">下一篇：回溯算法模板</a>
</div>
