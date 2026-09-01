---
title: 求值器如何赋予语义：Eval、Apply 与错误边界
date: 2026-08-27 11:00:00
top_img: /img/composing-programs-evaluator-error-boundary-nature-cover.jpg
cover: /img/composing-programs-evaluator-error-boundary-nature-cover.jpg
cover_credit: "Denis Budkov · National Geographic Your Shot"
cover_source: "https://www.nationalgeographic.com/photography/article/wildlife-gallery-yourshot"
description: Composing Programs 第三章笔记之二：在 AST 之上实现 Eval、Apply、特殊形式与 REPL，并把词法、语法、名字解析和运行错误组织成清晰的工程边界。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Interpreter
  - Evaluation
  - Error Handling
toc: true
toc_number: false
katex: false
---

上一篇把源码解析成了 AST，但 AST 仍然只是“程序长什么样”的结构化描述。本篇继续完成 MiniExpr 的求值器，让下面这段程序真正得到结果：

```text
(add 1 (mul 2 3))  →  7
```

我们沿着一条主线展开：

1. AST 节点怎样得到运行时含义；
2. 普通调用怎样通过 Eval 与 Apply 得到结果；
3. `if` 为什么不能套用普通调用规则；
4. 求值失败后，错误怎样沿同一条调用链返回系统边界。

本篇受教材以下内容启发：

