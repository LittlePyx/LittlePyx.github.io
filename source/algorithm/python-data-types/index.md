---
title: 算法刷题 Python 常用数据类型速查
date:
top_img: /img/algorithm-header-code.webp
description: 算法刷题 Python 数据类型速查，整理 list、str、tuple、set、dict、Counter、defaultdict、deque、heapq 的使用场景、底层实现和复杂度。
categories:
  - Notes
  - Algorithm
tags:
  - Python
  - Data Structures
  - LeetCode
toc: true
toc_number: false
katex: true
---

<div class="algorithm-module-nav algorithm-module-nav-top">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/array/">开始刷题模块：数组与双指针</a>
</div>

## 1. 刷题时怎么选数据类型

Python 刷题时，很多题不是卡在算法思想，而是卡在“这个地方该用什么容器”。容器选对了，代码会很自然；容器选错了，常常会写出很多补丁。

先记一个速查表：

| 需求 | 优先选择 | 典型场景 |
|---|---|---|
| 按下标访问、双指针、原地覆盖 | `list` | 数组、栈、排序、双指针 |
| 字符串处理 | `str` | 子串、匹配、字符统计 |
| 作为不可变组合 key | `tuple` | 坐标、状态、频率签名 |
| 判断是否出现过、去重 | `set` | 快乐数、交集、去重 |
| 建立映射关系 | `dict` | 两数之和、前缀和计数、状态映射 |
| 统计频率 | `Counter` / `defaultdict(int)` | 异位词、频率统计 |
| 队列、双端弹出 | `deque` | BFS、滑动窗口、队列模拟 |
| 每次取最小 / 最大 | `heapq` | Top K、合并有序结构、优先队列 |

判断顺序可以很简单：

- 要顺序、下标、排序：先想 `list`。
- 要查“有没有”：先想 `set`。
- 要查“对应什么”：先想 `dict`。
- 要查“出现几次”：先想 `Counter`。
- 要从两头进出：先想 `deque`。
- 要反复取最小：先想 `heapq`。

## 2. 可变、不可变和可哈希

Python 里有两个概念对刷题很重要：**可变** 和 **可哈希**。

可变对象的内容可以被修改，比如：

```python
nums = [1, 2, 3]
nums[0] = 9
```

不可变对象创建后不能原地修改，比如：

```python
s = "abc"
# s[0] = "x"  # 会报错
```

可哈希对象才能作为 `dict` 的 key 或放进 `set`。常见规则可以先这样记：

| 类型 | 可变吗 | 可作为 dict key / set 元素吗 |
|---|---|---|
| `int` | 否 | 可以 |
| `float` | 否 | 可以 |
| `str` | 否 | 可以 |
| `tuple` | 否 | 通常可以 |
| `list` | 是 | 不可以 |
| `dict` | 是 | 不可以 |
| `set` | 是 | 不可以 |

`tuple` 需要里面的元素也可哈希，才能整体可哈希：

```python
key = (1, 2)       # 可以
bad = ([1, 2], 3)  # 不可以作为 dict key，因为里面有 list
```

这在状态压缩和图搜索里很常见。比如二维坐标不要写成列表：

```python
seen.add([row, col])  # 错，list 不可哈希
```

应该写成元组：

```python
seen.add((row, col))
```

一句话：**会变的东西通常不能当 key；想当 key，就把它变成不可变表示。**

## 3. 常用类型底层怎么实现

Python 有多个实现版本，比如 CPython、PyPy。平时 LeetCode 和大多数本地环境默认说的 Python，通常指 **CPython**。下面这些实现理解不用背源码，重点是用来解释复杂度和选型。

| 类型 | CPython 里大致怎么实现 | 刷题时对应的直觉 |
|---|---|---|
| `list` | 动态数组，内部是一段连续的对象引用数组 | 下标快，尾部追加快，头部插入/删除慢 |
| `tuple` | 固定长度的对象引用数组 | 不能改，适合做状态 key |
| `str` | 不可变 Unicode 字符序列 | 修改会创建新字符串，循环拼接要谨慎 |
| `dict` | 哈希表 | key 查找平均 $O(1)$，适合映射 |
| `set` | 只存 key 的哈希表 | 判断存在平均 $O(1)$，适合去重 |
| `Counter` | `dict` 的子类，value 是计数 | 适合频率统计 |
| `defaultdict` | `dict` 的子类，带默认值工厂 | 适合自动初始化计数或列表 |
| `deque` | 分块的双端队列 | 两端进出都是 $O(1)$ |
| `heapq` | 在 `list` 上维护二叉堆 | 每次取最小值是 $O(\log n)$ |

