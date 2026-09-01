---
title: 代码随想录刷题笔记：图论
date:
top_img: /img/algorithm-header-code.webp
description: 图论刷题笔记，整理图的表示、DFS、BFS、网格搜索、并查集、拓扑排序、最短路、最小生成树，以及二维接雨水的最小堆解法。
categories:
  - Notes
  - Algorithm
tags:
  - LeetCode
  - CodeThinking
  - Python
  - Graph
  - BFS
  - DFS
toc: true
toc_number: false
katex: true
---

<div class="algorithm-module-nav algorithm-module-nav-top">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/monotonic-stack/">上一篇：单调栈</a>
  <span class="algorithm-module-nav-disabled">下一篇：专题扩展（整理中）</span>
</div>

## 1. 什么时候想到图论

图论题不一定真的出现“图”这个词。只要问题中存在一批对象，以及对象之间的连接、移动、依赖或转换关系，就可以考虑把它建模成图：

~~~text
对象                 → 节点
对象之间的关系       → 边
从一个对象移动到另一个 → 沿边访问
~~~

常见题目信号：

| 题目描述 | 常用方法 |
|---|---|
| 能否从起点到终点、所有连通块 | DFS、BFS、并查集 |
| 二维地图扩散、岛屿、迷宫 | 网格 DFS / BFS |
| 最少步数、边权都相同 | BFS |
| 动态合并集合、判断是否成环 | 并查集 |
| 课程依赖、任务先后关系 | 拓扑排序 |
| 非负权最短路 | Dijkstra + 小根堆 |
| 可能有负权边 | Bellman-Ford |
| 所有节点两两最短路 | Floyd-Warshall |
| 用最小代价连接所有节点 | 最小生成树 |
| 总从当前最低边界向外扩展 | 小根堆 + BFS |

选择算法之前先回答四个问题：

1. 图是有向还是无向？
2. 边是否带权？权重能否为负？
3. 求的是可达性、连通性、最短路，还是连接所有节点的最小代价？
4. 图是显式边集合，还是二维网格隐式形成的图？

## 2. 图的表示：先决定节点怎样找到邻居

### 2.1 邻接表

邻接表为每个节点保存可以直接到达的邻居，适合边比较少的稀疏图。

~~~python
def build_undirected_graph(
    node_count: int,
    edges: list[list[int]],
) -> list[list[int]]:
    graph = [[] for _ in range(node_count)]

    for first, second in edges:
        graph[first].append(second)
        graph[second].append(first)

    return graph
~~~

有向图只加入一个方向：

~~~python
def build_directed_graph(
    node_count: int,
    edges: list[list[int]],
) -> list[list[int]]:
    graph = [[] for _ in range(node_count)]

    for source, target in edges:
        graph[source].append(target)

    return graph
~~~

邻接表的空间复杂度：

~~~text
无向图：O(V + 2E)，通常写作 O(V + E)
有向图：O(V + E)
~~~

### 2.2 邻接矩阵与边列表

邻接矩阵使用 <code>matrix[u][v]</code> 表示节点 <code>u</code> 到 <code>v</code> 是否有边或边权是多少。

| 表示方式 | 空间 | 适用场景 |
|---|---:|---|
| 邻接表 | $O(V + E)$ | 稀疏图、遍历邻居 |
| 邻接矩阵 | $O(V^2)$ | 稠密图、频繁查询两点是否相连 |
| 边列表 | $O(E)$ | Kruskal、Bellman-Ford 等按边扫描的算法 |

不要看到图就固定使用邻接表。Floyd-Warshall 天然使用矩阵；Kruskal 和 Bellman-Ford 则更适合直接保存边。

## 3. DFS 与 BFS：图遍历的两套基础模板

### 3.1 DFS：沿一条路走到底再回退

递归 DFS：

~~~python
def dfs_order(graph: list[list[int]], start: int) -> list[int]:
    visited = [False] * len(graph)
    order = []

    def dfs(node: int) -> None:
        visited[node] = True
        order.append(node)

        for neighbor in graph[node]:
            if not visited[neighbor]:
                dfs(neighbor)

    dfs(start)
    return order
~~~

DFS 的核心不是递归语法，而是：

~~~text
进入节点时标记 visited
枚举所有邻居
只访问尚未访问的邻居
~~~

图中可能存在环。如果不记录 <code>visited</code>，DFS 会在环中无限重复。

图很深时可以改用显式栈：

~~~python
def iterative_dfs_order(
    graph: list[list[int]],
    start: int,
) -> list[int]:
    visited = [False] * len(graph)
    stack = [start]
    order = []

    while stack:
        node = stack.pop()

        if visited[node]:
            continue

        visited[node] = True
        order.append(node)

        # 倒序入栈，让遍历顺序与递归版本更接近。
        for neighbor in reversed(graph[node]):
            if not visited[neighbor]:
                stack.append(neighbor)

    return order
~~~

### 3.2 BFS：按距离一层一层扩散

~~~python
from collections import deque


def bfs_distance(
    graph: list[list[int]],
    start: int,
) -> list[int]:
    distance = [-1] * len(graph)
    distance[start] = 0
    queue = deque([start])

    while queue:
        node = queue.popleft()

        for neighbor in graph[node]:
            if distance[neighbor] != -1:
                continue

            distance[neighbor] = distance[node] + 1
            queue.append(neighbor)

    return distance
~~~

无权图中，BFS 第一次到达某个节点时走过的边数最少，因此可以直接得到最短距离。

最重要的细节是：**入队时就标记访问**。如果等到出队才标记，同一节点可能被多个前驱重复加入队列。

### 3.3 DFS 和 BFS 怎样选择

| 目标 | 更自然的方法 |
|---|---|
| 判断是否可达 | DFS 或 BFS |
| 枚举一个连通块 | DFS 或 BFS |
| 无权图最短距离 | BFS |
| 所有路径、路径回溯 | DFS |
| 按层扩散、同时传播 | BFS |
| 递归深度可能非常大 | 迭代 DFS 或 BFS |

两者遍历整个邻接表的时间复杂度都是 $O(V + E)$，区别主要是访问顺序。

## 4. 二维网格：把每个格子当作节点

二维网格通常不需要显式建立邻接表。每个格子就是节点，上下左右相邻就是边：

~~~python
DIRECTIONS = (
    (-1, 0),
    (1, 0),
    (0, -1),
    (0, 1),
)
~~~

判断邻居是否合法：

~~~text
0 <= next_row < rows
0 <= next_col < cols
~~~

### 4.1 [200. 岛屿数量](https://leetcode.cn/problems/number-of-islands/)：每发现一个新陆地就淹没一个连通块

先看最直观的递归 DFS。外层循环负责寻找一块尚未访问的新陆地；找到以后，岛屿数量加一，再从这个格子出发，把上下左右连通的整座岛屿全部“淹没”。

#### 递归 DFS 写法

~~~python
def num_islands_recursive(grid: list[list[str]]) -> int:
    if not grid or not grid[0]:
        return 0

    rows = len(grid)
    cols = len(grid[0])

    def flood(row: int, col: int) -> None:
        # 越过网格边界，停止当前方向的搜索。
        if not (
            0 <= row < rows
            and 0 <= col < cols
        ):
            return

        # 水域或已经访问过的陆地，不再处理。
        if grid[row][col] != '1':
            return

        # 必须先标记，再递归邻居，防止相邻陆地互相调用。
        grid[row][col] = '0'

        flood(row - 1, col)
        flood(row + 1, col)
        flood(row, col - 1)
        flood(row, col + 1)

    islands = 0

    for row in range(rows):
        for col in range(cols):
            if grid[row][col] != '1':
                continue

            # 找到尚未访问的新陆地，说明发现了一座新岛屿。
            islands += 1
            flood(row, col)

    return islands
~~~

递归函数中的两个停止条件分别负责“不能走”和“不需要再走”：

~~~text
坐标越界                 → 不能走
当前格子不是未访问的陆地 → 不需要再走
~~~

最关键的一行是先执行 <code>grid[row][col] = '0'</code>，再递归访问四个邻居。如果等递归返回以后才标记，两个相邻陆地会不断互相调用。

#### 显式栈 DFS 写法

递归 DFS 使用 Python 的函数调用栈。整张地图接近一条很长的陆地路径时，递归层数可能过深，因此也可以把待访问坐标保存在自己维护的栈中：

~~~python
def num_islands(grid: list[list[str]]) -> int:
    if not grid or not grid[0]:
        return 0

    rows = len(grid)
    cols = len(grid[0])
    directions = ((-1, 0), (1, 0), (0, -1), (0, 1))
    islands = 0

    def flood(start_row: int, start_col: int) -> None:
        stack = [(start_row, start_col)]
        grid[start_row][start_col] = '0'

        while stack:
            row, col = stack.pop()

            for row_step, col_step in directions:
                next_row = row + row_step
                next_col = col + col_step

                if (
                    0 <= next_row < rows
                    and 0 <= next_col < cols
                    and grid[next_row][next_col] == '1'
                ):
                    grid[next_row][next_col] = '0'
                    stack.append((next_row, next_col))

    for row in range(rows):
        for col in range(cols):
            if grid[row][col] != '1':
                continue

            islands += 1
            flood(row, col)

    return islands
~~~

外层循环负责发现新的连通块；DFS 负责把当前连通块全部标记。每个格子最多处理一次，时间复杂度是 $O(mn)$。

这段代码直接把访问过的陆地改成 <code>'0'</code>。如果题目不允许修改输入，就单独维护 <code>visited</code>。

| 写法 | 保存待处理节点的位置 | 特点 |
|---|---|---|
| 递归 DFS | Python 函数调用栈 | 写法直观，但路径太深可能超过递归深度限制 |
| 显式栈 DFS | 自己维护的 <code>list</code> | 代码稍长，但不受递归层数限制 |

两种写法都让每个格子最多被处理一次，时间复杂度都是 $O(mn)$；最坏情况下保存的搜索路径或待处理节点数量都是 $O(mn)$。

### 4.2 [695. 岛屿的最大面积](https://leetcode.cn/problems/max-area-of-island/)：DFS 返回当前连通块大小

~~~python
def max_area_of_island(grid: list[list[int]]) -> int:
    if not grid or not grid[0]:
        return 0

    rows = len(grid)
    cols = len(grid[0])
    directions = ((-1, 0), (1, 0), (0, -1), (0, 1))

    def area(start_row: int, start_col: int) -> int:
        stack = [(start_row, start_col)]
        grid[start_row][start_col] = 0
        size = 0

        while stack:
            row, col = stack.pop()
            size += 1

            for row_step, col_step in directions:
                next_row = row + row_step
                next_col = col + col_step

                if (
                    0 <= next_row < rows
                    and 0 <= next_col < cols
                    and grid[next_row][next_col] == 1
                ):
                    grid[next_row][next_col] = 0
                    stack.append((next_row, next_col))

        return size

    best = 0

    for row in range(rows):
        for col in range(cols):
            if grid[row][col] == 1:
                best = max(best, area(row, col))

    return best
~~~

岛屿题常见变体只是在“从哪里开始搜索”和“搜索结果怎样统计”上变化：

