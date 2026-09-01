---
title: 代码随想录刷题笔记：字符串与 KMP
date:
top_img: /img/algorithm-header-code.webp
description: 字符串与 KMP 刷题笔记，整理字符串不可变、双指针反转、单词处理、字符串构造、KMP 前缀表和重复子串判断。
categories:
  - Notes
  - Algorithm
tags:
  - LeetCode
  - CodeThinking
  - Python
  - String
  - KMP
toc: true
toc_number: false
katex: true
---

<div class="algorithm-module-nav algorithm-module-nav-top">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/hash-table/">上一篇：哈希表与频率统计</a>
  <a href="/algorithm/stack-queue/">下一篇：栈与队列</a>
</div>

## 1. 怎么看字符串题

字符串题表面上是在处理字符，真正考的是“顺序、区间、匹配和构造”。它和数组很像，都能用下标访问，也经常用双指针；但字符串多了一个很重要的限制：在 Python 里，`str` 是不可变对象。

所以刷字符串题时，我会先问四个问题：

- 题目只是读字符，还是要频繁修改字符？
- 题目关心的是字符顺序、单词顺序，还是子串匹配？
- 要找的是一个固定模式，还是要判断字符频率？
- 有没有大量重复匹配，如果有，能不能用 KMP 避免回退主串？

字符串题可以粗略分成几类：

- 原地反转或局部反转：常用双指针。
- 删除空格、反转单词、替换字符：常用列表收集，最后 `join`。
- 判断异位词、赎金信、字母分组：本质是哈希表计数，放在哈希表模块里复习。
- 找子串、找模式串位置、重复子串：重点是 KMP 的前缀表。
- 连续子串满足条件：很多时候更像滑动窗口，放在数组模块里复习。

这篇主要把字符串自身最常见的处理方式和 KMP 串起来。复习时不要只记代码，要看清楚每道题到底是在维护“字符位置”“单词边界”，还是“模式串已经匹配到哪里”。

## 2. Python 字符串：不可变，所以构造方式很重要

Python 的字符串不能原地修改：

```python
s = "abc"
# s[0] = "x"  # TypeError
```

如果题目要求交换字符、反转字符，通常有两种做法：