`list` 不是链表，而是动态数组。它内部存的是对象引用，不是把对象本体直接塞进数组里。因为引用数组是连续的，所以 `nums[i]` 可以直接算位置，访问是 $O(1)$。尾部 `append` 通常也是 $O(1)$，因为 CPython 会预留一些额外空间，避免每次追加都重新分配；但如果在开头插入或删除，后面的元素引用都要移动，所以是 $O(n)$。

`tuple` 可以理解成固定长度的 `list`。创建后长度和元素引用都不能改，所以它可以表达“稳定状态”。如果里面的元素也都可哈希，整个 tuple 就能作为 `dict` 的 key 或 `set` 的元素。

`str` 是不可变的 Unicode 字符序列。不可变带来的好处是可以安全作为 key，也便于缓存哈希值；代价是修改字符串时不能原地改，切片或拼接通常会创建新字符串。所以需要频繁修改字符时，先转成 `list` 再 `''.join(...)` 更稳。

`dict` 和 `set` 的核心都是哈希表。查找一个 key 时，Python 先算 key 的哈希值，再根据哈希值去表里找位置。平均情况下查找、插入、删除接近 $O(1)$。如果发生哈希冲突，会继续探测其他位置，并用 `==` 判断是不是同一个 key。刷题时不用纠结冲突细节，只要记住：key 必须可哈希，而且哈希表用空间换时间。

`Counter` 和 `defaultdict` 本质上还是字典。`Counter` 把不存在的计数当成 0，更适合直接做频率统计；`defaultdict` 在 key 不存在时会自动调用默认工厂，比如 `int()` 生成 0，`list()` 生成空列表。

`deque` 不是普通链表，也不是单纯的动态数组。它内部由一块块固定大小的数组连接起来，所以两端追加和弹出都很快。它适合队列、BFS、滑动窗口；但如果你要大量随机访问中间元素，`list` 更合适。

`heapq` 不是一个新的容器类型，而是一组函数，用普通 `list` 维护小根堆。堆里下标关系是固定的：对下标 `i`，左孩子是 `2 * i + 1`，右孩子是 `2 * i + 2`。每次 `heappush` 或 `heappop` 都要沿着树高调整，所以复杂度是 $O(\log n)$。

这一节的复习目的很简单：看到操作就能想到成本。下标访问选 `list`，队头弹出选 `deque`，存在性判断选 `set`，映射和计数选 `dict` 系列，反复取最小选 `heapq`。

## 4. list：最常用的顺序容器

`list` 是刷题里最常见的数据类型。它支持下标访问、修改、追加、排序，也可以当栈用。

常用操作：

```python
nums = [3, 1, 2]

nums.append(4)      # 尾部加入
last = nums.pop()   # 尾部弹出
nums.sort()         # 原地排序
nums[::-1]          # 反转切片，生成新列表
```

`list` 的下标访问是 $O(1)$：

```python
nums[i]
```

尾部 `append` 和 `pop` 平均也是 $O(1)$。但头部插入和头部删除通常是 $O(n)$，因为后面的元素要整体移动：

```python
nums.insert(0, x)  # 慢
nums.pop(0)        # 慢
```

所以如果题目需要频繁从队头弹出，不要用 `list.pop(0)`，应该换成 `deque.popleft()`。

`list` 很适合当栈：

```python
stack = []
stack.append(x)
top = stack.pop()
```

