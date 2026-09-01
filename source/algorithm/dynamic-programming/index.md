---
title: 代码随想录刷题笔记：动态规划与背包问题
date:
top_img: /img/algorithm-header-code.webp
description: 动态规划刷题笔记，整理状态定义、递推公式、初始化、遍历顺序，以及路径、0-1 背包、完全背包、打家劫舍、股票和子序列问题。
categories:
  - Notes
  - Algorithm
tags:
  - LeetCode
  - CodeThinking
  - Python
  - Dynamic Programming
  - Knapsack
toc: true
toc_number: false
katex: true
---

<div class="algorithm-module-nav algorithm-module-nav-top">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/greedy/">上一篇：贪心算法总结</a>
  <a href="/algorithm/monotonic-stack/">下一篇：单调栈</a>
</div>

## 1. 怎么看动态规划题

动态规划的核心不是“建一个 `dp` 数组”，而是：**把大问题拆成会重复出现的子问题，保存子问题答案，再按照依赖关系逐步推出最终答案。**

一道题可能适合动态规划，通常会有这些信号：

- 求最大值、最小值、方案数，或者问某个目标是否可行。
- 暴力递归的参数会反复出现，同一个子问题被计算很多次。
- 每一步有有限种选择，比如选或不选、买或卖、偷或不偷。
- 题目能用“前 `i` 个元素”“容量 `j`”“两个字符串的前缀”“区间 `[i, j]`”描述子问题。
- 当前状态只依赖已经解决的较小状态，不需要保留完整选择历史。

但看到“最大、最小、方案数”不代表一定是 DP：

- 如果一个局部选择做完后永远不需要后悔，可能是贪心。
- 如果要列出所有具体方案，可能是回溯。
- 如果状态是图上的节点和边，可能是 BFS、最短路或拓扑排序。

动态规划和记忆化搜索本质上是在解同一类状态：

- 记忆化搜索是自顶向下：从答案出发递归，需要哪个状态就计算哪个状态。
- 递推 DP 是自底向上：先算小状态，再按依赖顺序填完整张表。

写题时不要先想“这是一维还是二维”。先用一句完整的话定义状态；维度只是状态里有几个会变化的参数。

## 2. DP 五步法：先定义，再递推

每道动态规划题都可以按下面五步检查。

| 步骤 | 要回答的问题 | 常见错误 |
|---|---|---|
| 1. 定义状态 | `dp[i]` 或 `dp[i][j]` 到底表示什么？ | 只写公式，不写状态含义 |
| 2. 写递推公式 | 当前状态来自哪些更小状态？最后一步做了什么？ | 漏掉一种选择，或读到未计算状态 |
| 3. 初始化 | 最小问题的答案是什么？不可达状态用什么值？ | 计数题忘记 `dp[0] = 1` |
| 4. 确定遍历顺序 | 转移依赖的状态是否已经算好？ | 0-1 背包把容量写成正序 |
| 5. 确定答案位置 | 答案是 `dp[-1]`、`max(dp)`，还是 `dp[m][n]`？ | “以 i 结尾”却直接返回最后一格 |

### 2.1 状态定义必须是一句话

