---
title: 代码随想录刷题笔记：哈希表与频率统计
date:
top_img: /img/algorithm-header-code.webp
description: 哈希表与频率统计刷题笔记，整理 set、dict、Counter、defaultdict、两数之和、四数相加、字母异位词和频率统计的常见写法。
categories:
  - Notes
  - Algorithm
tags:
  - LeetCode
  - CodeThinking
  - Python
  - Hash Table
toc: true
toc_number: false
katex: true
---

<div class="algorithm-module-nav algorithm-module-nav-top">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/linked-list/">上一篇：链表核心套路</a>
  <a href="/algorithm/string-kmp/">下一篇：字符串与 KMP</a>
</div>

## 1. 怎么看哈希表题

哈希表题的核心不是“用一个字典”，而是把原本要反复查找的东西提前存起来，让查询从线性扫描变成接近 $O(1)$。

数组和链表更多是在维护位置关系，哈希表维护的是“映射关系”：

- 一个元素是否出现过。
- 一个元素出现了几次。
- 一个值对应哪个下标。
- 一个状态是否重复出现。
- 一个中间结果出现过多少次。

刷哈希表题时，我先问三个问题：

- 我只关心“有没有”吗？如果是，用 `set`。
- 我关心“出现几次”吗？如果是，用 `dict` 或 `Counter`。
- 我关心“这个值对应哪里”吗？如果是，用 `dict` 存值到下标、值到节点、值到状态。

Python 里常用的哈希结构有三个：

```python
seen = set()
pos = {}
cnt = Counter(nums)
```

`set` 只存键，不存值；`dict` 存键值对；`Counter` 是专门用来计数的字典。它们的底层都依赖哈希，所以 key 必须是可哈希对象，比如 `int`、`str`、`tuple` 可以，`list`、`dict` 不可以。

哈希表通常牺牲空间换时间。看到题目里有“查找是否存在”“统计频率”“两个数凑目标”“重复状态”，就要先想能不能把已扫描的信息存进哈希表。

## 2. set：只关心有没有出现过

`set` 适合处理“存在性判断”和“去重”。它不关心一个数出现几次，只关心这个数是否出现过。

