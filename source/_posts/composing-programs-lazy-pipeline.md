---
title: 数据如何按需流动：Iterator、Generator 与惰性 Pipeline
date: 2026-09-02 10:00:00
top_img: /img/composing-programs-lazy-pipeline-nature-cover.jpg
cover: /img/composing-programs-lazy-pipeline-nature-cover.jpg
cover_credit: "Marc Hornig · National Geographic Your Shot"
cover_source: "https://www.nationalgeographic.com/photography/article/underwater-gallery-yourshot"
description: Composing Programs 第四章笔记之一：从迭代协议和生成器出发，理解惰性求值怎样把大型、持续产生的数据组织成可组合的流式处理管道。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Iterator
  - Generator
  - Data Pipeline
toc: true
toc_number: false
katex: false
---

前三章分别讨论了怎样组织函数、对象和解释器。第四章把关注点转向数据处理：当数据多到不能一次放进内存，或者数据还在持续产生时，程序应该怎样组织计算？

本篇受教材 [4.1 Introduction](https://www.composingprograms.com/pages/41-introduction.html) 与 [4.2 Implicit Sequences](https://www.composingprograms.com/pages/42-implicit-sequences.html) 启发，但不从斐波那契数列开始，而是贯穿一个更常见的场景：**逐条读取任务执行事件，筛选失败记录并统计耗时。**

整篇只沿着一条主线展开：

<div class="cp-note-map">
  <div class="cp-note-map__head">
    <span class="cp-note-map__eyebrow">本篇主线</span>
    <span class="cp-note-map__hint">从“数据放不下”走到“计算按需发生”</span>
  </div>
  <div class="cp-note-map__steps" style="--cp-map-columns: 3">
    <div class="cp-note-map__step"><span class="cp-note-map__index">01 · 问题</span><strong>数据不必同时存在</strong><small>大型文件、分页接口与持续事件流</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">02 · 协议</span><strong>Iterator 记录遍历位置</strong><small>调用者每次只索取下一个值</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">03 · 组合</span><strong>Generator 组成惰性管道</strong><small>产生、过滤、转换，直到终止操作消费</small></div>
  </div>
</div>

## 1. 问题不只是数据很大，而是数据不必同时存在

假设 `events.jsonl` 的每一行都是一条 JSON 事件。最直接的写法会先读取全部内容：

```python
import json


def load_events(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as file:
        return [json.loads(line) for line in file]
```

这种写法的结果很明确：函数返回时，所有事件都已经解析并保存在列表中。但它也隐含了一个要求：**内存必须同时容纳全部结果。**

如果文件有几十 GB，或者事件来自永不结束的消息流，“先得到完整列表”就不再是合理前提。真正需要的通常只是：

```text
取一条事件
    → 处理它
    → 丢掉不再需要的中间值
    → 再取下一条
```

可以把函数改成生成器：

```python
def iter_events(path: str):
    with open(path, encoding="utf-8") as file:
        for line in file:
            yield json.loads(line)
```

它不会立即解析全部文件，而是在调用者请求下一条数据时才继续读取。

<div class="cp-lazy-visual cp-lazy-compare">
  <div class="cp-lazy-visual__head"><strong>执行方式对照</strong><span>差别在于何时产生结果、同时保留多少数据</span></div>
  <div class="cp-lazy-lane">
    <div class="cp-lazy-lane__label"><b>立即计算</b><small>先完成，再交付</small></div>
    <div class="cp-lazy-steps" style="--lazy-steps: 4">
      <div class="cp-lazy-step"><b>完整文件</b><small>输入全部可用</small></div>
      <div class="cp-lazy-step"><b>解析所有行</b><small>一次完成</small></div>
      <div class="cp-lazy-step"><b>保存完整列表</b><small>内存随结果增长</small></div>
      <div class="cp-lazy-step"><b>开始处理</b><small>首条结果出现较晚</small></div>
    </div>
  </div>
  <div class="cp-lazy-lane cp-lazy-lane--pull">
    <div class="cp-lazy-lane__label"><b>惰性计算</b><small>请求一个，产生一个</small></div>
    <div class="cp-lazy-steps" style="--lazy-steps: 3">
      <div class="cp-lazy-step"><b>调用者请求</b><small>next() 驱动</small></div>
      <div class="cp-lazy-step"><b>读取并解析一行</b><small>只创建当前值</small></div>
      <div class="cp-lazy-step"><b>立即处理</b><small>然后等待下一次请求</small></div>
    </div>
  </div>
</div>

二者并不是“列表落后、生成器先进”。它们表达的是不同契约：

| 方式 | 创建结果时 | 内存特点 | 适合场景 |
|---|---|---|---|
| 列表 | 立即得到全部元素 | 随结果数量增长 | 数据较小，需要反复遍历或随机访问 |
| 惰性迭代 | 消费时逐个产生 | 通常只保留当前状态 | 数据很大、持续产生或只遍历一次 |

因此，惰性的核心不是“跑得更快”，而是 **不要求所有数据和中间结果同时存在**。

## 2. Iterable 与 Iterator 分别承担什么职责

理解生成器之前，必须先分清两个经常混用的概念。

### 2.1 Iterable 表示“可以开始一次遍历”

**Iterable（可迭代对象）** 能够通过 `iter(obj)` 提供一个迭代器。列表、元组、字符串、集合和文件对象都可以参与 `for` 循环，因此都是 iterable。

```python
events = ["created", "running", "finished"]
iterator = iter(events)
```

这里的列表保存数据，`iterator` 则保存“当前走到哪里”。

### 2.2 Iterator 表示“正在进行的一次遍历”

**Iterator（迭代器）** 提供两个基本操作：

```text
next(iterator)  → 返回下一个元素并向前移动
没有下一个元素 → 抛出 StopIteration
```

```python
next(iterator)  # 'created'
next(iterator)  # 'running'
next(iterator)  # 'finished'
next(iterator)  # StopIteration
```

一个 iterator 本身也是 iterable，并且 `iter(iterator)` 通常返回它自己：

```python
iter(iterator) is iterator  # True
```

这意味着它不会因为进入一个新的 `for` 循环就自动回到开头。

| 对象 | 保存的主要内容 | `iter(obj)` 的典型结果 | 能否自然重复遍历 |
|---|---|---|---|
| `list` | 全部元素 | 每次创建新的 iterator | 可以 |
| `range` | 起点、终点和步长 | 每次创建新的 iterator | 可以 |
| 文件对象 | 文件状态和读取位置 | 通常返回自身 | 通常不自动回到开头 |
| generator | 暂停的执行状态 | 返回自身 | 不可以，耗尽后结束 |

### 2.3 `for` 循环替我们处理了迭代协议

下面的循环：

```python
for event in events:
    handle(event)
```

概念上接近：

```python
iterator = iter(events)

while True:
    try:
        event = next(iterator)
    except StopIteration:
        break
    handle(event)
```

因此，`for` 并不要求对象是列表。它只依赖统一的迭代协议：能够得到 iterator，并能不断询问下一个值。

<div class="cp-lazy-visual cp-iterator-state">
  <div class="cp-lazy-visual__head"><strong>Iterator 状态</strong><span>状态只有两个，变化由 next() 的结果决定</span></div>
  <div class="cp-iterator-state__row">
    <div class="cp-state-node">
      <span class="cp-state-node__name">READY</span>
      <strong>可以继续取得元素</strong>
      <small>iter(iterable) 后进入这个状态</small>
      <em class="cp-state-node__loop">↻ next() 返回值后仍在 Ready</em>
    </div>
    <div class="cp-state-edge"><span>next() 抛出 StopIteration</span><b>→</b></div>
    <div class="cp-state-node cp-state-node--done">
      <span class="cp-state-node__name">EXHAUSTED</span>
      <strong>迭代已经结束</strong>
      <small>不会自动回到开头</small>
      <em class="cp-state-node__loop">↻ 再次 next() 仍然结束</em>
    </div>
  </div>
</div>

<p class="cp-figure-caption">Iterator 是有状态对象；“下一个元素”取决于此前已经消费了多少数据。</p>

## 3. Generator 用一段函数描述数据怎样产生

手写 iterator class 需要自己维护位置并实现 `__iter__()`、`__next__()`。Python 的 **Generator（生成器）** 让我们直接用普通控制流描述这个过程。

### 3.1 `yield` 不是“返回很多次”

包含 `yield` 的函数是 generator function：

```python
def countdown(start: int):
    current = start
    while current > 0:
        yield current
        current -= 1
```

调用它时，函数体还没有开始执行：

```python
numbers = countdown(3)  # 得到 generator object
```

第一次 `next(numbers)` 才会进入函数体，并在 `yield current` 处产生 `3`。此时函数没有结束，而是暂停并保存当前状态：

```python
next(numbers)  # 3
next(numbers)  # 2
next(numbers)  # 1
next(numbers)  # StopIteration
```

<div class="cp-lazy-visual cp-yield-timeline">
  <div class="cp-lazy-visual__head"><strong>Generator 恢复时间线</strong><span>每次 next() 都从上次暂停处继续</span></div>
  <div class="cp-yield-timeline__track">
    <div class="cp-yield-event"><code>next()</code><strong>进入函数</strong><small>运行到第一个 yield，产生 3 并暂停</small></div>
    <div class="cp-yield-event"><code>next()</code><strong>恢复执行</strong><small>从 yield 后继续，current 变为 2</small></div>
    <div class="cp-yield-event"><code>next()</code><strong>再次恢复</strong><small>产生 1，保留新的暂停位置</small></div>
    <div class="cp-yield-event"><code>next()</code><strong>函数结束</strong><small>没有新的 yield，抛出 StopIteration</small></div>
  </div>
</div>

暂停时保存的不只是局部变量 `current`，还包括指令位置和未完成的控制结构。下一次恢复时，函数从上次 `yield` 之后继续，而不是从第一行重新运行。

### 3.2 `return` 与 `yield` 建立了不同的函数契约

```text
普通函数
    调用 → 运行到 return → 一次性结束

生成器函数
    调用 → 创建 generator
    next → 运行到 yield → 暂停
    next → 从暂停点继续
    函数结束 → StopIteration
```

生成器适合表达“怎样逐步产生一系列值”，而不是“怎样立即计算一个最终值”。

### 3.3 Generator 是一次消费的执行过程

```python
numbers = countdown(3)

list(numbers)  # [3, 2, 1]
list(numbers)  # []
```

第二次为空不是数据消失了，而是第一次 `list()` 已经把这次执行过程推进到终点。如果需要重新遍历，应重新调用 generator function：

```python
list(countdown(3))
list(countdown(3))
```

## 4. Lazy Pipeline 让一个元素依次穿过多个阶段

现在回到任务事件。假设每条记录包含：

```json
{"task_id": "t-17", "status": "failed", "duration_ms": 820}
```

我们希望统计失败任务的平均耗时。可以把处理拆成小步骤：

```python
def is_failure(event: dict) -> bool:
    return event["status"] == "failed"


def duration(event: dict) -> int:
    return event["duration_ms"]
```

然后组合成管道：

```python
events = iter_events("events.jsonl")
failures = (event for event in events if is_failure(event))
durations = (duration(event) for event in failures)

total = 0
count = 0
for value in durations:
    total += value
    count += 1

average = total / count if count else 0
```

创建 `events`、`failures` 和 `durations` 时几乎没有处理数据。真正的执行由最后的 `for` 循环驱动：它请求一个 `duration`，请求会沿着整条管道向上游传播。

<div class="cp-lazy-visual cp-pipeline-visual">
  <div class="cp-lazy-visual__head"><strong>单个元素怎样穿过 Pipeline</strong><span>终止操作发起请求，数据沿主路径向右流动</span></div>
  <div class="cp-lazy-steps" style="--lazy-steps: 5">
    <div class="cp-lazy-step"><b>Source</b><small>逐行读取</small></div>
    <div class="cp-lazy-step"><b>Parse</b><small>JSON → dict</small></div>
    <div class="cp-lazy-step"><b>Filter</b><small>status == failed?</small></div>
    <div class="cp-lazy-step"><b>Map</b><small>取得 duration_ms</small></div>
    <div class="cp-lazy-step"><b>Reduce</b><small>更新 total 与 count</small></div>
  </div>
  <div class="cp-pipeline-branch"><b>Filter 为否 ↓</b><span>丢弃当前元素；下一次消费继续向 Source 请求</span></div>
</div>

<p class="cp-figure-caption">每次下游请求只推动上游产生足够的数据；中间阶段不必保存完整集合。</p>

### 4.1 中间操作与终止操作

可以按是否立即消费输入区分常见操作：

| 类型 | 常见操作 | 作用 |
|---|---|---|
| 惰性中间操作 | generator expression、`map`、`filter`、`itertools.islice` | 返回新的 iterator，描述下一阶段 |
| 终止操作 | `for`、`list`、`sum`、`min`、`max`、`next` | 真正推动迭代并产生最终结果 |

例如：

```python
pipeline = (
    event["duration_ms"]
    for event in iter_events("events.jsonl")
    if event["status"] == "failed"
)

result = sum(pipeline)  # 从这里开始消费整条管道
```

### 4.2 操作顺序仍然影响成本

下面两条管道语义可能相同，成本却不同：

```text
先转换所有事件，再过滤
先过滤事件，再转换命中的少量事件
```

如果转换很昂贵，应该尽早过滤；如果只需要前 10 条，应该尽早限制数量。惰性求值提供了避免无用工作的机会，但不会自动选择最佳顺序。

## 5. 无限序列必须与“停止条件”一起设计

惰性序列不要求预先知道长度，因此可以表示无限数据：

```python
from itertools import count, islice

task_numbers = count(start=1)
first_five = list(islice(task_numbers, 5))

print(first_five)  # [1, 2, 3, 4, 5]
```

`count()` 可以一直产生整数，但 `islice(..., 5)` 只取前五个。二者必须配合，因为下面的操作永远无法完成：

```python
list(count())  # 不要运行：试图收集无限序列
```

无限序列暴露了一个重要事实：并非所有 iterable 都支持序列的全部操作。

```text
迭代可以回答：下一个值是什么？
但未必能回答：总长度是多少？倒数第三个值是什么？
```

分页接口也可以看成长度暂时未知的序列：

```python
def iter_remote_events(client, page_size: int = 100):
    cursor = None

    while True:
        page = client.fetch_events(
            cursor=cursor,
            limit=page_size,
        )

        yield from page.items

        if page.next_cursor is None:
            return
        cursor = page.next_cursor
```

调用者只看到连续事件，不必知道后端一共请求了多少页；分页策略被隐藏在 iterable 的实现后面。

## 6. 惰性计算改变了时间，而不只是空间

把立即计算改成惰性计算后，同一段逻辑可能在不同时间执行。这个变化会影响错误、副作用和资源生命周期。

### 6.1 错误在消费时才出现

```python
def parse_numbers(lines):
    for line in lines:
        yield int(line)


numbers = parse_numbers(["10", "invalid", "30"])
```

创建 `numbers` 不会报错。第一次 `next(numbers)` 得到 `10`，第二次消费时才出现 `ValueError`。

因此，返回 generator 的函数只能保证“成功建立了一个计算过程”，不能保证其中所有数据都已验证。

### 6.2 副作用也会被推迟

```python
def traced_values(values):
    for value in values:
        print("produce", value)
        yield value
```

如果没有人消费 generator，`print` 根本不会发生。将日志、数据库写入等副作用藏进惰性管道，会让执行时机更难判断。更稳妥的做法是让中间阶段尽量保持纯粹，把副作用放在明确的消费边界。

### 6.3 资源可能比预期保持得更久

`iter_events()` 中的文件会在 generator 结束、关闭或被回收时退出 `with`。如果调用者只消费一部分后长期保存 generator，文件也可能继续保持打开。

```python
events = iter_events("events.jsonl")
first = next(events)

try:
    handle(first)
finally:
    events.close()
```

实际工程中，更适合让资源所有权清晰：要么在受控作用域内完整消费，要么显式关闭，要么把资源生命周期交给外层 context manager。

### 6.4 一条流分给多个消费者可能重新积累内存

`itertools.tee()` 可以从一个输入创建多个独立 iterator，但它需要缓存领先消费者已经读取、落后消费者尚未读取的数据。如果两者速度相差很大，缓存仍可能不断增长。

因此，“接口是 iterator”不自动等于“始终只占常量内存”。还要检查实现是否排序、缓存、分组或复制了数据。

## 7. 惰性、分批与背压解决的不是同一问题

这三个概念经常一起出现，但职责不同：

| 机制 | 主要解决的问题 |
|---|---|
| Lazy evaluation（惰性求值） | 暂时不计算尚未需要的值 |
| Batching（分批） | 用一组元素平衡调用次数和单次开销 |
| Backpressure（背压） | 消费者跟不上时，限制生产者继续堆积数据 |

同步 generator 通常采用 pull 模型：消费者调用 `next()`，生产者才继续，因此天然不会无限超前。但如果生产者独立运行，例如网络接收任务不断向队列写入，仅仅把消费者写成 generator 并不能限制队列增长。此时需要有界队列、流量控制或暂停上游。

<div class="cp-lazy-visual cp-backpressure">
  <div class="cp-lazy-visual__head"><strong>背压形成一个反馈回路</strong><span>缓冲区负责吸收波动，但不能隐藏持续过载</span></div>
  <div class="cp-lazy-steps" style="--lazy-steps: 3">
    <div class="cp-lazy-step"><b>独立生产者</b><small>持续产生事件</small></div>
    <div class="cp-lazy-step"><b>有界缓冲区</b><small>容量明确，队列可观测</small></div>
    <div class="cp-lazy-step"><b>较慢消费者</b><small>按自身速度处理</small></div>
  </div>
  <div class="cp-backpressure__feedback"><b>队列接近上限</b><span>暂停、限速或拒绝新的生产</span><b>释放容量后再恢复 ↑</b></div>
</div>

### 7.1 异步迭代处理“下一条数据还没有到”

同步 iterator 的 `next()` 需要现在返回值；当下一条数据要等待网络或其他 I/O 时，可以使用 asynchronous iterator：

```python
async for event in event_stream:
    await handle(event)
```

其本质仍是“逐个取得元素”，只是 `__anext__()` 返回 awaitable，等待期间事件循环可以运行其他任务。异步迭代扩展了迭代协议，不改变惰性管道的基本思想。

### 7.2 批大小和队列容量需要用指标校准

分批不是越大越好。批次变大通常能减少网络往返和数据库提交次数，却也会增加单批内存、失败后的重做量，以及第一条结果的等待时间。队列容量也不是越大越安全：过大的缓冲区只会把过载暂时藏在内存里，并延长任务排队时间。

工程上可以先从一个保守值开始，再同时观察三个量：

<div class="cp-engineering-panel">
  <strong>调节 Pipeline 时最有用的三个信号</strong>
  <div class="cp-engineering-panel__grid">
    <div class="cp-engineering-panel__item"><b>处理吞吐</b><span>每秒真正完成多少条，而不是进入队列多少条</span></div>
    <div class="cp-engineering-panel__item"><b>排队等待</b><span>最老元素等待多久，队列是否长期接近上限</span></div>
    <div class="cp-engineering-panel__item"><b>批次代价</b><span>单批延迟、峰值内存，以及失败后需要重做多少</span></div>
  </div>
</div>

如果队列持续增长，说明平均生产速度已经高于消费速度；这时继续扩大容量只能推迟问题，应该限速、增加消费者，或降低单条处理成本。

### 7.3 可恢复进度必须落在副作用之后

流式任务经常需要断点续跑。关键不是“保存一个 cursor”这么简单，而是决定**什么时候承认某条数据已经处理完成**。如果先保存进度、再写数据库，进程在两步之间崩溃，重启后会跳过尚未落库的数据；更稳妥的顺序是：

```text
读取一批 → 完成写入 → 确认写入成功 → 提交 cursor / offset
```

这样崩溃后最多会重放最近一批，不会静默漏掉它。代价是下游可能再次收到同一条数据，因此写入操作还需要唯一键、upsert 或幂等键来吸收重复。检查点解决“从哪里继续”，幂等性解决“重复执行是否安全”，两者不能互相替代。

## 8. 怎样选择列表、Iterator 与 Generator

可以用数据生命周期而不是个人偏好做选择：

| 需求 | 更合适的表示 |
|---|---|
| 数据较小，需要随机访问或多次遍历 | `list` / `tuple` |
| 数据范围规则明确，可按索引计算 | `range` 或自定义 sequence |
| 只需要顺序消费一次 | iterator / generator |
| 数据量很大，只需逐项转换 | generator pipeline |
| 数据来自分页接口 | 封装分页的 generator |
| 数据到达需要等待 I/O | asynchronous iterator |
| 多个消费者速度不同 | 有界 queue + backpressure，而不只是 generator |

性能判断也不能只看内存。应该同时观察：

```text
峰值内存
首条结果延迟
总处理时间
每条数据的固定开销
上游 I/O 调用次数
是否需要重复消费
```

## 9. 把本篇收束成一条执行链

<div class="cp-note-map">
  <div class="cp-note-map__head">
    <span class="cp-note-map__eyebrow">执行链</span>
    <span class="cp-note-map__hint">下游消费一次，整条管道向前推进一次</span>
  </div>
  <div class="cp-note-map__steps" style="--cp-map-columns: 4">
    <div class="cp-note-map__step"><span class="cp-note-map__index">SOURCE</span><strong>文件 · 分页 · 事件流</strong><small>数据可能很大，也可能尚未全部产生</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">ITERATE</span><strong>Iterable → Iterator</strong><small>开始一次遍历并记录当前位置</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">TRANSFORM</span><strong>Generator · itertools</strong><small>只处理当前被请求的元素</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">SINK</span><strong>for · sum · 写入</strong><small>终止操作驱动计算并产生最终效果</small></div>
  </div>
</div>

最终需要保留六个判断：

1. **Iterable 表示能够开始遍历，Iterator 表示正在进行的一次遍历**；
2. **Generator 是保存了暂停执行状态的 iterator**，不是预先装好数据的容器；
3. **惰性管道由下游消费驱动**，中间阶段通常不会立即处理全部输入；
4. **惰性求值主要改变计算发生的时间和内存模型**，不保证总计算量更小；
5. **无限序列必须配合停止条件**，iterator 也不一定支持长度、索引和重复遍历；
6. **背压需要限制独立生产者**，不能用“已经使用 generator”代替流量控制设计。

有了按需流动的数据，下一篇会继续抽象处理过程：程序不再逐步规定怎样筛选和组合数据，而是声明自己最终需要什么结果。

## 参考

- [Composing Programs 4.1：Introduction](https://www.composingprograms.com/pages/41-introduction.html)
- [Composing Programs 4.2：Implicit Sequences](https://www.composingprograms.com/pages/42-implicit-sequences.html)
- [Python Glossary：iterable、iterator 与 generator](https://docs.python.org/3/glossary.html)
- [Python 文档：`itertools`](https://docs.python.org/3/library/itertools.html)
- [Python 文档：`asyncio.Queue`](https://docs.python.org/3/library/asyncio-queue.html)
