---
title: 代码随想录刷题笔记：贪心算法总结
date:
top_img: /img/algorithm-header-code.webp
description: 贪心算法刷题笔记，整理分发、局部收益、跳跃覆盖、双维度排序、区间调度、单调递增数字和二叉树监控的题型识别与正确性判断。
categories:
  - Notes
  - Algorithm
tags:
  - LeetCode
  - CodeThinking
  - Python
  - Greedy
toc: true
toc_number: false
katex: true
---

<div class="algorithm-module-nav algorithm-module-nav-top">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/backtracking/">上一篇：回溯算法模板</a>
  <a href="/algorithm/dynamic-programming/">下一篇：动态规划与背包问题</a>
</div>

## 1. 怎么看贪心题

贪心算法的核心是：**每一步只做当前最有利的选择，并且这个选择一旦做出就不回头。** 如果这些局部最优能够拼成全局最优，就可以用贪心。

它和回溯、动态规划的区别很明显：

- 回溯会枚举不同选择，走错了就撤销。
- 动态规划会保存子问题答案，比较多种转移来源。
- 贪心只保留当前认为最好的状态，其他可能性直接丢掉。

所以贪心代码通常不长，真正难的是两件事：

1. 这一题应该按什么规则做局部选择？
2. 为什么丢掉其他选择以后，不会错过全局最优？

刷题时可以先找这些信号：

| 题目特征 | 常见贪心选择 | 需要维护的状态 |
|---|---|---|
| 分配资源，让尽量多的人满足 | 小资源优先满足小需求，或大资源优先解决大需求 | 当前资源、当前需求 |
| 连续过程可以累积收益 | 只保留正贡献，负贡献立刻丢掉 | 当前收益、历史最优 |
| 问能不能到达、最少几步覆盖 | 每一步把可达范围扩到最远 | 当前覆盖、下一层覆盖 |
| 两个维度互相影响 | 先固定一个维度，再处理另一个维度 | 排序后的局部顺序 |
| 选最多互不冲突区间 | 优先选结束最早的区间 | 已选区间的右端点 |
| 合并或切分区间 | 按起点排序后维护最远右边界 | 当前区间、最远边界 |

贪心题经常先排序。排序不是答案，它只是把选择顺序整理成“做完当前决定后，剩余问题最容易处理”的样子。看到排序时要说清楚：**按什么字段排、升序还是降序、相同时为什么这样处理。**

## 2. 怎么判断一个贪心策略对不对

贪心不能只靠“看起来最划算”。一个策略至少要能通过下面三种检查中的一种。

### 2.1 交换论证：换成贪心选择不会更差

假设最优方案第一步没有选贪心方案选的对象。如果能把它替换成贪心选择，并证明答案不会变差，那么至少存在一个最优方案以贪心选择开头。之后对剩余问题重复同样的论证。

