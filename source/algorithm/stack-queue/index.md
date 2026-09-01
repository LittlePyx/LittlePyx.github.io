---
title: 代码随想录刷题笔记：栈与队列
date:
top_img: /img/algorithm-header-code.webp
description: 栈与队列刷题笔记，整理栈匹配、表达式求值、队列模拟、单调队列、滑动窗口最大值、堆、优先队列和 Top K 问题。
categories:
  - Notes
  - Algorithm
tags:
  - LeetCode
  - CodeThinking
  - Python
  - Stack
  - Queue
  - Heap
toc: true
toc_number: false
katex: true
---

<div class="algorithm-module-nav algorithm-module-nav-top">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/string-kmp/">上一篇：字符串与 KMP</a>
  <a href="/algorithm/binary-tree/">下一篇：二叉树递归体系</a>
</div>

## 1. 怎么看栈与队列题

栈和队列都不是“为了用数据结构而用数据结构”，它们真正解决的是访问顺序问题。

栈是后进先出。最后放进去的元素最先被处理，所以它适合处理“最近的、还没有匹配完的东西”。比如最近的左括号、最近的数字、最近还没被抵消的字符、最近还没结算的状态。

队列是先进先出。先来的元素先被处理，所以它适合处理“按层、按时间、按进入顺序推进”的问题。比如 BFS、任务队列、窗口里过期元素的清理。

刷这一类题时，我先问三个问题：

- 题目是不是在找“最近的未匹配对象”？如果是，优先想栈。
- 题目是不是要求“先进先出、按层推进、按时间顺序处理”？如果是，优先想队列。
- 题目是不是在一个滑动窗口里反复问最大值或最小值？如果是，优先想单调队列。

Python 里最常用的写法是：

```python
stack = []              # append / pop 当栈

from collections import deque
queue = deque()         # append / popleft 当队列
```

不要用普通列表的 `pop(0)` 当队列。`pop(0)` 会移动后面所有元素，复杂度是 $O(n)$。如果需要从左边弹出，用 `deque.popleft()`。

这篇笔记按方法讲：先看普通栈，再看两个栈/队列互相模拟，然后看单调队列和优先队列。每一类都要说清楚容器里到底存的是什么，而不是只背 API。

## 2. 栈：处理最近还没匹配完的东西

栈最典型的信号是“遇到一个东西，先放着；遇到另一个东西，再和最近放着的那个配对”。括号匹配就是最直观的例子。