| 题目 | 起点与处理方式 |
|---|---|
| [200. 岛屿数量](https://leetcode.cn/problems/number-of-islands/) | 遇到新陆地，连通块数量加一 |
| [695. 最大岛屿面积](https://leetcode.cn/problems/max-area-of-island/) | 统计每个连通块的格子数 |
| [1020. 飞地数量](https://leetcode.cn/problems/number-of-enclaves/) | 先从边界陆地搜索，剩余陆地才是飞地 |
| [130. 被围绕的区域](https://leetcode.cn/problems/surrounded-regions/) | 先保护与边界相连的区域，再处理剩余区域 |
| [827. 最大人工岛](https://leetcode.cn/problems/making-a-large-island/) | 先给岛屿编号和面积，再尝试翻转每个水格 |

### 4.3 [417. 太平洋大西洋水流问题](https://leetcode.cn/problems/pacific-atlantic-water-flow/)：从海洋反向搜索

从每个格子向外模拟水流会重复搜索。更好的思路是从两个海洋边界反向搜索：

~~~text
正向：高处可以流向不更高的邻居
反向：海洋可以走向不更低的邻居
~~~

下面用题目示例逐步执行两次反向 BFS。蓝色表示从太平洋边界能够反向到达，绿色表示从大西洋边界能够反向到达；同一个格子同时拥有两种颜色时，就是最终答案。

<div class="algo-demo pacific-atlantic-demo" id="pacific-atlantic-demo">
  <div class="algo-demo-title">
    <strong>从海洋边界反向爬坡，再取两个可达集合的交集</strong>
    <code>heights = 5 × 5</code>
  </div>
  <div class="pa-status" aria-live="polite">
    <span>阶段 <strong data-role="phase"></strong></span>
    <span>动作 <strong data-role="action"></strong></span>
    <span>当前格 <strong data-role="current"></strong></span>
    <span>队列 <strong data-role="queue-size"></strong></span>
  </div>
  <div class="pa-map" aria-label="太平洋大西洋水流高度地图">
    <div class="pa-ocean pa-ocean-top pacific">太平洋</div>
    <div class="pa-map-middle">
      <div class="pa-ocean pa-ocean-side pacific">太平洋</div>
      <div class="pa-grid" data-role="grid" role="grid" aria-label="5 乘 5 高度网格"></div>
      <div class="pa-ocean pa-ocean-side atlantic">大西洋</div>
    </div>
    <div class="pa-ocean pa-ocean-bottom atlantic">大西洋</div>
  </div>
  <div class="pa-legend" aria-label="颜色图例">
    <span><i class="pa-swatch pacific"></i>太平洋可达</span>
    <span><i class="pa-swatch atlantic"></i>大西洋可达</span>
    <span><i class="pa-swatch both"></i>两个海洋都可达</span>
    <span><i class="pa-swatch current"></i>当前出队格</span>
    <span><i class="pa-swatch blocked"></i>高度不足，不能反向走</span>
  </div>
  <div class="pa-rule-flow" aria-label="反向搜索的关键代码">
    <code data-line="start">visited = set(ocean_edges)</code>
    <code data-line="pop">row, col = queue.popleft()</code>
    <code data-line="compare">heights[next] &gt;= heights[row][col]</code>
    <code data-line="push">visited.add(next); queue.append(next)</code>
    <code data-line="intersect">answer = pacific &amp; atlantic</code>
  </div>
  <div class="pa-queue-row">
    <span>queue（队首 → 队尾）</span>
    <div class="pa-queue" data-role="queue" aria-live="polite"></div>
  </div>
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
    const root = document.getElementById('pacific-atlantic-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const heights = [
      [1, 2, 2, 3, 5],
      [3, 2, 3, 4, 4],
      [2, 4, 5, 3, 1],
      [6, 7, 1, 4, 5],
      [5, 1, 1, 2, 4]
    ]
    const rows = heights.length
    const cols = heights[0].length
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    const steps = []
    const keyOf = (row, col) => `${row},${col}`
    const cellText = ([row, col]) => `[${row},${col}]`

    const saveStep = ({
      phase,
      action,
      current = null,
      queue = [],
      pacific,
      atlantic,
      added = [],
      blocked = [],
      line,
      note
    }) => {
      steps.push({
        phase,
        action,
        current,
        queue: queue.map(cell => cell.slice()),
        pacific: Array.from(pacific),
        atlantic: Array.from(atlantic),
        added: added.map(cell => cell.slice()),
        blocked: blocked.map(cell => cell.slice()),
        line,
        note
      })
    }

    const pacific = new Set()
    const atlantic = new Set()

    const runOcean = (phase, starts, visited, otherVisited) => {
      const queue = []
      const uniqueStarts = []

      starts.forEach(([row, col]) => {
        const key = keyOf(row, col)
        if (visited.has(key)) return
        visited.add(key)
        queue.push([row, col])
        uniqueStarts.push([row, col])
      })

      saveStep({
        phase,
        action: '边界入队',
        queue,
        pacific,
        atlantic,
        added: uniqueStarts,
        line: 'start',
        note: `${phase}的边界格天然能够流入${phase}，先把这些格子全部加入 visited 和 queue。`
      })

      while (queue.length > 0) {
        const current = queue.shift()
        const [row, col] = current
        const added = []
        const blocked = []

        directions.forEach(([rowStep, colStep]) => {
          const nextRow = row + rowStep
          const nextCol = col + colStep

          if (
            nextRow < 0 || nextRow >= rows
            || nextCol < 0 || nextCol >= cols
          ) return

          const nextKey = keyOf(nextRow, nextCol)
          if (visited.has(nextKey)) return

          if (heights[nextRow][nextCol] >= heights[row][col]) {
            visited.add(nextKey)
            queue.push([nextRow, nextCol])
            added.push([nextRow, nextCol])
          } else {
            blocked.push([nextRow, nextCol])
          }
        })

        const addedText = added.length
          ? `新增 ${added.map(cellText).join('、')}`
          : '没有新增格子'
        const blockedText = blocked.length
          ? `；${blocked.map(cellText).join('、')} 更低，不能反向走`
          : ''

        saveStep({
          phase,
          action: '出队并扩散',
          current,
          queue,
          pacific,
          atlantic,
          added,
          blocked,
          line: added.length ? 'push' : 'compare',
          note: `当前 ${cellText(current)} 高度为 ${heights[row][col]}。反向搜索只走向高度不低于它的邻居：${addedText}${blockedText}。`
        })
      }

      saveStep({
        phase,
        action: '本轮完成',
        queue,
        pacific,
        atlantic,
        line: 'pop',
        note: `${phase}的 queue 已清空，这一轮 visited 就是所有能够流入${phase}的格子。`
      })
    }

    const pacificStarts = []
    for (let col = 0; col < cols; col += 1) pacificStarts.push([0, col])
    for (let row = 1; row < rows; row += 1) pacificStarts.push([row, 0])

    const atlanticStarts = []
    for (let col = 0; col < cols; col += 1) atlanticStarts.push([rows - 1, col])
    for (let row = 0; row < rows - 1; row += 1) atlanticStarts.push([row, cols - 1])

    runOcean('太平洋', pacificStarts, pacific, atlantic)
    runOcean('大西洋', atlanticStarts, atlantic, pacific)

    const answer = Array.from(pacific)
      .filter(key => atlantic.has(key))
      .map(key => key.split(',').map(Number))
      .sort(([firstRow, firstCol], [secondRow, secondCol]) => (
        firstRow - secondRow || firstCol - secondCol
      ))

    saveStep({
      phase: '求交集',
      action: '得到答案',
      pacific,
      atlantic,
      added: answer,
      line: 'intersect',
      note: `同时出现在两个 visited 集合中的格子共有 ${answer.length} 个：${answer.map(cellText).join('、')}。`
    })

    const phaseElement = root.querySelector('[data-role="phase"]')
    const actionElement = root.querySelector('[data-role="action"]')
    const currentElement = root.querySelector('[data-role="current"]')
    const queueSizeElement = root.querySelector('[data-role="queue-size"]')
    const gridElement = root.querySelector('[data-role="grid"]')
    const queueElement = root.querySelector('[data-role="queue"]')
    const noteElement = root.querySelector('[data-role="note"]')
    const stepElement = root.querySelector('[data-role="step"]')
    const prevButton = root.querySelector('[data-action="prev"]')
    const nextButton = root.querySelector('[data-action="next"]')
    const playButton = root.querySelector('[data-action="play"]')
    const resetButton = root.querySelector('[data-action="reset"]')
    const codeLines = Array.from(root.querySelectorAll('[data-line]'))
    let stepIndex = 0
    let timer = null
    let playing = false

    const stopPlaying = () => {
      playing = false
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
      playButton.textContent = '播放'
    }

    const scheduleNext = () => {
      if (!playing) return
      timer = window.setTimeout(() => {
        timer = null
        if (!playing) return
        if (stepIndex >= steps.length - 1) {
          stopPlaying()
          return
        }
        stepIndex += 1
        render()
        scheduleNext()
      }, 850)
    }

    const render = () => {
      const step = steps[stepIndex]
      const pacificSet = new Set(step.pacific)
      const atlanticSet = new Set(step.atlantic)
      const addedSet = new Set(step.added.map(([row, col]) => keyOf(row, col)))
      const blockedSet = new Set(step.blocked.map(([row, col]) => keyOf(row, col)))
      const currentKey = step.current ? keyOf(...step.current) : null

      phaseElement.textContent = step.phase
      actionElement.textContent = step.action
      currentElement.textContent = step.current
        ? `${cellText(step.current)}，h=${heights[step.current[0]][step.current[1]]}`
        : '—'
      queueSizeElement.textContent = `${step.queue.length} 个格子`

      gridElement.innerHTML = heights.map((rowValues, row) => (
        rowValues.map((height, col) => {
          const key = keyOf(row, col)
          const classes = ['pa-cell']
          const states = []
          const reachesPacific = pacificSet.has(key)
          const reachesAtlantic = atlanticSet.has(key)

          if (reachesPacific && reachesAtlantic) {
            classes.push('is-both')
            states.push('两个海洋都可达')
          } else if (reachesPacific) {
            classes.push('is-pacific')
            states.push('太平洋可达')
          } else if (reachesAtlantic) {
            classes.push('is-atlantic')
            states.push('大西洋可达')
          }
          if (addedSet.has(key)) classes.push('is-new')
          if (blockedSet.has(key)) classes.push('is-blocked')
          if (currentKey === key) classes.push('is-current')

          return `
            <div class="${classes.join(' ')}" role="gridcell" aria-label="第 ${row} 行第 ${col} 列，高度 ${height}${states.length ? `，${states.join('，')}` : ''}">
              <strong>${height}</strong>
              <small>[${row},${col}]</small>
            </div>
          `
        }).join('')
      )).join('')

      queueElement.innerHTML = step.queue.length
        ? step.queue.map(([row, col]) => (
            '<code>[' + row + ',' + col + ']'
            + '<small>h=' + heights[row][col] + '</small></code>'
          )).join('')
        : '<span class="pa-empty">queue 为空</span>'

      codeLines.forEach(line => {
        line.classList.toggle('active', line.dataset.line === step.line)
      })
      noteElement.textContent = step.note
      stepElement.textContent = `${stepIndex + 1} / ${steps.length}`
      prevButton.disabled = stepIndex === 0
      nextButton.disabled = stepIndex === steps.length - 1
    }

    prevButton.addEventListener('click', () => {
      stopPlaying()
      if (stepIndex > 0) stepIndex -= 1
      render()
    })

    nextButton.addEventListener('click', () => {
      stopPlaying()
      if (stepIndex < steps.length - 1) stepIndex += 1
      render()
    })

    playButton.addEventListener('click', () => {
      if (playing) {
        stopPlaying()
        return
      }
      if (stepIndex >= steps.length - 1) stepIndex = 0
      playing = true
      playButton.textContent = '暂停'
      render()
      scheduleNext()
    })

    resetButton.addEventListener('click', () => {
      stopPlaying()
      stepIndex = 0
      render()
    })

    render()
  })()
</script>

~~~python
from collections import deque


def pacific_atlantic(
    heights: list[list[int]],
) -> list[list[int]]:
    if not heights or not heights[0]:
        return []

    rows = len(heights)
    cols = len(heights[0])
    directions = ((-1, 0), (1, 0), (0, -1), (0, 1))

    def reachable(starts: list[tuple[int, int]]) -> set[tuple[int, int]]:
        visited = set(starts)
        queue = deque(visited)

        while queue:
            row, col = queue.popleft()

            for row_step, col_step in directions:
                next_row = row + row_step
                next_col = col + col_step

                if not (
                    0 <= next_row < rows
                    and 0 <= next_col < cols
                ):
                    continue

                if (next_row, next_col) in visited:
                    continue

                if heights[next_row][next_col] < heights[row][col]:
                    continue

                visited.add((next_row, next_col))
                queue.append((next_row, next_col))

        return visited

    pacific_starts = (
        [(row, 0) for row in range(rows)]
        + [(0, col) for col in range(cols)]
    )
    atlantic_starts = (
        [(row, cols - 1) for row in range(rows)]
        + [(rows - 1, col) for col in range(cols)]
    )

    pacific = reachable(pacific_starts)
    atlantic = reachable(atlantic_starts)

    return [
        [row, col]
        for row in range(rows)
        for col in range(cols)
        if (row, col) in pacific and (row, col) in atlantic
    ]
~~~

反向搜索是网格题的重要技巧：如果“从所有起点分别走”代价太高，可以考虑从终点集合同时反向扩散。

## 5. 并查集：动态维护无向图的连通分量

并查集适合处理：

~~~text
两个节点是否属于同一集合
合并两个集合
不断加边时判断是否产生环
~~~

它不保存具体路径，只保存集合关系。

### 5.1 路径压缩与按大小合并

~~~python
class DisjointSet:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))
        self.component_size = [1] * size

    def find(self, node: int) -> int:
        if self.parent[node] != node:
            self.parent[node] = self.find(self.parent[node])

        return self.parent[node]

    def union(self, first: int, second: int) -> bool:
        first_root = self.find(first)
        second_root = self.find(second)

        if first_root == second_root:
            return False

        if (
            self.component_size[first_root]
            < self.component_size[second_root]
        ):
            first_root, second_root = second_root, first_root

        self.parent[second_root] = first_root
        self.component_size[first_root] += self.component_size[second_root]
        return True

    def connected(self, first: int, second: int) -> bool:
        return self.find(first) == self.find(second)
~~~

两个优化分别解决：

- 路径压缩：查询以后让节点直接靠近根。
- 按大小合并：小树挂到大树下面，避免树变得过高。

两者同时使用时，单次操作的均摊复杂度接近 $O(1)$，严格写作 $O(\alpha(n))$。

<div class="algo-demo union-find-demo" id="union-find-demo">
  <div class="algo-demo-title">
    <span>并查集森林：查找、压缩、合并与判环</span>
    <code>find(4) → union(4, 7) → union(1, 7)</code>
  </div>

  <div class="uf-status" aria-live="polite">
    <span>操作<strong data-role="operation">准备</strong></span>
    <span>当前动作<strong data-role="action">观察初始森林</strong></span>
    <span>根节点<strong data-role="roots">0、5</strong></span>
    <span>当前节点<strong data-role="current">—</strong></span>
  </div>

  <svg class="uf-forest" viewBox="0 0 760 250" role="img" aria-labelledby="uf-forest-title uf-forest-desc">
    <title id="uf-forest-title">并查集森林变化</title>
    <desc id="uf-forest-desc">箭头从子节点指向父节点，逐步演示查找、路径压缩、按大小合并以及拒绝成环边。</desc>
    <defs>
      <marker id="uf-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke"></path>
      </marker>
    </defs>
    <g data-role="edges"></g>
    <g data-role="cycle-edge"></g>
    <g data-role="nodes"></g>
  </svg>

  <div class="uf-legend" aria-label="图例">
    <span><i class="root"></i>双圈是根</span>
    <span><i class="path"></i>橙色是查找路径</span>
    <span><i class="changed"></i>绿色是新父指针</span>
    <span><i class="rejected"></i>红色虚线会成环</span>
  </div>

  <div class="uf-code-flow" aria-label="并查集关键代码流程">
    <code>parent[x] != x</code>
    <code>递归找到 root</code>
    <code>parent[x] = root</code>
    <code>小树根 → 大树根</code>
    <code>同根：拒绝合并</code>
  </div>

  <table class="uf-arrays" aria-label="并查集数组状态">
    <tbody>
      <tr data-role="parent-row"><th scope="row"><code>parent</code></th></tr>
      <tr data-role="size-row"><th scope="row"><code>size</code><small>仅根有效</small></th></tr>
    </tbody>
  </table>

  <div class="algo-note" data-role="note" aria-live="polite"></div>

  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button>
    <button type="button" data-action="next">下一步</button>
    <button type="button" data-action="play">播放</button>
    <button type="button" data-action="reset">重置</button>
    <span class="algo-step" data-role="step">1 / 14</span>
  </div>
</div>

<script>
(() => {
  const root = document.getElementById('union-find-demo')

  if (!root || root.dataset.ready === 'true') {
    return
  }

  root.dataset.ready = 'true'

  const svgNamespace = 'http://www.w3.org/2000/svg'
  const nodeCount = 8
  const initialParent = [0, 0, 0, 2, 3, 5, 5, 6]
  const compressedParent = [0, 0, 0, 0, 0, 5, 5, 6]
  const secondCompressedParent = [0, 0, 0, 0, 0, 5, 5, 5]
  const mergedParent = [0, 0, 0, 0, 0, 0, 5, 5]
  const cycleCheckedParent = [0, 0, 0, 0, 0, 0, 5, 0]
  const initialSizes = [5, null, null, null, null, 3, null, null]
  const mergedSizes = [8, null, null, null, null, null, null, null]

  const layouts = {
    deep: [[235, 28], [115, 100], [270, 90], [335, 153], [400, 220], [570, 28], [585, 103], [650, 178]],
    flat: [[235, 28], [70, 130], [175, 130], [280, 130], [385, 130], [570, 28], [570, 110], [650, 195]],
    merged: [[360, 28], [75, 125], [175, 125], [275, 125], [375, 125], [535, 120], [495, 218], [615, 218]]
  }

  const steps = [
    {
      operation: '准备', action: '观察初始森林', roots: '0、5', current: '—',
      parent: initialParent, sizes: initialSizes, layout: 'deep', activeNodes: [], activeEdges: [], changedEdges: [], code: -1,
      note: '为了看清路径压缩，先从一棵尚未压缩的深树开始：4 → 3 → 2 → 0。'
    },
    {
      operation: 'find(4)', action: '读取 parent[4] = 3', roots: '寻找中', current: '4',
      parent: initialParent, sizes: initialSizes, layout: 'deep', activeNodes: [4], activeEdges: ['4-3'], changedEdges: [], code: 0,
      note: '4 不是根，因为 parent[4] != 4；继续递归查找 3。'
    },
    {
      operation: 'find(4)', action: '读取 parent[3] = 2', roots: '寻找中', current: '3',
      parent: initialParent, sizes: initialSizes, layout: 'deep', activeNodes: [4, 3], activeEdges: ['4-3', '3-2'], changedEdges: [], code: 0,
      note: '3 仍然不是根，查找路径现在是 4 → 3 → 2。'
    },
    {
      operation: 'find(4)', action: '读取 parent[2] = 0', roots: '寻找中', current: '2',
      parent: initialParent, sizes: initialSizes, layout: 'deep', activeNodes: [4, 3, 2], activeEdges: ['4-3', '3-2', '2-0'], changedEdges: [], code: 1,
      note: '继续沿父指针向上，路径变成 4 → 3 → 2 → 0。'
    },
    {
      operation: 'find(4)', action: 'parent[0] = 0', roots: '找到 0', current: '0',
      parent: initialParent, sizes: initialSizes, layout: 'deep', activeNodes: [4, 3, 2, 0], activeEdges: ['4-3', '3-2', '2-0'], changedEdges: [], code: 1,
      note: '节点 0 的父节点是自己，所以 0 就是这个集合的根。'
    },
    {
      operation: 'find(4)', action: '回溯并改写父指针', roots: '0、5', current: '4、3、2',
      parent: compressedParent, sizes: initialSizes, layout: 'flat', activeNodes: [4, 3, 2, 0], activeEdges: [], changedEdges: ['4-0', '3-0', '2-0'], code: 2,
      note: '路径压缩把 4、3、2 都直接接到根 0；树变扁后，下一次查找会更短。'
    },
    {
      operation: 'union(4, 7)', action: '先执行 find(4)', roots: 'first_root = 0', current: '4',
      parent: compressedParent, sizes: initialSizes, layout: 'flat', activeNodes: [4, 0], activeEdges: ['4-0'], changedEdges: [], code: 1,
      note: '4 已经直接指向根 0，所以 find(4) 只走一步。'
    },
    {
      operation: 'union(4, 7)', action: '再执行 find(7)', roots: '寻找 second_root', current: '7',
      parent: compressedParent, sizes: initialSizes, layout: 'flat', activeNodes: [7, 6], activeEdges: ['7-6'], changedEdges: [], code: 0,
      note: '从 7 开始沿父指针查找：7 → 6。'
    },
    {
      operation: 'union(4, 7)', action: '找到第二棵树的根', roots: 'second_root = 5', current: '5',
      parent: compressedParent, sizes: initialSizes, layout: 'flat', activeNodes: [7, 6, 5], activeEdges: ['7-6', '6-5'], changedEdges: [], code: 1,
      note: '继续得到 7 → 6 → 5，而 parent[5] = 5，所以第二个根是 5。'
    },
    {
      operation: 'union(4, 7)', action: '压缩 find(7) 的路径', roots: '0、5', current: '7、6',
      parent: secondCompressedParent, sizes: initialSizes, layout: 'flat', activeNodes: [7, 6, 5], activeEdges: [], changedEdges: ['7-5', '6-5'], code: 2,
      note: 'find(7) 回溯时让 7 和 6 直接指向根 5。'
    },
    {
      operation: 'union(4, 7)', action: '比较两个集合大小', roots: '0 与 5', current: '—',
      parent: secondCompressedParent, sizes: initialSizes, layout: 'flat', activeNodes: [0, 5], activeEdges: [], changedEdges: [], code: 3,
      note: 'size[0] = 5，size[5] = 3；按大小合并时，让较小的根 5 指向较大的根 0。'
    },
    {
      operation: 'union(4, 7)', action: 'parent[5] = 0', roots: '只剩 0', current: '5',
      parent: mergedParent, sizes: mergedSizes, layout: 'merged', activeNodes: [5, 0], activeEdges: [], changedEdges: ['5-0'], code: 3,
      note: '两棵树完成合并，根 0 的集合大小更新为 5 + 3 = 8。'
    },
    {
      operation: 'union(1, 7)', action: '分别查找两个根', roots: '都是 0', current: '1、7',
      parent: cycleCheckedParent, sizes: mergedSizes, layout: 'merged', activeNodes: [1, 7, 0], activeEdges: ['1-0', '7-0'], changedEdges: ['7-0'], code: 4,
      note: 'find(1) 和 find(7) 都得到根 0，说明两个端点原本已经连通。'
    },
    {
      operation: 'union(1, 7)', action: '拒绝这条边', roots: 'first_root = second_root', current: '1、7',
      parent: cycleCheckedParent, sizes: mergedSizes, layout: 'merged', activeNodes: [1, 7, 0], activeEdges: [], changedEdges: [], code: 4, cycle: [1, 7],
      note: '如果再加入 1—7，就会形成环，因此 union 返回 False；这正是 684 题判断冗余边的依据。'
    }
  ]

  const edgesLayer = root.querySelector('[data-role="edges"]')
  const cycleLayer = root.querySelector('[data-role="cycle-edge"]')
  const nodesLayer = root.querySelector('[data-role="nodes"]')
  const parentRow = root.querySelector('[data-role="parent-row"]')
  const sizeRow = root.querySelector('[data-role="size-row"]')
  const codeItems = Array.from(root.querySelectorAll('.uf-code-flow code'))
  const nodeElements = []
  const parentCells = []
  const sizeCells = []
  let index = 0
  let timer = null
  let playing = false

  function createSvgElement(name) {
    return document.createElementNS(svgNamespace, name)
  }

  function appendArrayCell(row, cellList, node) {
    const cell = document.createElement('td')
    cell.dataset.node = String(node)
    row.appendChild(cell)
    cellList.push(cell)
  }

  for (let node = 0; node < nodeCount; node += 1) {
    const group = createSvgElement('g')
    const ring = createSvgElement('circle')
    const circle = createSvgElement('circle')
    const label = createSvgElement('text')

    group.classList.add('uf-node')
    group.dataset.node = String(node)
    ring.classList.add('uf-root-ring')
    ring.setAttribute('r', '27')
    circle.setAttribute('r', '22')
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('dominant-baseline', 'central')
    label.textContent = String(node)

    group.appendChild(ring)
    group.appendChild(circle)
    group.appendChild(label)
    nodesLayer.appendChild(group)
    nodeElements.push(group)
    appendArrayCell(parentRow, parentCells, node)
    appendArrayCell(sizeRow, sizeCells, node)
  }

  function edgeKey(child, parent) {
    return String(child) + '-' + String(parent)
  }

  function shortenedLine(from, to) {
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const length = Math.sqrt(dx * dx + dy * dy) || 1
    const startOffset = 23
    const endOffset = 29

    return {
      x1: from[0] + dx * startOffset / length,
      y1: from[1] + dy * startOffset / length,
      x2: to[0] - dx * endOffset / length,
      y2: to[1] - dy * endOffset / length
    }
  }

  function drawEdges(step, positions) {
    edgesLayer.replaceChildren()

    for (let child = 0; child < nodeCount; child += 1) {
      const parent = step.parent[child]

      if (child === parent) {
        continue
      }

      const key = edgeKey(child, parent)
      const points = shortenedLine(positions[child], positions[parent])
      const line = createSvgElement('line')

      line.classList.add('uf-edge')

      if (step.activeEdges.includes(key)) {
        line.classList.add('is-active')
      }

      if (step.changedEdges.includes(key)) {
        line.classList.add('is-changed')
      }

      line.setAttribute('x1', String(points.x1))
      line.setAttribute('y1', String(points.y1))
      line.setAttribute('x2', String(points.x2))
      line.setAttribute('y2', String(points.y2))
      line.setAttribute('marker-end', 'url(#uf-arrow)')
      edgesLayer.appendChild(line)
    }
  }

  function drawCycleEdge(step, positions) {
    cycleLayer.replaceChildren()

    if (!step.cycle) {
      return
    }

    const first = positions[step.cycle[0]]
    const second = positions[step.cycle[1]]
    const path = createSvgElement('path')
    const middleX = (first[0] + second[0]) / 2
    const controlY = Math.min(first[1], second[1]) - 85

    path.classList.add('uf-cycle-edge')
    path.setAttribute('d', 'M ' + first[0] + ' ' + first[1] + ' Q ' + middleX + ' ' + controlY + ' ' + second[0] + ' ' + second[1])
    cycleLayer.appendChild(path)
  }

  function updateArray(cells, values, step) {
    cells.forEach((cell, node) => {
      const value = values[node]
      cell.textContent = value === null ? '—' : String(value)
      cell.classList.toggle('is-active', step.activeNodes.includes(node))
      cell.classList.toggle('is-root', step.parent[node] === node)
    })
  }

  function stopPlaying() {
    playing = false

    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }

    root.querySelector('[data-action="play"]').textContent = '播放'
  }

  function scheduleNext() {
    if (!playing) {
      return
    }

    timer = window.setTimeout(() => {
      timer = null

      if (!playing) {
        return
      }

      if (index >= steps.length - 1) {
        stopPlaying()
        return
      }

      index += 1
      render()
      scheduleNext()
    }, 1050)
  }

  function render() {
    const step = steps[index]
    const positions = layouts[step.layout]

    root.querySelector('[data-role="operation"]').textContent = step.operation
    root.querySelector('[data-role="action"]').textContent = step.action
    root.querySelector('[data-role="roots"]').textContent = step.roots
    root.querySelector('[data-role="current"]').textContent = step.current
    root.querySelector('[data-role="note"]').textContent = step.note
    root.querySelector('[data-role="step"]').textContent = String(index + 1) + ' / ' + String(steps.length)

    nodeElements.forEach((group, node) => {
      group.style.transform = 'translate(' + positions[node][0] + 'px, ' + positions[node][1] + 'px)'
      group.classList.toggle('is-root', step.parent[node] === node)
      group.classList.toggle('is-active', step.activeNodes.includes(node))
      group.classList.toggle('is-current', step.current.split('、').includes(String(node)))
      group.setAttribute('aria-label', '节点 ' + node + '，父节点 ' + step.parent[node])
    })

    codeItems.forEach((item, codeIndex) => {
      item.classList.toggle('active', codeIndex === step.code)
    })

    drawEdges(step, positions)
    drawCycleEdge(step, positions)
    updateArray(parentCells, step.parent, step)
    updateArray(sizeCells, step.sizes, step)

    root.querySelector('[data-action="prev"]').disabled = index === 0
    root.querySelector('[data-action="next"]').disabled = index === steps.length - 1
  }

  root.querySelector('[data-action="prev"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.max(0, index - 1)
    render()
  })

  root.querySelector('[data-action="next"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.min(steps.length - 1, index + 1)
    render()
  })

  root.querySelector('[data-action="play"]').addEventListener('click', () => {
    if (playing) {
      stopPlaying()
      return
    }

    if (index >= steps.length - 1) {
      index = 0
      render()
    }

    playing = true
    root.querySelector('[data-action="play"]').textContent = '暂停'
    scheduleNext()
  })

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    stopPlaying()
    index = 0
    render()
  })

  render()
})()
</script>

### 5.2 [684. 冗余连接](https://leetcode.cn/problems/redundant-connection/)：第一条合并失败的边就是成环边

~~~python
def find_redundant_connection(
    edges: list[list[int]],
) -> list[int]:
    node_count = max(max(first, second) for first, second in edges)
    dsu = DisjointSet(node_count + 1)

    for first, second in edges:
        if not dsu.union(first, second):
            return [first, second]

    return []
~~~

加入一条边以前，如果两个端点已经连通，再加这条边就会形成环。并查集非常适合“边逐条到来”的无向图问题。

有向图的成环与冗余边需要同时考虑入度，不能直接照搬无向图模板。

## 6. 拓扑排序：把依赖关系排成合法顺序

拓扑排序解决的是一类“有先后依赖”的问题：当某些事情必须在另一些事情完成以后才能开始时，能否给所有事情安排出一个合法的执行顺序？如果可以，其中一种顺序是什么？

它不是按照节点的数值或名称从小到大排序，而是要求对每一条有向边：

~~~text
前置任务 u → 后续任务 v
~~~

最终结果中，`u` 必须出现在 `v` 前面。常见场景包括课程先修关系、软件包依赖、项目任务安排、编译构建顺序等。

如果依赖关系中存在环，例如 `A` 等 `B`、`B` 又等 `A`，那么没有任何任务能够率先完成，也就不存在拓扑序。因此拓扑排序还经常用来判断有向图是否成环。

拓扑排序只适用于有向无环图，也就是 DAG。同一张图可能有多种合法拓扑序；算法通常只需要返回其中一种。它只负责满足依赖先后关系，并不保证总耗时最短或资源安排最优。

把先修关系：

~~~text
prerequisite → course
~~~

建成有向边。入度为 0 的节点表示当前没有未完成依赖，可以先执行。

### 6.1 Kahn 算法

~~~python
from collections import deque


def find_course_order(
    num_courses: int,
    prerequisites: list[list[int]],
) -> list[int]:
    graph = [[] for _ in range(num_courses)]
    indegree = [0] * num_courses

    for course, prerequisite in prerequisites:
        graph[prerequisite].append(course)
        indegree[course] += 1

    queue = deque(
        course
        for course in range(num_courses)
        if indegree[course] == 0
    )
    order = []

    while queue:
        course = queue.popleft()
        order.append(course)

        for next_course in graph[course]:
            indegree[next_course] -= 1

            if indegree[next_course] == 0:
                queue.append(next_course)

    return order if len(order) == num_courses else []
