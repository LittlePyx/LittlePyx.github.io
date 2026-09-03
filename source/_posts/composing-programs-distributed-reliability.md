---
title: 机器之间如何协作：消息、协议与分布式失败
date: 2026-09-02 12:00:00
top_img: /img/composing-programs-distributed-reliability-nature-cover.jpg
cover: /img/composing-programs-distributed-reliability-nature-cover.jpg
cover_credit: "Chris Johns · National Geographic"
cover_source: "https://www.nationalgeographic.com/photography/article/wildlife-photo-gallery"
description: Composing Programs 第四章笔记之三：从本地调用走向消息传递，理解协议、超时、重试、幂等性与可观测性怎样共同构成分布式可靠性。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Distributed Systems
  - Protocol
  - Idempotency
toc: true
toc_number: false
katex: false
---

前两篇都可以在单个进程中完成：Iterator 让数据按需流动，声明式系统负责选择执行过程。当数据、服务和计算节点分布在不同机器上时，程序需要面对一个新的事实：**机器之间没有共同的函数栈和内存，只能通过网络发送消息。**

本篇受教材 [4.6 Distributed Computing](https://www.composingprograms.com/pages/46-distributed-computing.html) 启发，但不把重点放在网络历史或拓扑分类，而是回答工程中更直接的问题：

<div class="cp-note-map">
  <div class="cp-note-map__head">
    <span class="cp-note-map__eyebrow">本篇主线</span>
    <span class="cp-note-map__hint">可靠性来自一组相互配合的边界</span>
  </div>
  <div class="cp-note-map__steps" style="--cp-map-columns: 4">
    <div class="cp-note-map__step"><span class="cp-note-map__index">01 · 边界</span><strong>调用变成消息</strong><small>双方不再共享内存和调用栈</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">02 · 不确定</span><strong>超时不等于未执行</strong><small>响应丢失会让结果进入未知状态</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">03 · 恢复</span><strong>Retry + Idempotency</strong><small>允许重传，同时吸收重复业务效果</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">04 · 解释</span><strong>状态 + Observability</strong><small>让失败可以恢复、关联和定位</small></div>
  </div>
</div>

## 1. 远程调用不是“慢一点的函数调用”

本地调用：

```python
result = execute_task(task)
```

调用者与函数通常位于同一进程。参数通过内存传递，返回值直接回到当前调用栈；如果函数抛出异常，调用者也能在同一运行时中接住它。

远程调用看起来可能很像：

```python
result = task_client.execute(task)
```

但内部至少经历：

{% mermaid %}
sequenceDiagram
    participant C as Client
    participant N as Network
    participant S as Server
    C->>C: 参数序列化为 bytes
    C->>N: 发送请求消息
    N->>S: 传递 bytes
    S->>S: 反序列化并执行
    S-->>N: 序列化结果
    N-->>C: 返回响应消息
    C->>C: 反序列化为本地结果
{% endmermaid %}

其中任意阶段都可能失败。客户端进程、服务端进程和网络彼此独立，因此远程调用多出三类本地调用没有的变量：

| 变量 | 具体表现 |
|---|---|
| 时间 | 网络延迟没有固定上限，响应可能很慢 |
| 独立失败 | 客户端、服务端、网络可以分别失败 |
| 不确定性 | 客户端没收到响应，不代表服务端没执行 |

这就是分布式系统最重要的思维转变：**调用者只能观察消息，不能直接观察另一台机器的内部状态。**

## 2. 消息传递依赖共同协议

网络传输的不是 Python object，而是 bytes。发送方必须编码，接收方必须按照相同规则解释。

```json
{
  "schema_version": 2,
  "request_id": "req-8d2f",
  "operation": "execute_task",
  "task_id": "t-17",
  "arguments": {
    "query": "..."
  }
}
```

**Protocol（协议）** 规定的不只是 JSON 长什么样，还包括：

- 哪些消息类型存在；
- 每个字段的含义和类型；
- 哪些字段必填、哪些可以省略；
- 成功和失败怎样表示；
- 版本不一致时怎样兼容；
- 消息能否重试以及怎样去重。

### 2.1 序列化只是语法，协议还包含语义

两个系统都能解析同一段 JSON，并不表示它们理解一致。例如：

```text
timeout = 30
```

必须继续说明：

```text
单位是秒还是毫秒？
从客户端发送时还是服务端接收时开始计时？
超时后底层任务是否会被取消？
字段缺失时使用默认值还是拒绝请求？
```

可互操作性来自共同语义，而不是共同括号格式。

### 2.2 协议需要考虑演进

生产系统中的发送方和接收方很少能在同一瞬间全部升级。更稳妥的演进方式通常包括：

- 新增可选字段，并为旧消息提供默认语义；
- 保留旧版本读取能力，再逐步迁移写入方；
- 不重新解释已经发布字段的含义；
- 对无法兼容的变更显式提升 major version；
- 通过契约测试验证不同版本组合。

协议是跨进程的抽象屏障。屏障稳定，内部实现才可以独立演化。

## 3. Client/Server 划分了服务与使用者的角色

在 Client/Server 架构中：

```text
Client  发起请求并消费结果
Server  接收请求并提供服务
```

这种分工让多个客户端复用同一服务，也让服务端可以独立扩容。但它同时引入了状态所有权问题：

| 状态 | 更合理的所有者 |
|---|---|
| 页面是否正在显示 loading | Client |
| 任务是否已经完成 | Task Service 或其数据库 |
| 本次请求还剩多少等待时间 | Client |
| 结果是否已经持久化 | Server-side storage |

客户端内存中的 `is_done = True` 不能替代服务端的持久状态；服务端完成任务，也不保证客户端一定收到了响应。先明确状态属于谁，才能讨论失败后怎样恢复。

Peer-to-Peer（点对点）系统会让节点同时承担请求者和服务提供者，但“通过消息通信、节点独立失败”的基本问题并没有消失。

## 4. Partial Failure 让结果进入“未知”状态

本地函数调用通常可以观察到三种结果：

```text
返回成功
抛出异常
进程整体崩溃
```

远程调用则可能出现 **Partial Failure（局部失败）**：系统的一部分仍在运行，另一部分不可达。最关键的例子是响应丢失。

{% mermaid %}
sequenceDiagram
    participant C as Client
    participant N as Network
    participant S as Server
    C->>N: execute(t-17)
    N->>S: 请求到达
    S->>S: 操作成功并提交
    S-->>N: success
    N--xC: 响应丢失
    Note over C: 等待超时，只知道“没有收到结果”
{% endmermaid %}

客户端超时时，至少存在三种可能：

1. 请求根本没有到达服务端；
2. 请求到达，但执行过程中失败；
3. 操作已经成功，只是响应没有返回。

所以：

> Timeout（超时）描述的是等待结果的期限已经结束，不是远程操作“确定没有执行”。

这条判断直接决定重试是否安全。

## 5. Timeout、Deadline 与 Cancellation 分别表示什么

### 5.1 Timeout 限制单次等待

调用外部服务不应无限等待。连接建立、读取响应、写入请求往往还需要分别设置超时。

### 5.2 Deadline 限制整条调用链

一次用户请求可能依次经过多个服务：

```text
Gateway → Orchestrator → Task Service → Storage
```

如果每层都独立等待 30 秒，最外层可能早已放弃，内部服务仍在继续工作。更合理的做法是传播一个绝对 deadline 或剩余预算：

```text
最外层总预算：5 s
经过解析后剩余：4.6 s
调用 Task Service 最多使用：4.0 s
留出结果整理和返回：0.6 s
```

### 5.3 Cancellation 是请求停止，不是已经停止

客户端取消等待，只能表示“不再需要结果”。远端能否及时停止取决于：

- 取消信号是否能够传递；
- 服务端是否定期检查信号；
- 当前外部 I/O 是否支持取消；
- 已经提交的事务或副作用能否撤销。

因此不能把 `future.cancel()`、HTTP 断开或协程取消简单解释成“业务操作必然没有发生”。

## 6. Retry 只适合可能恢复且允许重复的操作

网络抖动、临时过载和节点重启有时可以通过重试恢复。但“失败就重试”会制造新的问题。

### 6.1 先区分错误是否值得重试

| 错误 | 是否通常适合重试 | 原因 |
|---|---|---|
| 临时网络断开 | 是 | 下一次连接可能恢复 |
| 服务端暂时过载 | 是，但应退避 | 立即重试会继续增加压力 |
| 参数校验失败 | 否 | 相同输入不会自行变合法 |
| 权限不足 | 通常否 | 重试不会获得新权限 |
| 操作结果未知 | 取决于幂等设计 | 可能已经成功 |

### 6.2 Exponential Backoff 与 Jitter

大量客户端在同一时刻失败，如果都立即按固定间隔重试，会形成同步请求峰值。常见做法是指数退避，并加入随机抖动：

```text
第 1 次等待：约 100 ms
第 2 次等待：约 200 ms
第 3 次等待：约 400 ms
……同时加入随机偏移
```

重试还需要上限：最大次数、总 deadline 和可接受的最大间隔。否则恢复机制本身会变成无界负载。

```python
from random import uniform
from time import monotonic, sleep


def call_with_retry(send, *, deadline: float):
    delay = 0.1
    last_error = None

    for attempt in range(4):
        remaining = deadline - monotonic()
        if remaining <= 0:
            break

        try:
            return send(timeout=min(remaining, 1.5))
        except TransientNetworkError as error:
            last_error = error

        if attempt < 3:
            sleep(min(uniform(0, delay), max(0, deadline - monotonic())))
            delay *= 2

    raise RequestDeadlineExceeded from last_error
```

这只是控制等待的骨架。它尚未回答最关键的问题：`send()` 被执行多次是否安全？

### 6.3 整条调用链只应有一个重试负责人

假设入口服务重试 3 次，中间服务也重试 3 次，数据库客户端仍重试 3 次。一次用户请求在最坏情况下可能把下游调用放大为 `3 × 3 × 3 = 27` 次。系统原本只是轻微过载，层层重试却可能把它推向完全不可用。

因此需要沿调用链明确：**哪一层最了解操作语义，并负责最终重试决策。** 其他层要么关闭自动重试，要么只做非常有限的连接恢复。指标中还应区分原始请求数和总 attempt 数，否则只看成功率，可能看不出系统正在依靠大量重试勉强维持。

如果失败来自持续过载，而不是短暂抖动，重试本身没有修复能力。此时更合适的是尽早限流、缩短队列、返回明确的过载信号，并让客户端按 `Retry-After` 或服务约定退避。

## 7. Idempotency 让重复请求不重复产生业务效果

**Idempotency（幂等性）** 指同一个操作执行一次或多次，最终业务效果相同。

```text
读取 task 状态多次       通常幂等
把状态设置为 cancelled  可以设计成幂等
余额增加 100             默认不幂等
创建一条新任务           默认不幂等
```

“HTTP 方法看起来是 POST”或“函数名字叫 create”都不能自动判断幂等性。关键是重复执行对持久状态产生什么效果。

### 7.1 Idempotency Key 把多次传输识别为一次业务意图

客户端为一次逻辑操作生成稳定键：

```text
Idempotency-Key: task-create-7f31...
```

第一次请求：

```text
不存在该 key
    → 原子地记录处理中
    → 执行业务操作
    → 保存完成状态和响应
```

重试请求：

```text
key 已完成
    → 不重复执行
    → 返回此前保存的结果
```

{% mermaid %}
flowchart LR
    REQUEST["请求<br/>idempotency_key"] --> LOOKUP{"去重记录存在？"}
    LOOKUP -->|已完成| REPLAY["返回已保存结果"]
    LOOKUP -->|处理中| WAIT["返回处理中<br/>或等待结果"]
    LOOKUP -->|不存在| CLAIM["原子占有 key"]
    CLAIM --> EFFECT["执行业务副作用"]
    EFFECT --> SAVE["保存结果"]
    SAVE --> RESPONSE["返回响应"]
    class REQUEST cp-stage-source
    class CLAIM,EFFECT,SAVE cp-stage-process
    class WAIT cp-stage-warning
    class REPLAY,RESPONSE cp-stage-output
{% endmermaid %}

### 7.2 去重记录必须和业务状态共同设计

下面的顺序仍有漏洞：

```text
1. 完成业务写入
2. 进程崩溃
3. 尚未保存“该 key 已完成”
```

重试时系统可能再次执行。因此，去重占位、业务写入和结果记录通常需要事务、唯一约束或能够恢复的状态机配合。

幂等键还需要定义：

- 作用域：按用户、租户还是全局唯一；
- 有效期：多久以后可以清理；
- 参数一致性：相同 key 携带不同参数时应拒绝；
- 进行中状态：并发重复请求怎样等待或返回；
- 结果大小：是否保存完整响应或只保存资源 ID。

## 8. Delivery Guarantee 描述消息，业务效果还要另行保证

常见的消息投递语义包括：

| 语义 | 可能丢失 | 可能重复 | 常见实现思路 |
|---|---:|---:|---|
| At-most-once（至多一次） | 是 | 否 | 发送一次，不确认重试 |
| At-least-once（至少一次） | 否或尽量避免 | 是 | 未确认就重试 |
| Exactly-once effect（恰好一次效果） | 目标是不丢 | 目标是不重复产生效果 | 重试 + 去重 + 事务/原子状态 |

网络层很难凭空保证端到端业务副作用恰好发生一次。工程上通常接受消息可能重复，再通过幂等处理把重复传输收敛成一次业务效果。

消息顺序也不能随意假设。两个请求从客户端按 A、B 发出，服务端可能先观察到 B；如果业务依赖顺序，需要序列号、版本号、单一分区或显式状态机。

### 8.1 Transactional Outbox 处理“写库成功，但消息没发出”

事件驱动服务经常同时做两件事：更新自己的数据库，并向消息系统发布事件。这是两次独立写入，任何一种顺序都有失败窗口：

```text
先写数据库：提交成功 → 进程崩溃 → 事件没有发出
先发事件：消息成功 → 数据库回滚 → 下游看到了并不存在的状态
```

Transactional Outbox（事务发件箱）的做法是：**在同一个数据库事务里更新业务表，并向 outbox 表写入待发布事件。** 独立发布器只读取已经提交的 outbox 记录，再把事件发送到消息系统。

```text
业务事务：更新 tasks + 插入 outbox
                     ↓
发布器：读取 outbox → 发布消息 → 标记已发送
                     ↓
消费者：按 event_id 去重后更新自己的状态
```

发布器仍可能在“消息已发送、标记尚未保存”之间崩溃，所以消息仍可能重复；outbox 解决的是业务状态与“应该发送这条消息”的原子一致性，消费者幂等负责重复投递。两个机制解决的是不同失败窗口。

## 9. 将共享状态改写为明确的状态所有权

分布式节点不能安全地依赖彼此内存中的普通变量。更清晰的组织方式是让某个组件成为状态的单一所有者，其他组件通过命令和事件与它交互：

```text
Command：请尝试执行某个动作
Event：某件事情已经发生
Query：读取当前已知状态
```

例如任务状态机：

{% mermaid %}
stateDiagram-v2
    [*] --> Pending
    Pending --> Running: worker claimed
    Running --> Succeeded: result committed
    Running --> Failed: terminal error
    Running --> Pending: lease expired，允许重试
    Pending --> Cancelled: cancel accepted
{% endmermaid %}

状态转换需要携带版本或条件，避免旧消息覆盖新状态：

```sql
UPDATE tasks
SET status = 'running', version = version + 1
WHERE id = ? AND status = 'pending' AND version = ?;
```

受影响行数为 0，说明状态已经变化，调用者应重新读取，而不是无条件覆盖。

## 10. 可观测性是分布式正确性的一部分

单进程异常通常带有一条调用栈；跨服务以后，一次逻辑操作可能产生多段日志。至少需要关联标识：

```text
trace_id       一次端到端调用链
request_id     某一次网络请求
task_id        业务任务
attempt        第几次执行尝试
idempotency_key 同一业务意图的重复请求
```

关键指标也应覆盖：

- 请求延迟分位数，而不只是平均值；
- 超时率和重试率；
- 每类错误码的数量；
- 队列长度和最老消息等待时间；
- 重复请求命中率；
- worker 成功率与处理时长。

日志应记录协议阶段和稳定标识，而不是默认输出完整凭据、请求正文或敏感结果。

### 10.1 日志、指标和 Trace 分别回答不同问题

三种信号不应互相替代：日志解释某个具体事件发生了什么，指标说明一类请求是否出现整体异常，Trace 则把一次请求跨服务的路径串起来。一个实用的排障顺序是：先由告警指标发现异常范围，再从慢请求或错误 Trace 定位服务边界，最后用同一个 `trace_id`、`request_id` 或业务 ID 查询细节日志。

<div class="cp-engineering-panel">
  <strong>为一次远程操作建立可关联证据</strong>
  <div class="cp-engineering-panel__grid">
    <div class="cp-engineering-panel__item"><b>Metrics</b><span>错误率、P95/P99、重试放大倍数与队列年龄</span></div>
    <div class="cp-engineering-panel__item"><b>Trace</b><span>请求在哪个服务、数据库或外部依赖上消耗时间</span></div>
    <div class="cp-engineering-panel__item"><b>Logs</b><span>记录稳定 ID、协议阶段与结果摘要，并对敏感字段脱敏</span></div>
  </div>
</div>

## 11. 把可靠调用组织成一条完整路径

<div class="cp-note-map">
  <div class="cp-note-map__head">
    <span class="cp-note-map__eyebrow">可靠调用</span>
    <span class="cp-note-map__hint">先定义语义，再处理传输，最后约束业务效果</span>
  </div>
  <div class="cp-note-map__steps" style="--cp-map-columns: 3">
    <div class="cp-note-map__step"><span class="cp-note-map__index">CONTRACT</span><strong>Schema · Version · Deadline</strong><small>双方先对字段语义和时间预算达成一致</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">DELIVERY</span><strong>Timeout · Retry · Backoff</strong><small>处理传输失败，同时限制恢复机制的负载</small></div>
    <div class="cp-note-map__step"><span class="cp-note-map__index">EFFECT</span><strong>Idempotency · Transaction · Trace</strong><small>让重复收敛，并留下可恢复、可解释的证据</small></div>
  </div>
</div>

最终需要保留七个判断：

1. **远程调用通过消息完成，不共享本地调用栈和内存**；
2. **序列化规定数据怎样编码，协议还必须规定字段的业务语义与版本兼容**；
3. **超时只表示没有按时收到结果，不能证明远端没有执行**；
4. **取消是停止请求，不是停止已经完成的保证**；
5. **重试只适合暂时性错误，并且需要 deadline、退避、抖动和次数上限**；
6. **At-least-once 投递会产生重复，幂等键、唯一约束和事务负责把重复收敛成一次业务效果**；
7. **分布式系统必须显式设计状态所有权和关联标识**，否则失败难以恢复，也难以解释。

机器能够可靠协作之后，下一篇会继续讨论怎样把工作拆开同时执行：什么时候选择异步、线程、进程或多解释器，怎样避免共享状态竞态，以及 MapReduce 为什么能够把大规模数据处理分成可重试的并行阶段。

## 参考

- [Composing Programs 4.6：Distributed Computing](https://www.composingprograms.com/pages/46-distributed-computing.html)
- [AWS Builders' Library：Timeouts, Retries, and Backoff with Jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [IETF HTTP Semantics：Idempotent Methods](https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods)
- [OpenTelemetry：Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
- [AWS Well-Architected：Control and limit retry calls](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html)
- [AWS Prescriptive Guidance：Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
