---
title: 泛型操作：统一协议、表示选择与效率
date: 2026-08-24 13:00:00
top_img: /img/composing-programs-object-abstraction-efficiency-nature-cover.jpg
cover: /img/composing-programs-object-abstraction-efficiency-nature-cover.jpg
cover_credit: "Bernt Østhus · National Geographic Your Shot"
cover_source: "https://www.nationalgeographic.com/photography/article/wildlife-gallery-yourshot"
description: Composing Programs 第二章笔记之四：从 Python 对象协议到 shared interface、type dispatch 与 coercion，再比较递归对象和集合的多种表示如何改变算法效率。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Generic Operations
  - Data Structures
toc: true
toc_number: false
katex: true
---

类系统解决了单个对象怎样保存状态、查找属性和复用行为，下一步是让不同类型参与同一种操作。如果调用者只依赖共同协议，同一段程序就能处理内部表示完全不同的对象；但抽象接口相同并不意味着表示差异消失，因为表示仍然决定每种操作实际需要多少资源。

本篇对应教材：

- [2.7 Object Abstraction](https://www.composingprograms.com/pages/27-object-abstraction.html)
- [2.8 Efficiency](https://www.composingprograms.com/pages/28-efficiency.html)
- [2.9 Recursive Objects](https://www.composingprograms.com/pages/29-recursive-objects.html)

下面围绕三个问题展开：自定义对象怎样接入 Python 已有语法，多种类型怎样参与同一种操作，以及隐藏表示后为什么仍要关心效率。

## 1. 对象协议：让自定义类型进入 Python 语法

普通方法由业务代码显式调用；**special method（特殊方法）** 则让解释器或内置操作在特定语法场景中询问对象应该怎样表现。

```text
repr(obj)  ──> __repr__
str(obj)   ──> __str__
len(obj)   ──> __len__
obj[i]     ──> __getitem__
obj(...)   ──> __call__
obj + rhs  ──> __add__
```

双下划线名称不是需要孤立背诵的魔法清单，而是一组 **object protocol（对象协议）**：语言规定何时发出某种隐式消息，类型负责实现对应行为。

这使自定义对象可以进入 Python 已有的表达式：

```python
class Link:
    empty = ()

    def __init__(self, first, rest=empty):
        if rest is not Link.empty and not isinstance(rest, Link):
            raise TypeError('rest must be a Link or Link.empty')
        self.first = first
        self.rest = rest

    def __len__(self):
        return 1 + len(self.rest)

    def __getitem__(self, index):
        if index == 0:
            return self.first
        if index < 0 or self.rest is Link.empty:
            raise IndexError(index)
        return self.rest[index - 1]

    def __repr__(self):
        if self.rest is Link.empty:
            return f'Link({self.first!r})'
        return f'Link({self.first!r}, {self.rest!r})'
```

```python
s = Link(3, Link(4, Link(5)))

len(s)  # 3
s[1]    # 4
s       # Link(3, Link(4, Link(5)))
```

`Link` 的内部不是数组，但它满足长度和按位置选择的序列行为，因此能在这些操作上“像序列一样”使用。协议扩展的是语言操作的适用范围，不是强迫所有对象采用相同表示。

### 1.1 `repr` 与 `str` 的目标不同

- `repr(obj)` 偏向无歧义、便于调试的表示；在合理情况下，它可以接近一段能重建等价值的表达式；
- `str(obj)` 偏向面向使用者的可读文本。

两者都是字符串转换，却服务不同接口需求。一个对象可以只实现 `__repr__` 获得基本可检查性，也可以另外实现 `__str__` 提供面向用户的显示。

### 1.2 特殊方法的隐式查找

真实 Python 对许多特殊方法会从类型上进行隐式查找，而不是先在实例字典里查同名属性。这样可以保证 `len(obj)` 等语言操作具有一致语义。因此，`obj.__len__()` 有助于理解协议映射，但不能把所有隐式调用都简化为完全相同的普通点表达式查找。

到这里解决的是“一个自定义类型怎样加入已有操作”。`Link` 还展示了另一点：参与同一协议，并不要求内部采用内置类型的表示。

## 2. 递归对象：协议相同不等于表示相同

前面可以用构造器和选择器表示链表：

```text
非空 Link = first + rest
rest       = 另一个 Link 或 empty
```

改用类后，递归关系没有变化，只是组成部分从选择器访问变成属性访问：

| 抽象角色 | 函数式表示 | 类表示 |
|---|---|---|
| 构造非空节点 | `link(first, rest)` | `Link(first, rest)` |
| 当前元素 | `first(s)` | `s.first` |
| 剩余结构 | `rest(s)` | `s.rest` |
| 空结构 | `empty` | `Link.empty` |

`__len__` 中的 `len(self.rest)` 会再次进入同一协议；递归一直进行到 `Link.empty`，此时内置空元组的长度为 0。自定义对象和内置对象通过共同协议衔接在同一个递归过程中。

Tree 也可以由对象递归表示：

```python
class Tree:
    def __init__(self, label, branches=()):
        if not all(isinstance(branch, Tree) for branch in branches):
            raise TypeError('branches must be Tree instances')
        self.label = label
        self.branches = tuple(branches)

    def is_leaf(self):
        return not self.branches
```

```python
def sum_labels(t):
    return t.label + sum(sum_labels(branch) for branch in t.branches)
```

递归对象并不是一种新递归算法，而是递归数据抽象的对象表示：对象的属性可以引用同类对象，基本情形和递归组合关系仍由抽象定义。

`Link` 和 `Tree` 仍然只涉及单个类型。再向前一步，同一个抽象可能有多种表示，而且这些表示还需要在一个程序中共同工作，这就进入了泛型操作的问题。

## 3. 泛型操作从“多种表示共存”开始

早期数据抽象强调“可以替换底层表示”。大型程序还会遇到另一种情况：不同表示各自适合某些操作，因此需要在同一个程序中共存。

复数有两种自然表示：

```text
Rectangular：real + imag
Polar：      magnitude + angle
```

复数加法在直角坐标下更直接：

$$
(a+bi)+(c+di)=(a+c)+(b+d)i
$$

乘法在极坐标下更直接：模相乘，角度相加。若程序只保留一种表示，另一类操作就要不断进行转换或推导。

两种类可以各自保存最自然的数据，再通过 property 计算另一套属性：

```text
ComplexRI 保存 real、imag
          按需计算 magnitude、angle

ComplexMA 保存 magnitude、angle
          按需计算 real、imag
```

只要二者都提供一致的 `real`、`imag`、`magnitude`、`angle` 行为，高层加法和乘法就能忽略参数当前采用哪一种表示。

这比“把实现 A 全部换成实现 B”更进一步：

{% mermaid %}
flowchart TB
    DATA["数据抽象"] --> REPLACE["多种实现满足同一契约<br/>可以互相替换"]
    OBJECT["对象接口"] --> COEXIST["多种实现同时存在<br/>通过同一操作协作"]
    REPLACE --> GENERIC["Generic operation"]
    COEXIST --> GENERIC
{% endmermaid %}

### 3.1 Generic Function 依赖能力而不是单一类型

**Generic function（泛型函数）** 能够接受多种类型的参数，并根据共同接口或类型关系完成正确操作。

这里的“泛型”不是单指类型注解中的 `Generic[T]`，而是一种运行时操作设计：调用者发出同一种操作请求，不同对象以合适方式参与。

教材比较三种机制：

1. Shared interface：类型自己实现共同接口；
2. Type dispatch：操作根据类型标签选择实现；
3. Coercion：先把参数转换到共同类型，再复用同类型操作。

三者都在回答同一问题：

> 当一次操作面对多种表示或多种类型时，由谁负责找到正确实现？

### 3.2 Shared Interface：把差异放在类型内部

**Shared interface（共享接口）** 要求不同类型提供一组同名、同语义的属性或方法。复数的两种表示都提供坐标与极坐标属性，高层算法只读取接口：

```python
def add_complex(z1, z2):
    return ComplexRI(z1.real + z2.real, z1.imag + z2.imag)

def mul_complex(z1, z2):
    return ComplexMA(
        z1.magnitude * z2.magnitude,
        z1.angle + z2.angle,
    )
```

`z1`、`z2` 可以分别是任一种复数表示。多态来自对象对同一消息作出不同实现，而不是来自调用者检查具体类。

新增第三种复数表示时，只要实现同一接口，通常不必修改 `add_complex` 和 `mul_complex`。这种扩展方式具有 **additive（可加性）**：新表示主要通过新增代码接入，而不是改动中央分支。

它的限制是：不同类型必须确实能够支持一套有意义的共同接口。如果两个类型的语义差异很大，强行让它们伪装成同一对象反而会制造空方法、异常分支或含糊契约。

### 3.3 Type Dispatch：由操作表选择跨类型实现

有理数与复数相加时，仅靠每个类型内部的同类型方法还不够。**Type dispatch（类型分派）** 可以用类型标签对操作实现建立索引：

```python
adders = {
    ('rational', 'rational'): add_rational,
    ('complex', 'complex'): add_complex,
    ('rational', 'complex'): add_rational_complex,
    ('complex', 'rational'): add_complex_rational,
}

def add(x, y):
    implementation = adders[(x.type_tag, y.type_tag)]
    return implementation(x, y)
```

分派表把“选择实现”从类型内部提取到显式映射中。它能够精确处理不对称、不可转换或有特殊优化的类型组合。

代价是组合数量可能增长。若每新增一种类型都要和许多已有类型交互，就需要增加相应的类型对实现。责任集中在操作表附近，扩展成本也集中在这里。

### 3.4 Coercion：先转换，再复用已有操作

如果类型之间存在自然嵌入，可以把一个值视为另一类型的值。比如有理数可以视为虚部为 0 的复数：

```python
def rational_to_complex(r):
    return ComplexRI(r.numer / r.denom, 0)
```

于是 Rational 与 Complex 的加法不必分别实现两种参数顺序；先把 Rational **coerce（强制转换）** 为 Complex，再调用已有的复数加法即可。

{% mermaid %}
flowchart LR
    R["Rational(1/2)"] -->|coercion| C1["Complex(0.5, 0)"]
    C2["Complex(1, 2)"] --> ADD["Complex.add"]
    C1 --> ADD
    ADD --> RESULT["Complex result"]
    WARN["检查精度 · 可逆性 · 路径歧义"] -.约束转换方向.-> C1
{% endmermaid %}

Coercion 利用了类型之间的结构关系，减少跨类型操作的显式实现数量，但转换方向不能随意决定：

- 任意复数通常不能无损转换为有理数；
- 精确有理数转为使用浮点坐标的复数可能损失精度；
- 多条转换路径可能造成歧义；
- 循环转换可能使分派无法终止；
- 自动转换过多会让一次表达式实际采用的语义难以预测。

教材提到早期 Python 曾有 `__coerce__`，后来被移除。现代 Python 的具体运算符会按各自规则协调类型，而不是依赖一个统一的旧式 coercion 协议。

需要注意，数学上能够把一个值嵌入另一类数，不代表原表示的信息也能完整保留。例如精确的 Rational 转成使用浮点坐标的 Complex 后，运算结果可以符合复数语义，却未必还能恢复原来的分子和分母。因此，转换方向还要同时检查精度、可逆性和调用者预期。

### 3.5 三种泛型机制怎样选择

| 机制 | 基本思想 | 优点 | 主要代价 | 新增类型时 |
|---|---|---|---|---|
| Shared interface | 每个类型实现共同消息 | 调用端简单；新表示可独立接入 | 只适合语义确实一致的类型 | 实现完整接口，通常不改调用端 |
| Type dispatch | 根据参数类型组合查表 | 可精确处理任意跨类型组合 | 类型对数量增长；中央表需要维护 | 添加与已有类型相关的操作项 |
| Coercion | 转到共同类型再运算 | 复用已有同类型实现，减少类型对代码 | 可能丢失信息、产生方向和路径歧义 | 添加合理转换边，检查精度与语义 |

这些机制不是互斥的。一个系统可以用 shared interface 处理同类协议，用 type dispatch 处理少数特殊跨类型组合，再对存在自然包含关系的类型使用 coercion。

{% mermaid %}
flowchart TD
    START["一次操作面对多种类型"] --> SAME{"它们是否天然共享同一语义接口？"}
    SAME -->|是| INTERFACE["Shared interface"]
    SAME -->|否| PAIR{"是否只有少数特殊类型组合？"}
    PAIR -->|是| DISPATCH["Type dispatch"]
    PAIR -->|否| NATURAL{"是否存在自然且可接受的转换方向？"}
    NATURAL -->|是| COERCE["Coercion 后复用已有实现"]
    NATURAL -->|否| REDESIGN["重新设计操作或显式拒绝组合"]
{% endmermaid %}

设计时应先确定语义关系，再选择分派机制，而不是为了少写代码强行转换类型。

这一组机制先回答“正确实现由谁选择”。现代 Python 并不总把它们写成教材中的类或分派表，但背后的责任划分仍然相同。

## 4. 泛型机制在 Python 中的常见落点

教材的三种机制在现代 Python 中有几种常见对应方式。它们解决不同层次的问题，不应只按语法喜好选择。

### 4.1 同一接口的三种约束方式：Duck typing、`Protocol` 与 ABC

先把“不同对象具有同一种能力”说具体。下面的函数不关心参数来自哪个类，只要求它能够执行 `sender.send(message)`：

```python
def notify(sender, message):
    sender.send(message)
```

邮件发送器和控制台发送器的内部实现完全不同，但只要都提供 `send(message)`，就能交给同一个 `notify` 使用：

```python
class EmailSender:
    def send(self, message):
        print(f'发送邮件：{message}')

class ConsoleSender:
    def send(self, message):
        print(f'控制台输出：{message}')

notify(EmailSender(), '任务完成')
notify(ConsoleSender(), '任务完成')
```

这里的共同接口就是 `send(message)`。所谓“具有发送能力”，不是说两个对象属于同一个类，而是说调用者需要的这次操作在两个对象上都成立。

**Duck typing：直接调用，运行时再判断。**

上面的 `notify` 没有提前检查参数类型。Python 运行到 `sender.send(message)` 时才查找 `send`；找到就调用，找不到就抛出 `AttributeError`。它的原则是“不问对象是什么，只尝试它能不能完成这次操作”。

**`Protocol`：把需要的接口写给静态检查器。**

```python
from typing import Protocol

class Sender(Protocol):
    def send(self, message: str) -> None:
        ...

def notify(sender: Sender, message: str) -> None:
    sender.send(message)
```

`Sender` 相当于一份接口说明：参数应当具有 `send(str) -> None`。`EmailSender` 不需要继承 `Sender`；只要方法签名兼容，Pyright、mypy 或 IDE 就可以在运行前判断它满足要求，并对明显不符合的参数给出提示。

类型注解默认不会让 Python 在运行时自动验证参数。真正执行 `sender.send(...)` 时，依然使用 Duck typing。`Protocol` 的作用是在保留这种灵活性的同时，让静态检查器更早发现接口不匹配。

**ABC：要求实现类明确加入一个抽象家族。**

```python
from abc import ABC, abstractmethod

class Sender(ABC):
    @abstractmethod
    def send(self, message: str) -> None:
        ...

class EmailSender(Sender):
    def send(self, message: str) -> None:
        print(f'发送邮件：{message}')
```

使用 ABC 时，`EmailSender` 要显式继承 `Sender`。如果子类没有实现 `send`，Python 会阻止它实例化。它适合框架需要明确规定“哪些类属于这个体系，以及子类必须实现什么”的场景。

| 方式 | 是否要求继承 | 主要检查时机 | 适合的情况 |
|---|---|---|---|
| Duck typing | 否 | 方法真正执行时 | 小型、动态、强调灵活性的代码 |
| `Protocol` | 否 | 静态检查阶段 | 希望保留灵活性，同时获得类型提示 |
| ABC | 是 | 创建不完整子类实例时 | 需要明确扩展体系和强制实现抽象方法的框架 |

三者都只能约束接口形状，无法自动证明方法真的“正确发送”了消息。它们的核心差别不是能力本身，而是是否需要声明类型关系，以及在什么阶段发现接口缺失。

### 4.2 `singledispatch` 是受限的 Type Dispatch

标准库 `functools.singledispatch` 根据第一个实参的运行时类型选择实现：

```python
from functools import singledispatch

@singledispatch
def encode(value):
    raise TypeError(f'unsupported type: {type(value).__name__}')

@encode.register
def _(value: int):
    return {'type': 'int', 'value': value}

@encode.register
def _(value: str):
    return {'type': 'str', 'value': value}
```

它适合“操作由第一个参数类型决定”的开放扩展，但不是教材二维类型对表的完整替代：`add(x, y)` 若取决于两个参数类型，single dispatch 不能直接表达整个组合矩阵。类方法场景还可以使用 `singledispatchmethod`。

### 4.3 二元运算中的 `NotImplemented`

自定义 `__add__` 遇到不支持的类型时，通常应返回 `NotImplemented`，让 Python 尝试对方的反向方法 `__radd__`，而不是立即抛出异常：

```python
class Vector:
    def __add__(self, other):
        if not isinstance(other, Vector):
            return NotImplemented
        return Vector(self.x + other.x, self.y + other.y)
```

这也是一种双边类型协作。`NotImplemented` 是给解释器的分派信号，`NotImplementedError` 则是异常类，两者含义不同。

对于可能丢失信息的 coercion，显式构造函数、解析函数或命名转换方法通常比静默自动转换更容易审计。是否自动转换，应由精度、可逆性和调用者预期共同决定。

前四节解决了“同一种操作怎样适配不同对象”。但接口统一只隐藏了实现差异，并没有让不同实现付出相同成本。接下来要把视角从调用方式转向执行过程。

## 5. 统一接口之后，表示仍然决定效率

具体运行时间受机器、解释器和输入分布影响。教材先用更稳定的事件数量观察过程：

- 时间可以用函数调用次数或关键操作次数近似衡量；
- 空间可以用求值期间最大同时活动 frame 数量理解。

Tree recursion 可能产生大量调用，但遍历过程中已经完成且不再被引用的 frame 可以回收，因此“总共创建多少调用”与“某时刻最多保存多少调用”是两个不同指标。

```text
时间视角：整棵计算树一共访问多少节点
空间视角：从根到当前位置最长保留多少活动节点
```

对于已经熟悉复杂度分析的人，教材这一部分最有价值的不是重新背增长类别，而是把资源消耗连接回环境模型：空间由仍参与未来求值的活动环境决定。

## 6. Memoization：用额外空间减少重复计算

**Memoization（记忆化）** 保存函数对已见参数的结果，重复调用时直接读取缓存：

```python
def memo(f):
    cache = {}

    def memoized(n):
        if n not in cache:
            cache[n] = f(n)
        return cache[n]

    return memoized
```

这段很短的代码同时使用了本章多个概念：

```text
高阶函数  → 接收 f，返回包装后的函数
闭包      → memoized 保留 cache 与 f
可变状态  → cache 随调用历史增长
字典抽象  → 参数映射到已经计算的结果
对象身份  → 每次 memo(f) 创建独立缓存
效率权衡  → 用额外空间减少重复时间
```

`memoized` 不需要 `nonlocal cache`，因为它没有重新绑定 `cache`，只修改了字典对象。作为字典 key 的参数必须可哈希；缓存还会让函数输出依赖历史保存的结果，因此通常只应包装对相同输入具有稳定结果的函数。

记忆化没有改变被计算函数的抽象结果，却改变了计算过程和资源分配。这再次说明：接口正确性与实现效率相关，但不是同一个问题。

### 6.1 从记忆化到工程缓存，还差一套失效策略

前面的 `memo` 适合输入决定输出的稳定计算。例如 `factorial(10)` 的结果不会因为时间经过或数据库更新而变化，所以第一次算出结果后可以一直复用。

工程代码经常缓存的却是会变化的数据：

```python
from functools import lru_cache

@lru_cache(maxsize=256)
def get_user_name(user_id):
    return database.query_user_name(user_id)
```

第一次调用会查询数据库并保存结果，之后相同的 `user_id` 会直接命中缓存：

{% mermaid %}
flowchart LR
    REQUEST["get_user_name(42)"] --> CACHE{"缓存中存在？"}
    CACHE -->|hit| RETURN["直接返回 Alice"]
    CACHE -->|miss| DB["查询数据库"]
    DB --> SAVE["保存 Alice + 失效信息"]
    SAVE --> RETURN
    UPDATE["数据源改为 Bob"] --> STALE{"缓存是否已失效？"}
    STALE -->|否| WRONG["继续返回陈旧的 Alice"]
    STALE -->|是| EVICT["删除或刷新缓存"]
{% endmermaid %}

如果数据库已经把名字改成 Bob，缓存仍可能继续返回 Alice。这个结果在保存时是正确的，后来却因为数据源变化而过时，这就是 **stale data（陈旧数据）**。因此，工程缓存不能只考虑“怎样存”，还必须规定“缓存何时不再可信，以及怎样删掉或替换它”，这就是 **cache invalidation（缓存失效）**。

一套缓存设计至少要处理下面五件事。

**1. Cache key 必须包含所有影响结果的条件。**

缓存通过 key 判断“两次请求是否可以共用结果”。如果用户名还受到 `tenant_id` 影响，只用 `user_id` 作为 key，就可能把一个租户的结果错误地返回给另一个租户。

```text
不完整的 key：user_id
更完整的 key：(tenant_id, user_id)
```

函数参数作为 `cache` 或 `lru_cache` 的 key 时必须可哈希。缓存实例方法时，`self` 也会成为 key 的一部分，因此缓存可能继续持有实例引用，直到条目被淘汰或缓存被清空。

**2. 容量淘汰和数据失效是两件事。**

`lru_cache(maxsize=256)` 在条目超过上限时淘汰最近最少使用的结果，解决的是“内存不能无限增长”；它不会因为数据库更新或时间经过而自动删除旧值。

常见失效方式包括：

- **主动删除**：数据修改成功后，同时删除对应缓存；
- **TTL（Time To Live，生存时间）**：条目只保存一段时间，到期后重新读取数据源；
- **版本化 key**：数据版本变化后使用新 key，让旧条目不再被读取；
- **容量淘汰**：使用 LRU（Least Recently Used，最近最少使用）等策略限制缓存大小；缓存满时，优先删除最久没有访问的条目。

它们解决的问题不同，实际系统常常组合使用。例如用主动删除保证更新尽快可见，同时设置 TTL 作为删除消息遗漏后的兜底。

**3. 缓存范围决定谁能看到同一份结果。**

`functools.cache` 和 `lru_cache` 保存的是当前 Python 进程内的内存数据。一个服务启动四个进程时，通常会得到四份彼此独立的缓存；清理其中一份，不会自动清理另外三份。若多台服务需要共享缓存，就需要 Redis 等外部存储，并另外设计并发与一致性规则。

`functools.cache` 不设容量上限；`lru_cache(maxsize=...)` 能限制条目数量，并通过 `cache_clear()` 清空缓存。

**4. 是否值得缓存要用实际收益判断。**

缓存适合“计算昂贵，并且相同输入经常重复”的操作。简单运算即使命中率很高，缓存查询也未必比重新计算划算；命中率较低时，如果每次命中能避免一次昂贵的数据库或网络请求，仍可能有价值。

`lru_cache` 的 `cache_info()` 会给出命中次数、未命中次数和当前条目数：

```python
info = get_user_name.cache_info()
hit_rate = info.hits / (info.hits + info.misses)
```

```text
每次命中的收益 ≈ 原计算成本 − 缓存查询成本
总收益           ≈ 命中次数 × 每次命中的收益
```

实际判断时要同时观察命中率、接口或计算耗时、P95 延迟、内存占用和陈旧数据风险。只有节省的时间与外部请求明显多于缓存的存储和维护成本，缓存才真正有价值。

**5. 线程安全不等于同一个结果只计算一次。**

标准库缓存能保证多个线程同时读写时，内部字典等缓存结构不会被破坏。但当两个线程几乎同时请求一个尚未缓存的 key 时，它们仍可能都开始计算：

{% mermaid %}
sequenceDiagram
    participant A as 请求 A
    participant C as 普通线程安全缓存
    participant B as 请求 B
    participant D as 数据库
    A->>C: get(42)
    C-->>A: miss
    B->>C: get(42)
    C-->>B: miss
    A->>D: 查询 key=42
    B->>D: 重复查询 key=42
    D-->>A: result
    D-->>B: result
    A->>C: 写入结果
    B->>C: 再次写入同一结果
{% endmermaid %}

结果通常仍然正确，缓存结构也没有损坏，但数据库承受了两次重复查询。如果一个热点 key 失效后，大量请求同时绕过缓存访问数据源，就可能形成 **cache stampede（缓存踩踏）**，也常被描述为缓存击穿。

**Single-flight** 进一步规定：同一个 key 在同一时间只由一个执行者计算，其他执行者等待并共享它的结果。

{% mermaid %}
sequenceDiagram
    participant A as 请求 A
    participant F as Single-flight(42)
    participant B as 请求 B
    participant C as 请求 C
    participant D as 数据库
    A->>F: key=42 miss，获得计算权
    A->>D: 只发起一次查询
    B->>F: key=42 正在计算，等待
    C->>F: key=42 正在计算，等待
    D-->>A: result
    A->>F: 保存并发布 result
    F-->>B: 复用 result
    F-->>C: 复用 result
{% endmermaid %}

这个限制只针对相同 key；`key=43` 仍然可以同时计算。Single-flight 解决的是昂贵操作的并发重复执行，线程安全解决的是缓存内部数据不被并发读写破坏，两者不是一回事。

普通同步缓存也不适合直接装饰 `async def`。调用异步函数先得到 coroutine 对象，而最终结果要等 `await` 后才产生；缓存 coroutine 不等于缓存最终结果，并且重复等待同一个 coroutine 还可能出错。异步代码通常需要能够等待计算完成、合并并发请求并正确清理异常结果的专用缓存。

可以把工程缓存记成一句话：**先定义哪些请求可以共享结果，再定义结果何时过期、保存在哪里，以及并发 miss 时由谁负责计算。**

Memoization 展示的是“计算过程的表示”怎样改变资源消耗。集合则能更直观地展示：抽象行为完全相同，底层数据结构不同，主要操作的复杂度也会不同。

## 7. Set：同一抽象，不同表示与成本

抽象地看，Set 是不含重复元素的集合，支持：

- membership：元素是否存在；
- adjoin：加入元素；
- union：并集；
- intersection：交集。

只要这些行为满足集合契约，底层可以使用无序链表、有序链表或二叉搜索树。高层集合程序不需要知道表示，但选择表示的人必须知道主要操作的成本。

### 7.1 无序序列

查找只能逐项扫描，平均和最坏情况都是线性量级。为了保持元素不重复，加入前也要先做成员测试；交集与并集会重复执行成员测试，从而达到二次量级。

### 7.2 有序序列

有序性允许查找在遇到更大元素时提前停止，但最坏情况仍需线性扫描，所以增长阶仍为 $\Theta(n)$。真正的优势出现在双指针式合并：两个有序集合可以同步前进，交集和并集由二次量级降到线性量级。

### 7.3 Binary Search Tree

二叉搜索树让左子树元素更小、右子树元素更大。如果树接近平衡，每次比较都能排除约一半元素，成员测试和加入都可达到 $\Theta(\log n)$。

平衡条件不能省略。退化成单链的搜索树高度为 $n$，查找会回到 $\Theta(n)$。抽象接口没有表达“必须平衡”，因此若性能契约要求对数复杂度，实现还需要额外维护平衡不变量。

| Set 表示 | Membership | Adjoin | Intersection / Union | 额外要求 |
|---|---:|---:|---:|---|
| 无序序列 | $\Theta(n)$ | $\Theta(n)$ | $\Theta(n^2)$ | 保证无重复 |
| 有序序列 | $\Theta(n)$ | $\Theta(n)$ | $\Theta(n)$ | 元素可比较且保持有序 |
| 平衡搜索树 | $\Theta(\log n)$ | $\Theta(\log n)$ | 取决于具体算法 | 维护搜索顺序与平衡 |

这里最重要的不是选择“永远最快”的表示，而是让表示匹配操作分布：

- 集合很小且构造简单，无序表示可能足够；
- 经常批量求交、求并，有序序列的线性合并有优势；
- 经常动态查询与插入，平衡搜索树更合适；
- 实际 Python `set` 通常采用哈希表思路，又是另一种表示权衡。

教材使用链表和树不是工程推荐，而是为了让同一接口下的表示差异与复杂度差异清晰可见。

### 7.4 Python `set` 与 `dict` 的哈希契约

实际 Python 的 `set` 与 `dict` 采用哈希表思路，成员测试和键查找通常具有平均 $\Theta(1)$ 成本，但这依赖哈希分布和扩容策略，不代表任何情况下都严格常数时间。

自定义对象参与哈希容器时必须遵守：

{% mermaid %}
flowchart LR
    EQ["a == b"] --> MUST["必须满足"]
    MUST --> HASH["hash(a) == hash(b)"]
    HASH --> COLLISION["反方向不成立<br/>相同 hash 仍可能碰撞"]
    MUTABLE["参与 equality/hash 的字段发生变化"] --> LOST["对象可能落在错误桶中<br/>之后无法正常找到"]
{% endmermaid %}

反方向不成立：哈希相同的对象仍可能不相等，容器会继续用 equality 区分碰撞。若对象作为 key 后，其参与 equality 和 hash 的字段还能变化，容器可能再也无法在原桶位置正确找到它。因此，值可变的列表、字典和集合默认不可哈希；自定义 key 也应让哈希相关状态保持稳定。

这把本章的三条线连接起来：identity 决定是不是同一对象，equality 决定逻辑值是否相同，hash 决定哈希容器怎样定位候选位置。

### 7.5 数据抽象没有消除效率问题

抽象屏障要求高层代码不要直接依赖底层表示，但它不要求设计者对表示一无所知。

应当分开两个判断：

{% mermaid %}
flowchart LR
    CHOICE["选择一种表示"] --> CONTRACT{"满足抽象行为契约？"}
    CONTRACT -->|否| REJECT["实现不正确"]
    CONTRACT -->|是| COST{"目标工作负载下<br/>时间与空间成本合适？"}
    COST -->|否| OPTIMIZE["替换底层表示"]
    COST -->|是| ACCEPT["接口正确且表示适用"]
    OPTIMIZE --> CONTRACT
{% endmermaid %}

链表和数组都可以实现序列接口，但随机索引成本不同；无序链表与搜索树都可以实现集合接口，但成员测试成本不同。高层算法保持抽象，底层设计仍必须根据数据规模、更新频率、查询模式和空间限制选择表示。

抽象的价值不是让效率差异消失，而是把变化隔离：只要新表示继续满足接口，高层程序不必因性能优化被整体改写。

## 8. 把整篇串起来

整篇可以压缩成一条连续的主线：

{% mermaid %}
mindmap
  root((泛型操作与效率))
    对象协议
      特殊方法
      进入 Python 既有语法
    实现选择
      Shared interface
      Type dispatch
      Coercion
    Python 约束方式
      Duck typing
      Protocol
      ABC
    表示与成本
      Sequence
      Set
      Hash contract
    空间换时间
      Memoization
      Cache invalidation
      Single-flight
{% endmermaid %}

这里最重要的不是背住三种机制的英文名称，而是分清三层责任：

| 需要回答的问题 | 主要设计位置 |
|---|---|
| 对象怎样响应某种操作？ | special method 或 shared interface |
| 多种类型相遇时由谁实现？ | type dispatch、反向运算或 coercion |
| 同样正确的实现中该选哪一个？ | 数据表示、复杂度与实际操作分布 |

由此可以得到五个核心结论：

1. 统一协议统一的是**调用方式和行为语义**，不是内部存储方式；
2. Shared interface 不要求共同父类，继承也不是实现泛型操作的唯一方式；
3. Type dispatch 选择现成实现，coercion 先改变参数类型再复用实现；
4. 转换后的数学值可能等价，但原表示的精度或结构信息未必还能保留；
5. 抽象屏障把优化限制在实现层，却不会让复杂度差异消失。若接口明确承诺性能，性能本身也属于契约。

这套思路也会延伸到后续解释器：语言中的语法操作由协议定义，运行时根据对象和环境选择行为，而底层表示仍决定执行成本。

## 参考

- [Composing Programs 2.7：Object Abstraction](https://www.composingprograms.com/pages/27-object-abstraction.html)
- [Composing Programs 2.8：Efficiency](https://www.composingprograms.com/pages/28-efficiency.html)
- [Composing Programs 2.9：Recursive Objects](https://www.composingprograms.com/pages/29-recursive-objects.html)
- [Python 文档：`typing.Protocol`](https://docs.python.org/3/library/typing.html#typing.Protocol)
- [Python 文档：Abstract Base Classes](https://docs.python.org/3/library/abc.html)
- [Python 文档：`functools.cache` 与 `lru_cache`](https://docs.python.org/3/library/functools.html)