[20. 有效的括号](https://leetcode.cn/problems/valid-parentheses/) 给一个只包含括号的字符串，判断括号是否正确闭合。扫描字符串时，遇到左括号就入栈；遇到右括号时，它必须和栈顶的左括号匹配。为什么只看栈顶？因为括号必须就近闭合，最近打开的括号一定最先关闭。

```python
def is_valid(s: str) -> bool:
    pairs = {
        ')': '(',
        ']': '[',
        '}': '{',
    }
    stack = []

    for ch in s:
        if ch in pairs:
            if not stack or stack[-1] != pairs[ch]:
                return False
            stack.pop()
        else:
            stack.append(ch)

    return not stack
```

这题容易错在只判断遇到右括号时是否匹配，却忘了最后还要检查栈是否为空。比如 `"((("` 扫描时不会遇到错误的右括号，但它显然不合法，因为还有左括号没闭合。

[1047. 删除字符串中的所有相邻重复项](https://leetcode.cn/problems/remove-all-adjacent-duplicates-in-string/) 也是栈题。题目要求不断删除相邻且相同的字符，直到不能再删。比如 `"abbaca"` 最后变成 `"ca"`。

这题看起来像字符串模拟，但核心是“当前字符能不能和最近保留的字符抵消”。最近保留的字符就是栈顶：

```python
def remove_duplicates(s: str) -> str:
    stack = []

    for ch in s:
        if stack and stack[-1] == ch:
            stack.pop()
        else:
            stack.append(ch)

    return ''.join(stack)
```

为什么这样能处理连续反应？因为删除一对字符后，新的相邻关系会自然暴露在栈顶。比如 `abba`：先放 `a`、`b`，遇到第二个 `b` 时弹出，最后一个 `a` 又能和栈顶 `a` 抵消。

[844. 比较含退格的字符串](https://leetcode.cn/problems/backspace-string-compare/) 也可以用栈。`#` 表示退格，等价于删除最近输入且还没被删除的字符：

```python
def build(s: str) -> str:
    stack = []

    for ch in s:
        if ch == '#':
            if stack:
                stack.pop()
        else:
            stack.append(ch)

    return ''.join(stack)


def backspace_compare(s: str, t: str) -> bool:
    return build(s) == build(t)
```

这类题的共同点是：操作影响的是“最近的一个有效元素”。只要看到最近、撤销、匹配、抵消，就先想栈。

## 3. 表达式与计算：栈保存还没结算的数字

表达式题里的栈通常存数字。扫描到运算符时，从栈里取出最近的两个数字做运算，再把结果放回去。

[150. 逆波兰表达式求值](https://leetcode.cn/problems/evaluate-reverse-polish-notation/) 给一个后缀表达式，比如：

```text
["2", "1", "+", "3", "*"]
```

它表示 `(2 + 1) * 3`。后缀表达式的好处是没有括号优先级歧义：遇到数字就入栈，遇到运算符就弹出两个数字计算。

```python
def eval_rpn(tokens: list[str]) -> int:
    stack = []

    for token in tokens:
        if token not in {"+", "-", "*", "/"}:
            stack.append(int(token))
            continue

        b = stack.pop()
        a = stack.pop()

        if token == "+":
            stack.append(a + b)
        elif token == "-":
            stack.append(a - b)
        elif token == "*":
            stack.append(a * b)
        else:
            stack.append(int(a / b))

    return stack[-1]
```

这里最容易错的是弹出顺序。先弹出的是右操作数 `b`，后弹出的是左操作数 `a`。减法和除法不能写反，`a - b` 和 `b - a` 完全不同。

另一个细节是 Python 的除法。题目要求向 0 截断，所以可以用 `int(a / b)`。如果用 `a // b`，负数时会向下取整，比如 `-3 // 2 == -2`，不符合向 0 截断的结果 `-1`。

栈在表达式题里承担的是“暂存还没被上层表达式消化的结果”。看到逆波兰、括号内计算、路径简化、最近结果合并，都可以往这个方向想。

## 4. 用栈模拟队列：改变弹出顺序

[232. 用栈实现队列](https://leetcode.cn/problems/implement-queue-using-stacks/) 要用两个栈实现先进先出的队列。一个栈负责输入，一个栈负责输出：

- `in_stack`：新元素都先压到这里。
- `out_stack`：弹出元素时从这里弹。

当 `out_stack` 为空时，把 `in_stack` 里的元素全部倒过去。倒过去以后，原来最早进入的元素会跑到 `out_stack` 的栈顶，于是就能先进先出。

```python
class MyQueue:
    def __init__(self):
        self.in_stack = []
        self.out_stack = []

    def push(self, x: int) -> None:
        self.in_stack.append(x)

    def pop(self) -> int:
        self._move()
        return self.out_stack.pop()

    def peek(self) -> int:
        self._move()
        return self.out_stack[-1]

    def empty(self) -> bool:
        return not self.in_stack and not self.out_stack

    def _move(self) -> None:
        if self.out_stack:
            return

        while self.in_stack:
            self.out_stack.append(self.in_stack.pop())
```

这题的关键不是“两个栈”，而是“什么时候倒”。不要每次 `push` 都倒，也不要每次 `pop` 都倒。只有当 `out_stack` 为空且需要取队头时，才把 `in_stack` 全部倒过去。这样每个元素最多进出两个栈一次，摊还复杂度是 $O(1)$。

举个过程：

```text
push 1, push 2, push 3
in_stack = [1, 2, 3]
out_stack = []

pop 时倒过去：
in_stack = []
out_stack = [3, 2, 1]

out_stack.pop() 得到 1
```

这个倒置过程正好把“后进先出”变成了“先进先出”。

## 5. 用队列模拟栈：保留最后进入的元素

[225. 用队列实现栈](https://leetcode.cn/problems/implement-stack-using-queues/) 反过来，要求用队列实现后进先出的栈。常见写法是每次 `push` 后，把队列前面的旧元素依次转到队尾，让新元素永远排在队头。

```python
from collections import deque


class MyStack:
    def __init__(self):
        self.queue = deque()

    def push(self, x: int) -> None:
        self.queue.append(x)

        for _ in range(len(self.queue) - 1):
            self.queue.append(self.queue.popleft())

    def pop(self) -> int:
        return self.queue.popleft()

    def top(self) -> int:
        return self.queue[0]

    def empty(self) -> bool:
        return not self.queue
```

比如原来队列是 `[1, 2]`，现在 `push(3)`，先得到 `[1, 2, 3]`。为了让 `3` 最先弹出，把前面的 `1`、`2` 转到队尾，变成 `[3, 1, 2]`。这样 `popleft()` 就能弹出最新进入的元素。

这题和“用栈实现队列”的差别是：队列本身只能从头出、从尾进，所以想实现栈，就要在入队时调整顺序，让队头始终是最新元素。

真实刷题里，这两题更多是帮助理解栈和队列的顺序差异。面试时说明清楚每个结构承担的角色，比把代码背得很熟更重要。

## 6. 单调队列：窗口最大值只保留有竞争力的元素

普通队列按进入顺序排队，单调队列在这个基础上多维护一个性质：队列里的元素按某种单调顺序排列。

[239. 滑动窗口最大值](https://leetcode.cn/problems/sliding-window-maximum/) 给一个数组和窗口大小 `k`，要求返回每个窗口的最大值。如果每个窗口都重新扫一遍，复杂度是 $O(nk)$。单调队列的思路是：窗口向右滑动时，只保留那些还有可能成为最大值的元素。

队列里通常存下标，而不是直接存值。原因是我们既要比较大小，也要判断下标是否已经滑出窗口。

```python
from collections import deque


def max_sliding_window(nums: list[int], k: int) -> list[int]:
    q = deque()
    ans = []

    for i, num in enumerate(nums):
        while q and nums[q[-1]] <= num:
            q.pop()

        q.append(i)

        if q[0] <= i - k:
            q.popleft()

        if i >= k - 1:
            ans.append(nums[q[0]])

    return ans
```

下面用 `nums = [4, 2, 1, 3, 0]、k = 3` 拆开这段代码。这个例子会同时出现两种删除：下标 1、2 因为不再有竞争力而从队尾弹出；下标 0 则因为离开窗口而从队首弹出。

<div class="algo-demo monotonic-queue-demo" id="monotonic-queue-demo">
  <div class="algo-demo-title">
    <strong>单调队列：谁还有资格成为窗口最大值</strong>
    <span class="algo-pill">nums = [4, 2, 1, 3, 0] · k = 3</span>
  </div>
  <div class="mq-legend" aria-label="颜色说明">
    <span><i class="mq-swatch mq-window-swatch"></i>当前窗口</span>
    <span><i class="mq-swatch mq-queue-swatch"></i>队列候选</span>
    <span><i class="mq-swatch mq-current-swatch"></i>当前元素</span>
    <span><i class="mq-swatch mq-removed-swatch"></i>刚被移除</span>
  </div>
  <div class="algo-stats">
    <span class="algo-stat">动作：<strong data-role="action"></strong></span>
    <span class="algo-stat">当前：<strong data-role="current"></strong></span>
    <span class="algo-stat">窗口：<strong data-role="window"></strong></span>
  </div>
  <div class="mq-code-flow" aria-label="当前执行的代码位置">
    <code data-line="read">读取 nums[i]</code>
    <code data-line="pop">while ...: q.pop()</code>
    <code data-line="append">q.append(i)</code>
    <code data-line="expire">if q[0] &lt;= i-k: q.popleft()</code>
    <code data-line="record">ans.append(nums[q[0]])</code>
  </div>
  <div class="mq-array-wrap" role="region" aria-label="滑动窗口数组演示">
    <div class="mq-array" data-role="array" role="list"></div>
  </div>
  <div class="mq-lanes">
    <div class="mq-lane">
      <span class="mq-lane-title">队列 q：队首 → 队尾</span>
      <div class="mq-queue" data-role="queue" aria-live="polite"></div>
    </div>
    <div class="mq-lane">
      <span class="mq-lane-title">答案 ans</span>
      <div class="mq-answer" data-role="answer" aria-live="polite"></div>
    </div>
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
    const root = document.getElementById('monotonic-queue-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const nums = [4, 2, 1, 3, 0]
    const k = 3
    const queue = []
    const answer = []
    const steps = []

    const saveStep = ({
      action,
      line,
      currentIndex = -1,
      removedIndex = null,
      removedFrom = null,
      note
    }) => {
      steps.push({
        action,
        line,
        currentIndex,
        removedIndex,
        removedFrom,
        queue: queue.slice(),
        answer: answer.slice(),
        windowStart: currentIndex < 0 ? null : Math.max(0, currentIndex - k + 1),
        windowEnd: currentIndex < 0 ? null : currentIndex,
        note
      })
    }

    saveStep({
      action: '初始化',
      line: null,
      note: '队列保存下标，队列中下标对应的值从队首到队尾递减。队首始终是最大值候选。'
    })

    nums.forEach((num, currentIndex) => {
      saveStep({
        action: '读取元素',
        line: 'read',
        currentIndex,
        note: '读取 nums[' + currentIndex + '] = ' + num + '，先检查队尾是否还有竞争力。'
      })

      while (queue.length && nums[queue[queue.length - 1]] <= num) {
        const removedIndex = queue.pop()
        saveStep({
          action: '弹出队尾',
          line: 'pop',
          currentIndex,
          removedIndex,
          removedFrom: 'back',
          note: 'nums[' + removedIndex + '] = ' + nums[removedIndex] + ' ≤ ' + num +
            '。当前元素更靠右且不更小，旧下标以后不可能成为最大值。'
        })
      }

      queue.push(currentIndex)
      saveStep({
        action: '当前下标入队',
        line: 'append',
        currentIndex,
        note: '把下标 ' + currentIndex + ' 放到队尾。队列保存下标，当前对应值序列仍然单调递减。'
      })

      if (queue[0] <= currentIndex - k) {
        const removedIndex = queue.shift()
        saveStep({
          action: '弹出过期队首',
          line: 'expire',
          currentIndex,
          removedIndex,
          removedFrom: 'front',
          note: '窗口左端是 ' + (currentIndex - k + 1) + '，下标 ' + removedIndex +
            ' 已经离开窗口，所以从队首弹出。'
        })
      }

      if (currentIndex >= k - 1) {
        const maximum = nums[queue[0]]
        answer.push(maximum)
        saveStep({
          action: '记录窗口最大值',
          line: 'record',
          currentIndex,
          note: '窗口已经形成，队首下标是 ' + queue[0] +
            '，因此把 nums[' + queue[0] + '] = ' + maximum + ' 加入答案。'
        })
      }
    })

    const actionEl = root.querySelector('[data-role="action"]')
    const currentEl = root.querySelector('[data-role="current"]')
    const windowEl = root.querySelector('[data-role="window"]')
    const arrayEl = root.querySelector('[data-role="array"]')
    const queueEl = root.querySelector('[data-role="queue"]')
    const answerEl = root.querySelector('[data-role="answer"]')
    const noteEl = root.querySelector('[data-role="note"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const codeLines = root.querySelectorAll('[data-line]')
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

    const renderArray = state => {
      arrayEl.innerHTML = nums.map((value, cellIndex) => {
        const classes = ['mq-cell']
        const inWindow = state.windowStart !== null &&
          cellIndex >= state.windowStart && cellIndex <= state.windowEnd
        const inQueue = state.queue.includes(cellIndex)
        const isCurrent = cellIndex === state.currentIndex
        const isRemoved = cellIndex === state.removedIndex

        if (inWindow) classes.push('in-window')
        if (inQueue) classes.push('in-queue')
        if (isCurrent) classes.push('current')
        if (isRemoved) classes.push(state.removedFrom === 'front' ? 'expired' : 'dominated')

        let pointer = ''
        if (isCurrent) pointer = '<small class="mq-pointer">i</small>'

        const labels = ['下标 ' + cellIndex, '值 ' + value]
        if (inWindow) labels.push('在当前窗口内')
        if (inQueue) labels.push('在队列中')
        if (isRemoved) labels.push(state.removedFrom === 'front' ? '刚因过期移除' : '刚从队尾移除')

        return '<div class="' + classes.join(' ') + '" role="listitem" aria-label="' + labels.join('，') + '">' +
          pointer + '<strong>' + value + '</strong><span>index ' + cellIndex + '</span></div>'
      }).join('')
    }

    const renderQueue = state => {
      if (!state.queue.length) {
        queueEl.innerHTML = '<span class="mq-empty">空队列</span>'
        return
      }

      queueEl.innerHTML = state.queue.map((queueIndex, position) => {
        let positionLabel = ''
        if (state.queue.length === 1) positionLabel = '队首 / 队尾'
        else if (position === 0) positionLabel = '队首'
        else if (position === state.queue.length - 1) positionLabel = '队尾'

        return '<div class="mq-queue-item">' +
          '<small>' + positionLabel + '</small>' +
          '<strong>' + nums[queueIndex] + '</strong>' +
          '<span>i=' + queueIndex + '</span></div>'
      }).join('<i class="mq-arrow">→</i>')
    }

    const renderAnswer = state => {
      if (!state.answer.length) {
        answerEl.innerHTML = '<span class="mq-empty">窗口尚未形成</span>'
        return
      }

      answerEl.innerHTML = state.answer.map(value =>
        '<strong class="mq-answer-item">' + value + '</strong>'
      ).join('')
    }

    const render = () => {
      const state = steps[index]
      actionEl.textContent = state.action
      currentEl.textContent = state.currentIndex < 0
        ? '—'
        : 'i=' + state.currentIndex + '，num=' + nums[state.currentIndex]
      windowEl.textContent = state.windowStart === null
        ? '—'
        : '[' + state.windowStart + ', ' + state.windowEnd + ']'

      codeLines.forEach(line => {
        line.classList.toggle('active', line.dataset.line === state.line)
      })
      renderArray(state)
      renderQueue(state)
      renderAnswer(state)
      noteEl.textContent = state.note
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
      }, 1050)
    })

    render()
  })()
</script>

这段代码维护队列时有三个核心动作：

第一，入队前从队尾弹出所有小于等于当前值的下标。因为当前元素更靠右、值还更大，前面那些元素以后不可能再成为最大值。

第二，把当前下标入队。队列保持从队头到队尾对应的值递减，所以队头永远是当前窗口最大值候选。

第三，检查队头是否过期。如果 `q[0] <= i - k`，说明这个下标已经不在窗口 `[i-k+1, i]` 里，要弹出。

为什么通常弹出 `<= num`，而不是 `< num`？两种都能做，但用 `<=` 会把相等的旧元素弹掉，保留更新的下标。更新的下标更晚过期，队列会更短一些。

这题最容易错的地方是过期判断。当前窗口右端是 `i`，长度是 `k`，左端就是 `i - k + 1`。所以过期条件是：

```python
q[0] < i - k + 1
```

等价写法就是：

```python
q[0] <= i - k
```

单调队列不是把所有元素都存下来，而是删掉“已经没有竞争力”的元素。它适合窗口最大值、窗口最小值这类问题；如果窗口条件本身不是固定长度，就要小心是不是应该用滑动窗口、前缀和或堆。

<span id="heap-and-priority-queue" class="algorithm-section-anchor"></span>

## 7. 堆与优先队列：动态维护最大或最小值

有些题不是按照进入顺序处理元素，而是每次都要取出“当前最小”“当前最大”或“优先级最高”的元素。典型信号包括：

- 动态加入元素，同时反复查询或删除最大值、最小值。
- 求前 `K` 个、第 `K` 大或第 `K` 小。
- 从多条有序序列中，每次取当前最小的候选。
- 按任务优先级而不是到达顺序处理任务。

这类问题通常使用优先队列，而优先队列最常见的实现就是堆。

### 7.1 优先队列和普通队列有什么区别

普通队列是一种先进先出的容器，谁先进入，谁先离开。优先队列不关心进入先后，每次优先取出优先级最高的元素。

| 结构 | 下一个离开的元素 | 常见实现 |
|---|---|---|
| 普通队列 | 最早进入的元素 | `deque`、循环数组 |
| 优先队列 | 优先级最高的元素 | 二叉堆 |

“优先队列”和“堆”不是完全相同的概念：

- 优先队列是一种抽象功能，规定了插入元素、查看最高优先级、删除最高优先级等操作。
- 堆是一种数据结构，可以高效实现这些功能。
- 优先队列也可以用有序数组、平衡树等结构实现，只是二叉堆最常见。

### 7.2 二叉堆：用数组保存一棵完全二叉树

算法题中的堆通常指二叉堆。它首先是一棵完全二叉树：除最后一层外，其余层都填满；最后一层的节点从左到右连续排列。

完全二叉树适合直接存进数组，不需要为每个节点保存左右指针。例如下面的小根堆：

```text
数组：[1, 3, 2, 7, 6, 5, 4]

                 1  index 0
              /             \
       3  index 1           2  index 2
       /       \             /       \
 7 index 3  6 index 4   5 index 5  4 index 6
```

对于下标 `i`，父子节点下标是：

```python
parent = (i - 1) // 2
left = 2 * i + 1
right = 2 * i + 2
```

这三个公式建立在数组下标从 0 开始的前提下。判断孩子是否存在时，还要检查下标是否小于 `len(heap)`。

堆只保证父子之间的大小关系，不保证整个数组有序。上面的数组中，`3` 出现在 `2` 前面并不违反小根堆性质；只要每个父节点都不大于它的孩子即可。

### 7.3 小根堆和大根堆

小根堆满足：

```text
每个父节点 <= 它的孩子
```

因此堆顶是整棵树的最小值。大根堆则相反：

```text
每个父节点 >= 它的孩子
```

因此堆顶是最大值。

| 类型 | 堆顶 | 常见用途 |
|---|---|---|
| 小根堆 | 最小值 | 前 K 大、合并有序序列、最短任务优先 |
| 大根堆 | 最大值 | 前 K 小、动态最大值 |

为什么“求前 K 大”反而维护小根堆？因为堆里只保留当前最大的 `K` 个元素，堆顶是其中最小的一个，也就是最应该被新候选淘汰的门槛。

### 7.4 插入时上浮，删除堆顶时下沉

向小根堆插入一个值时，先把它放到数组末尾，保持完全二叉树的形状。新值可能小于父节点，因此不断和父节点交换，这个过程叫上浮。

```python
def heappush_min(heap: list[int], value: int) -> None:
    heap.append(value)
    child = len(heap) - 1

    while child > 0:
        parent = (child - 1) // 2

        if heap[parent] <= heap[child]:
            break

        heap[parent], heap[child] = heap[child], heap[parent]
        child = parent
```

删除小根堆堆顶时，不能直接删除数组第一个元素，否则后面的所有元素都会移动。通常这样处理：

1. 保存堆顶答案。
2. 取出数组末尾元素并放到堆顶。
3. 把新的堆顶和两个孩子中更小的那个交换。
4. 重复交换，直到父子关系恢复，这个过程叫下沉。

```python
def heappop_min(heap: list[int]) -> int:
    if not heap:
        raise IndexError('pop from empty heap')

    minimum = heap[0]
    last = heap.pop()

    if not heap:
        return minimum

    heap[0] = last
    parent = 0

    while True:
        left = 2 * parent + 1
        right = 2 * parent + 2
        smallest = parent

        if left < len(heap) and heap[left] < heap[smallest]:
            smallest = left

        if right < len(heap) and heap[right] < heap[smallest]:
            smallest = right

        if smallest == parent:
            break

        heap[parent], heap[smallest] = heap[smallest], heap[parent]
        parent = smallest

    return minimum
```

下沉时必须和两个孩子中更小的那个交换。如果只看到左孩子更小就立刻交换，可能让父节点落到一个仍然大于右孩子的位置，堆性质就会被破坏。

下面把上浮和下沉拆成两条可切换的动画。树中的节点和下方数组是同一份数据；节点交换时，数组里的对应位置也会同步变化。

<div class="algo-demo heap-motion-demo" id="heap-motion-demo" data-mode="insert">
  <div class="algo-demo-title">
    <strong>小根堆：插入上浮与删除下沉</strong>
    <span class="algo-pill">树形结构 ↔ 数组下标</span>
  </div>
  <div class="heap-mode-switch" role="group" aria-label="选择堆操作演示">
    <button type="button" data-mode="insert" aria-pressed="true">插入 1：向上浮</button>
    <button type="button" data-mode="delete" aria-pressed="false">删除堆顶：向下沉</button>
  </div>
  <div class="heap-motion-legend" aria-label="颜色说明">
    <span><i class="heap-swatch heap-parent-swatch"></i>正在比较的父节点</span>
    <span><i class="heap-swatch heap-child-swatch"></i>选中的孩子</span>
    <span><i class="heap-swatch heap-moving-swatch"></i>新放入的位置</span>
    <span><i class="heap-swatch heap-removed-swatch"></i>准备返回的堆顶</span>
  </div>
  <div class="algo-stats">
    <span class="algo-stat">动作：<strong data-role="action"></strong></span>
    <span class="algo-stat">关系：<strong data-role="relation"></strong></span>
    <span class="algo-stat">关键值：<strong data-role="key"></strong></span>
  </div>
  <div class="heap-code-flow" data-role="code" aria-label="当前执行的代码位置"></div>
  <div class="heap-tree-wrap" role="region" aria-label="小根堆树形结构">
    <div class="heap-tree-stage" data-role="tree"></div>
  </div>
  <div class="heap-array-heading">底层数组</div>
  <div class="heap-array" data-role="array" role="list"></div>
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
    const root = document.getElementById('heap-motion-demo')
    if (!root || root.dataset.ready === 'true') return
    root.dataset.ready = 'true'

    const positions = [
      { x: 350, y: 38 },
      { x: 190, y: 118 },
      { x: 510, y: 118 },
      { x: 95, y: 208 },
      { x: 270, y: 208 },
      { x: 430, y: 208 },
      { x: 605, y: 208 }
    ]

    const codeByMode = {
      insert: [
        { id: 'append', text: 'heap.append(value)' },
        { id: 'parent', text: 'parent = (child - 1) // 2' },
        { id: 'compare', text: 'if heap[parent] <= heap[child]: break' },
        { id: 'swap', text: 'heap[parent], heap[child] = heap[child], heap[parent]' },
        { id: 'done', text: 'child == 0：上浮完成' }
      ],
      delete: [
        { id: 'save', text: 'minimum = heap[0]' },
        { id: 'pop-last', text: 'last = heap.pop()' },
        { id: 'replace', text: 'heap[0] = last' },
        { id: 'choose', text: 'smallest = min(parent, left, right)' },
        { id: 'swap', text: 'swap(parent, smallest)' },
        { id: 'done', text: 'smallest == parent：下沉完成' }
      ]
    }

    const makeState = (heap, options) => Object.assign({
      heap: heap.slice(),
      action: '',
      line: null,
      parent: null,
      child: null,
      moving: null,
      removed: null,
      swapped: [],
      result: null,
      held: null,
      relation: '—',
      key: '—',
      note: ''
    }, options)

    const buildInsertSteps = () => {
      const heap = [2, 4, 3, 8, 7, 6]
      const value = 1
      const steps = [makeState(heap, {
        action: '初始小根堆',
        key: '待插入 value = 1',
        note: '原数组已经满足小根堆性质。插入时先把新值放到数组末尾，保持完全二叉树形状。'
      })]

      heap.push(value)
      let child = heap.length - 1
      steps.push(makeState(heap, {
        action: '追加到数组末尾',
        line: 'append',
        moving: child,
        key: 'value = 1',
        relation: '新节点 child = 6',
        note: '把 1 放到下标 6。树的形状仍然完整，但 1 小于父节点 3，堆性质暂时被破坏。'
      }))

      while (child > 0) {
        const parent = Math.floor((child - 1) / 2)
        steps.push(makeState(heap, {
          action: '比较父子节点',
          line: 'compare',
          parent,
          child,
          key: 'value = 1',
          relation: 'parent = ' + parent + '，child = ' + child,
          note: '比较 heap[' + parent + '] = ' + heap[parent] + ' 和 heap[' + child + '] = ' + heap[child] +
            '。孩子更小，需要交换并继续向上。'
        }))

        const oldParent = heap[parent]
        const oldChild = heap[child]
        heap[parent] = oldChild
        heap[child] = oldParent
        steps.push(makeState(heap, {
          action: '交换父子节点',
          line: 'swap',
          swapped: [parent, child],
          moving: parent,
          key: '1 上浮到 index ' + parent,
          relation: child + ' → ' + parent,
          note: oldChild + ' 与 ' + oldParent + ' 交换位置。新值 1 上浮到下标 ' + parent + '。'
        }))
        child = parent
      }

      steps.push(makeState(heap, {
        action: '上浮完成',
        line: 'done',
        moving: 0,
        key: '堆顶 = 1',
        relation: 'child = 0，没有父节点',
        note: '1 已经到达根节点，无法继续上浮。数组重新满足小根堆性质。'
      }))

      return steps
    }

    const buildDeleteSteps = () => {
      const heap = [1, 2, 3, 4, 5, 6, 9]
      const steps = [makeState(heap, {
        action: '初始小根堆',
        key: '堆顶 = 1',
        note: '删除小根堆堆顶时，答案一定是下标 0 的最小值 1。不能直接删除数组开头。'
      })]

      const minimum = heap[0]
      steps.push(makeState(heap, {
        action: '保存堆顶答案',
        line: 'save',
        removed: 0,
        result: minimum,
        key: 'minimum = 1',
        relation: '准备返回 index 0',
        note: '先保存 minimum = heap[0] = 1；后续调整堆时，返回值不会丢失。'
      }))

      const last = heap.pop()
      steps.push(makeState(heap, {
        action: '取出数组末尾',
        line: 'pop-last',
        result: minimum,
        held: last,
        key: 'minimum = 1，last = 9',
        relation: '移除原 index 6',
        note: '取出末尾的 9，数组长度减一。下一步用 9 填补根节点留下的位置。'
      }))

      heap[0] = last
      let parent = 0
      steps.push(makeState(heap, {
        action: '末尾元素补到堆顶',
        line: 'replace',
        moving: 0,
        result: minimum,
        key: 'heap[0] = 9',
        relation: 'last → index 0',
        note: '把 9 放到堆顶，完全二叉树形状恢复；但 9 大于孩子，需要向下调整。'
      }))

      while (true) {
        const left = 2 * parent + 1
        const right = 2 * parent + 2
        let smallest = parent

        if (left < heap.length && heap[left] < heap[smallest]) smallest = left
        if (right < heap.length && heap[right] < heap[smallest]) smallest = right

        if (smallest === parent) {
          steps.push(makeState(heap, {
            action: '下沉完成',
            line: 'done',
            parent,
            result: minimum,
            key: '返回 minimum = 1',
            relation: 'index ' + parent + ' 无需继续下沉',
            note: '当前节点没有更小的孩子，父子关系已经正确。最终返回最初保存的 minimum = 1。'
          }))
          break
        }

        steps.push(makeState(heap, {
          action: '选择更小的孩子',
          line: 'choose',
          parent,
          child: smallest,
          result: minimum,
          key: 'minimum = 1',
          relation: 'parent = ' + parent + '，smallest = ' + smallest,
          note: '父节点值是 ' + heap[parent] + '，两个孩子中更小的是 heap[' + smallest + '] = ' +
            heap[smallest] + '，应该和它交换。'
        }))

        const oldParent = heap[parent]
        const oldChild = heap[smallest]
        heap[parent] = oldChild
        heap[smallest] = oldParent
        steps.push(makeState(heap, {
          action: '交换并继续下沉',
          line: 'swap',
          moving: smallest,
          swapped: [parent, smallest],
          result: minimum,
          key: oldParent + ' 下沉到 index ' + smallest,
          relation: parent + ' → ' + smallest,
          note: oldParent + ' 与更小的孩子 ' + oldChild + ' 交换。接下来从下标 ' + smallest + ' 继续检查。'
        }))
        parent = smallest
      }

      return steps
    }

    const insertSteps = buildInsertSteps()
    const deleteSteps = buildDeleteSteps()
    const actionEl = root.querySelector('[data-role="action"]')
    const relationEl = root.querySelector('[data-role="relation"]')
    const keyEl = root.querySelector('[data-role="key"]')
    const codeEl = root.querySelector('[data-role="code"]')
    const treeEl = root.querySelector('[data-role="tree"]')
    const arrayEl = root.querySelector('[data-role="array"]')
    const noteEl = root.querySelector('[data-role="note"]')
    const stepEl = root.querySelector('[data-role="step"]')
    const prevBtn = root.querySelector('[data-action="prev"]')
    const nextBtn = root.querySelector('[data-action="next"]')
    const playBtn = root.querySelector('[data-action="play"]')
    const resetBtn = root.querySelector('[data-action="reset"]')
    const modeButtons = root.querySelectorAll('[data-mode]')
    let mode = 'insert'
    let steps = insertSteps
    let index = 0
    let timer = null

    const stop = () => {
      if (timer) window.clearInterval(timer)
      timer = null
      playBtn.textContent = '播放'
    }

    const classesFor = (state, nodeIndex) => {
      const classes = []
      if (state.parent === nodeIndex) classes.push('is-parent')
      if (state.child === nodeIndex) classes.push('is-child')
      if (state.moving === nodeIndex) classes.push('is-moving')
      if (state.removed === nodeIndex) classes.push('is-removed')
      if (state.swapped.includes(nodeIndex)) classes.push('is-swapped')
      return classes
    }

    const labelsFor = (state, nodeIndex) => {
      const labels = []
      if (state.parent === nodeIndex) labels.push('parent')
      if (state.child === nodeIndex) labels.push('child')
      if (state.moving === nodeIndex) labels.push('moving')
      if (state.removed === nodeIndex) labels.push('return')
      if (state.swapped.includes(nodeIndex)) labels.push('swap')
      return labels
    }

    const renderCode = state => {
      codeEl.innerHTML = codeByMode[mode].map(line =>
        '<code class="' + (line.id === state.line ? 'active' : '') + '">' + line.text + '</code>'
      ).join('')
    }

    const renderTree = state => {
      const edges = state.heap.map((value, nodeIndex) => {
        if (nodeIndex === 0) return ''
        const parentIndex = Math.floor((nodeIndex - 1) / 2)
        const from = positions[parentIndex]
        const to = positions[nodeIndex]
        return '<line class="heap-edge" x1="' + from.x + '" y1="' + (from.y + 24) +
          '" x2="' + to.x + '" y2="' + (to.y - 24) + '"></line>'
      }).join('')

      const nodes = state.heap.map((value, nodeIndex) => {
        const point = positions[nodeIndex]
        const classes = classesFor(state, nodeIndex)
        const labels = labelsFor(state, nodeIndex)
        const badge = labels.length
          ? '<text class="heap-node-badge" x="' + point.x + '" y="' + (point.y - 31) + '">' + labels.join('/') + '</text>'
          : ''
        return '<g class="heap-tree-node ' + classes.join(' ') + '">' + badge +
          '<circle cx="' + point.x + '" cy="' + point.y + '" r="24"></circle>' +
          '<text class="heap-node-value" x="' + point.x + '" y="' + (point.y + 5) + '">' + value + '</text>' +
          '<text class="heap-node-index" x="' + point.x + '" y="' + (point.y + 39) + '">index ' + nodeIndex + '</text></g>'
      }).join('')

      treeEl.innerHTML = '<svg viewBox="0 0 700 250" role="img" aria-label="当前小根堆数组为 ' +
        state.heap.join(', ') + '">' + edges + nodes + '</svg>'
    }

    const renderArray = state => {
      arrayEl.innerHTML = state.heap.map((value, nodeIndex) => {
        const classes = ['heap-array-cell'].concat(classesFor(state, nodeIndex))
        const labels = labelsFor(state, nodeIndex)
        const badge = labels.length ? '<small>' + labels.join('/') + '</small>' : '<small>&nbsp;</small>'
        return '<div class="' + classes.join(' ') + '" role="listitem" aria-label="下标 ' + nodeIndex +
          '，值 ' + value + (labels.length ? '，' + labels.join('，') : '') + '">' + badge +
          '<strong>' + value + '</strong><span>index ' + nodeIndex + '</span></div>'
      }).join('')
    }

    const render = () => {
      const state = steps[index]
      root.dataset.mode = mode
      modeButtons.forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.mode === mode))
      })
      actionEl.textContent = state.action
      relationEl.textContent = state.relation
      keyEl.textContent = state.key
      renderCode(state)
      renderTree(state)
      renderArray(state)
      noteEl.textContent = state.note
      stepEl.textContent = '第 ' + (index + 1) + ' / ' + steps.length + ' 步'
      prevBtn.disabled = index === 0
      nextBtn.disabled = index === steps.length - 1
    }

    const setMode = nextMode => {
      stop()
      mode = nextMode
      steps = mode === 'insert' ? insertSteps : deleteSteps
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
      }, 1100)
    })

    render()
  })()