~~~

判断是否存在环：

~~~text
处理节点数 == 总节点数：存在拓扑序，没有环
处理节点数 < 总节点数：剩余节点互相依赖，存在环
~~~

[207. 课程表](https://leetcode.cn/problems/course-schedule/)只需判断能否完成，检查结果长度即可；[210. 课程表 II](https://leetcode.cn/problems/course-schedule-ii/)需要返回具体顺序。

拓扑序可能不唯一。如果同时有多个入度为 0 的节点，选择顺序不同就可能得到不同合法答案。

## 7. 最短路：先根据边权选择算法

| 图的条件 | 推荐算法 | 典型复杂度 |
|---|---|---:|
| 无权图或每条边权相同 | BFS | $O(V + E)$ |
| 边权非负、单源 | Dijkstra + 堆 | $O((V + E)\log V)$ |
| 允许负权、单源 | Bellman-Ford | $O(VE)$ |
| 所有点对最短路 | Floyd-Warshall | $O(V^3)$ |

### 7.1 [743. 网络延迟时间](https://leetcode.cn/problems/network-delay-time/)：用 Dijkstra 确定当前距离最小的节点

<span id="dijkstra-shortest-path" class="algorithm-section-anchor"></span>

<div class="algo-demo dijkstra-demo" id="dijkstra-demo">
  <div class="algo-demo-title">
    <span>Dijkstra：弹出最近节点，再松弛它的出边</span>
    <code>n = 5，k = 1</code>
  </div>

  <div class="dj-status" aria-live="polite">
    <span>堆顶弹出<strong data-role="popped">—</strong></span>
    <span>检查边<strong data-role="edge">—</strong></span>
    <span>候选距离<strong data-role="candidate">dist[1] = 0</strong></span>
    <span>结果<strong data-role="result">起点入堆</strong></span>
  </div>

  <svg class="dj-graph" viewBox="0 0 700 230" role="img" aria-labelledby="dj-graph-title dj-graph-desc">
    <title id="dj-graph-title">Dijkstra 有向带权图</title>
    <desc id="dj-graph-desc">从节点 1 出发，箭头表示传播方向，边旁数字表示传播耗时。</desc>
    <defs>
      <marker id="dj-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke"></path>
      </marker>
    </defs>
    <g class="dj-edge" data-edge="1-2">
      <path d="M 106 128 Q 175 170 244 182" marker-end="url(#dj-arrow)"></path>
      <rect x="163" y="151" width="28" height="20" rx="3"></rect>
      <text x="177" y="165">10</text>
    </g>
    <g class="dj-edge" data-edge="1-3">
      <path d="M 106 111 Q 174 62 244 55" marker-end="url(#dj-arrow)"></path>
      <rect x="162" y="72" width="24" height="20" rx="3"></rect>
      <text x="174" y="86">3</text>
    </g>
    <g class="dj-edge" data-edge="3-2">
      <path d="M 267 76 L 270 164" marker-end="url(#dj-arrow)"></path>
      <rect x="278" y="110" width="24" height="20" rx="3"></rect>
      <text x="290" y="124">2</text>
    </g>
    <g class="dj-edge" data-edge="3-4">
      <path d="M 292 57 Q 445 75 552 176" marker-end="url(#dj-arrow)"></path>
      <rect x="421" y="86" width="24" height="20" rx="3"></rect>
      <text x="433" y="100">8</text>
    </g>
    <g class="dj-edge" data-edge="3-5">
      <path d="M 293 48 Q 390 38 486 55" marker-end="url(#dj-arrow)"></path>
      <rect x="379" y="28" width="24" height="20" rx="3"></rect>
      <text x="391" y="42">7</text>
    </g>
    <g class="dj-edge" data-edge="2-4">
      <path d="M 294 190 L 546 190" marker-end="url(#dj-arrow)"></path>
      <rect x="408" y="174" width="24" height="20" rx="3"></rect>
      <text x="420" y="188">2</text>
    </g>
    <g class="dj-edge" data-edge="2-5">
      <path d="M 291 176 Q 392 111 490 69" marker-end="url(#dj-arrow)"></path>
      <rect x="383" y="111" width="24" height="20" rx="3"></rect>
      <text x="395" y="125">4</text>
    </g>
    <g class="dj-edge" data-edge="5-4">
      <path d="M 518 78 Q 548 119 565 166" marker-end="url(#dj-arrow)"></path>
      <rect x="540" y="112" width="24" height="20" rx="3"></rect>
      <text x="552" y="126">1</text>
    </g>
    <g class="dj-node" data-node="1" transform="translate(82 120)">
      <circle r="25"></circle><text text-anchor="middle" dominant-baseline="central">1</text>
    </g>
    <g class="dj-node" data-node="2" transform="translate(270 190)">
      <circle r="25"></circle><text text-anchor="middle" dominant-baseline="central">2</text>
    </g>
    <g class="dj-node" data-node="3" transform="translate(268 50)">
      <circle r="25"></circle><text text-anchor="middle" dominant-baseline="central">3</text>
    </g>
    <g class="dj-node" data-node="4" transform="translate(575 190)">
      <circle r="25"></circle><text text-anchor="middle" dominant-baseline="central">4</text>
    </g>
    <g class="dj-node" data-node="5" transform="translate(512 56)">
      <circle r="25"></circle><text text-anchor="middle" dominant-baseline="central">5</text>
    </g>
  </svg>

  <div class="dj-legend" aria-label="图例">
    <span><i class="queued"></i>已入堆</span>
    <span><i class="current"></i>当前弹出或检查</span>
    <span><i class="fixed"></i>最短距离已确定</span>
    <span><i class="stale"></i>旧状态</span>
  </div>

  <div class="dj-code-flow" aria-label="Dijkstra 关键代码流程">
    <code>heappop 最小距离</code>
    <code>旧状态？continue</code>
    <code>遍历 node 的出边</code>
    <code>candidate &lt; dist[v]</code>
    <code>max(dist[1:])</code>
  </div>

  <div class="dj-data-row">
    <div class="dj-heap-row">
      <span>小根堆<small>顶部在左</small></span>
      <div class="dj-heap" data-role="heap"></div>
    </div>
    <table class="dj-dist" aria-label="起点到各节点的当前最短距离">
      <tbody>
        <tr><th scope="row">节点</th><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
        <tr data-role="dist-row"><th scope="row"><code>dist</code></th></tr>
      </tbody>
    </table>
  </div>

  <div class="algo-note" data-role="note" aria-live="polite"></div>

  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button>
    <button type="button" data-action="next">下一步</button>
    <button type="button" data-action="play">播放</button>
    <button type="button" data-action="reset">重置</button>
    <span class="algo-step" data-role="step">1 / 18</span>
  </div>
</div>

<script>
(() => {
  const root = document.getElementById('dijkstra-demo')

  if (!root || root.dataset.ready === 'true') {
    return
  }

  root.dataset.ready = 'true'

  const infinity = Infinity
  const d0 = [0, infinity, infinity, infinity, infinity]
  const d12 = [0, 10, infinity, infinity, infinity]
  const d123 = [0, 10, 3, infinity, infinity]
  const d2Better = [0, 5, 3, infinity, infinity]
  const d4First = [0, 5, 3, 11, infinity]
  const d5First = [0, 5, 3, 11, 10]
  const d4Better = [0, 5, 3, 7, 10]
  const finalDistances = [0, 5, 3, 7, 9]

  const steps = [
    {
      popped: '—', edge: '—', candidate: 'dist[1] = 0', result: '起点入堆',
      distances: d0, heap: [[0, 1]], fixed: [], current: null, edgeKey: null, edgeState: null, changed: 1, stale: false, code: -1,
      note: '从起点 1 开始：只有 dist[1] = 0，其余节点暂时不可达，记作 ∞。'
    },
    {
      popped: '(0, 1)', edge: '—', candidate: '0 = dist[1]', result: '确定节点 1',
      distances: d0, heap: [], fixed: [1], current: 1, edgeKey: null, edgeState: null, changed: null, stale: false, code: 0,
      note: '堆顶给出了当前全局最小距离 0；它与 dist[1] 一致，因此节点 1 的最短距离可以确定。'
    },
    {
      popped: '(0, 1)', edge: '1 → 2，w = 10', candidate: '0 + 10 = 10', result: '∞ → 10，入堆',
      distances: d12, heap: [[10, 2]], fixed: [1], current: 1, edgeKey: '1-2', edgeState: 'updated', changed: 2, stale: false, code: 3,
      note: '10 小于原来的 ∞，更新 dist[2] = 10，并把 (10, 2) 放入小根堆。'
    },
    {
      popped: '(0, 1)', edge: '1 → 3，w = 3', candidate: '0 + 3 = 3', result: '∞ → 3，入堆',
      distances: d123, heap: [[3, 3], [10, 2]], fixed: [1], current: 1, edgeKey: '1-3', edgeState: 'updated', changed: 3, stale: false, code: 3,
      note: '更新 dist[3] = 3。小根堆会让距离更小的 (3, 3) 先弹出。'
    },
    {
      popped: '(3, 3)', edge: '—', candidate: '3 = dist[3]', result: '确定节点 3',
      distances: d123, heap: [[10, 2]], fixed: [1, 3], current: 3, edgeKey: null, edgeState: null, changed: null, stale: false, code: 0,
      note: '虽然节点 2 更早入堆，但节点 3 的距离更小，所以先确定节点 3。'
    },
    {
      popped: '(3, 3)', edge: '3 → 2，w = 2', candidate: '3 + 2 = 5', result: '10 → 5，重新入堆',
      distances: d2Better, heap: [[5, 2], [10, 2]], fixed: [1, 3], current: 3, edgeKey: '3-2', edgeState: 'updated', changed: 2, stale: false, code: 3,
      note: '发现更短路径 1 → 3 → 2。新状态 (5, 2) 入堆，旧状态 (10, 2) 暂时留在堆中。'
    },
    {
      popped: '(3, 3)', edge: '3 → 4，w = 8', candidate: '3 + 8 = 11', result: '∞ → 11，入堆',
      distances: d4First, heap: [[5, 2], [10, 2], [11, 4]], fixed: [1, 3], current: 3, edgeKey: '3-4', edgeState: 'updated', changed: 4, stale: false, code: 3,
      note: '第一次到达节点 4，记录 dist[4] = 11；这仍可能被后续路径继续缩短。'
    },
    {
      popped: '(3, 3)', edge: '3 → 5，w = 7', candidate: '3 + 7 = 10', result: '∞ → 10，入堆',
      distances: d5First, heap: [[5, 2], [10, 2], [10, 5], [11, 4]], fixed: [1, 3], current: 3, edgeKey: '3-5', edgeState: 'updated', changed: 5, stale: false, code: 3,
      note: '节点 3 的出边处理完毕；下一次仍从堆中选择当前距离最小的节点。'
    },
    {
      popped: '(5, 2)', edge: '—', candidate: '5 = dist[2]', result: '确定节点 2',
      distances: d5First, heap: [[10, 2], [10, 5], [11, 4]], fixed: [1, 3, 2], current: 2, edgeKey: null, edgeState: null, changed: null, stale: false, code: 0,
      note: '弹出的 5 与 dist[2] 一致，因此确定节点 2；堆中的 (10, 2) 已经成为旧状态。'
    },
    {
      popped: '(5, 2)', edge: '2 → 4，w = 2', candidate: '5 + 2 = 7', result: '11 → 7，重新入堆',
      distances: d4Better, heap: [[7, 4], [10, 2], [10, 5], [11, 4]], fixed: [1, 3, 2], current: 2, edgeKey: '2-4', edgeState: 'updated', changed: 4, stale: false, code: 3,
      note: '路径 1 → 3 → 2 → 4 的距离为 7，比原来的 11 更短。'
    },
    {
      popped: '(5, 2)', edge: '2 → 5，w = 4', candidate: '5 + 4 = 9', result: '10 → 9，重新入堆',
      distances: finalDistances, heap: [[7, 4], [9, 5], [10, 2], [10, 5], [11, 4]], fixed: [1, 3, 2], current: 2, edgeKey: '2-5', edgeState: 'updated', changed: 5, stale: false, code: 3,
      note: 'dist[5] 从 10 降到 9；堆里同时保留新状态 (9, 5) 和旧状态 (10, 5)。'
    },
    {
      popped: '(7, 4)', edge: '—', candidate: '7 = dist[4]', result: '确定节点 4',
      distances: finalDistances, heap: [[9, 5], [10, 2], [10, 5], [11, 4]], fixed: [1, 3, 2, 4], current: 4, edgeKey: null, edgeState: null, changed: null, stale: false, code: 0,
      note: '堆顶距离 7 有效，节点 4 的最短距离确定为 7。'
    },
    {
      popped: '(9, 5)', edge: '—', candidate: '9 = dist[5]', result: '确定节点 5',
      distances: finalDistances, heap: [[10, 2], [10, 5], [11, 4]], fixed: [1, 3, 2, 4, 5], current: 5, edgeKey: null, edgeState: null, changed: null, stale: false, code: 0,
      note: '节点 5 也被确定。此时所有节点都已经得到最短距离，但堆中还有几个旧状态。'
    },
    {
      popped: '(9, 5)', edge: '5 → 4，w = 1', candidate: '9 + 1 = 10', result: '10 ≥ 7，不更新',
      distances: finalDistances, heap: [[10, 2], [10, 5], [11, 4]], fixed: [1, 3, 2, 4, 5], current: 5, edgeKey: '5-4', edgeState: 'rejected', changed: null, stale: false, code: 2,
      note: '候选距离 10 不小于 dist[4] = 7，这条边无法带来更短路径。'
    },
    {
      popped: '(10, 2)', edge: '—', candidate: '10 ≠ dist[2] = 5', result: '旧状态，跳过',
      distances: finalDistances, heap: [[10, 5], [11, 4]], fixed: [1, 3, 2, 4, 5], current: 2, edgeKey: null, edgeState: null, changed: null, stale: true, code: 1,
      note: '(10, 2) 是更新前留下的旧状态。它不再代表 dist[2]，所以直接 continue。'
    },
    {
      popped: '(10, 5)', edge: '—', candidate: '10 ≠ dist[5] = 9', result: '旧状态，跳过',
      distances: finalDistances, heap: [[11, 4]], fixed: [1, 3, 2, 4, 5], current: 5, edgeKey: null, edgeState: null, changed: null, stale: true, code: 1,
      note: '同理，(10, 5) 已经被更短的 (9, 5) 取代，不需要再次扫描节点 5 的出边。'
    },
    {
      popped: '(11, 4)', edge: '—', candidate: '11 ≠ dist[4] = 7', result: '旧状态，跳过',
      distances: finalDistances, heap: [], fixed: [1, 3, 2, 4, 5], current: 4, edgeKey: null, edgeState: null, changed: null, stale: true, code: 1,
      note: '最后一个旧状态也被跳过，堆已经清空。'
    },
    {
      popped: '堆为空', edge: '—', candidate: 'max(0, 5, 3, 7, 9)', result: '网络延迟 = 9',
      distances: finalDistances, heap: [], fixed: [1, 3, 2, 4, 5], current: null, edgeKey: null, edgeState: null, changed: null, stale: false, code: 4,
      note: '所有节点都可达，最慢收到信号的是节点 5，耗时为 max(dist[1:]) = 9。'
    }
  ]

  const nodes = Array.from(root.querySelectorAll('.dj-node'))
  const edges = Array.from(root.querySelectorAll('.dj-edge'))
  const codeItems = Array.from(root.querySelectorAll('.dj-code-flow code'))
  const heapElement = root.querySelector('[data-role="heap"]')
  const distRow = root.querySelector('[data-role="dist-row"]')
  const distCells = []
  let index = 0
  let timer = null
  let playing = false

  for (let node = 1; node <= 5; node += 1) {
    const cell = document.createElement('td')
    cell.dataset.node = String(node)
    distRow.appendChild(cell)
    distCells.push(cell)
  }

  function formatDistance(value) {
    return Number.isFinite(value) ? String(value) : '∞'
  }

  function renderHeap(step) {
    heapElement.replaceChildren()

    if (step.heap.length === 0) {
      const empty = document.createElement('span')
      empty.className = 'dj-empty'
      empty.textContent = '空'
      heapElement.appendChild(empty)
      return
    }

    step.heap.forEach((entry, heapIndex) => {
      const item = document.createElement('code')
      const distance = entry[0]
      const node = entry[1]

      item.textContent = '(' + distance + ', ' + node + ')'
      item.classList.toggle('is-top', heapIndex === 0)
      item.classList.toggle('is-stale', distance !== step.distances[node - 1])
      heapElement.appendChild(item)
    })
  }

  function stopPlaying() {
    playing = false

    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }

    root.querySelector('[data-action="play"]').textContent = '播放'
  }

  function scheduleNext() {
    if (!playing) {
      return
    }

    timer = window.setTimeout(() => {
      timer = null

      if (!playing) {
        return
      }

      if (index >= steps.length - 1) {
        stopPlaying()
        return
      }

      index += 1
      render()
      scheduleNext()
    }, 1050)
  }

  function render() {
    const step = steps[index]

    root.querySelector('[data-role="popped"]').textContent = step.popped
    root.querySelector('[data-role="edge"]').textContent = step.edge
    root.querySelector('[data-role="candidate"]').textContent = step.candidate
    root.querySelector('[data-role="result"]').textContent = step.result
    root.querySelector('[data-role="note"]').textContent = step.note
    root.querySelector('[data-role="step"]').textContent = String(index + 1) + ' / ' + String(steps.length)

    nodes.forEach((nodeElement) => {
      const node = Number(nodeElement.dataset.node)
      const isQueued = step.heap.some((entry) => entry[1] === node && entry[0] === step.distances[node - 1])

      nodeElement.classList.toggle('is-queued', isQueued)
      nodeElement.classList.toggle('is-fixed', step.fixed.includes(node))
      nodeElement.classList.toggle('is-current', step.current === node && !step.stale)
      nodeElement.classList.toggle('is-stale', step.current === node && step.stale)
      nodeElement.setAttribute(
        'aria-label',
        '节点 ' + node + '，当前距离 ' + formatDistance(step.distances[node - 1])
      )
    })

    edges.forEach((edgeElement) => {
      const active = edgeElement.dataset.edge === step.edgeKey
      edgeElement.classList.toggle('is-checking', active)
      edgeElement.classList.toggle('is-updated', active && step.edgeState === 'updated')
      edgeElement.classList.toggle('is-rejected', active && step.edgeState === 'rejected')
    })

    distCells.forEach((cell, cellIndex) => {
      const node = cellIndex + 1
      cell.textContent = formatDistance(step.distances[cellIndex])
      cell.classList.toggle('is-changed', step.changed === node)
      cell.classList.toggle('is-fixed', step.fixed.includes(node))
    })

    codeItems.forEach((item, codeIndex) => {
      item.classList.toggle('active', codeIndex === step.code)
    })

    renderHeap(step)
    root.querySelector('[data-action="prev"]').disabled = index === 0
    root.querySelector('[data-action="next"]').disabled = index === steps.length - 1
  }

  root.querySelector('[data-action="prev"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.max(0, index - 1)
    render()
  })

  root.querySelector('[data-action="next"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.min(steps.length - 1, index + 1)
    render()
  })

  root.querySelector('[data-action="play"]').addEventListener('click', () => {
    if (playing) {
      stopPlaying()
      return
    }

    if (index >= steps.length - 1) {
      index = 0
      render()
    }

    playing = true
    root.querySelector('[data-action="play"]').textContent = '暂停'
    scheduleNext()
  })

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    stopPlaying()
    index = 0
    render()
  })

  render()
})()
</script>

~~~python
import heapq


def network_delay_time(
    times: list[list[int]],
    node_count: int,
    start: int,
) -> int:
    graph = [[] for _ in range(node_count + 1)]

    for source, target, cost in times:
        graph[source].append((target, cost))

    infinity = float('inf')
    distance = [infinity] * (node_count + 1)
    distance[start] = 0
    heap = [(0, start)]

    while heap:
        current_distance, node = heapq.heappop(heap)

        if current_distance != distance[node]:
            continue

        for neighbor, edge_cost in graph[node]:
            next_distance = current_distance + edge_cost

            if next_distance >= distance[neighbor]:
                continue

            distance[neighbor] = next_distance
            heapq.heappush(
                heap,
                (next_distance, neighbor),
            )

    answer = max(distance[1:])
    return -1 if answer == infinity else int(answer)
~~~

堆里可能同时存在同一节点的新旧距离。Python 的 <code>heapq</code> 不支持直接修改堆中元素，所以通常允许旧状态留在堆里；弹出时用下面的判断跳过：

~~~text
if current_distance != distance[node]:
    continue
~~~

Dijkstra 不能直接处理负权边。一个已经确定的最短距离可能被后面的负权边再次降低，破坏贪心前提。

### 7.2 Bellman-Ford：重复松弛所有边

下面的例子包含负权边 `2 → 3 = -2`，但不存在负权环。边按照 `3→4、2→3、1→3、1→2、2→4` 的固定顺序扫描；这个顺序会让更短距离一轮一轮向后传播，正好能看清“重复松弛”的意义。

