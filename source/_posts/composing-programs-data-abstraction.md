---
title: 数据抽象：让程序依赖契约而不是表示
date: 2026-08-24 10:00:00
top_img: /img/composing-programs-data-abstraction-nature-cover.jpg
cover: /img/composing-programs-data-abstraction-nature-cover.jpg
cover_credit: "Phil Schermeister · National Geographic"
cover_source: "https://www.nationalgeographic.com/photography/article/earth-and-sky-photo-gallery"
description: Composing Programs 第二章笔记之一：从构造器、选择器和抽象屏障出发，理解序列与递归数据为什么由行为而不是存储结构定义。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Data Abstraction
toc: true
toc_number: false
katex: true
---

这一章要解决的问题，不是怎样在 Python 中创建列表或定义类，而是：程序怎样从具体的数据表示出发，建立一个不依赖具体表示的使用层，并最终把状态、行为和多种表示组织成对象系统。

全章可以沿着一条连续路线理解：

```text
具体表示
   ↓
构造器、选择器与行为契约
   ↓
序列接口与递归数据
   ↓
可变状态、身份与消息传递
   ↓
类、实例、属性查找与方法绑定
   ↓
对象协议、泛型操作与多种表示
   ↓
表示选择对算法效率的影响
```

本篇先完成前两步。对应教材：