</script>

### 7.5 堆操作的复杂度

含有 `n` 个节点的完全二叉树高度是 $O(\log n)$。上浮和下沉最多走过一条从叶子到根或从根到叶子的路径，因此：

| 操作 | 时间复杂度 | 原因 |
|---|---:|---|
| 查看堆顶 | $O(1)$ | 堆顶就是数组下标 0 |
| 插入元素 | $O(\log n)$ | 末尾插入后向上调整 |
| 删除堆顶 | $O(\log n)$ | 末尾补到堆顶后向下调整 |
| 建堆 `heapify` | $O(n)$ | 从最后一个非叶子节点开始下沉 |
| 逐个插入 `n` 个元素 | $O(n \log n)$ | 每次插入都可能上浮 |

`heapify` 是 $O(n)$，不是 $O(n \log n)$。虽然单次下沉最坏是 $O(\log n)$，但靠近底部的大量节点几乎不需要移动，所有节点的实际调整高度相加是线性的。

### 7.6 Python 的 `heapq`

Python 的 `heapq` 直接把普通列表原地维护成小根堆：

```python
import heapq

heap = []
heapq.heappush(heap, 3)
heapq.heappush(heap, 1)
heapq.heappush(heap, 2)

heap[0]                 # 1，只查看堆顶
heapq.heappop(heap)     # 1，删除并返回堆顶
```