<div class="algo-demo bellman-ford-demo" id="bellman-ford-demo">
  <div class="algo-demo-title">
    <strong>Bellman–Ford 多轮松弛</strong>
    <span>允许负权边 · 额外一轮检测负权环</span>
  </div>
  <div class="bf-status" aria-live="polite">
    <div><span>轮次</span><strong data-role="round"></strong></div>
    <div><span>当前边</span><strong data-role="edge"></strong></div>
    <div><span>候选距离</span><strong data-role="candidate"></strong></div>
    <div><span>结果</span><strong data-role="result"></strong></div>
  </div>
  <div class="bf-rounds" aria-label="扫描轮次">
    <span data-round="1">第 1 轮</span><span data-round="2">第 2 轮</span><span data-round="3">第 3 轮</span><span data-round="4">检测轮</span>
  </div>
  <svg class="bf-graph" viewBox="0 0 650 230" role="img" aria-label="包含一条负权边的有向带权图">
    <defs><marker id="bf-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M 0 0 L 9 4.5 L 0 9 z"></path></marker></defs>
    <g class="bf-edge" data-edge="1-2"><path d="M 104 106 Q 185 34 273 50" marker-end="url(#bf-arrow)"></path><rect x="170" y="48" width="28" height="21" rx="3"></rect><text x="184" y="63">4</text></g>
    <g class="bf-edge" data-edge="1-3"><path d="M 105 137 Q 187 207 273 185" marker-end="url(#bf-arrow)"></path><rect x="169" y="175" width="28" height="21" rx="3"></rect><text x="183" y="190">5</text></g>
    <g class="bf-edge" data-edge="2-3"><path d="M 300 76 L 300 159" marker-end="url(#bf-arrow)"></path><rect x="306" y="106" width="34" height="21" rx="3"></rect><text x="323" y="121">-2</text></g>
    <g class="bf-edge" data-edge="2-4"><path d="M 325 54 Q 435 41 538 101" marker-end="url(#bf-arrow)"></path><rect x="426" y="48" width="28" height="21" rx="3"></rect><text x="440" y="63">4</text></g>
    <g class="bf-edge" data-edge="3-4"><path d="M 325 181 Q 436 194 539 138" marker-end="url(#bf-arrow)"></path><rect x="427" y="169" width="28" height="21" rx="3"></rect><text x="441" y="184">3</text></g>
    <g class="bf-node" data-node="1" transform="translate(80 122)"><circle r="26"></circle><text text-anchor="middle" dominant-baseline="central">1</text></g>
    <g class="bf-node" data-node="2" transform="translate(300 51)"><circle r="26"></circle><text text-anchor="middle" dominant-baseline="central">2</text></g>
    <g class="bf-node" data-node="3" transform="translate(300 184)"><circle r="26"></circle><text text-anchor="middle" dominant-baseline="central">3</text></g>
    <g class="bf-node" data-node="4" transform="translate(565 121)"><circle r="26"></circle><text text-anchor="middle" dominant-baseline="central">4</text></g>
  </svg>
  <div class="bf-legend" aria-label="图例"><span><i class="checking"></i>正在检查</span><span><i class="updated"></i>成功松弛</span><span><i class="rejected"></i>无需更新</span></div>
  <div class="bf-scan">
    <span class="bf-scan-label">固定扫描顺序</span>
    <ol aria-label="本轮边的扫描顺序"><li data-scan="0"><code>3→4 (+3)</code></li><li data-scan="1"><code>2→3 (-2)</code></li><li data-scan="2"><code>1→3 (+5)</code></li><li data-scan="3"><code>1→2 (+4)</code></li><li data-scan="4"><code>2→4 (+4)</code></li></ol>
  </div>
  <table class="bf-dist" aria-label="轮开始距离与当前距离">
    <tbody>
      <tr><th scope="row">节点</th><td>1</td><td>2</td><td>3</td><td>4</td></tr>
      <tr data-role="start-row"><th scope="row">轮开始</th></tr>
      <tr data-role="dist-row"><th scope="row"><code>dist</code></th></tr>
    </tbody>
  </table>
  <div class="algo-note" data-role="note" aria-live="polite"></div>
  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button><button type="button" data-action="next">下一步</button><button type="button" data-action="play">播放</button><button type="button" data-action="reset">重置</button><span class="algo-step" data-role="step"></span>
  </div>
</div>

<script>
(() => {
  const root = document.getElementById('bellman-ford-demo')

  if (!root || root.dataset.ready === 'true') {
    return
  }

  root.dataset.ready = 'true'

  const inf = Infinity
  const initial = [0, inf, inf, inf]
  const firstThree = [0, inf, 5, inf]
  const firstTwo = [0, 4, 5, inf]
  const firstDone = [0, 4, 5, 8]
  const secondDone = [0, 4, 2, 8]
  const finalDistances = [0, 4, 2, 5]

  const steps = [
    { round: 0, edge: '—', candidate: 'dist[1] = 0', result: '只有起点可达', start: initial, distances: initial, scan: -1, scanDone: -1, edgeKey: null, edgeState: null, source: 1, target: null, changed: null, note: '初始化：起点 1 的距离为 0，其余节点暂时不可达，记为 ∞。' },
    { round: 1, edge: '全部 5 条边', candidate: '按固定顺序扫描', result: '开始第 1 轮', start: initial, distances: initial, scan: -1, scanDone: -1, edgeKey: null, edgeState: null, source: null, target: null, changed: null, note: '每一轮都完整扫描边表。这里使用原地更新：同一轮后面的边可以读到前面刚写入的 dist。' },
    { round: 1, edge: '3 → 4，w = 3', candidate: '∞ + 3', result: '源点不可达，跳过', start: initial, distances: initial, scan: 0, scanDone: 0, edgeKey: '3-4', edgeState: 'skipped', source: 3, target: 4, changed: null, note: 'dist[3] 还是 ∞，从节点 3 出发的路径尚不存在，因此不能松弛节点 4。' },
    { round: 1, edge: '2 → 3，w = -2', candidate: '∞ - 2', result: '源点不可达，跳过', start: initial, distances: initial, scan: 1, scanDone: 1, edgeKey: '2-3', edgeState: 'skipped', source: 2, target: 3, changed: null, note: '负权边本身没有问题，但它的源点 2 目前仍不可达，所以这一轮暂时用不上。' },
    { round: 1, edge: '1 → 3，w = 5', candidate: '0 + 5 = 5', result: '∞ → 5', start: initial, distances: firstThree, scan: 2, scanDone: 2, edgeKey: '1-3', edgeState: 'updated', source: 1, target: 3, changed: 3, note: '候选距离 5 更小，更新 dist[3] = 5。' },
    { round: 1, edge: '1 → 2，w = 4', candidate: '0 + 4 = 4', result: '∞ → 4', start: initial, distances: firstTwo, scan: 3, scanDone: 3, edgeKey: '1-2', edgeState: 'updated', source: 1, target: 2, changed: 2, note: '更新 dist[2] = 4；注意 2 → 3 已经在本轮前面扫过，只能等下一轮再利用这个新距离。' },
    { round: 1, edge: '2 → 4，w = 4', candidate: '4 + 4 = 8', result: '∞ → 8，本轮有更新', start: initial, distances: firstDone, scan: 4, scanDone: 4, edgeKey: '2-4', edgeState: 'updated', source: 2, target: 4, changed: 4, note: '第 1 轮结束，dist = [0, 4, 5, 8]。只要本轮发生过更新，就还可能存在更短路径。' },
    { round: 2, edge: '3 → 4，w = 3', candidate: '5 + 3 = 8', result: '8 不小于 8', start: firstDone, distances: firstDone, scan: 0, scanDone: 0, edgeKey: '3-4', edgeState: 'rejected', source: 3, target: 4, changed: null, note: '候选距离与当前 dist[4] 相等，不需要更新。' },
    { round: 2, edge: '2 → 3，w = -2', candidate: '4 - 2 = 2', result: '5 → 2', start: firstDone, distances: secondDone, scan: 1, scanDone: 1, edgeKey: '2-3', edgeState: 'updated', source: 2, target: 3, changed: 3, note: '负权边让 dist[3] 从 5 降到 2；这就是 Dijkstra 的贪心确定过程无法直接处理的情况。' },
    { round: 2, edge: '其余 3 条边', candidate: '均不能继续变小', result: '第 2 轮结束', start: firstDone, distances: secondDone, scan: -1, scanDone: 4, edgeKey: null, edgeState: null, source: null, target: null, changed: null, note: '本轮仍有更新，但 3 → 4 已经扫过，新得到的 dist[3] = 2 要到下一轮才能传给节点 4。' },
    { round: 3, edge: '3 → 4，w = 3', candidate: '2 + 3 = 5', result: '8 → 5', start: secondDone, distances: finalDistances, scan: 0, scanDone: 0, edgeKey: '3-4', edgeState: 'updated', source: 3, target: 4, changed: 4, note: '第 3 轮终于把更短路径 1 → 2 → 3 → 4 传到终点，距离为 4 - 2 + 3 = 5。' },
    { round: 3, edge: '其余 4 条边', candidate: '均不能继续变小', result: '完成 V - 1 轮', start: secondDone, distances: finalDistances, scan: -1, scanDone: 4, edgeKey: null, edgeState: null, source: null, target: null, changed: null, note: '4 个节点的最短简单路径最多有 V - 1 = 3 条边，所以 3 轮后最短距离已经确定。' },
    { round: 4, edge: '再次扫描全部边', candidate: '检查是否还能松弛', result: '开始检测轮', start: finalDistances, distances: finalDistances, scan: -1, scanDone: -1, edgeKey: null, edgeState: null, source: null, target: null, changed: null, note: '额外再扫描一轮。这一轮不用于求答案，而是专门检测从起点可达的负权环。' },
    { round: 4, edge: '3 → 4，w = 3', candidate: '2 + 3 = 5', result: '5 不小于 5', start: finalDistances, distances: finalDistances, scan: 0, scanDone: 0, edgeKey: '3-4', edgeState: 'rejected', source: 3, target: 4, changed: null, note: '第一条边无法继续缩短距离；继续检查剩余边。' },
    { round: 4, edge: '全部 5 条边', candidate: '没有任何更新', result: '不存在可达负权环', start: finalDistances, distances: finalDistances, scan: -1, scanDone: 4, edgeKey: null, edgeState: null, source: null, target: null, changed: null, note: '检测轮没有更新，说明不存在从起点可达的负权环。反过来，只要这一轮仍能更新，就说明距离可沿某个负权环无限降低。' }
  ]

  const nodes = Array.from(root.querySelectorAll('.bf-node'))
  const edges = Array.from(root.querySelectorAll('.bf-edge'))
  const scanItems = Array.from(root.querySelectorAll('.bf-scan li'))
  const roundItems = Array.from(root.querySelectorAll('.bf-rounds span'))
  const startRow = root.querySelector('[data-role="start-row"]')
  const distRow = root.querySelector('[data-role="dist-row"]')
  const startCells = []
  const distCells = []
  let index = 0
  let timer = null
  let playing = false

  for (let node = 1; node <= 4; node += 1) {
    const startCell = document.createElement('td')
    const distCell = document.createElement('td')
    startCell.dataset.node = String(node)
    distCell.dataset.node = String(node)
    startRow.appendChild(startCell)
    distRow.appendChild(distCell)
    startCells.push(startCell)
    distCells.push(distCell)
  }

  function formatDistance(value) {
    return Number.isFinite(value) ? String(value) : '∞'
  }

  function stopPlaying() {
    playing = false

    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }

    root.querySelector('[data-action="play"]').textContent = '播放'
  }

  function scheduleNext() {
    if (!playing) {
      return
    }

    timer = window.setTimeout(() => {
      timer = null

      if (!playing || index >= steps.length - 1) {
        stopPlaying()
        return
      }

      index += 1
      render()
      scheduleNext()
    }, 1200)
  }

  function render() {
    const step = steps[index]

    root.querySelector('[data-role="round"]').textContent = step.round === 0 ? '准备' : (step.round === 4 ? '检测轮' : '第 ' + step.round + ' 轮')
    root.querySelector('[data-role="edge"]').textContent = step.edge
    root.querySelector('[data-role="candidate"]').textContent = step.candidate
    root.querySelector('[data-role="result"]').textContent = step.result
    root.querySelector('[data-role="note"]').textContent = step.note
    root.querySelector('[data-role="step"]').textContent = String(index + 1) + ' / ' + String(steps.length)

    roundItems.forEach((item) => {
      const itemRound = Number(item.dataset.round)
      item.classList.toggle('is-active', itemRound === step.round)
      item.classList.toggle('is-done', step.round > itemRound)
      item.classList.toggle('is-detection', itemRound === 4)
    })

    nodes.forEach((nodeElement) => {
      const node = Number(nodeElement.dataset.node)
      const reachable = Number.isFinite(step.distances[node - 1])
      nodeElement.classList.toggle('is-reachable', reachable)
      nodeElement.classList.toggle('is-source', node === step.source)
      nodeElement.classList.toggle('is-target', node === step.target)
      nodeElement.classList.toggle('is-changed', node === step.changed)
      nodeElement.setAttribute('aria-label', '节点 ' + node + '，当前距离 ' + formatDistance(step.distances[node - 1]))
    })

    edges.forEach((edgeElement) => {
      const active = edgeElement.dataset.edge === step.edgeKey
      edgeElement.classList.toggle('is-checking', active)
      edgeElement.classList.toggle('is-updated', active && step.edgeState === 'updated')
      edgeElement.classList.toggle('is-rejected', active && step.edgeState === 'rejected')
      edgeElement.classList.toggle('is-skipped', active && step.edgeState === 'skipped')
    })

    scanItems.forEach((item, itemIndex) => {
      item.classList.toggle('is-active', itemIndex === step.scan)
      item.classList.toggle('is-done', itemIndex <= step.scanDone)
    })

    startCells.forEach((cell, cellIndex) => {
      cell.textContent = formatDistance(step.start[cellIndex])
    })

    distCells.forEach((cell, cellIndex) => {
      cell.textContent = formatDistance(step.distances[cellIndex])
      cell.classList.toggle('is-changed', step.changed === cellIndex + 1)
    })

    root.classList.toggle('is-detecting', step.round === 4)
    root.classList.toggle('is-finished', index === steps.length - 1)
    root.querySelector('[data-action="prev"]').disabled = index === 0
    root.querySelector('[data-action="next"]').disabled = index === steps.length - 1
  }

  root.querySelector('[data-action="prev"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.max(0, index - 1)
    render()
  })

  root.querySelector('[data-action="next"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.min(steps.length - 1, index + 1)
    render()
  })

  root.querySelector('[data-action="play"]').addEventListener('click', () => {
    if (playing) {
      stopPlaying()
      return
    }

    if (index >= steps.length - 1) {
      index = 0
      render()
    }

    playing = true
    root.querySelector('[data-action="play"]').textContent = '暂停'
    scheduleNext()
  })

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    stopPlaying()
    index = 0
    render()
  })

  render()
})()
</script>

~~~python
def bellman_ford(
    node_count: int,
    edges: list[tuple[int, int, int]],
    start: int,
) -> list[float]:
    infinity = float('inf')
    distance = [infinity] * node_count
    distance[start] = 0

    for _ in range(node_count - 1):
        changed = False

        for source, target, cost in edges:
            if distance[source] == infinity:
                continue

            candidate = distance[source] + cost

            if candidate < distance[target]:
                distance[target] = candidate
                changed = True

        if not changed:
            break

    return distance
~~~

一条最短简单路径最多包含 $V-1$ 条边，因此最多扫描 $V-1$ 轮。

如果再扫描一轮仍能更新距离，说明存在从起点可达的负权环。限制“最多经过 K 站”的题需要每轮读取上一轮距离副本，避免同一轮使用超过限制的边数。

### 7.3 Floyd-Warshall：枚举允许经过的中间节点

Floyd-Warshall 的关键不是“从哪个节点出发”，而是逐步扩大**允许作为中间点的节点集合**。处理节点 `k` 时，对每一对 `i、j` 都比较：直接使用当前的 `distance[i][j]`，还是改走 `i → k → j` 更短。

<div class="algo-demo floyd-warshall-demo" id="floyd-warshall-demo">
  <div class="algo-demo-title">
    <strong>Floyd–Warshall 中间点扩展</strong>
    <span>图上的绕行路径与距离矩阵同步变化</span>
  </div>
  <div class="fw-status" aria-live="polite">
    <div><span>允许中间点</span><strong data-role="middle"></strong></div>
    <div><span>正在计算</span><strong data-role="pair"></strong></div>
    <div><span>候选距离</span><strong data-role="candidate"></strong></div>
    <div><span>结果</span><strong data-role="result"></strong></div>
  </div>
  <div class="fw-phases" aria-label="中间点处理进度"><span data-phase="0">初始化</span><span data-phase="1">k = 1</span><span data-phase="2">k = 2</span><span data-phase="3">k = 3</span><span data-phase="4">k = 4</span><span data-phase="5">完成</span></div>
  <div class="fw-workspace">
    <div class="fw-graph-wrap">
      <svg class="fw-graph" viewBox="0 0 370 245" role="img" aria-label="四节点有向带权图，当前绕行路径会被高亮">
        <defs><marker id="fw-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M 0 0 L 9 4.5 L 0 9 z" fill="context-stroke"></path></marker></defs>
        <g class="fw-edge" data-edge="1-2"><path d="M 103 53 L 255 53" marker-end="url(#fw-arrow)"></path><rect x="166" y="39" width="28" height="21" rx="3"></rect><text x="180" y="54">3</text></g>
        <g class="fw-edge" data-edge="2-3"><path d="M 280 78 L 280 166" marker-end="url(#fw-arrow)"></path><rect x="287" y="111" width="28" height="21" rx="3"></rect><text x="301" y="126">1</text></g>
        <g class="fw-edge" data-edge="3-4"><path d="M 255 191 L 103 191" marker-end="url(#fw-arrow)"></path><rect x="166" y="178" width="28" height="21" rx="3"></rect><text x="180" y="193">2</text></g>
        <g class="fw-edge" data-edge="1-4"><path d="M 80 78 L 80 166" marker-end="url(#fw-arrow)"></path><rect x="43" y="111" width="34" height="21" rx="3"></rect><text x="60" y="126">10</text></g>
        <g class="fw-edge" data-edge="4-2"><path d="M 101 176 Q 175 113 260 69" marker-end="url(#fw-arrow)"></path><rect x="164" y="111" width="34" height="21" rx="3"></rect><text x="181" y="126">-1</text></g>
        <g class="fw-node" data-node="1" transform="translate(80 53)"><circle r="25"></circle><text text-anchor="middle" dominant-baseline="central">1</text></g>
        <g class="fw-node" data-node="2" transform="translate(280 53)"><circle r="25"></circle><text text-anchor="middle" dominant-baseline="central">2</text></g>
        <g class="fw-node" data-node="3" transform="translate(280 191)"><circle r="25"></circle><text text-anchor="middle" dominant-baseline="central">3</text></g>
        <g class="fw-node" data-node="4" transform="translate(80 191)"><circle r="25"></circle><text text-anchor="middle" dominant-baseline="central">4</text></g>
      </svg>
      <div class="fw-graph-legend" aria-label="图中节点角色"><span><i class="source"></i>起点 i</span><span><i class="middle"></i>中间点 k</span><span><i class="target"></i>终点 j</span></div>
    </div>
    <div class="fw-matrix-wrap">
      <div class="fw-matrix-title"><code>distance[i][j]</code><span>行是起点 i，列是终点 j</span></div>
      <table class="fw-matrix" aria-label="当前所有节点对最短距离矩阵"><thead><tr><th scope="col">i\j</th><th scope="col" data-col="1">1</th><th scope="col" data-col="2">2</th><th scope="col" data-col="3">3</th><th scope="col" data-col="4">4</th></tr></thead><tbody data-role="matrix-body"></tbody></table>
      <div class="fw-matrix-legend" aria-label="矩阵高亮含义"><span><i class="left"></i><code>d[i][k]</code></span><span><i class="right"></i><code>d[k][j]</code></span><span><i class="target"></i><code>d[i][j]</code></span></div>
    </div>
  </div>
  <div class="algo-note" data-role="note" aria-live="polite"></div>
  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button><button type="button" data-action="next">下一步</button><button type="button" data-action="play">播放</button><button type="button" data-action="reset">重置</button><span class="algo-step" data-role="step"></span>
  </div>
</div>