- [3.3 Exceptions](https://www.composingprograms.com/pages/33-exceptions.html)
- [3.4 Interpreters for Languages with Combination](https://www.composingprograms.com/pages/34-interpreters-for-languages-with-combination.html)

## 1. AST 描述结构，Evaluator 赋予含义

上一篇得到的 AST 可以简化为：

```text
Call
├── operator: Name("add")
└── arguments
    ├── Number(1)
    └── Call
        ├── operator: Name("mul")
        └── arguments
            ├── Number(2)
            └── Number(3)
```

这棵树只表达层级关系：`mul` 调用位于 `add` 的第二个参数中。它并没有自动规定：

- `Number` 应该得到什么值；
- `Name` 应该到哪里查找；
- 调用前是否要先求值所有参数；
- `add` 最终对应哪个 Python 函数；
- 任何一步失败时应该产生什么错误。

这些规则共同构成语言的 **evaluation semantics（求值语义）**。Evaluator 的职责，就是根据 AST 节点的形式选择相应规则，将语法表示逐步转换成运行时值。

| AST 节点 | 它描述什么 | 求值后可能得到什么 |
|---|---|---|
| `Number(1)` | 源码中的数字字面量 | Python 数值 `1` |
| `Name("add")` | 源码中的名字 | 名字绑定的 `Primitive` |
| `Call(...)` | 一次调用的结构 | 调用产生的结果 `7` |

因此 `Number(1)` 和整数 `1` 不是同一个层次：前者是带有语法身份的 AST 节点，后者是后续计算使用的运行时值。

## 2. 名字表和 Primitive 准备运行时能力

在实现 Evaluator 之前，先准备 `Name` 能够查到的运行时对象。MiniExpr 用 `Primitive` 包装允许调用的 Python 函数：

```python
from collections.abc import Callable
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Primitive:
    name: str
    implementation: Callable[..., object]
    min_arity: int
    max_arity: int | None
```

注册表保存语言开放的基础操作：

```python
import math
import operator

PRIMITIVES = {
    "add": Primitive("add", lambda *xs: sum(xs), 0, None),
    "mul": Primitive("mul", lambda *xs: math.prod(xs), 0, None),
    "sub": Primitive("sub", operator.sub, 2, 2),
    "div": Primitive("div", operator.truediv, 2, 2),
}

GLOBAL_NAMES = {
    **PRIMITIVES,
    "true": True,
    "false": False,
}
```

这里的 `GLOBAL_NAMES` 字典就是最小版本的 Environment：它暂时只有全局名字；下一篇再把它扩展成支持局部作用域和父环境的结构。

现在，名字求值的路径就明确了：

```text
Name("add")
    ↓ 在 GLOBAL_NAMES 中查找
Primitive(name="add", implementation=..., ...)
```

`Name("add")` 并不直接保存 Python 加法函数。它只保存名字，运行时再通过名字表取得绑定对象。这种间接关系既为下一篇的局部作用域留下空间，也形成了一层能力边界：MiniExpr 只能调用注册表明确开放的操作，而不能通过字符串任意访问 Python 对象。

## 3. 普通调用沿着 Eval → Apply 得到结果

解释器把普通调用拆成两个连续阶段：

- **Eval** 处理 AST：表达式在当前名字表中得到什么值？
- **Apply** 处理运行时对象：过程应用于这些实参值后得到什么结果？

{% mermaid %}
flowchart TB
    CALL["Call AST"] --> OP["Eval operator"]
    CALL --> ARGS["Eval arguments"]
    OP --> PROC["procedure"]
    ARGS --> VALUES["argument values"]
    PROC --> APPLY["Apply"]
    VALUES --> APPLY
    APPLY --> RESULT["Runtime value"]
{% endmermaid %}

<p class="cp-figure-caption">Eval 负责把语法节点变成值；Apply 只接收已经得到的过程和值。</p>

### 3.1 Eval 按 AST 形式选择语义规则

`evaluate(expr, names)` 接收一个 AST 节点和当前名字表，返回对应的运行时值：

```python
def evaluate(expr, names):
    if isinstance(expr, Number):
        return expr.value

    if isinstance(expr, Name):
        try:
            return names[expr.identifier]
        except KeyError as exc:
            raise NameResolutionError(
                f"未定义的名字：{expr.identifier}"
            ) from exc

    if isinstance(expr, Call):
        procedure = evaluate(expr.operator, names)
        arguments = [
            evaluate(argument, names)
            for argument in expr.arguments
        ]
        return apply_procedure(procedure, arguments)

    raise TypeError(
        f"Evaluator 不支持 AST 节点：{type(expr).__name__}"
    )
```

`NameResolutionError` 等语言级错误会在第 5 节统一整理；这里先关注 `Eval` 如何分派，以及递归如何把子表达式逐层算成值。最后的 `TypeError` 则表示解释器遗漏了某种 AST 节点，应作为实现错误暴露出来。

三个分支分别是一条语义规则：

- `Number` 直接返回字面量，是递归终点；
- `Name` 从名字表取得绑定，把语法名字连接到运行时对象；
- `Call` 递归求值 operator 和 arguments，再把结果交给 Apply。

这里判断的是 `Number`、`Name`、`Call` 等**表达式形式**，不是 `add`、`mul` 等具体操作名。具体能调用哪些操作由注册表决定，Evaluator 不需要为每个 Primitive 写一条分支。

### 3.2 递归怎样完成一次嵌套调用

对这棵 AST：

```text
Call(Name("add"), [Number(1), Call(Name("mul"), [Number(2), Number(3)])])
```

求值会展开成：

```text
evaluate(Call add)
├── evaluate(Name("add")) ──> Primitive(add)
├── evaluate(Number(1)) ─────> 1
├── evaluate(Call mul)
│   ├── evaluate(Name("mul")) ──> Primitive(mul)
│   ├── evaluate(Number(2)) ─────> 2
│   ├── evaluate(Number(3)) ─────> 3
│   └── apply Primitive(mul), [2, 3] ──> 6
└── apply Primitive(add), [1, 6] ──────> 7
```

同一个 `evaluate` 不断处理更小的子表达式。内层 `mul` 先得到结果 `6`，这个结果再成为外层 `add` 的第二个实参。

### 3.3 Apply 检查调用协议并执行过程

进入 Apply 时，AST 已经不再参与：输入只是一个运行时过程和一组实参值。

```python
def apply_procedure(procedure, arguments):
    if not isinstance(procedure, Primitive):
        raise EvaluationError("调用位置得到的不是过程")

    count = len(arguments)
    if count < procedure.min_arity:
        raise ArityError(
            f"{procedure.name} 至少需要 {procedure.min_arity} 个参数"
        )
    if procedure.max_arity is not None and count > procedure.max_arity:
        raise ArityError(
            f"{procedure.name} 最多接受 {procedure.max_arity} 个参数"
        )

    try:
        return procedure.implementation(*arguments)
    except (ArithmeticError, ValueError) as exc:
        raise PrimitiveError(
            f"执行 {procedure.name} 失败：{exc}"
        ) from exc
```

参数数量由 `Primitive` 的元数据提前检查，不能简单地把所有 `TypeError` 都解释成参数数量错误，因为 `TypeError` 也可能来自 Python 实现内部。Apply 只转换预期中的操作错误；解释器自身的未知 bug 应保留完整 traceback。

保留 Eval 与 Apply 的边界，是因为二者的扩展方向不同：

| 新能力 | 主要修改哪里 | 原因 |
|---|---|---|
| 新增 `sqrt` Primitive | 注册表 | 仍然遵守普通调用规则 |
| 新增用户函数 | Apply | 需要创建调用环境并执行函数体 |
| 新增 `if` 语法 | AST 与 Eval | 需要控制哪些分支参与求值 |

下一篇加入用户函数后，Apply 会在 `Primitive` 与 `UserProcedure` 之间分派，而 Eval 的 Call 规则仍然只负责准备 procedure 和 arguments。

## 4. Special Form 是普通调用规则的边界

当前 Call 分支会先求值所有实参，再进入 Apply。这称为 **eager evaluation（急切求值）**，是普通调用的统一规则。

现在给语言增加条件表达式：

```text
(if false (div 1 0) 42)
```

预期结果是 `42`。未被选中的 `(div 1 0)` 不应该求值；否则程序会在进入 Apply 之前产生除零错误。

{% mermaid %}
flowchart LR
    subgraph IF_SPECIAL["正确：Special Form 按需求值"]
      direction TB
      R1["条件得到 False"] --> R2["只求值 alternative：42"]
      R2 --> R3["结果：42"]
    end
    subgraph IF_EAGER["错误：普通调用提前求值"]
      direction TB
      W1["先求值所有实参"] --> W2["执行 div(1, 0)"]
      W2 --> W3["ZeroDivisionError<br/>无法进入 Apply"]
    end
    R1 ~~~ W1
    class R1,R2,R3 cp-path-good
    class W1,W2,W3 cp-path-bad
{% endmermaid %}

<p class="cp-figure-caption">两条路径的差别发生在 Apply 之前：Special Form 可以决定哪些分支需要求值，普通调用不能。</p>

因此 Parser 应该把 `if` 识别为独立的 AST 节点，而不是普通 `Call`：

```python
from __future__ import annotations

from typing import TypeAlias


@dataclass(frozen=True, slots=True)
class If:
    condition: Expr
    consequent: Expr
    alternative: Expr

Expr: TypeAlias = Number | Name | Call | If
```

Evaluator 再为它定义专用规则：

```python
if isinstance(expr, If):
    condition = evaluate(expr.condition, names)
    selected = (
        expr.consequent if condition is not False
        else expr.alternative
    )
    return evaluate(selected, names)
```

这段代码先求值 condition，再选择一个分支，最后只求值被选中的分支。这里采用 Scheme 风格的真值规则：只有 `false` 对应的 `False` 是假值，数字 `0` 仍然为真。

**Special Form（特殊形式）** 的特殊之处不是名字特殊，而是它拥有不同于普通调用的求值规则。后续的 `define` 和 `lambda` 也需要控制某些组成部分是否、何时求值。

## 5. 失败沿着执行链向外传播

成功时，值从内层 Eval 和 Apply 一层层返回；失败时，异常沿同一条调用链反方向向外传播。为了保留失败阶段，可以先定义一组小而明确的语言级错误：

```python
class MiniExprError(Exception):
    """用户程序导致的、可以安全展示的错误。"""

class TokenizeError(MiniExprError):
    pass

class ParseError(MiniExprError):
    pass

class NameResolutionError(MiniExprError):
    pass

class ArityError(MiniExprError):
    pass

class PrimitiveError(MiniExprError):
    pass

class EvaluationError(MiniExprError):
    pass
```

这些类型不是为了建立庞大的异常继承树，而是回答“程序在哪个阶段失败”：

| 阶段 | 示例 | 应保留的信息 |
|---|---|---|
| Tokenize | 出现不允许的字符 | 字符位置与允许的词法形式 |
| Parse | 缺少右括号 | 期望的 Token 和实际位置 |
| Resolve | `mystery` 未定义 | 未解析的名字 |
| Apply | `sub` 收到三个参数 | 期望与实际参数数量 |
| Primitive | 除数为零 | 操作名和底层原因 |
| Internal | Evaluator 漏处理节点 | 完整 traceback，不能伪装成用户错误 |

以 `(div 1 0)` 为例，异常传播路径是：

{% mermaid %}
sequenceDiagram
    participant B as REPL / API 边界
    participant O as 外层 Eval
    participant I as 内层 Eval
    participant A as Apply
    participant P as Python 除法
    B->>O: 求值
    O->>I: 求值嵌套表达式
    I->>A: 应用 div
    A->>P: 1 / 0
    P--xA: ZeroDivisionError
    A--xI: PrimitiveError
    I--xO: 继续上抛
    O--xB: 继续上抛
    B->>B: 转换为边界响应
{% endmermaid %}

<p class="cp-figure-caption">中间层只补充自己知道的语义，最终展示策略留给最了解交互方式的边界层。</p>

Apply 可以把底层算术异常转换成语言级错误，同时保留原始原因：

```python
try:
    return procedure.implementation(*arguments)
except ArithmeticError as exc:
    raise PrimitiveError(
        f"操作 {procedure.name} 执行失败"
    ) from exc
```

外层看到的是 `PrimitiveError`，调试时仍可通过 `__cause__` 和 traceback 找到原始 `ZeroDivisionError`。如果中间层无法恢复，就不应该捕获异常后伪造一个结果；它应补充必要上下文，然后继续向外抛出。

还要区分用户程序错误和解释器自身 bug。REPL 可以安全展示 `MiniExprError`，但不应该用 `except Exception` 吞掉所有异常，否则空指针、遗漏分支等实现错误也会被伪装成普通输入错误。

## 6. REPL 是错误展示的系统边界

**REPL（Read-Eval-Print Loop）** 把读取、解析、求值和展示组合成循环：

{% mermaid %}
flowchart LR
    R["Read<br/>读取源码"] --> P["Parse<br/>生成 AST"]
    P --> E["Eval<br/>计算运行时值"]
    E --> O["Print<br/>展示结果或错误"]
    O --> R
{% endmermaid %}

```python
def repl(global_names):
    while True:
        try:
            source = input("mini> ")
            expression = parse(tokenize(source))
            value = evaluate(expression, global_names)
            print(value)
        except EOFError:
            return
        except MiniExprError as exc:
            print(f"Error: {exc}")
```

一次用户输入失败后，REPL 打印错误并继续下一轮；Evaluator 本身不需要知道结果最终显示在终端、HTTP 响应还是测试断言中。

{% mermaid %}
flowchart TB
    CORE["同一个 Evaluator 核心"] --> REPL["REPL<br/>简短错误 · 继续循环"]
    CORE --> HTTP["HTTP API<br/>error code · request id"]
    CORE --> BATCH["Batch<br/>记录失败项 · 决定是否继续"]
    CORE --> TEST["Test<br/>直接暴露异常并断言"]
{% endmermaid %}

错误在哪里产生，属于语言核心；错误怎样展示和是否继续处理，属于系统边界。

## 7. 核心跑通后，再补工程约束

前面的 `Primitive` 只保存名称、Python 实现和参数数量。若操作会访问 HTTP 服务、文件或数据库，注册项通常还需要更多元数据：

| 元数据 | 解决的问题 |
|---|---|
| `input_schema` | 参数结构和类型是否合法 |
| `permission` | 当前调用者是否拥有所需能力 |
| `timeout` | 外部操作最长可以执行多久 |
| `side_effect` | 操作是否会改变外部状态 |
| `retry_policy` | 失败后是否允许重试 |

执行流程也会从“查表后直接调用”扩展为：

```text
查找注册项
    ↓
校验参数结构
    ↓
检查权限、预算与超时
    ↓
执行 implementation
    ↓
规范化结果或错误
```

这与根据用户提供的字符串反射任意 Python 对象有本质区别。注册表是一份显式 allowlist：只有经过注册、验证并授权的能力才能被语言程序触发。

### 7.1 纯操作与副作用操作需要不同策略

`add` 和 `mul` 对相同输入总是得到相同结果，容易缓存、测试和重放；写文件、发送请求或修改数据库会改变外部状态。

```text
Pure primitive
    输入 → 确定结果

Effectful primitive
    输入 + 外部状态 → 结果 + 副作用
```

二者可以拥有统一调用接口，但不能共用完全相同的重试和观测策略。尤其在执行结果未知时，不能盲目重试会产生副作用的操作；否则一次逻辑调用可能多次写入数据或发送请求。

### 7.2 分层测试让失败位置可判断

MiniExpr 的每一层都可以独立验证：

```text
Tokenizer test
    源码 → Token 序列与位置

Parser test
    Token 序列 → AST

Evaluator test
    手工 AST + names → 运行时值

Apply test
    Primitive + arguments → 参数检查与执行结果

REPL test
    一次错误后仍能处理下一次输入
```

如果只测试 `run("(add 1 2)") == 3`，失败时很难判断问题来自词法、语法、名字解析还是 Primitive 执行。分层不仅组织代码，也为故障定位提供边界。

## 8. 把成功路径和失败路径串起来

{% mermaid %}
flowchart TB
    AST["AST"] --> EVAL["Eval<br/>按表达式形式解释"]
    ENV["Environment<br/>名字绑定"] --> EVAL
    EVAL --> APPLY["Apply<br/>执行过程与实参"]
    REG["Primitive Registry<br/>允许的基础操作"] --> APPLY
    APPLY --> VALUE["Runtime Value"]
    EVAL -.失败.-> ERROR["Language Error"]
    APPLY -.失败.-> ERROR
    ERROR --> BOUNDARY["REPL / API / Batch / Test"]
{% endmermaid %}

整篇可以收束为五个判断：

1. AST 只描述程序结构，Evaluator 才定义每种结构怎样得到值；
2. Eval 处理表达式，Apply 处理已经求值得到的过程和实参；
3. 普通调用会先求值所有参数，Special Form 可以控制求值顺序；
4. 错误类型标记失败阶段，异常因果链保留底层原因，边界层决定展示方式；
5. Primitive 注册表既是调用分派表，也是解释器允许执行能力的边界。

目前的 MiniExpr 已经能够组合已有操作，却仍然不能定义名字和函数。下一篇将引入 Environment、用户过程和闭包，让语言获得真正的抽象能力。

## 参考

- [Composing Programs 3.3：Exceptions](https://www.composingprograms.com/pages/33-exceptions.html)
- [Composing Programs 3.4：Interpreters for Languages with Combination](https://www.composingprograms.com/pages/34-interpreters-for-languages-with-combination.html)
- [Python 文档：Errors and Exceptions](https://docs.python.org/3/tutorial/errors.html)
- [Python 语言参考：`raise` 与 exception chaining](https://docs.python.org/3/reference/simple_stmts.html#the-raise-statement)