[202. 快乐数](https://leetcode.cn/problems/happy-number/) 给一个整数，每次把它替换成各位数字平方和，问最后是否会变成 1。如果过程中出现了重复数字，就说明进入循环，不可能再到 1。这里我们不需要知道每个数字出现几次，只需要知道“这个状态以前见过没有”，所以用 `set`。

```python
def is_happy(n: int) -> bool:
    seen = set()

    while n != 1:
        if n in seen:
            return False

        seen.add(n)
        n = sum(int(ch) ** 2 for ch in str(n))

    return True
```

这题的关键是把“循环”转成“状态重复”。只要同一个 `n` 第二次出现，之后的变化路径就会和上一次完全一样，因此会一直绕圈。

[349. 两个数组的交集](https://leetcode.cn/problems/intersection-of-two-arrays/) 要求返回两个数组共有的元素，结果里每个元素只出现一次。因为题目不关心重复次数，直接把两个数组转成集合，再取交集即可：

```python
def intersection(nums1: list[int], nums2: list[int]) -> list[int]:
    return list(set(nums1) & set(nums2))
```

如果不用集合，就要对每个元素反复去另一个数组里查找，复杂度容易变成 $O(nm)$。集合的优势就在这里：查一个元素是否存在，平均接近 $O(1)$。

set 题最容易错的是把“是否出现过”和“出现几次”混在一起。只要题目要求保留重复次数，比如交集里 `2` 出现两次也要返回两个 `2`，`set` 就不够了，要换成频率统计。

## 3. dict 和 Counter：统计频率

如果题目问的是“数量够不够”“两个字符串字符频率是否一致”“每个元素出现几次”，就需要哈希表计数。

最基础的写法是普通 `dict`：

```python
cnt = {}
for ch in s:
    cnt[ch] = cnt.get(ch, 0) + 1
```

也可以用 `defaultdict(int)`：

```python
from collections import defaultdict

cnt = defaultdict(int)
for ch in s:
    cnt[ch] += 1
```

或者直接用 `Counter`：

```python
from collections import Counter

cnt = Counter(s)
```

这三种本质上都是“key -> 次数”。区别是：普通 `dict` 访问不存在的 key 会报错；`defaultdict(int)` 访问不存在的 key 会自动给 0；`Counter` 是专门做计数的工具，还支持比较、相减和直接统计可迭代对象。

[242. 有效的字母异位词](https://leetcode.cn/problems/valid-anagram/) 给两个字符串，判断它们是否由相同字符组成，且每个字符出现次数相同。最直接的写法是比较两个 `Counter`：

```python
from collections import Counter

def is_anagram(s: str, t: str) -> bool:
    return Counter(s) == Counter(t)
```

如果题目限定只有小写英文字母，也可以用长度为 26 的数组计数。这种写法更快，但适用范围更窄：

```python
def is_anagram(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False

    cnt = [0] * 26

    for ch in s:
        cnt[ord(ch) - ord('a')] += 1

    for ch in t:
        cnt[ord(ch) - ord('a')] -= 1

    return all(x == 0 for x in cnt)
```

复习时要注意：数组计数不是“不用哈希表”，它本质还是把字符映射到计数槽位，只是 key 的范围很小，可以用数组代替字典。

[383. 赎金信](https://leetcode.cn/problems/ransom-note/) 给两个字符串 `ransomNote` 和 `magazine`，问能不能用 `magazine` 里的字符拼出 `ransomNote`。这题不是比较两个字符串完全相等，而是判断 `magazine` 的字符数量是否足够。

```python
from collections import Counter

def can_construct(ransom_note: str, magazine: str) -> bool:
    cnt = Counter(magazine)

    for ch in ransom_note:
        if cnt[ch] == 0:
            return False
        cnt[ch] -= 1

    return True
```

这里先统计 `magazine`，再消费 `ransom_note`。如果某个字符被用完了还要继续用，就返回 `False`。这比比较两个 `Counter` 更贴近题意，因为 `magazine` 允许有多余字符。

[350. 两个数组的交集 II](https://leetcode.cn/problems/intersection-of-two-arrays-ii/) 和 349 很像，但要求重复元素也要按次数返回。比如 `[1, 2, 2, 1]` 和 `[2, 2]` 的交集是 `[2, 2]`。这时用 `Counter` 统计其中一个数组，再扫描另一个数组：

```python
from collections import Counter

def intersect(nums1: list[int], nums2: list[int]) -> list[int]:
    cnt = Counter(nums1)
    ans = []

    for num in nums2:
        if cnt[num] > 0:
            ans.append(num)
            cnt[num] -= 1

    return ans
```

频率统计题的检查点是：我是在判断“完全一样”，还是判断“一边是否足够”？前者可以比较两个计数字典，后者通常要一边统计、一边扣减。

## 4. 值到下标：边扫描边找答案

有些题不是统计次数，而是要快速找到“另一个值在哪里”。这时 `dict` 里存的不是频率，而是位置。

`1. 两数之和` 给一个数组和目标值 `target`，要求返回两个不同下标，使得两个数之和等于 `target`。暴力做法是两层循环枚举两个数；哈希表做法是边扫描边问：当前数是 `num`，我需要的另一个数就是 `target - num`，它以前出现过吗？

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

这题最重要的细节是“先查再存”。如果先把当前数存进去，再查 `need`，当 `target = 2 * num` 时，可能会把同一个下标用两次。先查，表示只从已经扫描过的元素里找搭档，天然保证两个下标不同。

如果数组里有重复值，`pos[num] = i` 会覆盖旧下标，但这对两数之和通常没问题，因为一旦能和之前的数配对，前面的 `if need in pos` 已经返回了。真正需要保留多个下标时，才需要把值映射到列表。

这种“边扫描边存”的题，哈希表里一般放的是已经处理过的信息。当前元素只和历史信息配对，不和自己配对。

## 5. 拆成两半：把多重循环降维

[454. 四数相加 II](https://leetcode.cn/problems/4sum-ii/) 给四个整数数组 `nums1`、`nums2`、`nums3`、`nums4`，要求统计有多少个四元组满足：

```text
nums1[i] + nums2[j] + nums3[k] + nums4[l] == 0
```

如果四层循环，复杂度是 $O(n^4)$。哈希表的思路是把四个数组拆成两组：先统计 `nums1 + nums2` 的所有和出现了几次，再枚举 `nums3 + nums4`，找相反数出现过几次。

```python
from collections import defaultdict

def four_sum_count(
    nums1: list[int],
    nums2: list[int],
    nums3: list[int],
    nums4: list[int],
) -> int:
    pair_sum = defaultdict(int)

    for a in nums1:
        for b in nums2:
            pair_sum[a + b] += 1

    ans = 0

    for c in nums3:
        for d in nums4:
            ans += pair_sum[-(c + d)]

    return ans
```

这里 `pair_sum[x]` 表示前两个数组里有多少对数字的和等于 `x`。后两个数组每产生一个和 `s`，只要前面有 `-s`，就能拼成 0。

这题和 `1. 两数之和` 的共同点是“找补数”，区别是两数之和返回下标，四数相加 II 统计方案数。因为要统计方案数，所以哈希表里存的是次数，不是单个下标。

这类题的常见坑是重复问题。`454` 统计的是不同下标组合，所以重复值产生的多种组合都应该算进去，不能用 `set` 去重。用 `dict` 统计 pair sum 的次数，正好保留了重复方案。

## 6. 多数之和：哈希表不是万能答案

[15. 三数之和](https://leetcode.cn/problems/3sum/) 和 [18. 四数之和](https://leetcode.cn/problems/4sum/) 常被放在哈希表章节里，但它们不一定适合用哈希表硬写。

[15. 三数之和](https://leetcode.cn/problems/3sum/) 要在数组中找所有不重复三元组，使得三数之和为 0。看起来可以固定一个数，再用哈希表做两数之和；但这题最麻烦的是“去重”。如果用哈希表，既要处理同一层重复，又要处理答案三元组重复，代码会变得很乱。更稳的做法是排序 + 双指针：

```python
def three_sum(nums: list[int]) -> list[list[int]]:
    nums.sort()
    ans = []

    for i in range(len(nums)):
        if i > 0 and nums[i] == nums[i - 1]:
            continue

        left, right = i + 1, len(nums) - 1

        while left < right:
            total = nums[i] + nums[left] + nums[right]

            if total < 0:
                left += 1
            elif total > 0:
                right -= 1
            else:
                ans.append([nums[i], nums[left], nums[right]])

                left += 1
                right -= 1

                while left < right and nums[left] == nums[left - 1]:
                    left += 1
                while left < right and nums[right] == nums[right + 1]:
                    right -= 1

    return ans
```

这题虽然在哈希表模块里复习，但核心经验是：如果题目要求返回“不重复组合”，排序往往比哈希更好管理去重。

[18. 四数之和](https://leetcode.cn/problems/4sum/) 同理。它是固定前两个数，再用左右指针找后两个数。去重逻辑比三数之和多一层，但思路一致：排序以后，相同值挨在一起，跳过重复更自然。

所以哈希表不是看到“和”就无脑用。判断标准是：题目要的是“快速查补数”还是“返回去重组合”。前者常用哈希表，后者常用排序 + 双指针。

## 7. Python 里的几个细节

`dict`、`defaultdict`、`Counter` 都可以做计数，但使用场景略有区别。

普通 `dict` 最通用，适合你想显式控制默认值的时候：

```python
cnt[num] = cnt.get(num, 0) + 1
```

`defaultdict(int)` 适合频繁自增，不想每次写 `get`：

```python
cnt[num] += 1
```

它的意思是：如果 `num` 不存在，就先自动创建 `cnt[num] = 0`，再执行 `+= 1`。

`Counter` 适合直接统计一个可迭代对象：

```python
cnt = Counter(nums)
```

但要注意，`Counter` 访问不存在的 key 也会返回 0，这一点和普通 `dict` 不一样：

```python
cnt = Counter([1, 2, 2])
cnt[99]  # 0
```

另外，哈希表的 key 必须可哈希。比如想把一个字符串排序后作为异位词分组的 key，可以用 tuple 或字符串：

```python
key = ''.join(sorted(word))
```

[49. 字母异位词分组](https://leetcode.cn/problems/group-anagrams/) 就是这个思路：异位词排序后会得到同一个 key，把它们放进同一个列表。

```python
from collections import defaultdict

def group_anagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)

    for word in strs:
        key = ''.join(sorted(word))
        groups[key].append(word)

    return list(groups.values())
```

如果只包含小写英文字母，也可以用长度为 26 的计数 tuple 当 key，避免排序：

```python
key = [0] * 26
for ch in word:
    key[ord(ch) - ord('a')] += 1
groups[tuple(key)].append(word)
```

这里必须转成 `tuple`，因为 `list` 不能作为字典 key。

## 8. 复习总览

- 只判断出现过没有：用 `set`。
- 要统计出现次数：用 `dict`、`defaultdict(int)` 或 `Counter`。
- 要找另一个数在哪里：用 `dict` 存值到下标。
- 两数之和：先查 `target - num`，再存当前 `num`，避免同一个下标用两次。
- 快乐数：看到状态会重复，想到 `seen` 集合。
- 有效字母异位词：比较字符频率，可以用 `Counter` 或 26 位数组。
- 赎金信：不是频率完全相等，而是 `magazine` 是否足够，所以要统计后扣减。
- 四数相加 II：把四个数组拆成两半，用哈希表统计前一半 pair sum 的次数。
- 三数之和、四数之和：重点是去重，排序 + 双指针通常比哈希表更稳。
- 哈希表 key 必须可哈希，`tuple` 可以，`list` 不可以。

哈希表题复习时最重要的是说清楚：key 是什么，value 是什么，什么时候查，什么时候写。只要这三个问题清楚，代码基本不会散。

<div class="algorithm-module-nav algorithm-module-nav-bottom">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/linked-list/">上一篇：链表核心套路</a>
  <a href="/algorithm/string-kmp/">下一篇：字符串与 KMP</a>
</div>