<script>
(() => {
  const root = document.getElementById('floyd-warshall-demo')

  if (!root || root.dataset.ready === 'true') {
    return
  }

  root.dataset.ready = 'true'

  const inf = Infinity
  const initial = [
    [0, 3, inf, 10],
    [inf, 0, 1, inf],
    [inf, inf, 0, 2],
    [inf, -1, inf, 0]
  ]
  const afterTwoFirst = [
    [0, 3, 4, 10],
    [inf, 0, 1, inf],
    [inf, inf, 0, 2],
    [inf, -1, inf, 0]
  ]
  const afterTwo = [
    [0, 3, 4, 10],
    [inf, 0, 1, inf],
    [inf, inf, 0, 2],
    [inf, -1, 0, 0]
  ]
  const afterThreeFirst = [
    [0, 3, 4, 6],
    [inf, 0, 1, inf],
    [inf, inf, 0, 2],
    [inf, -1, 0, 0]
  ]
  const afterThree = [
    [0, 3, 4, 6],
    [inf, 0, 1, 3],
    [inf, inf, 0, 2],
    [inf, -1, 0, 0]
  ]
  const finalMatrix = [
    [0, 3, 4, 6],
    [inf, 0, 1, 3],
    [inf, 1, 0, 2],
    [inf, -1, 0, 0]
  ]

  const steps = [
    { phase: 0, middle: null, source: null, target: null, candidate: '—', result: '写入直连边', matrix: initial, changed: null, path: [], state: null, note: '初始化：对角线为 0，直连边写入边权，没有直接路径的位置记为 ∞。' },
    { phase: 1, middle: 1, source: null, target: null, candidate: '检查所有 i、j', result: '没有距离变短', matrix: initial, changed: null, path: [], state: null, note: '只允许节点 1 作为中间点。没有任何一对节点通过 1 绕行后更短，矩阵保持不变。' },
    { phase: 2, middle: 2, source: 1, target: 3, candidate: '3 + 1 = 4', result: '∞ → 4', matrix: afterTwoFirst, changed: [1, 3], path: ['1-2', '2-3'], state: 'updated', note: '允许经过节点 2 后，路径 1 → 2 → 3 首次连通，更新 distance[1][3] = 4。' },
    { phase: 2, middle: 2, source: 4, target: 3, candidate: '-1 + 1 = 0', result: '∞ → 0', matrix: afterTwo, changed: [4, 3], path: ['4-2', '2-3'], state: 'updated', note: '路径 4 → 2 → 3 的总代价为 0，更新 distance[4][3]。' },
    { phase: 2, middle: 2, source: null, target: null, candidate: '全部 i、j 已比较', result: 'k = 2 完成', matrix: afterTwo, changed: null, path: [], state: null, note: '处理完节点 2 后，矩阵表示：只允许节点 1、2 作为中间点时的最短距离。' },
    { phase: 3, middle: 3, source: 1, target: 4, candidate: '4 + 2 = 6', result: '10 → 6', matrix: afterThreeFirst, changed: [1, 4], path: ['1-2', '2-3', '3-4'], state: 'updated', note: '原来的直连边 1 → 4 代价为 10；改走 1 → 2 → 3 → 4 只需 6，因此更新。' },
    { phase: 3, middle: 3, source: 2, target: 4, candidate: '1 + 2 = 3', result: '∞ → 3', matrix: afterThree, changed: [2, 4], path: ['2-3', '3-4'], state: 'updated', note: '经过节点 3，节点 2 到节点 4 首次连通，distance[2][4] = 3。' },
    { phase: 3, middle: 3, source: 4, target: 4, candidate: '0 + 2 = 2', result: '2 不小于 0', matrix: afterThree, changed: null, path: ['4-2', '2-3', '3-4'], state: 'rejected', note: '绕一圈 4 → 2 → 3 → 4 的代价为 2，比留在原地的 0 更大，所以不更新对角线。' },
    { phase: 3, middle: 3, source: null, target: null, candidate: '全部 i、j 已比较', result: 'k = 3 完成', matrix: afterThree, changed: null, path: [], state: null, note: '节点 3 处理完成。已经算出的 distance[i][3] 和 distance[3][j] 会成为后续阶段的新路径片段。' },
    { phase: 4, middle: 4, source: 3, target: 2, candidate: '2 + (-1) = 1', result: '∞ → 1', matrix: finalMatrix, changed: [3, 2], path: ['3-4', '4-2'], state: 'updated', note: '允许经过节点 4 后，路径 3 → 4 → 2 的代价为 1，更新 distance[3][2]。' },
    { phase: 4, middle: 4, source: null, target: null, candidate: '全部 i、j 已比较', result: 'k = 4 完成', matrix: finalMatrix, changed: null, path: [], state: null, note: '最后一个中间点处理完成。此时所有节点都允许作为中间点，矩阵就是最终的两两最短距离。' },
    { phase: 5, middle: null, source: null, target: null, candidate: '4 × 4 个节点对', result: '所有最短距离完成', matrix: finalMatrix, changed: null, path: [], state: null, note: '最终矩阵可以直接回答任意起点 i 到任意终点 j 的最短距离；∞ 表示仍然不可达。' }
  ]

  const matrixBody = root.querySelector('[data-role="matrix-body"]')
  const cells = []

  for (let row = 1; row <= 4; row += 1) {
    const tableRow = document.createElement('tr')
    const header = document.createElement('th')
    header.scope = 'row'
    header.dataset.row = String(row)
    header.textContent = String(row)
    tableRow.appendChild(header)

    for (let col = 1; col <= 4; col += 1) {
      const cell = document.createElement('td')
      cell.dataset.row = String(row)
      cell.dataset.col = String(col)
      tableRow.appendChild(cell)
      cells.push(cell)
    }

    matrixBody.appendChild(tableRow)
  }

  const nodes = Array.from(root.querySelectorAll('.fw-node'))
  const edges = Array.from(root.querySelectorAll('.fw-edge'))
  const phases = Array.from(root.querySelectorAll('.fw-phases span'))
  const rowHeaders = Array.from(root.querySelectorAll('.fw-matrix tbody th'))
  const colHeaders = Array.from(root.querySelectorAll('.fw-matrix thead th[data-col]'))
  let index = 0
  let timer = null
  let playing = false

  function formatDistance(value) {
    return Number.isFinite(value) ? String(value) : '∞'
  }

  function stopPlaying() {
    playing = false

    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }

    root.querySelector('[data-action="play"]').textContent = '播放'
  }

  function scheduleNext() {
    if (!playing) {
      return
    }

    timer = window.setTimeout(() => {
      timer = null

      if (!playing || index >= steps.length - 1) {
        stopPlaying()
        return
      }

      index += 1
      render()
      scheduleNext()
    }, 1250)
  }

  function render() {
    const step = steps[index]
    const hasPair = step.source !== null && step.target !== null

    root.querySelector('[data-role="middle"]').textContent = step.middle === null ? (step.phase === 5 ? '全部节点' : '尚未开放') : 'k = ' + step.middle
    root.querySelector('[data-role="pair"]').textContent = hasPair ? 'd[' + step.source + '][' + step.target + ']' : '全部节点对'
    root.querySelector('[data-role="candidate"]').textContent = step.candidate
    root.querySelector('[data-role="result"]').textContent = step.result
    root.querySelector('[data-role="note"]').textContent = step.note
    root.querySelector('[data-role="step"]').textContent = String(index + 1) + ' / ' + String(steps.length)

    phases.forEach((phaseElement) => {
      const phase = Number(phaseElement.dataset.phase)
      phaseElement.classList.toggle('is-active', phase === step.phase)
      phaseElement.classList.toggle('is-done', phase < step.phase)
    })

    nodes.forEach((nodeElement) => {
      const node = Number(nodeElement.dataset.node)
      nodeElement.classList.toggle('is-source', node === step.source)
      nodeElement.classList.toggle('is-middle', node === step.middle)
      nodeElement.classList.toggle('is-target', node === step.target)
    })

    edges.forEach((edgeElement) => {
      const active = step.path.includes(edgeElement.dataset.edge)
      edgeElement.classList.toggle('is-active', active)
      edgeElement.classList.toggle('is-updated', active && step.state === 'updated')
      edgeElement.classList.toggle('is-rejected', active && step.state === 'rejected')
    })

    rowHeaders.forEach((header) => {
      header.classList.toggle('is-middle', Number(header.dataset.row) === step.middle)
    })

    colHeaders.forEach((header) => {
      header.classList.toggle('is-middle', Number(header.dataset.col) === step.middle)
    })

    cells.forEach((cell) => {
      const row = Number(cell.dataset.row)
      const col = Number(cell.dataset.col)
      const isLeft = hasPair && row === step.source && col === step.middle
      const isRight = hasPair && row === step.middle && col === step.target
      const isTarget = hasPair && row === step.source && col === step.target
      const isChanged = step.changed !== null && row === step.changed[0] && col === step.changed[1]

      cell.textContent = formatDistance(step.matrix[row - 1][col - 1])
      cell.classList.toggle('is-left', isLeft)
      cell.classList.toggle('is-right', isRight)
      cell.classList.toggle('is-target', isTarget)
      cell.classList.toggle('is-changed', isChanged)
      cell.setAttribute('aria-label', '从节点 ' + row + ' 到节点 ' + col + ' 的距离为 ' + formatDistance(step.matrix[row - 1][col - 1]))
    })

    root.classList.toggle('is-finished', step.phase === 5)
    root.querySelector('[data-action="prev"]').disabled = index === 0
    root.querySelector('[data-action="next"]').disabled = index === steps.length - 1
  }

  root.querySelector('[data-action="prev"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.max(0, index - 1)
    render()
  })

  root.querySelector('[data-action="next"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.min(steps.length - 1, index + 1)
    render()
  })

  root.querySelector('[data-action="play"]').addEventListener('click', () => {
    if (playing) {
      stopPlaying()
      return
    }

    if (index >= steps.length - 1) {
      index = 0
      render()
    }

    playing = true
    root.querySelector('[data-action="play"]').textContent = '暂停'
    scheduleNext()
  })

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    stopPlaying()
    index = 0
    render()
  })

  render()
})()
</script>

~~~python
def floyd_warshall(
    node_count: int,
    edges: list[tuple[int, int, int]],
) -> list[list[float]]:
    infinity = float('inf')
    distance = [
        [infinity] * node_count
        for _ in range(node_count)
    ]

    for node in range(node_count):
        distance[node][node] = 0

    for source, target, cost in edges:
        distance[source][target] = min(
            distance[source][target],
            cost,
        )

    for middle in range(node_count):
        for source in range(node_count):
            if distance[source][middle] == infinity:
                continue

            for target in range(node_count):
                candidate = (
                    distance[source][middle]
                    + distance[middle][target]
                )

                if candidate < distance[source][target]:
                    distance[source][target] = candidate

    return distance
~~~

状态含义：

~~~text
处理 middle 以后，
distance[source][target]
表示允许经过 0...middle 作为中间节点时的最短距离。
~~~

无向图要同时写入两个方向。Floyd-Warshall 适合节点数较小、需要查询很多对节点距离的场景。

<span id="a-star" class="algorithm-section-anchor"></span>

### 7.4 A*：用启发函数朝目标方向搜索

A* 适合**已知起点和终点、只需要求这一对节点最短路**的场景，尤其常见于网格寻路。它可以看作带有方向感的 Dijkstra：

~~~text
g(n)：起点到当前节点 n 的真实代价
h(n)：从 n 到终点的估计代价
f(n) = g(n) + h(n)：小根堆中的优先级
~~~

Dijkstra 只比较已经走过的 `g`；A* 再加入 `h`，让搜索更愿意向目标方向推进。把 `h(n)` 全部设为 0，A* 就退化成 Dijkstra。

启发函数不能随便估计。要保证求出的路径仍然最短，`h(n)` 必须**不高估**从 `n` 到终点的真实最小代价；常见网格可以这样选择：

| 移动方式 | 单步代价 | 常用启发函数 |
|---|---:|---|
| 只能上下左右 | 1 | 曼哈顿距离 `abs(r-tr) + abs(c-tc)` |
| 可以向八个方向移动 | 1 | 切比雪夫距离 `max(abs(r-tr), abs(c-tc))` |
| 可以任意角度移动 | 欧氏距离 | 欧氏距离 |

先记住三句话：**更新距离时比较 `g`；决定先搜索谁时比较 `f = g + h`；`parent` 只用来恢复最终路径。**下面的 A* 和 Dijkstra 使用同一张网格，可以直接对比启发函数如何减少与终点方向无关的搜索。

<div class="algo-demo astar-demo" id="astar-grid-demo">
  <div class="algo-demo-title"><strong>A* 网格寻路</strong><span>每次弹出小根堆中优先级最小的格子</span></div>
  <div class="astar-mode-switch" aria-label="选择寻路算法">
    <button type="button" data-algorithm="astar" aria-pressed="true">A* · h = 曼哈顿距离 <strong data-role="astar-total"></strong></button>
    <button type="button" data-algorithm="dijkstra" aria-pressed="false">Dijkstra · h = 0 <strong data-role="dijkstra-total"></strong></button>
    <span>两者最短路都是 <b data-role="shared-length"></b> 步</span>
  </div>
  <div class="astar-status" aria-live="polite">
    <div><span>当前弹出</span><strong data-role="current"></strong></div>
    <div><span>当前优先级</span><strong data-role="scores"></strong></div>
    <div><span>已扩展</span><strong data-role="expanded"></strong></div>
    <div><span>路径长度</span><strong data-role="path-length"></strong></div>
  </div>
  <div class="astar-workspace">
    <div class="astar-board-wrap">
      <div class="astar-board" data-role="board" role="grid" aria-label="5 行 7 列网格，S 为起点，G 为终点，黑色格为障碍"></div>
      <div class="astar-legend" aria-label="图例"><span><i class="open"></i>开放集合</span><span><i class="closed"></i>已扩展</span><span><i class="current"></i>当前格</span><span><i class="path"></i>最短路</span></div>
    </div>
    <div class="astar-panel">
      <div class="astar-panel-title"><strong>开放集合（小根堆）</strong><span>左上角优先弹出</span></div>
      <div class="astar-heap" data-role="heap" aria-live="polite"></div>
      <div class="astar-rule">
        <code>更新邻居：next_g &lt; old_g</code>
        <code>入堆优先级：f = g + h</code>
        <code>f 相同：h 更小（g 更大）先出堆</code>
        <code>回溯路径：parent[child] = current</code>
      </div>
    </div>
  </div>
  <div class="algo-note" data-role="note" aria-live="polite"></div>
  <div class="algo-controls"><button type="button" data-action="prev">上一步</button><button type="button" data-action="next">下一步</button><button type="button" data-action="play">播放</button><button type="button" data-action="reset">重置</button><span class="algo-step" data-role="step"></span></div>
</div>

<script>
(() => {
  const root = document.getElementById('astar-grid-demo')

  if (!root || root.dataset.ready === 'true') {
    return
  }

  root.dataset.ready = 'true'

  const grid = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0]
  ]
  const start = [0, 0]
  const goal = [2, 6]
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  const rows = grid.length
  const cols = grid[0].length

  function cellKey(row, col) {
    return row + ',' + col
  }

  function heuristic(row, col, useHeuristic) {
    if (!useHeuristic) {
      return 0
    }

    return Math.abs(row - goal[0]) + Math.abs(col - goal[1])
  }

  function compareEntries(left, right) {
    return left.f - right.f || left.h - right.h || left.g - right.g || left.row - right.row || left.col - right.col
  }

  function copyScores(scores) {
    return scores.map((row) => row.slice())
  }

  function buildPath(parents) {
    const path = [cellKey(goal[0], goal[1])]
    let current = cellKey(goal[0], goal[1])
    const startKey = cellKey(start[0], start[1])

    while (current !== startKey) {
      current = parents[current]

      if (!current) {
        return []
      }

      path.push(current)
    }

    path.reverse()
    return path
  }

  function buildRun(useHeuristic) {
    const scores = Array.from({ length: rows }, () => Array(cols).fill(Infinity))
    const parents = {}
    const closed = new Set()
    const heap = []
    const states = []
    const startH = heuristic(start[0], start[1], useHeuristic)
    scores[start[0]][start[1]] = 0
    heap.push({ f: startH, h: startH, g: 0, row: start[0], col: start[1] })

    function takeSnapshot(current, relaxed, note, path) {
      const open = heap
        .filter((entry) => entry.g === scores[entry.row][entry.col] && !closed.has(cellKey(entry.row, entry.col)))
        .slice()
        .sort(compareEntries)

      states.push({
        current,
        relaxed: relaxed.slice(),
        scores: copyScores(scores),
        parents: Object.assign({}, parents),
        closed: Array.from(closed),
        open,
        note,
        path: path.slice()
      })
    }

    const initialNote = useHeuristic
      ? '先把起点 S 放入开放集合。此时 g = 0，h = 8，所以 A* 的优先级 f = 8。'
      : '先把起点 S 放入开放集合。Dijkstra 令 h = 0，所以堆中的优先级 f 就等于 g。'
    takeSnapshot(null, [], initialNote, [])

    while (heap.length > 0) {
      heap.sort(compareEntries)
      const current = heap.shift()
      const currentKey = cellKey(current.row, current.col)

      if (current.g !== scores[current.row][current.col] || closed.has(currentKey)) {
        continue
      }

      closed.add(currentKey)

      if (current.row === goal[0] && current.col === goal[1]) {
        const path = buildPath(parents)
        takeSnapshot(current, [], '终点 G 从堆顶弹出，它的 g 已经确定为最短距离。现在沿 parent 从 G 反向回溯到 S，得到绿色最短路。', path)
        return { states, expanded: closed.size, pathLength: path.length - 1 }
      }

      const relaxed = []

      directions.forEach((direction) => {
        const nextRow = current.row + direction[0]
        const nextCol = current.col + direction[1]

        if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols || grid[nextRow][nextCol] === 1) {
          return
        }

        const nextG = current.g + 1

        if (nextG >= scores[nextRow][nextCol]) {
          return
        }

        scores[nextRow][nextCol] = nextG
        parents[cellKey(nextRow, nextCol)] = currentKey
        const nextH = heuristic(nextRow, nextCol, useHeuristic)
        heap.push({ f: nextG + nextH, h: nextH, g: nextG, row: nextRow, col: nextCol })
        relaxed.push(cellKey(nextRow, nextCol))
      })

      const scoreText = 'g=' + current.g + '，h=' + heuristic(current.row, current.col, useHeuristic) + '，f=' + current.f
      const relaxText = relaxed.length > 0
        ? '用 current_g + 1 更新了 ' + relaxed.length + ' 个邻居，并记录它们的 parent。'
        : '没有邻居获得更小的 g，因此不更新。'
      const modeText = useHeuristic
        ? 'A* 使用 h 把优先级拉向终点。'
        : 'Dijkstra 的 h 恒为 0，因此只按 g 向四周扩散。'
      takeSnapshot(current, relaxed, '弹出 (' + current.row + ', ' + current.col + ')：' + scoreText + '。' + relaxText + modeText, [])
    }

    return { states, expanded: closed.size, pathLength: -1 }
  }

  const runs = {
    astar: buildRun(true),
    dijkstra: buildRun(false)
  }
  const board = root.querySelector('[data-role="board"]')
  const heapElement = root.querySelector('[data-role="heap"]')
  let algorithm = 'astar'
  let index = 0
  let timer = null

  root.querySelector('[data-role="astar-total"]').textContent = '扩展 ' + runs.astar.expanded + ' 格'
  root.querySelector('[data-role="dijkstra-total"]').textContent = '扩展 ' + runs.dijkstra.expanded + ' 格'
  root.querySelector('[data-role="shared-length"]').textContent = runs.astar.pathLength

  function parentArrow(row, col, parents) {
    const parent = parents[cellKey(row, col)]

    if (!parent) {
      return ''
    }

    const parts = parent.split(',').map(Number)

    if (parts[0] < row) return '↑'
    if (parts[0] > row) return '↓'
    if (parts[1] < col) return '←'
    return '→'
  }

  function renderBoard(state) {
    const openKeys = new Set(state.open.map((entry) => cellKey(entry.row, entry.col)))
    const closedKeys = new Set(state.closed)
    const relaxedKeys = new Set(state.relaxed)
    const pathKeys = new Set(state.path)
    const currentKey = state.current ? cellKey(state.current.row, state.current.col) : ''
    let html = ''

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const key = cellKey(row, col)

        if (grid[row][col] === 1) {
          html += '<div class="astar-cell is-wall" role="gridcell" aria-label="障碍物 (' + row + ', ' + col + ')"><strong>墙</strong></div>'
          continue
        }

        const classes = ['astar-cell']
        if (openKeys.has(key)) classes.push('is-open')
        if (closedKeys.has(key)) classes.push('is-closed')
        if (relaxedKeys.has(key)) classes.push('is-relaxed')
        if (key === currentKey) classes.push('is-current')
        if (pathKeys.has(key)) classes.push('is-path')

        const g = state.scores[row][col]
        const h = heuristic(row, col, algorithm === 'astar')
        const marker = row === start[0] && col === start[1]
          ? 'S'
          : row === goal[0] && col === goal[1]
            ? 'G'
            : ''
        const values = Number.isFinite(g)
          ? '<span><b>g' + g + '</b><small>h' + h + ' · f' + (g + h) + '</small></span>'
          : '<span class="astar-unseen">·</span>'
        const arrow = parentArrow(row, col, state.parents)
        const label = (marker ? marker + '，' : '') + '坐标 (' + row + ', ' + col + ')，' + (Number.isFinite(g) ? 'g ' + g + '，h ' + h + '，f ' + (g + h) : '尚未发现')
        html += '<div class="' + classes.join(' ') + '" role="gridcell" aria-label="' + label + '"><em>' + marker + '</em>' + values + (arrow ? '<i aria-hidden="true">' + arrow + '</i>' : '') + '</div>'
      }
    }

    board.innerHTML = html
  }

  function renderHeap(state) {
    if (state.open.length === 0) {
      heapElement.innerHTML = '<span class="astar-heap-empty">开放集合已空</span>'
      return
    }

    const visible = state.open.slice(0, 6)
    let html = visible.map((entry, position) => {
      const className = position === 0 ? ' class="is-top"' : ''
      return '<code' + className + '><b>(' + entry.row + ', ' + entry.col + ')</b><span>f ' + entry.f + ' = g ' + entry.g + ' + h ' + entry.h + '</span></code>'
    }).join('')

    if (state.open.length > visible.length) {
      html += '<span class="astar-heap-more">还有 ' + (state.open.length - visible.length) + ' 个候选格</span>'
    }

    heapElement.innerHTML = html
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer)
      timer = null
    }

    root.querySelector('[data-action="play"]').textContent = '播放'
  }

  function render() {
    const run = runs[algorithm]
    const state = run.states[index]
    const current = state.current
    const currentH = current ? heuristic(current.row, current.col, algorithm === 'astar') : null
    root.classList.toggle('is-finished', state.path.length > 0)
    root.querySelector('[data-role="current"]').textContent = current ? '(' + current.row + ', ' + current.col + ')' : '—'
    root.querySelector('[data-role="scores"]').textContent = current ? 'g ' + current.g + ' · h ' + currentH + ' · f ' + current.f : '—'
    root.querySelector('[data-role="expanded"]').textContent = state.closed.length + ' / ' + run.expanded + ' 格'
    root.querySelector('[data-role="path-length"]').textContent = state.path.length > 0 ? run.pathLength + ' 步' : '待回溯'
    root.querySelector('[data-role="note"]').textContent = state.note
    root.querySelector('[data-role="step"]').textContent = '第 ' + (index + 1) + ' / ' + run.states.length + ' 步'
    root.querySelector('[data-action="prev"]').disabled = index === 0
    root.querySelector('[data-action="next"]').disabled = index === run.states.length - 1
    renderBoard(state)
    renderHeap(state)
  }

  function chooseAlgorithm(nextAlgorithm) {
    stop()
    algorithm = nextAlgorithm
    index = 0
    root.querySelectorAll('[data-algorithm]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.algorithm === algorithm))
    })
    render()
  }

  root.querySelectorAll('[data-algorithm]').forEach((button) => {
    button.addEventListener('click', () => chooseAlgorithm(button.dataset.algorithm))
  })

  root.querySelector('[data-action="prev"]').addEventListener('click', () => {
    stop()
    index = Math.max(0, index - 1)
    render()
  })

  root.querySelector('[data-action="next"]').addEventListener('click', () => {
    stop()
    index = Math.min(runs[algorithm].states.length - 1, index + 1)
    render()
  })

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    stop()
    index = 0
    render()
  })

  root.querySelector('[data-action="play"]').addEventListener('click', () => {
    if (timer) {
      stop()
      return
    }

    if (index === runs[algorithm].states.length - 1) {
      index = 0
      render()
    }

    root.querySelector('[data-action="play"]').textContent = '暂停'
    timer = window.setInterval(() => {
      if (index >= runs[algorithm].states.length - 1) {
        stop()
        return
      }

      index += 1
      render()
    }, 720)
  })

  render()
})()
</script>