第一种是题目直接给 `list[str]`，比如 [344. 反转字符串](https://leetcode.cn/problems/reverse-string/) 给的是字符数组 `s`，这时可以原地交换：

```python
def reverse_string(s: list[str]) -> None:
    left, right = 0, len(s) - 1

    while left < right:
        s[left], s[right] = s[right], s[left]
        left += 1
        right -= 1
```

这道题做的是最基础的双指针：左边一个、右边一个，每次交换后向中间靠拢。它不需要返回值，因为题目要求原地修改。容易错的地方是把 `while left <= right` 写进去，虽然中间元素和自己交换不影响结果，但没有必要；用 `left < right` 更贴近“成对交换”的含义。

第二种是题目给 `str`，但需要构造新字符串。这时不要在循环里频繁 `ans += ch`，因为字符串不可变，每次拼接都可能创建新对象。更稳的写法是先把字符放进列表，最后一次性拼接：

```python
chars = []
for ch in s:
    chars.append(ch)

ans = ''.join(chars)
```

如果需要先修改再拼回去，可以这样：

```python
chars = list(s)
chars[0] = "x"
ans = ''.join(chars)
```

字符串切片也要注意复杂度。`s[i:j]` 会创建新字符串，长度为 $k$ 的切片就是 $O(k)$。如果在循环里不断切片，看起来是一层循环，实际可能变成 $O(n^2)$。

## 3. 双指针反转：先想清楚反转范围

字符串反转类题的关键不是“会不会交换”，而是先确定每次要反转哪一段。

[541. 反转字符串 II](https://leetcode.cn/problems/reverse-string-ii/) 给一个字符串 `s` 和整数 `k`，要求每隔 `2k` 个字符，反转前 `k` 个字符；如果剩余字符少于 `k` 个，就全部反转；如果剩余字符在 `k` 到 `2k` 之间，就只反转前 `k` 个。

这题看起来规则多，其实每次循环的起点都是 `0, 2k, 4k...`。对于每一段，真正要反转的区间是：

```text
start = i
end = min(i + k - 1, len(chars) - 1)
```

代码可以直接复用双指针反转：

```python
def reverse_str(s: str, k: int) -> str:
    chars = list(s)

    for start in range(0, len(chars), 2 * k):
        left = start
        right = min(start + k - 1, len(chars) - 1)

        while left < right:
            chars[left], chars[right] = chars[right], chars[left]
            left += 1
            right -= 1

    return ''.join(chars)
```

这里最容易错的是 `right` 的边界。如果直接写 `start + k - 1`，最后一段可能越界；如果写成 `start + k`，又会多反转一个字符。复习时只记一句：每 `2k` 一组，只反转这一组的前 `k` 个，所以右边界是 `start + k - 1`，再和数组末尾取最小。

这一类题的经验是：字符串转列表以后，思路就和数组完全一样。只要能说清楚左闭右闭区间 `[left, right]`，交换逻辑就不会乱。

## 4. 单词处理：先处理空格，再处理顺序

[151. 反转字符串中的单词](https://leetcode.cn/problems/reverse-words-in-a-string/) 给一个字符串，要求反转单词顺序，并且去掉多余空格。比如：

```text
"  hello   world  " -> "world hello"
```

这题最容易混的是：它不是把每个字符都反过来，而是把单词的顺序反过来，同时单词内部字符顺序不变。

Python 里最直接的写法是：

```python
def reverse_words(s: str) -> str:
    return ' '.join(reversed(s.split()))
```

`split()` 不传参数时，会自动按连续空白切分，并丢掉首尾空白，所以这行代码既处理了多余空格，也反转了单词顺序。

但刷题复习时还要理解手动思路，因为这能帮你看懂原地版本：

1. 去掉多余空格，只保留单词之间一个空格。
2. 整体反转字符串。
3. 再把每个单词内部反转回来。

例如：

```text
"hello world"
整体反转 -> "dlrow olleh"
单词内反转 -> "world hello"
```

如果不用 `split()`，可以用列表先规整空格：

```python
def trim_spaces(s: str) -> list[str]:
    chars = []
    i = 0

    while i < len(s):
        while i < len(s) and s[i] == ' ':
            i += 1

        if i == len(s):
            break

        if chars:
            chars.append(' ')

        while i < len(s) and s[i] != ' ':
            chars.append(s[i])
            i += 1

    return chars
```

这段代码的重点不是背，而是理解“什么时候加空格”：只有当前面已经有单词时，才在新单词前补一个空格。这样可以自然避免开头空格、结尾空格和多个连续空格。

然后可以写一个局部反转函数，把整体和单词都用同一个逻辑处理：

```python
def reverse_range(chars: list[str], left: int, right: int) -> None:
    while left < right:
        chars[left], chars[right] = chars[right], chars[left]
        left += 1
        right -= 1


def reverse_words(s: str) -> str:
    chars = trim_spaces(s)
    reverse_range(chars, 0, len(chars) - 1)

    start = 0
    for i in range(len(chars) + 1):
        if i == len(chars) or chars[i] == ' ':
            reverse_range(chars, start, i - 1)
            start = i + 1

    return ''.join(chars)
```

这里 `for i in range(len(chars) + 1)` 是一个常见技巧：让 `i == len(chars)` 也能触发最后一个单词的处理。否则最后一个单词后面没有空格，很容易漏掉。

## 5. 替换和旋转：构造新串时不要反复搬家

有些字符串题不是匹配，而是按规则构造结果。比如把空格替换成 `%20`，或者把数字替换成指定字符串。这类题的重点是：如果字符串不可变，就不要幻想原地改，直接构造新结果。

比如“替换数字”这类题，要求把字符串中的数字字符替换成 `"number"`：

```python
def replace_number(s: str) -> str:
    ans = []

    for ch in s:
        if ch.isdigit():
            ans.append("number")
        else:
            ans.append(ch)

    return ''.join(ans)
```

`ans` 里既可以放单个字符，也可以放字符串片段，最后 `join` 会把它们拼起来。这个写法比循环里 `ans += ...` 更稳，也更符合 Python 字符串不可变的特点。

旋转字符串可以用切片，也可以用三次反转。比如把字符串右旋 `k` 位：

```text
"abcdefg", k = 2 -> "fgabcde"
```

切片写法很短：

```python
def right_rotate(s: str, k: int) -> str:
    k %= len(s)
    return s[-k:] + s[:-k]
```

如果题目强调原地思想，可以把字符串转成列表，使用三次反转：

```python
def right_rotate(s: str, k: int) -> str:
    chars = list(s)
    n = len(chars)
    k %= n

    reverse_range(chars, 0, n - 1)
    reverse_range(chars, 0, k - 1)
    reverse_range(chars, k, n - 1)

    return ''.join(chars)
```

为什么三次反转能成立？以 `abcdefg` 右旋 2 位为例：

```text
整体反转：gfedcba
反转前 2 个：fgedcba
反转后面：fgabcde
```

这类题最容易忘的是 `k %= n`。如果 `k` 大于字符串长度，不取模会导致切片范围或反转范围不好处理。取模后表示真正移动的位数。

## 6. KMP：匹配失败时，主串不回头

[28. 找出字符串中第一个匹配项的下标](https://leetcode.cn/problems/find-the-index-of-the-first-occurrence-in-a-string/) 要求在主串 `haystack` 中找到模式串 `needle` 第一次出现的位置。暴力做法是从主串每个位置开始尝试匹配：

```python
def str_str(haystack: str, needle: str) -> int:
    if needle == "":
        return 0

    for i in range(len(haystack) - len(needle) + 1):
        if haystack[i:i + len(needle)] == needle:
            return i

    return -1
```

这能过很多简单情况，但它的问题是匹配失败后会让主串回到下一个起点重新试。比如已经匹配了很多字符，最后一个字符失败，暴力会浪费掉前面已经知道的信息。

KMP 的核心就是：**主串指针不回头，模式串指针根据前缀表回退。**

假设模式串已经匹配到 `j`，现在 `haystack[i] != needle[j]`。我们不让 `i` 回退，而是问：模式串前面已经匹配过的这一段里，有没有一部分后缀可以当作新的前缀继续用？这就是前缀表要记录的信息。

前缀表，也常叫 `lps`，表示：

```text
lps[i] = pattern[0:i+1] 这一段里，最长的相等前后缀长度
```

注意这里的前后缀都不能是整个字符串本身。比如 `"abab"` 的最长相等前后缀是 `"ab"`，长度是 2。

构造 `lps` 时，`j` 表示当前已经匹配的前缀长度：

```python
def build_lps(pattern: str) -> list[int]:
    lps = [0] * len(pattern)
    j = 0

    for i in range(1, len(pattern)):
        while j > 0 and pattern[i] != pattern[j]:
            j = lps[j - 1]

        if pattern[i] == pattern[j]:
            j += 1

        lps[i] = j

    return lps
```

这段代码最难的是 `j = lps[j - 1]`。它的意思不是随便把 `j` 减一，而是跳回“上一个可继续匹配的位置”。如果当前前后缀长度是 `j`，失配后，能尝试的下一个长度就是前一个字符位置记录的最长相等前后缀。

有了 `lps`，匹配过程也保持同一个逻辑：

```python
def str_str(haystack: str, needle: str) -> int:
    if needle == "":
        return 0

    lps = build_lps(needle)
    j = 0

    for i in range(len(haystack)):
        while j > 0 and haystack[i] != needle[j]:
            j = lps[j - 1]

        if haystack[i] == needle[j]:
            j += 1

        if j == len(needle):
            return i - len(needle) + 1

    return -1
```

这里 `i` 一直向右走，从不回退。失配时只调整 `j`，也就是模式串已经匹配到的位置。匹配成功时 `j += 1`；当 `j == len(needle)`，说明整个模式串都匹配完了，起点就是 `i - len(needle) + 1`。

看 `lps` 时，不要先把它当成一串数字背。先抓住一个含义：`j` 表示“当前已经能复用的前缀长度”。因为下标从 0 开始，所以当 `j = 2` 时，意思是前面已经有长度为 2 的前缀可以复用，下一步要拿 `needle[i]` 去和 `needle[2]` 比较。

如果 `needle[i] == needle[j]`，说明这个可复用前缀还能再延长一位，于是 `j += 1`，并且 `lps[i] = j`。如果不相等，就不能直接把 `j` 减 1，而是跳到更短、但仍然可能成立的前缀长度，也就是 `j = lps[j - 1]`。

下面用 `haystack = "aabaabaaf"`、`needle = "aabaaf"` 演示一次完整过程。先看 `lps` 怎么生成，再看真正匹配时 `i = 5` 失配以后，主串指针 `i` 留在原地，模式串指针 `j` 从 `5` 回退到 `lps[4] = 2`。

<div id="kmp-demo" class="algo-demo kmp-demo">
  <div class="algo-demo-title">
    <span>KMP 逐步演示</span>
    <span class="algo-pill">haystack = aabaabaaf</span>
    <span class="algo-pill">needle = aabaaf</span>
  </div>

  <div class="algo-stats">
    <span class="algo-stat">阶段：<strong data-phase>-</strong></span>
    <span class="algo-stat kmp-stat-i">橙色 i：<strong data-i>-</strong></span>
    <span class="algo-stat kmp-stat-j">蓝色 j：<strong data-j>-</strong></span>
    <span class="algo-stat">答案：<strong data-answer>-</strong></span>
  </div>

  <div class="kmp-explain-panel">
    <div class="kmp-explain-item">
      <span class="kmp-explain-label">当前比较</span>
      <strong class="kmp-explain-value" data-compare>-</strong>
    </div>
    <div class="kmp-explain-item">
      <span class="kmp-explain-label">j 的含义</span>
      <strong class="kmp-explain-value" data-meaning>-</strong>
    </div>
    <div class="kmp-explain-item">
      <span class="kmp-explain-label">本步结论</span>
      <strong class="kmp-explain-value" data-conclusion>-</strong>
    </div>
  </div>

  <div class="algo-row-block">
    <div class="algo-row-heading">1. 构造 needle 的 lps 表</div>
    <div class="kmp-section-note"><code>lps[i]</code> 表示 <code>needle[0:i+1]</code> 的最长相等前后缀长度。</div>
    <div class="kmp-board">
      <div class="kmp-row" data-lps-pattern-row></div>
      <div class="kmp-row lps-row" data-lps-row></div>
    </div>
  </div>

  <div class="algo-row-block">
    <div class="algo-row-heading">2. 用 lps 匹配 haystack</div>
    <div class="kmp-section-note">上排是主串，下排是模式串。失配时只移动下排的 <code>needle</code>，主串 <code>i</code> 不回头。</div>
    <div class="kmp-board">
      <div class="kmp-row" data-text-row></div>
      <div class="kmp-row" data-match-pattern-row></div>
    </div>
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
      const root = document.getElementById('kmp-demo')
      if (!root || root.dataset.ready === 'true') return
      root.dataset.ready = 'true'

      const text = 'aabaabaaf'
      const pattern = 'aabaaf'
      const finalLps = [0, 1, 0, 1, 2, 0]

      const steps = [
        {
          phase: '构造 lps',
          i: '-',
          j: 0,
          answer: '-',
          lps: [0, null, null, null, null, null],
          compare: '先不比较字符',
          meaning: 'j = 0，暂时没有可复用的前缀',
          conclusion: 'lps[0] 固定为 0',
          note: '先固定 lps[0] = 0。此时 j = 0，表示当前还没有可复用的前缀长度。',
        },
        {
          phase: '构造 lps',
          i: 1,
          j: 1,
          lps: [0, 1, null, null, null, null],
          lpsI: 1,
          lpsJ: 0,
          updatedLps: 1,
          compare: 'needle[1] = a 与 needle[0] = a',
          meaning: 'j = 0，先尝试长度为 0 的前缀后面这一位',
          conclusion: '相等，j 变成 1，所以 lps[1] = 1',
          note: 'needle[1] 和 needle[0] 都是 a，匹配成功，j 从 0 变成 1，所以 lps[1] = 1。',
        },
        {
          phase: '构造 lps',
          i: 2,
          j: 0,
          lps: [0, 1, 0, null, null, null],
          lpsI: 2,
          lpsJ: 1,
          updatedLps: 2,
          mismatch: true,
          compare: 'needle[2] = b 先比 needle[1] = a，再比 needle[0] = a',
          meaning: 'j = 1 表示先试长度为 1 的前缀；失配后找更短候选',
          conclusion: '都不相等，j 回到 0，所以 lps[2] = 0',
          note: 'needle[2] 是 b，needle[1] 是 a，失配。j 先回退到 lps[0] = 0，仍然对不上 needle[0]，所以 lps[2] = 0。',
        },
        {
          phase: '构造 lps',
          i: 3,
          j: 1,
          lps: [0, 1, 0, 1, null, null],
          lpsI: 3,
          lpsJ: 0,
          updatedLps: 3,
          compare: 'needle[3] = a 与 needle[0] = a',
          meaning: 'j = 0，当前从最短候选开始试',
          conclusion: '相等，j 变成 1，所以 lps[3] = 1',
          note: 'needle[3] 和 needle[0] 都是 a，匹配成功，j 变成 1，所以 lps[3] = 1。',
        },
        {
          phase: '构造 lps',
          i: 4,
          j: 2,
          lps: [0, 1, 0, 1, 2, null],
          lpsI: 4,
          lpsJ: 1,
          updatedLps: 4,
          compare: 'needle[4] = a 与 needle[1] = a',
          meaning: 'j = 1，说明前面已经复用了长度为 1 的前缀',
          conclusion: '还能继续延长，j 变成 2，所以 lps[4] = 2',
          note: 'needle[4] 和 needle[1] 都是 a，匹配成功，j 变成 2，所以 lps[4] = 2。',
        },
        {
          phase: '构造 lps',
          i: 5,
          j: 0,
          lps: [0, 1, 0, 1, 2, 0],
          lpsI: 5,
          lpsJ: 2,
          updatedLps: 5,
          mismatch: true,
          compare: 'needle[5] = f 依次比 needle[2] = b、needle[1] = a、needle[0] = a',
          meaning: 'j 从 2 回退到 1，再回退到 0，表示候选前缀越来越短',
          conclusion: '没有任何候选能接上 f，所以 lps[5] = 0',
          note: 'needle[5] 是 f，先和 needle[2] 的 b 失配，j 回退到 lps[1] = 1；再和 needle[1] 的 a 失配，继续回退到 0，最后 lps[5] = 0。',
        },
        {
          phase: '匹配',
          i: 0,
          j: 0,
          answer: '-',
          lps: finalLps,
          offset: 0,
          compareJ: 0,
          compare: '准备比较 haystack[0] 和 needle[0]',
          meaning: '匹配阶段的 j 表示 needle 已经匹配了多少个字符',
          conclusion: '先从 j = 0 开始匹配',
          note: '开始匹配。i 指向 haystack，j 指向 needle，二者都从 0 出发。',
        },
        {
          phase: '匹配',
          i: 0,
          j: 1,
          answer: '-',
          lps: finalLps,
          offset: 0,
          compareJ: 0,
          matched: 1,
          compare: 'haystack[0] = a 与 needle[0] = a',
          meaning: 'j = 0，正在匹配 needle 的第 1 个字符',
          conclusion: '相等，j 变成 1',
          note: 'haystack[0] 和 needle[0] 都是 a，匹配成功，j 右移到 1。',
        },
        {
          phase: '匹配',
          i: 1,
          j: 2,
          answer: '-',
          lps: finalLps,
          offset: 0,
          compareJ: 1,
          matched: 2,
          compare: 'haystack[1] = a 与 needle[1] = a',
          meaning: 'j = 1，表示前面已经匹配了 1 个字符',
          conclusion: '相等，j 变成 2',
          note: 'haystack[1] 和 needle[1] 都是 a，继续匹配，j 右移到 2。',
        },
        {
          phase: '匹配',
          i: 2,
          j: 3,
          answer: '-',
          lps: finalLps,
          offset: 0,
          compareJ: 2,
          matched: 3,
          compare: 'haystack[2] = b 与 needle[2] = b',
          meaning: 'j = 2，表示前面已经匹配了 2 个字符',
          conclusion: '相等，j 变成 3',
          note: 'haystack[2] 和 needle[2] 都是 b，继续匹配，j 右移到 3。',
        },
        {
          phase: '匹配',
          i: 3,
          j: 4,
          answer: '-',
          lps: finalLps,
          offset: 0,
          compareJ: 3,
          matched: 4,
          compare: 'haystack[3] = a 与 needle[3] = a',
          meaning: 'j = 3，表示前面已经匹配了 3 个字符',
          conclusion: '相等，j 变成 4',
          note: 'haystack[3] 和 needle[3] 都是 a，继续匹配，j 右移到 4。',
        },
        {
          phase: '匹配',
          i: 4,
          j: 5,
          answer: '-',
          lps: finalLps,
          offset: 0,
          compareJ: 4,
          matched: 5,
          compare: 'haystack[4] = a 与 needle[4] = a',
          meaning: 'j = 4，表示前面已经匹配了 4 个字符',
          conclusion: '相等，j 变成 5，只差最后一位',
          note: 'haystack[4] 和 needle[4] 都是 a，继续匹配，j 右移到 5。此时只差最后一个字符。',
        },
        {
          phase: '匹配',
          i: 5,
          j: '5 → 2',
          answer: '-',
          lps: finalLps,
          offset: 0,
          compareJ: 5,
          matched: 5,
          mismatch: true,
          compare: 'haystack[5] = b 与 needle[5] = f',
          meaning: 'j = 5，表示前面 5 个字符已经匹配；失配后要找可复用前缀',
          conclusion: 'j 不乱减，直接跳到 lps[4] = 2',
          note: '关键失配：haystack[5] 是 b，needle[5] 是 f，不匹配。主串 i 不回退，j 根据 lps[4] 从 5 回退到 2。',
        },
        {
          phase: '匹配',
          i: 5,
          j: 3,
          answer: '-',
          lps: finalLps,
          offset: 3,
          compareJ: 2,
          matched: 3,
          compare: '继续用 haystack[5] = b 比 needle[2] = b',
          meaning: 'j = 2，表示保留了前面长度为 2 的可复用前缀',
          conclusion: '这次相等，j 变成 3，i 才继续向后',
          note: '回退后继续用同一个 haystack[5] 比较。现在 needle[2] 是 b，匹配成功，j 变成 3，模式串相当于整体滑到了下标 3 开始的位置。',
        },
        {
          phase: '匹配',
          i: 6,
          j: 4,
          answer: '-',
          lps: finalLps,
          offset: 3,
          compareJ: 3,
          matched: 4,
          compare: 'haystack[6] = a 与 needle[3] = a',
          meaning: 'j = 3，已经匹配了 needle 的前三位',
          conclusion: '相等，j 变成 4',
          note: 'haystack[6] 和 needle[3] 都是 a，继续匹配，j 变成 4。',
        },
        {
          phase: '匹配',
          i: 7,
          j: 5,
          answer: '-',
          lps: finalLps,
          offset: 3,
          compareJ: 4,
          matched: 5,
          compare: 'haystack[7] = a 与 needle[4] = a',
          meaning: 'j = 4，继续检查 needle 的下一位',
          conclusion: '相等，j 变成 5',
          note: 'haystack[7] 和 needle[4] 都是 a，继续匹配，j 变成 5。',
        },
        {
          phase: '匹配',
          i: 8,
          j: 6,
          answer: 3,
          lps: finalLps,
          offset: 3,
          compareJ: 5,
          matched: 6,
          found: true,
          compare: 'haystack[8] = f 与 needle[5] = f',
          meaning: 'j = 5，匹配 needle 的最后一位',
          conclusion: 'j 变成 6，完整匹配，答案是 3',
          note: 'haystack[8] 和 needle[5] 都是 f，j 等于 needle 长度，说明完整匹配。起点是 i - len(needle) + 1 = 8 - 6 + 1 = 3。',
        },
      ]

      const els = {
        phase: root.querySelector('[data-phase]'),
        i: root.querySelector('[data-i]'),
        j: root.querySelector('[data-j]'),
        answer: root.querySelector('[data-answer]'),
        compare: root.querySelector('[data-compare]'),
        meaning: root.querySelector('[data-meaning]'),
        conclusion: root.querySelector('[data-conclusion]'),
        lpsPatternRow: root.querySelector('[data-lps-pattern-row]'),
        lpsRow: root.querySelector('[data-lps-row]'),
        textRow: root.querySelector('[data-text-row]'),
        matchPatternRow: root.querySelector('[data-match-pattern-row]'),
        note: root.querySelector('[data-note]'),
        step: root.querySelector('[data-step]'),
        prev: root.querySelector('[data-prev]'),
        next: root.querySelector('[data-next]'),
        play: root.querySelector('[data-play]'),
        reset: root.querySelector('[data-reset]'),
      }

      let current = 0
      let timer = null

      const setColumns = (row, count) => {
        row.style.gridTemplateColumns = `repeat(${count}, minmax(42px, 1fr))`
      }

      const pointer = (label, position = 'top', tone = 'mid', extraClass = '') => {
        return `<span class="algo-pointer ${position} ${tone} ${extraClass}">${label}</span>`
      }

      const renderCell = ({ value, index, classes = '', top = '', bottom = '', label = 'i' }) => {
        const indexText = index === '' ? '' : `<span class="algo-index">${label} = ${index}</span>`
        return `<div class="algo-cell kmp-cell ${classes}">${top}<span class="algo-value">${value}</span>${indexText}${bottom}</div>`
      }

      const renderLps = (step) => {
        setColumns(els.lpsPatternRow, pattern.length)
        setColumns(els.lpsRow, pattern.length)

        els.lpsPatternRow.innerHTML = pattern.split('').map((ch, index) => {
          const labels = []
          if (step.lpsI === index) labels.push('i')
          if (step.lpsJ === index) labels.push('j')
          const isActive = labels.length > 0
          const classes = [
            isActive ? 'active' : '',
            labels.includes('i') ? 'i-focus' : '',
            labels.includes('j') ? 'j-focus' : '',
            step.mismatch && isActive ? 'mismatch' : '',
            step.updatedLps === index ? 'matched' : '',
          ].filter(Boolean).join(' ')
          return renderCell({
            value: ch,
            index,
            classes,
            top: labels.length ? pointer(labels.join('/'), 'top', step.mismatch ? 'end' : 'mid', labels.includes('i') ? 'kmp-pointer-i' : 'kmp-pointer-j') : '',
            label: 'p',
          })
        }).join('')

        els.lpsRow.innerHTML = (step.lps || finalLps).map((value, index) => {
          const pending = value === null || value === undefined
          const classes = [
            pending ? 'pending' : '',
            step.updatedLps === index ? 'matched' : '',
          ].filter(Boolean).join(' ')
          return renderCell({
            value: pending ? '-' : value,
            index,
            classes,
            label: 'lps',
          })
        }).join('')
      }

      const renderMatch = (step) => {
        setColumns(els.textRow, text.length)
        setColumns(els.matchPatternRow, text.length)

        const offset = step.offset ?? 0
        const matched = step.matched ?? 0
        const activeTextIndex = typeof step.i === 'number' ? step.i : -1

        els.textRow.innerHTML = text.split('').map((ch, index) => {
          const inMatchedRange = matched > 0 && index >= offset && index < offset + matched
          const classes = [
            inMatchedRange ? 'matched' : '',
            index === activeTextIndex ? 'active' : '',
            index === activeTextIndex ? 'i-focus' : '',
            step.mismatch && index === activeTextIndex ? 'mismatch' : '',
            step.found && inMatchedRange ? 'answer' : '',
          ].filter(Boolean).join(' ')
          return renderCell({
            value: ch,
            index,
            classes,
            top: index === activeTextIndex ? pointer('i', 'top', step.mismatch ? 'end' : 'mid', 'kmp-pointer-i') : '',
            label: 'h',
          })
        }).join('')

        const cells = []
        for (let index = 0; index < text.length; index += 1) {
          const patternIndex = index - offset
          if (patternIndex < 0 || patternIndex >= pattern.length) {
            cells.push(renderCell({ value: '', index: '', classes: 'placeholder', label: '' }))
            continue
          }

          const isCompared = patternIndex === step.compareJ
          const isMatched = patternIndex < matched
          const classes = [
            isMatched ? 'matched' : '',
            isCompared ? 'active' : '',
            isCompared ? 'j-focus' : '',
            step.mismatch && isCompared ? 'mismatch' : '',
            step.found && isMatched ? 'answer' : '',
          ].filter(Boolean).join(' ')

          cells.push(renderCell({
            value: pattern[patternIndex],
            index: patternIndex,
            classes,
            bottom: isCompared ? pointer('j', 'bottom', step.mismatch ? 'end' : 'slow', 'kmp-pointer-j') : '',
            label: 'n',
          }))
        }
        els.matchPatternRow.innerHTML = cells.join('')
      }

      const render = () => {
        const step = steps[current]
        els.phase.textContent = step.phase
        els.i.textContent = step.i
        els.j.textContent = step.j
        els.answer.textContent = step.answer ?? '-'
        els.compare.textContent = step.compare ?? '-'
        els.meaning.textContent = step.meaning ?? '-'
        els.conclusion.textContent = step.conclusion ?? '-'
        els.note.textContent = step.note
        els.step.textContent = `第 ${current + 1} / ${steps.length} 步`

        renderLps(step)
        renderMatch(step)
      }

      const stop = () => {
        if (timer) {
          clearInterval(timer)
          timer = null
        }
        els.play.textContent = '播放'
      }

      els.prev.addEventListener('click', () => {
        stop()
        current = Math.max(0, current - 1)
        render()
      })

      els.next.addEventListener('click', () => {
        stop()
        current = Math.min(steps.length - 1, current + 1)
        render()
      })

      els.reset.addEventListener('click', () => {
        stop()
        current = 0
        render()
      })

      els.play.addEventListener('click', () => {
        if (timer) {
          stop()
          return
        }

        els.play.textContent = '暂停'
        timer = setInterval(() => {
          if (current >= steps.length - 1) {
            stop()
            return
          }
          current += 1
          render()
        }, 1350)
      })

      render()
    })()
  </script>
</div>

KMP 的易错点主要有三个：

- `lps` 存的是长度，不是下标。
- 失配时回退的是 `j`，不是 `i`。
- 回退要用 `while`，因为回退后可能仍然失配，需要继续回退。

如果你觉得 KMP 绕，可以先记住一句话：`j` 代表“模式串当前匹配了多少个字符”。失败时，前缀表告诉你这几个已匹配字符里，有多少个还能继续用。

## 7. 重复子串：也是在看前后缀

[459. 重复的子字符串](https://leetcode.cn/problems/repeated-substring-pattern/) 要判断一个字符串能不能由某个子串重复多次构成。比如：

```text
"abab" -> True，因为 "ab" 重复 2 次
"aba" -> False
"abcabcabc" -> True，因为 "abc" 重复 3 次
```

这题有一个很巧的写法：

```python
def repeated_substring_pattern(s: str) -> bool:
    return s in (s + s)[1:-1]
```

直觉是：如果 `s` 是由重复子串构成的，那么把两个 `s` 拼起来，中间一定还能找到一个完整的 `s`。去掉首尾字符是为了避免直接匹配原来的那一份。

可以把它理解成一个“错位重叠”：`s + s` 里有两份完整的 `s`，一份从最左边开始，一份从中间开始。如果不去掉首尾，任何字符串都会在里面找到自己；去掉首尾以后，只有那些能由更短周期重复出来的字符串，才还能在中间重新拼出一份完整的 `s`。

但从 KMP 角度看，这题更能说明前缀表的意义。设 `n = len(s)`，如果最后一个位置的 `lps[-1]` 是 `x`，说明整个字符串有长度为 `x` 的最长相等前后缀。若 `n - x` 能整除 `n`，就说明这个较短的周期可以重复拼出整个字符串：

```python
def repeated_substring_pattern(s: str) -> bool:
    lps = build_lps(s)
    n = len(s)
    longest = lps[-1]

    return longest > 0 and n % (n - longest) == 0
```

这里 `n - longest` 可以理解成最小重复单元的候选长度。比如 `"ababab"` 的 `longest = 4`，`n - longest = 2`，对应重复单元 `"ab"`。因为 `6 % 2 == 0`，所以可以整除。

这题容易错在只判断 `longest > 0`。有相等前后缀不一定代表能完整重复，还必须满足周期长度能整除总长度。比如有些字符串开头和结尾相似，但中间不能被同一个周期铺满。

## 8. 复习总览

- Python 字符串不可变，频繁修改时先转 `list`，最后 `''.join(...)`。
- 原地反转类题，本质是双指针交换，先确定 `[left, right]` 的范围。
- [541. 反转字符串 II](https://leetcode.cn/problems/reverse-string-ii/)：每 `2k` 一组，只反转前 `k` 个，右边界是 `min(start + k - 1, n - 1)`。
- [151. 反转字符串中的单词](https://leetcode.cn/problems/reverse-words-in-a-string/)：先处理多余空格，再反转单词顺序；Python 可用 `' '.join(reversed(s.split()))`。
- 构造新字符串时，优先用列表收集片段，不要在大循环里反复 `+=`。
- 右旋字符串：记得 `k %= n`；切片很短，三次反转更体现原地思想。
- KMP 的核心是主串 `i` 不回退，模式串 `j` 按 `lps` 回退。
- `lps[i]` 表示 `pattern[0:i+1]` 的最长相等前后缀长度。
- KMP 失配时写 `while j > 0 and text[i] != pattern[j]: j = lps[j - 1]`。
- 重复子串可以用 `(s + s)[1:-1]`，也可以用 KMP 判断 `n % (n - lps[-1]) == 0`。

字符串题复习时最重要的是别把所有题都混成“遍历字符”。先判断它是在修改字符、整理单词、构造新串，还是做模式匹配。问题类型一清楚，双指针、列表构造、哈希表、KMP 各自该什么时候上场就很自然了。

<div class="algorithm-module-nav algorithm-module-nav-bottom">
  <a href="/algorithm/">返回算法笔记总览</a>
  <a href="/algorithm/hash-table/">上一篇：哈希表与频率统计</a>
  <a href="/algorithm/stack-queue/">下一篇：栈与队列</a>
</div>
