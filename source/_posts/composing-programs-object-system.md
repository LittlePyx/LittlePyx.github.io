---
title: 对象系统：属性查找、方法绑定与类的实现
date: 2026-08-24 12:00:00
top_img: /img/composing-programs-object-system-nature-cover.jpg
cover: /img/composing-programs-object-system-nature-cover.jpg
cover_credit: "Mohammad Murad · National Geographic Your Shot"
cover_source: "https://www.nationalgeographic.com/photography/article/bird-gallery"
description: Composing Programs 第二章笔记之三：从消息传递理解 Python 的实例、类、属性查找、bound method 与继承，并用函数和字典重新实现核心对象机制。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Object-Oriented Programming
  - Python Object Model
toc: true
toc_number: false
katex: true
---

闭包与 dispatch dictionary 已经能够把状态和行为封装在一起，但每创建一个值都要重新组织消息字典。类系统增加了更系统的共享机制：实例保存各自状态，类保存多个实例共同使用的行为，点表达式负责查找属性，并在需要时把函数绑定到当前实例。

本篇对应教材：

- [2.5 Object-Oriented Programming](https://www.composingprograms.com/pages/25-object-oriented-programming.html)
- [2.6 Implementing Classes and Objects](https://www.composingprograms.com/pages/26-implementing-classes-and-objects.html)

重点不是复习 `class` 语法，而是完整解释一次 `obj.method(arg)` 在概念上怎样运行，以及这些机制如何由更基础的函数和字典实现。

## 1. 从对象到类：实例保存状态，类共享行为

### 1.1 对象、实例与类分别是什么

对象可以从三个方面描述：

{% mermaid %}
mindmap
  root((Object))
    State
      当前保存的信息
    Identity
      状态改变后仍是同一实体
    Behavior
      能够响应的操作
{% endmermaid %}

**Instance（实例）** 是某个具体对象。**Class（类）** 描述一类实例共享的创建方式和行为，并为属性查找提供后备空间。

{% mermaid %}
flowchart LR
    A["Instance A<br/>独立状态"] --> C["Class<br/>共享方法与类属性"]
    B["Instance B<br/>独立状态"] --> C
    D["Instance C<br/>独立状态"] --> C
{% endmermaid %}

对象是抽象的主体，类是组织和构造对象的一种机制。没有内置 `class` 语法也能通过闭包和消息传递实现对象；反过来，把所有函数机械地放入类中也不会自动得到好的对象抽象。

一个简单账户同时展示了三者：

```python
class Account:
    interest = 0.02

    def __init__(self, holder):
        self.holder = holder
        self.balance = 0

    def deposit(self, amount):
        self.balance += amount
        return self.balance
```

- `Account` 是类对象；
- `Account('Alice')` 创建一个实例；
- `holder`、`balance` 属于各实例的状态；
- `interest` 和函数 `deposit` 存在于类上，由实例共享。

### 1.2 `class` 语句创建类对象

执行 `class Account: ...` 时，Python 创建类对象，把类体中绑定的名字收集为类属性，最后把当前环境中的名字 `Account` 绑定到这个类对象。

类体里的 `def deposit(...)` 与普通 `def` 一样创建函数对象，区别在于这个函数被存入类的命名空间：

```text
Account class
├── interest  → 0.02
├── __init__  → function
└── deposit   → function
```

函数最初仍是普通函数。它后来通过实例访问时表现为方法，是属性查找和绑定机制产生的结果，而不是 `def` 在类体中创建了另一种函数。

调用 `Account('Alice')` 时，从使用者角度可以先理解成两步：

```text
创建新的 Account 实例
        ↓
用该实例和 'Alice' 调用初始化逻辑
```

教材把 `__init__` 称为 constructor，是为了突出实例创建接口。更精确地说，真实 Python 中 `__new__` 负责返回新实例，`__init__` 负责初始化已经创建的实例；教材的简化对象系统合并了这部分细节。

`self` 也不是关键字，只是约定俗成的第一个形参名。它在方法调用时绑定到哪个实例，由 bound method 机制决定。

这一节说明了实例状态和共享函数分别存在哪里，但还没有解释它们怎样在一次方法调用中连接起来。连接点就是点表达式。

## 2. Dot Expression 把对象、属性与调用连接起来

闭包对象发送消息时写成：

```python
account['deposit'](20)
```

Python 对象系统把同一思想写成点表达式：

```python
account.deposit(20)
```

`deposit` 不是普通环境中的名字，而是针对 `account` 进行属性查找的消息名。点左侧的对象同时承担两种角色：

1. 决定 `deposit` 应该查到哪个属性；
2. 如果查到类中的函数，在调用时成为第一个实参 `self`。

因此，点表达式不是“从结构中取字段”这么简单。它连接了命名空间、查找规则和方法绑定。

要展开 `account.deposit(20)`，第一步是确认属性可能保存在哪里。

## 3. Instance Attribute 与 Class Attribute

实例属性保存单个实例的状态，类属性保存实例共享的默认值或行为。

```python
alice = Account('Alice')
bob = Account('Bob')

alice.balance = 100
Account.interest = 0.03
```

结果是：

```text
alice instance              bob instance
├── holder = 'Alice'        ├── holder = 'Bob'
└── balance = 100           └── balance = 0
          \                  /
           └── Account class
               ├── interest = 0.03
               └── deposit = function
```

`alice.interest` 和 `bob.interest` 都能得到 `0.03`，不是因为每个实例复制了一份 `interest`，而是实例查找失败后继续在类上查找。

如果执行：

```python
alice.interest = 0.08
```

Python 会在 `alice` 上创建同名实例属性，而不是修改 `Account.interest`：

```python
alice.interest    # 0.08，实例属性遮蔽类属性
bob.interest      # 0.03，继续从类上取得
Account.interest  # 0.03
```

读取属性会沿查找链寻找，给实例属性赋值则落在该实例自身；不要把“能从实例读到类属性”误解为“类属性属于实例”。

属性位置明确之后，下一个问题是：当多个位置存在同名属性时，Python 到底选择哪一个？

## 4. Attribute Lookup：Python 怎样选择属性

### 4.1 教材模型：实例优先，类与基类后备

对普通用户自定义方法，教材采用下面的概念模型解释 `obj.attribute`：

{% mermaid %}
flowchart TD
    START["求值 obj.attribute"] --> INSTANCE{"实例属性中存在？"}
    INSTANCE -->|是| VALUE["返回实例属性"]
    INSTANCE -->|否| CLASS{"类中存在？"}
    CLASS -->|否| BASE["沿基类继续查找"]
    BASE --> CLASS
    CLASS -->|普通值| VALUE2["直接返回"]
    CLASS -->|函数| BIND["与 obj 绑定"]
    BIND --> METHOD["返回 bound method"]
{% endmermaid %}

可以把它类比为环境中的名字查找：局部名字优先于外层名字，实例属性优先于类属性。继承则为类的查找增加了更外层的后备空间。

这个过程解释了为什么同名实例属性能够遮蔽类属性，也解释了为什么方法通常只存一份，却能作用在不同实例上。

### 4.2 从 `property` 理解 Descriptor 与真实查找顺序

教材的“先找实例，再找类”适用于普通属性。真实 Python 之所以还需要 descriptor，是因为有些属性不能只负责保存值，还要在读写时执行验证或计算。

假设账户余额不能为负数。直接保存 `self.balance` 无法阻止外部写入非法值；把读取和写入改成方法虽然能验证，但调用会变成 `get_balance()` 和 `set_balance()`。`property` 把两种需求结合起来：外部仍使用属性语法，内部实际执行方法。

```python
class Account:
    def __init__(self):
        self._balance = 0

    def get_balance(self):
        return self._balance

    def set_balance(self, value):
        if value < 0:
            raise ValueError('余额不能为负数')
        self._balance = value

    balance = property(get_balance, set_balance)
```

调用者看到的是普通属性操作：

```python
alice = Account()
alice.balance = 100
alice.balance       # 100
alice.balance = -1  # ValueError
```

Python 实际执行的过程是：

{% mermaid %}
flowchart TB
    subgraph READ["读取 alice.balance"]
      R1["属性查找发现 Account.balance"] --> R2["property.__get__(alice, Account)"]
      R2 --> R3["get_balance(alice)"]
      R3 --> R4["读取 alice._balance"]
    end
    subgraph WRITE["赋值 alice.balance = 100"]
      W1["属性写入发现 Account.balance"] --> W2["property.__set__(alice, 100)"]
      W2 --> W3["set_balance 验证数值"]
      W3 --> W4["写入 alice._balance"]
    end
    R4 -.同一 property 也接管赋值.-> W1
{% endmermaid %}

因此，真正的数据和访问规则位于不同地方：

{% mermaid %}
flowchart LR
    INSTANCE["alice.__dict__<br/>_balance: 100<br/><br/>真正保存数据"]
    CLASS["Account.__dict__<br/>balance: property object<br/><br/>保存访问规则"]
    CLASS -->|__get__ / __set__| INSTANCE
{% endmermaid %}

`@property` 和 `@balance.setter` 只是创建同一种 property 对象的装饰器写法。无论采用哪种语法，核心都是：`_balance` 保存数据，`balance` 是受控的公开入口。

Property 能够接管 `alice.balance`，是因为它实现了 Python 的 **descriptor protocol（描述符协议）**：

实现这些方法并作为类属性存在的对象称为 **descriptor**。如果它定义了 `__set__` 或 `__delete__`，就是 **data descriptor**；property 能控制赋值，因此属于 data descriptor。只定义 `__get__` 的是 **non-data descriptor**，普通类函数就是典型例子，它通过 `__get__` 生成 bound method。

Data descriptor 必须优先于实例字典，否则调用者可以写入同名实例属性，绕过 property 的验证。Non-data descriptor 不控制写入，所以同名实例属性可以遮蔽它。这个差别形成了真实属性查找的优先级：

{% mermaid %}
flowchart TD
    START["读取 obj.name"] --> DATA{"类及 MRO 中<br/>存在 data descriptor？"}
    DATA -->|是| GET["调用 descriptor.__get__"]
    DATA -->|否| DICT{"obj.__dict__ 中存在？"}
    DICT -->|是| IV["返回实例属性"]
    DICT -->|否| CLASS{"类及 MRO 中存在？"}
    CLASS -->|non-data descriptor| BOUND["调用 __get__<br/>例如生成 bound method"]
    CLASS -->|普通属性| CV["返回类属性"]
    CLASS -->|否| FALLBACK{"定义了 __getattr__？"}
    FALLBACK -->|是| GA["调用 __getattr__"]
    FALLBACK -->|否| ERROR["AttributeError"]
{% endmermaid %}

<p class="cp-figure-caption">Data descriptor 排在实例字典之前，正是 property 无法被同名实例属性绕过的原因。</p>

这里的“类及其基类”按照 MRO 依次查找；`object.__getattribute__` 是整套属性读取流程的入口。理解时不必先背这些内部名称，只需抓住主线：**实例保存自己的数据，类可以保存共享值，也可以通过 descriptor 保存访问实例数据的规则。**

属性查找只负责决定“取到哪个值”。如果取到的是类中的函数，还需要下一步把函数与当前实例组合起来。

## 5. Bound Method：属性查找如何把函数与实例绑定

```python
alice = Account('Alice')

Account.deposit       # 类中保存的函数
alice.deposit         # 与 alice 绑定的方法
```

在普通方法情形下：

```python
alice.deposit(20)
```

可以概念性地展开为：

```python
Account.deposit(alice, 20)
```

属性查找发现 `deposit` 是类上的函数，于是生成一个 **bound method（绑定方法）**。它把两部分结合起来：

{% mermaid %}
flowchart LR
    FUNCTION["Account.deposit<br/>类中保存的 function"] --> GET["function.__get__(alice, Account)"]
    INSTANCE["alice<br/>当前实例"] --> GET
    GET --> METHOD["bound method"]
    METHOD --> SELF["__self__ → alice"]
    METHOD --> FUNC["__func__ → Account.deposit"]
    METHOD -->|调用 20| CALL["Account.deposit(alice, 20)"]
{% endmermaid %}

之后调用 bound method 时，绑定的实例自动成为第一个参数，其余显式实参依次进入后面的形参。

Python 可以直接观察这两个组成部分：

```python
method = alice.deposit

method.__self__ is alice             # True
method.__func__ is Account.deposit   # True
```

这说明 `self` 不是从函数体中神秘出现的。它来自点表达式求值得到的绑定方法。

还要区分“取方法”和“调用方法”：

方法可以先保存、之后调用，因为绑定后的对象本身也是值。

方法绑定解释了 `self` 从哪里来；继承则决定这个方法可以从多远的地方找到。

## 6. Inheritance：用继承扩展属性查找链

```python
class CheckingAccount(Account):
    interest = 0.01
    withdraw_fee = 1

    def withdraw(self, amount):
        return Account.withdraw(self, amount + self.withdraw_fee)
```

`CheckingAccount` 没有重新定义 `deposit`，实例仍可通过基类找到它；同名 `interest` 和 `withdraw` 则在子类处提前命中，覆盖基类行为。

```text
checking.deposit
    ↓ 实例中没有
CheckingAccount.deposit
    ↓ 子类中没有
Account.deposit
    ↓ 找到函数
绑定 checking，得到 bound method
```

继承在实现层面是属性查找的复用，在建模层面通常表达 **is-a** 关系：CheckingAccount 是一种 Account。若一个 Bank 保存许多 Account，这是 **has-a** 关系，更自然的方式是让账户集合成为 Bank 的实例属性，而不是让 Bank 继承 Account。

覆盖方法时仍可以显式调用基类实现，再加入子类差异。现代 Python 工程中常用 `super()` 协作调用，教材使用 `Account.withdraw(self, ...)` 是为了让“普通函数 + 显式实例”的关系更直接。

### 6.1 `super()` 沿 MRO 继续查找

`super()` 返回的是一个查找代理。它根据当前方法所在的类和实际实例的 MRO，从“当前类之后”继续查找属性：

{% mermaid %}
flowchart TB
    CALL["super().withdraw(...)"] --> MRO["读取 type(self).__mro__"]
    MRO --> CURRENT["定位当前方法所在类"]
    CURRENT --> NEXT["从下一项开始查找 withdraw"]
    NEXT --> FOUND["找到实现"]
    FOUND --> BIND["仍绑定到同一个 self"]
{% endmermaid %}

在单继承中，这通常表现得像“调用父类方法”；在多重继承中，下一站由 MRO 决定，不一定是源码中直觉上的直接父类。显式写 `Account.withdraw(self, ...)` 会固定目标类，而 `super()` 允许多个类按照 MRO 形成协作链。

要让协作式继承可靠，各层通常需要调用 `super()`，并保持兼容的参数接口。这里不必手算 C3，只需理解 `super()` 的语义是“沿 MRO 继续”，不是“拿到父类实例”。

多重继承需要一致的 MRO 来决定查找顺序，但 C3 算法不是本章主线。真正需要保留的结论是：继承复用的关键机制仍是确定性的属性查找。

到这里，内置对象系统的核心调用链已经完整：属性先被查找，类函数再与实例绑定，继承继续扩展查找范围。教材下一步不是增加新语法，而是把这条链拆回函数、字典与闭包。

## 7. 用函数和字典重建对象系统

### 7.1 为什么要重新实现类和对象

如果只会使用 `class`，属性查找和自动传入 `self` 容易被当作不可拆解的语言魔法。教材接着用函数与字典实现一个简化对象系统，是为了证明：

- 实例可以看成自己的属性表加上所属类；
- 类可以看成共享属性表加上可选基类；
- 点表达式可以还原为发送 `get` 消息；
- 方法绑定可以还原为插入第一个参数的闭包；
- 实例创建可以还原为分配属性表后调用初始化函数。

目标不是替代 Python 内置对象系统，而是把它的核心行为还原成已经学过的抽象工具。

### 7.2 用字典与闭包表示 Instance

实例需要完成两种操作：设置本地属性，以及读取属性。本地没有时，再向所属类查询。

```python
def make_instance(cls):
    attributes = {}

    def get_value(name):
        if name in attributes:
            return attributes[name]
        value = cls['get'](name)
        return bind_method(value, instance)

    def set_value(name, value):
        attributes[name] = value

    instance = {
        'get': get_value,
        'set': set_value,
    }
    return instance
```

结构上是：

```text
Instance dispatch dictionary
├── get(name)
├── set(name, value)
├── 闭包环境中的 attributes
└── 闭包环境中的 cls
```

`set` 总是写入实例自己的 `attributes`；`get` 先查这个字典，失败后才调用 `cls['get']`。这已经复现了实例属性遮蔽类属性的规则。

实例没有直接暴露 `attributes`，外部只能通过 `get` 和 `set` 消息操作它。这是数据抽象屏障在对象系统内部的再次出现。

### 7.3 用闭包实现 Method Binding

教材的绑定函数把查到的可调用值与实例组合起来：

```python
def bind_method(value, instance):
    if callable(value):
        def method(*args):
            return value(instance, *args)
        return method
    return value
```

如果类查找得到 `deposit` 函数，`bind_method` 返回的新函数会在调用时自动把 `instance` 插到实参最前面：

```text
value(amounts...)          原类函数，缺少 self
        +
instance                   当前对象
        ↓
method(amounts...)         已绑定的调用接口
```

于是：

```python
instance['get']('deposit')(20)
```

在简化系统中最终执行：

```python
deposit(instance, 20)
```

这与前面 `obj.method(arg)` 的概念展开完全对应。

教材用 `callable` 判断是否绑定，是教学模型的简化。真实 Python 不会把所有 callable 属性都自动当作实例方法，而是让属性对象的 descriptor 行为决定访问结果。

### 7.4 用字典表示 Class 与 Inheritance

类需要共享属性、沿基类查找，以及创建新实例：

```python
def make_class(attributes, base_class=None):
    def get_value(name):
        if name in attributes:
            return attributes[name]
        if base_class is not None:
            return base_class['get'](name)
        return None

    def set_value(name, value):
        attributes[name] = value

    def new(*args):
        return init_instance(cls, *args)

    cls = {
        'get': get_value,
        'set': set_value,
        'new': new,
    }
    return cls
```

类的 `get` 与实例的 `get` 查找方向不同：

{% mermaid %}
flowchart LR
    INSTANCE["Instance.get(name)"] --> IA{"instance attributes"}
    IA -->|命中| VALUE["返回本地值"]
    IA -->|未命中| CLASS["Class.get(name)"]
    CLASS --> CA{"class attributes"}
    CA -->|命中普通函数| BIND["bind_method(function, instance)"]
    CA -->|命中其他值| VALUE2["返回类属性"]
    CA -->|未命中| BASE["Base Class.get(name)"]
    BASE --> CA
{% endmermaid %}

`new` 创建实例并执行初始化：

```python
def init_instance(cls, *args):
    instance = make_instance(cls)
    init = cls['get']('__init__')
    if init is not None:
        init(instance, *args)
    return instance
```

这里直接调用查到的 `__init__` 函数，并显式传入新实例。完整流程是：

```text
cls['new'](*args)
    ↓
make_instance(cls)
    ↓
cls['get']('__init__')
    ↓
init(instance, *args)
    ↓
return instance
```

### 7.5 用账户串起完整调用过程

```python
def make_account_class():
    interest = 0.02

    def __init__(self, holder):
        self['set']('holder', holder)
        self['set']('balance', 0)

    def deposit(self, amount):
        balance = self['get']('balance') + amount
        self['set']('balance', balance)
        return balance

    return make_class(locals())
```

```python
Account = make_account_class()
alice = Account['new']('Alice')

alice['get']('holder')       # 'Alice'
alice['get']('interest')     # 0.02，从类查到
alice['get']('deposit')(20)  # 20，查找后完成方法绑定
```

最后一次调用可以逐层展开：

```text
alice['get']('deposit')
    ↓ 实例 attributes 中没有
Account['get']('deposit')
    ↓ 类 attributes 中找到函数
bind_method(deposit, alice)
    ↓
bound method(20)
    ↓
deposit(alice, 20)
```

这段实现把前面分散的概念连成了一个运行过程：抽象接口是 `get/set/new`，局部状态存储属性，消息查找选择行为，闭包完成方法绑定，基类形成递归后备链。

## 8. 教材模型与真实 Python 的边界

两者有重要的结构相似性：普通用户实例往往有 `__dict__` 保存本地属性，类保存共享属性，读取属性可能沿继承链查找，函数经实例访问会形成 bound method。

但不能据此声称 CPython 内部就是教材这几段字典代码。教材明确省略了：

- 元类以及“类也是 `type` 的实例”；
- descriptor protocol 与完整属性优先级；
- `__new__`、对象内存分配和生命周期；
- static method、class method；
- 多重继承与完整 MRO；
- 特殊方法的隐式查找规则；
- slots、内建类型布局和 CPython 优化。

教材实现的意义是行为分解，不是源码复刻：只要能用更简单的构件复现一组关键可观察行为，就能看出 class 和 object 不是不可分析的概念原子。

## 9. 什么时候使用对象，什么时候使用函数

对象适合下列问题：

- 存在多个需要独立演化的实体；
- 操作围绕同一份长期状态组织；
- 对象之间会通过明确接口交互；
- 多个实例需要共享行为；
- 问题中存在稳定的类型或协议边界。

普通函数更适合：

- 逻辑主要描述输入到输出的关系；
- 不需要跨调用保存身份和状态；
- 操作可以独立组合，不必依附某个实体；
- 引入类只会增加命名空间和间接层。

面向对象的价值不在于把代码都放进类，而在于让状态所有权、行为边界和协作关系与问题结构相匹配。Python 是多范式语言，函数抽象与对象抽象可以各自负责最适合的部分。

## 10. 用一条调用链收束全文

现在可以完整展开最初的问题：`alice.deposit(20)` 到底怎样运行？

{% mermaid %}
sequenceDiagram
    participant C as 调用者
    participant A as alice
    participant K as Account / MRO
    participant D as function.__get__
    C->>A: alice.deposit
    A->>A: 实例属性中查找 deposit
    A->>K: 未命中，沿类与 MRO 查找
    K-->>A: Account.deposit function
    A->>D: __get__(alice, Account)
    D-->>C: bound method
    C->>A: bound_method(20)
    A->>A: 执行 Account.deposit(alice, 20)
    A-->>C: 修改并返回 alice.balance
{% endmermaid %}

这条链把全文的概念放回各自位置：实例保存独立状态，类保存共享行为，属性查找选择具体实现，descriptor 决定访问结果，bound method 自动插入实例，继承与 MRO 扩展查找范围。

最后保留几组容易混淆但需要能够直接判断的边界：

| 辨析 | 关键判断 |
|---|---|
| 对象与类 | 对象是具有状态、身份和行为的实体；类负责创建实例、共享行为并参与属性查找。 |
| 类函数与 bound method | 函数存储在类上；经实例访问并完成绑定后，`obj.method` 才是 bound method。 |
| 读取与写入类属性 | 实例可以通过后备查找读到类属性；`obj.name = value` 通常写入实例自身。 |
| 继承方法与当前实例 | 方法即使从基类找到，也仍绑定到点表达式左侧的当前实例。 |
| 显式基类调用与 `super()` | `Base.method(self)` 固定目标；`super()` 从当前类之后沿实际 MRO 继续查找。 |
| 教材绑定与真实 Python | 教材用 `callable` 和闭包解释参数插入；真实 Python 由 descriptor protocol 决定绑定。 |
| 继承与组合 | 继承通常表达 is-a 并扩展查找链；组合表达 has-a，把协作对象放入实例状态。 |
| 对象与函数 | 对象适合身份和长期状态；无状态的输入—输出转换通常保留为普通函数。 |

一句话总结：**Python 对象调用的核心是“实例保存状态、类共享行为、属性查找选择实现、方法绑定插入实例”；函数和字典能够复现这条链，说明对象系统是由更基础机制组合出来的抽象。**

## 参考

- [Composing Programs 2.5：Object-Oriented Programming](https://www.composingprograms.com/pages/25-object-oriented-programming.html)
- [Composing Programs 2.6：Implementing Classes and Objects](https://www.composingprograms.com/pages/26-implementing-classes-and-objects.html)
- [Python 文档：Descriptor HowTo Guide](https://docs.python.org/3/howto/descriptor.html)
- [Python 文档：Classes — Multiple Inheritance and MRO](https://docs.python.org/3/tutorial/classes.html#multiple-inheritance)
