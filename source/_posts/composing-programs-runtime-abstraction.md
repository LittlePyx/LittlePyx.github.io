---
title: 运行时如何支持抽象：环境、闭包、作用域与安全执行
date: 2026-08-27 12:00:00
top_img: /img/composing-programs-runtime-abstraction-nature-cover.jpg
cover: /img/composing-programs-runtime-abstraction-nature-cover.jpg
cover_credit: "Brian J. Skerry · National Geographic"
cover_source: "https://www.nationalgeographic.com/photography/article/wildlife-photo-gallery"
description: Composing Programs 第三章笔记之三：沿着用户函数从定义到调用的完整路径，理解 Environment、Closure 和 Lexical Scope，再扩展到执行预算、能力边界、安全隔离与可观测性。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Interpreter
  - Closure
  - Runtime
toc: true
toc_number: false
katex: false
---

前两篇已经让 MiniExpr 能够把源码解析成 AST，并通过 Eval、Apply 和 Primitive 计算组合表达式。不过，语言中的所有操作仍由解释器预先注册：用户可以组合 `add` 和 `mul`，却不能给结果命名，也不能定义自己的函数。

本篇只沿着一个核心问题展开：**当用户定义并调用一个函数时，运行时究竟需要保存什么，又怎样找到函数体中的名字？**

我们会依次走过一条完整路径：

```text
Lambda AST
    → UserProcedure
    → Define 建立绑定
    → Apply 创建调用环境
    → Closure 决定名字查找路径
    → ExecutionContext 限制执行能力
```

