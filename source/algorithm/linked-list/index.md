---
title: 代码随想录刷题笔记：链表核心套路
date:
top_img: /img/algorithm-header-code.webp
description: 链表核心套路刷题笔记，整理 dummy head、链表反转、快慢指针、环形链表、相交链表和删除节点的指针变化与边界情况。
categories:
  - Notes
  - Algorithm
tags:
  - LeetCode
  - CodeThinking
  - Python
  - Linked List
toc: true
toc_number: false
katex: true
---

<div class="algorithm-module-nav algorithm-module-nav-top">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/array/">上一篇：数组与双指针</a>
  <a href="/algorithm/hash-table/">下一篇：哈希表与频率统计</a>
</div>

## 1. 怎么看链表题

链表题表面上是在处理节点，真正考的是“谁指向谁”。数组可以用下标随机访问，链表只能沿着 `next` 一步一步往后走，所以每一次修改指针前，都要先想清楚三个角色：

- 前驱节点是谁。
- 当前节点是谁。
- 当前节点后面的链表有没有被保存下来。

LeetCode 里的链表节点一般长这样：

```python
class ListNode:
    def __init__(self, val: int = 0, next: "ListNode | None" = None):
        self.val = val
        self.next = next
```

正式提交时题目通常已经给了 `ListNode`，不用自己再写一遍。复习时更重要的是记住：链表里的“相同”通常指节点对象相同，不是节点值相同。比如相交链表看的是两个指针是否指向同一个节点，而不是两个节点的 `val` 是否一样。

刷链表题时，我先问四个问题：

- 头节点会不会被删除、交换或变成别的节点？如果会，优先用 dummy head。
- 操作某个节点时，是否需要知道它的前驱？删除、插入、交换大多都需要。
- 是否需要找相对位置？比如倒数第 N 个、中点、环入口。
- 是否要改变 `next`？只要要改，先保存后继，防止断链。

这篇笔记不单独拆“模板”一节，代码会放在对应方法里讲。链表题最怕背代码，最好是能说出每个指针此刻的含义。

## 2. dummy head：把头节点也变成普通节点

只要题目可能修改头节点，就应该想到 dummy head。它是在真实头节点前面加一个虚拟节点：

```text
dummy -> head -> ...
```

这样原本特殊的头节点，就变成了 `dummy.next`。之后不管删除的是头节点、中间节点还是尾节点，都可以统一成“让前驱节点跳过它”。