#### 为什么 goal 第一次出堆就是最短路

这里说的是**第一次从小根堆弹出 goal**，不是第一次发现 goal 或把 goal 放入堆。

假设出堆的 goal 路径代价为 $C$，但还存在一条代价为 $C^*$ 的更短路径，其中 $C^* < C$。在这条更短路径上，必然有一个已入堆但尚未扩展的节点 `x`。因为启发函数不高估：

~~~text
f(x) = g(x) + h(x) <= C* < C
f(goal) = g(goal) + h(goal) = C + 0 = C
~~~

小根堆必须先弹出 `f(x)` 更小的 `x`，不可能先弹出 goal，与假设矛盾。因此，在**边权非负、`h` 不高估、正确松弛并跳过堆中旧状态**的前提下，goal 第一次出堆时就可以结束。四方向网格的曼哈顿距离满足这个条件。

#### `f` 相同时如何打破平局

只要始终先比较 `f`，平局规则不会改变最短路的正确性，但会影响实际扩展的节点数。

| 堆元素 | `f` 相同时优先 | 搜索倾向 |
|---|---|---|
| `(f, g, row, col)` | 较小的 `g` | 更靠近起点，容易横向展开 |
| `(f, -g, row, col)` | 较大的 `g` | 更靠近终点，通常扩展更少 |
| `(f, h, g, row, col)` | 较小的 `h` | 等价于较大的 `g`，且保留正数 `g` |

固定 `f` 时，`g` 越大就意味着 `h = f - g` 越小。因此下面代码使用 `(f, h, g, row, col)`：先保证 `f` 最小，再优先更接近 goal 的节点；`row、col` 只用来让完全平局时的顺序确定。

下面是四方向网格的完整写法。`0` 表示可通行，`1` 表示障碍物，返回值是从起点到终点的路径：

~~~python
import heapq


def astar_grid_path(
    grid: list[list[int]],
    start: tuple[int, int],
    goal: tuple[int, int],
) -> list[tuple[int, int]]:
    if not grid or not grid[0]:
        return []

    rows = len(grid)
    cols = len(grid[0])
    start_row, start_col = start
    goal_row, goal_col = goal

    def is_valid(row: int, col: int) -> bool:
        return (
            0 <= row < rows
            and 0 <= col < cols
            and grid[row][col] == 0
        )

    if not is_valid(start_row, start_col):
        return []

    if not is_valid(goal_row, goal_col):
        return []

    def heuristic(row: int, col: int) -> int:
        return (
            abs(row - goal_row)
            + abs(col - goal_col)
        )

    infinity = float('inf')
    g_score = [
        [infinity] * cols
        for _ in range(rows)
    ]
    g_score[start_row][start_col] = 0

    # 堆元素：(f, h, g, row, col)
    # f 相同时优先 h 更小的节点，等价于优先 g 更大。
    start_h = heuristic(start_row, start_col)
    heap = [
        (
            start_h,
            start_h,
            0,
            start_row,
            start_col,
        )
    ]
    parent: dict[
        tuple[int, int],
        tuple[int, int],
    ] = {}
    directions = ((-1, 0), (1, 0), (0, -1), (0, 1))

    while heap:
        _, _, current_g, row, col = heapq.heappop(heap)

        if current_g != g_score[row][col]:
            continue

        if (row, col) == goal:
            path = []
            current = goal

            while current != start:
                path.append(current)
                current = parent[current]

            path.append(start)
            path.reverse()
            return path

        for row_step, col_step in directions:
            next_row = row + row_step
            next_col = col + col_step

            if not is_valid(next_row, next_col):
                continue

            next_g = current_g + 1

            if next_g >= g_score[next_row][next_col]:
                continue

            g_score[next_row][next_col] = next_g
            parent[(next_row, next_col)] = (row, col)
            next_h = heuristic(next_row, next_col)
            next_f = next_g + next_h
            heapq.heappush(
                heap,
                (
                    next_f,
                    next_h,
                    next_g,
                    next_row,
                    next_col,
                ),
            )

    return []
~~~

[1091. 二进制矩阵中的最短路径](https://leetcode.cn/problems/shortest-path-in-binary-matrix/)允许八方向移动，可以把方向数组改成八个方向，并使用切比雪夫距离；这道题边权全部为 1，普通 BFS 已经足够，A* 的价值主要是减少面向单个终点时实际扩展的节点数。

A* 使用小根堆时，最坏时间复杂度仍可写作 $O(E\log V)$，空间复杂度为 $O(V)$。好的启发函数通常能显著减少搜索范围，但不会改善最坏复杂度；图中存在负权边时不能直接使用 A*。

## 8. 最小生成树：用最小总代价连接所有节点

最小生成树针对的是**连通无向带权图**：

~~~text
覆盖所有节点
只保留 V - 1 条边
不能形成环
边权总和最小
~~~

它和最短路不同：

- 最短路关注某个起点到其他节点的距离。
- 最小生成树关注连接整个图的总成本。

### 8.1 Kruskal：按边权从小到大选边

Kruskal 不关心当前生成树长在什么位置，而是从全图最便宜的边开始检查。下面的动画会同时展示排序后的边、当前连通分量，以及并查集为什么拒绝会成环的边。

<div class="algo-demo mst-demo kruskal-demo" id="kruskal-mst-demo">
  <div class="algo-demo-title"><strong>Kruskal：排序边 + 并查集</strong><span>选择便宜且连接两个不同分量的边</span></div>
  <div class="mst-status" aria-live="polite">
    <div><span>当前边</span><strong data-role="edge"></strong></div>
    <div><span>并查集判断</span><strong data-role="compare"></strong></div>
    <div><span>操作</span><strong data-role="action"></strong></div>
    <div><span>当前总代价</span><strong data-role="total"></strong></div>
  </div>
  <div class="mst-workspace">
    <div class="mst-graph-wrap">
      <svg class="mst-graph" viewBox="0 0 620 250" role="img" aria-label="六节点无向带权图，Kruskal 当前检查的边会被高亮">
        <g class="mst-edge" data-edge="1-2"><line x1="70" y1="125" x2="210" y2="45"></line><rect x="125" y="70" width="28" height="20" rx="3"></rect><text x="139" y="84">4</text></g>
        <g class="mst-edge" data-edge="1-3"><line x1="70" y1="125" x2="210" y2="205"></line><rect x="125" y="160" width="28" height="20" rx="3"></rect><text x="139" y="174">2</text></g>
        <g class="mst-edge" data-edge="2-3"><line x1="210" y1="45" x2="210" y2="205"></line><rect x="217" y="115" width="28" height="20" rx="3"></rect><text x="231" y="129">1</text></g>
        <g class="mst-edge" data-edge="2-4"><line x1="210" y1="45" x2="400" y2="45"></line><rect x="291" y="31" width="28" height="20" rx="3"></rect><text x="305" y="45">5</text></g>
        <g class="mst-edge" data-edge="3-4"><line x1="210" y1="205" x2="400" y2="45"></line><rect x="291" y="115" width="28" height="20" rx="3"></rect><text x="305" y="129">8</text></g>
        <g class="mst-edge" data-edge="3-5"><line x1="210" y1="205" x2="400" y2="205"></line><rect x="288" y="191" width="34" height="20" rx="3"></rect><text x="305" y="205">10</text></g>
        <g class="mst-edge" data-edge="4-5"><line x1="400" y1="45" x2="400" y2="205"></line><rect x="407" y="115" width="28" height="20" rx="3"></rect><text x="421" y="129">2</text></g>
        <g class="mst-edge" data-edge="4-6"><line x1="400" y1="45" x2="550" y2="125"></line><rect x="461" y="70" width="28" height="20" rx="3"></rect><text x="475" y="84">6</text></g>
        <g class="mst-edge" data-edge="5-6"><line x1="400" y1="205" x2="550" y2="125"></line><rect x="461" y="160" width="28" height="20" rx="3"></rect><text x="475" y="174">3</text></g>
        <g class="mst-node" data-node="1" transform="translate(70 125)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">1</text></g>
        <g class="mst-node" data-node="2" transform="translate(210 45)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">2</text></g>
        <g class="mst-node" data-node="3" transform="translate(210 205)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">3</text></g>
        <g class="mst-node" data-node="4" transform="translate(400 45)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">4</text></g>
        <g class="mst-node" data-node="5" transform="translate(400 205)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">5</text></g>
        <g class="mst-node" data-node="6" transform="translate(550 125)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">6</text></g>
      </svg>
      <div class="mst-legend" aria-label="图例"><span><i class="current"></i>正在检查</span><span><i class="selected"></i>已选入 MST</span><span><i class="rejected"></i>成环，跳过</span></div>
    </div>
    <div class="kr-panel">
      <div class="mst-panel-title"><strong>按权重升序</strong><span>相同权重顺序可交换</span></div>
      <ol class="kr-edge-order" aria-label="排序后的边">
        <li data-edge="2-3"><code>2—3</code><b>1</b></li><li data-edge="1-3"><code>1—3</code><b>2</b></li><li data-edge="4-5"><code>4—5</code><b>2</b></li><li data-edge="5-6"><code>5—6</code><b>3</b></li><li data-edge="1-2"><code>1—2</code><b>4</b></li><li data-edge="2-4"><code>2—4</code><b>5</b></li><li data-edge="4-6"><code>4—6</code><b>6</b></li><li data-edge="3-4"><code>3—4</code><b>8</b></li><li data-edge="3-5"><code>3—5</code><b>10</b></li>
      </ol>
      <div class="kr-components-title">并查集中的连通分量</div>
      <div class="kr-components" data-role="components" aria-live="polite"></div>
    </div>
  </div>
  <div class="algo-note" data-role="note" aria-live="polite"></div>
  <div class="algo-controls"><button type="button" data-action="prev">上一步</button><button type="button" data-action="next">下一步</button><button type="button" data-action="play">播放</button><button type="button" data-action="reset">重置</button><span class="algo-step" data-role="step"></span></div>
</div>

<script>
(() => {
  const root = document.getElementById('kruskal-mst-demo')

  if (!root || root.dataset.ready === 'true') {
    return
  }

  root.dataset.ready = 'true'

  const steps = [
    { edge: '—', compare: '尚未检查', action: '先将所有边排序', total: 0, current: null, currentState: null, examined: -1, selected: [], rejected: [], components: ['1', '2', '3', '4', '5', '6'], note: 'Kruskal 的第一步只做一件事：把所有边按权重从小到大排列。每个节点最初都是独立连通分量。' },
    { edge: '2—3，w = 1', compare: '2、3 属于不同分量', action: '选择并合并', total: 1, current: '2-3', currentState: 'selected', examined: 0, selected: ['2-3'], rejected: [], components: ['1', '2, 3', '4', '5', '6'], note: '最便宜的边连接两个不同分量，不会形成环；选入边 2—3，并执行 union(2, 3)。' },
    { edge: '1—3，w = 2', compare: '1 与 {2, 3} 不同', action: '选择并合并', total: 3, current: '1-3', currentState: 'selected', examined: 1, selected: ['2-3', '1-3'], rejected: [], components: ['1, 2, 3', '4', '5', '6'], note: '节点 1 与节点 3 所在分量不同，选择后得到连通分量 {1, 2, 3}。' },
    { edge: '4—5，w = 2', compare: '4、5 属于不同分量', action: '选择并合并', total: 5, current: '4-5', currentState: 'selected', examined: 2, selected: ['2-3', '1-3', '4-5'], rejected: [], components: ['1, 2, 3', '4, 5', '6'], note: '相同权重的边先后顺序可以交换。边 4—5 不会成环，因此也被选中。' },
    { edge: '5—6，w = 3', compare: '{4, 5} 与 6 不同', action: '选择并合并', total: 8, current: '5-6', currentState: 'selected', examined: 3, selected: ['2-3', '1-3', '4-5', '5-6'], rejected: [], components: ['1, 2, 3', '4, 5, 6'], note: '选择边 5—6 后，右侧形成分量 {4, 5, 6}；现在全图还剩两个连通分量。' },
    { edge: '1—2，w = 4', compare: '1、2 已在同一分量', action: '跳过：否则形成环', total: 8, current: '1-2', currentState: 'rejected', examined: 4, selected: ['2-3', '1-3', '4-5', '5-6'], rejected: ['1-2'], components: ['1, 2, 3', '4, 5, 6'], note: '1 与 2 已经通过 1—3—2 连通。再加入 1—2 会形成环，所以并查集返回 False。' },
    { edge: '2—4，w = 5', compare: '两个大分量不同', action: '选择；MST 已完成', total: 13, current: '2-4', currentState: 'selected', examined: 5, selected: ['2-3', '1-3', '4-5', '5-6', '2-4'], rejected: ['1-2'], components: ['1, 2, 3, 4, 5, 6'], note: '边 2—4 连接最后两个分量。已经选中 V - 1 = 5 条边，可以立即停止，总代价为 13。' },
    { edge: '—', compare: '所有节点已经连通', action: '返回最小总代价 13', total: 13, current: null, currentState: null, examined: 5, selected: ['2-3', '1-3', '4-5', '5-6', '2-4'], rejected: ['1-2'], components: ['1, 2, 3, 4, 5, 6'], note: '绿色的 5 条边覆盖全部 6 个节点、没有环，并且总权重最小；后面的更重边不必再检查。' }
  ]

  const graphEdges = Array.from(root.querySelectorAll('.mst-edge'))
  const graphNodes = Array.from(root.querySelectorAll('.mst-node'))
  const orderItems = Array.from(root.querySelectorAll('.kr-edge-order li'))
  const componentsElement = root.querySelector('[data-role="components"]')
  let index = 0
  let timer = null
  let playing = false

  function stopPlaying() {
    playing = false

    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }

    root.querySelector('[data-action="play"]').textContent = '播放'
  }

  function scheduleNext() {
    if (!playing) {
      return
    }

    timer = window.setTimeout(() => {
      timer = null

      if (!playing || index >= steps.length - 1) {
        stopPlaying()
        return
      }

      index += 1
      render()
      scheduleNext()
    }, 1150)
  }

  function render() {
    const step = steps[index]
    const currentNodes = step.current === null ? [] : step.current.split('-').map(Number)
    const connectedNodes = new Set()

    step.selected.forEach((edge) => {
      edge.split('-').forEach((node) => connectedNodes.add(Number(node)))
    })

    root.querySelector('[data-role="edge"]').textContent = step.edge
    root.querySelector('[data-role="compare"]').textContent = step.compare
    root.querySelector('[data-role="action"]').textContent = step.action
    root.querySelector('[data-role="total"]').textContent = String(step.total)
    root.querySelector('[data-role="note"]').textContent = step.note
    root.querySelector('[data-role="step"]').textContent = String(index + 1) + ' / ' + String(steps.length)

    graphEdges.forEach((edgeElement) => {
      const key = edgeElement.dataset.edge
      const isCurrent = key === step.current
      edgeElement.classList.toggle('is-selected', step.selected.includes(key))
      edgeElement.classList.toggle('is-rejected', step.rejected.includes(key))
      edgeElement.classList.toggle('is-current', isCurrent)
      edgeElement.classList.toggle('is-current-selected', isCurrent && step.currentState === 'selected')
      edgeElement.classList.toggle('is-current-rejected', isCurrent && step.currentState === 'rejected')
    })

    graphNodes.forEach((nodeElement) => {
      const node = Number(nodeElement.dataset.node)
      nodeElement.classList.toggle('is-connected', connectedNodes.has(node))
      nodeElement.classList.toggle('is-current', currentNodes.includes(node))
    })

    orderItems.forEach((item, itemIndex) => {
      const key = item.dataset.edge
      item.classList.toggle('is-processed', itemIndex <= step.examined)
      item.classList.toggle('is-current', key === step.current)
      item.classList.toggle('is-selected', step.selected.includes(key))
      item.classList.toggle('is-rejected', step.rejected.includes(key))
    })

    componentsElement.replaceChildren()
    step.components.forEach((component) => {
      const item = document.createElement('span')
      item.textContent = '{' + component + '}'
      componentsElement.appendChild(item)
    })

    root.classList.toggle('is-finished', index === steps.length - 1)
    root.querySelector('[data-action="prev"]').disabled = index === 0
    root.querySelector('[data-action="next"]').disabled = index === steps.length - 1
  }

  root.querySelector('[data-action="prev"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.max(0, index - 1)
    render()
  })

  root.querySelector('[data-action="next"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.min(steps.length - 1, index + 1)
    render()
  })

  root.querySelector('[data-action="play"]').addEventListener('click', () => {
    if (playing) {
      stopPlaying()
      return
    }

    if (index >= steps.length - 1) {
      index = 0
      render()
    }

    playing = true
    root.querySelector('[data-action="play"]').textContent = '暂停'
    scheduleNext()
  })

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    stopPlaying()
    index = 0
    render()
  })

  render()
})()
</script>

~~~python
def minimum_spanning_tree_cost(
    node_count: int,
    edges: list[tuple[int, int, int]],
) -> int:
    dsu = DisjointSet(node_count)
    total_cost = 0
    used_edges = 0

    for first, second, cost in sorted(
        edges,
        key=lambda edge: edge[2],
    ):
        if not dsu.union(first, second):
            continue

        total_cost += cost
        used_edges += 1

        if used_edges == node_count - 1:
            return total_cost

    return -1
~~~

每次优先选择最便宜、并且不会形成环的边。并查集负责判断两个端点是否已经连通。

复杂度主要来自边排序，为 $O(E\log E)$。

### 8.2 Prim：不断把离生成树最近的节点拉进来

Prim 从某个节点开始，维护“当前生成树到外部节点的最小边”。它和 Dijkstra 都会使用小根堆，但堆中优先级含义不同：

