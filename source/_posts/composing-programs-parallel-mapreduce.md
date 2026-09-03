---
title: 计算如何同时展开：并发、并行、MapReduce 与共享状态
date: 2026-09-02 13:00:00
top_img: /img/composing-programs-parallel-mapreduce-nature-cover.jpg
cover: /img/composing-programs-parallel-mapreduce-nature-cover.jpg
cover_credit: "Enric Sala · National Geographic Pristine Seas"
cover_source: "https://www.nationalgeographic.com/impact/article/ocean-conservation-photography"
description: Composing Programs 第四章笔记之四：区分并发、并行与分布式计算，理解 Python 执行模型、共享状态竞态和 MapReduce 的拆分、聚合与性能边界。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Concurrency
  - Parallelism
  - MapReduce
toc: true
toc_number: false
katex: true
---

前三篇逐步解决了数据怎样按需流动、计算目标怎样声明，以及不同机器怎样通过消息可靠协作。最后还剩一个性能问题：**当任务之间可以独立推进时，怎样让它们同时执行，并且不破坏结果正确性？**

本篇整合教材 [4.7 Distributed Data Processing](https://www.composingprograms.com/pages/47-distributed-data-processing.html) 与 [4.8 Parallel Computing](https://www.composingprograms.com/pages/48-parallel-computing.html)，沿着下面的顺序展开：

<div class="cp-note-map">
  <div class="cp-note-map__head">
    <span class="cp-note-map__eyebrow">本篇主线</span>
    <span class="cp-note-map__hint">先保证模型和正确性，再谈扩展速度</span>
  </div>
  <div class="cp-note-map__steps" style="--cp-map-columns: 3">
    <div class="cp-note-map__step"><span class="cp-note-map__index">01 · MODEL</span><strong>识别等待还是计算</strong><small>区分并发、并行、分布式与 Python 执行模型</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">02 · SAFETY</span><strong>约束共享可变状态</strong><small>理解 race，再选择 lock、queue 或分区所有权</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">03 · SCALE</span><strong>拆分、聚合并测量</strong><small>MapReduce、数据倾斜与真实加速比</small></div>
  </div>
</div>

## 1. Concurrency、Parallelism 与 Distribution 回答不同问题

这三个词经常被混用，但它们关注的不是同一件事。

| 概念 | 核心问题 | 是否要求同一时刻执行 | 是否要求多台机器 |
|---|---|---:|---:|
| Concurrency（并发） | 多个任务怎样在同一段时间内推进 | 不要求 | 不要求 |
| Parallelism（并行） | 多份计算怎样在同一时刻执行 | 要求 | 不要求 |
| Distributed Computing（分布式计算） | 独立节点怎样通过消息协作 | 不一定 | 通常是 |

### 1.1 并发是组织方式

单核 CPU 也可以并发处理多个任务：运行任务 A 一会儿，切换到 B，再回到 A。任意时刻只有一个任务执行，但多个任务都在推进。

```text
时间 ──────────────────────────>
CPU   A A | B | A | C C | B | A
```

这适合大量时间花在等待 I/O 的任务。A 等待网络时，CPU 可以推进 B。

### 1.2 并行是执行事实

多个 CPU core 同时执行不同任务，才是真正的 parallel execution：

```text
时间 ──────────────────────────>
Core 1  A A A A A
Core 2  B B B B B
Core 3  C C C C C
```

并行可能降低 CPU 密集任务的总耗时，但需要任务能够拆分，而且拆分、通信和合并不能太昂贵。

### 1.3 分布式强调独立节点与网络

分布式系统可以并行，也可以只是为了容量、隔离或容错。它最显著的特征不是“更快”，而是节点没有共享内存，并且可以局部失败。

这三者是三个可以组合的维度，而不是互斥选项。一个系统可能在多个服务节点中分别运行异步事件循环，并在每个节点里使用进程池处理 CPU 任务。

## 2. 先识别工作负载，再选择 Python 执行模型

选择工具前，先判断任务的大部分时间花在哪里：

```text
I/O-bound：等待网络、数据库、磁盘或子进程
CPU-bound：解析、压缩、推理、图像计算或数值运算
Mixed：两者都有，需要拆开不同阶段
```

### 2.1 `asyncio`：在一个线程中管理大量等待

```python
import asyncio


async def fetch_all(client, task_ids: list[str]):
    async with asyncio.TaskGroup() as group:
        tasks = [
            group.create_task(client.fetch(task_id))
            for task_id in task_ids
        ]

    return [task.result() for task in tasks]
```

协程运行到 `await` 时主动把控制权交回 event loop，让其他 coroutine 继续。它适合高层网络代码和大量 I/O 等待，但不会自动让一段持续占用 CPU 的 Python 循环在多个 core 上执行。

### 2.2 Thread：共享内存，适合阻塞式 I/O

```python
from concurrent.futures import ThreadPoolExecutor


with ThreadPoolExecutor(max_workers=16) as pool:
    results = list(pool.map(blocking_fetch, task_ids))
```

线程共享进程内对象，传递数据方便，但也因此容易产生共享状态竞态。对默认启用 GIL 的 CPython，通常同一时刻只有一个线程执行 Python bytecode；阻塞 I/O 和一些释放 GIL 的扩展操作仍然可以与其他线程重叠。

### 2.3 Process：隔离内存，适合 CPU 密集任务

```python
from concurrent.futures import ProcessPoolExecutor


with ProcessPoolExecutor() as pool:
    scores = list(pool.map(score_document, documents))
```

不同进程拥有独立解释器和内存，可以利用多个 core 执行 Python 代码。代价是：

- 创建和维护进程有成本；
- 参数与返回值通常需要序列化；
- 提交的 callable 和数据要满足 pickling 要求；
- 大对象跨进程复制可能抵消并行收益；
- 进程内修改不会自动出现在其他进程。

### 2.4 Interpreter Pool：隔离运行时状态的多核并行

Python 3.14 的 `concurrent.futures` 提供 `InterpreterPoolExecutor`。每个 worker 使用独立 interpreter，因此拥有独立 GIL 和运行时状态，可以实现多 core 并行；代价同样是对象不能像普通线程那样随意共享，需要明确通信和隔离边界。

### 2.5 Free-threaded CPython 不能被当作“从此无需同步”

从 Python 3.13 开始，CPython 提供可选的 free-threaded build，可以在关闭 Global Interpreter Lock（GIL）时让线程并行执行 Python 代码。它并不是所有安装的默认行为，第三方扩展也可能重新启用 GIL。

更重要的是：GIL 是否存在与业务状态是否线程安全是两个问题。即使某些内置类型当前使用内部锁，也不应依赖一次复合的“读—改—写”自动成为原子操作。free-threaded 环境反而使正确同步更加重要。

### 2.6 一个实用选择表

| 工作 | 首先考虑 | 主要成本与风险 |
|---|---|---|
| 大量异步 HTTP / DB 调用 | `asyncio` | 阻塞函数会卡住 event loop |
| 已有阻塞式 I/O 库 | thread pool | 共享状态与线程数量 |
| 纯 Python CPU 密集计算 | process / interpreter pool | 序列化、启动和内存 |
| C 扩展中释放 GIL 的计算 | thread 可能有效 | 取决于扩展实现 |
| 跨机器任务 | distributed worker | 网络、重试、幂等和观测 |

{% mermaid %}
flowchart LR
    START{"主要在等待 I/O？"} -->|是，库支持 async| ASYNC["asyncio"]
    START -->|是，但只有阻塞 API| THREAD["Thread Pool"]
    START -->|否，CPU 密集| SHARE{"是否必须共享进程状态？"}
    SHARE -->|否| PROCESS["Process / Interpreter Pool"]
    SHARE -->|是| REDESIGN["先重新设计状态边界<br/>再评估 thread / free-threading"]
    class ASYNC,THREAD,PROCESS cp-stage-output
    class REDESIGN cp-stage-warning
{% endmermaid %}

这不是绝对规则。最终选择要用接近真实数据量的 benchmark 验证。

### 2.7 并发数量必须有上限

`TaskGroup` 负责把一组异步任务放进同一个生命周期：离开上下文前等待全部任务；其中一个任务失败时，取消并等待其余任务，再统一报告异常。它解决的是**任务由谁创建、等待和清理**，但不会自动限制同时发出多少个请求。

如果直接为十万个 ID 同时发起 HTTP 请求，下游连接池、文件描述符和服务端都可能先被压垮。可以先用 `Semaphore` 限制正在执行的请求数：

```python
import asyncio


async def fetch_all(client, task_ids: list[str]):
    limit = asyncio.Semaphore(20)

    async def fetch_one(task_id: str):
        async with limit:
            return await client.fetch(task_id)

    async with asyncio.TaskGroup() as group:
        tasks = [group.create_task(fetch_one(task_id)) for task_id in task_ids]

    return [task.result() for task in tasks]
```

这里的 `20` 不是固定最佳值。它需要结合下游限额、连接池大小、单请求延迟和错误率压测；当并发继续增加而吞吐不再提高、P99 和错误率却上升时，瓶颈通常已经转移到下游。

上面的代码仍会一次创建与 `task_ids` 等量的 Task。如果输入本身也可能很大，应改为固定数量的 worker 从 `asyncio.Queue(maxsize=...)` 读取任务：`maxsize` 限制等待区，worker 数限制执行区。队列满时生产者的 `await put()` 会暂停，从而把背压传回上游。

## 3. 并发错误通常来自共享可变状态

假设两个线程都要把计数器加一：

```python
counter = 0


def increment():
    global counter
    counter += 1
```

`counter += 1` 的业务含义是一个动作，执行却包含多个阶段：

```text
读取旧值
计算旧值 + 1
写回新值
```

两个执行单元可能这样交错：

| 时间 | Worker A | Worker B |
|---|---|---|
| 1 | 读取 `counter = 0` | |
| 2 | | 读取 `counter = 0` |
| 3 | 计算 `1` | |
| 4 | | 计算 `1` |
| 5 | 写入 `1` | |
| 6 | | 写入 `1` |

最终结果是 `1`，虽然执行了两次加一。这类结果取决于不可预测执行顺序的错误称为 **Race Condition（竞态条件）**。

### 3.1 GIL 不能替代业务临界区

GIL 约束解释器执行 Python bytecode 的方式，但不会把任意多步业务操作自动组合成不可分割的事务。线程可能在步骤之间切换，I/O 可能释放 GIL，free-threaded build 则允许更多真实并行。

正确性必须来自显式同步或消除共享写入，而不是“在我的机器上暂时没有复现”。

## 4. Lock 保护必须连续完成的临界区

```python
from threading import Lock

counter = 0
counter_lock = Lock()


def increment():
    global counter
    with counter_lock:
        counter += 1
```

`with counter_lock` 规定同一时刻只有一个线程进入这段 **Critical Section（临界区）**。

### 4.1 锁住不变量，而不是随便锁住一行

假设账户转账需要同时满足：

```text
from.balance 减少 amount
to.balance 增加 amount
两者必须共同成功或共同失败
```

如果分别锁住两个赋值，中间仍可能暴露不一致状态。临界区边界应该覆盖必须一起成立的业务不变量。

### 4.2 锁也有成本

- 竞争会让线程等待；
- 临界区过大会降低并行度；
- 获取多个锁的顺序不一致可能造成 deadlock；
- 在锁内进行慢网络调用，会让其他任务长期停顿；
- 遗漏任何一处访问，保护就可能失效。

若必须获取多个锁，常见做法是建立全局一致的获取顺序，并尽量缩短持锁时间。

## 5. Queue 与 Single Owner 往往比共享对象更容易推理

另一种组织方式不是让多个 worker 都修改同一个对象，而是让一个所有者顺序处理更新：

{% mermaid %}
flowchart LR
    W1["Worker A"] -->|Update command| QUEUE["Bounded Queue"]
    W2["Worker B"] -->|Update command| QUEUE
    W3["Worker C"] -->|Update command| QUEUE
    QUEUE --> OWNER["State Owner<br/>顺序修改状态"]
    OWNER --> SNAPSHOT["一致状态"]
    class W1,W2,W3 cp-stage-source
    class QUEUE,OWNER cp-stage-process
    class SNAPSHOT cp-stage-output
{% endmermaid %}

这种方式把问题从：

```text
多个执行者怎样同时安全修改状态？
```

改写为：

```text
多个执行者怎样发送消息，由一个所有者按顺序修改状态？
```

Queue 还能提供缓冲和背压。它不一定比 Lock 更快，但状态所有权通常更明确。

### 5.1 四种常见正确性策略

| 策略 | 核心思想 | 适合情况 |
|---|---|---|
| Lock | 同一时刻只允许一个执行者访问临界区 | 小范围共享内存状态 |
| Queue / Message Passing | 通过消息交给单一所有者更新 | 任务流水线和状态机 |
| Immutable Data | 数据创建后不再修改 | 可以复制或共享只读快照 |
| Partitioned Ownership | 每个 worker 只写自己的分片 | 可按 key 或区间拆分的数据 |

最理想的并行任务不是“用了很多锁”，而是各任务大部分时间不需要共享写入。

## 6. MapReduce 把大规模数据处理拆成可并行阶段

当数据集大到需要多个 worker 或机器处理时，MapReduce 提供了一种经典组织方式。它不要求业务代码管理每台机器，而是把应用逻辑分成 Map 与 Reduce，框架负责分片、传输、分组、调度和失败恢复。

教材将流程概括为三步：

1. Map 对每个输入产生零个或多个中间 key-value；
2. Shuffle 把相同 key 的值送到一起；
3. Reduce 聚合某个 key 对应的全部值。

{% mermaid %}
flowchart LR
    INPUT["输入分片<br/>task events"] --> M1["Mapper 1"]
    INPUT --> M2["Mapper 2"]
    INPUT --> M3["Mapper 3"]
    M1 --> SHUFFLE["Shuffle / Group by Key"]
    M2 --> SHUFFLE
    M3 --> SHUFFLE
    SHUFFLE --> R1["Reducer<br/>service = search"]
    SHUFFLE --> R2["Reducer<br/>service = storage"]
    R1 --> OUTPUT["聚合结果"]
    R2 --> OUTPUT
    class INPUT cp-stage-source
    class M1,M2,M3,SHUFFLE,R1,R2 cp-stage-process
    class OUTPUT cp-stage-output
{% endmermaid %}

### 6.1 Map：把输入变成中间 key-value

统计每个服务的失败任务数量：

```python
def map_failure(event: dict):
    if event["status"] == "failed":
        yield event["service"], 1
```

输入：

```text
{service: search,  status: failed}
{service: storage, status: succeeded}
{service: search,  status: failed}
```

Map 输出：

```text
(search, 1)
(search, 1)
```

每条输入可以独立处理，因此 map tasks 很容易分散到不同 worker。

### 6.2 Shuffle：让相同 key 的值汇合

```text
search  → [1, 1, 1, ...]
storage → [1, 1, ...]
```

Shuffle 往往是最昂贵的阶段之一，因为它需要分区、排序和网络传输。业务代码中只看到 key，框架却必须保证同一 key 的值进入同一个逻辑 reduce group。

### 6.3 Reduce：把一个 key 的值聚合成结果

```python
def reduce_counts(values):
    return sum(values)
```

结果：

```text
search  → 3
storage → 2
```

MapReduce 的关键价值是 separation of concerns：

```text
应用开发者：定义怎样处理一条数据、怎样合并一组结果
执行框架：负责机器通信、任务调度、分组、重试和进度
```

### 6.4 工程执行还需要分片、局部聚合与失败恢复

真实作业不会只运行三个函数。框架还要决定输入如何分片、每个 task 处理多少数据、失败后从哪里重试，以及 Shuffle 中间结果存在哪里。

- **分片太小**：调度、序列化和启动开销会淹没有效计算；
- **分片太大**：少数慢任务拖住全局，失败时需要重做更多数据；
- **Map 端局部聚合**：如果操作满足结合律，可以先在每个 mapper 内合并同一 key，显著减少 Shuffle 数据量；
- **阶段边界持久化**：上游结果可靠落盘后，下游失败只需重跑当前阶段，不必从原始输入重新开始。

例如计数的合并满足结合律，`1 + 1 + 1` 可以先在本地变成 `3` 再发送；而“按原始到达顺序拼接字符串”通常不能随意重排。能否安全局部聚合，取决于运算的代数性质，而不是框架是否提供 `combiner` 开关。

## 7. 纯函数为什么更容易被并行、重排和重试

如果 mapper 对同一输入总产生相同输出，并且不修改外部状态，框架就可以：

- 在任意 worker 上执行；
- 改变输入处理顺序；
- 同时运行多个副本；
- worker 失败后重新执行；
- 在接近数据的位置执行。

反之，如果 mapper 每处理一条记录就直接扣款、发送邮件或更新全局计数器，任务重试可能重复产生副作用，执行顺序也会影响结果。

```text
纯计算输出中间值 → 框架负责可靠聚合
直接修改外部世界 → 应用自己承担重复与顺序问题
```

这与上一篇的幂等性形成连接：无法保持纯粹的边界，至少要设计可去重的副作用。

## 8. Key 设计决定数据怎样分布

MapReduce 不会自动保证负载均匀。假设 90% 的事件都属于 `search` 服务：

```text
Reducer A：search  → 9000 万条
Reducer B：storage →  300 万条
Reducer C：other   →  700 万条
```

大多数 reducer 已经完成时，整个作业仍要等待 Reducer A。这称为 **Data Skew（数据倾斜）** 或 hot key。

常见处理思路包括：

- 在 map 端先做局部聚合，减少中间数据；
- 为热点 key 增加随机或范围分片，再做第二次汇总；
- 根据历史分布定制 partitioner；
- 将极端热点单独处理；
- 观察每个 partition 的数据量和完成时间。

{% mermaid %}
flowchart LR
    HOT["hot key<br/>search"] --> P1["search#1"]
    HOT --> P2["search#2"]
    HOT --> P3["search#3"]
    P1 --> PARTIAL["并行局部聚合"]
    P2 --> PARTIAL
    P3 --> PARTIAL
    PARTIAL --> FINAL["第二阶段合并<br/>search total"]
    class HOT cp-stage-warning
    class P1,P2,P3,PARTIAL cp-stage-process
    class FINAL cp-stage-output
{% endmermaid %}

key 不只是业务字段，也是执行计划的一部分。

## 9. 并行并不自动更快

把任务拆成更多份会引入额外成本：

```text
创建 worker
调度任务
序列化和复制数据
网络或进程间通信
同步等待
合并结果
处理失败和重试
```

如果单个任务只需要几十微秒，调度到另一个进程可能比本地直接执行更慢。合适的粒度应该让每个任务的有效计算明显大于调度与传输成本。

### 9.1 Amdahl's Law 说明串行部分限制加速比

设程序中必须串行执行的比例为 $s$，其余部分可以由 $N$ 个执行单元理想并行，则理论加速比为：

$$
S(N) = \frac{1}{s + \frac{1-s}{N}}
$$

如果 $s = 0.1$，即使并行资源无限增加，加速比上限也只有：

$$
\lim_{N \to \infty} S(N) = \frac{1}{0.1} = 10
$$

现实中还存在通信、负载不均、锁竞争和 cache miss，实际加速通常低于这个上限。

### 9.2 应该测量什么

| 指标 | 说明 |
|---|---|
| Throughput | 单位时间完成多少任务 |
| Latency | 单个任务完成需要多久，尤其关注 P95/P99 |
| CPU utilization | 是否真正利用多个 core |
| Queue wait | 时间花在计算还是排队 |
| Serialization cost | 传输前后的编码开销 |
| Lock contention | worker 是否大量等待锁 |
| Partition skew | 最慢分片是否拖住全局 |
| Retry rate | 失败恢复是否吞噬吞吐量 |

优化目标也要明确：提高吞吐量不一定降低单次延迟，增加 worker 也可能让下游数据库先成为瓶颈。

## 10. 把第四章的抽象串成一条完整数据路径

<div class="cp-note-map">
  <div class="cp-note-map__head">
    <span class="cp-note-map__eyebrow">第四章全景</span>
    <span class="cp-note-map__hint">数据从进入系统到可靠产出结果</span>
  </div>
  <div class="cp-note-map__steps" style="--cp-map-columns: 4">
    <div class="cp-note-map__step"><span class="cp-note-map__index">FLOW</span><strong>Lazy Stream</strong><small>数据按需到达，背压约束积压</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">INTENT</span><strong>Query · Rules</strong><small>声明结果条件，把执行选择交给系统</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">WORK</span><strong>Messages · Workers</strong><small>跨执行单元处理彼此独立的分片</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">RESULT</span><strong>Shuffle · Reduce</strong><small>重新汇合相同 key，并可靠地产出结果</small></div>
  </div>
</div>

最终需要保留八个判断：

1. **Concurrency 是多个任务交错推进，Parallelism 是同一时刻真正执行多份工作，Distribution 是独立节点通过消息协作**；
2. **I/O-bound 与 CPU-bound 需要不同执行模型**，选择应依据等待位置和数据传输成本；
3. **默认 GIL-enabled CPython、free-threaded build、进程和多解释器的边界不同**，不能用一句“Python 线程不能并行”概括；
4. **共享可变状态会产生 Race Condition**，GIL 不能替代业务临界区；
5. **Lock、Queue、不可变数据和分区所有权都是协调手段**，优先减少共享写入；
6. **MapReduce = Map + Shuffle + Reduce**，框架把业务函数与分布式协调分开；
7. **纯函数更容易被重排、并行和重试**，有副作用的任务需要幂等边界；
8. **并行收益受串行比例、通信开销和数据倾斜限制**，必须通过真实指标验证。

第四章从“怎样保存大量数据”出发，最终得到的并不是某个大数据框架，而是一组可以迁移的设计方法：按需产生数据、声明计算目标、通过协议隔离节点、用明确状态边界保证正确性，再把彼此独立的工作安全地同时展开。

## 参考

- [Composing Programs 4.7：Distributed Data Processing](https://www.composingprograms.com/pages/47-distributed-data-processing.html)
- [Composing Programs 4.8：Parallel Computing](https://www.composingprograms.com/pages/48-parallel-computing.html)
- [Python 文档：`asyncio`](https://docs.python.org/3/library/asyncio.html)
- [Python 文档：`concurrent.futures`](https://docs.python.org/3/library/concurrent.futures.html)
- [Python 文档：Multiprocessing](https://docs.python.org/3/library/multiprocessing.html)
- [Python 文档：Free-threaded Python](https://docs.python.org/3/howto/free-threading-python.html)
- [Python 文档：`asyncio.TaskGroup`](https://docs.python.org/3/library/asyncio-task.html#task-groups)
- [Python 文档：`asyncio` 同步原语](https://docs.python.org/3/library/asyncio-sync.html)
- [Python 文档：`asyncio.Queue`](https://docs.python.org/3/library/asyncio-queue.html)