[203. 移除链表元素](https://leetcode.cn/problems/remove-linked-list-elements/) 给一个链表和一个值 `val`，要求删除所有值等于 `val` 的节点。如果不用 dummy，开头连续几个节点都等于 `val` 时，必须先单独处理头节点；用了 dummy 之后，遍历时永远检查 `cur.next`：

```python
def remove_elements(head: ListNode | None, val: int) -> ListNode | None:
    dummy = ListNode(0, head)
    cur = dummy

    while cur.next:
        if cur.next.val == val:
            cur.next = cur.next.next
        else:
            cur = cur.next

    return dummy.next
```

这里的 `cur` 不是正在被判断的节点，而是“待判断节点的前驱”。如果 `cur.next.val == val`，删除的是 `cur.next`，删除后 `cur` 不移动，因为新的 `cur.next` 还没有检查过。如果当前节点不该删，才让 `cur` 往后走。

这道题最常见的坑有两个：一是删除节点后继续 `cur = cur.next`，可能跳过连续要删除的节点；二是最后返回了 `head`，但如果原头节点被删，真正的新头节点应该是 `dummy.next`。

dummy head 还常出现在 [21. 合并两个有序链表](https://leetcode.cn/problems/merge-two-sorted-lists/) 和 [24. 两两交换链表中的节点](https://leetcode.cn/problems/swap-nodes-in-pairs/) 里。原因一样：当新链表的头节点还不确定，或者原头节点可能被换掉时，dummy 可以让返回值稳定下来。

## 3. 删除和插入：链表题要先找前驱

数组删除一个元素时，可以用下标覆盖。链表删除一个节点时，真正能动手的是它的前驱节点。因为要删除 `node`，代码不是“删掉 node”，而是：

```text
prev.next = node.next
```

所以链表删除题经常要让指针停在“要删除节点的前一个节点”。

[19. 删除链表的倒数第 N 个节点](https://leetcode.cn/problems/remove-nth-node-from-end-of-list/) 给一个链表，要求删除倒数第 `n` 个节点，并返回头节点。因为我们从前往后走，不能直接知道倒数第 `n` 个在哪里。做法是制造距离差：让 `fast` 先走 `n` 步，再让 `slow` 和 `fast` 一起走。等 `fast` 到最后时，`slow` 就停在待删除节点的前驱。

```python
def remove_nth_from_end(head: ListNode | None, n: int) -> ListNode | None:
    dummy = ListNode(0, head)
    slow = fast = dummy

    for _ in range(n):
        fast = fast.next

    while fast.next:
        slow = slow.next
        fast = fast.next

    slow.next = slow.next.next
    return dummy.next
```

这里从 `dummy` 出发，而不是从 `head` 出发，是为了处理“删除的正好是头节点”的情况。比如链表长度是 5，删除倒数第 5 个节点，也就是删除头节点。如果没有 dummy，`slow` 很难自然停到头节点前面；有了 dummy，`slow` 最后可以停在 dummy 上，然后统一执行 `slow.next = slow.next.next`。

[707. 设计链表](https://leetcode.cn/problems/design-linked-list/) 看起来像实现类，其实是在训练插入和删除边界。比如在第 `index` 个位置前插入节点，需要找到第 `index - 1` 个节点；删除第 `index` 个节点，也需要找到第 `index - 1` 个节点。复习这题时不要急着写很多方法，先统一下标语义：`index` 是从 0 开始，还是从 1 开始；`size` 什么时候加，什么时候减；非法下标直接返回还是特殊处理。

删除和插入类题目，最重要的检查句是：我现在手里的指针是不是前驱？如果不是，改 `next` 时就很容易改错对象。

## 4. 反转链表：先保存后继，再改变指向

反转链表是链表模块的基本功。它的核心动作只有一句：把当前节点的 `next` 指向前一个节点。但这句话不能直接写，因为一旦执行 `cur.next = prev`，原来的后继节点就找不到了。所以必须先保存后继：

```python
def reverse_list(head: ListNode | None) -> ListNode | None:
    prev = None
    cur = head

    while cur:
        nxt = cur.next
        cur.next = prev
        prev = cur
        cur = nxt

    return prev
```

[206. 反转链表](https://leetcode.cn/problems/reverse-linked-list/) 就是这段逻辑本身。比如原链表是 `1 -> 2 -> 3 -> None`，第一次循环先保存 `2 -> 3`，再把 `1.next` 指向 `None`，此时已反转部分是 `1 -> None`；第二次处理 2，变成 `2 -> 1 -> None`；最后 `prev` 指向新头节点 3。

这道题的易错点不是复杂，而是顺序。`nxt = cur.next` 一定要在 `cur.next = prev` 之前。写完后可以用一句话检查：`prev` 是已经反转好的头，`cur` 是还没处理的第一个节点。

[24. 两两交换链表中的节点](https://leetcode.cn/problems/swap-nodes-in-pairs/) 是反转思想的局部版本。题目要求每两个相邻节点交换一次，不能只交换值。每一轮我们看到的是：

```text
prev -> first -> second -> after
```

交换后应该变成：

```text
prev -> second -> first -> after
```

代码要先拿到这三个节点，再改连接关系：

```python
def swap_pairs(head: ListNode | None) -> ListNode | None:
    dummy = ListNode(0, head)
    prev = dummy

    while prev.next and prev.next.next:
        first = prev.next
        second = prev.next.next
        after = second.next

        first.next = after
        second.next = first
        prev.next = second

        prev = first

    return dummy.next
```

这里 `after` 是提前保存的后半段链表。每轮交换结束后，`first` 变成这一组的尾节点，所以下一轮的前驱应该是 `prev = first`。如果交换后还让 `prev = prev.next`，指针就会落在错误位置。

反转和局部重连题，统一记一句话：改 `next` 前先保存会被覆盖的边，改完后把前驱移动到下一轮应该开始的位置。

## 5. 快慢指针：用速度差和距离差定位

快慢指针适合处理“相对位置”问题。链表没有下标，不能像数组一样直接访问中点或倒数第几个节点，所以用两个指针的距离差来定位。

[876. 链表的中间结点](https://leetcode.cn/problems/middle-of-the-linked-list/) 给一个链表，要求返回中间节点；如果有两个中间节点，返回第二个。做法是 `slow` 每次走一步，`fast` 每次走两步。等 `fast` 到尾部，`slow` 就在中间。

```python
def middle_node(head: ListNode | None) -> ListNode | None:
    slow = fast = head

    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next

    return slow
```

这段代码在偶数长度时返回靠后的中点。比如 `1 -> 2 -> 3 -> 4`，最后返回 3。这个细节在 [234. 回文链表](https://leetcode.cn/problems/palindrome-linked-list/) 里很有用，因为可以从这个中点开始反转后半段，然后和前半段比较。

[141. 环形链表](https://leetcode.cn/problems/linked-list-cycle/) 问链表里有没有环。还是快慢指针：如果没有环，`fast` 会先走到 `None`；如果有环，`fast` 早晚会在环里追上 `slow`。

```python
def has_cycle(head: ListNode | None) -> bool:
    slow = fast = head

    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next

        if slow == fast:
            return True

    return False
```

这里判断的是 `slow == fast`，也就是两个指针是否指向同一个节点。不要用 `slow.val == fast.val`，因为不同节点的值可能相同。

[142. 环形链表 II](https://leetcode.cn/problems/linked-list-cycle-ii/) 进一步要求返回环的入口。第一阶段仍然让快慢指针在环内相遇；第二阶段让一个指针从头节点出发，另一个指针从相遇点出发，两者每次都走一步，再次相遇的位置就是环入口。

下面用一个稍长一点的例子演示：

```text
1 -> 2 -> 3 -> 4 -> 5 -> 6
          ^              |
          |______________|
```

环入口是节点 `3`。注意第一次相遇点不一定是入口；在这个例子里，`slow` 和 `fast` 第一次会在节点 `5` 相遇。相遇之后，让 `p1` 从 `head` 出发，`p2` 从相遇点出发，两者每次都走一步，最后会一起到节点 `3`。

<div id="cycle-entry-demo" class="algo-demo">
  <div class="algo-demo-title">
    <span>环形链表 II 演示</span>
    <span class="algo-pill">入口 = 节点 3</span>
    <span class="algo-pill">6.next 指回 3</span>
  </div>

  <div class="linked-cycle-canvas">
    <svg viewBox="0 0 640 230" role="img" aria-label="环形链表快慢指针演示" data-cycle-svg></svg>
  </div>

  <div class="algo-stats">
    <span class="algo-stat">阶段：<strong data-phase>准备</strong></span>
    <span class="algo-stat">slow：<strong data-slow>1</strong></span>
    <span class="algo-stat">fast：<strong data-fast>1</strong></span>
    <span class="algo-stat">p1：<strong data-p1>-</strong></span>
    <span class="algo-stat">p2：<strong data-p2>-</strong></span>
    <span class="algo-stat">入口：<strong data-answer>-</strong></span>
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
      const root = document.getElementById('cycle-entry-demo')
      if (!root || root.dataset.ready === 'true') return
      root.dataset.ready = 'true'

      const nodes = [
        { value: 1, x: 60, y: 116 },
        { value: 2, x: 160, y: 116 },
        { value: 3, x: 260, y: 116 },
        { value: 4, x: 360, y: 116 },
        { value: 5, x: 460, y: 116 },
        { value: 6, x: 560, y: 116 },
      ]
      const next = [1, 2, 3, 4, 5, 2]
      const entry = 2
      const steps = []

      const label = index => nodes[index]?.value ?? '-'
      const addStep = step => steps.push({
        phase: '准备',
        slow: null,
        fast: null,
        p1: null,
        p2: null,
        meet: null,
        answer: null,
        note: '',
        ...step,
      })

      addStep({
        phase: '第一阶段：准备',
        slow: 0,
        fast: 0,
        note: 'slow 和 fast 都从 head，也就是节点 1 出发。slow 每次走一步，fast 每次走两步。',
      })

      let slow = 0
      let fast = 0
      let meet = null

      for (let round = 1; round <= 6; round += 1) {
        slow = next[slow]
        fast = next[next[fast]]

        addStep({
          phase: '第一阶段：快慢指针',
          slow,
          fast,
          note: `第 ${round} 轮移动后，slow 到节点 ${label(slow)}，fast 到节点 ${label(fast)}。如果它们没相遇，就继续在环里追。`,
        })

        if (slow === fast) {
          meet = slow
          addStep({
            phase: '第一次相遇',
            slow,
            fast,
            meet,
            note: `slow 和 fast 第一次在节点 ${label(meet)} 相遇。这个点只证明链表有环，但它不一定是入口。`,
          })
          break
        }
      }

      let p1 = 0
      let p2 = meet

      addStep({
        phase: '第二阶段：准备找入口',
        p1,
        p2,
        meet,
        note: `让 p1 回到 head，也就是节点 ${label(p1)}；让 p2 留在第一次相遇点，也就是节点 ${label(p2)}。接下来两个指针都每次走一步。`,
      })

      let syncRound = 0
      while (p1 !== p2 && syncRound < nodes.length + 1) {
        p1 = next[p1]
        p2 = next[p2]
        syncRound += 1

        addStep({
          phase: '第二阶段：同步走',
          p1,
          p2,
          meet,
          answer: p1 === p2 ? p1 : null,
          note: p1 === p2
            ? `p1 和 p2 在节点 ${label(p1)} 相遇，这里就是环入口。返回这个节点。`
            : `同步走第 ${syncRound} 步：p1 到节点 ${label(p1)}，p2 到节点 ${label(p2)}。还没相遇，继续一起走一步。`,
        })
      }

      const svg = root.querySelector('[data-cycle-svg]')
      const phaseEl = root.querySelector('[data-phase]')
      const slowEl = root.querySelector('[data-slow]')
      const fastEl = root.querySelector('[data-fast]')
      const p1El = root.querySelector('[data-p1]')
      const p2El = root.querySelector('[data-p2]')
      const answerEl = root.querySelector('[data-answer]')
      const noteEl = root.querySelector('[data-note]')
      const stepEl = root.querySelector('[data-step]')
      const prevBtn = root.querySelector('[data-prev]')
      const nextBtn = root.querySelector('[data-next]')
      const playBtn = root.querySelector('[data-play]')
      const resetBtn = root.querySelector('[data-reset]')
      let index = 0
      let timer = null

      const stop = () => {
        if (timer) window.clearInterval(timer)
        timer = null
        playBtn.textContent = '播放'
      }

      const pointerBadges = (step, nodeIndex) => {
        const badges = []
        if (step.slow === nodeIndex) badges.push({ text: 'slow', className: 'slow' })
        if (step.fast === nodeIndex) badges.push({ text: 'fast', className: 'fast' })
        if (step.p1 === nodeIndex) badges.push({ text: 'p1', className: 'p1' })
        if (step.p2 === nodeIndex) badges.push({ text: 'p2', className: 'p2' })
        if (step.answer === nodeIndex) badges.push({ text: '入口', className: 'answer' })

        return badges.map((badge, badgeIndex) => {
          const y = nodes[nodeIndex].y - 52 - badgeIndex * 18
          return `<text class="cycle-pointer-label ${badge.className}" x="${nodes[nodeIndex].x}" y="${y}">${badge.text}</text>`
        }).join('')
      }

      const nodeClass = (step, nodeIndex) => [
        'cycle-node-circle',
        nodeIndex === entry ? 'entry' : '',
        nodeIndex === step.meet ? 'meet' : '',
        nodeIndex === step.slow || nodeIndex === step.fast || nodeIndex === step.p1 || nodeIndex === step.p2 ? 'active' : '',
        nodeIndex === step.answer ? 'answer' : '',
      ].filter(Boolean).join(' ')

      const render = () => {
        const step = steps[index]
        const lineY = nodes[0].y
        const edgeStartY = lineY + 30
        const edgeCurveY = lineY + 98
        const edgeMarkup = `
          <defs>
            <marker id="cycle-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" class="cycle-arrow-head"></path>
            </marker>
          </defs>
          <path class="cycle-edge" d="M 88 ${lineY} L 132 ${lineY}" marker-end="url(#cycle-arrow)"></path>
          <path class="cycle-edge" d="M 188 ${lineY} L 232 ${lineY}" marker-end="url(#cycle-arrow)"></path>
          <path class="cycle-edge" d="M 288 ${lineY} L 332 ${lineY}" marker-end="url(#cycle-arrow)"></path>
          <path class="cycle-edge" d="M 388 ${lineY} L 432 ${lineY}" marker-end="url(#cycle-arrow)"></path>
          <path class="cycle-edge" d="M 488 ${lineY} L 532 ${lineY}" marker-end="url(#cycle-arrow)"></path>
          <path class="cycle-edge cycle-back-edge" d="M 560 ${edgeStartY} C 545 ${edgeCurveY}, 275 ${edgeCurveY}, 260 ${edgeStartY}" marker-end="url(#cycle-arrow)"></path>
        `

        const nodeMarkup = nodes.map((node, nodeIndex) => `
          <g class="cycle-node" data-node="${nodeIndex}">
            ${pointerBadges(step, nodeIndex)}
            <circle class="${nodeClass(step, nodeIndex)}" cx="${node.x}" cy="${node.y}" r="28"></circle>
            <text class="cycle-node-value" x="${node.x}" y="${node.y + 5}">${node.value}</text>
            ${nodeIndex === entry ? `<text class="cycle-entry-label" x="${node.x}" y="${node.y + 62}">入口</text>` : ''}
          </g>
        `).join('')

        svg.innerHTML = edgeMarkup + nodeMarkup

        phaseEl.textContent = step.phase
        slowEl.textContent = step.slow === null ? '-' : label(step.slow)
        fastEl.textContent = step.fast === null ? '-' : label(step.fast)
        p1El.textContent = step.p1 === null ? '-' : label(step.p1)
        p2El.textContent = step.p2 === null ? '-' : label(step.p2)
        answerEl.textContent = step.answer === null ? '-' : label(step.answer)
        noteEl.textContent = step.note
        stepEl.textContent = `第 ${index + 1} / ${steps.length} 步`
        prevBtn.disabled = index === 0
        nextBtn.disabled = index === steps.length - 1
      }

      prevBtn.addEventListener('click', () => {
        stop()
        index = Math.max(0, index - 1)
        render()
      })

      nextBtn.addEventListener('click', () => {
        stop()
        index = Math.min(steps.length - 1, index + 1)
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
        playBtn.textContent = '暂停'
        timer = window.setInterval(() => {
          if (index >= steps.length - 1) {
            stop()
            return
          }
          index += 1
          render()
        }, 1300)
      })

      render()
    })()
  </script>
</div>

这个动画里，`head` 到入口节点 `3` 需要走 2 步；第一次相遇点是节点 `5`，从节点 `5` 沿着环走回入口节点 `3`，也刚好需要 2 步：`5 -> 6 -> 3`。所以第二阶段两个指针同步走，会在入口处相遇。

```python
def detect_cycle(head: ListNode | None) -> ListNode | None:
    slow = fast = head

    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next

        if slow == fast:
            p1 = head
            p2 = slow

            while p1 != p2:
                p1 = p1.next
                p2 = p2.next

            return p1

    return None
```

复习这题时可以不每次重推公式，但要记住第二阶段不能一个快一个慢，而是两个指针都每次走一步。快慢指针题最容易错的是循环条件：只要代码里会访问 `fast.next.next`，循环条件就要先保证 `fast` 和 `fast.next` 都存在。

## 6. 相交链表：让两个指针走过同样长度

[160. 相交链表](https://leetcode.cn/problems/intersection-of-two-linked-lists/) 给两个单链表的头节点，要求判断它们是否在某个节点开始相交，并返回那个交点。如果两个链表相交，交点之后的所有节点都是同一批节点；如果只是节点值相同，不算相交。

最直观的做法是先算两个链表长度，让长链表先走长度差，再一起走。但更简洁的写法是让两个指针走完自己的链表后切到对方链表：

```python
def get_intersection_node(
    head_a: ListNode | None,
    head_b: ListNode | None,
) -> ListNode | None:
    p_a = head_a
    p_b = head_b

    while p_a != p_b:
        p_a = p_a.next if p_a else head_b
        p_b = p_b.next if p_b else head_a

    return p_a
```

如果 A 的独有长度是 `a`，B 的独有长度是 `b`，公共尾巴长度是 `c`，那么 `p_a` 走的是 `a + c + b`，`p_b` 走的是 `b + c + a`。两者走过的总长度相同，所以如果有交点，会在交点相遇；如果没有交点，会一起变成 `None`。

这题的易错点是比较值。比如两个链表里都出现了值为 8 的节点，但如果不是同一个节点对象，它们并不相交。代码里的 `p_a != p_b` 比较的是节点引用，这一点比数值更重要。

## 7. 合并、回文和重排：把基础动作组合起来

链表后面的题常常不是新方法，而是把 dummy head、快慢指针、反转链表组合起来。

[21. 合并两个有序链表](https://leetcode.cn/problems/merge-two-sorted-lists/) 给两个升序链表，要求合成一个新的升序链表。这里 dummy head 用来承接结果链表，`cur` 永远指向结果链表的尾节点。每次比较两个链表当前节点，把较小的接到 `cur.next` 后面，再移动对应链表指针。

```python
def merge_two_lists(
    list1: ListNode | None,
    list2: ListNode | None,
) -> ListNode | None:
    dummy = ListNode()
    cur = dummy

    while list1 and list2:
        if list1.val <= list2.val:
            cur.next = list1
            list1 = list1.next
        else:
            cur.next = list2
            list2 = list2.next

        cur = cur.next

    cur.next = list1 if list1 else list2
    return dummy.next
```

这题不要把每个节点都重新创建一遍，直接复用原节点即可。循环结束后，至少有一个链表已经空了，另一个链表剩下的部分本来就是有序的，可以整体接到 `cur.next`。

[234. 回文链表](https://leetcode.cn/problems/palindrome-linked-list/) 给一个链表，要求判断从前往后和从后往前读是否一样。链表不能从尾部往前走，所以做法是：先用快慢指针找到中点，再反转后半段，最后从头和反转后的后半段一起比较。

```python
def is_palindrome(head: ListNode | None) -> bool:
    if not head or not head.next:
        return True

    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next

    second = reverse_list(slow)
    first = head

    while second:
        if first.val != second.val:
            return False
        first = first.next
        second = second.next

    return True
```

这里复用了前面的 `reverse_list`。如果链表长度是奇数，`slow` 会停在中间节点，反转后半段时会把中间节点也放进去，但比较仍然成立，因为中间节点只会和自己对应的位置比较一次。

[143. 重排链表](https://leetcode.cn/problems/reorder-list/) 要把 `L0 -> L1 -> ... -> Ln` 重排成 `L0 -> Ln -> L1 -> Ln-1 ...`。它的拆法也很典型：先找中点，把链表分成前后两半；再反转后半段；最后把两个链表交替合并。这题看起来复杂，但其实就是“中点 + 反转 + 合并”三件事叠在一起。

组合题最容易错的是把所有逻辑挤在一起写。更稳的方式是先把基础动作写成清楚的小段：找到中点、断开链表、反转后半段、交替接回去。每一步都确认链表没有断丢，再进入下一步。

## 8. 复习总览

- 头节点可能变化：先建 `dummy = ListNode(0, head)`，最后返回 `dummy.next`。
- 删除节点：不要盯着当前节点，要找它的前驱，改 `prev.next`。
- 删除后指针不一定要移动，尤其是连续删除同一个值时。
- 反转链表：先保存 `nxt = cur.next`，再改 `cur.next = prev`。
- 两两交换：先画 `prev -> first -> second -> after`，交换后 `prev` 移到 `first`。
- 找中点、倒数第 N 个、判断环：优先想快慢指针。
- 删除倒数第 N 个：让 `fast` 先走 `n` 步，`slow` 停在待删除节点前驱。
- 相交链表：比较节点对象，不比较节点值；两个指针走完自己链表后切到对方链表。
- 环入口：快慢指针先相遇，再从头和相遇点同步走。
- 合并、回文、重排这类题，通常是 dummy、快慢指针、反转链表的组合。

链表题复习时只抓一条主线：每个指针现在指向哪里，它下一步要承担什么角色。只要这句话说清楚，代码就不容易乱。

<div class="algorithm-module-nav algorithm-module-nav-bottom">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/array/">上一篇：数组与双指针</a>
  <a href="/algorithm/hash-table/">下一篇：哈希表与频率统计</a>
</div>