前半部分解释函数、环境与作用域，后半部分再讨论工程中的权限、预算、隔离和观测。本文受教材 [3.5 Interpreters for Languages with Abstraction](https://www.composingprograms.com/pages/35-interpreters-for-languages-with-abstraction.html) 启发，但示例和工程边界围绕一个小型 Python 解释器重新组织。

## 1. 从组合已有操作，到定义新操作

当前语言能够写：

```text
(add 1 (mul 2 3))
```

这属于 **means of combination（组合手段）**：把已有操作拼成更复杂的计算。

真正的抽象还要求用户能够创造新的名字和操作：

```text
(define square
  (lambda (x)
    (mul x x)))

(square 5)
```

为了让这段程序得到 `25`，运行时必须回答四个问题：

| 问题 | 运行时机制 |
|---|---|
| `square` 和 `x` 保存在哪里？ | Environment |
| Lambda 求值后得到什么？ | UserProcedure |
| 调用时参数 `5` 怎样变成局部变量 `x`？ | 新的调用 Frame |
| 函数体中的外层名字去哪里查找？ | Closure 与 Lexical Scope |

这四个机制不是彼此独立的知识点，而是同一次函数调用的不同阶段。

## 2. Environment 让名字获得上下文

名字本身只是字符串。`x` 当前表示 `5`、`100`，还是根本不存在，取决于求值时所在的 **Environment（环境）**。

### 2.1 Frame 保存一层绑定，parent 连接外层

最简单的名字表可以是字典：

```python
names = {
    "add": Primitive(...),
    "x": 10,
}
```

但函数调用需要局部作用域：每次调用都要拥有自己的参数，同时仍能访问外层名字。运行时因此把环境组织成一串相连的 **Frame（环境帧）**：

{% mermaid %}
flowchart LR
    CURRENT["当前 Frame<br/>x = 2"] -->|parent| OUTER["外层 Frame<br/>rate = 0.8"]
    OUTER -->|parent| GLOBAL["全局 Frame<br/>add = Primitive · x = 10<br/>parent = None"]
{% endmermaid %}

<p class="cp-figure-caption">查找从当前 Frame 开始；本层没有对应名字时，才沿 parent 继续向外。</p>

一个最小实现如下：

```python
from dataclasses import dataclass, field

_MISSING = object()


@dataclass(slots=True)
class Environment:
    bindings: dict[str, object] = field(default_factory=dict)
    parent: "Environment | None" = None

    def define(self, name: str, value: object) -> None:
        self.bindings[name] = value

    def lookup(self, name: str) -> object:
        environment: Environment | None = self

        while environment is not None:
            value = environment.bindings.get(name, _MISSING)
            if value is not _MISSING:
                return value
            environment = environment.parent

        raise NameResolutionError(f"未定义的名字：{name}")

    def child(self, bindings: dict[str, object]) -> "Environment":
        return Environment(bindings=bindings, parent=self)
```

这里不能用 `dict.get(name)` 返回的 `None` 表示“没有找到”，因为 `None` 本身也可能是合法值，所以需要单独的 `_MISSING` 标记。

### 2.2 `define` 写当前层，`lookup` 沿链向外读

两种操作的方向不同：

```text
define(name, value)
    → 只在当前 Frame 建立或更新绑定

lookup(name)
    → 从当前 Frame 开始，沿 parent 向外查找
```

例如：

```text
local frame:  x = 2
    ↓ parent
global frame: x = 10, add = Primitive(...)
```

在 local frame 中查找 `x` 得到 `2`；查找 `add` 时，本层没有，于是到 global frame 找到 Primitive。局部 `x` 会 **shadow（遮蔽）** 外层 `x`，但外层绑定仍然存在。

至此，Environment 只解决了“名字怎样找到值”。接下来还需要让函数本身成为一种可以被保存的值。

## 3. 函数的诞生：Lambda 变成 UserProcedure

`lambda` 不是一次函数调用，而是“创建函数”的语法。创建时不能立即执行函数体，因此 Parser 必须把它保留为独立 AST 节点。

### 3.1 抽象形式必须保留自己的 AST 结构

MiniExpr 至少需要新增 `Lambda` 和 `Define`：

```python
@dataclass(frozen=True, slots=True)
class Lambda:
    parameters: tuple[str, ...]
    body: "Expr"


@dataclass(frozen=True, slots=True)
class Define:
    name: str
    value: "Expr"
```

它们不能被当作普通 Call：

| 形式 | 不能使用普通调用规则的原因 |
|---|---|
| `lambda` 的 parameters | 是参数声明，不是需要 lookup 的变量引用 |
| `lambda` 的 body | 创建函数时只保存，调用函数时才执行 |
| `define` 的 name | 是准备建立的名字，不能先求值 |

上一篇中的 `if` 同理：它只求值被选中的分支。**Special Form（特殊形式）之所以特殊，是因为它拥有自己的求值顺序。**

### 3.2 Eval Lambda 只创建函数，不执行函数体

Lambda 求值后得到一个运行时函数对象：

```python
@dataclass(slots=True)
class UserProcedure:
    parameters: tuple[str, ...]
    body: "Expr"
    closure: Environment
```

三个字段分别保存：

```text
parameters  调用时怎样接收实参
body        调用后执行哪棵 AST
closure     body 中的外层名字到哪里查找
```

Evaluator 的规则很短：

```python
if isinstance(expr, Lambda):
    return UserProcedure(
        parameters=expr.parameters,
        body=expr.body,
        closure=environment,
    )
```

{% mermaid %}
flowchart LR
    LAMBDA["Lambda AST<br/>parameters + body"] --> BUILD["Eval Lambda"]
    ENV["当前 Environment"] --> BUILD
    BUILD --> PROC["UserProcedure<br/>parameters<br/>body AST<br/>closure → 当前环境"]
{% endmermaid %}

<p class="cp-figure-caption">Eval Lambda 不执行 body，只把代码和当前环境组合成可调用的函数值。</p>

这里保存的当前环境就是函数的 **defining environment（定义环境）**。代码与定义环境组合在一起，构成 closure 的基础。

### 3.3 Define 再把函数值绑定到名字

对下面的程序：

```text
(define square
  (lambda (x)
    (mul x x)))
```

Evaluator 先求值右侧 Lambda，再建立名字绑定：

```python
if isinstance(expr, Define):
    value = evaluate(expr.value, environment, context)
    environment.define(expr.name, value)
    return value
```

完整顺序是：

```text
Lambda AST
    → Eval Lambda
    → UserProcedure
    → define("square", procedure)
```

因此 `define` 和 `lambda` 不要混成一个动作：Lambda 负责**产生函数值**，Define 负责**给这个值建立名字**。匿名函数只需要前者，具名函数同时使用两者。

## 4. 函数的调用：Apply 创建新的环境

现在执行：

```text
(square 5)
```

Eval 仍遵守普通 Call 的规则：

```text
Eval Name("square")  → UserProcedure
Eval Number(5)       → 5
Apply procedure to [5]
```

变化发生在 Apply。Primitive 直接调用受控的 Python 实现；UserProcedure 则需要创建调用环境，再回到 Eval 执行函数体。

```python
def apply_procedure(procedure, arguments, context):
    if isinstance(procedure, Primitive):
        return apply_primitive(procedure, arguments, context)

    if isinstance(procedure, UserProcedure):
        if len(arguments) != len(procedure.parameters):
            raise ArityError("用户函数的参数数量不匹配")

        bindings = dict(zip(procedure.parameters, arguments))
        call_environment = procedure.closure.child(bindings)
        return evaluate(
            procedure.body,
            call_environment,
            context,
        )

    raise EvaluationError("调用位置得到的不是过程")
```

{% mermaid %}
flowchart LR
    EVAL["① Eval Call<br/>square → UserProcedure<br/>5 → 5"]
    EVAL --> APPLY["② Apply UserProcedure<br/>创建调用 Environment<br/>x = 5 · parent = closure"]
    APPLY --> BODY["③ Eval body<br/>mul x x<br/><b>得到 25</b>"]
{% endmermaid %}

最关键的一行是：

```python
call_environment = procedure.closure.child(bindings)
```

它同时完成两件事：

1. 将形参 `x` 与实参值 `5` 写入新的 Frame；
2. 让新 Frame 的 parent 指向函数保存的定义环境。

第二点决定了函数体中的外层名字怎样查找，也就是下一节的闭包与作用域问题。

### 4.1 Eval 与 Apply 为什么会互相递归

用户函数的 body 仍然是一棵 AST，所以 Apply UserProcedure 需要再次调用 Eval；如果 body 中还有 Call，Eval 又会再次调用 Apply：

{% mermaid %}
flowchart LR
    EVAL["Eval Call"] --> APPLY["Apply UserProcedure"]
    APPLY --> FRAME["创建调用 Environment"]
    FRAME --> BODY["Eval procedure.body"]
    BODY -->|body 中还有 Call| EVAL
    BODY -->|基础表达式| VALUE["Runtime value"]
    APPLY -->|Primitive| HOST["受控宿主实现"]
{% endmermaid %}

递归不会无限发生，因为存在两类终点：

```text
Eval 的终点：Number 等可以直接得到值的表达式
Apply 的终点：Primitive 直接调用宿主实现
```

用户函数并没有脱离解释器运行；函数体始终由相同的求值规则解释，只是换到了新的 Environment。

## 5. Closure 决定函数体怎样找到外层名字

普通 `square` 只使用参数，看不出 closure 的必要性。下面的 `make-adder` 会返回一个仍然引用外层参数 `x` 的函数：

```text
(define make-adder
  (lambda (x)
    (lambda (y)
      (add x y))))

(define add3 (make-adder 3))
(add3 10)
```

### 5.1 `make-adder` 返回后，`x` 为什么还存在

调用 `(make-adder 3)` 时创建 `f1`，其中保存 `x = 3`。函数体是另一个 Lambda；求值它会创建 `add3`，并把当前环境 `f1` 保存为 closure。

随后调用 `(add3 10)`，又创建 `f2`，其中保存 `y = 10`，而它的 parent 指向 `add3.closure`，也就是 `f1`：

{% mermaid %}
flowchart LR
    CALL["调用 add3(10)"] --> F2["frame f2<br/>y = 10"]
    F2 -->|"parent = add3.closure"| F1["frame f1<br/>x = 3"]
    F1 -->|parent| GLOBAL["global frame<br/>add = Primitive"]
    ADD3["add3<br/>body: add(x, y)"] -.closure.-> F1
{% endmermaid %}

<p class="cp-figure-caption">add3 持有对 f1 的引用，因此 make-adder 返回后，保存 x = 3 的环境仍然可达。</p>

求值函数体 `(add x y)` 时：

```text
lookup y：  f2 找到 10
lookup x：  f2 没有 → f1 找到 3
lookup add：f2 没有 → f1 没有 → global 找到 Primitive(add)
Apply add to [3, 10] → 13
```

因此可以把闭包压缩为：

```text
Closure = Function Code + Defining Environment
```

Closure 不是把外层变量文本替换进函数体，也不一定复制所有值。它通常保存对环境对象的引用；只要函数还引用这个环境，环境就不能被回收。

### 5.2 Lexical Scope 看定义位置，不看调用位置

考虑：

```text
(define x 100)

(define read-x
  (lambda () x))

(define call-with-local-x
  (lambda (x) (read-x)))

(call-with-local-x 1)
```

`read-x` 定义在 global，因此它的 closure 指向 global。即使调用者恰好有一个局部 `x = 1`，词法作用域仍然得到 `100`。

{% mermaid %}
flowchart LR
    CALL["调用 read-x"] --> CHOICE{"新调用帧的 parent<br/>指向哪里？"}
    CHOICE --> LEXICAL["词法作用域 · 看定义位置<br/>parent = procedure.closure<br/>global frame · x = 100<br/><b>read-x 返回 100</b>"]
    CHOICE --> DYNAMIC["动态作用域 · 看调用位置<br/>parent = caller environment<br/>调用者 frame · x = 1<br/><b>read-x 返回 1</b>"]
    class LEXICAL cp-path-good
    class DYNAMIC cp-path-bad
{% endmermaid %}

<p class="cp-figure-caption">parent 指向定义时保存的 closure，查到 x = 100；指向当前调用者环境，则查到 x = 1。</p>

如果 Apply 错误地把调用者环境设为 parent，MiniExpr 就会从 lexical scope 变成 dynamic scope。可见作用域不是字典查找的实现细节，而是语言语义的一部分。

### 5.3 递归函数也依赖环境查找

递归定义看似特殊，实际仍然使用同一套机制：

```text
(define factorial
  (lambda (n)
    (if (eq n 0)
        1
        (mul n (factorial (sub n 1))))))
```

Lambda 创建时保存 global frame；随后 Define 把 `factorial` 绑定到这个 global frame。函数体再次查找 `factorial` 时，沿 closure 就能找到自己：

```text
UserProcedure.closure ──> global frame
                              └── factorial ──> UserProcedure
```

这不是单独的“递归魔法”，而是函数对象与 Environment 形成的引用关系。

## 6. 受控解释器决定程序能够表达和执行什么

到这里，MiniExpr 已经支持用户函数。接下来的问题不再是“怎样算出结果”，而是“允许用户程序影响什么”。

### 6.1 程序成为 AST 后，可以先分析再执行

解释器看到的不是一段必须立刻运行的神秘代码，而是一棵数据树：

```text
用户视角：表达式描述要完成的计算
解释器视角：AST 是等待校验和遍历的数据
```

执行前可以完成：

- 检查禁止节点和未知操作；
- 限制 AST 深度、宽度和节点总数；
- 校验参数结构；
- 收集即将使用的能力；
- 将多种输入语法规范化为统一 IR；
- 插入追踪或预算检查。

不过，AST 可分析不等于天然安全。真正的能力边界还取决于 Evaluator 支持哪些节点，以及 Primitive Registry 暴露哪些宿主操作。

### 6.2 Primitive Registry 是显式能力白名单

自定义解释器只执行主动实现的语义：

```text
AST 节点白名单
    决定用户程序能表达哪些结构

Primitive Registry
    决定程序能调用哪些宿主能力
```

一个仅注册 `add`、`mul` 的解释器不能凭空访问文件或网络；一旦注册了 `http_request`、数据库写入等 Primitive，就必须为这些能力单独设计权限、超时、重试和审计。

### 6.3 不要用 Python `eval` 代替受控解释器

Python 的 `eval()` 按照 Python 语义执行字符串：

```python
eval("2 + 2")  # 4
```

面对不可信输入，它会绕开 MiniExpr 的 AST 类型和 Primitive Registry。删掉部分 `globals`、修改 `__builtins__` 或增加 AST 黑名单，都不能自动形成可靠沙箱。

`ast.literal_eval()` 只接受 Python 字面量和容器，不执行任意函数调用或名字查找，适合解析受限数据；但巨大或极深的输入仍可能消耗大量内存、CPU 或栈空间。

如果必须执行不可信 Python 代码，需要独立进程或容器、操作系统权限、文件和网络限制以及资源配额。自定义解释器的优势，是从语言设计层面主动缩小可表达和可调用的能力集合。

## 7. 工程运行时还要管理预算、权限与观测

Environment 保存的是**被解释程序可见的名字**。数据库连接、超时、权限和 trace id 属于解释器自身，不应伪装成普通语言变量。

### 7.1 Environment 与 ExecutionContext 分工

```text
Environment
    名字绑定 · parent 链 · 词法作用域

ExecutionContext
    执行预算 · deadline · capability · trace
```

Registry 描述平台**总共支持哪些能力**，ExecutionContext 则描述**这一次执行获准使用其中哪些能力**。前者通常是全局配置，后者随请求或任务创建。

一个简单的 ExecutionContext 可以这样实现：

```python
from dataclasses import dataclass
from time import monotonic


@dataclass(slots=True)
class ExecutionContext:
    remaining_steps: int
    deadline: float
    trace_id: str
    capabilities: dict[str, object]

    def tick(self) -> None:
        self.remaining_steps -= 1
        if self.remaining_steps < 0:
            raise ResourceLimitError("执行步数超过限制")
        if monotonic() > self.deadline:
            raise ResourceLimitError("执行超时")
```

Evaluator 每处理一个节点就消耗一步预算：

```python
def evaluate(expr, environment, context):
    context.tick()
    ...
```

分开设计后，用户可以在 Environment 中定义名为 `deadline` 的普通变量，却无法覆盖解释器真正使用的 deadline 或数据库连接。

### 7.2 安全执行是多层限制，不是一个开关

{% mermaid %}
flowchart LR
    INPUT["① 输入与语义边界<br/>字符 · Token<br/>AST 规模 · 节点<br/>参数 schema"]
    INPUT --> COMPUTE["② 解释器资源边界<br/>步数 · 调用深度<br/>超时 · 输出大小<br/>内存预算"]
    COMPUTE --> CAPABILITY["③ 宿主能力边界<br/>文件 · 网络<br/>数据库 · 进程<br/>权限 · 审计"]
    CAPABILITY --> ISOLATION["④ 操作系统隔离<br/>独立进程 · 容器<br/>受限账户<br/>资源配额"]
{% endmermaid %}

<p class="cp-figure-caption">限制从语言输入一直延伸到宿主系统；越接近外部副作用，越需要更强的边界。</p>

几个常见误区：

- AST 白名单只能限制“表达什么”，不能约束已注册 Primitive 内部的行为；
- `context.tick()` 只能在解释器重新取得控制权时检查超时，无法中断阻塞中的外部 I/O；
- Python 线程等待超时，不代表底层任务已经停止；
- 只限制递归深度，挡不住很宽但不深的巨大 AST；
- 只限制运行时间，挡不住短时间内大量占用内存。

外部操作需要自己的超时和取消机制；需要强隔离时，应把执行放进可以终止并回收的独立进程或容器。

### 7.3 可观测性记录语义事件，而不是泄露全部数据

比“执行失败”更有用的是结构化事件：

```text
trace_id
node_type
source_span
operation_name
duration_ms
status
error_code
```

一次调用可以形成：

```text
Eval Call(add) start
├── Eval Name(add) success
├── Eval Number(1) success
├── Eval Call(mul) start
│   └── Apply Primitive(mul) success: 6
└── Apply Primitive(add) success: 7
```

日志应记录阶段、操作和耗时，不应默认保存完整提示词、凭据或敏感返回值。用户程序错误与解释器缺陷也要分开：

| 类型 | 示例 | 处理方式 |
|---|---|---|
| 用户程序错误 | 未知名字、参数数量错误、预算耗尽 | 返回稳定错误码和安全提示 |
| 解释器自身缺陷 | 漏处理 AST 节点、状态损坏、意外异常 | 记录 traceback，对外返回通用内部错误 |

若用 `except Exception` 把所有异常都变成“执行失败”，表面上更统一，实际会丢失定位解释器缺陷所需的因果链。

## 8. 把一次完整执行路径串起来

现在可以把全文收束成一条从源码到受控副作用的路径：

{% mermaid %}
flowchart TB
    INPUT["Source → Parser → AST / IR"] --> CORE["Eval ↔ Apply"]
    SUPPORT["运行时支撑<br/>Environment · Procedure · ExecutionContext"] --> CORE
    CORE --> VALUE["Runtime Value"]
    CORE --> REGISTRY["Capability Registry"]
    REGISTRY --> EXTERNAL["External Systems"]
{% endmermaid %}

这条路径中，各组件各自回答一个问题：

| 组件 | 核心职责 |
|---|---|
| Parser / Validator | 程序结构是否合法 |
| Environment | 某个名字当前绑定到什么值 |
| UserProcedure / Closure | 函数执行什么代码，外层名字去哪里找 |
| Eval / Apply | 表达式和过程怎样得到结果 |
| ExecutionContext | 本次执行拥有多少预算和哪些权限 |
| Capability Registry | 哪些宿主操作可以真正触达外部系统 |

最终需要保留五个判断：

1. **Environment 是一条 Frame 链**：当前层保存局部绑定，parent 提供外层可见名字；
2. **Lambda 先产生函数值，Define 再建立名字**：创建函数和命名函数是两个阶段；
3. **Closure = 函数代码 + 定义环境**：它让函数离开定义位置后仍能解析自由变量；
4. **Apply 用户函数时，调用 Frame 的 parent 指向 closure**：这条连接实现 lexical scope；
5. **抽象能力与执行能力必须分层**：Environment 管理语言名字，ExecutionContext 和 Registry 管理预算、权限与宿主副作用。

解释器最值得学习的不是括号语法，而是这些机制怎样相互咬合：AST 保留程序结构，Eval 和 Apply 赋予结构含义，Environment 赋予名字上下文，Closure 固定作用域，而宿主运行时负责划定执行能力的边界。

## 参考

- [Composing Programs 3.5：Interpreters for Languages with Abstraction](https://www.composingprograms.com/pages/35-interpreters-for-languages-with-abstraction.html)
- [Python 语言参考：Execution model](https://docs.python.org/3/reference/executionmodel.html)
- [Python 文档：`eval`](https://docs.python.org/3/library/functions.html#eval)
- [Python 文档：`ast.literal_eval`](https://docs.python.org/3/library/ast.html#ast.literal_eval)