已有一批数据时，用 `heapify` 一次建堆：

```python
nums = [7, 2, 5, 1, 9]
heapq.heapify(nums)

nums[0]  # 1
```

常用接口可以这样区分：

| 接口 | 含义 |
|---|---|
| `heappush(heap, x)` | 插入 `x` |
| `heappop(heap)` | 删除并返回最小值 |
| `heapify(nums)` | 把列表原地变成堆 |
| `heappushpop(heap, x)` | 先加入 `x`，再弹出最小值 |
| `heapreplace(heap, x)` | 先弹出原堆顶，再加入 `x`；要求堆非空 |

Python 常用取负数模拟大根堆：

```python
max_heap = []

for value in [3, 1, 5]:
    heapq.heappush(max_heap, -value)

largest = -heapq.heappop(max_heap)  # 5
```

堆里也可以放元组。Python 会先比较元组第一项，第一项相同再比较第二项，因此 `(priority, item)` 很适合表示“按优先级出队”。如果第二项对象不能互相比较，可以增加一个不会重复的序号：

```python
(priority, sequence, item)
```

不要把堆数组误当成完整排序结果。只有 `heap[0]` 一定是最小值，其他位置只满足堆的父子关系；如果需要完整有序序列，必须反复 `heappop` 或另外排序。

