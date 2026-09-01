---
title: 运行时如何支持抽象：环境、闭包、作用域与安全执行
date: 2026-08-27 12:00:00
top_img: /img/composing-programs-runtime-abstraction-nature-cover.jpg
cover: /img/composing-programs-runtime-abstraction-nature-cover.jpg
cover_credit: "Brian J. Skerry · National Geographic"
cover_source: "https://www.nationalgeographic.com/photography/article/wildlife-photo-gallery"
description: Composing Programs 第三章笔记之三：从名字绑定、Frame 和词法作用域出发实现用户函数与闭包，再扩展到执行预算、能力白名单、安全隔离与可观测性。
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

前两篇已经让 MiniExpr 能够把源码解析成 AST，并通过 Eval、Apply 和 Primitive 计算组合表达式。但所有操作仍由解释器预先注册，用户不能给值命名，也不能定义自己的函数。

本篇受教材 [3.5 Interpreters for Languages with Abstraction](https://www.composingprograms.com/pages/35-interpreters-for-languages-with-abstraction.html) 启发，重点不在复刻 Scheme 项目，而在说明：**运行时怎样用环境保存绑定，用函数对象保存代码与定义环境，并在受控边界内执行用户程序。**

## 1. 组合能力还不是抽象能力

当前语言能够写：

```text
(add 1 (mul 2 3))
```

这属于 **means of combination（组合手段）**：已有操作可以嵌套成更复杂的计算。

但下面的需求还无法表达：

```text
把 10 命名为 tax
定义 square
定义一个能够创建新函数的 make-adder
```

要获得 **means of abstraction（抽象手段）**，语言至少需要：

```text
名字绑定        name → value
函数表示        parameters + body + defining environment
函数调用        arguments → new frame
作用域规则      在哪里查找自由变量
```

这里会重新连接前两章的概念：环境保存名字绑定，函数是一种运行时值，闭包把代码与环境组合，对函数的 Apply 又会触发新一轮 Eval。

## 2. Environment 保存名字与值的关系

最简单的名字表是字典：

```python
names = {
    "add": Primitive(...),
    "x": 10,
}
```

但函数调用需要局部作用域。每次调用都应得到自己的参数绑定，同时仍然能够访问外层名字。运行时因此使用一串相连的 **Frame（环境帧）**：

```text
current frame
├── 本层 bindings
└── parent ──> enclosing frame
                    ├── bindings
                    └── parent ──> ...
```

可以把它实现为：

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

这里使用 `_MISSING`，而不是 `dict.get(name)` 返回的 `None`，因为 `None` 也可能是一个合法绑定值。

### 2.1 `define` 与 `lookup` 的方向不同

```text
define(name, value)
    只在当前 frame 建立或更新绑定

lookup(name)
    从当前 frame 开始，沿 parent 向外查找
```

假设环境是：

```text
local frame:  x = 2
    ↓ parent
global frame: x = 10, add = Primitive(...)
```

在 local frame 中查找 `x` 得到 2；查找 `add` 时本层没有，于是到 global frame 得到 Primitive。局部绑定会 **shadow（遮蔽）** 同名外层绑定，但不会删除或修改外层字典。

### 2.2 Environment 不等于所有运行时状态

Environment 专门回答“某个语言名字绑定到什么值”。数据库连接、权限、超时、追踪器和请求标识不应该全部伪装成用户可见变量塞进同一个字典。

后面会把两者分开：

```text
Environment       → 语言级名字与值
ExecutionContext  → 解释器级服务、权限、预算和观测信息
```

## 3. AST 必须为抽象形式保留结构

给 MiniExpr 增加三种 AST 节点：

```python
@dataclass(frozen=True, slots=True)
class Define:
    name: str
    value: Expr

@dataclass(frozen=True, slots=True)
class Lambda:
    parameters: tuple[str, ...]
    body: Expr

@dataclass(frozen=True, slots=True)
class If:
    condition: Expr
    consequent: Expr
    alternative: Expr
```

最终的表达式联合类型也要同步扩展：

```python
from typing import TypeAlias

Expr: TypeAlias = Number | Name | Call | If | Define | Lambda
```

Parser 看到以下结构时，不再生成普通 Call：

```text
(define x 10)
(lambda (x) (mul x x))
(if condition consequent alternative)
```

原因不是它们的名字比较特别，而是其组成部分不能按照普通实参规则求值：

```text
define 的 name       是即将建立绑定的名字，不能先 lookup
lambda 的 parameters 是参数声明，不是变量引用
lambda 的 body       创建函数时不能立即执行
if 的两个分支        只能执行被选中的一个
```

将这些形式解析为独立 AST 节点，可以把结构校验放在 Parser/Validator，把求值差异明确保留给 Evaluator。

## 4. Lambda 求值得到一个函数对象

函数定义不是立即执行函数体，而是创建一个可以稍后调用的运行时值：

```python
@dataclass(slots=True)
class UserProcedure:
    parameters: tuple[str, ...]
    body: Expr
    closure: Environment
```

三个字段分别回答：

```text
parameters  调用时怎样接收实参
body        调用后执行哪段 AST
closure     body 中的自由变量到哪里查找
```

Evaluator 对 Lambda 的处理很短：

```python
if isinstance(expr, Lambda):
    return UserProcedure(
        parameters=expr.parameters,
        body=expr.body,
        closure=environment,
    )
```

此时没有求值 `body`。Evaluator 只是把当前环境保存到函数对象中，这个环境称为函数的 **defining environment（定义环境）**。

```text
Lambda AST + 当前 Environment
              ↓ evaluate
UserProcedure(parameters, body, closure)
```

这就是闭包机制的基础：代码离开定义位置后，仍然携带解释自由变量所需的环境。

## 5. Define 建立名字绑定

```text
(define square (lambda (x) (mul x x)))
```

对应求值规则：

```python
if isinstance(expr, Define):
    value = evaluate(expr.value, environment, context)
    environment.define(expr.name, value)
    return value
```

执行顺序是：

```text
Eval Lambda
    ↓
得到 UserProcedure
    ↓
在当前 Environment 中绑定 square → UserProcedure
```

`define` 改变了当前环境，所以它不是完全纯粹的表达式。后续 `lookup("square")` 能得到刚创建的函数对象，程序的执行历史开始影响可见绑定。

## 6. Apply 用户函数时创建调用环境

调用：

```text
(square 5)
```

Eval 仍然按照普通 Call 的规则工作：

```text
Eval operator Name("square") → UserProcedure
Eval argument Number(5)      → 5
Apply UserProcedure to [5]
```

Apply 增加用户函数分支：

```python
def apply_procedure(procedure, arguments, context):
    if isinstance(procedure, Primitive):
        return apply_primitive(procedure, arguments, context)

    if isinstance(procedure, UserProcedure):
        if len(arguments) != len(procedure.parameters):
            raise ArityError("用户函数的参数数量不匹配")

        bindings = dict(zip(procedure.parameters, arguments))
        call_environment = procedure.closure.child(bindings)
        return evaluate(procedure.body, call_environment, context)

    raise EvaluationError("调用位置得到的不是过程")
```

最关键的一行是：

```python
call_environment = procedure.closure.child(bindings)
```

新 Frame 的 parent 是函数保存的**定义环境**，不是当前调用者的环境。这条选择实现了 **lexical scope（词法作用域）**。

## 7. 闭包让定义环境在函数返回后继续存在

使用一个更能说明问题的例子：

```text
(define make-adder
  (lambda (x)
    (lambda (y)
      (add x y))))

(define add3 (make-adder 3))
(add3 10)
```

### 7.1 调用 `make-adder`

```text
global frame
└── make-adder → UserProcedure(closure=global)

调用 (make-adder 3)
        ↓
创建 frame f1
├── x = 3
└── parent → global
```

函数体是另一个 Lambda。求值它时创建新的 UserProcedure，并把当前环境 `f1` 保存为 closure：

```text
add3 → UserProcedure
       ├── parameters: (y)
       ├── body: (add x y)
       └── closure → f1
                      ├── x = 3
                      └── parent → global
```

`make-adder` 已经返回，但 `add3` 仍然引用 `f1`，因此 `f1` 不能被回收。闭包保存的不是一次计算后的 `x` 文本替换，而是能够执行名字查找的环境关系。

### 7.2 调用 `add3`

```text
调用 (add3 10)
        ↓
创建 frame f2
├── y = 10
└── parent → add3.closure → f1
                                ├── x = 3
                                └── parent → global
```

求值 `(add x y)`：

```text
lookup add：f2 没有 → f1 没有 → global 找到 Primitive(add)
lookup x：  f2 没有 → f1 找到 3
lookup y：  f2 找到 10
Apply add to [3, 10] → 13
```

闭包可以压缩为：

```text
Closure = Function Code + Defining Environment
```

但“环境”不是把所有可见值复制一份快照。它通常保存对环境对象的引用；如果语言允许修改外层绑定，之后的查找也可能观察到变化。

## 8. Lexical scope 与 dynamic scope 的差别

考虑：

```text
(define x 100)

(define read-x
  (lambda () x))

(define call-with-local-x
  (lambda (x) (read-x)))

(call-with-local-x 1)
```

词法作用域根据函数**定义在哪里**决定名字查找路径，所以 `read-x` 的 closure 指向 global，结果是 100。

```text
Lexical scope：parent = procedure.closure
               看定义位置

Dynamic scope：parent = caller environment
               看调用位置
```

如果 Apply 错误地把当前调用者环境作为 parent，`read-x` 会看到调用者参数 `x=1`，语言就变成了另一种作用域规则。作用域不是“字典查找的实现细节”，而是语言语义的一部分。

## 9. Eval 与 Apply 形成互相递归

加入用户函数后，完整关系更加清楚：

```text
evaluate(Call)
    ↓ evaluate operator and arguments
apply(UserProcedure)
    ↓ create child environment
evaluate(procedure.body)
    ↓ body may contain another Call
apply(...)
```

递归的终点有两类：

```text
Eval base case：Number 等 self-evaluating expression
Apply base case：Primitive 直接调用宿主语言实现
```

用户定义函数没有脱离解释器运行。它的函数体仍是一棵 AST，只是在新的环境中再次交给 Eval。

### 9.1 递归函数怎样找到自己

```text
(define factorial
  (lambda (n)
    (if (eq n 0)
        1
        (mul n (factorial (sub n 1))))))
```

Lambda 创建时保存 global frame；随后 `define` 把 `factorial` 绑定到同一个 global frame。函数体执行到 `Name("factorial")` 时，沿 closure 查找就能找到后来建立的绑定。

```text
UserProcedure.closure ──> global frame
                              └── factorial ──> UserProcedure
```

这个环状引用在语义上支持递归。Python 的垃圾回收能够处理普通引用环，但解释器仍要避免无意中让大量环境和中间值永久可达。

## 10. 程序成为数据后，可以被分析和转换

解释器看到的用户程序不是“神秘代码”，而是 AST 对象：

```text
用户视角：表达式规定要完成的计算
解释器视角：一棵需要按规则遍历的数据树
```

因此执行前可以：

- 收集引用的操作名；
- 检查禁止节点；
- 限制树深度和节点数量；
- 对常量表达式预计算；
- 插入追踪节点；
- 把一种外部语法转换成统一 IR。

但能够分析 AST 不代表它天然安全。最终风险取决于 Evaluator 允许哪些节点，以及 Primitive 能访问哪些宿主能力。

## 11. 不要用 `eval` 代替受控解释器

Python 的 `eval()` 会按照 Python 语义执行表达式：

```python
eval("2 + 2")  # 4
```

如果输入不可信，攻击者就不再受 MiniExpr 的节点类型和 Primitive 注册表限制。仅仅删除一部分 `globals` 或修改 `__builtins__` 不能构成可靠安全边界。

```text
自定义解释器
    只识别主动实现的 AST 节点
    只暴露主动注册的 Primitive

Python eval / exec
    执行 Python 语言能力
    攻击面远大于小型 DSL
```

`ast.literal_eval()` 不执行任意函数调用或名字查找，只接受 Python 字面量和容器结构，但它也不是处理任意不可信大输入的完整防护：恶意构造的深层或巨大输入仍可能造成 CPU、内存或栈资源耗尽。

如果需求是真正执行不可信 Python 代码，单靠自定义字典、异常捕获或 AST 黑名单并不够，通常还需要独立进程或容器、操作系统权限隔离、网络和文件系统限制以及资源配额。

## 12. Environment 与 ExecutionContext 分开设计

语言变量和执行控制属于不同层次：

```python
from dataclasses import dataclass
from time import monotonic

@dataclass(slots=True)
class ExecutionContext:
    remaining_steps: int
    deadline: float
    trace_id: str
    services: dict[str, object]

    def tick(self) -> None:
        self.remaining_steps -= 1
        if self.remaining_steps < 0:
            raise ResourceLimitError("执行步数超过限制")
        if monotonic() > self.deadline:
            raise ResourceLimitError("执行超时")
```

Evaluator 每处理一个节点就调用一次 `context.tick()`：

```python
def evaluate(expr, environment, context):
    context.tick()
    ...
```

两类状态的职责是：

| 状态 | 面向谁 | 保存什么 |
|---|---|---|
| Environment | 被解释程序 | 名字绑定与作用域关系 |
| ExecutionContext | 解释器和宿主系统 | 预算、服务、权限、trace id |

这样用户函数可以访问自己的变量，却不能因为定义了同名变量就覆盖解释器的 deadline、数据库连接或权限对象。

## 13. 安全执行需要多层限制

受控 AST 和 allowlist 是必要条件，但还不是完整沙箱。一个允许递归和外部操作的解释器至少应考虑：

```text
输入限制
    最大字符数、Token 数、AST 深度和节点数

语义限制
    允许的节点、操作、参数 schema 和数据类型

计算限制
    最大步数、调用深度、输出大小和 wall-clock timeout

能力限制
    文件、网络、数据库和进程权限

隔离限制
    独立进程、容器或受限运行账户
```

其中有几个容易混淆的点：

- AST 白名单限制“表达什么”，不能限制一个已注册 Primitive 内部做什么；
- Evaluator 的协作式 deadline 只能在下一次 `tick()` 时生效，无法中断卡在阻塞 I/O 中的 Primitive；
- Python 线程超时不等于底层任务已经停止；
- 只限制递归深度不能阻止宽度巨大但不深的 AST；
- 只限制 wall-clock 时间不能阻止短时间内占用大量内存。

外部操作本身还需要超时和取消机制；需要强隔离时，应把执行放到可以终止和回收的独立边界中。

## 14. 可观测性要记录语义事件

只记录“执行失败”很难还原解释器发生了什么。更有价值的是结构化事件：

```text
trace_id
node_type
source_span
operation_name
argument_summary
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

记录时应避免直接保存完整输入、凭据和敏感返回值。观测系统需要足够的信息定位阶段和操作，但不应变成数据泄漏通道。

### 14.1 解释器自身错误与用户程序错误分开

```text
User program error
    未知名字、arity 不符、资源预算用尽
    → 稳定错误码，可以展示给调用者

Interpreter defect
    漏处理节点、内部状态损坏、意外异常
    → 记录 traceback，对外返回通用内部错误
```

若把所有异常都转换成 `EvaluationError("执行失败")`，系统表面上更“稳定”，实际却丢失了排查解释器缺陷所需的信息。

## 15. 一个可扩展解释器的模块边界

三篇笔记最终得到的不是一个巨大的 `eval` 函数，而是一组可以独立演进的组件：

```text
Source Adapter
    ↓ 接收文本或结构化输入
Tokenizer / Parser
    ↓ 生成 AST
Validator / Normalizer
    ↓ 生成受控 IR
Evaluator
    ├── Environment：名字与作用域
    ├── Procedure：Primitive / UserProcedure
    └── ExecutionContext：权限、预算、追踪
        ↓
Capability Registry
    ↓ 只暴露允许的宿主操作
External Systems
```

这种分层允许分别替换：

- 外部语法可以从前缀表达式换成 JSON，而不重写求值规则；
- AST 可以规范化为同一 IR，让多个输入协议共用执行器；
- Primitive 可以在测试中替换为 fake，而不修改 Parser；
- REPL 可以换成 HTTP 边界，而不把网络逻辑塞进 Environment；
- 预算和 tracing 可以统一包围所有求值路径。

## 16. 把第三章串起来

```text
程序先是 Source Text
    ↓ Tokenizer
成为 Token Stream
    ↓ Parser
成为 AST
    ↓ Validator / Normalizer
成为受控 IR
    ↓ Eval
表达式变成 Runtime Value
    ↓ Apply
Primitive 或 UserProcedure 被执行
    ↓ Environment
名字、作用域和闭包获得含义
    ↓ ExecutionContext
权限、预算和可观测性约束整个过程
```

需要保留的几个判断：

1. Frame 保存一层绑定，Environment 是当前 Frame 及其 parent 链；
2. 用户函数不仅保存参数和函数体，还要保存定义环境；
3. Apply 用户函数时，新 Frame 的 parent 指向 closure，词法作用域才成立；
4. Eval 与 Apply 互相递归，Primitive 是 Apply 的基本情形；
5. Environment 管理语言名字，ExecutionContext 管理宿主资源，两者不应混成一个万能字典；
6. AST 白名单只能约束语言表面，Primitive 的权限和执行隔离仍要单独设计；
7. 抽象能力让用户能够定义新运算，安全边界则决定这些运算最终可以影响什么。

解释器最值得学习的地方，不是 Scheme 括号或某几段项目代码，而是它揭示了语言机制可以怎样逐层构成：文本成为数据，数据按规则求值，环境赋予名字含义，闭包保存作用域，而宿主系统负责划定执行能力的边界。

## 参考

- [Composing Programs 3.5：Interpreters for Languages with Abstraction](https://www.composingprograms.com/pages/35-interpreters-for-languages-with-abstraction.html)
- [Python 语言参考：Execution model](https://docs.python.org/3/reference/executionmodel.html)
- [Python 文档：`eval`](https://docs.python.org/3/library/functions.html#eval)
- [Python 文档：`ast.literal_eval`](https://docs.python.org/3/library/ast.html#ast.literal_eval)