- [2.1 Introduction](https://www.composingprograms.com/pages/21-introduction.html)
- [2.2 Data Abstraction](https://www.composingprograms.com/pages/22-data-abstraction.html)
- [2.3 Sequences](https://www.composingprograms.com/pages/23-sequences.html)

## 1. 为什么需要数据抽象：隔离表示变化

复合数据同时面对两个问题：数据怎样存储，以及使用者怎样操作数据。如果高层代码直接读取内部结构，这两个问题就会耦合在一起。

假设暂时用二元组表示有理数，第 0 项是分子，第 1 项是分母。没有抽象接口时，加法可能直接写成：

```python
def add_rational(x, y):
    return (
        x[0] * y[1] + y[0] * x[1],
        x[1] * y[1],
    )
```

这段代码不仅描述了“怎样计算有理数加法”，还知道了三个表示细节：有理数是元组、分子位于下标 `0`、分母位于下标 `1`。如果以后改用字典或对象表示，所有采用这种写法的加法、乘法和比较函数都要一起修改。

数据抽象在高层运算和具体表示之间加入一组接口：

```python
def add_rational(x, y):
    return rational(
        numer(x) * denom(y) + numer(y) * denom(x),
        denom(x) * denom(y),
    )
```

现在 `add_rational` 只依赖三个操作：

- `rational(n, d)` 构造有理数；
- `numer(x)` 取得分子；
- `denom(x)` 取得分母。

依赖关系因此从“直接依赖存储结构”变成“依赖抽象接口”：

```text
没有数据抽象：高层运算 ──直接依赖──> tuple 与下标

引入数据抽象：高层运算
                    ↓ 只调用
               抽象接口
                    ↓ 封装
               具体表示
```

元组、字典或对象等具体表示仍然存在，但只有构造器和选择器需要了解它们。以后更换表示时，通常只需修改 `rational`、`numer` 和 `denom` 的实现，高层运算可以保持不变。

数据抽象的核心不是消除具体表示，而是把“谁需要知道具体表示”限制在尽可能小的范围内。

要做到这一点，高层代码与具体表示之间必须有一组稳定的入口，这就是构造器和选择器。

## 2. 接口如何形成抽象屏障

**Constructor（构造器）** 是创建数据的入口，**Selector（选择器）** 是读取数据的入口。例如，`rational(1, 2)` 创建有理数，`numer(x)` 和 `denom(x)` 读取它的分子和分母。使用者只通过这些入口操作数据，不直接接触内部存储结构。

一种最直接的实现如下：

```python
def rational(n, d):
    return (n, d)

def numer(x):
    return x[0]

def denom(x):
    return x[1]
```

这里有两个不同层次：

```text
抽象层看见：rational、numer、denom
表示层看见：tuple、下标 0、下标 1
```

元组并不是“有理数本身”，只是当前实现有理数契约的一种材料。只要构造器和选择器继续满足约定，高层程序就不必知道材料是否改变。

### 2.1 先写用法，再决定表示

教材先写有理数运算，再决定 `rational`、`numer` 和 `denom` 的实现。这种方法称为 **wishful thinking**：先假设理想接口已经存在，站在问题本身的层次编写高层代码。

它并不是忽略实现，而是把两个设计问题分开：

1. 如果已经拥有合适的数据抽象，高层算法应该怎样表达？
2. 哪一种具体表示能够实现这个抽象？

如果一开始就围绕元组下标编程，表示细节会过早进入算法，高层接口也容易被当前实现反向塑造。

构造器和选择器提供了入口，但只有所有调用者都遵守入口，表示细节才能真正被隔离。

### 2.2 抽象屏障限制每一层知道什么

**Abstraction barrier（抽象屏障）** 不是运行时禁止访问的墙，而是一条关于依赖关系的设计纪律：每一层只使用紧邻下一层暴露的接口。

有理数例子可以分成三层：

| 层次 | 把有理数看成什么 | 允许依赖的操作 |
|---|---|---|
| 应用层 | 一个完整数值 | `add_rational`、`mul_rational` 等 |
| 抽象数据层 | 分子与分母构成的值 | `rational`、`numer`、`denom` |
| 具体表示层 | Python 复合对象 | 元组构造与索引 |

计算平方时，下面三种写法可能得到相同结果，但依赖程度不同：

```python
def square_rational(x):
    return mul_rational(x, x)

def square_rational_leaks_interface(x):
    return rational(numer(x) ** 2, denom(x) ** 2)

def square_rational_leaks_representation(x):
    return (x[0] ** 2, x[1] ** 2)
```

第一种只依赖有理数运算；第二种绕过高层运算，知道了组成部分；第三种进一步假定了底层是二元组。它们的区别不是今天能不能运行，而是未来改变表示或接口时，哪些函数会被迫一起修改。

抽象屏障的价值可以用一个问题检验：

> 如果底层表示改变，哪些代码应该修改？

理想答案是构造器、选择器及其附近的实现；如果大量业务函数都要跟着变化，屏障实际上已经失效。

抽象屏障规定了每一层可以依赖哪些操作，接下来还要说明这些操作必须保证什么结果。

### 2.3 行为契约规定接口必须保证什么

只列出函数名还不足以定义抽象。构造器和选择器之间还必须满足 **behavior condition（行为条件）**。

若 `x = rational(n, d)`，那么至少应满足：

```text
numer(x) / denom(x) == n / d
```

这并不要求 `numer(x) == n` 且 `denom(x) == d`。实现完全可以在构造时约分，也可以统一负号位置；只要选出的两部分仍表示同一个有理数，契约就是成立的。

因此，一个抽象数据可以概括为：

```text
抽象数据 = 一组可用操作 + 操作之间必须保持的行为规律
```

这个定义比“某个类”或“某种内存布局”更根本。同一个契约可以有多种实现，同一种存储结构也可以被解释成不同抽象。

既然抽象由公开操作和行为规律定义，那么实现就不必具有某种固定形状。函数表示的 pair 正好验证了这一点。

## 3. 抽象由行为定义，而不是由存储形状定义

Pair 的最低行为要求只有：用 `x`、`y` 构造 `p` 后，选择第 0 项得到 `x`，选择第 1 项得到 `y`。只要满足这一规律，并不要求 pair 必须是列表或元组。

```python
def pair(x, y):
    def get(index):
        if index == 0:
            return x
        if index == 1:
            return y
        raise IndexError(index)
    return get

def select(p, index):
    return p(index)
```

```python
p = pair(20, 14)
select(p, 0)  # 20
select(p, 1)  # 14
```

运行时，`pair` 返回的闭包保存了 `x` 和 `y` 所在的定义环境；`select` 通过调用这个函数取得相应部分。从存储形态看它是函数，从可观察行为看它满足 pair 的契约。

这个例子证明的不是“实际项目应该用函数模拟二元组”，而是：

> 数据的抽象含义来自可观察行为，而不是来自某一种先验的存储形状。

教材特意选择这种不直观且低效的表示，是为了把“数据是什么”和“Python 通常怎样存数据”彻底分开。它并不声称 Python 的列表在底层由这些闭包实现。

有理数和 pair 讨论的是单个复合值；同一原则也可以继续推广到一组值以及更复杂的数据结构。

## 4. 从单个值推广到数据结构

### 4.1 Sequence：不同容器共享一组行为

教材把 **sequence abstraction（序列抽象）** 最低限度地描述为两种行为：

- 有限长度；
- 可以用合法的非负整数位置选择元素。

列表、元组、range 和自定义链表的存储方式不同，但都可以表现为序列。算法只要依赖遍历、长度和元素选择等共同操作，就不需要为每种容器重写一份。

```text
list  ───────┐
tuple ───────┼──> sequence interface ──> 通用算法
range ───────┤
Link  ───────┘
```

这延续了数据抽象的思路：

- 有理数接口隐藏一个值的内部组成；
- 序列接口隐藏一组值具体怎样排列和存储；
- 通用算法依赖共同能力，而不依赖类型名称。

Map、Filter、Reduce 的意义也在这里。它们分别抽象“逐项变换”“按条件保留”和“合并为结果”，可以组合成输入输出都是序列的数据管线：

```text
原始序列 → 过滤 → 映射 → 聚合 → 结果
```

重点不在于用函数式写法替代所有循环，而在于每个阶段都通过清晰接口交接数据，使变化被限制在局部处理规则中。

接口也不是越丰富越好。行为越多，使用者越方便，但新类型要满足的契约也越重。序列值得拥有较丰富的接口，是因为它极其通用；用户自定义抽象通常应只暴露真正稳定、必要的行为。

Sequence 统一的是扁平集合的操作；当一个数据的组成部分仍然是同类数据时，同样的抽象方法就会得到递归数据。

### 4.2 Tree：接口也可以描述递归结构

Tree 的定义本身就是递归的：一棵树有一个根标签，以及若干仍然是树的分支。其抽象接口可以由构造器 `tree` 和选择器 `label`、`branches` 构成。

下面使用元组作为分支集合，避免可变默认参数影响例子的主线：

```python
def tree(root_label, branches=()):
    return (root_label, tuple(branches))

def label(t):
    return t[0]

def branches(t):
    return t[1]

def is_leaf(t):
    return not branches(t)
```

高层递归函数只使用选择器：

```python
def count_nodes(t):
    return 1 + sum(count_nodes(branch) for branch in branches(t))
```

即使以后把树改成类实例，只要继续提供等价接口，`count_nodes` 的思路不需要改变。递归数据的一般处理模式是：

```text
识别基本情形
    ↓
提取当前部分
    ↓
递归处理子结构
    ↓
组合局部结果
```

Linked List 也是相同结构：非空链表由 `first` 和仍为链表的 `rest` 构成，空链表是基本情形。树与链表的递归并不取决于它们是嵌套列表、函数还是对象；递归关系属于抽象，具体容器属于表示。

从有理数到序列和树，使用的都是同一条原则：先确定稳定行为，再把表示限制在接口之后。现代 Python 只是用类、property 和 protocol 等工具表达这条原则。

## 5. 在现代 Python 中落实抽象契约

在现代 Python 中，抽象接口通常表现为函数、类的公开方法、property 或 protocol，但语法本身不会自动建立抽象屏障。

`dataclass` 是用来定义“主要负责保存数据的类”的装饰器。它会读取类中的字段，并自动生成初始化、打印和比较对象所需的重复代码。

不使用 `dataclass` 时，至少要自己编写初始化代码：

```python
class Rational:
    def __init__(self, numer, denom):
        self.numer = numer
        self.denom = denom
```

如果还希望对象能够自然地打印和比较，就要继续编写 `__repr__`、`__eq__` 等方法。使用 `dataclass` 后，这些样板代码可以由 Python 自动生成：

```python
from dataclasses import dataclass

@dataclass
class Rational:
    numer: int
    denom: int
```

这里的 `numer: int` 和 `denom: int` 会被识别为字段，`dataclass` 据此生成 `__init__`、`__repr__` 和 `__eq__` 等方法。因此，`Rational(1, 2)` 可以直接创建、打印和比较，而不必手写这些重复逻辑。

但是，调用者仍然通过 `x.numer` 和 `x.denom` 直接依赖这两个字段。如果以后改变内部存储方式，这些代码仍可能受到影响。因此，`dataclass` 解决的是“少写重复代码”，数据抽象解决的则是“让使用者依赖稳定接口，而不是内部表示”。

因此，判断抽象是否成立，不能只问“是否定义了类”，还要问：

1. 使用者真正需要哪些稳定操作？
2. 哪些约束必须由构造阶段保证？
3. 使用者是否绕过公开操作读取或修改内部表示？
4. 替换实现后，针对接口行为编写的测试能否继续通过？

在 Python 中，`_name` 表示“这是内部实现，请不要直接使用”，但解释器不会禁止外部访问。例如，`account._balance` 仍然可以被读取和修改。下划线只是程序员之间的约定；真正的封装还要求类或模块提供稳定的公开方法，并让调用者通过这些方法操作数据。

类型注解也不会让 Python 自动执行类型检查：

```python
def identity(x: int) -> int:
    return x

identity("hello")  # 可以运行，并返回 "hello"
```

这里的 `x: int` 和 `-> int` 是提供给阅读者、编辑器以及 Pyright、mypy 等静态检查工具的信息。静态检查工具可以在运行程序之前报告类型不匹配，但 Python 解释器通常不会因为注解而拒绝这次调用。

如果程序确实需要在运行时拒绝错误类型，就要显式检查：

```python
def identity(x: int) -> int:
    if not isinstance(x, int):
        raise TypeError("x must be an int")
    return x
```

Pydantic 等库也能根据类型注解执行运行时校验，但这是库额外提供的能力，不是类型注解本身的默认行为。

### 5.1 选择合适的抽象粒度

抽象粒度指的是：公开接口提供多少能力、承担多少职责。合适的接口应该足以覆盖稳定的常见用例，但不暴露内部表示，也不承担无关工作。

接口太窄时，调用者无法直接完成常见任务，只能绕过接口或重复实现逻辑。假如有理数接口只有 `numer` 和 `denom`，而加法又是常见操作，调用者就会到处重复：

```python
rational(
    numer(x) * denom(y) + numer(y) * denom(x),
    denom(x) * denom(y),
)
```

这说明“有理数加法”可能应该成为稳定接口的一部分，例如提供 `add_rational(x, y)`。

接口太宽时，它会包含不稳定、少用或只适合某种实现的能力，例如：

```python
get_internal_tuple(x)       # 暴露当前存储结构
set_raw_denominator(x, d)   # 允许绕过抽象规则
save_to_database(x)         # 把无关职责放进有理数抽象
```

这些操作会让调用者依赖实现细节，也会迫使新的表示继续支持并不自然的功能。

可以用两个现象快速判断：

```text
调用者经常绕过接口或重复底层逻辑 → 接口可能太窄
新实现很难自然地支持某些公开操作 → 接口可能太宽
```

因此，抽象设计追求的不是方法越少或越多，而是**最小但够用**。一个实用的设计顺序是：

```text
先列出稳定用例
    ↓
提取最小必要操作
    ↓
写清每个操作应有的行为
    ↓
让高层代码只依赖这些操作
    ↓
最后根据正确性与成本选择表示
```

这套顺序比先创建一个包含大量字段和方法的类更可靠，因为它先确定抽象边界，再决定用什么 Python 结构实现。

当数据只在构造后被读取时，构造器、选择器和行为契约已经足够；加入可变状态后，抽象还需要处理身份和时间，这就自然进入对象系统。

## 6. 从数据抽象自然走向对象

到目前为止，抽象值主要表现为“构造后由操作读取和计算”。下一步加入 mutation 后，数据会在运行期间改变，同一个值还会拥有区别于内容的身份和历史。

```text
数据抽象：隐藏一个值怎样表示
可变状态：同一个值怎样随时间演化
对象系统：由谁保存状态、响应操作并与其他值协作
```

因此，对象不是与数据抽象无关的另一套语法。它是在抽象屏障之内进一步封装状态和行为的组织方式。

## 7. 回顾：三个关键判断

整篇可以收束为一句话：数据抽象让高层程序依赖接口及其行为契约，而不是依赖当前存储结构；序列和递归数据只是把同一原则扩展到集合与层级结构。

### 7.1 更换表示时，修改应停留在抽象屏障下方

把有理数从二元组改成始终约分的对象时，`rational`、`numer` 和 `denom` 属于表示接口的实现，需要随新表示调整；只依赖这些接口的 `add_rational` 不应该修改。

直接使用 `x[0]` 的函数已经假定有理数可以索引，而且第 0 项就是分子，因此也必须修改。修改范围扩散到这类函数，正是抽象屏障被穿透的证据。

```text
应该稳定：高层算术操作
允许变化：constructor / selector 的实现
被迫变化：直接依赖 tuple、下标或字段布局的代码
```

### 7.2 Pair 的抽象身份来自行为契约

函数实现的 pair 与二元组实现的 pair 虽然存储形态不同，但都能满足同一规律：用 `x`、`y` 构造后，选择第 0 项得到 `x`，选择第 1 项得到 `y`。

高层程序只能通过 `pair` 与 `select` 观察数据时，两种实现具有相同的可观察行为，因此可以视为同一种抽象数据。抽象等价不要求内存布局相同，只要求公开操作及其行为规律一致。

### 7.3 共同接口保证正确性，具体表示决定操作成本

只调用 `len(s)` 和 `s[i]` 的算法依赖的是序列行为，不是 `list` 这个类型名称。只要自定义链表实现相同行为，算法在接口层面仍然正确。

正确性不代表效率相同。数组式列表通常可以常数时间按位置访问，单链表的 `s[i]` 需要从头移动，单次索引可能是线性时间。如果算法在循环中反复索引链表，总成本可能从线性上升到二次量级。

这说明抽象屏障隔离的是表示依赖，不会抹平表示之间的复杂度差异。Tree 和 Linked List 也是如此：递归关系属于抽象接口，嵌套列表、函数或对象只是可以替换的具体表示。

## 参考

- [Composing Programs 2.1：Introduction](https://www.composingprograms.com/pages/21-introduction.html)
- [Composing Programs 2.2：Data Abstraction](https://www.composingprograms.com/pages/22-data-abstraction.html)
- [Composing Programs 2.3：Sequences](https://www.composingprograms.com/pages/23-sequences.html)