<div class="algo-demo mst-demo prim-demo" id="prim-mst-demo">
  <div class="algo-demo-title"><strong>Prim：从一棵树向外扩张</strong><span>小根堆只比较跨越当前边界的候选边</span></div>
  <div class="mst-status" aria-live="polite">
    <div><span>堆顶边</span><strong data-role="edge"></strong></div>
    <div><span>当前树节点</span><strong data-role="tree"></strong></div>
    <div><span>操作</span><strong data-role="action"></strong></div>
    <div><span>当前总代价</span><strong data-role="total"></strong></div>
  </div>
  <div class="mst-workspace">
    <div class="mst-graph-wrap">
      <svg class="mst-graph" viewBox="0 0 620 250" role="img" aria-label="六节点无向带权图，Prim 的候选边和已选边会被高亮">
        <g class="mst-edge" data-edge="1-2"><line x1="70" y1="125" x2="210" y2="45"></line><rect x="125" y="70" width="28" height="20" rx="3"></rect><text x="139" y="84">4</text></g>
        <g class="mst-edge" data-edge="1-3"><line x1="70" y1="125" x2="210" y2="205"></line><rect x="125" y="160" width="28" height="20" rx="3"></rect><text x="139" y="174">2</text></g>
        <g class="mst-edge" data-edge="2-3"><line x1="210" y1="45" x2="210" y2="205"></line><rect x="217" y="115" width="28" height="20" rx="3"></rect><text x="231" y="129">1</text></g>
        <g class="mst-edge" data-edge="2-4"><line x1="210" y1="45" x2="400" y2="45"></line><rect x="291" y="31" width="28" height="20" rx="3"></rect><text x="305" y="45">5</text></g>
        <g class="mst-edge" data-edge="3-4"><line x1="210" y1="205" x2="400" y2="45"></line><rect x="291" y="115" width="28" height="20" rx="3"></rect><text x="305" y="129">8</text></g>
        <g class="mst-edge" data-edge="3-5"><line x1="210" y1="205" x2="400" y2="205"></line><rect x="288" y="191" width="34" height="20" rx="3"></rect><text x="305" y="205">10</text></g>
        <g class="mst-edge" data-edge="4-5"><line x1="400" y1="45" x2="400" y2="205"></line><rect x="407" y="115" width="28" height="20" rx="3"></rect><text x="421" y="129">2</text></g>
        <g class="mst-edge" data-edge="4-6"><line x1="400" y1="45" x2="550" y2="125"></line><rect x="461" y="70" width="28" height="20" rx="3"></rect><text x="475" y="84">6</text></g>
        <g class="mst-edge" data-edge="5-6"><line x1="400" y1="205" x2="550" y2="125"></line><rect x="461" y="160" width="28" height="20" rx="3"></rect><text x="475" y="174">3</text></g>
        <g class="mst-node" data-node="1" transform="translate(70 125)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">1</text></g>
        <g class="mst-node" data-node="2" transform="translate(210 45)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">2</text></g>
        <g class="mst-node" data-node="3" transform="translate(210 205)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">3</text></g>
        <g class="mst-node" data-node="4" transform="translate(400 45)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">4</text></g>
        <g class="mst-node" data-node="5" transform="translate(400 205)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">5</text></g>
        <g class="mst-node" data-node="6" transform="translate(550 125)"><circle r="24"></circle><text text-anchor="middle" dominant-baseline="central">6</text></g>
      </svg>
      <div class="mst-legend" aria-label="图例"><span><i class="frontier"></i>候选边</span><span><i class="selected"></i>已选入 MST</span><span><i class="rejected"></i>两端都在树中</span></div>
    </div>
    <div class="pr-panel">
      <div class="mst-panel-title"><strong>候选边小根堆</strong><span>左侧是当前堆顶</span></div>
      <div class="pr-heap" data-role="heap" aria-live="polite"></div>
      <div class="pr-boundary-title">Prim 的边界条件</div>
      <div class="pr-boundary"><code>树内节点</code><span>— 最便宜边 →</span><code>树外节点</code></div>
      <p>若弹出边的两个端点都已在树中，它就是旧候选，直接跳过。</p>
    </div>
  </div>
  <div class="algo-note" data-role="note" aria-live="polite"></div>
  <div class="algo-controls"><button type="button" data-action="prev">上一步</button><button type="button" data-action="next">下一步</button><button type="button" data-action="play">播放</button><button type="button" data-action="reset">重置</button><span class="algo-step" data-role="step"></span></div>
</div>

<script>
(() => {
  const root = document.getElementById('prim-mst-demo')

  if (!root || root.dataset.ready === 'true') {
    return
  }

  root.dataset.ready = 'true'

  const steps = [
    { edge: '起点 1', tree: [1], action: '加入节点 1 的出边', total: 0, current: null, currentState: null, selected: [], frontier: [['1-3', 2, false], ['1-2', 4, false]], note: 'Prim 可以从任意节点开始。先把节点 1 放入树，再把连接树内与树外的边加入小根堆。' },
    { edge: '1—3，w = 2', tree: [1, 3], action: '选择，加入节点 3', total: 2, current: '1-3', currentState: 'selected', selected: ['1-3'], frontier: [['2-3', 1, false], ['1-2', 4, false], ['3-4', 8, false], ['3-5', 10, false]], note: '堆顶 1—3 是当前跨越边界的最便宜边。选择它，并把节点 3 的出边加入候选堆。' },
    { edge: '2—3，w = 1', tree: [1, 2, 3], action: '选择，加入节点 2', total: 3, current: '2-3', currentState: 'selected', selected: ['1-3', '2-3'], frontier: [['1-2', 4, true], ['2-4', 5, false], ['3-4', 8, false], ['3-5', 10, false]], note: '节点 3 加入后出现了更便宜的边 2—3。选择它后，节点 2 进入树；堆中的 1—2 随即变成旧候选。' },
    { edge: '1—2，w = 4', tree: [1, 2, 3], action: '两端都在树中，跳过', total: 3, current: '1-2', currentState: 'rejected', selected: ['1-3', '2-3'], frontier: [['2-4', 5, false], ['3-4', 8, false], ['3-5', 10, false]], note: '1 和 2 都已经在生成树里。加入 1—2 只会成环，因此从堆中弹出后直接跳过。' },
    { edge: '2—4，w = 5', tree: [1, 2, 3, 4], action: '选择，加入节点 4', total: 8, current: '2-4', currentState: 'selected', selected: ['1-3', '2-3', '2-4'], frontier: [['4-5', 2, false], ['4-6', 6, false], ['3-4', 8, true], ['3-5', 10, false]], note: '当前有效堆顶是 2—4。节点 4 加入后，它带来了权重更小的新候选边 4—5。' },
    { edge: '4—5，w = 2', tree: [1, 2, 3, 4, 5], action: '选择，加入节点 5', total: 10, current: '4-5', currentState: 'selected', selected: ['1-3', '2-3', '2-4', '4-5'], frontier: [['5-6', 3, false], ['4-6', 6, false], ['3-4', 8, true], ['3-5', 10, true]], note: 'Prim 只比较当前边界，所以后来出现的 4—5 虽然权重为 2，也会优先于早先入堆的较重边。' },
    { edge: '5—6，w = 3', tree: [1, 2, 3, 4, 5, 6], action: '选择，所有节点已加入', total: 13, current: '5-6', currentState: 'selected', selected: ['1-3', '2-3', '2-4', '4-5', '5-6'], frontier: [], note: '选择 5—6 后，6 个节点全部进入生成树；已选 V - 1 = 5 条边，总代价为 13。' },
    { edge: '—', tree: [1, 2, 3, 4, 5, 6], action: '返回最小总代价 13', total: 13, current: null, currentState: null, selected: ['1-3', '2-3', '2-4', '4-5', '5-6'], frontier: [], note: 'Prim 和 Kruskal 得到了同一棵最小生成树，但 Prim 的视角始终是“从当前这棵树向外扩张”。' }
  ]

  const graphEdges = Array.from(root.querySelectorAll('.mst-edge'))
  const graphNodes = Array.from(root.querySelectorAll('.mst-node'))
  const heapElement = root.querySelector('[data-role="heap"]')
  let index = 0
  let timer = null
  let playing = false

  function stopPlaying() {
    playing = false

    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }

    root.querySelector('[data-action="play"]').textContent = '播放'
  }

  function scheduleNext() {
    if (!playing) {
      return
    }

    timer = window.setTimeout(() => {
      timer = null

      if (!playing || index >= steps.length - 1) {
        stopPlaying()
        return
      }

      index += 1
      render()
      scheduleNext()
    }, 1150)
  }

  function renderHeap(frontier) {
    heapElement.replaceChildren()

    if (frontier.length === 0) {
      const empty = document.createElement('span')
      empty.className = 'pr-empty'
      empty.textContent = '空：生成树已完成'
      heapElement.appendChild(empty)
      return
    }

    frontier.forEach((entry, entryIndex) => {
      const item = document.createElement('code')
      item.textContent = entry[0].replace('-', '—') + ' (' + entry[1] + ')'
      item.classList.toggle('is-top', entryIndex === 0)
      item.classList.toggle('is-stale', entry[2])
      heapElement.appendChild(item)
    })
  }

  function render() {
    const step = steps[index]
    const currentNodes = step.current === null ? [] : step.current.split('-').map(Number)
    const validFrontier = step.frontier.filter((entry) => !entry[2]).map((entry) => entry[0])

    root.querySelector('[data-role="edge"]').textContent = step.edge
    root.querySelector('[data-role="tree"]').textContent = '{' + step.tree.join(', ') + '}'
    root.querySelector('[data-role="action"]').textContent = step.action
    root.querySelector('[data-role="total"]').textContent = String(step.total)
    root.querySelector('[data-role="note"]').textContent = step.note
    root.querySelector('[data-role="step"]').textContent = String(index + 1) + ' / ' + String(steps.length)

    graphEdges.forEach((edgeElement) => {
      const key = edgeElement.dataset.edge
      const isCurrent = key === step.current
      edgeElement.classList.toggle('is-frontier', validFrontier.includes(key))
      edgeElement.classList.toggle('is-selected', step.selected.includes(key))
      edgeElement.classList.toggle('is-current', isCurrent)
      edgeElement.classList.toggle('is-current-selected', isCurrent && step.currentState === 'selected')
      edgeElement.classList.toggle('is-current-rejected', isCurrent && step.currentState === 'rejected')
    })

    graphNodes.forEach((nodeElement) => {
      const node = Number(nodeElement.dataset.node)
      nodeElement.classList.toggle('is-in-tree', step.tree.includes(node))
      nodeElement.classList.toggle('is-current', currentNodes.includes(node))
    })

    renderHeap(step.frontier)
    root.classList.toggle('is-finished', index === steps.length - 1)
    root.querySelector('[data-action="prev"]').disabled = index === 0
    root.querySelector('[data-action="next"]').disabled = index === steps.length - 1
  }

  root.querySelector('[data-action="prev"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.max(0, index - 1)
    render()
  })

  root.querySelector('[data-action="next"]').addEventListener('click', () => {
    stopPlaying()
    index = Math.min(steps.length - 1, index + 1)
    render()
  })

  root.querySelector('[data-action="play"]').addEventListener('click', () => {
    if (playing) {
      stopPlaying()
      return
    }

    if (index >= steps.length - 1) {
      index = 0
      render()
    }

    playing = true
    root.querySelector('[data-action="play"]').textContent = '暂停'
    scheduleNext()
  })

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    stopPlaying()
    index = 0
    render()
  })

  render()
})()
</script>

~~~python
import heapq


def minimum_spanning_tree_cost_prim(
    node_count: int,
    edges: list[tuple[int, int, int]],
) -> int:
    if node_count == 0:
        return 0

    graph = [[] for _ in range(node_count)]

    for first, second, cost in edges:
        graph[first].append((second, cost))
        graph[second].append((first, cost))

    visited = [False] * node_count
    # (连接代价, 要加入的节点)
    heap = [(0, 0)]
    total_cost = 0
    used_nodes = 0

    while heap and used_nodes < node_count:
        edge_cost, node = heapq.heappop(heap)

        if visited[node]:
            continue

        visited[node] = True
        total_cost += edge_cost
        used_nodes += 1

        for neighbor, cost in graph[node]:
            if not visited[neighbor]:
                heapq.heappush(heap, (cost, neighbor))

    return total_cost if used_nodes == node_count else -1
~~~

| 算法 | 堆中的优先级 |
|---|---|
| Dijkstra | 起点到该节点的完整路径距离 |
| Prim | 当前生成树连接该节点的最小单边代价 |

稀疏图常用 Kruskal；已有邻接表并且希望按节点扩张时，Prim 更自然。

<span id="trap-rain-water-ii" class="algorithm-section-anchor"></span>

## 9. [407. 接雨水 II](https://leetcode.cn/problems/trapping-rain-water-ii/)：最小堆控制二维水位边界

