---
title: 代码随想录刷题笔记：单调栈
date:
top_img: /img/algorithm-header-code.webp
description: 单调栈刷题笔记，整理下一个更大或更小元素、每日温度、环形数组、接雨水和柱状图最大矩形的题型识别、统一模板与边界处理。
categories:
  - Notes
  - Algorithm
tags:
  - LeetCode
  - CodeThinking
  - Python
  - Monotonic Stack
toc: true
toc_number: false
katex: true
---

<div class="algorithm-module-nav algorithm-module-nav-top">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/dynamic-programming/">上一篇：动态规划与背包问题</a>
  <a href="/algorithm/graph-theory/">下一篇：图论</a>
</div>

## 1. 什么时候想到单调栈

单调栈最擅长解决的是：**对每个元素，寻找某一侧第一个比它更大或更小的元素。**

如果直接从每个位置向后扫描，最坏需要 `O(n^2)`；单调栈把还没有找到答案的位置暂时保存起来，等到一个能够解决它们的新元素出现时，再批量结算。

常见题目信号：

| 题目描述 | 单调栈要寻找的关系 |
|---|---|
| 还要等几天才会更暖 | 右侧第一个严格更大的元素 |
| 下一个更大元素 | 右侧第一个严格更大的元素 |
| 下一个更小元素 | 右侧第一个严格更小的元素 |
| 每根柱子能向左右延伸多远 | 左右第一个更矮的柱子 |
| 凹槽能够装多少水 | 当前低点左右的挡板 |
| 子数组最小值或最大值贡献 | 每个元素作为最值的左右边界 |

单调栈通常不是为了模拟入栈、出栈本身，而是利用栈顶表示**离当前位置最近、并且仍在等待答案的候选位置**。

它和几个相近结构的区别：

| 数据结构 | 主要解决什么问题 | 过期元素怎样离开 |
|---|---|---|
| 普通栈 | 括号匹配、表达式、撤销、路径 | 由业务顺序决定 |
| 单调栈 | 最近更大或更小、左右边界 | 被当前元素破坏单调性时弹出 |
| 单调队列 | 固定滑动窗口中的最大值或最小值 | 队首过期、队尾失去竞争力 |
| 堆 | 动态集合中的全局最大值或最小值 | 删除堆顶，或惰性删除 |

## 2. 单调性到底怎样维护

### 2.1 栈里优先保存下标

大多数题目应该保存下标，而不是只保存数值：

```text
stack = [index1, index2, ...]
```

通过下标可以同时得到：

- 元素值：`nums[stack[-1]]`
- 距离：`current - stack[-1]`
- 左右边界：弹出后查看新的 `stack[-1]`
- 正确处理重复值：相同数值处在不同位置，答案可能不同

只有题目保证元素互不相同，并且只需要返回对应数值时，才适合直接保存数值。

### 2.2 栈的名称按“栈底到栈顶”的数值顺序描述

寻找右侧第一个严格更大元素时，栈内数值从栈底到栈顶保持非递增：

```text
栈底 [大, ..., 小] 栈顶
```

一个更大的当前值到来后，会不断弹出栈顶较小值；这些被弹出的下标终于找到了右侧第一个更大元素。

严格与非严格关系决定相等元素是否弹出：

| 要找的答案 | 栈底到栈顶 | 弹出条件 |
|---|---|---|
| 下一个严格更大 | 非递增，相等可共存 | `stack_top < current` |
| 下一个大于等于 | 严格递减 | `stack_top <= current` |
| 下一个严格更小 | 非递减，相等可共存 | `stack_top > current` |
| 下一个小于等于 | 严格递增 | `stack_top >= current` |

不要只背“递增栈找更大”或“递减栈找更大”。不同资料可能按栈顶观察方向命名，容易产生歧义；直接写出**栈底到栈顶的关系和 `while` 条件**更可靠。

### 2.3 每个下标只会入栈一次、出栈一次

代码里虽然有嵌套的 `while`，但一个下标一旦弹出就不会再次进入同一个栈：

```text
每个下标入栈最多 1 次
每个下标出栈最多 1 次
总操作次数不超过常数倍 n
```

因此一次完整扫描的时间复杂度是 `O(n)`，栈的空间复杂度是 `O(n)`。这叫摊还分析，不是把内外循环简单相乘成 `O(n^2)`。

## 3. 一套统一的“下一个严格更大”模板

先写一个返回下标的通用版本：

```python
def next_strictly_greater_indices(nums: list[int]) -> list[int]:
    answer = [-1] * len(nums)
    stack: list[int] = []

    for current in range(len(nums)):
        while stack and nums[stack[-1]] < nums[current]:
            waiting = stack.pop()
            answer[waiting] = current

        stack.append(current)

    return answer
```

下面用 `nums = [2, 1, 2, 4, 3]` 把模板逐句展开。这个例子特意放了两个相等的 `2`：当当前值也是 `2` 时，`2 < 2` 为假，所以旧的 `2` 仍要留在栈中；直到 `4` 到来，它们才依次找到答案。

<div class="algo-demo monotonic-stack-template-demo" id="next-greater-stack-demo">
  <div class="algo-demo-title">
    <strong>下一个严格更大：等待者怎样被当前元素结算</strong>
    <span class="algo-pill">nums = [2, 1, 2, 4, 3]</span>
  </div>
  <div class="algo-stats">
    <span class="algo-stat">动作：<strong data-role="action"></strong></span>
    <span class="algo-stat">当前：<strong data-role="current"></strong></span>
    <span class="algo-stat">判断：<strong data-role="comparison"></strong></span>
  </div>
  <div class="ms-code-flow" aria-label="当前执行的模板代码">
    <code data-line="read">for current in range(len(nums))</code>
    <code data-line="compare">while stack and nums[stack[-1]] &lt; nums[current]</code>
    <code data-line="resolve">waiting = stack.pop(); answer[waiting] = current</code>
    <code data-line="append">stack.append(current)</code>
  </div>
  <div class="ms-array" data-role="array" role="list" aria-label="输入数组"></div>
  <div class="ms-lanes">
    <div class="ms-lane">
      <span class="ms-lane-title">stack：栈底 → 栈顶</span>
      <div class="ms-stack" data-role="stack" aria-live="polite"></div>
    </div>
    <div class="ms-lane">
      <span class="ms-lane-title">answer：保存下一个严格更大元素的下标</span>
      <div class="ms-answer" data-role="answer" aria-live="polite"></div>
    </div>
  </div>
  <div class="algo-note" data-role="note" aria-live="polite"></div>
  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button>
    <button type="button" data-action="next">下一步</button>
    <button type="button" data-action="play">播放</button>
    <button type="button" data-action="reset">重置</button>
    <label class="ms-speed">速度
      <select data-role="speed" aria-label="动画播放速度">
        <option value="1400">慢速</option>
        <option value="900" selected>正常</option>
        <option value="550">快速</option>
      </select>
    </label>
    <span class="algo-step" data-role="step"></span>
  </div>
</div>

