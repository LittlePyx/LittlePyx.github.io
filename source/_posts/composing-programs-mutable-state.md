---
title: 可变状态：对象身份与消息传递从何而来
date: 2026-08-24 11:00:00
top_img: /img/composing-programs-mutable-state-nature-cover.jpg
cover: /img/composing-programs-mutable-state-nature-cover.jpg
cover_credit: "Beverly Joubert · National Geographic"
cover_source: "https://www.nationalgeographic.com/photography/article/wildlife-photo-gallery"
description: Composing Programs 第二章笔记之二：区分绑定、变异与 nonlocal 赋值，并从闭包的局部状态推导对象身份、消息传递和 dispatch dictionary。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Mutable State
  - Object-Oriented Programming
toc: true
toc_number: false
katex: true
---

数据抽象隐藏一个值怎样表示；可变数据进一步提出了时间问题：如果这个值会变化，怎样确认变化的是哪一个对象，谁能观察到变化，又由谁管理它的历史？

这正是对象思想出现的位置。对象不只是把若干字段放在一起，而是让一个具有身份的实体保存自己的状态，并通过一组操作管理状态。

本篇对应教材：

- [2.4 Mutable Data](https://www.composingprograms.com/pages/24-mutable-data.html)

其中列表、字典的基础 API 从略，约束传播只在结尾说明设计意义。

## 1. 状态是一个随历史演化的值

不可变抽象通常可以由组成部分完全刻画：有理数由分子、分母的比例决定，一棵不可变树由标签和所有分支决定。只要组成部分相同，就可以在推理时把它们视为相同的值。

可变对象则代表一个随时间演化的实体：

{% mermaid %}
flowchart TB
    T0["同一个对象<br/>t0 · balance = 100"] -->|withdraw 30| T1["同一个对象<br/>t1 · balance = 70"]
    T1 -->|deposit 20| T2["同一个对象<br/>t2 · balance = 90"]
{% endmermaid %}

操作的结果可能依赖此前发生过什么。两次参数完全相同的取款，可能因为余额已经改变而产生不同结果。**State（状态）** 不是某次孤立的值，而是一个对象在当前执行时刻所保存的信息。

这带来面向对象的第一块基础：

```text
对象 = 能跨越多个操作保持身份、同时让内部状态演化的实体
```

行为会在后面加入；这里先把“变化发生在哪里”说清楚。

## 2. Binding、Rebinding 与 Mutation

Python 中容易被统称为“赋值”的操作，实际上可能改变完全不同的东西。

### 2.1 Name binding：让名字指向对象

```python
x = [1, 2]
y = x
```

第二条语句没有复制列表，也没有修改列表，只是在当前环境中建立了另一个绑定：

{% mermaid %}
flowchart LR
    subgraph BINDING["1 · Binding：共享对象"]
      X1["x"] --> L1["list A<br/>[1, 2]"]
      Y1["y"] --> L1
    end
    subgraph REBINDING["2 · Rebinding：x 改指新对象"]
      X2["x"] --> L2["list B<br/>[1, 2, 3]"]
      Y2["y"] --> L3["list A<br/>[1, 2]"]
    end
    subgraph MUTATION["3 · Mutation：改变已有对象"]
      X3["x"] --> L4["list B<br/>[1, 2, 3]"]
      Y3["y"] --> L5["list A<br/>[1, 2, 3]"]
    end
{% endmermaid %}

<p class="cp-figure-caption">Rebinding 改变箭头；mutation 改变箭头所指的对象。</p>

变量不是装对象的盒子，更接近环境中指向对象的名字。执行 `y = x` 时，先求出表达式 `x` 所引用的对象，再把名字 `y` 绑定到同一对象。

### 2.2 Rebinding：让名字改指另一个对象

```python
x = x + [3]
```

列表加法创建一个新列表，然后把 `x` 重新绑定到它：

旧列表没有变化，所以 `y` 仍看到 `[1, 2]`。变化发生在环境的名字—对象关系中，而不在原列表内部。

### 2.3 Mutation：改变对象本身

```python
y.append(3)
```

`append` 改变 `y` 指向的列表对象，没有让 `y` 改指新对象：

在本例中两个列表碰巧内容相同，但仍是两个不同对象。判断 mutation 的关键问题是：执行前后被操作对象的身份是否保持不变，而其可观察内容是否发生变化。

### 2.4 Nonlocal rebinding：改变外层环境中的绑定

```python
def outer():
    x = [1, 2]

    def replace():
        nonlocal x
        x = [1, 2, 3]

    return replace
```

`nonlocal x` 声明后，`x = ...` 不会在 `replace` 的局部 frame 中创建 `x`，而会重新绑定 `outer` frame 中已有的名字。它仍然是 **rebinding**，不是对旧列表的 mutation。

四种情况可以放在一起比较：

| 表达式 | 改变环境绑定 | 改变已有对象 | 其他别名能否看到对象内容变化 |
|---|---:|---:|---:|
| `x = y` | 是 | 否 | 不适用，只是增加或替换引用 |
| `x = x + [v]` | 是 | 否 | 否 |
| `x.append(v)` | 否 | 是 | 能 |
| `nonlocal x; x = value` | 是，外层 frame | 否 | 指向旧对象的别名不受影响 |

`+=` 需要单独判断：对列表通常执行原地扩展，对整数则产生新整数并重新绑定。不要仅凭运算符外观判断 mutation，应看该类型具体实现了什么行为。

## 3. Aliasing 让局部操作产生非局部影响

**Aliasing（别名共享）** 指多个名字或容器位置引用同一个对象。

```python
suits = ['heart', 'diamond']
alias = suits
alias.append('spade')

suits  # ['heart', 'diamond', 'spade']
```

`append` 语句中没有出现 `suits`，但通过共享对象，`suits` 的可观察值仍然发生了变化。这是 mutation 增加推理成本的主要原因：影响范围不再只由语句中出现的名字决定，还由运行时引用图决定。

这里的“复制”需要按层理解。**浅复制会创建新的外层容器，但容器中的元素仍然是对原对象的引用**，不会继续复制内部对象。

```python
a = [[1, 2]]
b = a.copy()

b is a        # False：a、b 是两个不同的外层列表
b[0] is a[0]  # True：它们仍然引用同一个内层列表

b.append([3, 4])  # 只改变 b 的外层结构
b[0].append(99)   # 修改两者共享的内层列表

a  # [[1, 2, 99]]
b  # [[1, 2, 99], [3, 4]]
```

因此，浅复制只让最外层彼此独立：对 `b` 执行 `append`、`pop` 或替换 `b[i]`，不会改变 `a`；但通过 `b[i]` 修改共享的可变对象时，变化也能从 `a` 中看到。只有需要把嵌套对象也递归复制时，才考虑 `copy.deepcopy`。

### 3.1 默认参数也可能形成隐蔽别名

函数默认参数在 `def` 执行时求值一次，而不是每次调用时重新创建：

```python
def collect(item, bucket=[]):
    bucket.append(item)
    return bucket

collect('a')  # ['a']
collect('b')  # ['a', 'b']
```

两次调用省略 `bucket` 时，参数都绑定到同一个默认列表。问题不是“默认参数不能是列表”，而是这份可变对象的生命周期与函数对象相同，多个调用意外共享了它。

通常应把“没有传入容器”和“传入一个已有容器”分开：

```python
def collect(item, bucket=None):
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket
```

类字段也有类似问题。`dataclasses.field(default_factory=list)` 的意义，就是让每个实例通过工厂获得独立列表，而不是共享类定义阶段创建的同一个对象。

## 4. Equality 与 Identity 回答不同问题

```python
a = [1, 2]
b = [1, 2]
c = a

a == b  # True
a is b  # False
a is c  # True
```

- `==` 检查 **equality（相等性）**：两个值在类型规定的比较规则下是否相等；
- `is` 检查 **identity（同一性）**：两个表达式是否得到同一个对象。

Identity 是比当前内容相等更强的关系。如果 `a is c`，通过任意一个引用修改对象，另一个引用都会观察到同一次变化；`a == b` 只说明当前比较结果相等，不说明它们共享未来历史。

```text
相等：现在看起来是否表示相同内容？
同一：是否就是引用图中的同一个节点？
```

所有 Python 对象都有身份，但对不可变值，身份通常不构成有用的业务语义：既然对象不能被修改，两个相等整数是否为同一实例通常不可观察，也不应该依赖解释器的缓存细节。因此，除 `None` 等单例哨兵外，不应使用 `is` 比较数值或字符串内容。

Mutation 没有创造身份，而是让身份变得难以忽略。两个余额同为 100 的账户可能是两个账户；一个账户取款后余额改变，仍是原来的账户。

## 5. Closure 如何保存 Local State

函数也可以拥有随调用演化的局部状态。教材用账户取款说明这一点：

```python
def make_withdraw(balance):
    def withdraw(amount):
        nonlocal balance
        if amount > balance:
            return 'Insufficient funds'
        balance -= amount
        return balance

    return withdraw
```

```python
withdraw = make_withdraw(100)
withdraw(25)  # 75
withdraw(25)  # 50
```

两次 `withdraw(25)` 的参数相同，结果却不同，因为第二次调用读取的是第一次调用修改后的 `balance`。

### 5.1 运行时发生了什么

调用 `make_withdraw(100)` 时：

1. 创建外层环境 `E1`，其中 `balance = 100`；
2. 创建 `withdraw` 函数，并让它记住自己的定义环境 `E1`；
3. `make_withdraw` 返回后，`E1` 仍被 `withdraw` 引用，因此不会消失；
4. 每次调用 `withdraw` 都会创建一个临时调用 frame，其 parent 都是同一个 `E1`；
5. `nonlocal balance` 修改的是 `E1` 中的 `balance`，所以状态能够延续到下一次调用。

{% mermaid %}
sequenceDiagram
    participant C as 调用者
    participant W as withdraw 函数
    participant E as 定义环境 E1
    Note over W,E: 创建闭包：W 保存对 E1 的引用，balance = 100
    C->>W: withdraw(25)
    W->>E: 读取并重绑定 balance
    E-->>W: 100 → 75
    W-->>C: 75
    Note over W,E: 临时调用 Frame 消失，E1 继续存在
    C->>W: withdraw(25)
    W->>E: 再次读取同一个绑定
    E-->>W: 75 → 50
    W-->>C: 50
{% endmermaid %}

两次调用不是同时共享一个调用 frame，而是先后创建 `W1`、`W2`，并共同访问闭包保留下来的 `E1`。闭包保存的也不是 `balance` 的数值快照，而是它所在的定义环境，因此第二次调用能够读到第一次调用留下的 `75`。

### 5.2 为什么不同闭包拥有独立状态

```python
alice = make_withdraw(100)
bob = make_withdraw(100)

alice(30)  # 70
bob(30)    # 70
alice(10)  # 60
bob(10)    # 60
```

两次调用 `make_withdraw` 创建两个不同的外层 frame，也创建两个不同的 `balance` 绑定。`alice` 和 `bob` 共享函数代码的结构，却不共享状态所在的环境。

```text
alice ──> withdraw code + environment A(balance=60)
bob   ──> withdraw code + environment B(balance=60)
```

即使当前余额相同，它们仍拥有不同身份和独立历史。这已经非常接近类的多个实例：共享行为定义，每个实例保存自己的状态。

## 6. `nonlocal` 修改绑定，容器 mutation 修改对象

闭包状态并不总需要 `nonlocal`：

```python
def make_log():
    records = []

    def write(message):
        records.append(message)
        return len(records)

    return write
```

`write` 只读取外层名字 `records`，再修改它所指向的列表；没有对 `records` 重新赋值，所以不需要 `nonlocal`。

对比另一种实现：

```python
def make_log():
    records = ()

    def write(message):
        nonlocal records
        records = records + (message,)
        return len(records)

    return write
```

这里元组不可变，只能构造新元组并让外层名字改指它，因此必须声明 `nonlocal records`。

两者都能保存历史，但状态转移机制不同：

```text
列表版本：外层绑定不变，所指对象发生 mutation
元组版本：旧对象不变，外层绑定发生 rebinding
```

如果在函数体中对名字赋值却没有 `nonlocal`，Python 会在函数执行前把它判定为局部名字；赋值前读取它可能触发 `UnboundLocalError`。`nonlocal` 的作用不是让内层函数“看见”外层名字——读取本来就可以——而是明确赋值应该落在哪个外层 frame。

## 7. Side Effect 改变了程序的推理方式

**Side effect（副作用）** 是求值在返回结果之外对程序状态造成的可观察改变，例如修改列表、重新绑定闭包状态、写文件或发送网络请求。

纯函数的调用可以近似按代数表达式推理：相同输入产生相同输出，调用表达式可以用其值替换，而不改变程序其他部分的行为。这种性质称为 **referential transparency（引用透明性）**。

有状态函数不满足这一点：

```python
withdraw(25) + withdraw(25)
```

不能把两次 `withdraw(25)` 当作同一个值，因为第一次调用会改变第二次调用的环境。调用顺序、调用次数以及共享状态的别名都会进入结果。

Mutation 的收益同样明确：

- 可以自然模拟账户、用户会话、游戏角色等随历史演化的实体；
- 多个操作可以围绕同一份状态协作；
- 更新大型结构时不必每次完整复制；
- 缓存等机制可以用额外空间减少重复计算。

代价是：

- 结果不再只由显式参数决定；
- 别名使影响范围扩大；
- 操作顺序变成语义的一部分；
- 测试必须准备和清理状态；
- 并发访问共享状态时需要额外协调。

可变状态不是应该彻底避免的错误，而是一种需要明确所有权和边界的能力。

## 8. 延伸：状态的生命周期与并发边界

看到一个可变对象时，除了分析“谁能修改”，还应分析它能活多久：

| 状态位置 | 典型生命周期 | 常见风险 |
|---|---|---|
| 函数局部变量 | 一次调用 | 通常容易推理 |
| 闭包环境 | 与返回函数的可达时间一致 | 测试之间复用闭包导致状态残留 |
| 实例属性 | 与实例一致 | 多个调用者共享同一实例 |
| 类属性 | 与类对象一致 | 被所有实例意外共享 |
| 模块全局变量 | 通常与进程一致 | 隐式依赖、并发竞争、测试污染 |

状态位置本身不是好坏判断；关键是生命周期是否符合业务语义，所有权是否清楚。

### 8.1 `await` 两侧的状态可能已经变化

Python 使用异步程序处理网络请求、数据库访问等需要等待的操作。`async def` 定义异步函数；其中的 `await` 表示：**暂停当前任务，等待异步操作完成，同时把执行机会交给其他任务。**

```python
async def load_data():
    print('开始请求')
    data = await fetch_data()  # 当前任务可能在这里暂停
    print('收到结果')           # 等待完成后从这里继续
    return data
```

暂停的是当前任务，而不是整个程序。当前任务等待时，事件循环可以运行其他任务；等 `fetch_data()` 完成后，再回来继续执行。因此，可以把 `await` 看作一个**可能发生任务切换的边界**。

如果在 `await` 之前读取共享状态，恢复后再根据旧值写回，就可能覆盖等待期间发生的更新：

```python
async def withdraw(account, amount):
    old_balance = account.balance
    await check_risk(amount)  # 等待期间，其他任务可以操作同一账户
    account.balance = old_balance - amount
```

假设余额最初为 `100`，两个取款任务交错执行：

{% mermaid %}
sequenceDiagram
    participant A as 任务 A：取 30
    participant S as 共享账户
    participant B as 任务 B：取 50
    A->>S: 读取 balance = 100
    A-->>A: await，任务暂停
    B->>S: 读取 balance = 100
    A->>S: 写入 100 - 30 = 70
    B->>S: 写入 100 - 50 = 50
    Note over A,B: 正确结果应为 20；B 用旧值覆盖了 A 的更新
{% endmermaid %}

两次取款合计为 `80`，正确余额应该是 `20`，结果却是 `50`。任务 B 使用了暂停前读取的旧余额，覆盖了任务 A 的结果，这叫作 **lost update（丢失更新）**。

`await` 本身不会修改账户；风险来自等待期间其他任务可能修改同一个对象。因此，每次越过 `await` 后，都应重新判断此前读取的共享状态是否仍然有效。解决思路不是“禁止使用 `await`”，而是让共享状态的更新能够按顺序完成。

**方式一：使用 `asyncio.Lock` 保护进程内状态。** 锁让同一时刻只有一个异步任务进入临界区，其他任务需要等待：

```python
account_lock = asyncio.Lock()

async def withdraw(account, amount):
    await check_risk(amount)  # 不访问余额的等待尽量放在锁外

    async with account_lock:
        if account.balance < amount:
            raise ValueError('Insufficient funds')
        account.balance -= amount
        return account.balance
```

这里的“检查余额—扣除余额”在锁内连续完成，任务 B 只能在任务 A 释放锁后读取余额。`asyncio.Lock` 只协调同一事件循环中的异步任务；它不能直接保护多个进程或多台服务器共同访问的数据。

**方式二：让单一所有者顺序处理消息。** 规定只有账户管理任务可以修改余额，其他任务只能发送请求：

{% mermaid %}
flowchart LR
    A["任务 A<br/>withdraw(30)"] --> Q["请求队列"]
    B["任务 B<br/>withdraw(50)"] --> Q
    Q --> OWNER["账户管理任务<br/>唯一状态所有者"]
    OWNER --> STATE["balance<br/>按消息顺序更新"]
{% endmermaid %}

这样不需要多个任务直接争用同一个对象。队列消费者、Actor 和事件循环中的状态机都使用了类似思想。

**方式三：让数据库执行事务或原子更新。** 如果余额存储在数据库中，进程内锁无法协调多个服务实例，更适合让数据库一次完成检查与更新：

```sql
UPDATE accounts
SET balance = balance - 30
WHERE id = 1 AND balance >= 30;
```

这里的更新由数据库作为一个整体处理，不需要 Python 先读取余额再写回。是否成功可以通过受影响的行数判断。对于账户、库存、订单等持久化状态，数据库事务或原子更新通常才是正确的一致性边界。

更根本的设计原则是**减少共享可变状态**：让任务分别计算并返回结果，再由一个明确的所有者统一更新。共享写入点越少，需要推理的执行顺序也越少。

**GIL 为什么不能代替这些机制？** GIL（Global Interpreter Lock，全局解释器锁）是启用 GIL 的 CPython 用来保护解释器内部状态的一把锁。它通常只允许一个线程在某一时刻执行 Python 字节码，但它不理解“取款”这样的业务操作：

{% mermaid %}
flowchart TB
    READ["读取余额"] --> WAIT["await<br/>允许其他任务运行"]
    WAIT --> CHECK["检查条件"]
    CHECK --> WRITE["写回余额"]
    SWITCH["其他任务"] -.可在这里修改同一状态.-> WAIT
{% endmermaid %}

这仍然是多个步骤。异步任务可以在 `await` 处切换，线程也可能在步骤之间切换，所以 GIL 不会把整段逻辑自动变成 **atomic operation（原子操作）**。原子操作对其他执行者表现为一个不可分割的整体，只能看到操作前或操作后的状态，不能插入其中。

因此需要区分两层安全性：GIL 主要保护解释器内部结构；`asyncio.Lock`、消息顺序、数据库事务等机制保护应用自己的状态不变量。即使使用可以关闭 GIL 的 free-threaded CPython，这些业务层同步仍然需要单独设计。

### 8.2 `ContextVar` 保存任务上下文，不负责共享业务状态

服务器可能在同一个线程中交替处理多个异步请求。每个请求都有自己的请求 ID：任务 A 应该始终读到 `A-001`，任务 B 应该始终读到 `B-002`，两者不能串号。

`ContextVar` 用来保存这种**跟随当前执行上下文传播，但在不同任务之间相互隔离**的信息：

```python
from contextvars import ContextVar

request_id = ContextVar('request_id')

async def handle_request(req):
    token = request_id.set(req.id)
    try:
        await process_request()
        print(request_id.get())  # 仍然取得当前请求自己的 ID
    finally:
        request_id.reset(token)
```

即使 `handle_request` 在 `await` 处暂停，恢复时也会使用这个任务对应的上下文。常见用途包括请求 ID、链路追踪 ID、当前用户以及日志上下文。`threading.local()` 按线程隔离数据，`ContextVar` 按当前执行上下文隔离数据；多个异步任务可能共用一个线程，因此异步代码通常使用 `ContextVar` 传递这类上下文。

账户余额的需求正好相反。任务 A 取款后，任务 B 必须看到更新后的同一份余额：

{% mermaid %}
flowchart TB
    subgraph LOCAL["Context-local：需要相互隔离"]
      A1["任务 A"] --> IDA["request_id = A-001"]
      B1["任务 B"] --> IDB["request_id = B-002"]
    end
    subgraph SHARED["业务状态：需要共同观察一致更新"]
      A2["任务 A"] --> BALANCE["同一个 account.balance"]
      B2["任务 B"] --> BALANCE
      BALANCE --> GUARD["Lock / 单一所有者 / 数据库事务"]
    end
{% endmermaid %}

如果用 `ContextVar` 给每个任务保存一份余额，任务之间会看到各自的值，反而无法维护统一的账户状态。余额、订单状态、库存和共享缓存需要的是锁、消息顺序、数据库事务等协调机制。

| 数据 | 不同任务之间的期望 | 合适机制 |
|---|---|---|
| 请求 ID、当前用户 | 各自隔离，不能串号 | `ContextVar` |
| 线程专属连接或缓存 | 各线程隔离 | `threading.local()` |
| 账户余额、订单状态 | 共同看到一致的最新状态 | 锁、单一所有者或数据库事务 |

可以把区别记成一句话：**`ContextVar` 解决“不要串号”，锁和事务解决“不要改乱”。**

需要注意，`ContextVar` 隔离的是变量在不同上下文中的绑定。如果多个上下文都绑定到同一个可变对象，对该对象的原地修改仍然可能被共同观察到；它不会自动执行深复制。

## 9. Dispatch Function：让数据响应消息

如果一个闭包只有 `withdraw` 一种行为，它可以直接返回这个函数。若同一个状态需要支持存款、取款和查询，可以返回一个 **dispatch function（分派函数）**，由消息决定执行哪种行为：

```python
def make_account(initial_balance):
    balance = initial_balance

    def dispatch(message, amount=None):
        nonlocal balance
        if message == 'deposit':
            balance += amount
            return balance
        if message == 'withdraw':
            if amount > balance:
                return 'Insufficient funds'
            balance -= amount
            return balance
        if message == 'balance':
            return balance
        raise KeyError(message)

    return dispatch
```

```python
account = make_account(100)
account('withdraw', 30)  # 70
account('deposit', 10)   # 80
account('balance')       # 80
```

这里，`account` 从存储形态看是函数，从接口行为看却是一个能够保存余额、响应多种操作的账户对象。

**Message passing（消息传递）** 的纪律是：使用者不直接操作内部状态，而是发送抽象允许的消息，由数据自己决定如何响应。

{% mermaid %}
flowchart TB
    CALLER["调用者"] -->|withdraw, 30| DISPATCH["account dispatch"]
    DISPATCH --> LOOKUP{"识别消息"}
    LOOKUP -->|withdraw| ACTION["执行取款逻辑"]
    ACTION --> STATE["更新闭包中的私有 balance"]
    STATE --> RESULT["返回新余额"]
{% endmermaid %}

这比单纯闭包多了一层统一操作入口，也把数据抽象与状态封装连接了起来。

## 10. Dispatch Dictionary：把消息查找交给映射

大量 `if/elif` 可以换成字典查找。字典的 key 是消息，value 是负责响应消息的函数：

```python
def make_account(initial_balance):
    balance = initial_balance

    def deposit(amount):
        nonlocal balance
        balance += amount
        return balance

    def withdraw(amount):
        nonlocal balance
        if amount > balance:
            return 'Insufficient funds'
        balance -= amount
        return balance

    def get_balance():
        return balance

    return {
        'deposit': deposit,
        'withdraw': withdraw,
        'balance': get_balance,
    }
```

```python
account = make_account(100)
account['withdraw'](30)  # 70
account['balance']()     # 70
```

三个操作函数闭包在同一个 `make_account` frame 上，所以共同管理一份 `balance`。字典只负责消息到行为的映射，闭包环境负责保存状态。

这时，对象系统的基本成分已经出现：

```text
闭包中的局部绑定  ≈ 实例状态
闭包保存的环境    ≈ 实例的私有存储
字典中的操作函数  ≈ 方法
字典 key          ≈ 方法名
查找 key 并调用   ≈ 发送消息
构造外层函数      ≈ 创建实例
```

仍然缺少的是：怎样让许多实例共享同一组方法，怎样按名字查找实例与共享属性，以及怎样复用另一组行为。这些问题会引出 Class、attribute lookup、method binding 和 inheritance。

## 11. 约束传播展示了另一种组织方向

教材最后用 connector 和 constraint 构造约束网络。普通函数通常选择单一方向，例如由摄氏度计算华氏度；约束系统声明两者之间必须满足的关系，再根据当前已知信息沿网络传播。

它在本章中的意义不是某段 connector 代码，而是展示 mutation 与 message passing 能支持一种不同的计算组织方式：

{% mermaid %}
flowchart TB
    subgraph FUNCTION["单向函数"]
      I["输入"] --> F["固定过程"] --> O["输出"]
    end
    subgraph NETWORK["约束网络"]
      C["Connector C"] <--> R1["局部约束"]
      F2["Connector F"] <--> R1
      C <--> R2["另一局部约束"]
      K["Connector K"] <--> R2
    end
{% endmermaid %}

Connector 保存当前值并响应设置、遗忘等消息；constraint 在收到通知后决定能否推导其他值。它们通过接口协作，而不直接越过边界修改彼此内部状态。

## 一句话总结

Mutation 让对象身份和执行历史成为程序语义的一部分；闭包把可变状态限制在局部环境中，dispatch 则让这份状态通过消息响应行为，从而形成对象的雏形。

{% mermaid %}
mindmap
  root((可变状态))
    名字与对象
      Binding
      Rebinding
      Mutation
      Aliasing
    身份与历史
      is
      equality
      side effect
    局部状态
      Closure
      nonlocal
      Dispatch
    并发边界
      await
      Lock
      单一所有者
      数据库事务
      ContextVar
{% endmermaid %}

## 容易混淆

- **Rebinding 与 mutation**：前者改变名字指向，后者改变名字所指对象；别名只能观察到后者对共享对象的影响。
- **Equality 与 identity**：`==` 比较类型定义的值，`is` 判断是否为同一个对象；内容相等不代表共享历史。
- **闭包读取与 `nonlocal`**：读取自由变量不需要声明；只有要重新绑定外层名字时才需要 `nonlocal`。
- **状态与全局变量**：二者都可变化，但闭包状态由特定返回函数持有，每次构造可产生独立环境，影响范围更容易控制。

## 关键判断与解释

### 1. Rebinding 不会通过旧别名传播，mutation 会

从相同的初始状态 `x = y = []` 分别观察两种操作：

```python
x = x + [1]
```

列表加法创建新列表，再把 `x` 重新绑定到新对象。`y` 仍指向原空列表，所以 `x == [1]`，`y == []`。

```python
x.append(1)
```

`append` 修改 `x`、`y` 共同引用的列表，两个名字都会观察到 `[1]`。区别不在赋值符号是否出现，而在变化发生于环境绑定还是共享对象。

### 2. 独立闭包环境形成独立对象身份

每次调用 `make_withdraw(100)` 都会创建新的外层 frame、新的 `balance` 绑定和新的返回函数。两个账户即使余额相同，也分别关联不同环境；对其中一个取款不会改变另一个。

当前状态相等只说明 equality 层面的内容一致，独立的环境与变化历史说明 identity 不同。对象身份不能由某一时刻的字段值完全决定。

### 3. 从可变容器改为不可变值会改变赋值机制

列表版本可以执行 `records.append(item)`：外层名字 `records` 的绑定没有变化，只是列表对象被修改，所以内层函数读取这个名字即可。

元组不可原地修改，追加元素需要执行 `records = records + (item,)`，这会构造新元组并重新绑定外层名字。内层函数要把赋值落到外层 frame，因而需要 `nonlocal records`。

```text
list.append：mutation，不需要重新绑定 records
tuple + item：创建新值并 rebinding，需要 nonlocal
```

### 4. Dispatch dictionary 已具备对象雏形，但没有完整类机制

Dispatch dictionary 已经具有局部状态、可调用行为、消息名和独立构造产生的身份。调用者通过 key 查找操作，而不是直接接触闭包中的状态。

它尚未提供多个实例共享一份方法定义的标准结构，也没有实例—类两级属性查找、自动方法绑定、继承链、特殊方法协议和统一的实例创建过程。类系统不是凭空创造对象，而是在这个雏形上补齐共享、查找和复用机制。

## 参考

- [Composing Programs 2.4：Mutable Data](https://www.composingprograms.com/pages/24-mutable-data.html)
- [Python 文档：asyncio Synchronization Primitives](https://docs.python.org/3/library/asyncio-sync.html)
- [Python 文档：contextvars — Context Variables](https://docs.python.org/3/library/contextvars.html)
- [Python 文档：Thread States and the Global Interpreter Lock](https://docs.python.org/3/c-api/threads.html)
- [Python 文档：Python support for free threading](https://docs.python.org/3/howto/free-threading-python.html)