[455. 分发饼干](https://leetcode.cn/problems/assign-cookies/) 就是典型例子：把胃口和饼干都排序，用最小的可用饼干满足当前最小胃口。若某个方案用更大的饼干满足这个孩子，换成当前这块较小但足够的饼干也不会让孩子不满足，还能把更大的饼干留给后面的人。

### 2.2 覆盖论证：只关心最远边界

有些题不需要知道具体怎么走，只要知道“目前最远能到哪里”。如果两个方案都能到达当前位置，那么保留覆盖更远的那个方案不会更差，覆盖较近的状态可以直接丢掉。

跳跃游戏里维护 `cover`，就是把大量具体路径压缩成一个最远可达边界。

### 2.3 反例检查：局部最优是否会堵死后路

写代码前先用小数据挑战自己的策略：

- 只选眼前价值最大的，会不会占掉后面更稀缺的资源？
- 只看当前差值，会不会破坏另一个维度的约束？
- 区间按起点最早选，会不会选中一个特别长的区间，挡住很多短区间？
- 遇到负数就丢掉，题目是否允许一个元素都不选？

如果同一个状态会从很多来源到达，而且需要比较这些来源的长期结果，通常更像动态规划；如果要列出所有方案，通常更像回溯。贪心成立的关键，是能证明被丢掉的状态以后永远没有翻盘机会。

## 3. 分发问题：先把供需关系排好

### 3.1 分发饼干：小饼干优先满足小胃口

[455. 分发饼干](https://leetcode.cn/problems/assign-cookies/) 给每个孩子一个胃口 `g[i]`，给每块饼干一个尺寸 `s[j]`。一块饼干只能给一个孩子，目标是满足尽量多的孩子。

把两边都从小到大排序：

- 当前饼干不够，就换更大的饼干。
- 当前饼干够用，就满足当前孩子，两边一起向后走。

```python
def find_content_children(g: list[int], s: list[int]) -> int:
    g.sort()
    s.sort()

    child = 0

    for cookie in s:
        if child < len(g) and cookie >= g[child]:
            child += 1

    return child
```

这里 `child` 既表示下一个待满足孩子的下标，也表示已经满足的孩子数。小饼干如果连最小胃口都满足不了，就不可能满足后面的孩子；小饼干如果够用，也没必要浪费更大的饼干。

也可以反过来，从大到小用最大饼干优先满足最大胃口。两个方向都成立，但不要一边从小到大、一边从大到小，那样供需关系会错位。

### 3.2 K 次取反：优先处理绝对值大的负数

[1005. K 次取反后最大化的数组和](https://leetcode.cn/problems/maximize-sum-of-array-after-k-negations/) 每次可以选择一个数乘以 `-1`，恰好操作 `k` 次。

贪心顺序是：

1. 按绝对值从大到小排序。
2. 只要还有次数，就先把负数变成正数。
3. 如果最后还剩奇数次，再翻转绝对值最小的数。

```python
def largest_sum_after_k_negations(nums: list[int], k: int) -> int:
    nums.sort(key=abs, reverse=True)

    for i in range(len(nums)):
        if nums[i] < 0 and k > 0:
            nums[i] = -nums[i]
            k -= 1

    if k % 2 == 1:
        nums[-1] = -nums[-1]

    return sum(nums)
```

负数绝对值越大，翻成正数带来的收益越大；必须消耗的多余奇数次操作，则应该放在绝对值最小的数上，让损失最小。

### 3.3 柠檬水找零：大额零钱更稀缺

[860. 柠檬水找零](https://leetcode.cn/problems/lemonade-change/) 中每杯 5 美元，顾客按顺序支付 5、10 或 20 美元。顺序不能调整，只能贪心管理手里的零钱。

收到 20 美元时优先找一张 10 和一张 5，而不是三张 5。因为 10 美元只能用于给 20 找零，5 美元却能处理所有找零情况，更通用、更稀缺。

```python
def lemonade_change(bills: list[int]) -> bool:
    five = 0
    ten = 0

    for bill in bills:
        if bill == 5:
            five += 1
        elif bill == 10:
            if five == 0:
                return False
            five -= 1
            ten += 1
        else:
            if ten > 0 and five > 0:
                ten -= 1
                five -= 1
            elif five >= 3:
                five -= 3
            else:
                return False

    return True
```

分发题的重点不是固定记“从小到大”或“从大到小”，而是看哪一种资源更难替代。优先处理更受限制的需求，同时把更通用的资源留给后面。

## 4. 序列收益：负贡献丢掉，正贡献收下

### 4.1 最大子数组和：当前和为负就重新开始

[53. 最大子数组和](https://leetcode.cn/problems/maximum-subarray/) 要找和最大的非空连续子数组。

如果前面累积出的 `current_sum` 已经小于 0，那么它接在任何后续子数组前面都只会拖后腿。走到下一个数时，直接从这个数重新开始不会更差。

```python
def max_sub_array(nums: list[int]) -> int:
    best = nums[0]
    current_sum = 0

    for num in nums:
        current_sum += num
        best = max(best, current_sum)

        if current_sum < 0:
            current_sum = 0

    return best
```

`best` 必须初始化为 `nums[0]`，不能初始化为 0，因为数组可能全是负数，而题目要求子数组不能为空。

这题也可以用动态规划解释：`dp[i]` 表示以 `i` 结尾的最大子数组和。贪心写法只是把只依赖前一个状态的 DP 压缩成一个变量。

### 4.2 买卖股票 II：把每一段上涨都收下

[122. 买卖股票的最佳时机 II](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock-ii/) 允许多次交易，但同一时间只能持有一只股票。

只要今天比昨天贵，就把这一天的上涨计入答案：

```python
def max_profit(prices: list[int]) -> int:
    profit = 0

    for i in range(1, len(prices)):
        profit += max(0, prices[i] - prices[i - 1])

    return profit
```

例如价格从 1 涨到 5，一次赚 4，等价于把 `1 → 2`、`2 → 4`、`4 → 5` 的所有正差值加起来。这样把一段连续上涨拆成每天交易，不会改变总收益。

这条结论依赖题目没有手续费、冷冻期和交易次数限制。条件一变，局部正收益可能不能独立收下，就要转向动态规划。

### 4.3 摆动序列：只保留峰和谷

[376. 摆动序列](https://leetcode.cn/problems/wiggle-subsequence/) 要求相邻差值正负交替。贪心思想是删除单调坡中间的点，只保留改变方向的峰和谷。

```python
def wiggle_max_length(nums: list[int]) -> int:
    if len(nums) < 2:
        return len(nums)

    prev_diff = 0
    count = 1

    for i in range(1, len(nums)):
        cur_diff = nums[i] - nums[i - 1]

        if (cur_diff > 0 and prev_diff <= 0) or (
            cur_diff < 0 and prev_diff >= 0
        ):
            count += 1
            prev_diff = cur_diff

    return count
```

只有真正形成新方向时才更新 `prev_diff`。遇到相等元素时 `cur_diff == 0`，不要把它当成一次摆动，也不要覆盖上一次有效方向。

## 5. 跳跃问题：把路径压缩成覆盖范围

### 5.1 跳跃游戏：遍历所有已经可达的位置

[55. 跳跃游戏](https://leetcode.cn/problems/jump-game/) 问能否从下标 0 到达最后一个下标。没必要枚举每一种跳法，只要维护当前最远覆盖 `cover`。

```python
def can_jump(nums: list[int]) -> bool:
    cover = 0

    for i, step in enumerate(nums):
        if i > cover:
            return False

        cover = max(cover, i + step)

        if cover >= len(nums) - 1:
            return True

    return True
```

循环能处理 `i` 的前提是 `i <= cover`。一旦出现 `i > cover`，说明中间有断点，后面的下标都到不了。

这里不要纠结“从当前位置到底跳几步”。所有能到达当前位置的路径里，只保留最远覆盖即可。

### 5.2 跳跃游戏 II：一层一层扩张覆盖

[45. 跳跃游戏 II](https://leetcode.cn/problems/jump-game-ii/) 保证能到终点，要求最少跳跃次数。可以把一次跳跃能够覆盖的区间看成 BFS 的一层：

- `current_end`：当前这一步能覆盖到哪里。
- `farthest`：扫描当前层时，下一步最远能覆盖到哪里。
- 扫到 `current_end`，说明当前层处理完，需要再跳一步。

```python
def jump(nums: list[int]) -> int:
    jumps = 0
    current_end = 0
    farthest = 0

    for i in range(len(nums) - 1):
        farthest = max(farthest, i + nums[i])

        if i == current_end:
            jumps += 1
            current_end = farthest

    return jumps
```

循环只到 `len(nums) - 2`。如果把最后一个下标也处理进去，可能在已经到达终点后多算一次跳跃。

两个跳跃题的区别是：

- 55 只问能不能到，维护一个 `cover`。
- 45 问最少几步，要区分当前层边界 `current_end` 和下一层最远边界 `farthest`。

## 6. 全局约束：从失败位置和两个方向拆问题

### 6.1 加油站：总油量决定有没有解，局部亏空决定从哪重开

[134. 加油站](https://leetcode.cn/problems/gas-station/) 中，从站点 `i` 获得 `gas[i]`，去下一站消耗 `cost[i]`，要找能绕一圈的起点。

先看全局：如果总油量小于总消耗，肯定无解。再看局部：从候选起点到当前位置的剩余油量一旦变成负数，那么候选起点到当前位置之间的任何站都不可能作为起点，因为它们只会少拿前面已经积累的油。

```python
def can_complete_circuit(gas: list[int], cost: list[int]) -> int:
    total = 0
    current = 0
    start = 0

    for i in range(len(gas)):
        rest = gas[i] - cost[i]
        total += rest
        current += rest

        if current < 0:
            start = i + 1
            current = 0

    return start if total >= 0 else -1
```

`current < 0` 时不是只排除当前起点，而是一次排除整个失败区间，所以新起点直接设为 `i + 1`。

### 6.2 分发糖果：左右规则分两遍满足

[135. 分发糖果](https://leetcode.cn/problems/candy/) 要求评分更高的孩子比相邻孩子拿到更多糖果，每人至少一个。左右两个约束同时处理很容易互相覆盖，所以拆成两遍：

1. 从左到右，只保证右边评分更高时，右边糖果更多。
2. 从右到左，只保证左边评分更高时，左边糖果更多。
3. 第二遍不能直接覆盖，要取两个方向要求的最大值。

```python
def candy(ratings: list[int]) -> int:
    n = len(ratings)
    candies = [1] * n

    for i in range(1, n):
        if ratings[i] > ratings[i - 1]:
            candies[i] = candies[i - 1] + 1

    for i in range(n - 2, -1, -1):
        if ratings[i] > ratings[i + 1]:
            candies[i] = max(candies[i], candies[i + 1] + 1)

    return sum(candies)
```

遇到“同时满足左边关系和右边关系”的题，可以考虑把两个方向分开处理，最后合并约束。

## 7. 双维度贪心：先固定一个维度

[406. 根据身高重建队列](https://leetcode.cn/problems/queue-reconstruction-by-height/) 中，每个人用 `[h, k]` 表示：身高是 `h`，前面恰好有 `k` 个身高大于等于自己的人。

身高和人数两个维度同时考虑会很乱。先按身高从高到低排序；身高相同时按 `k` 从小到大排序。这样插入当前人时，队列里已经存在的人都不比他矮，直接把他插到下标 `k`，条件就自然满足。

```python
def reconstruct_queue(people: list[list[int]]) -> list[list[int]]:
    people.sort(key=lambda person: (-person[0], person[1]))
    queue = []

    for person in people:
        queue.insert(person[1], person)

    return queue
```

为什么必须先处理高个子？因为矮个子插到高个子前面，不会影响高个子统计“前面有多少人不比我矮”；反过来，高个子后插会改变矮个子的计数。

双维度题的通用思路是：**先让一个维度有序，使它在后续操作中不再被破坏，然后只处理另一个维度。**

相同主维度的次序通常非常关键。这里同身高的人互相都算“身高大于等于”，所以 `k` 小的必须先插；如果写成 `(-h, -k)`，结果就会错。

## 8. 区间问题：排序后只维护一个边界

区间贪心最常见的两种排序方式：

- 想选尽量多的互不重叠区间：按右端点升序，尽快结束，给后面留更多空间。
- 想合并、覆盖或切分区间：按左端点升序，让相交区间连续出现，再维护最远右端点。

### 8.1 无重叠区间：优先保留结束最早的区间

[435. 无重叠区间](https://leetcode.cn/problems/non-overlapping-intervals/) 要删除最少区间，使剩余区间互不重叠。等价问题是：保留尽量多的互不重叠区间。

按右端点从小到大排序。每次保留能接在上一个区间后面的区间：

```python
def erase_overlap_intervals(intervals: list[list[int]]) -> int:
    intervals.sort(key=lambda interval: interval[1])

    kept = 1
    end = intervals[0][1]

    for start, finish in intervals[1:]:
        if start >= end:
            kept += 1
            end = finish

    return len(intervals) - kept
```

选择结束最早的区间，是因为它占用右侧空间最少。若某个最优方案先选了一个结束更晚的区间，把它换成当前结束最早的区间，不会挡住原来能选的后续区间。

下面演示按右端点排序后，怎样逐个保留或删除区间。端点相接不算重叠，所以 `[4, 6]` 后面可以接 `[6, 7]`。

<div class="algo-demo greedy-interval-demo" id="greedy-interval-demo">
  <div class="algo-demo-title"><strong>结束越早，留给后面的空间越多</strong><span class="algo-pill">435. 无重叠区间</span></div>
  <div class="algo-stats">
    <span class="algo-stat">排序：<strong>右端点升序</strong></span>
    <span class="algo-stat">当前边界：<strong data-role="end">—</strong></span>
    <span class="algo-stat">已保留：<strong data-role="kept">0</strong></span>
    <span class="algo-stat">待删除：<strong data-role="removed">0</strong></span>
  </div>
  <div class="greedy-interval-board">
    <div class="greedy-axis" aria-hidden="true"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></div>
    <div class="greedy-interval-list" data-role="intervals"></div>
  </div>
  <div class="greedy-decision" data-role="decision">先按右端点从小到大排序，准备选择第一个区间。</div>
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
    const root = document.getElementById('greedy-interval-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const intervals = [
      { name: 'A', start: 1, end: 3 },
      { name: 'B', start: 2, end: 5 },
      { name: 'C', start: 4, end: 6 },
      { name: 'D', start: 6, end: 7 },
      { name: 'E', start: 5, end: 9 }
    ]

    const steps = [
      { current: -1, end: null, kept: [], removed: [], decision: '按右端点升序：A → B → C → D → E', note: '排序完成。之后只维护上一个已保留区间的右端点 end。' },
      { current: 0, end: 3, kept: [0], removed: [], decision: '保留 A [1, 3]，end = 3', note: '第一个区间结束最早，先保留它；后续区间只要 start ≥ 3 就能接上。' },
      { current: 1, end: 3, kept: [0], removed: [1], decision: '删除 B [2, 5]：2 < 3', note: 'B 的起点落在 A 内部，发生重叠。继续保留结束更早的 A，右侧空间更大。' },
      { current: 2, end: 6, kept: [0, 2], removed: [1], decision: '保留 C [4, 6]，end = 6', note: 'C 的起点 4 ≥ 3，可以接在 A 后面。更新边界为 6。' },
      { current: 3, end: 7, kept: [0, 2, 3], removed: [1], decision: '保留 D [6, 7]，end = 7', note: 'D 的起点正好等于当前边界 6。端点相接不算重叠，可以保留。' },
      { current: 4, end: 7, kept: [0, 2, 3], removed: [1, 4], decision: '删除 E [5, 9]：5 < 7', note: 'E 与已经保留的区间重叠。最终保留 3 个区间，最少删除 2 个。' }
    ]

    const listEl = root.querySelector('[data-role="intervals"]')
    const endEl = root.querySelector('[data-role="end"]')
    const keptEl = root.querySelector('[data-role="kept"]')
    const removedEl = root.querySelector('[data-role="removed"]')
    const decisionEl = root.querySelector('[data-role="decision"]')
    const noteEl = root.querySelector('[data-role="note"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const prevBtn = root.querySelector('[data-action="prev"]')
    const nextBtn = root.querySelector('[data-action="next"]')
    const playBtn = root.querySelector('[data-action="play"]')
    const resetBtn = root.querySelector('[data-action="reset"]')
    let index = 0
    let timer = null

    const stop = () => {
      if (timer) window.clearInterval(timer)
      timer = null
      playBtn.textContent = '播放'
    }

    const render = () => {
      const step = steps[index]
      listEl.innerHTML = intervals.map((interval, intervalIndex) => {
        const classes = ['greedy-interval-row']
        if (step.kept.includes(intervalIndex)) classes.push('kept')
        if (step.removed.includes(intervalIndex)) classes.push('removed')
        if (step.current === intervalIndex) classes.push('current')
        const left = interval.start * 10
        const width = (interval.end - interval.start) * 10
        return '<div class="' + classes.join(' ') + '">' +
          '<span class="greedy-interval-name">' + interval.name + '</span>' +
          '<div class="greedy-track"><span class="greedy-bar" style="left:' + left + '%;width:' + width + '%">[' + interval.start + ', ' + interval.end + ']</span></div>' +
          '<span class="greedy-interval-status">' +
          (step.kept.includes(intervalIndex) ? '保留' : step.removed.includes(intervalIndex) ? '删除' : '待判断') +
          '</span></div>'
      }).join('')

      endEl.textContent = step.end === null ? '—' : step.end
      keptEl.textContent = step.kept.length
      removedEl.textContent = step.removed.length
      decisionEl.textContent = step.decision
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
      }, 1450)
    })

    render()
  })()
</script>

### 8.2 最少弓箭：维护重叠区间的公共右边界

[452. 用最少数量的箭引爆气球](https://leetcode.cn/problems/minimum-number-of-arrows-to-burst-balloons/) 中，一支箭可以射穿所有包含同一个横坐标的气球区间。

仍然按右端点升序。第一支箭放在第一个区间的右端点；后面的区间若起点大于箭的位置，说明当前箭射不到，需要增加一支箭并更新位置。

```python
def find_min_arrow_shots(points: list[list[int]]) -> int:
    if not points:
        return 0

    points.sort(key=lambda point: point[1])
    arrows = 1
    position = points[0][1]

    for start, end in points[1:]:
        if start > position:
            arrows += 1
            position = end

    return arrows
```

这里和无重叠区间的边界条件不同：

- 无重叠区间中，`start >= end` 表示不重叠，可以保留。
- 气球中，`start == position` 仍然能被箭射中，只有 `start > position` 才需要新箭。

### 8.3 合并区间：按左端点排序，扩张最远右边界

[56. 合并区间](https://leetcode.cn/problems/merge-intervals/) 不是选结束最早的区间，而是把相交区间合成一段。按左端点升序后，相交区间会连续出现。

```python
def merge(intervals: list[list[int]]) -> list[list[int]]:
    intervals.sort(key=lambda interval: interval[0])
    merged = [intervals[0][:]]

    for start, end in intervals[1:]:
        last = merged[-1]

        if start <= last[1]:
            last[1] = max(last[1], end)
        else:
            merged.append([start, end])

    return merged
```

不要在重叠时直接把右端点写成 `end`。当前区间可能完全被前一个区间包含，所以必须取 `max(last[1], end)`。

### 8.4 划分字母区间：当前位置追上最远终点才切

[763. 划分字母区间](https://leetcode.cn/problems/partition-labels/) 要把字符串切成尽量多的片段，使同一字母最多出现在一个片段中。

先记录每个字符最后出现的位置。扫描当前片段时，不断扩张片段最远终点；当下标 `i` 追上这个终点，当前片段才可以安全结束。

```python
def partition_labels(s: str) -> list[int]:
    last = {char: i for i, char in enumerate(s)}
    ans = []
    start = 0
    end = 0

    for i, char in enumerate(s):
        end = max(end, last[char])

        if i == end:
            ans.append(end - start + 1)
            start = i + 1

    return ans
```

虽然题目没有直接给区间，但每个字符都对应一个 `[第一次出现位置, 最后出现位置]`。本质仍然是扫描区间并维护最远右边界。

## 9. 特殊贪心：从右向左修改与树上状态

### 9.1 单调递增数字：违规时让高位减一，后面全部变 9

[738. 单调递增的数字](https://leetcode.cn/problems/monotone-increasing-digits/) 要找小于等于 `n` 的最大整数，使每一位数字从左到右不下降。

若出现 `digits[i - 1] > digits[i]`，为了让结果尽量大，应把前一位减 1，并把它后面的所有位都设成 9。必须从右向左检查，因为高位减 1 后可能继续破坏更左边的单调性。

```python
def monotone_increasing_digits(n: int) -> int:
    digits = list(str(n))
    marker = len(digits)

    for i in range(len(digits) - 1, 0, -1):
        if digits[i - 1] > digits[i]:
            digits[i - 1] = str(int(digits[i - 1]) - 1)
            marker = i

    for i in range(marker, len(digits)):
        digits[i] = '9'

    return int(''.join(digits))
```

例如 `332`：先处理末尾违规得到 `329` 的方向，随后发现前面的 `3 > 2`，继续调整，最终得到 `299`。如果从左向右只扫一遍，就容易漏掉这种连锁变化。

### 9.2 监控二叉树：摄像头尽量放在叶子父节点

[968. 监控二叉树](https://leetcode.cn/problems/binary-tree-cameras/) 中，一个摄像头可以覆盖父节点、自己和直接子节点。叶子节点放摄像头利用率低，更好的策略是从下往上，让叶子节点的父节点放摄像头。

后序遍历时给节点定义三种状态：

```text
0：当前节点没有被覆盖
1：当前节点放了摄像头
2：当前节点已经被覆盖，但没有摄像头
```

空节点应该视为“已经覆盖”，避免在叶子节点上放摄像头。

```python
def min_camera_cover(root: TreeNode) -> int:
    cameras = 0

    def dfs(node: TreeNode | None) -> int:
        nonlocal cameras

        if node is None:
            return 2

        left = dfs(node.left)
        right = dfs(node.right)

        if left == 0 or right == 0:
            cameras += 1
            return 1

        if left == 1 or right == 1:
            return 2

        return 0

    if dfs(root) == 0:
        cameras += 1

    return cameras
```

最后要单独检查根节点。如果根节点仍是未覆盖状态，它没有父节点可以补摄像头，只能自己放一个。

这题代码像树形 DP，但选择规则是贪心的：从叶子向上，只有孩子未覆盖时才在当前节点放摄像头，让一个摄像头尽量覆盖三层关系。

## 10. 常见错误和复习方法

### 10.1 只记排序，不记排序理由

下面这些排序不能混：

| 问题 | 排序规则 | 原因 |
|---|---|---|
| 分发饼干 | 胃口、饼干都升序 | 用刚好够的小资源满足小需求 |
| 重建队列 | 身高降序，`k` 升序 | 先固定高个子，再按 `k` 插入 |
| 无重叠区间 | 右端点升序 | 尽早结束，给后面留空间 |
| 合并区间 | 左端点升序 | 让相交区间连续出现 |
| K 次取反 | 绝对值降序 | 先拿最大收益，最后承受最小损失 |

复习时不要只背 `sort(key=...)`，要用一句话说明“排序后，为什么当前选择不会伤害后面的答案”。

### 10.2 边界相等是否算冲突

区间题最常错的是 `<`、`<=`、`>`、`>=`：

- `[1, 2]` 和 `[2, 3]` 在无重叠区间里不算重叠。
- 气球区间 `[1, 2]` 和 `[2, 3]` 可以被 `x = 2` 的同一支箭射中。
- 合并区间里 `[1, 2]` 和 `[2, 3]` 要合并。

不要凭模板写比较符号，要回到题目对端点的定义。

### 10.3 原地排序会修改输入

```python
intervals.sort(...)
people.sort(...)
```

这些写法会修改原列表。LeetCode 通常允许，但如果业务代码要求保留输入，应改用：

```python
ordered = sorted(intervals, key=lambda interval: interval[1])
```

### 10.4 一个实用的贪心检查清单

写完一道贪心题，可以检查：

1. 每一步具体在贪什么：更小资源、更早结束、更远覆盖，还是更大收益？
2. 被丢掉的选择为什么以后不可能更好？
3. 是否需要排序，排序键和相同元素的次序是什么？
4. 状态变量的含义是否稳定，比如 `cover`、`end`、`farthest`？
5. 端点相等算不算冲突？
6. 空数组、单元素、全负数、全重叠这些边界是否处理？
7. 题目一旦增加手续费、次数限制或额外依赖，当前贪心是否还成立？

## 11. 复习总览

- 贪心每一步做当前最优选择，并且不撤销；难点是证明局部最优能得到全局最优。
- 常用论证是交换论证和覆盖论证；拿不准时先构造小反例。
- 分发问题先整理供需顺序，让刚好够用的资源匹配当前需求，把更稀缺或更通用的资源留给后面。
- 最大子数组和遇到负贡献就重新开始；股票 II 把所有正差值收下；摆动序列只保留峰和谷。
- 跳跃游戏把具体路径压缩成最远覆盖；最少跳跃还要区分当前层边界和下一层最远边界。
- 加油站中总和决定有没有解，局部亏空决定从哪里重新开始。
- 分发糖果把左右约束分两遍处理，最后取最大值合并。
- 双维度问题先固定一个维度；重建队列按身高降序、`k` 升序，再按 `k` 插入。
- 选最多互不重叠区间时按右端点升序；合并区间时按左端点升序。
- 区间题必须单独确认端点相等是否算冲突。
- 单调递增数字从右向左处理违规位；二叉树监控从下往上让摄像头覆盖更多节点。

贪心代码往往只有一次排序和一次遍历，但每个排序方向、每个边界判断都对应一段正确性理由。复习时不要只记最终代码，先说清楚“当前选择是什么、丢掉谁、为什么丢掉后不会后悔”。

<div class="algorithm-module-nav algorithm-module-nav-bottom">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/backtracking/">上一篇：回溯算法模板</a>
  <a href="/algorithm/dynamic-programming/">下一篇：动态规划与背包问题</a>
</div>
