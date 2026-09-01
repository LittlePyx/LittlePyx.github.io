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

上一篇把源码转换成了 AST，但 AST 仍然只是程序的结构化描述。本篇继续实现 MiniExpr：解释器将递归访问 AST，根据每种节点的规则计算值，并通过操作注册表调用受控的 Python 函数。

本篇受教材以下内容启发：

- [3.3 Exceptions](https://www.composingprograms.com/pages/33-exceptions.html)
- [3.4 Interpreters for Languages with Combination](https://www.composingprograms.com/pages/34-interpreters-for-languages-with-combination.html)

整篇解决两个相互关联的问题：**谁定义每种语法结构的含义，以及某个阶段失败后，错误怎样保留上下文并返回系统边界。**

## 1. AST 的结构不等于 AST 的含义

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

树只告诉我们 `mul` 位于 `add` 的参数中，并没有自动规定：

- Number 的值是不是它自己；
- Name 应该到哪里查找；
- 参数是否按从左到右求值；
- `add` 能接收几个参数；
- 操作失败时应该抛出什么错误。

这些规则共同构成语言的 **evaluation semantics（求值语义）**。Evaluator 不是“执行 AST 自带的方法”，而是语言实现者对每种表达式形式给出明确处理规则。

## 2. Eval 负责表达式，Apply 负责过程和值

解释器通常把求值拆成两个职责：

```text
Eval(expression, environment)
    回答：这个表达式在当前环境中得到什么值？

Apply(procedure, arguments)
    回答：这个过程应用于这些实参时得到什么值？
```

对调用表达式：

```text
(add 1 (mul 2 3))
```

执行链路是：

```text
Eval 整个 Call
    ↓
Eval operator：Name("add") → Primitive(add)
    ↓
Eval 第一个参数：Number(1) → 1
    ↓
Eval 第二个参数：Call(mul, ...) → 6
    ↓
Apply Primitive(add) to [1, 6]
    ↓
7
```

Eval 不必知道 Python 的加法函数怎样实现；Apply 也不必知道参数来自哪些 AST 节点。这个分工会在下一篇加入用户定义函数时继续成立。

## 3. 运行时值和 AST 节点必须区分

MiniExpr 的 AST 节点是解释器内部的 Python 对象：

```python
Number(1)
Name("add")
Call(...)
```

它们求值后得到运行时值：

```python
1
Primitive("add", ...)
7
```

因此：

```text
Number(1) 是语法表示
1         是运行时数值
```

两者碰巧都与数字 1 有关，但承担不同角色。若以后给 `Number` 增加源码位置、原始文本或类型标记，运行时整数仍然不需要知道这些解析信息。

## 4. Primitive 把语言操作连接到 Python 实现

解释器需要一组最基本的过程作为递归终点。可以用 `Primitive` 明确包装允许调用的 Python 函数：

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

注册表只暴露语言允许使用的操作：

```python
import math
import operator

PRIMITIVES = {
    "add": Primitive("add", lambda *xs: sum(xs), 0, None),
    "mul": Primitive("mul", lambda *xs: math.prod(xs), 0, None),
    "sub": Primitive("sub", operator.sub, 2, 2),
    "div": Primitive("div", operator.truediv, 2, 2),
}
```

这里的字典不是为了少写几个 `if`，而是建立一层显式能力边界：

```text
Python 进程能够调用的所有对象
                ↓ allowlist
MiniExpr 程序被允许调用的 Primitive
```

新增操作主要修改注册表；Evaluator 继续按照“先求值 operator 和 arguments，再 Apply”的统一规则运行。

### 4.1 元数据比捕获 `TypeError` 更可靠

一种草率写法是直接调用函数，再把所有 `TypeError` 当成参数数量错误。但 `TypeError` 也可能来自函数内部：

```python
def operation(value):
    return value + "suffix"  # value 类型不合适时也会产生 TypeError
```

因此 Primitive 明确保存 arity，由 Apply 在调用前验证参数数量。这样“调用协议不满足”和“操作内部实现失败”不会被混成同一种错误。

## 5. Evaluator 按表达式形式分派

先使用一个普通字典作为全局名字表：

```python
GLOBAL_NAMES = {
    **PRIMITIVES,
    "true": True,
    "false": False,
}
```

Evaluator 的核心结构如下：

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

    raise EvaluationError(
        f"未知 AST 节点：{type(expr).__name__}"
    )
```

这个分派的依据是**语法形式**：Number、Name 和 Call 分别具有不同求值规则。它与第二章的类型分派结构相似，但这里选择的不是数值运算实现，而是语言语义。

### 5.1 Apply 验证过程和值

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

这里只转换我们预期的操作错误，并使用 `raise ... from exc` 保留底层原因。没有预期的编程错误应继续传播，由系统边界记录完整 traceback，而不是被包装成含糊的“表达式错误”。

## 6. Special Form 不能套用普通调用规则

给语言增加条件表达式：

```text
(if false (div 1 0) 42)
```

预期结果是 `42`，而不是除零错误。因为 `if` 只应求值被选中的分支。

若把 `if` 当成普通 Primitive，Call 的统一规则会先求值所有参数：

```text
Eval false        → False
Eval (div 1 0)    → ZeroDivisionError
Eval 42           → 根本无法到达
Apply if          → 根本无法到达
```

问题不在 `if` 的 Python 实现，而在普通调用规则本身：**eager evaluation（急切求值）会在 Apply 之前计算所有实参。**

### 6.1 用独立 AST 节点表达特殊规则

Parser 可以把 `if` 识别为独立节点：

```python
@dataclass(frozen=True, slots=True)
class If:
    condition: Expr
    consequent: Expr
    alternative: Expr
```

在实际模块中，还要把 `If` 加入 `Expr` 的联合类型：

```python
from typing import TypeAlias

Expr: TypeAlias = Number | Name | Call | If
```

Evaluator 为它定义专用规则：

```python
if isinstance(expr, If):
    condition = evaluate(expr.condition, names)
    selected = (
        expr.consequent if condition is not False
        else expr.alternative
    )
    return evaluate(selected, names)
```

这里明确选择 Scheme 风格的真值规则：只有 `false` 对应的 `False` 是假值，数字 0 仍被视为真。真值规则也必须由语言定义，不能无意间继承宿主 Python 的全部行为。

现在执行过程是：

```text
Eval condition
    ↓ False
只选择 alternative
    ↓
Eval Number(42)
    ↓
42
```

**Special form（特殊形式）**的特殊之处不是拼写，而是它拥有不同于普通调用的求值规则。后续的 `define` 和 `lambda` 也不能先把所有组成部分当作普通表达式求值。

## 7. Eval 与 Apply 的边界为何值得保留

当前 Apply 只支持 Primitive，看起来似乎可以直接写在 Call 分支中。但下一篇加入用户函数后，Apply 会出现第二条路径：

```text
Primitive
    → 调用注册的 Python implementation

UserProcedure
    → 创建调用环境
    → 参数绑定实参
    → Eval 函数体
```

因此结构会形成：

```text
Eval 遇到 Call
    ↓
Apply UserProcedure
    ↓
Eval procedure body
    ↓
body 中又可能出现 Call
    ↓
Apply ...
```

Eval 和 Apply 的互相调用不是人为绕远，而是函数式语言求值过程的自然结构。

## 8. 错误应该对应失败阶段

解释器至少包含这些失败类别：

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

分类的价值不是建立庞大的继承树，而是保留错误发生在哪个阶段：

| 阶段 | 示例 | 应表达的信息 |
|---|---|---|
| Tokenize | 出现不允许的字符 | 字符位置与允许的词法形式 |
| Parse | 缺少右括号 | 期望的 Token 和实际位置 |
| Resolve | `mystery` 未定义 | 未解析的名字 |
| Apply | `sub` 收到三个参数 | 期望与实际参数数量 |
| Primitive | 除数为零 | 操作名和底层原因 |
| Internal | Evaluator 漏处理节点 | 完整 traceback，不能伪装成用户错误 |

### 8.1 异常传播是在寻找负责处理的边界

异常抛出后，当前执行路径停止，Python 沿调用栈向外寻找能够处理该异常的 `except`：

```text
operator.truediv
    ↓ raises ZeroDivisionError
apply_procedure
    ↓ raises PrimitiveError from original
evaluate inner Call
    ↓ propagate
evaluate outer Call
    ↓ propagate
run / REPL boundary
    ↓ convert to user-facing error
```

中间层如果无法恢复，就不应该捕获后继续返回一个伪造结果。错误传播允许底层专注于发现问题，由更了解交互方式的外层决定怎样呈现。

### 8.2 `raise ... from ...` 保留因果关系

```python
try:
    return procedure.implementation(*arguments)
except ArithmeticError as exc:
    raise PrimitiveError(
        f"操作 {procedure.name} 执行失败"
    ) from exc
```

外层看到的是语言级 `PrimitiveError`，调试时仍能通过 `__cause__` 和 traceback 找到原始 `ZeroDivisionError`。这比重新抛出一个没有原因的新异常更容易定位问题。

## 9. REPL 是解释器的交互边界

**REPL（Read-Eval-Print Loop）**把几个独立阶段组合成循环：

```text
Read     读取一段源码
Parse    转换成 AST
Eval     计算运行时值
Print    展示结果
Loop     继续读取下一段输入
```

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

REPL 捕获可归因于用户输入的 `MiniExprError`，打印后继续下一轮。它没有吞掉所有 `Exception`，否则解释器自身的 bug 也会被伪装成普通输入错误。

同一个核心解释器可以接到不同边界：

```text
REPL     → 打印简短错误并继续循环
HTTP API → 返回稳定 error code 和 request id
Batch    → 记录失败项，按照策略决定是否继续
Test     → 让异常直接暴露，断言其类型与位置
```

错误如何展示属于边界层，求值规则本身不应依赖终端、HTTP 或日志系统。

## 10. 工程中的注册表不只是函数字典

当 Primitive 会调用外部资源时，注册项通常还需要更多元数据：

```text
name           稳定的操作名
input schema   参数结构与类型
implementation 实际执行函数
permission     所需能力
timeout        最大执行时间
side_effect    是否产生外部副作用
retry policy   是否允许重试
```

执行前的流程也会变成：

```text
解析出 Invoke
    ↓
查找注册项
    ↓
校验参数结构
    ↓
检查权限和预算
    ↓
执行 implementation
    ↓
规范化结果或错误
```

这与直接通过名字反射任意 Python 对象有本质区别。注册表是一份显式 allowlist；只有经过注册、验证并授权的能力才能被语言程序触发。

### 10.1 纯求值与副作用操作应分开观察

`add` 和 `mul` 对相同输入总是得到相同结果，容易测试和重放。写文件、发送请求或修改数据库则会改变外部状态。

```text
Pure primitive
    输入 → 确定结果

Effectful primitive
    输入 + 外部状态 → 结果 + 副作用
```

解释器可以提供统一调用形式，但日志、重试、超时和幂等性策略不能因此被忽略。尤其不要在未知执行结果时盲目重试会产生副作用的操作。

## 11. 分层测试比端到端猜错更可靠

MiniExpr 的各层可以分别验证：

```text
Tokenizer test
    输入源码 → 精确 Token 序列和位置

Parser test
    Token 序列 → 预期 AST

Evaluator test
    手工 AST + names → 预期值

Apply test
    Primitive + arguments → arity 和执行结果

REPL test
    一次错误后仍能继续处理下一次输入
```

若只测试 `run("(add 1 2)") == 3`，失败时很难判断是词法、语法、名字解析还是执行出了问题。分层不只是代码结构，也为故障定位提供边界。

## 12. 把本篇串起来

```text
AST 描述程序结构
    ↓ Eval 根据节点形式解释
Runtime values
    ↓ Apply 根据 procedure 类型执行
Primitive implementation
    ↓ 成功返回或抛出阶段化错误
Boundary 负责展示、记录或转换错误
```

需要保留的几个判断：

1. Eval 解释表达式，Apply 执行已经求值得到的过程和值；
2. 普通调用会先求值所有参数，Special form 可以控制求值顺序；
3. 操作注册表既是分派表，也是允许执行能力的边界；
4. 线程或调用栈没有“自动恢复”异常，只有某一层明确决定处理方式；
5. 可预期的用户程序错误和解释器自身 bug 不应使用同一个兜底结果掩盖；
6. Parser、Evaluator 与交互边界分开后，同一个语言核心才能复用于 REPL、API 和测试。

目前的 MiniExpr 已经能够组合已有操作，却仍然不能定义名字和函数。下一篇将引入 Environment、用户过程和闭包，让语言获得抽象能力。

## 参考

- [Composing Programs 3.3：Exceptions](https://www.composingprograms.com/pages/33-exceptions.html)
- [Composing Programs 3.4：Interpreters for Languages with Combination](https://www.composingprograms.com/pages/34-interpreters-for-languages-with-combination.html)
- [Python 文档：Errors and Exceptions](https://docs.python.org/3/tutorial/errors.html)
- [Python 语言参考：`raise` 与 exception chaining](https://docs.python.org/3/reference/simple_stmts.html#the-raise-statement)