<script>
  (() => {
    const root = document.getElementById('next-greater-stack-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const nums = [2, 1, 2, 4, 3]
    const stack = []
    const answer = Array(nums.length).fill(-1)
    const resolved = Array(nums.length).fill(false)
    const steps = []

    const saveStep = ({
      action,
      line = null,
      currentIndex = -1,
      comparedIndex = null,
      waitingIndex = null,
      compareResult = null,
      final = false,
      note
    }) => {
      steps.push({
        action,
        line,
        currentIndex,
        comparedIndex,
        waitingIndex,
        compareResult,
        final,
        stack: stack.slice(),
        answer: answer.slice(),
        resolved: resolved.slice(),
        note
      })
    }

    saveStep({
      action: '初始化',
      note: 'answer 先全部设为 -1；stack 为空，表示还没有等待答案的下标。'
    })

    nums.forEach((num, currentIndex) => {
      saveStep({
        action: '读取当前元素',
        line: 'read',
        currentIndex,
        note: '读取 nums[' + currentIndex + '] = ' + num + '，准备和栈顶等待者比较。'
      })

      while (stack.length) {
        const comparedIndex = stack[stack.length - 1]
        const compareResult = nums[comparedIndex] < num

        saveStep({
          action: compareResult ? '当前值更大' : '不能弹出栈顶',
          line: 'compare',
          currentIndex,
          comparedIndex,
          compareResult,
          note: compareResult
            ? 'nums[' + comparedIndex + '] = ' + nums[comparedIndex] + ' < ' + num + '，当前元素就是这个栈顶下标右侧遇到的第一个严格更大值。'
            : 'nums[' + comparedIndex + '] = ' + nums[comparedIndex] + ' < ' + num + ' 不成立。' +
              (nums[comparedIndex] === num
                ? ' 两个值相等，但题目要求严格更大，所以旧下标继续等待。'
                : ' 当前值不够大，栈顶继续等待。')
        })

        if (!compareResult) break

        const waitingIndex = stack.pop()
        answer[waitingIndex] = currentIndex
        resolved[waitingIndex] = true
        saveStep({
          action: '弹出并写入答案',
          line: 'resolve',
          currentIndex,
          waitingIndex,
          note: '弹出 waiting = ' + waitingIndex + '，写入 answer[' + waitingIndex + '] = ' + currentIndex +
            '。继续查看新的栈顶，因为当前值可能一次结算多个等待者。'
        })
      }

      stack.push(currentIndex)
      saveStep({
        action: '当前下标入栈',
        line: 'append',
        currentIndex,
        note: '下标 ' + currentIndex + ' 入栈，开始等待它右侧第一个严格更大的元素。栈中对应值仍保持从栈底到栈顶非递增。'
      })
    })

    saveStep({
      action: '扫描结束',
      final: true,
      note: '栈中剩余下标 3 和 4，说明它们右侧没有严格更大的元素，因此答案保留初始化值 -1。最终 answer = [3, 2, 3, -1, -1]。'
    })

    const actionEl = root.querySelector('[data-role="action"]')
    const currentEl = root.querySelector('[data-role="current"]')
    const comparisonEl = root.querySelector('[data-role="comparison"]')
    const arrayEl = root.querySelector('[data-role="array"]')
    const stackEl = root.querySelector('[data-role="stack"]')
    const answerEl = root.querySelector('[data-role="answer"]')
    const noteEl = root.querySelector('[data-role="note"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const speedEl = root.querySelector('[data-role="speed"]')
    const codeLines = root.querySelectorAll('[data-line]')
    const prevBtn = root.querySelector('[data-action="prev"]')
    const nextBtn = root.querySelector('[data-action="next"]')
    const playBtn = root.querySelector('[data-action="play"]')
    const resetBtn = root.querySelector('[data-action="reset"]')
    let index = 0
    let timer = null

    const stop = () => {
      if (timer) window.clearTimeout(timer)
      timer = null
      playBtn.textContent = '播放'
    }

    const renderArray = state => {
      arrayEl.innerHTML = nums.map((value, cellIndex) => {
        const classes = ['ms-cell']
        if (state.stack.includes(cellIndex)) classes.push('in-stack')
        if (cellIndex === state.currentIndex) classes.push('is-current')
        if (cellIndex === state.comparedIndex) {
          classes.push(state.compareResult ? 'compare-true' : 'compare-false')
        }
        if (cellIndex === state.waitingIndex) classes.push('is-resolved')

        const labels = ['下标 ' + cellIndex, '值 ' + value]
        if (state.stack.includes(cellIndex)) labels.push('正在栈中等待')
        if (cellIndex === state.currentIndex) labels.push('当前元素')
        if (cellIndex === state.comparedIndex) labels.push('正在与当前元素比较')
        if (cellIndex === state.waitingIndex) labels.push('刚刚找到答案')

        return '<div class="' + classes.join(' ') + '" role="listitem" aria-label="' + labels.join('，') + '">' +
          (cellIndex === state.currentIndex ? '<small class="ms-pointer">current</small>' : '') +
          '<strong>' + value + '</strong><span>i=' + cellIndex + '</span></div>'
      }).join('')
    }

    const renderStack = state => {
      let html = ''

      if (!state.stack.length) {
        html = '<span class="ms-empty">空栈</span>'
      } else {
        html = state.stack.map((stackIndex, position) => {
          let label = ''
          if (state.stack.length === 1) label = '栈底 / 栈顶'
          else if (position === 0) label = '栈底'
          else if (position === state.stack.length - 1) label = '栈顶'

          const active = stackIndex === state.comparedIndex ? ' is-compared' : ''
          return '<div class="ms-stack-item' + active + '">' +
            '<small>' + label + '</small><strong>' + nums[stackIndex] + '</strong><span>i=' + stackIndex + '</span></div>'
        }).join('<i class="ms-arrow">→</i>')
      }

      if (state.waitingIndex !== null) {
        html += '<span class="ms-pop-result">弹出 i=' + state.waitingIndex +
          ' → answer[' + state.waitingIndex + '] = ' + state.currentIndex + '</span>'
      }

      stackEl.innerHTML = html
    }

    const renderAnswer = state => {
      answerEl.innerHTML = state.answer.map((value, answerIndex) => {
        const classes = ['ms-answer-item']
        if (state.resolved[answerIndex]) classes.push('is-written')
        if (answerIndex === state.waitingIndex) classes.push('just-written')
        if (state.final && !state.resolved[answerIndex]) classes.push('final-default')

        const meaning = state.resolved[answerIndex]
          ? '下标 ' + answerIndex + ' 的下一个严格更大元素位于下标 ' + value
          : state.final
            ? '下标 ' + answerIndex + ' 右侧不存在严格更大元素'
            : '下标 ' + answerIndex + ' 仍未找到答案，当前保持 -1'

        return '<div class="' + classes.join(' ') + '" aria-label="' + meaning + '">' +
          '<strong>' + value + '</strong><span>answer[' + answerIndex + ']</span></div>'
      }).join('')
    }

    const render = () => {
      const state = steps[index]
      actionEl.textContent = state.action
      currentEl.textContent = state.currentIndex < 0
        ? '—'
        : 'i=' + state.currentIndex + '，nums[i]=' + nums[state.currentIndex]

      if (state.comparedIndex !== null) {
        comparisonEl.textContent = nums[state.comparedIndex] + ' < ' + nums[state.currentIndex] +
          ' → ' + (state.compareResult ? '成立' : '不成立')
      } else if (state.waitingIndex !== null) {
        comparisonEl.textContent = 'answer[' + state.waitingIndex + '] = ' + state.currentIndex
      } else {
        comparisonEl.textContent = '—'
      }

      codeLines.forEach(line => {
        line.classList.toggle('active', line.dataset.line === state.line)
      })
      renderArray(state)
      renderStack(state)
      renderAnswer(state)
      noteEl.textContent = state.note
      stepEl.textContent = '第 ' + (index + 1) + ' / ' + steps.length + ' 步'
      prevBtn.disabled = index === 0
      nextBtn.disabled = index === steps.length - 1
    }

    const scheduleNext = () => {
      timer = window.setTimeout(() => {
        if (index >= steps.length - 1) {
          stop()
          return
        }
        index += 1
        render()
        if (index >= steps.length - 1) {
          stop()
          return
        }
        scheduleNext()
      }, Number(speedEl.value))
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
      if (index >= steps.length - 1) index = 0
      render()
      playBtn.textContent = '暂停'
      scheduleNext()
    })

    speedEl.addEventListener('change', () => {
      if (!timer) return
      window.clearTimeout(timer)
      scheduleNext()
    })

    render()
  })()
</script>

理解模板时只看两个角色：

```text
waiting：过去出现、仍在等待答案的下标
current：当前到来、可能解决若干 waiting 的下标
```

从这个模板可以直接改出不同返回形式：

```text
返回更大元素的下标：answer[waiting] = current
返回更大元素的数值：answer[waiting] = nums[current]
返回还要等待的距离：answer[waiting] = current - waiting
```

遍历结束后仍留在栈中的位置，说明右侧不存在符合条件的元素，因此保留初始化答案，例如 `-1` 或 `0`。

写题前先回答四个问题：

1. 栈里保存下标还是数值？
2. 谁在等待答案，谁触发结算？
3. 要找严格更大、更大等于、严格更小，还是更小等于？
4. 找不到答案时应该返回 `-1`、`0` 还是数组边界？

## 4. [739. 每日温度](https://leetcode.cn/problems/daily-temperatures/)：单调栈入门题

题目要求每一天距离右侧第一个更高温度还有几天，因此：

```text
栈中保存仍未找到更暖日期的下标
当前温度更高时，批量结算栈顶日期
答案是两个下标之差
```

```python
def daily_temperatures(temperatures: list[int]) -> list[int]:
    answer = [0] * len(temperatures)
    stack: list[int] = []

    for current, temperature in enumerate(temperatures):
        while (
            stack
            and temperatures[stack[-1]] < temperature
        ):
            waiting = stack.pop()
            answer[waiting] = current - waiting

        stack.append(current)

    return answer
```

以 `[73, 74, 75, 71, 69, 72, 76, 73]` 为例：

| 当前温度 | 发生的出栈 | 结算结果 | 处理后的待定温度 |
|---:|---|---|---|
| 73 | 无 | 无 | `[73]` |
| 74 | 73 | 第 0 天等待 1 天 | `[74]` |
| 75 | 74 | 第 1 天等待 1 天 | `[75]` |
| 71 | 无 | 无 | `[75, 71]` |
| 69 | 无 | 无 | `[75, 71, 69]` |
| 72 | 69、71 | 第 4 天等 1 天，第 3 天等 2 天 | `[75, 72]` |
| 76 | 72、75 | 第 5 天等 1 天，第 2 天等 4 天 | `[76]` |
| 73 | 无 | 无 | `[76, 73]` |

相同温度不算“更暖”，所以判断条件必须是：

```python
temperatures[stack[-1]] < temperature
```

如果写成 `<=`，相同温度也会被错误地当成答案。最后仍在栈里的日期右侧没有更高温度，答案保持为 0。

## 5. 下一个更大元素

### 5.1 [496. 下一个更大元素 I](https://leetcode.cn/problems/next-greater-element-i/)：先处理全集，再回答子集

`nums1` 是 `nums2` 的子集，并且元素互不相同。可以先扫描 `nums2`，记录每个数的下一个更大元素，再按 `nums1` 的顺序取答案：

```python
def next_greater_element(
    nums1: list[int],
    nums2: list[int],
) -> list[int]:
    next_greater: dict[int, int] = {}
    stack: list[int] = []

    for current in nums2:
        while stack and stack[-1] < current:
            waiting = stack.pop()
            next_greater[waiting] = current

        stack.append(current)

    return [
        next_greater.get(value, -1)
        for value in nums1
    ]
```

这里可以直接保存数值，是因为题目保证 `nums2` 中所有整数互不相同。如果允许重复值，`value -> answer` 无法区分不同位置，应该改成保存下标。

### 5.2 [503. 下一个更大元素 II](https://leetcode.cn/problems/next-greater-element-ii/)：用取模模拟环形数组

环形数组中，末尾元素还可以继续查看数组开头。把下标范围扫描两遍，就相当于把数组复制了一份：

```python
def next_greater_elements(nums: list[int]) -> list[int]:
    size = len(nums)
    answer = [-1] * size
    stack: list[int] = []

    for step in range(2 * size):
        current = step % size

        while (
            stack
            and nums[stack[-1]] < nums[current]
        ):
            waiting = stack.pop()
            answer[waiting] = nums[current]

        # 第二遍只负责帮助第一遍的下标找到答案。
        if step < size:
            stack.append(current)

    return answer
```

第二遍不要再次把下标入栈，否则同一个位置会重复等待答案，既增加无效操作，也让状态难以解释。

取模只是模拟访问顺序：

```text
step：0, 1, ..., n-1, n, ..., 2n-1
下标：0, 1, ..., n-1, 0, ..., n-1
```

<span id="trapping-rain-water-1d" class="algorithm-section-anchor"></span>

## 6. [42. 接雨水](https://leetcode.cn/problems/trapping-rain-water/)：弹出的是凹槽底部

接雨水使用单调栈时，栈中保存尚未找到右侧挡板的柱子下标。当前柱子比栈顶更高，说明出现了右挡板，可以按水平方向计算一层积水。

弹出一个凹槽底部 `bottom` 后：

```text
right = 当前下标
left = 弹出 bottom 后的新栈顶
宽度 = right - left - 1
有效水位 = min(height[left], height[right])
积水高度 = 有效水位 - height[bottom]
```

```python
def trap(height: list[int]) -> int:
    water = 0
    stack: list[int] = []

    for right, right_height in enumerate(height):
        while (
            stack
            and height[stack[-1]] < right_height
        ):
            bottom = stack.pop()

            # 没有左挡板，无法形成凹槽。
            if not stack:
                break

            left = stack[-1]
            width = right - left - 1
            bounded_height = (
                min(height[left], right_height)
                - height[bottom]
            )
            water += width * bounded_height

        stack.append(right)

    return water
```

下面用 <code>height = [4, 2, 0, 3, 2, 5]</code> 按栈的实际结算顺序画出地形。黑色矩形是柱子，蓝色方格是已经计算出的水；每次弹出 <code>bottom</code> 后，图中会标出 <code>left</code>、<code>bottom</code> 和 <code>right</code>，再把这一层水横向填进去。

<div class="algo-demo trapping-rain-water-demo" id="trapping-rain-water-demo">
  <div class="algo-demo-title">
    <strong>接雨水：凹槽闭合时横向填一层水</strong>
    <code>height = [4, 2, 0, 3, 2, 5]</code>
  </div>
  <div class="rw-status" aria-live="polite">
    <span>动作 <strong data-role="action"></strong></span>
    <span>位置 <strong data-role="positions"></strong></span>
    <span>累计水量 <strong data-role="water"></strong></span>
  </div>
  <div class="rw-chart" id="rainwater-chart" data-role="chart"></div>
  <div class="rw-formula" data-role="formula" aria-live="polite"></div>
  <div class="rw-code-flow" aria-label="当前执行的接雨水代码">
    <code data-line="read">for right, right_height in enumerate(height)</code>
    <code data-line="compare">while stack and height[stack[-1]] &lt; right_height</code>
    <code data-line="pop">bottom = stack.pop()</code>
    <code data-line="guard">if not stack: break</code>
    <code data-line="fill">left = stack[-1]; water += width * bounded_height</code>
    <code data-line="append">stack.append(right)</code>
  </div>
  <div class="rw-stack-row">
    <span>stack（栈底 → 栈顶）</span>
    <div class="rw-stack" data-role="stack" aria-live="polite"></div>
  </div>
  <div class="algo-note" data-role="note" aria-live="polite"></div>
  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button>
    <button type="button" data-action="next">下一步</button>
    <button type="button" data-action="play">播放</button>
    <button type="button" data-action="reset">重置</button>
    <label class="rw-speed">速度
      <select data-role="speed" aria-label="接雨水动画播放速度">
        <option value="1500">慢速</option>
        <option value="900" selected>正常</option>
        <option value="550">快速</option>
      </select>
    </label>
    <span class="algo-step" data-role="step"></span>
  </div>
</div>

<script>
  (() => {
    const root = document.getElementById('trapping-rain-water-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const height = [4, 2, 0, 3, 2, 5]
    const stack = []
    const waterCells = new Set()
    const steps = []
    let water = 0

    const saveStep = ({
      action,
      line = null,
      rightIndex = null,
      bottomIndex = null,
      leftIndex = null,
      compareResult = null,
      layerWidth = null,
      layerHeight = null,
      layerBottom = null,
      layerTop = null,
      addedWater = 0,
      newCells = [],
      final = false,
      note
    }) => {
      steps.push({
        action,
        line,
        rightIndex,
        bottomIndex,
        leftIndex,
        compareResult,
        layerWidth,
        layerHeight,
        layerBottom,
        layerTop,
        addedWater,
        newCells: newCells.slice(),
        final,
        stack: stack.slice(),
        water,
        waterCells: Array.from(waterCells),
        note
      })
    }

    saveStep({
      action: '初始化',
      note: '柱状地形已经给出。stack 为空，water = 0；接下来从左到右寻找能够闭合凹槽的右挡板。'
    })

    height.forEach((rightHeight, rightIndex) => {
      saveStep({
        action: '读取右侧柱子',
        line: 'read',
        rightIndex,
        note: '读取 right = ' + rightIndex + '，height[right] = ' + rightHeight + '。'
      })

      while (stack.length) {
        const candidate = stack[stack.length - 1]
        const compareResult = height[candidate] < rightHeight

        saveStep({
          action: compareResult ? '右侧柱更高，凹槽可能闭合' : '右侧柱不够高',
          line: 'compare',
          rightIndex,
          bottomIndex: candidate,
          compareResult,
          note: '比较 height[' + candidate + '] = ' + height[candidate] + ' 与 height[' +
            rightIndex + '] = ' + rightHeight + '：' + height[candidate] + ' < ' +
            rightHeight + (compareResult ? ' 成立，弹出栈顶作为凹槽底部。' : ' 不成立，本轮不再弹栈。')
        })

        if (!compareResult) break

        const bottomIndex = stack.pop()
        saveStep({
          action: '弹出凹槽底部',
          line: 'pop',
          rightIndex,
          bottomIndex,
          note: '弹出 bottom = ' + bottomIndex + '。现在必须查看弹出后的新栈顶，才能确定左挡板。'
        })

        if (!stack.length) {
          saveStep({
            action: '没有左挡板',
            line: 'guard',
            rightIndex,
            bottomIndex,
            note: 'bottom 弹出后 stack 为空，左侧没有挡板，无法形成凹槽；本次不增加水量。'
          })
          break
        }

        const leftIndex = stack[stack.length - 1]
        const layerWidth = rightIndex - leftIndex - 1
        const layerTop = Math.min(height[leftIndex], rightHeight)
        const layerBottom = height[bottomIndex]
        const layerHeight = layerTop - layerBottom
        const addedWater = layerWidth * layerHeight
        const newCells = []

        for (let column = leftIndex + 1; column < rightIndex; column += 1) {
          for (let level = layerBottom; level < layerTop; level += 1) {
            if (level < height[column]) continue
            const key = column + ':' + level
            if (waterCells.has(key)) continue
            waterCells.add(key)
            newCells.push(key)
          }
        }

        water += addedWater
        saveStep({
          action: '横向填入一层水',
          line: 'fill',
          rightIndex,
          bottomIndex,
          leftIndex,
          layerWidth,
          layerHeight,
          layerBottom,
          layerTop,
          addedWater,
          newCells,
          note: 'left = ' + leftIndex + '，bottom = ' + bottomIndex + '，right = ' +
            rightIndex + '。本层增加 ' + addedWater + ' 格水，累计 water = ' + water + '。'
        })
      }

      stack.push(rightIndex)
      saveStep({
        action: '右侧柱下标入栈',
        line: 'append',
        rightIndex,
        note: '把 right = ' + rightIndex + ' 入栈。它会成为后续凹槽的候选左挡板或凹槽底部。'
      })
    })

    saveStep({
      action: '扫描结束',
      final: true,
      note: '所有柱子处理完毕，蓝色区域一共 9 格，因此最终接到的雨水为 9。'
    })

    const actionEl = root.querySelector('[data-role="action"]')
    const positionsEl = root.querySelector('[data-role="positions"]')
    const waterEl = root.querySelector('[data-role="water"]')
    const chartEl = root.querySelector('[data-role="chart"]')
    const formulaEl = root.querySelector('[data-role="formula"]')
    const stackEl = root.querySelector('[data-role="stack"]')
    const noteEl = root.querySelector('[data-role="note"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const speedEl = root.querySelector('[data-role="speed"]')
    const codeLines = root.querySelectorAll('[data-line]')
    const prevBtn = root.querySelector('[data-action="prev"]')
    const nextBtn = root.querySelector('[data-action="next"]')
    const playBtn = root.querySelector('[data-action="play"]')
    const resetBtn = root.querySelector('[data-action="reset"]')
    let index = 0
    let timer = null

    const chartWidth = 720
    const chartHeight = 330
    const plotLeft = 54
    const plotBottom = 272
    const cellWidth = 104
    const unitHeight = 44
    const barPadding = 9
    const barWidth = cellWidth - barPadding * 2
    const plotRight = plotLeft + cellWidth * height.length
    const maxHeight = Math.max(...height)
    const barX = column => plotLeft + column * cellWidth + barPadding
    const levelY = level => plotBottom - level * unitHeight

    const stop = () => {
      if (timer) window.clearTimeout(timer)
      timer = null
      playBtn.textContent = '播放'
    }

    const roleMarker = (role, column, className) => {
      if (column === null) return ''
      const center = barX(column) + barWidth / 2
      const targetY = Math.max(30, levelY(height[column]) - 5)
      return '<text class="rw-role-label ' + className + '" x="' + center + '" y="17" text-anchor="middle">' +
        role + '</text><line class="rw-role-line ' + className + '" x1="' + center +
        '" y1="23" x2="' + center + '" y2="' + targetY + '"></line>'
    }

    const renderChart = state => {
      const newCellSet = new Set(state.newCells)
      let grid = ''
      let waterBlocks = ''
      let bars = ''

      for (let level = 0; level <= maxHeight; level += 1) {
        const y = levelY(level)
        grid += '<line x1="' + plotLeft + '" y1="' + y + '" x2="' + plotRight +
          '" y2="' + y + '"></line><text x="' + (plotLeft - 12) + '" y="' +
          (y + 4) + '" text-anchor="end">' + level + '</text>'
      }

      state.waterCells.forEach(key => {
        const parts = key.split(':')
        const column = Number(parts[0])
        const level = Number(parts[1])
        const classes = newCellSet.has(key) ? 'rw-water-cell is-new' : 'rw-water-cell'
        waterBlocks += '<rect class="' + classes + '" x="' + barX(column) + '" y="' +
          levelY(level + 1) + '" width="' + barWidth + '" height="' + unitHeight + '"></rect>'
      })

      height.forEach((value, column) => {
        const classes = ['rw-bar']
        if (column === state.leftIndex) classes.push('is-left')
        if (column === state.bottomIndex) classes.push('is-bottom')
        if (column === state.rightIndex) classes.push('is-right')

        bars += '<rect class="' + classes.join(' ') + '" x="' + barX(column) + '" y="' +
          levelY(value) + '" width="' + barWidth + '" height="' + (value * unitHeight) +
          '"></rect><text class="rw-height-label" x="' + (barX(column) + barWidth / 2) +
          '" y="' + Math.max(38, levelY(value) - 6) + '" text-anchor="middle">' + value +
          '</text><text class="rw-index-label" x="' + (barX(column) + barWidth / 2) +
          '" y="' + (plotBottom + 22) + '" text-anchor="middle">i=' + column + '</text>'
      })

      let layerOutline = ''
      if (state.layerWidth !== null && state.layerWidth > 0 && state.layerHeight > 0) {
        const firstColumn = state.leftIndex + 1
        const lastColumn = state.rightIndex - 1
        const outlineX = barX(firstColumn) - 2
        const outlineWidth = barX(lastColumn) + barWidth - outlineX + 2
        layerOutline = '<rect class="rw-layer-outline" x="' + outlineX + '" y="' +
          levelY(state.layerTop) + '" width="' + outlineWidth + '" height="' +
          (state.layerHeight * unitHeight) + '"></rect>'
      }

      const markers =
        roleMarker('left', state.leftIndex, 'left') +
        roleMarker(state.line === 'compare' ? '栈顶' : 'bottom', state.bottomIndex, 'bottom') +
        roleMarker('right', state.rightIndex, 'right')

      chartEl.innerHTML =
        '<svg class="rw-elevation" viewBox="0 0 ' + chartWidth + ' ' + chartHeight +
        '" role="img" aria-labelledby="rw-chart-title rw-chart-desc">' +
        '<title id="rw-chart-title">接雨水柱状地形逐步演示</title>' +
        '<desc id="rw-chart-desc">高度数组为 4、2、0、3、2、5；矩形柱表示地形，蓝色方格表示已经计算出的积水。</desc>' +
        '<g class="rw-grid">' + grid + '</g>' +
        '<g class="rw-water-layer">' + waterBlocks + '</g>' +
        '<g class="rw-bars">' + bars + '</g>' +
        layerOutline +
        '<g class="rw-markers">' + markers + '</g>' +
        '</svg>'
    }

    const renderStack = state => {
      if (!state.stack.length) {
        stackEl.innerHTML = '<span class="rw-stack-empty">空栈</span>'
        return
      }

      stackEl.innerHTML = state.stack.map((stackIndex, position) => {
        const positionName = position === 0
          ? '栈底'
          : position === state.stack.length - 1
            ? '栈顶'
            : ''
        return '<span class="rw-stack-item"><small>' + positionName + '</small><strong>i=' +
          stackIndex + '</strong><span>h=' + height[stackIndex] + '</span></span>'
      }).join('<i>→</i>')
    }

    const renderFormula = state => {
      if (state.layerWidth !== null) {
        formulaEl.textContent =
          'width = ' + state.rightIndex + ' - ' + state.leftIndex + ' - 1 = ' +
          state.layerWidth + '；bounded_height = min(' + height[state.leftIndex] + ', ' +
          height[state.rightIndex] + ') - ' + height[state.bottomIndex] + ' = ' +
          state.layerHeight + '；本层水量 = ' + state.layerWidth + ' × ' +
          state.layerHeight + ' = ' + state.addedWater
        return
      }

      if (state.compareResult !== null) {
        formulaEl.textContent = 'height[' + state.bottomIndex + '] = ' +
          height[state.bottomIndex] + ' < height[' + state.rightIndex + '] = ' +
          height[state.rightIndex] + ' → ' + (state.compareResult ? '成立' : '不成立')
        return
      }

      if (state.line === 'guard') {
        formulaEl.textContent = 'bottom 弹出后 stack 为空：缺少 left，不计算水量'
        return
      }

      formulaEl.textContent = '本步不计算面积'
    }

    const render = () => {
      const state = steps[index]
      actionEl.textContent = state.action
      waterEl.textContent = state.water

      const positions = []
      if (state.leftIndex !== null) positions.push('left=' + state.leftIndex)
      if (state.bottomIndex !== null) positions.push('bottom=' + state.bottomIndex)
      if (state.rightIndex !== null) positions.push('right=' + state.rightIndex)
      positionsEl.textContent = positions.length ? positions.join('，') : '—'

      codeLines.forEach(line => {
        line.classList.toggle('active', line.dataset.line === state.line)
      })
      renderChart(state)
      renderFormula(state)
      renderStack(state)
      noteEl.textContent = state.note
      stepEl.textContent = '第 ' + (index + 1) + ' / ' + steps.length + ' 步'
      prevBtn.disabled = index === 0
      nextBtn.disabled = index === steps.length - 1
    }

    const scheduleNext = () => {
      timer = window.setTimeout(() => {
        if (index >= steps.length - 1) {
          stop()
          return
        }
        index += 1
        render()
        if (index >= steps.length - 1) {
          stop()
          return
        }
        scheduleNext()
      }, Number(speedEl.value))
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
      if (index >= steps.length - 1) index = 0
      render()
      playBtn.textContent = '暂停'
      scheduleNext()
    })

    speedEl.addEventListener('change', () => {
      if (!timer) return
      window.clearTimeout(timer)
      scheduleNext()
    })

    render()
  })()
</script>

这里最容易错的地方：

1. `bottom` 弹出以后，新的栈顶才是左挡板。
2. 弹出后栈为空，说明没有左挡板，必须停止当前轮计算。
3. 宽度不包含左右挡板，所以是 `right - left - 1`。
4. 水位由较矮挡板决定，所以使用 `min(left_height, right_height)`。
5. 一次弹出计算的是一层横向积水，不是某一根柱子上方的全部水量。

二维扩展题 [407. 接雨水 II](https://leetcode.cn/problems/trapping-rain-water-ii/) 不能再只看左右两根挡板：水可能从上下左右任意方向流走。它需要用小根堆维护整圈最低边界，再配合 BFS 向网格内部扩散，完整解释见[图论笔记](/algorithm/graph-theory/#trap-rain-water-ii)。

## 7. [84. 柱状图中最大的矩形](https://leetcode.cn/problems/largest-rectangle-in-histogram/)：弹出时确定左右边界

对于每根柱子，希望知道它作为矩形最低高度时，能够向左右延伸到哪里。当前柱子更矮时，栈顶较高柱子不能再向右延伸，此时就可以结算它的最大面积。

为了让所有柱子最终都能结算，在数组两端各加入一个高度为 0 的哨兵：

```text
原数组：[2, 1, 5, 6, 2, 3]
扩展后：[0, 2, 1, 5, 6, 2, 3, 0]
```

```python
def largest_rectangle_area(heights: list[int]) -> int:
    extended = [0, *heights, 0]
    stack = [0]
    best = 0

    for right in range(1, len(extended)):
        current_height = extended[right]

        while (
            len(stack) > 1
            and extended[stack[-1]] >= current_height
        ):
            middle = stack.pop()
            left = stack[-1]
            width = right - left - 1
            area = extended[middle] * width
            best = max(best, area)

        stack.append(right)

    return best
```

下面用 <code>heights = [2, 1, 5, 6, 2, 3]</code> 演示。图中保留两端高度为 0 的哨兵；每当矮柱 <code>right</code> 迫使高柱 <code>middle</code> 出栈时，就用真实矩形覆盖它能够延伸的宽度，并计算候选面积。

<div class="algo-demo largest-rectangle-demo" id="largest-rectangle-demo">
  <div class="algo-demo-title">
    <strong>柱状图最大矩形：矮柱出现时结算高矩形</strong>
    <code>extended = [0, 2, 1, 5, 6, 2, 3, 0]</code>
  </div>
  <div class="hist-status" aria-live="polite">
    <span>动作 <strong data-role="action"></strong></span>
    <span>位置 <strong data-role="positions"></strong></span>
    <span>候选面积 <strong data-role="candidate"></strong></span>
    <span>历史最大 <strong data-role="best"></strong></span>
  </div>
  <div class="hist-chart" id="histogram-chart" data-role="chart"></div>
  <div class="hist-formula" data-role="formula" aria-live="polite"></div>
  <div class="hist-code-flow" aria-label="当前执行的柱状图最大矩形代码">
    <code data-line="read">current_height = extended[right]</code>
    <code data-line="compare">while extended[stack[-1]] &gt;= current_height</code>
    <code data-line="pop">middle = stack.pop(); left = stack[-1]</code>
    <code data-line="measure">width = right - left - 1</code>
    <code data-line="area">area = extended[middle] * width; best = max(best, area)</code>
    <code data-line="append">stack.append(right)</code>
  </div>
  <div class="hist-stack-row">
    <span>stack（栈底 → 栈顶）</span>
    <div class="hist-stack" data-role="stack" aria-live="polite"></div>
  </div>
  <div class="algo-note" data-role="note" aria-live="polite"></div>
  <div class="algo-controls">
    <button type="button" data-action="prev">上一步</button>
    <button type="button" data-action="next">下一步</button>
    <button type="button" data-action="play">播放</button>
    <button type="button" data-action="reset">重置</button>
    <label class="hist-speed">速度
      <select data-role="speed" aria-label="柱状图最大矩形动画播放速度">
        <option value="1500">慢速</option>
        <option value="900" selected>正常</option>
        <option value="550">快速</option>
      </select>
    </label>
    <span class="algo-step" data-role="step"></span>
  </div>
</div>

<script>
  (() => {
    const root = document.getElementById('largest-rectangle-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const heights = [2, 1, 5, 6, 2, 3]
    const extended = [0, ...heights, 0]
    const stack = [0]
    const steps = []
    let best = 0
    let bestRect = null

    const copyRect = rectangle => rectangle
      ? {
          leftIndex: rectangle.leftIndex,
          middleIndex: rectangle.middleIndex,
          rightIndex: rectangle.rightIndex,
          width: rectangle.width,
          height: rectangle.height,
          area: rectangle.area
        }
      : null

    const saveStep = ({
      action,
      line = null,
      rightIndex = null,
      middleIndex = null,
      leftIndex = null,
      compareResult = null,
      width = null,
      area = null,
      bestUpdated = false,
      final = false,
      note
    }) => {
      steps.push({
        action,
        line,
        rightIndex,
        middleIndex,
        leftIndex,
        compareResult,
        width,
        area,
        bestUpdated,
        final,
        stack: stack.slice(),
        best,
        bestRect: copyRect(bestRect),
        note
      })
    }

    saveStep({
      action: '初始化左哨兵',
      note: 'extended 两端各有一个高度为 0 的哨兵。stack 先放入左哨兵下标 0，best = 0。'
    })

    for (let rightIndex = 1; rightIndex < extended.length; rightIndex += 1) {
      const currentHeight = extended[rightIndex]
      saveStep({
        action: rightIndex === extended.length - 1 ? '读取右哨兵' : '读取当前柱子',
        line: 'read',
        rightIndex,
        note: '读取 right = ' + rightIndex + '，extended[right] = ' + currentHeight +
          (rightIndex === extended.length - 1 ? '。右哨兵会强制结算栈中剩余柱子。' : '。')
      })

      while (stack.length > 1) {
        const topIndex = stack[stack.length - 1]
        const compareResult = extended[topIndex] >= currentHeight

        saveStep({
          action: compareResult ? '当前柱更矮，结算栈顶' : '当前柱更高，停止弹栈',
          line: 'compare',
          rightIndex,
          middleIndex: topIndex,
          compareResult,
          note: '比较 extended[' + topIndex + '] = ' + extended[topIndex] + ' 与 current_height = ' +
            currentHeight + '：' + extended[topIndex] + ' >= ' + currentHeight +
            (compareResult ? ' 成立，栈顶柱子的右边界已经确定。' : ' 不成立，当前柱可以直接入栈。')
        })

        if (!compareResult) break

        const middleIndex = stack.pop()
        const leftIndex = stack[stack.length - 1]
        const width = rightIndex - leftIndex - 1
        const area = extended[middleIndex] * width

        saveStep({
          action: '弹出并确定左右边界',
          line: 'pop',
          rightIndex,
          middleIndex,
          leftIndex,
          width,
          area,
          note: '弹出 middle = ' + middleIndex + '；新栈顶 left = ' + leftIndex +
            '，当前 right = ' + rightIndex + '，矩形覆盖二者之间的柱子。'
        })

        saveStep({
          action: '计算候选宽度',
          line: 'measure',
          rightIndex,
          middleIndex,
          leftIndex,
          width,
          area,
          note: '左右边界本身不能包含在矩形中，所以 width = ' + rightIndex + ' - ' +
            leftIndex + ' - 1 = ' + width + '。'
        })

        const bestUpdated = area > best
        if (bestUpdated) {
          best = area
          bestRect = {
            leftIndex,
            middleIndex,
            rightIndex,
            width,
            height: extended[middleIndex],
            area
          }
        }

        saveStep({
          action: bestUpdated ? '更新最大面积' : '保留原最大面积',
          line: 'area',
          rightIndex,
          middleIndex,
          leftIndex,
          width,
          area,
          bestUpdated,
          note: '候选面积 = 高度 ' + extended[middleIndex] + ' × 宽度 ' + width + ' = ' +
            area + '；' + (bestUpdated ? '它超过原记录，更新 best = ' + best + '。' : '没有超过 best = ' + best + '。')
        })
      }

      stack.push(rightIndex)
      saveStep({
        action: rightIndex === extended.length - 1 ? '右哨兵入栈' : '当前下标入栈',
        line: 'append',
        rightIndex,
        note: '把下标 ' + rightIndex + ' 放入栈顶。栈中柱高继续保持从栈底到栈顶递增。'
      })
    }

    saveStep({
      action: '扫描结束',
      final: true,
      note: '最终最大矩形覆盖原数组下标 2 和 3，高度为 5、宽度为 2，最大面积 best = 10。'
    })

    const actionEl = root.querySelector('[data-role="action"]')
    const positionsEl = root.querySelector('[data-role="positions"]')
    const candidateEl = root.querySelector('[data-role="candidate"]')
    const bestEl = root.querySelector('[data-role="best"]')
    const chartEl = root.querySelector('[data-role="chart"]')
    const formulaEl = root.querySelector('[data-role="formula"]')
    const stackEl = root.querySelector('[data-role="stack"]')
    const noteEl = root.querySelector('[data-role="note"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const speedEl = root.querySelector('[data-role="speed"]')
    const codeLines = root.querySelectorAll('[data-line]')
    const prevBtn = root.querySelector('[data-action="prev"]')
    const nextBtn = root.querySelector('[data-action="next"]')
    const playBtn = root.querySelector('[data-action="play"]')
    const resetBtn = root.querySelector('[data-action="reset"]')
    let index = 0
    let timer = null

    const chartWidth = 720
    const chartHeight = 340
    const plotLeft = 40
    const plotBottom = 276
    const cellWidth = 80
    const unitHeight = 35
    const barPadding = 6
    const barWidth = cellWidth - barPadding * 2
    const plotRight = plotLeft + cellWidth * extended.length
    const maxHeight = Math.max(...extended)
    const barX = column => plotLeft + column * cellWidth + barPadding
    const levelY = level => plotBottom - level * unitHeight

    const stop = () => {
      if (timer) window.clearTimeout(timer)
      timer = null
      playBtn.textContent = '播放'
    }

    const rectangleGeometry = rectangle => {
      const firstColumn = rectangle.leftIndex + 1
      const lastColumn = rectangle.rightIndex - 1
      const x = barX(firstColumn)
      const width = barX(lastColumn) + barWidth - x
      return {
        x,
        y: levelY(rectangle.height),
        width,
        height: rectangle.height * unitHeight
      }
    }

    const roleMarker = (role, column, className) => {
      if (column === null) return ''
      const center = barX(column) + barWidth / 2
      const targetY = Math.max(31, levelY(extended[column]) - 5)
      return '<text class="hist-role-label ' + className + '" x="' + center +
        '" y="17" text-anchor="middle">' + role + '</text><line class="hist-role-line ' +
        className + '" x1="' + center + '" y1="23" x2="' + center + '" y2="' +
        targetY + '"></line>'
    }

    const renderChart = state => {
      let grid = ''
      let bars = ''

      for (let level = 0; level <= maxHeight; level += 1) {
        const y = levelY(level)
        grid += '<line x1="' + plotLeft + '" y1="' + y + '" x2="' + plotRight +
          '" y2="' + y + '"></line><text x="' + (plotLeft - 10) + '" y="' +
          (y + 4) + '" text-anchor="end">' + level + '</text>'
      }

      extended.forEach((value, column) => {
        const isSentinel = column === 0 || column === extended.length - 1
        const classes = ['hist-bar']
        if (column === state.leftIndex) classes.push('is-left')
        if (column === state.middleIndex) classes.push('is-middle')
        if (column === state.rightIndex) classes.push('is-right')

        if (isSentinel) {
          bars += '<line class="hist-sentinel' +
            (column === state.leftIndex ? ' is-left' : '') +
            (column === state.rightIndex ? ' is-right' : '') +
            '" x1="' + (barX(column) + barWidth / 2) + '" y1="' + plotBottom +
            '" x2="' + (barX(column) + barWidth / 2) + '" y2="' + (plotBottom - 18) +
            '"></line><text class="hist-height-label" x="' + (barX(column) + barWidth / 2) +
            '" y="' + (plotBottom - 24) + '" text-anchor="middle">0</text>'
        } else {
          bars += '<rect class="' + classes.join(' ') + '" x="' + barX(column) +
            '" y="' + levelY(value) + '" width="' + barWidth + '" height="' +
            (value * unitHeight) + '"></rect><text class="hist-height-label" x="' +
            (barX(column) + barWidth / 2) + '" y="' + Math.max(38, levelY(value) - 6) +
            '" text-anchor="middle">' + value + '</text>'
        }

        bars += '<text class="hist-index-label" x="' + (barX(column) + barWidth / 2) +
          '" y="' + (plotBottom + 20) + '" text-anchor="middle">' +
          (isSentinel ? (column === 0 ? '左哨兵' : '右哨兵') : 'i=' + (column - 1)) +
          '</text><text class="hist-extended-label" x="' + (barX(column) + barWidth / 2) +
          '" y="' + (plotBottom + 35) + '" text-anchor="middle">e=' + column + '</text>'
      })

      let rectangleLayers = ''
      if (state.bestRect) {
        const geometry = rectangleGeometry(state.bestRect)
        rectangleLayers += '<rect class="hist-best-rectangle" x="' + geometry.x +
          '" y="' + geometry.y + '" width="' + geometry.width + '" height="' +
          geometry.height + '"></rect>'
      }

      if (state.leftIndex !== null && state.middleIndex !== null && state.width !== null) {
        const candidateRect = {
          leftIndex: state.leftIndex,
          rightIndex: state.rightIndex,
          height: extended[state.middleIndex]
        }
        const geometry = rectangleGeometry(candidateRect)
        rectangleLayers += '<rect class="hist-candidate-rectangle' +
          (state.bestUpdated ? ' is-new-best' : '') + '" x="' + geometry.x + '" y="' +
          geometry.y + '" width="' + geometry.width + '" height="' + geometry.height +
          '"></rect>'
      }

      const middleRole = state.line === 'compare' ? '栈顶' : 'middle'
      const markers =
        roleMarker('left', state.leftIndex, 'left') +
        roleMarker(middleRole, state.middleIndex, 'middle') +
        roleMarker('right', state.rightIndex, 'right')

      chartEl.innerHTML =
        '<svg class="hist-elevation" viewBox="0 0 ' + chartWidth + ' ' + chartHeight +
        '" role="img" aria-labelledby="hist-chart-title hist-chart-desc">' +
        '<title id="hist-chart-title">柱状图最大矩形逐步演示</title>' +
        '<desc id="hist-chart-desc">原始柱高为 2、1、5、6、2、3，两端加入高度为 0 的哨兵；彩色矩形表示当前候选区域和历史最大区域。</desc>' +
        '<g class="hist-grid">' + grid + '</g>' +
        '<g class="hist-bars">' + bars + '</g>' +
        '<g class="hist-rectangles">' + rectangleLayers + '</g>' +
        '<g class="hist-markers">' + markers + '</g>' +
        '</svg>'
    }

    const renderStack = state => {
      stackEl.innerHTML = state.stack.map((stackIndex, position) => {
        let label = ''
        if (state.stack.length === 1) label = '栈底 / 栈顶'
        else if (position === 0) label = '栈底'
        else if (position === state.stack.length - 1) label = '栈顶'

        return '<span class="hist-stack-item"><small>' + label + '</small><strong>e=' +
          stackIndex + '</strong><span>h=' + extended[stackIndex] + '</span></span>'
      }).join('<i>→</i>')
    }

    const renderFormula = state => {
      if (state.line === 'compare') {
        formulaEl.textContent = 'extended[' + state.middleIndex + '] = ' +
          extended[state.middleIndex] + ' >= extended[' + state.rightIndex + '] = ' +
          extended[state.rightIndex] + ' → ' + (state.compareResult ? '成立' : '不成立')
        return
      }

      if (state.width !== null) {
        const base = 'width = ' + state.rightIndex + ' - ' + state.leftIndex +
          ' - 1 = ' + state.width + '；area = ' + extended[state.middleIndex] +
          ' × ' + state.width + ' = ' + state.area
        formulaEl.textContent = state.line === 'area'
          ? base + '；best = ' + state.best
          : base
        return
      }

      if (state.final && state.bestRect) {
        formulaEl.textContent = 'best = 高度 ' + state.bestRect.height + ' × 宽度 ' +
          state.bestRect.width + ' = ' + state.bestRect.area
        return
      }

      formulaEl.textContent = '本步尚不计算矩形面积'
    }

    const render = () => {
      const state = steps[index]
      actionEl.textContent = state.action
      bestEl.textContent = state.best
      candidateEl.textContent = state.area === null ? '—' : state.area

      const positions = []
      if (state.leftIndex !== null) positions.push('left=' + state.leftIndex)
      if (state.middleIndex !== null) positions.push('middle=' + state.middleIndex)
      if (state.rightIndex !== null) positions.push('right=' + state.rightIndex)
      positionsEl.textContent = positions.length ? positions.join('，') : '—'

      codeLines.forEach(line => {
        line.classList.toggle('active', line.dataset.line === state.line)
      })
      renderChart(state)
      renderFormula(state)
      renderStack(state)
      noteEl.textContent = state.note
      stepEl.textContent = '第 ' + (index + 1) + ' / ' + steps.length + ' 步'
      prevBtn.disabled = index === 0
      nextBtn.disabled = index === steps.length - 1
    }

    const scheduleNext = () => {
      timer = window.setTimeout(() => {
        if (index >= steps.length - 1) {
          stop()
          return
        }
        index += 1
        render()
        if (index >= steps.length - 1) {
          stop()
          return
        }
        scheduleNext()
      }, Number(speedEl.value))
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
      if (index >= steps.length - 1) index = 0
      render()
      playBtn.textContent = '暂停'
      scheduleNext()
    })

    speedEl.addEventListener('change', () => {
      if (!timer) return
      window.clearTimeout(timer)
      scheduleNext()
    })

    render()
  })()
</script>

弹出 `middle` 时：

```text
right：右侧第一个阻止 middle 继续延伸的位置
left：弹出 middle 后，栈中最近的更矮位置
可用宽度：right - left - 1
矩形高度：height[middle]
```

使用 `>=` 会把相同高度的旧下标弹出，让更新的下标作为这一高度的新代表。`len(stack) > 1` 用来保护最左侧的 0 哨兵不被弹出。

左右哨兵分别解决两个边界问题：

- 左侧 0 保证弹出真实柱子后仍然有左边界。
- 右侧 0 强制栈中剩余柱子全部完成结算。

## 8. 接雨水和柱状图为什么看起来相反

这两题都使用 `right - left - 1`，但弹出的对象和面积含义不同：

| 对比 | 接雨水 | 最大矩形 |
|---|---|---|
| 栈内趋势 | 柱高非递增 | 柱高递增 |
| 当前元素触发条件 | 当前柱更高 | 当前柱更矮或相等 |
| 弹出的元素 | 凹槽底部 | 待结算的矩形高度 |
| 左右边界用途 | 两侧挡板 | 第一个限制延伸的位置 |
| 面积 | `宽度 * 水层高度` | `宽度 * 柱子高度` |
| 核心视角 | 横向一层层接水 | 以每根柱子为最低高度向两侧扩展 |

可以这样记：

```text
接雨水：高柱出现，凹槽闭合
柱状图：矮柱出现，高矩形闭合
```

## 9. 从“下一个元素”推广到左右边界

单调栈不仅能直接返回下一个更大元素，还经常用来同时确定左右边界。

当当前下标使栈顶 `middle` 出栈时：

```text
当前下标 current 通常是 middle 的右边界
弹出后的新栈顶通常是 middle 的左边界
```

这正是柱状图最大矩形的来源。类似地，在“子数组最小值之和”中，可以计算每个元素作为最小值时，向左和向右能够覆盖多少个子数组，再把贡献累加。

使用这种贡献法时，重复元素必须一侧严格、一侧非严格，例如：

```text
左边找严格更小
右边找小于等于
```

如果两侧都使用严格关系，相同元素覆盖的子数组可能被重复统计；如果两侧都使用非严格关系，又可能漏掉一部分。具体选择哪一侧严格并不唯一，但两侧必须配套。

## 10. 常见错误

### 10.1 把当前下标和待结算下标写反

答案通常属于被弹出的旧下标：

```python
waiting = stack.pop()
answer[waiting] = current - waiting
```

当前元素只是触发结算，不一定是在计算自己的答案。

### 10.2 栈里存下标，却直接比较下标大小

如果栈保存的是下标，比较时要回到原数组：

```python
nums[stack[-1]] < nums[current]
```

不要误写成：

```python
stack[-1] < current
```

后者比较的是位置，不是元素值。

### 10.3 没有单独决定相等元素的处理

`<` 与 `<=`、`>` 与 `>=` 会改变边界定义。每日温度要求严格更暖，相等温度不能出栈；贡献计数题又经常需要一侧处理相等值。

### 10.4 忘记处理永远等不到答案的元素

遍历结束后栈可能不为空。应该在初始化时给这些位置放好默认答案：

```text
每日温度：0
下一个更大元素：-1
左右边界：-1 或 n
```

### 10.5 看到两层循环就误判为 O(n²)

检查每个下标能否被重复压栈。如果每个下标只入栈、出栈一次，总复杂度仍然是 `O(n)`。

### 10.6 环形数组第二遍重复入栈

第二遍扫描只用于补齐第一遍元素的答案，通常只在第一遍执行 `stack.append(current)`。

## 11. 一份实用的单调栈检查清单

1. 题目是否在问某一侧第一个更大或更小元素？
2. 栈中保存的是仍在等待答案的谁？
3. 当前元素在什么条件下能够结算栈顶？
4. 栈保存下标还是数值？是否需要距离和边界？
5. 相等元素应该保留还是弹出？
6. 答案属于当前元素还是被弹出的元素？
7. 弹出以后是否需要读取新的栈顶作为左边界？
8. 找不到答案时的默认值是什么？
9. 环形数组是否只在第一遍入栈？
10. 是否需要左右哨兵强制完成边界结算？

## 12. 复习总览

- 单调栈解决“对每个元素寻找一侧第一个更大或更小元素”，把暴力扫描从 `O(n^2)` 降为 `O(n)`。
- 栈中通常保存下标，以便同时读取数值、计算距离并确定左右边界。
- 寻找右侧严格更大元素时，过去较小的元素等待在栈中；更大的当前元素到来后批量结算它们。
- 严格与非严格关系决定相等元素是否出栈，必须直接检查 `while` 条件。
- 每日温度返回下标差；下一个更大元素返回对应数值；环形数组通过扫描两遍和取模补齐答案。
- 接雨水弹出凹槽底部，用左右挡板计算横向水层。
- 柱状图最大矩形弹出待结算高度，用左右限制位置计算矩形宽度。
- 接雨水遇到更高柱结算凹槽；柱状图遇到更矮柱结算矩形。
- 两端哨兵可以统一边界并强制栈内剩余元素完成结算。
- 单调栈中的 `while` 虽然嵌套在 `for` 内，但每个下标只入栈、出栈一次，总时间仍然是 `O(n)`。

复习单调栈时不要先背“递增栈还是递减栈”，先说清楚：谁在等待什么答案、当前元素为什么能让谁出栈、相等时要不要弹出。三个问题确定以后，栈的方向会自然得到。

<div class="algorithm-module-nav algorithm-module-nav-bottom">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/dynamic-programming/">上一篇：动态规划与背包问题</a>
  <a href="/algorithm/graph-theory/">下一篇：图论</a>
</div>