### 7.7 前 K 个高频元素：小根堆保留最大的 K 个

[347. 前 K 个高频元素](https://leetcode.cn/problems/top-k-frequent-elements/) 要返回出现频率最高的 `k` 个元素。可以先用 `Counter` 统计频率，再维护一个大小为 `k` 的小根堆。堆里存 `(freq, num)`，频率最小的在堆顶。只要堆大小超过 `k`，就弹出频率最小的那个。

```python
from collections import Counter
import heapq


def top_k_frequent(nums: list[int], k: int) -> list[int]:
    cnt = Counter(nums)
    heap = []

    for num, freq in cnt.items():
        heapq.heappush(heap, (freq, num))

        if len(heap) > k:
            heapq.heappop(heap)

    return [num for freq, num in heap]
```

为什么用小根堆？因为我们要保留频率最大的 `k` 个元素。堆大小超过 `k` 时，最该淘汰的是当前堆里频率最小的元素，小根堆正好能用 $O(\log k)$ 的时间弹出它。

设数组长度为 `n`，不同数字数量为 `u`：统计频率是 $O(n)$，每个不同数字最多进行一次入堆和出堆，堆大小不超过 `k`，所以总时间是 $O(n + u \log k)$，额外空间是 $O(u + k)$。

如果题目要求返回有序结果，再对答案排序；但如果只要求任意顺序，直接返回堆里的元素即可。

这类题的判断信号是“前 K 个”“第 K 大”“动态最大/最小”。如果一次性完整排序也可以解决，复杂度通常是 $O(n \log n)$；只维护大小为 `k` 的堆，通常可以减少到 $O(n \log k)$。

## 8. Python 里怎么选容器

刷栈与队列题时，Python 容器选择可以简单记：

```python
stack = []
stack.append(x)
stack.pop()
```

列表末尾入栈出栈都是 $O(1)$ 平均复杂度，很适合当栈。

```python
from collections import deque

queue = deque()
queue.append(x)
queue.popleft()
```

`deque` 适合两端操作，`append`、`appendleft`、`pop`、`popleft` 都是 $O(1)$。普通 `list.pop(0)` 是 $O(n)$，不要在队列题里随手用。

```python
import heapq

heap = []
heapq.heappush(heap, x)
heapq.heappop(heap)
```

`heapq` 适合动态最值，每次入堆和出堆是 $O(\log n)$。它不是队列的先进先出，而是按优先级出队。

堆与图搜索结合的典型题是 [407. 接雨水 II](https://leetcode.cn/problems/trapping-rain-water-ii/)：小根堆始终取出当前最低的边界，再用 BFS 从这条边界向二维网格内部扩展；完整解释见[图论笔记](/algorithm/graph-theory/#trap-rain-water-ii)。

真正写题时，不要只问“该用哪个库”，要问容器里存什么：

- 栈里存字符、数字，还是下标？
- 队列里存节点、坐标，还是下标？
- 单调队列里存值还是下标？
- 堆里存单个值，还是 `(优先级, 元素)`？

容器的角色说清楚，代码基本就稳了。

## 9. 复习总览

- 栈解决“最近的未匹配对象”：括号、撤销、抵消、表达式计算。
- Python 里用 `list` 当栈，`append` 入栈，`pop` 出栈。
- 有效括号：遇到左括号入栈，遇到右括号必须匹配栈顶，最后栈要为空。
- 删除相邻重复项：当前字符和栈顶相同就弹出，否则入栈。
- 逆波兰表达式：遇到数字入栈，遇到运算符弹出 `b` 和 `a`，注意顺序是 `a op b`。
- 用栈实现队列：`in_stack` 负责输入，`out_stack` 负责输出，只有 `out_stack` 空时才倒数据。
- 用队列实现栈：可以在 `push` 后旋转队列，让最新元素到队头。
- 队列先进先出，Python 里用 `deque`，不要用 `list.pop(0)`。
- 单调队列用于固定窗口最大/最小值，队列里通常存下标。
- 滑动窗口最大值：入队前弹掉队尾更小的元素，队头过期就弹出，队头就是最大值。
- 优先队列按优先级出队，二叉堆是它最常见的实现。
- 二叉堆用数组保存完全二叉树；父节点、左孩子、右孩子下标分别是 `(i-1)//2`、`2*i+1`、`2*i+2`。
- 小根堆的父节点不大于孩子，堆顶是最小值；插入时上浮，删除堆顶后下沉。
- 查看堆顶是 $O(1)$，插入和删除堆顶是 $O(\log n)$，`heapify` 建堆是 $O(n)$。
- Python 的 `heapq` 默认维护小根堆，大根堆通常用负数模拟。
- 前 K 高频元素：`Counter` 统计频率，小根堆保留最大的 `k` 个频率。

栈和队列的本质是顺序控制。栈关注“最近”，队列关注“最早”，单调队列关注“窗口里谁还有资格成为答案”，堆关注“当前优先级最高或最低”。复习时把这个顺序关系说清楚，比单纯背代码更可靠。

<div class="algorithm-module-nav algorithm-module-nav-bottom">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/string-kmp/">上一篇：字符串与 KMP</a>
  <a href="/algorithm/binary-tree/">下一篇：二叉树递归体系</a>
</div>