二维接雨水和 [42. 一维接雨水](https://leetcode.cn/problems/trapping-rain-water/) 虽然名字相似，但不能继续使用单调栈；一维版本的完整解释和动画见[单调栈笔记](/algorithm/monotonic-stack/#trapping-rain-water-1d)。

一维数组中，每个凹槽只需要寻找左右挡板；二维网格中的水可能从上下左右任意方向泄漏，一个格子的水位由包围它的整圈边界中最低的缺口决定。

因此需要：

~~~text
最小堆：始终取出当前最低边界
BFS：从这条边界向相邻格子扩散
~~~

这个过程很像从地图四周向内部逐步“淹没”：

1. 把所有边界格子加入小根堆。
2. 弹出当前高度最低的边界格子。
3. 查看它上下左右尚未访问的邻居。
4. 邻居更低时，可以存下 <code>boundary_height - neighbor_height</code> 的水。
5. 邻居加入堆时的有效边界高度是 <code>max(boundary_height, neighbor_height)</code>。

下面先用一个只有一个低点的 $3\times3$ 小坑建立直觉，再切换到题目的 $3\times6$ 示例。主视图使用二维俯视网格讲清访问顺序；三维图只在完整示例结束时展示最终水面。动画不会再无提示跳步：没有发现新邻居的连续出堆会合并成一句明确说明。

<div class="algo-demo rainwater-ii-demo" id="trap-rain-water-ii-demo">
  <div class="algo-demo-title"><strong>二维接雨水：最低边界向内扩散</strong><span data-role="example-title"></span></div>
  <div class="rw2-mode-switch" role="group" aria-label="示例选择">
    <button type="button" data-mode="intro" aria-pressed="true">① 先看 3 × 3 小坑</button>
    <button type="button" data-mode="full" aria-pressed="false">② 再看完整例题</button>
  </div>
  <div class="rw2-heap-line" aria-live="polite"><strong>小根堆</strong><span data-role="heap-summary"></span><b data-role="total"></b></div>
  <div class="rw2-map-wrap">
    <svg class="rw2-grid" data-role="grid" viewBox="0 0 640 330" role="img" aria-label="二维高度网格，显示边界、当前格、邻居和水深"></svg>
    <div class="rw2-legend" aria-label="图例"><span><i class="frontier"></i>仍在堆中</span><span><i class="current"></i>当前出堆</span><span><i class="neighbor"></i>正在检查</span><span><i class="water"></i>已经存水</span></div>
  </div>
  <div class="rw2-decision" aria-label="当前决策链">
    <div data-decision="pop"><span>1. 弹出最低边界</span><strong data-role="decision-pop">H = ?</strong></div>
    <div data-decision="inspect"><span>2. 查看相邻格</span><strong data-role="decision-inspect">h = ?</strong></div>
    <div data-decision="water"><span>3. 计算水深</span><strong data-role="decision-water">H - h</strong></div>
    <div data-decision="push"><span>4. 更新有效边界</span><strong data-role="decision-push">H′ = max(H, h)</strong></div>
  </div>
  <div class="rw2-message" data-role="message" aria-live="polite"></div>
  <div class="algo-controls"><button type="button" data-action="prev">上一步</button><button type="button" data-action="next">下一步</button><button type="button" data-action="play">播放</button><button type="button" data-action="reset">重置</button><span class="algo-step" data-role="step"></span></div>
  <div class="rw2-final-result" data-role="final-result" hidden>
    <div class="rw2-final-title"><strong>最终三维结果</strong><span>三维图只负责回答“水最后存在哪里”</span></div>
    <svg class="rw2-scene" data-role="scene" viewBox="145 45 410 280" role="img" aria-label="题目示例最终蓄水结果的等距三维地形"></svg>
  </div>
</div>

<script>
(() => {
  const root = document.getElementById('trap-rain-water-ii-demo')

  if (!root || root.dataset.ready === 'true') {
    return
  }

  root.dataset.ready = 'true'

  const heightMap = [
    [1, 4, 3, 1, 3, 2],
    [3, 2, 1, 3, 2, 4],
    [2, 3, 3, 2, 3, 1]
  ]
  const introMap = [
    [3, 3, 3],
    [3, 1, 3],
    [3, 3, 3]
  ]
  const rows = heightMap.length
  const cols = heightMap[0].length
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]

  function cellKey(row, col) {
    return row + ',' + col
  }

  function compareHeap(left, right) {
    return left.height - right.height || left.row - right.row || left.col - right.col
  }

  function copyLevels(levels) {
    return levels.map((row) => row.slice())
  }

  function buildFullStates() {
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false))
    const levels = copyLevels(heightMap)
    const popped = new Set()
    const heap = []
    const states = []
    let skipped = []
    let total = 0

    function addBoundary(row, col) {
      if (visited[row][col]) {
        return
      }

      visited[row][col] = true
      heap.push({ height: heightMap[row][col], row, col })
    }

    for (let row = 0; row < rows; row += 1) {
      addBoundary(row, 0)
      addBoundary(row, cols - 1)
    }

    for (let col = 1; col < cols - 1; col += 1) {
      addBoundary(0, col)
      addBoundary(rows - 1, col)
    }

    function snapshot(options) {
      states.push({
        map: heightMap,
        phase: options.phase,
        current: options.current || null,
        neighbor: options.neighbor || null,
        added: options.added,
        effective: options.effective,
        skipped: options.skipped || 0,
        total,
        visited: visited.map((row) => row.slice()),
        levels: copyLevels(levels),
        popped: Array.from(popped),
        heap: heap.slice().sort(compareHeap),
        message: options.message
      })
    }

    snapshot({
      phase: 'init',
      added: 0,
      message: '第一步只做初始化：四周边界全部入堆，内部格子暂时不访问。蓝点表示仍在小根堆中的边界。'
    })

    while (heap.length > 0) {
      heap.sort(compareHeap)
      const current = heap[0]
      const pendingNeighbors = directions.filter((direction) => {
        const nextRow = current.row + direction[0]
        const nextCol = current.col + direction[1]
        return nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols && !visited[nextRow][nextCol]
      })

      if (pendingNeighbors.length === 0) {
        heap.shift()
        popped.add(cellKey(current.row, current.col))
        skipped.push(current)
        continue
      }

      if (skipped.length > 0) {
        snapshot({
          phase: 'skip',
          added: 0,
          skipped: skipped.length,
          message: '刚才连续弹出 ' + skipped.length + ' 个边界格，但它们周围不是地图外部就是已访问格，所以水量和边界都没有变化。'
        })
        skipped = []
      }

      heap.shift()
      const currentKey = cellKey(current.row, current.col)
      popped.add(currentKey)

      snapshot({
        phase: 'pop',
        current,
        added: null,
        message: '小根堆保证这就是当前最低的有效边界：H = ' + current.height + '。现在只关注橙色格。'
      })

      directions.forEach((direction) => {
        const nextRow = current.row + direction[0]
        const nextCol = current.col + direction[1]

        if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols || visited[nextRow][nextCol]) {
          return
        }

        const neighbor = {
          row: nextRow,
          col: nextCol,
          height: heightMap[nextRow][nextCol]
        }
        snapshot({
          phase: 'inspect',
          current,
          neighbor,
          added: null,
          message: '沿箭头查看绿色邻居：它的原始地形高度 h = ' + neighbor.height + '。先不要算水，只比较 h 和 H。'
        })

        visited[nextRow][nextCol] = true
        const added = Math.max(0, current.height - neighbor.height)
        const effective = Math.max(current.height, neighbor.height)
        total += added
        levels[nextRow][nextCol] = effective
        snapshot({
          phase: 'water',
          current,
          neighbor,
          added,
          effective,
          message: added > 0
            ? '因为 h = ' + neighbor.height + ' 小于 H = ' + current.height + '，所以水深是 H - h = ' + added + '。蓝色标的是水深 ' + added + '，不是水位 ' + effective + '。'
            : '因为 h = ' + neighbor.height + ' 不低于 H = ' + current.height + '，水会继续向外流，所以这个格子不存水。'
        })

        heap.push({ height: effective, row: nextRow, col: nextCol })
        snapshot({
          phase: 'push',
          current,
          neighbor,
          added,
          effective,
          message: '邻居入堆时使用有效边界 H′ = max(' + current.height + ', ' + neighbor.height + ') = ' + effective + '，而不是只放回原始高度 ' + neighbor.height + '。'
        })
      })
    }

    if (skipped.length > 0) {
      snapshot({
        phase: 'skip',
        added: 0,
        skipped: skipped.length,
        message: '最后 ' + skipped.length + ' 个边界格都没有未访问邻居，合并显示这段不会改变答案的出堆过程。'
      })
    }

    snapshot({
      phase: 'finish',
      added: 0,
      message: '处理完成：三个内部低点的水深分别是 2、1、1，累计水量 2 + 1 + 1 = 4。下方三维图只展示最终空间结果。'
    })

    return states
  }

  function buildIntroStates() {
    const boundaryHeap = []
    const visited = Array.from({ length: 3 }, () => Array(3).fill(false))
    const levels = copyLevels(introMap)

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        if (row === 0 || row === 2 || col === 0 || col === 2) {
          visited[row][col] = true
          boundaryHeap.push({ height: 3, row, col })
        }
      }
    }

    const current = { height: 3, row: 0, col: 1 }
    const neighbor = { height: 1, row: 1, col: 1 }
    const heapAfterPop = boundaryHeap.filter((entry) => !(entry.row === 0 && entry.col === 1))

    function state(phase, options = {}) {
      return {
        map: introMap,
        phase,
        current: options.current || null,
        neighbor: options.neighbor || null,
        added: options.added,
        effective: options.effective,
        skipped: 0,
        total: options.total || 0,
        visited: options.centerVisited ? visited.map((row, rowIndex) => row.map((value, colIndex) => value || (rowIndex === 1 && colIndex === 1))) : visited.map((row) => row.slice()),
        levels: options.hasWater ? [[3, 3, 3], [3, 3, 3], [3, 3, 3]] : copyLevels(levels),
        popped: options.popped ? ['0,1'] : [],
        heap: options.heap || boundaryHeap.slice(),
        conceptDone: options.conceptDone || false,
        message: options.message
      }
    }

    return [
      state('init', {
        message: '先看最简单的情况：外圈高度都是 3，中心地形高度是 1。外圈先进入小根堆。'
      }),
      state('pop', {
        current,
        popped: true,
        heap: heapAfterPop,
        message: '从并列的最低边界中弹出上方格子。它的有效边界高度 H = 3。'
      }),
      state('inspect', {
        current,
        neighbor,
        popped: true,
        heap: heapAfterPop,
        message: '沿箭头看中心邻居，得到原始高度 h = 1。现在只比较：邻居比边界低。'
      }),
      state('water', {
        current,
        neighbor,
        added: 2,
        effective: 3,
        total: 2,
        popped: true,
        heap: heapAfterPop,
        centerVisited: true,
        hasWater: true,
        message: 'h = 1 小于 H = 3，所以中心水深是 H - h = 2。蓝色区域只表示这 2 层水。'
      }),
      state('push', {
        current,
        neighbor,
        added: 2,
        effective: 3,
        total: 2,
        popped: true,
        heap: heapAfterPop.concat([{ height: 3, row: 1, col: 1 }]),
        centerVisited: true,
        hasWater: true,
        message: '中心格虽然地形只有 1，但水面已经到 3；继续扩散时，它要以有效边界 H′ = 3 入堆。'
      }),
      state('finish', {
        total: 2,
        heap: [],
        centerVisited: true,
        hasWater: true,
        conceptDone: true,
        message: '小坑的核心已经清楚：水深看 H - h，继续扩散看 H′ = max(H, h)。现在可以切换到完整例题。'
      })
    ]
  }

  const introStates = buildIntroStates()
  const fullStates = buildFullStates()
  const gridElement = root.querySelector('[data-role="grid"]')
  const sceneElement = root.querySelector('[data-role="scene"]')
  let mode = 'intro'
  let states = introStates
  let index = 0
  let timer = null

  function isBoundary(row, col) {
    return row === 0 || row === rows - 1 || col === 0 || col === cols - 1
  }

  function polygonPoints(points) {
    return points.map((point) => point[0] + ',' + point[1]).join(' ')
  }

  function prismFaces(centerX, baseY, height) {
    const halfWidth = 36
    const halfDepth = 17
    const heightScale = 25
    const topY = baseY - height * heightScale

    return {
      topY,
      top: polygonPoints([
        [centerX, topY - halfDepth],
        [centerX + halfWidth, topY],
        [centerX, topY + halfDepth],
        [centerX - halfWidth, topY]
      ]),
      left: polygonPoints([
        [centerX - halfWidth, topY],
        [centerX, topY + halfDepth],
        [centerX, baseY + halfDepth],
        [centerX - halfWidth, baseY]
      ]),
      right: polygonPoints([
        [centerX + halfWidth, topY],
        [centerX, topY + halfDepth],
        [centerX, baseY + halfDepth],
        [centerX + halfWidth, baseY]
      ])
    }
  }

  function waterFaces(centerX, baseY, groundHeight, level) {
    const halfWidth = 36
    const halfDepth = 17
    const heightScale = 25
    const groundY = baseY - groundHeight * heightScale
    const topY = baseY - level * heightScale

    return {
      topY,
      top: polygonPoints([
        [centerX, topY - halfDepth],
        [centerX + halfWidth, topY],
        [centerX, topY + halfDepth],
        [centerX - halfWidth, topY]
      ]),
      left: polygonPoints([
        [centerX - halfWidth, topY],
        [centerX, topY + halfDepth],
        [centerX, groundY + halfDepth],
        [centerX - halfWidth, groundY]
      ]),
      right: polygonPoints([
        [centerX + halfWidth, topY],
        [centerX, topY + halfDepth],
        [centerX, groundY + halfDepth],
        [centerX + halfWidth, groundY]
      ])
    }
  }

  function renderScene(state) {
    const cells = []

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        cells.push({ row, col })
      }
    }

    cells.sort((left, right) => left.row + left.col - right.row - right.col || left.row - right.row)
    let html = '<title>二维接雨水的等距三维地形</title><desc>深色柱体表示原地形，蓝色半透明柱体表示存水，当前累计水量为 ' + state.total + '。</desc>'
    let labelHtml = ''

    cells.forEach((cell) => {
      const row = cell.row
      const col = cell.col
      const key = cellKey(row, col)
      const ground = heightMap[row][col]
      const level = state.levels[row][col]
      const water = Math.max(0, level - ground)
      const centerX = 300 + (col - row) * 36
      const baseY = 175 + (col + row) * 17
      const groundFaces = prismFaces(centerX, baseY, ground)
      const classes = ['rw2-prism']
      if (isBoundary(row, col)) classes.push('is-boundary')
      let group = '<g class="' + classes.join(' ') + '" data-cell="' + key + '">'
      group += '<polygon class="rw2-ground-left" points="' + groundFaces.left + '"></polygon>'
      group += '<polygon class="rw2-ground-right" points="' + groundFaces.right + '"></polygon>'
      group += '<polygon class="rw2-ground-top" points="' + groundFaces.top + '"></polygon>'

      if (water > 0) {
        const waterShape = waterFaces(centerX, baseY, ground, level)
        group += '<g class="rw2-water-prism"><polygon class="rw2-water-left" points="' + waterShape.left + '"></polygon><polygon class="rw2-water-right" points="' + waterShape.right + '"></polygon><polygon class="rw2-water-top" points="' + waterShape.top + '"></polygon></g>'
        labelHtml += '<text class="rw2-height-label" x="' + centerX + '" y="' + (waterShape.topY + 4) + '" text-anchor="middle">水 +' + water + '</text>'
      }
      group += '</g>'
      html += group
    })

    sceneElement.innerHTML = html + labelHtml
  }

  function renderGrid(state) {
    const map = state.map
    const rowCount = map.length
    const colCount = map[0].length
    const cellSize = colCount <= 3 ? 96 : 82
    const gap = colCount <= 3 ? 12 : 8
    const gridWidth = colCount * cellSize + (colCount - 1) * gap
    const gridHeight = rowCount * cellSize + (rowCount - 1) * gap
    const startX = (640 - gridWidth) / 2
    const startY = 34
    const viewHeight = gridHeight + 68
    const heapKeys = new Set(state.heap.map((entry) => cellKey(entry.row, entry.col)))
    const poppedKeys = new Set(state.popped)
    const currentKey = state.current ? cellKey(state.current.row, state.current.col) : ''
    const neighborKey = state.neighbor ? cellKey(state.neighbor.row, state.neighbor.col) : ''

    gridElement.setAttribute('viewBox', '0 0 640 ' + viewHeight)
    let html = '<title>二维俯视教学网格</title><desc>数字表示原始地形高度；橙色格是当前最低边界，绿色格是正在检查的邻居，蓝色填充标出已经存水的格子。</desc>'
    html += '<defs><marker id="rw2-grid-arrow-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker></defs>'

    if (state.current && state.neighbor) {
      const currentX = startX + state.current.col * (cellSize + gap) + cellSize / 2
      const currentY = startY + state.current.row * (cellSize + gap) + cellSize / 2
      const neighborX = startX + state.neighbor.col * (cellSize + gap) + cellSize / 2
      const neighborY = startY + state.neighbor.row * (cellSize + gap) + cellSize / 2
      const deltaX = neighborX - currentX
      const deltaY = neighborY - currentY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      const inset = cellSize * 0.34
      const startArrowX = currentX + deltaX / distance * inset
      const startArrowY = currentY + deltaY / distance * inset
      const endArrowX = neighborX - deltaX / distance * inset
      const endArrowY = neighborY - deltaY / distance * inset
      html += '<line class="rw2-grid-arrow" x1="' + startArrowX + '" y1="' + startArrowY + '" x2="' + endArrowX + '" y2="' + endArrowY + '" marker-end="url(#rw2-grid-arrow-head)"></line>'
    }

    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < colCount; col += 1) {
        const key = cellKey(row, col)
        const x = startX + col * (cellSize + gap)
        const y = startY + row * (cellSize + gap)
        const ground = map[row][col]
        const water = Math.max(0, state.levels[row][col] - ground)
        const boundary = row === 0 || row === rowCount - 1 || col === 0 || col === colCount - 1
        const classes = ['rw2-grid-cell']
        if (boundary) classes.push('is-boundary')
        if (heapKeys.has(key)) classes.push('is-frontier')
        if (poppedKeys.has(key)) classes.push('is-popped')
        if (key === currentKey) classes.push('is-current')
        if (key === neighborKey) classes.push('is-neighbor')
        if (water > 0) classes.push('has-water')

        html += '<g class="' + classes.join(' ') + '" data-cell="' + key + '">'
        html += '<rect class="rw2-cell-base" x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '"></rect>'
        if (water > 0) {
          html += '<rect class="rw2-cell-water" x="' + (x + 4) + '" y="' + (y + 4) + '" width="' + (cellSize - 8) + '" height="' + (cellSize - 8) + '"></rect>'
        }
        if (heapKeys.has(key)) {
          html += '<circle class="rw2-frontier-dot" cx="' + (x + cellSize - 11) + '" cy="' + (y + 11) + '" r="5"></circle>'
        }
        if (key === currentKey) {
          html += '<text class="rw2-cell-role is-current" x="' + (x + 9) + '" y="' + (y + 17) + '">边界 H=' + state.current.height + '</text>'
        } else if (key === neighborKey) {
          html += '<text class="rw2-cell-role is-neighbor" x="' + (x + 9) + '" y="' + (y + 17) + '">邻居 h=' + state.neighbor.height + '</text>'
        }
        html += '<text class="rw2-cell-height" x="' + (x + cellSize / 2) + '" y="' + (y + cellSize / 2 + 8) + '" text-anchor="middle">' + ground + '</text>'
        if (water > 0) {
          html += '<text class="rw2-cell-water-label" x="' + (x + cellSize / 2) + '" y="' + (y + cellSize - 10) + '" text-anchor="middle">水深 ' + water + '</text>'
        }
        html += '</g>'
      }
    }

    gridElement.innerHTML = html
  }

  function renderHeapSummary(state) {
    const summaryElement = root.querySelector('[data-role="heap-summary"]')

    if (state.conceptDone) {
      summaryElement.textContent = '小坑结论：水深 2，有效高度 3'
    } else if (mode === 'intro') {
      summaryElement.textContent = state.phase === 'init'
        ? '8 个外圈边界并列，最低高度都是 H=3，可以任选一个'
        : '外圈最低边界均为 H=3；当前只追踪橙色格和绿色邻居'
    } else if (state.heap.length === 0) {
      summaryElement.textContent = '已经处理完全部有效边界'
    } else {
      const top = state.heap.slice().sort(compareHeap)[0]
      summaryElement.innerHTML = '堆顶 <code>H=' + top.height + '</code>，位置 (' + top.row + ', ' + top.col + ')；其余 ' + (state.heap.length - 1) + ' 个边界'
    }

    root.querySelector('[data-role="total"]').textContent = '累计水量：' + state.total
  }

  function renderDecision(state) {
    const current = state.current
    const neighbor = state.neighbor
    const values = {
      pop: current ? 'H = ' + current.height : 'H = ?',
      inspect: neighbor ? 'h = ' + neighbor.height : 'h = ?',
      water: ['water', 'push'].includes(state.phase) ? state.added > 0 ? '水深 = ' + state.added : '水深 = 0' : 'H - h',
      push: state.phase === 'push' ? 'H′ = ' + state.effective : 'H′ = max(H, h)'
    }

    if (state.phase === 'skip') {
      values.pop = '合并跳过 ' + state.skipped + ' 个'
    } else if (state.phase === 'finish') {
      values.pop = '取当前最小 H'
      values.inspect = '读取邻居 h'
      values.water = '累加 max(0, H-h)'
      values.push = '压入 max(H, h)'
    }

    root.querySelector('[data-role="decision-pop"]').textContent = values.pop
    root.querySelector('[data-role="decision-inspect"]').textContent = values.inspect
    root.querySelector('[data-role="decision-water"]').textContent = values.water
    root.querySelector('[data-role="decision-push"]').textContent = values.push

    const order = ['pop', 'inspect', 'water', 'push']
    const phaseIndex = order.indexOf(state.phase)
    root.querySelectorAll('[data-decision]').forEach((element) => {
      const itemIndex = order.indexOf(element.dataset.decision)
      element.classList.toggle('active', itemIndex === phaseIndex || (state.phase === 'skip' && itemIndex === 0))
      element.classList.toggle('is-done', state.phase === 'finish' || (phaseIndex >= 0 && itemIndex < phaseIndex))
    })
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer)
      timer = null
    }

    root.querySelector('[data-action="play"]').textContent = '播放'
  }

  function render() {
    const state = states[index]
    const showFinalResult = mode === 'full' && state.phase === 'finish'
    root.dataset.phase = state.phase
    root.classList.toggle('is-finished', showFinalResult)
    root.querySelector('[data-role="example-title"]').textContent = mode === 'intro' ? '先理解一个 3 × 3 小坑' : 'LeetCode 示例 3 × 6，结果为 4'
    root.querySelector('[data-role="message"]').textContent = state.message
    root.querySelector('[data-role="step"]').textContent = '第 ' + (index + 1) + ' / ' + states.length + ' 步'
    root.querySelector('[data-action="prev"]').disabled = index === 0
    root.querySelector('[data-action="next"]').disabled = index === states.length - 1
    root.querySelector('[data-role="final-result"]').hidden = !showFinalResult
    root.querySelectorAll('[data-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.mode === mode ? 'true' : 'false')
    })

    renderGrid(state)
    renderHeapSummary(state)
    renderDecision(state)

    if (showFinalResult) {
      renderScene(state)
    }
  }

  function setMode(nextMode) {
    stop()
    mode = nextMode
    states = mode === 'intro' ? introStates : fullStates
    index = 0
    render()
  }

  root.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode))
  })

  root.querySelector('[data-action="prev"]').addEventListener('click', () => {
    stop()
    index = Math.max(0, index - 1)
    render()
  })

  root.querySelector('[data-action="next"]').addEventListener('click', () => {
    stop()
    index = Math.min(states.length - 1, index + 1)
    render()
  })

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    stop()
    index = 0
    render()
  })

  root.querySelector('[data-action="play"]').addEventListener('click', () => {
    if (timer) {
      stop()
      return
    }

    if (index === states.length - 1) {
      index = 0
      render()
    }

    root.querySelector('[data-action="play"]').textContent = '暂停'
    timer = window.setInterval(() => {
      if (index >= states.length - 1) {
        stop()
        return
      }

      index += 1
      render()
    }, 1050)
  })

  render()
})()
</script>

### 9.1 为什么入堆的是有效高度

假设当前最低边界高度为 4，内部邻居原高度为 1：

~~~text
这个格子存水 4 - 1 = 3
格子的水面已经达到 4
它继续向内部扩展时，能够充当高度为 4 的新边界
~~~

因此不能把原高度 1 重新放进堆，而要放入有效高度 4。

### 9.2 完整代码

~~~python
import heapq


def trap_rain_water(
    height_map: list[list[int]],
) -> int:
    if not height_map or not height_map[0]:
        return 0

    rows = len(height_map)
    cols = len(height_map[0])

    if rows < 3 or cols < 3:
        return 0

    visited = [
        [False] * cols
        for _ in range(rows)
    ]
    heap = []

    def add_boundary(row: int, col: int) -> None:
        if visited[row][col]:
            return

        visited[row][col] = True
        heapq.heappush(
            heap,
            (height_map[row][col], row, col),
        )

    for row in range(rows):
        add_boundary(row, 0)
        add_boundary(row, cols - 1)

    for col in range(1, cols - 1):
        add_boundary(0, col)
        add_boundary(rows - 1, col)

    directions = ((-1, 0), (1, 0), (0, -1), (0, 1))
    water = 0

    while heap:
        boundary_height, row, col = heapq.heappop(heap)

        for row_step, col_step in directions:
            next_row = row + row_step
            next_col = col + col_step

            if not (
                0 <= next_row < rows
                and 0 <= next_col < cols
            ):
                continue

            if visited[next_row][next_col]:
                continue

            visited[next_row][next_col] = True
            neighbor_height = height_map[next_row][next_col]

            if neighbor_height < boundary_height:
                water += boundary_height - neighbor_height

            heapq.heappush(
                heap,
                (
                    max(boundary_height, neighbor_height),
                    next_row,
                    next_col,
                ),
            )

    return water
~~~

小根堆保证我们永远从当前最低缺口向内推进。这与 Dijkstra 很像：已经弹出的最低边界可以安全确定，不会被更高边界推翻。

每个格子只访问一次，最多入堆和出堆一次。设网格大小为 $m \times n$：

~~~text
时间复杂度：O(mn log(mn))
空间复杂度：O(mn)
~~~

这一题也是 [堆与优先队列](/algorithm/stack-queue/#heap-and-priority-queue) 和图搜索结合的典型例子。

### 9.3 一维和二维接雨水对比

| 对比 | [42. 一维接雨水](https://leetcode.cn/problems/trapping-rain-water/) | [407. 二维接雨水](https://leetcode.cn/problems/trapping-rain-water-ii/) |
|---|---|---|
| 数据形态 | 一维柱高数组 | 二维高度网格 |
| 边界 | 左、右挡板 | 包围区域的整圈边界 |
| 核心结构 | 单调栈 | 小根堆 |
| 推进方式 | 当前高柱结算凹槽 | 当前最低边界向内 BFS |
| 复杂度 | $O(n)$ | $O(mn\log(mn))$ |

不要因为题目名称相同就强行复用数据结构。决定算法的是边界关系，而不是题目标题。

## 10. 常见错误

### 10.1 无向边只加入一个方向

无向图的 <code>u - v</code> 必须同时加入：

~~~text
graph[u].append(v)
graph[v].append(u)
~~~

只加一个方向会把无向图错误地变成有向图。

### 10.2 入队和出队时机混乱

BFS 通常在入队时标记访问。这样每个节点只会入队一次，避免队列里出现大量重复状态。

### 10.3 把 BFS 当作所有最短路的通用解法

BFS 只直接适用于无权图或所有边权相同的图。边权不同且非负时使用 Dijkstra；存在负权边时考虑 Bellman-Ford。

### 10.4 Dijkstra 忘记跳过旧状态

同一节点可能多次入堆。弹出的距离不是当前记录时必须跳过，否则会做大量无效松弛。

### 10.5 拓扑排序把边方向写反

课程依赖 <code>[course, prerequisite]</code> 应该建边：

~~~text
prerequisite → course
~~~

同时增加 <code>course</code> 的入度。

### 10.6 并查集把节点值当成连续下标

节点编号不连续或从 1 开始时，要先映射或按最大编号分配数组，避免越界。

### 10.7 二维接雨水重复加入边界角点

四个角同时属于横向边界和纵向边界。加入边界时要用 <code>visited</code> 去重。

### 10.8 二维接雨水把邻居原高度直接入堆

已经存水的格子水面被抬高了。下一轮边界必须使用：

~~~text
max(boundary_height, neighbor_height)
~~~

否则会错误地从内部低点泄漏。

### 10.9 A* 的启发函数高估真实代价

启发函数如果高估剩余距离，A* 可能过早偏向一条看似便宜、实际并非最短的路径。想保留最短路保证，必须使用不高估真实最小代价的启发函数；如果无法构造可靠的 `h`，令 `h = 0`，退化为 Dijkstra 更安全。

## 11. 一份实用的图论检查清单

1. 节点和边分别是什么？
2. 图是有向还是无向？
3. 是否需要给无向边加入两个方向？
4. 边是否带权？权重是否可能为负？
5. 求的是可达、连通、最短路还是最小生成树？
6. DFS / BFS 的 <code>visited</code> 在什么时机设置？
7. 网格搜索是否检查了四个边界？
8. 是否可以从多个终点反向搜索？
9. 拓扑排序的边方向和入度是否正确？
10. Dijkstra 是否跳过了堆中的旧距离？
11. 并查集的节点编号是否与数组下标一致？
12. 最小生成树最终是否选中了恰好 $V-1$ 条边？
13. 二维接雨水入堆的是原高度还是有效边界高度？
14. A* 的启发函数是否会高估真实剩余代价？

## 12. 复习总览

- 图由节点和边组成，第一步是确定有向性、边权和邻居表示。
- 邻接表适合稀疏图，邻接矩阵适合稠密图和多点距离，边列表适合按边扫描。
- DFS 适合连通块、路径和回溯；BFS 适合按层扩散和无权最短路。
- 网格是隐式图，每个格子是节点，上下左右移动是边。
- 岛屿题的核心是发现一个新连通块后把它完整标记。
- 并查集维护动态连通关系，适合合并集合和无向图成环判断。
- 拓扑排序不断处理入度为 0 的节点；无法处理全部节点说明存在环。
- 无权最短路用 BFS；非负权单源最短路用 Dijkstra；负权边考虑 Bellman-Ford。
- Floyd-Warshall 用三重循环计算所有节点对最短距离。
- A* 用 `f = g + h` 面向目标搜索；可靠的启发函数不能高估真实剩余代价。
- 最小生成树连接所有节点且总边权最小；Kruskal 排序全图边并用并查集判环，Prim 用小根堆从当前树向外扩张。
- 407 二维接雨水不是单调栈题，而是小根堆控制最低边界、BFS 向内部扩散。
- 二维接雨水中，邻居入堆时必须使用抬高后的有效边界高度。

图论题最容易混乱的地方不是代码长度，而是算法选择。先判断“连接关系、边权、目标”，再选 DFS/BFS、并查集、拓扑排序、最短路或最小生成树，模板才不会套错。

<div class="algorithm-module-nav algorithm-module-nav-bottom">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/monotonic-stack/">上一篇：单调栈</a>
  <span class="algorithm-module-nav-disabled">下一篇：专题扩展（整理中）</span>
</div>