例如 [70. 爬楼梯](https://leetcode.cn/problems/climbing-stairs/)：

```text
dp[i] 表示到达第 i 阶楼梯的方法数。
```

那么到达第 `i` 阶的最后一步只有两种可能：

```text
从 i - 1 走 1 阶过来
从 i - 2 走 2 阶过来
```

所以：

```python
dp[i] = dp[i - 1] + dp[i - 2]
```

如果状态定义成“从第 `i` 阶走到楼顶的方法数”，公式可能长得相似，但初始化和答案位置都会改变。状态定义、递推、初始化和遍历顺序必须是一套完整语义。

### 2.2 初始化由问题类型决定

常见中性值可以这样记：

| 问题类型 | 常见初始化 | 含义 |
|---|---|---|
| 最大值 | `-inf` 或题目允许的最小值 | 尚未得到合法方案 |
| 最小值 | `inf` | 尚未到达，不能让 0 干扰取最小值 |
| 计数 | `dp[0] = 1` | 什么都不选，构成总和 0 的空方案有 1 种 |
| 可行性 | `dp[0] = True` | 总和 0 可以由空集合组成 |

初始化不是固定模板。每个初值都应该能用状态定义解释。

### 2.3 遍历顺序由依赖方向决定

如果递推式读取：

```python
dp[i - 1]
dp[i - 2]
```

那么 `i` 要从小到大遍历。如果区间 DP 读取 `dp[i + 1][j - 1]`，那么 `i` 通常要从大到小遍历。背包的一维压缩更依赖遍历方向：方向写错，题型会直接从 0-1 背包变成完全背包。

调试 DP 时，先用最小样例打印整张表：

```python
print(dp)
```

逐格确认“这一格为什么是这个值”，比只检查最终答案有效得多。

## 3. 基础一维 DP：状态只依赖前几个位置

### 3.1 斐波那契与爬楼梯

[509. 斐波那契数](https://leetcode.cn/problems/fibonacci-number/) 是最简单的状态递推：

```python
def fib(n: int) -> int:
    if n < 2:
        return n

    prev2 = 0
    prev1 = 1

    for _ in range(2, n + 1):
        current = prev1 + prev2
        prev2, prev1 = prev1, current

    return prev1
```

这里原本可以使用 `dp[i]`，但每次只依赖前两个状态，所以压缩成两个变量。空间压缩前要先理解完整状态依赖，不要为了省几个元素让代码语义变乱。

[70. 爬楼梯](https://leetcode.cn/problems/climbing-stairs/) 的递推形式一样：

```python
def climb_stairs(n: int) -> int:
    if n <= 2:
        return n

    prev2 = 1
    prev1 = 2

    for _ in range(3, n + 1):
        current = prev1 + prev2
        prev2, prev1 = prev1, current

    return prev1
```

公式相同不代表问题相同。斐波那契的状态是数列第 `i` 项，爬楼梯的状态是到达第 `i` 阶的方法数。

### 3.2 使用最小花费爬楼梯：先说清楚“到达”

[746. 使用最小花费爬楼梯](https://leetcode.cn/problems/min-cost-climbing-stairs/) 中，踩上台阶 `i` 才支付 `cost[i]`。定义：

```text
dp[i] 表示到达位置 i 的最小花费。
```

楼顶可以看作位置 `n`，到达它的最后一步来自 `n - 1` 或 `n - 2`：

```python
def min_cost_climbing_stairs(cost: list[int]) -> int:
    n = len(cost)
    dp = [0] * (n + 1)

    for i in range(2, n + 1):
        dp[i] = min(
            dp[i - 1] + cost[i - 1],
            dp[i - 2] + cost[i - 2],
        )

    return dp[n]
```

`dp[0] = dp[1] = 0`，因为题目允许从下标 0 或 1 开始，还没有踩上任何需要付费的台阶。

一维 DP 最常见的两种状态含义：

- `dp[i]` 表示处理完前 `i` 个位置的最优答案，答案通常在最后一格。
- `dp[i]` 表示必须以位置 `i` 结尾的答案，最终答案可能是 `max(dp)`。

后面的最长递增子序列就是第二种。

## 4. 网格 DP：当前位置来自上方和左方

### 4.1 不同路径：先初始化第一行和第一列

[62. 不同路径](https://leetcode.cn/problems/unique-paths/) 中，机器人只能向右或向下。定义：

```text
dp[row][col] 表示从左上角走到 (row, col) 的路径数。
```

进入当前位置的最后一步只能来自上方或左方：

```python
def unique_paths(m: int, n: int) -> int:
    dp = [[1] * n for _ in range(m)]

    for row in range(1, m):
        for col in range(1, n):
            dp[row][col] = dp[row - 1][col] + dp[row][col - 1]

    return dp[m - 1][n - 1]
```

第一行只能一直向右，第一列只能一直向下，所以没有障碍时它们都初始化为 1。

Python 二维数组不要写成：

```python
dp = [[0] * n] * m  # 错误：所有行指向同一个列表
```

修改一行时，其他行也会一起变化。正确写法是列表推导式，每一行单独创建。

### 4.2 有障碍时，障碍格直接归零

[63. 不同路径 II](https://leetcode.cn/problems/unique-paths-ii/) 增加障碍。可以使用一维滚动数组：

```python
def unique_paths_with_obstacles(grid: list[list[int]]) -> int:
    rows = len(grid)
    cols = len(grid[0])
    dp = [0] * cols
    dp[0] = 1

    for row in range(rows):
        for col in range(cols):
            if grid[row][col] == 1:
                dp[col] = 0
            elif col > 0:
                dp[col] += dp[col - 1]

    return dp[-1]
```

此时：

- 更新前的 `dp[col]` 是从上方到达的路径数。
- 当前行刚更新的 `dp[col - 1]` 是从左方到达的路径数。
- 障碍位置必须设为 0，因为任何路径都不能经过这里。

[64. 最小路径和](https://leetcode.cn/problems/minimum-path-sum/) 的状态形状相同，只是把“上方加左方的方案数”换成“上方和左方取较小值，再加当前格子值”。这说明二维表长得一样时，状态语义和聚合方式仍然可能不同。

## 5. 拆分与计数：枚举最后一部分

### 5.1 整数拆分：直接拆和继续拆都要比较

[343. 整数拆分](https://leetcode.cn/problems/integer-break/) 要把整数 `n` 拆成至少两个正整数，使乘积最大。定义 `dp[i]` 为拆分 `i` 后能得到的最大乘积。

枚举第一部分 `j` 时，剩下的 `i - j` 有两种处理方式：

- 不再拆，乘积是 `j * (i - j)`。
- 继续拆，乘积是 `j * dp[i - j]`。

```python
def integer_break(n: int) -> int:
    dp = [0] * (n + 1)
    dp[2] = 1

    for total in range(3, n + 1):
        for first in range(1, total):
            dp[total] = max(
                dp[total],
                first * (total - first),
                first * dp[total - first],
            )

    return dp[n]
```

最容易漏的是 `first * (total - first)`。`dp[x]` 强制要求继续拆分，而当前剩余部分也可能不拆更优。

### 5.2 不同二叉搜索树：根节点切开左右规模

[96. 不同的二叉搜索树](https://leetcode.cn/problems/unique-binary-search-trees/) 只关心节点数，不关心具体值。定义 `dp[n]` 为 `n` 个不同节点能组成的 BST 数量。

若选第 `root` 个节点当根：

```text
左子树有 root - 1 个节点
右子树有 n - root 个节点
组合数 = 左子树方案数 × 右子树方案数
```

```python
def num_trees(n: int) -> int:
    dp = [0] * (n + 1)
    dp[0] = 1

    for nodes in range(1, n + 1):
        for root in range(1, nodes + 1):
            left_size = root - 1
            right_size = nodes - root
            dp[nodes] += dp[left_size] * dp[right_size]

    return dp[n]
```

`dp[0] = 1` 表示空子树有一种组合方式，但不表示存在一个值为空的实际节点。这个初值能让只有一侧子树的组合正确相乘。

## 6. 0-1 背包：每件物品最多选一次

普通 0-1 背包通常不是贪心问题。物品不能拆分时，眼前性价比最高的物品可能占掉容量，使后面无法组成更优组合；因此需要同时比较“选”和“不选”。

标准模型：

```text
有 n 件物品，第 i 件重量为 weight[i]，价值为 value[i]
背包容量为 capacity
每件物品最多使用一次
求不超过容量时的最大价值
```

### 6.1 二维状态：选或不选都来自上一行

定义：

```text
dp[i][j] 表示只考虑前 i 件物品、容量上限为 j 时能得到的最大价值。
```

处理第 `i` 件物品时：

```text
不选：dp[i - 1][j]
选择：dp[i - 1][j - weight] + value
```

容量不足时只能继承上一行；容量足够时才比较选与不选：

```python
if j < weight:
    dp[i][j] = dp[i - 1][j]
else:
    dp[i][j] = max(
        dp[i - 1][j],
        dp[i - 1][j - weight] + value,
    )
```

选择来源仍然是上一行，这保证第 `i` 件物品不会在同一轮被重复选择。

下面用重量 `[1, 3, 4]`、价值 `[15, 20, 30]`、容量 `4` 逐格填写二维表。重点看蓝色“不选来源”和绿色“选择来源”怎样共同决定当前格。

<div class="algo-demo dp-knapsack-demo" id="dp-knapsack-demo">
  <div class="algo-demo-title"><strong>0-1 背包：逐格比较选与不选</strong><span class="algo-pill">重量 [1, 3, 4] · 价值 [15, 20, 30] · 容量 4</span></div>
  <div class="algo-stats">
    <span class="algo-stat">当前物品：<strong data-role="item">初始化</strong></span>
    <span class="algo-stat">当前容量：<strong data-role="capacity">—</strong></span>
    <span class="algo-stat">当前最优：<strong data-role="best">0</strong></span>
  </div>
  <div class="dp-item-list" data-role="items"></div>
  <div class="dp-table-wrap" role="region" aria-label="可横向滚动的 0-1 背包动态规划表" tabindex="0">
    <div class="dp-table-grid" data-role="table" role="table" aria-label="0-1 背包动态规划表" aria-rowcount="5" aria-colcount="6"></div>
  </div>
  <div class="dp-choice-panel">
    <div class="dp-choice dp-choice-skip"><span>不选当前物品</span><code data-role="skip">—</code></div>
    <div class="dp-choice dp-choice-take"><span>选择当前物品</span><code data-role="take">—</code></div>
    <div class="dp-choice dp-choice-result"><span>写入当前格</span><code data-role="result">dp[0][0] = 0</code></div>
  </div>
  <div class="algo-note" data-role="note" aria-live="polite" aria-atomic="true"></div>
  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button>
    <button type="button" data-action="next">下一步</button>
    <button type="button" data-action="play">播放</button>
    <button type="button" data-action="reset">重置</button>
    <span class="algo-step" data-role="step"></span>
  </div>
</div>

<script>
  (() => {
    const root = document.getElementById('dp-knapsack-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const items = [
      { weight: 1, value: 15 },
      { weight: 3, value: 20 },
      { weight: 4, value: 30 }
    ]
    const capacity = 4
    const table = Array.from(
      { length: items.length + 1 },
      () => Array(capacity + 1).fill(null)
    )
    table[0].fill(0)

    const cloneTable = () => table.map(row => row.slice())
    const steps = [{
      row: 0,
      col: -1,
      itemIndex: -1,
      skipSource: null,
      takeSource: null,
      skipValue: null,
      takeValue: null,
      result: 0,
      choice: 'init',
      snapshot: cloneTable(),
      note: '第 0 行表示还没有物品。无论容量是多少，最大价值都只能是 0。'
    }]

    items.forEach((item, itemIndex) => {
      const row = itemIndex + 1

      for (let col = 0; col <= capacity; col += 1) {
        const skipValue = table[row - 1][col]
        const canTake = col >= item.weight
        const takeCol = canTake ? col - item.weight : null
        const takeValue = canTake
          ? table[row - 1][takeCol] + item.value
          : null
        const result = canTake
          ? Math.max(skipValue, takeValue)
          : skipValue
        const choice = !canTake
          ? 'unavailable'
          : takeValue > skipValue ? 'take' : 'skip'

        table[row][col] = result
        let note = '容量 ' + col + ' 小于物品重量 ' + item.weight + '，当前物品放不下，只能继承上一行的 ' + skipValue + '。'
        if (canTake && choice === 'take') {
          note = '选择当前物品更优：上一行容量 ' + takeCol + ' 的价值 ' + table[row - 1][takeCol] + '，加上当前价值 ' + item.value + '，得到 ' + result + '。'
        } else if (canTake && takeValue === skipValue) {
          note = '选择与不选都得到 ' + skipValue + '，当前格保留这个最优值；两条来源都合法。'
        } else if (canTake) {
          note = '不选当前物品更优：上一行同容量已经有 ' + skipValue + '，选择当前物品只能得到 ' + takeValue + '。'
        }

        steps.push({
          row,
          col,
          itemIndex,
          skipSource: [row - 1, col],
          takeSource: canTake ? [row - 1, takeCol] : null,
          skipValue,
          takeValue,
          result,
          choice,
          snapshot: cloneTable(),
          note
        })
      }
    })

    const itemEl = root.querySelector('[data-role="item"]')
    const capacityEl = root.querySelector('[data-role="capacity"]')
    const bestEl = root.querySelector('[data-role="best"]')
    const itemsEl = root.querySelector('[data-role="items"]')
    const tableEl = root.querySelector('[data-role="table"]')
    const skipEl = root.querySelector('[data-role="skip"]')
    const takeEl = root.querySelector('[data-role="take"]')
    const resultEl = root.querySelector('[data-role="result"]')
    const noteEl = root.querySelector('[data-role="note"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const prevBtn = root.querySelector('[data-action="prev"]')
    const nextBtn = root.querySelector('[data-action="next"]')
    const playBtn = root.querySelector('[data-action="play"]')
    const resetBtn = root.querySelector('[data-action="reset"]')
    let index = 0
    let timer = null

    const sameCell = (cell, row, col) => {
      return cell && cell[0] === row && cell[1] === col
    }

    const stop = () => {
      if (timer) window.clearInterval(timer)
      timer = null
      playBtn.textContent = '播放'
    }

    const renderItems = step => {
      itemsEl.innerHTML = items.map((item, itemIndex) => {
        const active = itemIndex === step.itemIndex ? ' current' : ''
        return '<span class="dp-item' + active + '">#' + (itemIndex + 1) +
          ' <b>w=' + item.weight + '</b> <b>v=' + item.value + '</b></span>'
      }).join('')
    }

    const renderTable = step => {
      tableEl.style.setProperty('--dp-capacity-columns', capacity + 1)
      let html = '<div class="dp-table-row dp-table-header-row" role="row" aria-rowindex="1">' +
        '<div class="dp-table-head dp-table-corner" role="columnheader" aria-colindex="1">物品 / 容量</div>'
      for (let col = 0; col <= capacity; col += 1) {
        html += '<div class="dp-table-head" role="columnheader" aria-colindex="' + (col + 2) + '">' + col + '</div>'
      }
      html += '</div>'

      for (let row = 0; row <= items.length; row += 1) {
        const label = row === 0
          ? '不选物品'
          : '#' + row + ' · w=' + items[row - 1].weight + ' · v=' + items[row - 1].value
        html += '<div class="dp-table-row" role="row" aria-rowindex="' + (row + 2) + '">' +
          '<div class="dp-table-label" role="rowheader" aria-colindex="1">' + label + '</div>'

        for (let col = 0; col <= capacity; col += 1) {
          const value = step.snapshot[row][col]
          const classes = ['dp-table-cell']
          if (value !== null) classes.push('filled')
          if (step.row === row && step.col === col) classes.push('current')
          if (sameCell(step.skipSource, row, col)) classes.push('source-skip')
          if (sameCell(step.takeSource, row, col)) classes.push('source-take')
          if (index === steps.length - 1 && row === items.length && col === capacity) {
            classes.push('answer')
          }
          html += '<div class="' + classes.join(' ') + '" role="cell" aria-colindex="' + (col + 2) + '" data-row="' + row + '" data-capacity="' + col + '">' +
            (value === null ? '·' : value) + '</div>'
        }
        html += '</div>'
      }

      tableEl.innerHTML = html
    }

    const render = () => {
      const step = steps[index]
      renderItems(step)
      renderTable(step)

      if (step.itemIndex < 0) {
        itemEl.textContent = '初始化'
        capacityEl.textContent = '—'
        skipEl.textContent = '—'
        takeEl.textContent = '—'
        resultEl.textContent = '第 0 行全部初始化为 0'
      } else {
        const item = items[step.itemIndex]
        itemEl.textContent = '#' + (step.itemIndex + 1) + '（w=' + item.weight + '，v=' + item.value + '）'
        capacityEl.textContent = step.col
        skipEl.textContent = 'dp[' + (step.row - 1) + '][' + step.col + '] = ' + step.skipValue
        takeEl.textContent = step.takeSource
          ? 'dp[' + step.takeSource[0] + '][' + step.takeSource[1] + '] + ' + item.value + ' = ' + step.takeValue
          : '容量不足，不能选择'
        resultEl.textContent = 'dp[' + step.row + '][' + step.col + '] = ' + step.result
      }

      bestEl.textContent = step.result
      noteEl.textContent = step.note
      stepEl.textContent = '第 ' + (index + 1) + ' / ' + steps.length + ' 步'
      prevBtn.disabled = index === 0
      nextBtn.disabled = index === steps.length - 1
    }

    prevBtn.addEventListener('click', () => {
      stop()
      if (index > 0) index -= 1
      render()
    })
    nextBtn.addEventListener('click', () => {
      stop()
      if (index < steps.length - 1) index += 1
      render()
    })
    resetBtn.addEventListener('click', () => {
      stop()
      index = 0
      render()
    })
    playBtn.addEventListener('click', () => {
      if (timer) {
        stop()
        return
      }
      if (index === steps.length - 1) index = 0
      playBtn.textContent = '暂停'
      render()
      timer = window.setInterval(() => {
        if (index >= steps.length - 1) {
          stop()
          return
        }
        index += 1
        render()
        if (index >= steps.length - 1) stop()
      }, 1150)
    })

    render()
  })()
</script>

表格最终得到 `dp[3][4] = 35`，对应选择重量 1、价值 15 和重量 3、价值 20 的两件物品。单独选择重量 4 的物品只有价值 30，所以“看起来最完整地装满容量”也不一定最优。

### 6.2 压缩成一维时，容量必须倒序

二维转移的当前行只依赖上一行，可以压缩为：

```python
def zero_one_knapsack(
    weights: list[int],
    values: list[int],
    capacity: int,
) -> int:
    dp = [0] * (capacity + 1)

    for weight, value in zip(weights, values):
        for current in range(capacity, weight - 1, -1):
            dp[current] = max(
                dp[current],
                dp[current - weight] + value,
            )

    return dp[capacity]
```

容量从大到小，是为了让 `dp[current - weight]` 仍然表示“还没有使用当前物品”时的上一层状态。

如果容量从小到大：

```python
for current in range(weight, capacity + 1):
    dp[current] = max(dp[current], dp[current - weight] + value)
```

较小容量刚写入的结果会立刻被较大容量读取，同一件物品可能在一轮内反复使用，题型就变成了完全背包。

下面把同一维 `dp` 数组的原地更新过程拆开。先看正确的容量倒序：橙色是正在写入的 `dp[j]`，蓝色是来源 `dp[j - weight]`，绿色是本轮已经处理过的较大容量。切到“错误正序”后，红色来源表示它已经在本轮包含了当前物品。

<div class="algo-demo dp-knapsack-1d-demo" id="dp-knapsack-1d-demo" data-mode="reverse">
  <div class="algo-demo-title"><strong>一维滚动数组：遍历方向决定物品能用几次</strong><span class="algo-pill">同一组物品 · 容量 4</span></div>
  <div class="dp1-mode-switch" role="group" aria-label="选择一维背包演示模式">
    <button type="button" data-mode="reverse" aria-pressed="true">正确：容量倒序</button>
    <button type="button" data-mode="forward" aria-pressed="false">反例：容量正序</button>
  </div>
  <div class="algo-stats">
    <span class="algo-stat">当前物品：<strong data-role="item">初始化</strong></span>
    <span class="algo-stat">遍历方向：<strong data-role="direction">4 → 1</strong></span>
    <span class="algo-stat">当前容量：<strong data-role="capacity">—</strong></span>
  </div>
  <div class="dp1-array-wrap" role="region" aria-label="可横向滚动的一维背包 dp 数组" tabindex="0">
    <div class="dp1-array" data-role="array" role="list" aria-label="容量 0 到 4 的 dp 值"></div>
  </div>
  <div class="dp1-order-line">
    <span>本轮容量顺序</span>
    <div class="dp1-order" data-role="order"></div>
  </div>
  <div class="dp1-formula-panel">
    <div class="dp1-formula dp1-before"><span>原值</span><code data-role="before">—</code></div>
    <div class="dp1-formula dp1-candidate"><span>选择当前物品</span><code data-role="candidate">—</code></div>
    <div class="dp1-formula dp1-write"><span>写回</span><code data-role="write">—</code></div>
  </div>
  <div class="algo-note" data-role="note" aria-live="polite" aria-atomic="true"></div>
  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button>
    <button type="button" data-action="next">下一步</button>
    <button type="button" data-action="play">播放</button>
    <button type="button" data-action="reset">重置</button>
    <span class="algo-step" data-role="step"></span>
  </div>
</div>

<script>
  (() => {
    const root = document.getElementById('dp-knapsack-1d-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const items = [
      { weight: 1, value: 15 },
      { weight: 3, value: 20 },
      { weight: 4, value: 30 }
    ]
    const capacity = 4

    const buildReverseSteps = () => {
      const dp = Array(capacity + 1).fill(0)
      const result = [{
        mode: 'reverse',
        itemIndex: -1,
        current: null,
        source: null,
        sourceReused: false,
        before: null,
        sourceValue: null,
        candidate: null,
        written: 0,
        order: [],
        orderIndex: -1,
        processed: [],
        dp: dp.slice(),
        note: '初始化 dp[0..4] = 0。接下来每件物品都从容量 4 向左扫描。'
      }]

      items.forEach((item, itemIndex) => {
        const order = []
        for (let current = capacity; current >= item.weight; current -= 1) {
          order.push(current)
        }
        const processed = []

        order.forEach((current, orderIndex) => {
          const source = current - item.weight
          const before = dp[current]
          const sourceValue = dp[source]
          const candidate = sourceValue + item.value
          const written = Math.max(before, candidate)
          const sourceReused = processed.includes(source)
          dp[current] = written
          processed.push(current)

          let note = '来源 dp[' + source + '] 还没有在当前物品这一轮被更新，因此它只包含前 ' + itemIndex + ' 件物品。当前物品最多使用一次。'
          if (itemIndex === items.length - 1 && current === capacity) {
            note = '重量 4 的物品单独提供价值 30，不如原来的 35，所以 dp[4] 保持 35。倒序更新完成。'
          }

          result.push({
            mode: 'reverse',
            itemIndex,
            current,
            source,
            sourceReused,
            before,
            sourceValue,
            candidate,
            written,
            order: order.slice(),
            orderIndex,
            processed: processed.slice(),
            dp: dp.slice(),
            note
          })
        })
      })

      return result
    }

    const buildForwardSteps = () => {
      const item = items[0]
      const dp = Array(capacity + 1).fill(0)
      const order = []
      for (let current = item.weight; current <= capacity; current += 1) {
        order.push(current)
      }
      const result = [{
        mode: 'forward',
        itemIndex: 0,
        current: null,
        source: null,
        sourceReused: false,
        before: null,
        sourceValue: null,
        candidate: null,
        written: 0,
        order: order.slice(),
        orderIndex: -1,
        processed: [],
        dp: dp.slice(),
        note: '反例只放入第 1 件物品（重量 1，价值 15），并错误地从容量 1 向右扫描。'
      }]
      const processed = []

      order.forEach((current, orderIndex) => {
        const source = current - item.weight
        const before = dp[current]
        const sourceValue = dp[source]
        const candidate = sourceValue + item.value
        const written = Math.max(before, candidate)
        const sourceReused = processed.includes(source)
        dp[current] = written
        processed.push(current)

        let note = '第一次更新 dp[1] = 15 本身没有问题，但接下来更大容量会读取本轮刚写入的值。'
        if (sourceReused) {
          note = '来源 dp[' + source + '] 已经包含当前物品，继续加 15 等于再次选择同一件物品。正序把 0-1 背包错误地变成了完全背包。'
        }
        if (current === capacity) {
          note = '最终一件重量 1、价值 15 的物品被重复用了 4 次，错误得到 dp[4] = 60；0-1 背包的正确结果不允许这样计算。'
        }

        result.push({
          mode: 'forward',
          itemIndex: 0,
          current,
          source,
          sourceReused,
          before,
          sourceValue,
          candidate,
          written,
          order: order.slice(),
          orderIndex,
          processed: processed.slice(),
          dp: dp.slice(),
          note
        })
      })

      return result
    }

    const reverseSteps = buildReverseSteps()
    const forwardSteps = buildForwardSteps()
    const itemEl = root.querySelector('[data-role="item"]')
    const directionEl = root.querySelector('[data-role="direction"]')
    const capacityEl = root.querySelector('[data-role="capacity"]')
    const arrayEl = root.querySelector('[data-role="array"]')
    const orderEl = root.querySelector('[data-role="order"]')
    const beforeEl = root.querySelector('[data-role="before"]')
    const candidateEl = root.querySelector('[data-role="candidate"]')
    const writeEl = root.querySelector('[data-role="write"]')
    const noteEl = root.querySelector('[data-role="note"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const prevBtn = root.querySelector('[data-action="prev"]')
    const nextBtn = root.querySelector('[data-action="next"]')
    const playBtn = root.querySelector('[data-action="play"]')
    const resetBtn = root.querySelector('[data-action="reset"]')
    const modeButtons = root.querySelectorAll('[data-mode]')
    let mode = 'reverse'
    let steps = reverseSteps
    let index = 0
    let timer = null

    const stop = () => {
      if (timer) window.clearInterval(timer)
      timer = null
      playBtn.textContent = '播放'
    }

    const renderArray = state => {
      arrayEl.innerHTML = state.dp.map((value, cellIndex) => {
        const classes = ['dp1-cell']
        const isTarget = cellIndex === state.current
        const isSource = cellIndex === state.source
        if (state.processed.includes(cellIndex) && !isTarget) classes.push('updated')
        if (isSource) classes.push('source')
        if (isSource && state.sourceReused) classes.push('reused')
        if (isTarget) classes.push('target')
        if (mode === 'reverse' && index === steps.length - 1 && cellIndex === capacity) {
          classes.push('answer')
        }

        let pointers = ''
        if (isTarget) pointers += '<small class="dp1-pointer dp1-target-pointer">j</small>'
        if (isSource) pointers += '<small class="dp1-pointer dp1-source-pointer">j - w</small>'
        const label = '容量 ' + cellIndex + '，当前值 ' + value +
          (isTarget ? '，正在写入' : '') +
          (isSource ? state.sourceReused ? '，来源已在本轮更新' : '，选择来源' : '')

        return '<div class="' + classes.join(' ') + '" role="listitem" aria-label="' + label + '">' +
          pointers + '<span class="dp1-value">' + value + '</span>' +
          '<span class="dp1-index">dp[' + cellIndex + ']</span></div>'
      }).join('')
    }

    const renderOrder = state => {
      if (!state.order.length) {
        orderEl.innerHTML = '<span class="dp1-order-empty">等待处理物品</span>'
        return
      }

      orderEl.innerHTML = state.order.map((current, orderIndex) => {
        const classes = ['dp1-order-token']
        if (orderIndex < state.orderIndex) classes.push('done')
        if (orderIndex === state.orderIndex) classes.push('current')
        return '<span class="' + classes.join(' ') + '">' + current + '</span>'
      }).join('<i>→</i>')
    }

    const render = () => {
      const state = steps[index]
      root.dataset.mode = mode
      modeButtons.forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.mode === mode))
      })
      renderArray(state)
      renderOrder(state)

      if (state.itemIndex < 0) {
        itemEl.textContent = '初始化'
      } else {
        const item = items[state.itemIndex]
        itemEl.textContent = '#' + (state.itemIndex + 1) + '（w=' + item.weight + '，v=' + item.value + '）'
      }
      directionEl.textContent = mode === 'reverse' ? '从大到小' : '从小到大（错误）'
      capacityEl.textContent = state.current === null ? '—' : state.current

      if (state.current === null) {
        beforeEl.textContent = '—'
        candidateEl.textContent = '—'
        writeEl.textContent = 'dp = [' + state.dp.join(', ') + ']'
      } else {
        beforeEl.textContent = '旧 dp[' + state.current + '] = ' + state.before
        candidateEl.textContent = 'dp[' + state.source + '] + ' + items[state.itemIndex].value + ' = ' + state.candidate
        writeEl.textContent = 'dp[' + state.current + '] = max(' + state.before + ', ' + state.candidate + ') = ' + state.written
      }

      noteEl.textContent = state.note
      stepEl.textContent = '第 ' + (index + 1) + ' / ' + steps.length + ' 步'
      prevBtn.disabled = index === 0
      nextBtn.disabled = index === steps.length - 1
    }

    const setMode = nextMode => {
      stop()
      mode = nextMode
      steps = mode === 'reverse' ? reverseSteps : forwardSteps
      index = 0
      render()
    }

    modeButtons.forEach(button => {
      button.addEventListener('click', () => setMode(button.dataset.mode))
    })
    prevBtn.addEventListener('click', () => {
      stop()
      if (index > 0) index -= 1
      render()
    })
    nextBtn.addEventListener('click', () => {
      stop()
      if (index < steps.length - 1) index += 1
      render()
    })
    resetBtn.addEventListener('click', () => setMode(mode))
    playBtn.addEventListener('click', () => {
      if (timer) {
        stop()
        return
      }
      if (index === steps.length - 1) index = 0
      playBtn.textContent = '暂停'
      render()
      timer = window.setInterval(() => {
        if (index >= steps.length - 1) {
          stop()
          return
        }
        index += 1
        render()
        if (index >= steps.length - 1) stop()
      }, 1250)
    })

    render()
  })()
</script>

这个对照的关键不是“倒序是一条需要背的规则”，而是看来源属于哪一层：

```text
倒序：dp[j - weight] 还没有在本轮更新 → 读取上一层 → 当前物品最多一次
正序：dp[j - weight] 可能刚在本轮更新 → 读取当前层 → 当前物品可以重复
```

### 6.3 分割等和子集：背包能否恰好装满

[416. 分割等和子集](https://leetcode.cn/problems/partition-equal-subset-sum/) 要把数组分成和相等的两部分。若总和为 `total`，问题等价于：能否从每个数字最多选一次，组成 `total // 2`。

```python
def can_partition(nums: list[int]) -> bool:
    total = sum(nums)

    if total % 2 == 1:
        return False

    target = total // 2
    dp = [False] * (target + 1)
    dp[0] = True

    for num in nums:
        for current in range(target, num - 1, -1):
            dp[current] = dp[current] or dp[current - num]

    return dp[target]
```

这里 `dp[current]` 表示能否从已经处理的数字中选出一些，使总和恰好等于 `current`。`dp[0] = True` 表示空集合可以组成 0。

[1049. 最后一块石头的重量 II](https://leetcode.cn/problems/last-stone-weight-ii/) 也是把石头分成两组，让两组重量尽量接近。背包尽量装到 `total // 2`，若能装到的最大重量为 `best`，最终差值就是：

```python
total - 2 * best
```

### 6.4 目标和：从可行性变成方案计数

[494. 目标和](https://leetcode.cn/problems/target-sum/) 给每个非负整数添加正号或负号。设添加正号的数字和为 `positive`，添加负号的数字和为 `negative`：

```text
positive - negative = target
positive + negative = total
positive = (total + target) / 2
```

问题转化为：从数组中选一些数字，使和为 `bag`，一共有多少种选法。

```python
def find_target_sum_ways(nums: list[int], target: int) -> int:
    total = sum(nums)

    if abs(target) > total or (total + target) % 2 == 1:
        return 0

    bag = (total + target) // 2
    dp = [0] * (bag + 1)
    dp[0] = 1

    for num in nums:
        for current in range(bag, num - 1, -1):
            dp[current] += dp[current - num]

    return dp[bag]
```

计数题中 `dp[0] = 1` 非常关键。相同数值出现在不同下标时，仍然是不同的选择对象。数字 0 也会被正确处理：处理一个 0 时，`dp[current] += dp[current]`，所有已有方案数翻倍，对应给这个 0 添加正号或负号。

[474. 一和零](https://leetcode.cn/problems/ones-and-zeroes/) 则是二维容量的 0-1 背包：每个字符串消耗若干个 0 和若干个 1，两个容量都必须倒序遍历。

## 7. 完全背包：物品可以重复使用

完全背包与 0-1 背包的状态公式很像，关键区别是容量正序：

```python
def complete_knapsack(
    weights: list[int],
    values: list[int],
    capacity: int,
) -> int:
    dp = [0] * (capacity + 1)

    for weight, value in zip(weights, values):
        for current in range(weight, capacity + 1):
            dp[current] = max(
                dp[current],
                dp[current - weight] + value,
            )

    return dp[capacity]
```

正序让当前物品刚更新出的较小容量状态，可以继续参与更大容量的计算，因此同一物品能重复使用。

### 7.1 零钱兑换 II：求组合数，硬币放外层

[518. 零钱兑换 II](https://leetcode.cn/problems/coin-change-ii/) 求组成金额的硬币组合数。`1 + 2` 和 `2 + 1` 是同一种组合，所以硬币放外层，保证每组硬币只按固定顺序生成。

```python
def change(amount: int, coins: list[int]) -> int:
    dp = [0] * (amount + 1)
    dp[0] = 1

    for coin in coins:
        for current in range(coin, amount + 1):
            dp[current] += dp[current - coin]

    return dp[amount]
```

### 7.2 组合总和 IV：题名叫组合，实际求排列数

[377. 组合总和 IV](https://leetcode.cn/problems/combination-sum-iv/) 中不同选择顺序要分别统计。例如 `[1, 2]` 和 `[2, 1]` 是两种答案，所以先遍历容量，再遍历数字：

```python
def combination_sum4(nums: list[int], target: int) -> int:
    dp = [0] * (target + 1)
    dp[0] = 1

    for current in range(1, target + 1):
        for num in nums:
            if current >= num:
                dp[current] += dp[current - num]

    return dp[target]
```

两道题的递推式都是：

```python
dp[current] += dp[current - item]
```

但循环顺序决定了是否区分排列顺序：

| 目标 | 外层循环 | 内层循环 |
|---|---|---|
| 组合数 | 物品 | 容量正序 |
| 排列数 | 容量正序 | 物品 |

这条“组合与排列”的结论主要用于计数题。最大值和最小值问题仍然要先分析状态依赖，不要机械套表。

### 7.3 零钱兑换：最少硬币要用无穷大初始化

[322. 零钱兑换](https://leetcode.cn/problems/coin-change/) 求凑成金额的最少硬币数：

```python
def coin_change(coins: list[int], amount: int) -> int:
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0

    for coin in coins:
        for current in range(coin, amount + 1):
            dp[current] = min(
                dp[current],
                dp[current - coin] + 1,
            )

    return -1 if dp[amount] == float('inf') else dp[amount]
```

如果把所有位置初始化为 0，`min` 会永远保留这个并不存在的 0 个硬币方案。最小值问题常用 `inf` 表示尚不可达。

[279. 完全平方数](https://leetcode.cn/problems/perfect-squares/) 可以把 `1, 4, 9, ...` 看成可无限使用的硬币，转移和零钱兑换相同。

## 8. 多重背包与分组背包：限制使用次数和选择范围

### 8.1 多重背包：每件物品最多使用若干次

多重背包给每件物品一个数量上限 `count`。直接做法是枚举当前物品使用几件：

```python
def multiple_knapsack(
    weights: list[int],
    values: list[int],
    counts: list[int],
    capacity: int,
) -> int:
    dp = [0] * (capacity + 1)

    for weight, value, count in zip(weights, values, counts):
        for current in range(capacity, -1, -1):
            max_count = min(count, current // weight)

            for used in range(1, max_count + 1):
                dp[current] = max(
                    dp[current],
                    dp[current - used * weight] + used * value,
                )

    return dp[capacity]
```

容量倒序保证读取的是处理当前物品之前的较小容量状态。但直接枚举 `used` 时，一件物品最多有 `count` 种取法；数量上限很大时，这一层循环会成为主要开销。

#### 二进制分组：把多件相同物品打包成虚拟物品

二进制分组（也叫二进制拆分）的想法是：不再逐个枚举“使用 0 件、1 件、2 件……”，而是把若干件相同物品捆成一组，并把每组看成一件只能选择一次的 0-1 物品。

原物品的重量是 `weight`、价值是 `value`。把 `amount` 件捆成一组后，这件虚拟物品就是：

```text
虚拟重量 = amount * weight
虚拟价值 = amount * value
```

每个虚拟物品最多选择一次，因此可以直接套用 0-1 背包的容量倒序更新。问题只剩下：组的大小应该怎样设计，才能表示从 0 到 `count` 的所有使用数量？

答案是依次取 `1, 2, 4, ...`，最后不足下一个二次幂的部分作为一组。以最多 13 件为例：

```text
13 = 1 + 2 + 4 + 6
```

这里不是在求 13 的普通二进制表示。普通二进制表示 `13 = 1 + 4 + 8` 只能说明怎样凑出 13；多重背包要求这些组的不同子集能够表示使用 `0..13` 件的每一种情况。

`1, 2, 4, 6` 的覆盖过程是：

| 已生成的组 | 可以表示的使用数量 |
|---|---|
| `1` | `0..1` |
| `1, 2` | `0..3` |
| `1, 2, 4` | `0..7` |
| `1, 2, 4, 6` | `0..13` |

前三组已经能够表示 `0..7`。最后一组大小为 6：

- 不选最后一组，仍然表示 `0..7`。
- 选择最后一组，再搭配前三组，可以表示 `6..13`。
- 两个范围合起来覆盖 `0..13`，没有缺口。

更一般地说，假设已有分组能够连续表示 `0..S`，那么下一组只要不超过 `S + 1`，就能把连续范围扩展到 `0..S + group`。每次取 `1, 2, 4, ...`，正好以最快速度扩大这个范围；最后的余数不会超过下一个二次幂，因此仍然不会产生缺口。

假设某种物品的重量为 2、价值为 3、最多有 13 件，拆分后得到四件虚拟物品：

| 组内原物品数量 | 虚拟重量 | 虚拟价值 |
|---:|---:|---:|
| 1 | 2 | 3 |
| 2 | 4 | 6 |
| 4 | 8 | 12 |
| 6 | 12 | 18 |

例如选择大小为 `1、4、6` 的三组，就表示使用了 11 件原物品，总重量为 `22`，总价值为 `33`。因为每组只能选择一次，最多只能使用 `1 + 2 + 4 + 6 = 13` 件，不会超过原来的数量上限。

代码可以写成：

```python
def multiple_knapsack_binary(
    weights: list[int],
    values: list[int],
    counts: list[int],
    capacity: int,
) -> int:
    dp = [0] * (capacity + 1)

    for weight, value, count in zip(weights, values, counts):
        # 容量最多只能装下 capacity // weight 件，多余库存无需拆分。
        remaining = min(count, capacity // weight)
        group = 1

        # 依次生成 1、2、4……件的组，把最后余数留作一组。
        while group < remaining:
            bundle_weight = group * weight
            bundle_value = group * value

            # 每个组是一件 0-1 物品，所以容量必须倒序。
            for current in range(capacity, bundle_weight - 1, -1):
                dp[current] = max(
                    dp[current],
                    dp[current - bundle_weight] + bundle_value,
                )

            remaining -= group
            group *= 2

        if remaining > 0:
            bundle_weight = remaining * weight
            bundle_value = remaining * value

            for current in range(capacity, bundle_weight - 1, -1):
                dp[current] = max(
                    dp[current],
                    dp[current - bundle_weight] + bundle_value,
                )

    return dp[capacity]
```

以 `count = 13` 为例，循环依次取出 `1、2、4`，此时 `remaining = 6`；因为下一组 8 已经大于剩余数量，最后单独处理 6，于是得到 `1、2、4、6`。

#### 为什么这样做更快

设背包容量为 `C`，第 `i` 件物品在容量限制下实际最多能使用 `m_i` 次：

- 直接枚举件数，需要大约 `O(C * sum(m_i))` 的时间；若统一把数量上限记为 `M`，最坏可写成 `O(n * C * M)`。
- 二进制分组把每种物品拆成 `O(log(m_i + 1))` 个虚拟物品，时间降为 `O(C * sum(log(m_i + 1)))`，通常记作 `O(n * C * log M)`。
- 两种写法都只使用一个一维数组，额外空间都是 `O(C)`。

二进制分组的优势不只有复杂度：

1. 数量上限越大，减少的枚举次数越明显。
2. 拆完以后只需要复用熟悉的 0-1 背包模板，不必在每个状态中再枚举使用件数。
3. 每组最多选择一次，而且所有组的数量之和等于上限，数量约束会自然得到保证。
4. 相比单调队列优化，它更容易实现、调试和在面试中解释。

它也不是任何情况下都最优：如果 `count >= capacity // weight`，数量限制实际上不会生效，这种物品可以直接按完全背包正序更新；当容量和数量都非常大、题目又严格卡时间时，才需要进一步考虑 `O(n * C)` 的单调队列优化。

#### 单调队列优化：把枚举件数变成滑动窗口最大值

如果还不熟悉单调队列，可以先复习[栈与队列笔记中的滑动窗口最大值](/algorithm/stack-queue/#6-单调队列：窗口最大值只保留有竞争力的元素)。那里解决的是“窗口每移动一步，怎样快速得到窗口最大值”；多重背包优化做的事情，就是先把状态转移改写成同一种问题。

先固定一种重量为 `weight`、价值为 `value`、最多使用 `count` 次的物品。处理它之前的数组记为 `previous`，处理之后的数组仍记为 `dp`。直接转移是：

```text
dp[current] = max(
    previous[current - used * weight] + used * value
)

其中 0 <= used <= count，且 used * weight <= current。
```

慢的原因是：每个 `current` 都要重新枚举一遍 `used`。想去掉这一层枚举，需要先观察哪些容量之间会发生转移。

##### 第一步：按照容量除以重量的余数分组

每次选择当前物品，容量只会增加 `weight`，因此能够互相转移的容量，对 `weight` 的余数一定相同。

例如 `weight = 3`，容量会被拆成三条互不影响的序列：

```text
余数 0：0, 3, 6, 9, 12, ...
余数 1：1, 4, 7, 10, 13, ...
余数 2：2, 5, 8, 11, 14, ...
```

对于某个固定余数 `remainder`，把这条序列中的容量写成：

```text
current = remainder + step * weight
```

这里的 `step` 是容量在当前余数序列中的位置，不是使用了几件物品。

以 `weight = 3、value = 4、count = 2` 为例。在余数为 1 的序列中计算容量 10，也就是 `step = 3` 时，合法来源只有：

| 使用当前物品数量 | 上一层来源 | 候选价值 |
|---:|---:|---:|
| 0 | `previous[10]` | `previous[10]` |
| 1 | `previous[7]` | `previous[7] + 4` |
| 2 | `previous[4]` | `previous[4] + 8` |

到了容量 13，候选来源变为 `previous[13]、previous[10]、previous[7]`。来源沿着同一余数序列向右滑动，而且窗口始终只保留最近 `count + 1` 个位置，这已经很像滑动窗口最大值。

##### 第二步：把转移式整理成窗口最大值

令 `source_step` 表示来源容量在同一余数序列中的位置，那么：

```text
used = step - source_step
```

代入原转移：

```text
dp[remainder + step * weight]
= max(
    previous[remainder + source_step * weight]
    + (step - source_step) * value
)
```

把只与当前 `step` 有关的部分提到最大值外面：

```text
dp[remainder + step * weight]
= step * value
   + max(
       previous[remainder + source_step * weight]
       - source_step * value
     )
```

其中来源位置必须满足：

```text
step - count <= source_step <= step
```

因此，当 `step` 依次增加时，需要维护的就是一个长度最多为 `count + 1` 的滑动窗口。窗口里的候选分数是：

```text
score(source_step)
= previous[remainder + source_step * weight]
  - source_step * value
```

最大的 `score` 永远放在队首，就能在 `O(1)` 时间得到当前状态的最优来源。

##### 第三步：队列怎样维护候选来源

队列中保存 `(source_step, score)`，并让 `score` 从队首到队尾单调递减。每来到一个新的 `step`，依次做三件事：

1. 如果队首的 `source_step < step - count`，说明使用数量已经超过上限，把队首弹出。
2. 当前候选的 `score` 如果大于等于队尾，就把队尾弹出。旧候选分数不更大、位置还更靠左，以后不可能优于当前候选。
3. 当前候选入队；此时队首就是当前窗口的最大分数。

下面只跟踪 `weight = 3、value = 4、count = 2` 这件物品，并专门观察余数为 1 的容量序列 `1、4、7、10、13`。`previous` 表示处理当前物品之前已经冻结的上一层结果；其他两个余数序列的处理方式完全相同。

<div class="algo-demo multiple-knapsack-queue-demo" id="multiple-knapsack-queue-demo">
  <div class="algo-demo-title">
    <strong>多重背包单调队列：把来源变成滑动窗口</strong>
    <span class="algo-pill">w = 3 · v = 4 · count = 2 · 观察 remainder = 1</span>
  </div>
  <div class="algo-stats">
    <span class="algo-stat">动作：<strong data-role="action"></strong></span>
    <span class="algo-stat">当前位置：<strong data-role="current"></strong></span>
    <span class="algo-stat">合法来源窗口：<strong data-role="window"></strong></span>
  </div>
  <div class="mkq-remainder-lanes" data-role="lanes" aria-label="容量按除以重量 3 的余数分组"></div>
  <div class="mkq-code-flow" aria-label="当前执行的代码位置">
    <code data-line="remainder">按 current % weight 分组</code>
    <code data-line="score">score = previous[current] - step * value</code>
    <code data-line="expire">front &lt; step-count：popleft()</code>
    <code data-line="pop">tail.score &lt;= score：pop()</code>
    <code data-line="append">queue.append((step, score))</code>
    <code data-line="write">dp[current] = step*value + queue[0].score</code>
  </div>
  <div class="mkq-source-heading">余数 1 序列：每张卡是一种“从上一层出发”的候选</div>
  <div class="mkq-source-grid" data-role="sources" role="list"></div>
  <div class="mkq-state-lanes">
    <div class="mkq-state-lane">
      <span>单调队列：队首 → 队尾</span>
      <div class="mkq-queue" data-role="queue" aria-live="polite"></div>
    </div>
    <div class="mkq-state-lane">
      <span>已经写回的状态</span>
      <div class="mkq-results" data-role="results" aria-live="polite"></div>
    </div>
  </div>
  <div class="mkq-formula" data-role="formula"></div>
  <div class="algo-note" data-role="note" aria-live="polite"></div>
  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button>
    <button type="button" data-action="next">下一步</button>
    <button type="button" data-action="play">播放</button>
    <button type="button" data-action="reset">重置</button>
    <span class="algo-step" data-role="step"></span>
  </div>
</div>

<script>
  (() => {
    const root = document.getElementById('multiple-knapsack-queue-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const weight = 3
    const value = 4
    const count = 2
    const remainder = 1
    const capacity = 13
    const capacities = [1, 4, 7, 10, 13]
    const previousValues = [5, 7, 12, 14, 17]
    const scores = previousValues.map((previous, step) => previous - step * value)
    const queue = []
    const results = []
    const steps = []

    const saveStep = options => {
      steps.push(Object.assign({
        action: '',
        line: null,
        currentStep: null,
        windowStart: null,
        windowEnd: null,
        removed: null,
        removedFrom: null,
        best: null,
        queue: queue.slice(),
        results: results.map(result => Object.assign({}, result)),
        formula: '先把容量按除以 weight 的余数分组。',
        note: ''
      }, options))
    }

    saveStep({
      action: '按余数分组',
      line: 'remainder',
      note: '选择一次当前物品，容量只会增加 3，所以只有余数相同的容量能够互相转移。动画接下来只扫描蓝色的 remainder = 1 序列。'
    })

    capacities.forEach((current, currentStep) => {
      const currentScore = scores[currentStep]
      const windowStart = Math.max(0, currentStep - count)

      saveStep({
        action: '计算新候选分数',
        line: 'score',
        currentStep,
        windowStart,
        windowEnd: currentStep,
        formula: 'score(' + currentStep + ') = previous[' + current + '] - ' + currentStep +
          ' × 4 = ' + previousValues[currentStep] + ' - ' + (currentStep * value) + ' = ' + currentScore,
        note: '来到 step = ' + currentStep + '、容量 ' + current + '。合法来源 q 只能位于 [' +
          windowStart + ', ' + currentStep + ']，因为最多使用 2 件当前物品。'
      })

      while (queue.length && queue[0] < currentStep - count) {
        const removed = queue.shift()
        saveStep({
          action: '弹出过期队首',
          line: 'expire',
          currentStep,
          windowStart,
          windowEnd: currentStep,
          removed,
          removedFrom: 'front',
          formula: 'q = ' + removed + ' < step - count = ' + (currentStep - count),
          note: '来源 q = ' + removed + ' 需要使用 ' + (currentStep - removed) +
            ' 件当前物品，已经超过数量上限 2，所以必须从队首移除。'
        })
      }

      while (queue.length && scores[queue[queue.length - 1]] <= currentScore) {
        const removed = queue.pop()
        saveStep({
          action: '淘汰无竞争力的队尾',
          line: 'pop',
          currentStep,
          windowStart,
          windowEnd: currentStep,
          removed,
          removedFrom: 'back',
          formula: 'score(' + removed + ') = ' + scores[removed] + ' ≤ score(' + currentStep + ') = ' + currentScore,
          note: '新来源 q = ' + currentStep + ' 分数更大、位置还更靠右；旧队尾 q = ' +
            removed + ' 以后不可能成为窗口最大值。'
        })
      }

      queue.push(currentStep)
      saveStep({
        action: '新候选进入队尾',
        line: 'append',
        currentStep,
        windowStart,
        windowEnd: currentStep,
        best: queue[0],
        formula: 'queue = [' + queue.map(sourceStep => '(q=' + sourceStep + ', score=' + scores[sourceStep] + ')').join(', ') + ']',
        note: '把 (q=' + currentStep + ', score=' + currentScore + ') 放到队尾。队列分数保持从大到小，因此队首就是当前最优来源。'
      })

      const best = queue[0]
      const used = currentStep - best
      const sourceCapacity = capacities[best]
      const written = previousValues[best] + used * value
      results.push({ current, value: written })
      saveStep({
        action: '用队首写回 dp',
        line: 'write',
        currentStep,
        windowStart,
        windowEnd: currentStep,
        best,
        formula: 'dp[' + current + '] = previous[' + sourceCapacity + '] + ' + used +
          ' × 4 = ' + previousValues[best] + ' + ' + (used * value) + ' = ' + written,
        note: '队首 q = ' + best + ' 给出最大 score。它表示从上一层容量 ' + sourceCapacity +
          ' 出发，再使用 ' + used + ' 件当前物品，得到 dp[' + current + '] = ' + written + '。'
      })
    })

    const actionEl = root.querySelector('[data-role="action"]')
    const currentEl = root.querySelector('[data-role="current"]')
    const windowEl = root.querySelector('[data-role="window"]')
    const lanesEl = root.querySelector('[data-role="lanes"]')
    const sourcesEl = root.querySelector('[data-role="sources"]')
    const queueEl = root.querySelector('[data-role="queue"]')
    const resultsEl = root.querySelector('[data-role="results"]')
    const formulaEl = root.querySelector('[data-role="formula"]')
    const noteEl = root.querySelector('[data-role="note"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const codeLines = root.querySelectorAll('[data-line]')
    const prevBtn = root.querySelector('[data-action="prev"]')
    const nextBtn = root.querySelector('[data-action="next"]')
    const playBtn = root.querySelector('[data-action="play"]')
    const resetBtn = root.querySelector('[data-action="reset"]')
    let index = 0
    let timer = null

    const renderRemainderLanes = () => {
      lanesEl.innerHTML = [0, 1, 2].map(laneRemainder => {
        const laneCapacities = []
        for (let current = laneRemainder; current <= capacity; current += weight) {
          laneCapacities.push(current)
        }
        return '<div class="mkq-remainder-lane ' + (laneRemainder === remainder ? 'active' : '') + '">' +
          '<strong>r = ' + laneRemainder + '</strong><div>' + laneCapacities.map(current =>
            '<span>' + current + '</span>'
          ).join('<i>→</i>') + '</div></div>'
      }).join('')
    }

    const renderSources = state => {
      sourcesEl.innerHTML = capacities.map((current, sourceStep) => {
        const classes = ['mkq-source-card']
        const inWindow = state.windowStart !== null &&
          sourceStep >= state.windowStart && sourceStep <= state.windowEnd
        if (inWindow) classes.push('in-window')
        if (state.queue.includes(sourceStep)) classes.push('in-queue')
        if (state.queue[0] === sourceStep) classes.push('is-front')
        if (state.currentStep === sourceStep) classes.push('is-current')
        if (state.removed === sourceStep) classes.push(state.removedFrom === 'front' ? 'is-expired' : 'is-dominated')

        const labels = ['q=' + sourceStep, '容量 ' + current, 'previous=' + previousValues[sourceStep], 'score=' + scores[sourceStep]]
        if (inWindow) labels.push('在合法窗口内')
        if (state.queue.includes(sourceStep)) labels.push('在队列中')

        return '<div class="' + classes.join(' ') + '" role="listitem" aria-label="' + labels.join('，') + '">' +
          '<strong>q = ' + sourceStep + '</strong><span>capacity = ' + current + '</span>' +
          '<span>previous = ' + previousValues[sourceStep] + '</span><code>score = ' + scores[sourceStep] + '</code></div>'
      }).join('')
    }

    const renderQueue = state => {
      if (!state.queue.length) {
        queueEl.innerHTML = '<span class="mkq-empty">空队列</span>'
        return
      }
      queueEl.innerHTML = state.queue.map((sourceStep, position) => {
        let label = ''
        if (state.queue.length === 1) label = '队首 / 队尾'
        else if (position === 0) label = '队首'
        else if (position === state.queue.length - 1) label = '队尾'
        return '<div class="mkq-queue-item"><small>' + label + '</small><strong>q=' + sourceStep +
          '</strong><span>score=' + scores[sourceStep] + '</span></div>'
      }).join('<i>→</i>')
    }

    const renderResults = state => {
      if (!state.results.length) {
        resultsEl.innerHTML = '<span class="mkq-empty">尚未写回</span>'
        return
      }
      resultsEl.innerHTML = state.results.map(result =>
        '<code>dp[' + result.current + '] = ' + result.value + '</code>'
      ).join('')
    }

    const render = () => {
      const state = steps[index]
      actionEl.textContent = state.action
      currentEl.textContent = state.currentStep === null
        ? '—'
        : 'step=' + state.currentStep + ' → capacity=' + capacities[state.currentStep]
      windowEl.textContent = state.windowStart === null
        ? '—'
        : 'q ∈ [' + state.windowStart + ', ' + state.windowEnd + ']'
      codeLines.forEach(line => {
        line.classList.toggle('active', line.dataset.line === state.line)
      })
      renderSources(state)
      renderQueue(state)
      renderResults(state)
      formulaEl.textContent = state.formula
      noteEl.textContent = state.note
      stepEl.textContent = '第 ' + (index + 1) + ' / ' + steps.length + ' 步'
      prevBtn.disabled = index === 0
      nextBtn.disabled = index === steps.length - 1
    }

    const stop = () => {
      if (timer) window.clearInterval(timer)
      timer = null
      playBtn.textContent = '播放'
    }

    prevBtn.addEventListener('click', () => {
      stop()
      if (index > 0) index -= 1
      render()
    })
    nextBtn.addEventListener('click', () => {
      stop()
      if (index < steps.length - 1) index += 1
      render()
    })
    resetBtn.addEventListener('click', () => {
      stop()
      index = 0
      render()
    })
    playBtn.addEventListener('click', () => {
      if (timer) {
        stop()
        return
      }
      if (index === steps.length - 1) index = 0
      playBtn.textContent = '暂停'
      render()
      timer = window.setInterval(() => {
        if (index >= steps.length - 1) {
          stop()
          return
        }
        index += 1
        render()
        if (index >= steps.length - 1) stop()
      }, 1150)
    })

    renderRemainderLanes()
    render()
  })()
</script>

完整代码如下：

```python
from collections import deque


def multiple_knapsack_monotonic(
    weights: list[int],
    values: list[int],
    counts: list[int],
    capacity: int,
) -> int:
    dp = [0] * (capacity + 1)

    for weight, value, count in zip(weights, values, counts):
        # 所有候选都必须来自处理当前物品之前的同一层。
        previous = dp[:]
        effective_count = min(count, capacity // weight)

        if effective_count == 0:
            continue

        # 同一个余数序列中的容量才可能互相转移。
        for remainder in range(min(weight, capacity + 1)):
            queue = deque()
            max_step = (capacity - remainder) // weight

            for step in range(max_step + 1):
                min_source_step = step - effective_count

                # 队首已经离开合法窗口。
                while queue and queue[0][0] < min_source_step:
                    queue.popleft()

                current = remainder + step * weight
                current_score = previous[current] - step * value

                # 保持分数从队首到队尾单调递减。
                while queue and queue[-1][1] <= current_score:
                    queue.pop()

                queue.append((step, current_score))
                best_score = queue[0][1]
                dp[current] = step * value + best_score

    return dp[capacity]
```

这里有两个关键点：

- 必须从 `previous` 计算候选分数。如果直接读取正在更新的 `dp`，当前物品就可能越过数量上限被重复使用。
- 队列里比较的不是原始 `previous[current]`，而是减去 `step * value` 后的 `score`。只有经过这个变换，不同使用数量的候选才可以放进同一个窗口比较。

每个来源位置最多入队一次、从队首或队尾出队一次，因此每个余数序列都是线性扫描。所有余数序列合起来只覆盖容量 `0..capacity` 一遍，所以处理一种物品是 `O(C)`，处理 `n` 种物品就是 `O(n * C)`。

三种写法可以这样选择：

| 做法 | 时间复杂度 | 优点 | 适用情况 |
|---|---:|---|---|
| 直接枚举使用件数 | `O(n * C * M)` | 最直观 | 数量上限很小 |
| 二进制分组 | `O(n * C * log M)` | 复用 0-1 背包，容易实现 | 大多数多重背包题 |
| 单调队列优化 | `O(n * C)` | 不受数量上限 `M` 的线性影响 | 数据规模大、严格卡时间 |

复习时不需要把公式一次背下来。先记住这条思路链：

```text
同一重量只在相同余数的容量之间转移
→ 每条余数序列上，合法来源是一个固定长度窗口
→ 变换候选分数后，需要反复求窗口最大值
→ 用单调队列把枚举件数降为线性扫描
```

### 8.2 分组背包：每组最多选一个选项

分组背包把物品分成若干组，每组最多选一个。稳妥写法是每处理一组就保存上一层：

```python
def group_knapsack(
    groups: list[list[tuple[int, int]]],
    capacity: int,
) -> int:
    dp = [0] * (capacity + 1)

    for group in groups:
        previous = dp[:]

        for current in range(capacity + 1):
            for weight, value in group:
                if current >= weight:
                    dp[current] = max(
                        dp[current],
                        previous[current - weight] + value,
                    )

    return dp[capacity]
```

关键是所有组内选项都从 `previous` 转移。如果把组内物品逐件当普通 0-1 背包处理，就可能从同一组选出多个选项。

背包类型可以用一张表区分：

| 类型 | 每件物品限制 | 一维容量方向 | 关键点 |
|---|---|---|---|
| 0-1 背包 | 最多一次 | 倒序 | 读取上一层，防止重复使用 |
| 完全背包 | 无限次 | 正序 | 允许读取本轮更新结果 |
| 多重背包 | 最多 `count` 次 | 倒序枚举、二进制分组，或按余数分组维护单调队列 | 防止超过数量上限 |
| 分组背包 | 每组最多选一个 | 每组读取同一份上一层 | 组内选项不能互相转移 |

## 9. 打家劫舍：当前选择会限制相邻状态

### 9.1 线性房屋：偷当前房就不能偷前一间

[198. 打家劫舍](https://leetcode.cn/problems/house-robber/) 定义：

```text
dp[i] 表示考虑下标 0..i 的房屋时，能偷到的最大金额。
```

最后一间有两种选择：

```text
不偷 i：dp[i - 1]
偷 i：dp[i - 2] + nums[i]
```

可以压缩成两个变量：

```python
def rob(nums: list[int]) -> int:
    prev2 = 0
    prev1 = 0

    for money in nums:
        current = max(prev1, prev2 + money)
        prev2, prev1 = prev1, current

    return prev1
```

`prev1` 是已经处理到前一间的最优答案，不代表一定偷了前一间。因此“不偷当前房”直接继承 `prev1`。

### 9.2 环形房屋：首尾不能同时出现

[213. 打家劫舍 II](https://leetcode.cn/problems/house-robber-ii/) 首尾相邻。一个合法方案一定属于下面至少一种情况：

- 不考虑最后一间，只处理 `nums[:-1]`。
- 不考虑第一间，只处理 `nums[1:]`。

```python
def rob_circle(nums: list[int]) -> int:
    if len(nums) == 1:
        return nums[0]

    def rob_line(houses: list[int]) -> int:
        prev2 = 0
        prev1 = 0

        for money in houses:
            prev2, prev1 = prev1, max(prev1, prev2 + money)

        return prev1

    return max(rob_line(nums[:-1]), rob_line(nums[1:]))
```

### 9.3 树形房屋：每个节点返回偷与不偷

[337. 打家劫舍 III](https://leetcode.cn/problems/house-robber-iii/) 把房屋放在二叉树上，父子节点不能同时偷。后序遍历每个节点，返回两个状态：

```text
skip：不偷当前节点时的最大金额
take：偷当前节点时的最大金额
```

```python
def rob_tree(root: TreeNode | None) -> int:
    def dfs(node: TreeNode | None) -> tuple[int, int]:
        if node is None:
            return 0, 0

        left_skip, left_take = dfs(node.left)
        right_skip, right_take = dfs(node.right)

        take = node.val + left_skip + right_skip
        skip = max(left_skip, left_take) + max(right_skip, right_take)

        return skip, take

    return max(dfs(root))
```

不偷当前节点时，孩子可以偷也可以不偷，所以左右孩子都取各自两个状态的最大值；不要误写成“不偷父节点就必须偷孩子”。

## 10. 股票问题：统一成持有与不持有状态

股票题不要为每道题单独背一份代码。先统一两个基础状态：

```text
hold：今天结束时，持有一只股票的最大利润
cash：今天结束时，不持有股票的最大利润
```

状态表示一天结束后的最优结果，不代表今天一定发生了买入或卖出。

### 10.1 一次交易和无限次交易，只差买入来源

[121. 买卖股票的最佳时机](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock/) 最多交易一次：

先保留完整的二维 DP 表：

```text
dp[day][0]：第 day 天结束时，持有股票的最大利润
dp[day][1]：第 day 天结束时，不持有股票的最大利润
```

```python
def max_profit_once(prices: list[int]) -> int:
    if not prices:
        return 0

    days = len(prices)
    dp = [[0, 0] for _ in range(days)]

    # 第 0 天：可以买入，或者什么也不做。
    dp[0][0] = -prices[0]
    dp[0][1] = 0

    for day in range(1, days):
        price = prices[day]

        # 今天持股：昨天已经持股，或者今天进行唯一一次买入。
        dp[day][0] = max(
            dp[day - 1][0],
            -price,
        )

        # 今天不持股：昨天就不持股，或者今天卖出。
        dp[day][1] = max(
            dp[day - 1][1],
            dp[day - 1][0] + price,
        )

    return dp[-1][1]
```

这两个转移可以直接按“今天做什么”理解：

- 今天结束后持股：要么延续昨天的持股状态，要么今天第一次买入。
- 今天结束后不持股：要么昨天就没有股票，要么把昨天持有的股票在今天卖出。

因为整道题最多只能完成一次交易，所以买入时不能使用之前卖出赚到的利润，买入来源只能是 `0 - price`，也就是 `-price`。理解二维表以后，再把上一天的两个状态压缩成 `hold` 和 `cash` 即可。

[122. 买卖股票的最佳时机 II](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock-ii/) 允许反复交易，卖出后的利润可以用于下一次买入：

```python
def max_profit_unlimited(prices: list[int]) -> int:
    hold = float('-inf')
    cash = 0

    for price in prices:
        previous_hold = hold
        previous_cash = cash
        hold = max(previous_hold, previous_cash - price)
        cash = max(previous_cash, previous_hold + price)

    return cash
```

两个模板的核心区别：

```text
一次交易买入：-price
无限交易买入：previous_cash - price
```

### 10.2 冷冻期：卖出后的次日不能立刻买入

[309. 买卖股票的最佳时机含冷冻期](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock-with-cooldown/) 可以维护三个状态：

```text
dp[day][0]：第 day 天结束时持有股票
dp[day][1]：第 day 天结束时刚刚卖出股票
dp[day][2]：第 day 天结束时不持股，并且今天没有卖出
```

```python
def max_profit_with_cooldown(prices: list[int]) -> int:
    if not prices:
        return 0

    days = len(prices)
    dp = [[0, 0, 0] for _ in range(days)]

    # 第 0 天可以买入或休息，但不可能完成卖出。
    dp[0][0] = -prices[0]
    dp[0][1] = float('-inf')
    dp[0][2] = 0

    for day in range(1, days):
        price = prices[day]

        # 今天持股：延续昨天的持股，或者从昨天的休息状态买入。
        dp[day][0] = max(
            dp[day - 1][0],
            dp[day - 1][2] - price,
        )

        # 今天刚卖出：只能卖掉昨天持有的股票。
        dp[day][1] = dp[day - 1][0] + price

        # 今天休息：昨天已经休息，或者昨天刚卖出后进入冷冻期。
        dp[day][2] = max(
            dp[day - 1][2],
            dp[day - 1][1],
        )

    # 最后必须处于不持股状态，利润才真正落袋。
    return max(dp[-1][1], dp[-1][2])
```

冷冻期体现在买入转移里：`dp[day][0]` 只能从昨天的持股状态或休息状态得到，不能从昨天刚卖出的 `dp[day - 1][1]` 买入。昨天卖出后，今天必须先进入休息状态；最早只能在明天再次买入。

### 10.3 最多两次交易：把五个阶段写成状态

[123. 买卖股票的最佳时机 III](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock-iii/) 最多完成两次交易。一笔交易由一次买入和一次卖出组成，可以把每天结束后的进度分成五个状态：

```text
dp[day][0]：还没有进行任何操作
dp[day][1]：完成第一次买入，当前持股
dp[day][2]：完成第一次卖出，当前不持股
dp[day][3]：完成第二次买入，当前持股
dp[day][4]：完成第二次卖出，当前不持股
```

```python
def max_profit_two_transactions(prices: list[int]) -> int:
    if not prices:
        return 0

    days = len(prices)
    negative_infinity = float('-inf')
    dp = [[negative_infinity] * 5 for _ in range(days)]

    # 第 0 天只能什么也不做，或者完成第一次买入。
    dp[0][0] = 0
    dp[0][1] = -prices[0]

    for day in range(1, days):
        price = prices[day]

        dp[day][0] = dp[day - 1][0]
        dp[day][1] = max(
            dp[day - 1][1],
            dp[day - 1][0] - price,
        )
        dp[day][2] = max(
            dp[day - 1][2],
            dp[day - 1][1] + price,
        )
        dp[day][3] = max(
            dp[day - 1][3],
            dp[day - 1][2] - price,
        )
        dp[day][4] = max(
            dp[day - 1][4],
            dp[day - 1][3] + price,
        )

    # 题目要求最多两次，可以不交易、完成一次或完成两次。
    return max(dp[-1][0], dp[-1][2], dp[-1][4])
```

每个状态都有两种来源：昨天已经处于这个状态，今天什么也不做；或者今天完成进入该状态所需的买入或卖出。使用 `-inf` 表示第 0 天不可能完成的操作，可以防止非法状态参与后面的最大值比较。

### 10.4 最多 K 次交易：展开成 2K + 1 个动作状态

[188. 买卖股票的最佳时机 IV](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock-iv/) 是上一题的推广。把“第几次交易”和“是否持股”合并成一个状态编号，就可以继续使用二维数组：

```text
dp[day][0]：没有进行任何操作
dp[day][1]：完成第 1 次买入，当前持股
dp[day][2]：完成第 1 次卖出，当前不持股
dp[day][3]：完成第 2 次买入，当前持股
dp[day][4]：完成第 2 次卖出，当前不持股
...
dp[day][2 * k]：完成第 k 次卖出，当前不持股
```

状态 `0` 加上每笔交易的买入和卖出两个状态，一共需要 `2 * k + 1` 个状态。奇数下标表示买入后持股，偶数下标表示卖出后不持股。

```python
def max_profit_k_transactions(k: int, prices: list[int]) -> int:
    if not prices or k == 0:
        return 0

    days = len(prices)
    states = 2 * k + 1
    negative_infinity = float('-inf')
    dp = [
        [negative_infinity] * states
        for _ in range(days)
    ]

    # 第 0 天只能什么也不做，或者完成第 1 次买入。
    dp[0][0] = 0
    dp[0][1] = -prices[0]

    for day in range(1, days):
        price = prices[day]
        dp[day][0] = 0

        for transaction in range(1, k + 1):
            buy_state = 2 * transaction - 1
            sell_state = 2 * transaction

            # 第 transaction 次买入：继续持股，或者从上一次卖出状态买入。
            dp[day][buy_state] = max(
                dp[day - 1][buy_state],
                dp[day - 1][buy_state - 1] - price,
            )

            # 第 transaction 次卖出：继续不持股，或者今天卖出。
            dp[day][sell_state] = max(
                dp[day - 1][sell_state],
                dp[day - 1][sell_state - 1] + price,
            )

    # 最多交易 k 次，因此答案可能停在任意一个偶数状态。
    return max(
        dp[-1][state]
        for state in range(0, states, 2)
    )
```

当 `k = 2` 时，一行正好是 `[无操作, 第一次买入, 第一次卖出, 第二次买入, 第二次卖出]`，也就是上一题的五状态 DP。代码只是把固定的五个状态推广成 `2 * k + 1` 个状态。

这段代码的时间复杂度是 `O(n * k)`，空间复杂度也是 `O(n * k)`。理解完整状态后，可以只保存前一天，把空间压缩到 `O(k)`。

### 10.5 含手续费：在完成交易时扣一次费用

[714. 买卖股票的最佳时机含手续费](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock-with-transaction-fee/) 允许完成任意多次交易，只是在每笔交易中需要支付一次手续费。仍然使用持股和不持股两个状态：

```text
dp[day][0]：第 day 天结束时持股的最大利润
dp[day][1]：第 day 天结束时不持股的最大利润
```

```python
def max_profit_with_fee(prices: list[int], fee: int) -> int:
    if not prices:
        return 0

    days = len(prices)
    dp = [[0, 0] for _ in range(days)]

    dp[0][0] = -prices[0]
    dp[0][1] = 0

    for day in range(1, days):
        price = prices[day]

        # 今天持股：继续持有，或者用昨天的不持股利润买入。
        dp[day][0] = max(
            dp[day - 1][0],
            dp[day - 1][1] - price,
        )

        # 今天不持股：继续不持股，或者今天卖出并支付手续费。
        dp[day][1] = max(
            dp[day - 1][1],
            dp[day - 1][0] + price - fee,
        )

    return dp[-1][1]
```

手续费放在买入或卖出时扣都可以，但一笔交易只能扣一次。这里统一在卖出时减去 `fee`，状态含义最直观。

这几道题的变化可以归纳为：交易次数有限时增加买卖动作状态；存在冷冻期时限制买入来源；存在手续费时修改卖出收益。完整二维表理解清楚以后，再根据“当前状态只依赖前一天”做空间压缩。

## 11. 子序列 DP：先看状态是一维、双前缀还是区间

子序列问题最容易混，因为题目都在处理数组或字符串，但状态形状不同：

| 状态形状 | 典型含义 | 代表题 |
|---|---|---|
| `dp[i]` | 必须以位置 `i` 结尾 | 最长递增子序列、最大子数组和 |
| `dp[i][j]` | 两个序列前 `i`、前 `j` 个元素的答案 | 最长公共子序列、编辑距离 |
| `dp[i][j]` | 闭区间 `[i, j]` 的答案 | 回文子串、最长回文子序列 |

### 11.1 最长递增子序列：答案是 max(dp)

[300. 最长递增子序列](https://leetcode.cn/problems/longest-increasing-subsequence/) 定义：

```text
dp[i] 表示必须以 nums[i] 结尾的最长严格递增子序列长度。
```

```python
def length_of_lis(nums: list[int]) -> int:
    if not nums:
        return 0

    dp = [1] * len(nums)

    for i in range(len(nums)):
        for j in range(i):
            if nums[j] < nums[i]:
                dp[i] = max(dp[i], dp[j] + 1)

    return max(dp)
```

因为最长序列不一定以最后一个元素结尾，所以答案是 `max(dp)`，不是 `dp[-1]`。

[674. 最长连续递增序列](https://leetcode.cn/problems/longest-continuous-increasing-subsequence/) 要求连续，`dp[i]` 只需要看 `dp[i - 1]`；`300` 不要求连续，所以要枚举所有 `j < i`。看到“连续”与否，要马上改变依赖范围。

### 11.2 最长公共子序列：相等看左上，不等看上方和左方

[1143. 最长公共子序列](https://leetcode.cn/problems/longest-common-subsequence/) 定义：

```text
dp[i][j] 表示 text1 前 i 个字符与 text2 前 j 个字符的 LCS 长度。
```

```python
def longest_common_subsequence(text1: str, text2: str) -> int:
    rows = len(text1) + 1
    cols = len(text2) + 1
    dp = [[0] * cols for _ in range(rows)]

    for i in range(1, rows):
        for j in range(1, cols):
            if text1[i - 1] == text2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    return dp[-1][-1]
```

下面用 `text1 = "abcde"`、`text2 = "ace"` 逐格填写 DP 表。先观察第 0 行和第 0 列为什么都是 0，再重点比较字符相等与不相等时的来源。

<div class="algo-demo lcs-dp-demo" id="lcs-dp-demo">
  <div class="algo-demo-title">
    <strong>LCS：逐格填写二维 DP 表</strong>
    <span class="algo-pill">text1 = "abcde" · text2 = "ace"</span>
  </div>
  <div class="lcs-status" aria-live="polite">
    <span>当前动作：<strong data-role="action"></strong></span>
    <span>比较位置：<strong data-role="position"></strong></span>
    <span>当前结果：<strong data-role="result"></strong></span>
  </div>
  <div class="lcs-board">
    <div class="lcs-axis-title"><span>行：text1 前缀</span><span>列：text2 前缀</span></div>
    <div class="lcs-grid" data-role="grid" role="grid" aria-label="最长公共子序列动态规划表"></div>
  </div>
  <div class="lcs-legend" aria-label="颜色说明">
    <span><i class="lcs-swatch current"></i>当前格</span>
    <span><i class="lcs-swatch source"></i>依赖来源</span>
    <span><i class="lcs-swatch chosen"></i>采用的来源</span>
  </div>
  <div class="lcs-detail" data-role="detail" aria-live="polite"></div>
  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button>
    <button type="button" data-action="next">下一步</button>
    <button type="button" data-action="play">播放</button>
    <button type="button" data-action="reset">重置</button>
    <span class="algo-step" data-role="step"></span>
  </div>
</div>

<script>
  (() => {
    const root = document.getElementById('lcs-dp-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const text1 = 'abcde'
    const text2 = 'ace'
    const rows = text1.length + 1
    const cols = text2.length + 1
    const dp = Array.from({ length: rows }, () => Array(cols).fill(0))
    const states = [{
      row: null,
      col: null,
      equal: null,
      sources: [],
      chosen: []
    }]

    for (let row = 1; row < rows; row += 1) {
      for (let col = 1; col < cols; col += 1) {
        const equal = text1[row - 1] === text2[col - 1]
        let sources = []
        let chosen = []

        if (equal) {
          dp[row][col] = dp[row - 1][col - 1] + 1
          sources = [[row - 1, col - 1]]
          chosen = sources.slice()
        } else {
          const top = dp[row - 1][col]
          const left = dp[row][col - 1]
          dp[row][col] = Math.max(top, left)
          sources = [[row - 1, col], [row, col - 1]]
          if (top >= left) chosen.push([row - 1, col])
          if (left >= top) chosen.push([row, col - 1])
        }

        states.push({ row, col, equal, sources, chosen })
      }
    }

    let answerRow = text1.length
    let answerCol = text2.length
    const answerCharacters = []

    while (answerRow > 0 && answerCol > 0) {
      if (text1[answerRow - 1] === text2[answerCol - 1]) {
        answerCharacters.push(text1[answerRow - 1])
        answerRow -= 1
        answerCol -= 1
      } else if (dp[answerRow - 1][answerCol] >= dp[answerRow][answerCol - 1]) {
        answerRow -= 1
      } else {
        answerCol -= 1
      }
    }

    const answer = answerCharacters.reverse().join('')
    const gridEl = root.querySelector('[data-role="grid"]')
    const actionEl = root.querySelector('[data-role="action"]')
    const positionEl = root.querySelector('[data-role="position"]')
    const resultEl = root.querySelector('[data-role="result"]')
    const detailEl = root.querySelector('[data-role="detail"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const prevBtn = root.querySelector('[data-action="prev"]')
    const nextBtn = root.querySelector('[data-action="next"]')
    const playBtn = root.querySelector('[data-action="play"]')
    const resetBtn = root.querySelector('[data-action="reset"]')
    let index = 0
    let timer = null

    const sameCell = (cell, row, col) => cell[0] === row && cell[1] === col

    const renderGrid = state => {
      let html = '<div class="lcs-axis-cell lcs-corner" role="columnheader">i \\ j</div>'

      for (let col = 0; col < cols; col += 1) {
        const character = col === 0 ? '∅' : text2[col - 1]
        const active = state.col === col ? ' is-current-axis' : ''
        html += '<div class="lcs-axis-cell lcs-col-axis' + active + '" role="columnheader" aria-label="text2 前 ' + col + ' 个字符">' + character + '</div>'
      }

      for (let row = 0; row < rows; row += 1) {
        const character = row === 0 ? '∅' : text1[row - 1]
        const active = state.row === row ? ' is-current-axis' : ''
        html += '<div class="lcs-axis-cell lcs-row-axis' + active + '" role="rowheader" aria-label="text1 前 ' + row + ' 个字符">' + character + '</div>'

        for (let col = 0; col < cols; col += 1) {
          const classes = ['lcs-cell']
          const fillOrder = row > 0 && col > 0
            ? (row - 1) * (cols - 1) + col
            : 0
          const computed = row === 0 || col === 0 || fillOrder <= index
          const isCurrent = state.row === row && state.col === col
          const isSource = state.sources.some(cell => sameCell(cell, row, col))
          const isChosen = state.chosen.some(cell => sameCell(cell, row, col))

          if (row === 0 || col === 0) classes.push('is-base')
          if (!computed) classes.push('is-pending')
          if (isSource) classes.push('is-source')
          if (isChosen) classes.push('is-chosen')
          if (isCurrent) classes.push('is-current')

          const value = computed ? dp[row][col] : '·'
          const labels = ['dp[' + row + '][' + col + ']']
          labels.push(computed ? '值为 ' + dp[row][col] : '尚未计算')
          if (isCurrent) labels.push('当前格')
          if (isSource) labels.push('依赖来源')
          if (isChosen) labels.push('采用的来源')

          html += '<div class="' + classes.join(' ') + '" role="gridcell" aria-label="' + labels.join('，') + '"><span>' + value + '</span><small>[' + row + ',' + col + ']</small></div>'
        }
      }

      gridEl.innerHTML = html
    }

    const render = () => {
      const state = states[index]
      renderGrid(state)

      if (index === 0) {
        actionEl.textContent = '初始化边界'
        positionEl.textContent = '第 0 行、第 0 列'
        resultEl.textContent = '边界值 = 0'
        detailEl.textContent = '空字符串与任何前缀的最长公共子序列长度都是 0，所以第 0 行和第 0 列先填 0。'
        stepEl.textContent = '初始化 · 0 / ' + (states.length - 1)
      } else {
        const row = state.row
        const col = state.col
        const firstCharacter = text1[row - 1]
        const secondCharacter = text2[col - 1]
        actionEl.textContent = state.equal ? '字符相等：读取左上' : '字符不等：比较上方和左方'
        positionEl.textContent = 'i=' + row + '，j=' + col

        if (state.equal) {
          const diagonal = dp[row - 1][col - 1]
          detailEl.textContent = '“' + firstCharacter + '” = “' + secondCharacter + '”：相同字符可以接在公共子序列末尾，dp[' + row + '][' + col + '] = dp[' + (row - 1) + '][' + (col - 1) + '] + 1 = ' + diagonal + ' + 1 = ' + dp[row][col] + '。'
        } else {
          const top = dp[row - 1][col]
          const left = dp[row][col - 1]
          const tie = top === left ? '；两边相等，任取一边都可以' : ''
          detailEl.textContent = '“' + firstCharacter + '” ≠ “' + secondCharacter + '”：不能同时保留两个末尾字符，dp[' + row + '][' + col + '] = max(' + top + ', ' + left + ') = ' + dp[row][col] + tie + '。'
        }

        resultEl.textContent = index === states.length - 1
          ? '长度 = ' + dp[rows - 1][cols - 1] + '，一个 LCS = “' + answer + '”'
          : 'dp[' + row + '][' + col + '] = ' + dp[row][col]
        stepEl.textContent = '填写 ' + index + ' / ' + (states.length - 1)
      }

      prevBtn.disabled = index === 0
      nextBtn.disabled = index === states.length - 1
    }

    const stop = () => {
      if (timer) window.clearInterval(timer)
      timer = null
      playBtn.textContent = '播放'
    }

    prevBtn.addEventListener('click', () => {
      stop()
      if (index > 0) index -= 1
      render()
    })

    nextBtn.addEventListener('click', () => {
      stop()
      if (index < states.length - 1) index += 1
      render()
    })

    resetBtn.addEventListener('click', () => {
      stop()
      index = 0
      render()
    })

    playBtn.addEventListener('click', () => {
      if (timer) {
        stop()
        return
      }

      if (index === states.length - 1) index = 0
      playBtn.textContent = '暂停'
      render()
      timer = window.setInterval(() => {
        if (index >= states.length - 1) {
          stop()
          return
        }

        index += 1
        render()
        if (index >= states.length - 1) stop()
      }, 1000)
    })

    render()
  })()
</script>

[1035. 不相交的线](https://leetcode.cn/problems/uncrossed-lines/) 与 LCS 完全同构：相同数字连线且不能相交，等价于保持两个数组中的相对顺序。

连续版本 [718. 最长重复子数组](https://leetcode.cn/problems/maximum-length-of-repeated-subarray/) 在元素不等时必须归零，因为公共连续片段不能跳过中间元素；LCS 不要求连续，所以不等时可以丢掉其中一个末尾字符继续比较。

### 11.3 编辑距离：增、删、改对应三个来源

[72. 编辑距离](https://leetcode.cn/problems/edit-distance/) 定义：

```text
dp[i][j] 表示 word1 前 i 个字符变成 word2 前 j 个字符的最少操作数。
```

```python
def min_distance(word1: str, word2: str) -> int:
    rows = len(word1) + 1
    cols = len(word2) + 1
    dp = [[0] * cols for _ in range(rows)]

    for i in range(rows):
        dp[i][0] = i

    for j in range(cols):
        dp[0][j] = j

    for i in range(1, rows):
        for j in range(1, cols):
            if word1[i - 1] == word2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],      # 删除 word1 的末尾字符
                    dp[i][j - 1],      # 插入 word2 的末尾字符
                    dp[i - 1][j - 1],  # 替换末尾字符
                )

    return dp[-1][-1]
```

下面用 `word1 = "horse"`、`word2 = "ros"` 逐格计算。表格中的上方、左方和左上方，分别对应删除、插入和替换；字符相等时则直接继承左上方，不增加操作次数。

<div class="algo-demo lcs-dp-demo edit-distance-demo" id="edit-distance-dp-demo">
  <div class="algo-demo-title">
    <strong>编辑距离：逐格选择最少操作</strong>
    <span class="algo-pill">word1 = "horse" · word2 = "ros"</span>
  </div>
  <div class="lcs-status" aria-live="polite">
    <span>当前动作：<strong data-role="action"></strong></span>
    <span>比较位置：<strong data-role="position"></strong></span>
    <span>当前结果：<strong data-role="result"></strong></span>
  </div>
  <div class="lcs-board">
    <div class="lcs-axis-title"><span>行：word1 前缀</span><span>列：word2 前缀</span></div>
    <div class="lcs-grid" data-role="grid" role="grid" aria-label="编辑距离动态规划表"></div>
  </div>
  <div class="lcs-legend" aria-label="来源方向说明">
    <span><i class="lcs-swatch current"></i>当前格</span>
    <span><i class="lcs-swatch delete"></i>上方：删除</span>
    <span><i class="lcs-swatch insert"></i>左方：插入</span>
    <span><i class="lcs-swatch diagonal"></i>左上：匹配/替换</span>
    <span><i class="lcs-swatch chosen"></i>采用来源</span>
  </div>
  <div class="lcs-detail" data-role="detail" aria-live="polite"></div>
  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button>
    <button type="button" data-action="next">下一步</button>
    <button type="button" data-action="play">播放</button>
    <button type="button" data-action="reset">重置</button>
    <span class="algo-step" data-role="step"></span>
  </div>
</div>

<script>
  (() => {
    const root = document.getElementById('edit-distance-dp-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const word1 = 'horse'
    const word2 = 'ros'
    const rows = word1.length + 1
    const cols = word2.length + 1
    const dp = Array.from({ length: rows }, () => Array(cols).fill(0))
    const states = [{ row: null, col: null, equal: null, sources: [] }]

    for (let row = 0; row < rows; row += 1) dp[row][0] = row
    for (let col = 0; col < cols; col += 1) dp[0][col] = col

    for (let row = 1; row < rows; row += 1) {
      for (let col = 1; col < cols; col += 1) {
        const equal = word1[row - 1] === word2[col - 1]
        let sources = []

        if (equal) {
          dp[row][col] = dp[row - 1][col - 1]
          sources = [{
            row: row - 1,
            col: col - 1,
            kind: 'diagonal',
            cost: dp[row][col],
            chosen: true
          }]
        } else {
          sources = [
            {
              row: row - 1,
              col,
              kind: 'delete',
              cost: dp[row - 1][col] + 1
            },
            {
              row,
              col: col - 1,
              kind: 'insert',
              cost: dp[row][col - 1] + 1
            },
            {
              row: row - 1,
              col: col - 1,
              kind: 'diagonal',
              cost: dp[row - 1][col - 1] + 1
            }
          ]
          dp[row][col] = Math.min(...sources.map(source => source.cost))
          sources.forEach(source => {
            source.chosen = source.cost === dp[row][col]
          })
        }

        states.push({ row, col, equal, sources })
      }
    }

    const operationNames = {
      delete: '删除',
      insert: '插入',
      diagonal: '替换'
    }
    const gridEl = root.querySelector('[data-role="grid"]')
    const actionEl = root.querySelector('[data-role="action"]')
    const positionEl = root.querySelector('[data-role="position"]')
    const resultEl = root.querySelector('[data-role="result"]')
    const detailEl = root.querySelector('[data-role="detail"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const prevBtn = root.querySelector('[data-action="prev"]')
    const nextBtn = root.querySelector('[data-action="next"]')
    const playBtn = root.querySelector('[data-action="play"]')
    const resetBtn = root.querySelector('[data-action="reset"]')
    let index = 0
    let timer = null

    const renderGrid = state => {
      let html = '<div class="lcs-axis-cell lcs-corner" role="columnheader">i \\ j</div>'

      for (let col = 0; col < cols; col += 1) {
        const character = col === 0 ? '∅' : word2[col - 1]
        const active = state.col === col ? ' is-current-axis' : ''
        html += '<div class="lcs-axis-cell lcs-col-axis' + active + '" role="columnheader" aria-label="word2 前 ' + col + ' 个字符">' + character + '</div>'
      }

      for (let row = 0; row < rows; row += 1) {
        const character = row === 0 ? '∅' : word1[row - 1]
        const active = state.row === row ? ' is-current-axis' : ''
        html += '<div class="lcs-axis-cell lcs-row-axis' + active + '" role="rowheader" aria-label="word1 前 ' + row + ' 个字符">' + character + '</div>'

        for (let col = 0; col < cols; col += 1) {
          const classes = ['lcs-cell']
          const fillOrder = row > 0 && col > 0
            ? (row - 1) * (cols - 1) + col
            : 0
          const computed = row === 0 || col === 0 || fillOrder <= index
          const current = state.row === row && state.col === col
          const source = state.sources.find(item => item.row === row && item.col === col)

          if (row === 0 || col === 0) classes.push('is-base')
          if (!computed) classes.push('is-pending')
          if (source) classes.push('is-source', 'source-' + source.kind)
          if (source && source.chosen) classes.push('is-chosen')
          if (current) classes.push('is-current')

          const value = computed ? dp[row][col] : '·'
          const labels = ['dp[' + row + '][' + col + ']']
          labels.push(computed ? '值为 ' + dp[row][col] : '尚未计算')
          if (current) labels.push('当前格')
          if (source) {
            const sourceName = source.kind === 'diagonal' && state.equal
              ? '匹配'
              : operationNames[source.kind]
            labels.push(sourceName + '来源，候选值 ' + source.cost)
          }
          if (source && source.chosen) labels.push('采用的来源')

          html += '<div class="' + classes.join(' ') + '" role="gridcell" aria-label="' + labels.join('，') + '"><span>' + value + '</span><small>[' + row + ',' + col + ']</small></div>'
        }
      }

      gridEl.innerHTML = html
    }

    const render = () => {
      const state = states[index]
      renderGrid(state)

      if (index === 0) {
        actionEl.textContent = '初始化边界'
        positionEl.textContent = '第 0 行、第 0 列'
        resultEl.textContent = '边界记录操作次数'
        detailEl.textContent = '把 word1 前 i 个字符变成空串需要删除 i 次，所以 dp[i][0] = i；把空串变成 word2 前 j 个字符需要插入 j 次，所以 dp[0][j] = j。'
        stepEl.textContent = '初始化 · 0 / ' + (states.length - 1)
      } else {
        const row = state.row
        const col = state.col
        const firstCharacter = word1[row - 1]
        const secondCharacter = word2[col - 1]
        positionEl.textContent = 'i=' + row + '，j=' + col

        if (state.equal) {
          actionEl.textContent = '字符相等：无需操作'
          detailEl.textContent = '“' + firstCharacter + '” = “' + secondCharacter + '”：两个末尾字符已经匹配，直接继承左上方，dp[' + row + '][' + col + '] = dp[' + (row - 1) + '][' + (col - 1) + '] = ' + dp[row][col] + '。'
        } else {
          actionEl.textContent = '字符不等：比较增、删、改'
          const deletion = state.sources.find(source => source.kind === 'delete')
          const insertion = state.sources.find(source => source.kind === 'insert')
          const replacement = state.sources.find(source => source.kind === 'diagonal')
          const selected = state.sources
            .filter(source => source.chosen)
            .map(source => operationNames[source.kind])
            .join('或')
          detailEl.textContent = '“' + firstCharacter + '” ≠ “' + secondCharacter + '”：删除=' + deletion.cost + '，插入=' + insertion.cost + '，替换=' + replacement.cost + '；取最小值得 dp[' + row + '][' + col + '] = ' + dp[row][col] + '，本格选择' + selected + '。'
        }

        resultEl.textContent = index === states.length - 1
          ? '编辑距离 = ' + dp[rows - 1][cols - 1]
          : 'dp[' + row + '][' + col + '] = ' + dp[row][col]
        stepEl.textContent = '填写 ' + index + ' / ' + (states.length - 1)
      }

      prevBtn.disabled = index === 0
      nextBtn.disabled = index === states.length - 1
    }

    const stop = () => {
      if (timer) window.clearInterval(timer)
      timer = null
      playBtn.textContent = '播放'
    }

    prevBtn.addEventListener('click', () => {
      stop()
      if (index > 0) index -= 1
      render()
    })

    nextBtn.addEventListener('click', () => {
      stop()
      if (index < states.length - 1) index += 1
      render()
    })

    resetBtn.addEventListener('click', () => {
      stop()
      index = 0
      render()
    })

    playBtn.addEventListener('click', () => {
      if (timer) {
        stop()
        return
      }

      if (index === states.length - 1) index = 0
      playBtn.textContent = '暂停'
      render()
      timer = window.setInterval(() => {
        if (index >= states.length - 1) {
          stop()
          return
        }

        index += 1
        render()
        if (index >= states.length - 1) stop()
      }, 1100)
    })

    render()
  })()
</script>

两个前缀 DP 可以用来源快速区分：

| 问题 | 元素不相等时怎么做 |
|---|---|
| LCS | `max(上方, 左方)` |
| 最长公共连续子数组 | 归零 |
| 编辑距离 | `1 + min(上方, 左方, 左上)` |
| 不同子序列计数 | 只能丢弃源串末尾，读取上方 |

### 11.4 回文区间：i 倒序，j 正序

[647. 回文子串](https://leetcode.cn/problems/palindromic-substrings/) 定义 `dp[i][j]` 表示闭区间 `s[i:j+1]` 是否为回文串：

```python
def count_substrings(s: str) -> int:
    n = len(s)
    dp = [[False] * n for _ in range(n)]
    count = 0

    for i in range(n - 1, -1, -1):
        for j in range(i, n):
            if s[i] == s[j] and (
                j - i <= 1 or dp[i + 1][j - 1]
            ):
                dp[i][j] = True
                count += 1

    return count
```

当前区间依赖更靠里的 `dp[i + 1][j - 1]`，所以 `i` 必须倒序，`j` 从 `i` 向右遍历。

[516. 最长回文子序列](https://leetcode.cn/problems/longest-palindromic-subsequence/) 同样使用区间状态，但聚合方式不同。单字符区间先初始化为 1，再从短区间推向长区间：

```python
def longest_palindrome_subseq(s: str) -> int:
    n = len(s)

    if n == 0:
        return 0

    dp = [[0] * n for _ in range(n)]

    for i in range(n):
        dp[i][i] = 1

    for i in range(n - 1, -1, -1):
        for j in range(i + 1, n):
            if s[i] == s[j]:
                dp[i][j] = dp[i + 1][j - 1] + 2
            else:
                dp[i][j] = max(dp[i + 1][j], dp[i][j - 1])

    return dp[0][n - 1]
```

这里 `i` 倒序、`j` 从 `i + 1` 正序，保证 `dp[i + 1][j - 1]`、`dp[i + 1][j]` 和 `dp[i][j - 1]` 都已经计算。

回文子串要求连续，保存真假；回文子序列可以跳过字符，保存最大长度。

## 12. 遍历顺序与常见错误

### 12.1 背包循环方向速查

| 问题 | 外层 | 内层 | 为什么 |
|---|---|---|---|
| 0-1 背包最大值/可行性/计数 | 物品 | 容量倒序 | 每件物品最多使用一次 |
| 完全背包最大值/最小值 | 物品 | 容量正序 | 当前物品可以重复使用 |
| 完全背包组合数 | 物品 | 容量正序 | 不区分物品排列顺序 |
| 完全背包排列数 | 容量正序 | 物品 | 不同选择顺序分别统计 |

### 12.2 状态定义决定答案位置

```text
dp[i] = 处理前 i 个元素的最优答案  → 通常返回最后一格
dp[i] = 必须以 i 结尾的最优答案   → 通常返回 max(dp)
dp[i][j] = 两个完整前缀的答案      → 通常返回 dp[m][n]
```

不要看到一维数组就默认返回 `dp[-1]`。

### 12.3 滚动数组会隐藏依赖方向

二维压缩成一维后，代码更短，但“上一行”和“当前行”不再显式出现。第一次整理一道题时，先写清二维状态来源，再判断：

- 当前格只依赖上一行吗？
- 需要保留哪些方向的旧值？
- 正序会不会读到本轮刚更新的状态？

这些问题决定能否压缩以及应该怎样遍历。

### 12.4 一份实用的 DP 检查清单

1. 能否用一句话完整解释 `dp` 每个下标的含义？
2. 当前状态的所有合法来源是否都列出来了？
3. 初始化能否由状态定义直接解释？
4. 不可达状态应该是 `False`、`inf` 还是 `-inf`？
5. 当前循环顺序下，读取的状态已经计算了吗？
6. 答案是最后一格还是整张表的最大值？
7. 空数组、单元素、容量 0、目标 0、全负数是否正确？
8. Python 二维数组是否误用了 `[[...]] * rows`？
9. 多状态转移是否错误读取了当天刚更新的值？
10. 用最小样例打印 DP 表时，每一格是否符合手算结果？

## 13. 复习总览

- 动态规划把重复子问题的答案保存下来，按照依赖顺序从小状态推出大状态。
- 五步法是：定义状态、写递推、做初始化、定遍历顺序、确定答案位置。
- 状态定义必须是一句完整的话；公式、初始化和遍历方向都要服从这个定义。
- 一维基础题常依赖前一两个位置；网格题常来自上方和左方。
- 0-1 背包每件物品最多一次，一维容量倒序；完全背包可以重复使用，容量正序。
- 计数组合时物品在外层；计数排列时容量在外层。
- `dp[0] = 1` 在计数题中表示空方案，`dp[0] = True` 在可行性题中表示空集合可组成 0。
- 多重背包限制每件数量，分组背包限制每组最多选一个，不能让组内选项互相转移。
- 打家劫舍是在“偷与不偷”之间转移；树形版本让每个节点同时返回两个状态。
- 股票题统一维护持有和不持有状态，限制次数、冷冻期、手续费只是修改状态或来源。
- LIS 使用“以 `i` 结尾”的一维状态；LCS 和编辑距离使用两个前缀；回文题常使用区间状态。
- 递推式决定遍历顺序。滚动数组只是空间优化，不应该掩盖原本的依赖关系。

动态规划最难的不是把模板背下来，而是把状态说清楚。复习时先问“这一格代表什么、它从哪里来”，再写循环；只要状态语义稳定，初始化、遍历顺序和答案位置就会自然连起来。

<div class="algorithm-module-nav algorithm-module-nav-bottom">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/greedy/">上一篇：贪心算法总结</a>
  <a href="/algorithm/monotonic-stack/">下一篇：单调栈</a>
</div>