[20. 有效的括号](https://leetcode.cn/problems/valid-parentheses/)、[1047. 删除字符串中的所有相邻重复项](https://leetcode.cn/problems/remove-all-adjacent-duplicates-in-string/) 这类题都可以用列表当栈。判断栈是否为空时，直接写：

```python
if stack:
    ...
```

不要写 `if stack == []`，虽然能用，但不够 Pythonic。

## 5. str：不可变的字符序列

`str` 是不可变对象，所以不能直接修改某个位置：

```python
s = "abc"
# s[1] = "x"  # 不允许
```

如果题目要求频繁修改字符串，通常先转成列表，改完再拼回字符串：

```python
chars = list(s)
chars[1] = "x"
s = "".join(chars)
```

字符串拼接要小心。如果在循环里不断 `ans += ch`，字符串每次都会创建新对象，数据大时可能变慢。更稳的写法是先放进列表，最后 `join`：

```python
parts = []
for ch in s:
    parts.append(ch)

ans = "".join(parts)
```

常用方法：

```python
s.strip()       # 去掉两端空白
s.split()       # 按空白切分
s.split(",")    # 按逗号切分
s.lower()       # 转小写
s.isdigit()     # 是否全是数字字符
```

刷字符串题时要记住：`s[i:j]` 是左闭右开区间，包含 `i`，不包含 `j`。这和数组切片一样。

## 6. tuple：不可变序列，常用作状态 key

`tuple` 和 `list` 很像，区别是 tuple 不可变。

```python
point = (2, 3)
row, col = point
```

它最常见的用途是作为 `dict` 或 `set` 的 key：

```python
seen = set()
seen.add((row, col))
```

在图论、BFS、DFS、动态规划记忆化里，状态经常要放进集合或字典。只要状态里有多个维度，就可以用 tuple 表示。

比如岛屿类题里记录坐标：

```python
visited.add((r, c))
```

比如记忆化搜索里记录两个指针：

```python
memo[(i, j)] = ans
```

如果状态是一个列表，比如一个排列结果，想放进集合去重，也要先转成 tuple：

```python
seen.add(tuple(path))
```

## 7. set：存在性判断和去重

`set` 只关心元素有没有出现，不关心出现次数。

```python
seen = set()
seen.add(x)

if x in seen:
    ...
```

常见用途：

- 判断是否重复。
- 判断状态是否出现过。
- 求交集、并集、差集。

集合运算很简洁：

```python
a = {1, 2, 3}
b = {2, 3, 4}

a & b  # 交集 {2, 3}
a | b  # 并集 {1, 2, 3, 4}
a - b  # 差集 {1}
```

[202. 快乐数](https://leetcode.cn/problems/happy-number/) 用 `set` 记录出现过的状态；[349. 两个数组的交集](https://leetcode.cn/problems/intersection-of-two-arrays/) 用 `set` 去重并求交集。

如果题目要求保留重复次数，`set` 就不合适。比如 `[2, 2]` 和 `[2, 2, 2]` 的交集 II 要返回两个 `2`，这就需要频率统计。

## 8. dict：映射关系

`dict` 存的是 key 到 value 的映射：

```python
pos = {}
pos[num] = i
```

最典型的是 `1. 两数之和`：key 是数值，value 是下标。

```python
def two_sum(nums: list[int], target: int) -> list[int]:
    pos = {}

    for i, num in enumerate(nums):
        need = target - num

        if need in pos:
            return [pos[need], i]

        pos[num] = i

    return []
```

使用 `dict` 时要说清楚两个问题：

- key 是什么？
- value 是什么？

不同题的 value 可能完全不同：

```python
value -> index
prefix_sum -> count
node -> copied_node
state -> answer
```

访问不存在的 key 时，普通字典会报错：

```python
cnt = {}
# cnt["a"] += 1  # KeyError
```

可以用 `get`：

```python
cnt["a"] = cnt.get("a", 0) + 1
```

也可以用 `defaultdict` 或 `Counter`。

## 9. Counter 和 defaultdict：频率统计

`Counter` 和 `defaultdict` 都来自 `collections`。

```python
from collections import Counter, defaultdict
```

`Counter` 适合直接统计：

```python
cnt = Counter("aabbc")
# Counter({'a': 2, 'b': 2, 'c': 1})
```

它访问不存在的 key 会返回 0：

```python
cnt["x"]  # 0
```

所以 [242. 有效的字母异位词](https://leetcode.cn/problems/valid-anagram/) 可以直接写：

```python
return Counter(s) == Counter(t)
```

`defaultdict(int)` 适合手动累加：

```python
cnt = defaultdict(int)
for num in nums:
    cnt[num] += 1
```

`defaultdict(list)` 适合分组：

```python
groups = defaultdict(list)
groups[key].append(word)
```

[49. 字母异位词分组](https://leetcode.cn/problems/group-anagrams/) 就可以用这个写法：把排序后的字符串作为 key，把同一组异位词放进同一个列表。

```python
from collections import defaultdict

def group_anagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)

    for word in strs:
        key = "".join(sorted(word))
        groups[key].append(word)

    return list(groups.values())
```

简单区分：

- 直接统计已有序列：`Counter(nums)`。
- 边遍历边自定义统计：`defaultdict(int)`。
- 按 key 分组收集列表：`defaultdict(list)`。

## 10. deque：队列和双端队列

`deque` 也来自 `collections`。

```python
from collections import deque
```

它适合从两端加入和弹出：

```python
q = deque()
q.append(x)       # 右边入队
q.popleft()       # 左边出队
q.appendleft(x)   # 左边加入
q.pop()           # 右边弹出
```

BFS 最常用 `deque`：

```python
from collections import deque

q = deque([start])

while q:
    node = q.popleft()
    for nxt in graph[node]:
        q.append(nxt)
```

不要用 `list.pop(0)` 写 BFS，因为它是 $O(n)$。`deque.popleft()` 是 $O(1)$。

`deque` 也常用于单调队列，比如滑动窗口最大值。这个场景里队列里通常存下标，而不是直接存值，因为要判断队头是否已经滑出窗口。

## 11. heapq：堆和优先队列

Python 的堆在 `heapq` 模块里，默认是小根堆，也就是每次弹出最小值。

```python
import heapq

heap = []
heapq.heappush(heap, x)
smallest = heapq.heappop(heap)
```

常见用途：

- Top K。
- 合并多个有序链表或数组。
- Dijkstra 最短路。
- 每次取当前最小或最大。

如果想要最大堆，可以把数取负数存进去：

```python
heapq.heappush(heap, -x)
max_value = -heapq.heappop(heap)
```

如果堆里存多个字段，通常用 tuple：

```python
heapq.heappush(heap, (distance, node))
```

Python 会先比较 tuple 的第一个元素，如果相同再比较第二个元素。所以如果第二个元素不可比较，可能会报错。更稳的做法是加一个递增编号作为兜底：

```python
heapq.heappush(heap, (priority, order, item))
```

刷题时看到“每次取最小”“动态维护前 K 个”“合并 K 个有序结构”，就要想到堆。

## 12. 常用复杂度速查

常见操作可以先记大概：

| 类型 | 操作 | 平均复杂度 |
|---|---|---|
| `list` | `nums[i]` | $O(1)$ |
| `list` | `append` / `pop()` | $O(1)$ |
| `list` | `insert(0, x)` / `pop(0)` | $O(n)$ |
| `list` | `sort()` | $O(n \log n)$ |
| `str` | 切片 `s[i:j]` | $O(k)$ |
| `set` | `x in seen` | $O(1)$ 平均 |
| `dict` | `key in d` / `d[key]` | $O(1)$ 平均 |
| `deque` | `append` / `popleft` | $O(1)$ |
| `heapq` | `heappush` / `heappop` | $O(\log n)$ |

注意字符串和列表切片会创建新对象：

```python
nums[i:j]
s[i:j]
```

长度是 `k` 的切片，复杂度就是 $O(k)$。有些题如果在循环里频繁切片，会从看似 $O(n)$ 变成 $O(n^2)$。

## 13. 复习总览

- 顺序访问、下标、排序、栈：`list`。
- 字符串不可变，频繁修改时先转成 `list`，最后 `''.join(...)`。
- 多维状态要做 key：用 `tuple`。
- 判断是否出现过：`set`。
- 建立映射：`dict`。
- 统计频率：`Counter` 或 `defaultdict(int)`。
- 分组收集：`defaultdict(list)`。
- BFS 队列：`deque`。
- 动态取最小 / Top K：`heapq`。
- `dict` 和 `set` 的 key 必须可哈希，`list` 不能当 key。
- 看到 `pop(0)` 要警惕，队列场景大多应该换 `deque.popleft()`。
- 记住底层直觉：`list` 是动态数组，`dict/set` 是哈希表，`deque` 是分块双端队列，`heapq` 是 list 上的二叉堆。

刷题时不要只背 API，要说清楚容器承担的角色：它是在存顺序、存存在性、存频率、存映射，还是存待处理队列。角色清楚，数据类型自然就选对了。

<div class="algorithm-module-nav algorithm-module-nav-bottom">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/array/">开始刷题模块：数组与双指针</a>
</div>
