---
title: 程序如何成为数据：从源码到 Token、AST 与 IR
date: 2026-08-27 10:00:00
top_img: /img/composing-programs-source-to-ast-nature-cover.jpg
cover: /img/composing-programs-source-to-ast-nature-cover.jpg
cover_credit: "Paul Nicklen · National Geographic"
cover_source: "https://www.nationalgeographic.com/photography/article/patterns-landscapes"
description: Composing Programs 第三章笔记之一：用一个逐步扩展的小语言说明源码怎样经过词法分析与语法分析成为 AST，并进一步区分语法、语义、运行时值和 IR。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Interpreter
  - Parsing
  - AST
toc: true
toc_number: false
katex: false
---

前两章研究的是怎样用函数和对象组织计算；第三章把程序本身也纳入研究对象。一段源码首先只是一串字符，只有经过解析并按照语言规则解释，它才会产生计算结果。

本篇受教材以下内容启发，但不按教材顺序复述：

- [3.1 Introduction](https://www.composingprograms.com/pages/31-introduction.html)
- [3.2 Functional Programming](https://www.composingprograms.com/pages/32-functional-programming.html)
- [3.4 Interpreters for Languages with Combination](https://www.composingprograms.com/pages/34-interpreters-for-languages-with-combination.html)

我们会设计一个很小的表达式语言 MiniExpr，并让它在三篇笔记中逐步成长。第一步只解决一件事：**怎样把源码转换成结构明确、可以被程序处理的数据。**

## 1. 源码、程序结构与执行结果属于不同层次

先看一段 MiniExpr 源码：

```text
(add 1 (mul 2 3))
```

它表达的是“先计算 `2 × 3`，再把结果与 `1` 相加”。但对于我们正在编写的 Python 程序，这段输入最初只是一个字符串：

```python
source = "(add 1 (mul 2 3))"
```

字符串不会自己执行。解释器至少要经历下面几个阶段：

{% mermaid %}
flowchart TB
    A["Source<br/>(add 1 (mul 2 3))"] -->|Tokenizer| B["Token Stream<br/>LPAREN · NAME · NUMBER · …"]
    B -->|Parser| C["AST<br/>Call / Name / Number"]
    C -->|Validator · Normalizer| D["IR<br/>稳定的内部表示"]
    D -->|Evaluator| E["Runtime Value<br/>7"]
{% endmermaid %}

<p class="cp-figure-caption">同一段程序在不同阶段拥有不同表示；每一层只解决一种问题。</p>

这四层应始终分开理解：

| 层次 | 保存的内容 | 典型问题 |
|---|---|---|
| Source | 用户写出的字符 | 括号和空白怎样排列？ |
| Token | 最小语法单位 | `123` 是一个数字还是三个字符？ |
| AST | 表达式的层级结构 | 哪个调用嵌套在哪个调用中？ |
| Runtime value | 求值后的结果 | 这段表达式最终得到什么值？ |

第一篇只走到 AST。AST 仍然是程序的描述，不是程序的结果。

## 2. 先定义语言，再实现处理语言的程序

MiniExpr 当前只有三种表达式：

```text
number     := 整数或浮点数字面量
name       := 操作名，例如 add、mul
call       := "(" expression expression* ")"
expression := number | name | call
```

因此下面都是合法的语法结构：

```text
42
add
(add 1 2)
(add 1 (mul 2 3))
```

这里使用前缀形式，不是为了模仿 Scheme 的外观，而是为了让结构尽可能明显：左括号开始一个调用，第一个子表达式是操作，剩余子表达式是参数，右括号结束调用。

```text
(add 1 (mul 2 3))
 └─┬─┘ └────┬────┘
 operator   nested operand
```

语言规则必须先于解释器实现。否则代码中的分支只是偶然凑出某些结果，而没有明确说明什么输入合法、每种结构表示什么。

### 2.1 Syntax 与 Semantics

**Syntax（语法）** 规定程序可以写成什么结构；**semantics（语义）** 规定这些结构是什么意思。

```text
(mystery 1 2)
```

它的括号和参数结构符合 MiniExpr 语法，因此 Parser 可以成功生成 AST。但如果运行环境中没有 `mystery`，求值时仍然会失败。

```text
语法正确：能够构造 AST
语义有效：名字存在、参数数量正确、操作允许执行
```

Parser 的任务不是证明程序一定能运行，而是把文本转换成结构化表示，并拒绝结构不合法的输入。

## 3. Tokenizer 把字符整理成语法单位

**Lexical analysis（词法分析）** 负责把连续字符划分成 Token。Token 是 Parser 需要识别的最小单位。

```text
输入字符：  ( add 12 ( mul 2 3 ) )
              ↓
Token：     ( | add | 12 | ( | mul | 2 | 3 | ) | )
```

一个 Token 通常不只保存内容，还会保存种类和源码位置：

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Token:
    kind: str
    value: str | int | float | None
    start: int
    end: int
```

示例输出可以表示为：

```python
[
    Token("LPAREN", "(", 0, 1),
    Token("NAME", "add", 1, 4),
    Token("NUMBER", 1, 5, 6),
    Token("LPAREN", "(", 7, 8),
    Token("NAME", "mul", 8, 11),
    Token("NUMBER", 2, 12, 13),
    Token("NUMBER", 3, 14, 15),
    Token("RPAREN", ")", 15, 16),
    Token("RPAREN", ")", 16, 17),
    Token("EOF", None, 17, 17),
]
```

### 3.1 为什么不能直接按空格 `split`

下面两段源码的含义应该相同：

```text
(add 1 2)
(add 1(mul 2 3))
```

括号本身也是 Token，不一定与其他内容之间存在空格。简单的 `source.split()` 会把字符边界和语法边界混为一谈，也难以正确处理字符串、转义、注释和源码位置。

真正的 Tokenizer 通常逐字符前进：

```text
当前位置是空白   → 跳过
当前位置是 (    → 产生 LPAREN
当前位置是数字  → 连续读取完整数字
当前位置是字母  → 连续读取完整名字
其他字符        → 抛出 TokenizeError
```

MiniExpr 的 Tokenizer 很小；Python 自己的 Tokenizer 还要处理缩进、换行、字符串前缀、注释和更多运算符。原理不变：**把字符层的细节集中在词法分析阶段，让 Parser 面对稳定的 Token 序列。**

## 4. AST 只保留求值所需的结构

**AST（Abstract Syntax Tree，抽象语法树）** 用对象表示程序的结构。MiniExpr 目前只需要三种节点：

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import TypeAlias

@dataclass(frozen=True, slots=True)
class Number:
    value: int | float

@dataclass(frozen=True, slots=True)
class Name:
    identifier: str

@dataclass(frozen=True, slots=True)
class Call:
    operator: Expr
    arguments: tuple[Expr, ...]

Expr: TypeAlias = Number | Name | Call
```

源码：

```text
(add 1 (mul 2 3))
```

对应的 AST：

{% mermaid %}
flowchart TB
    ROOT["Call"] --> OP1["operator<br/>Name(add)"]
    ROOT --> ARGS1["arguments"]
    ARGS1 --> N1["Number(1)"]
    ARGS1 --> INNER["Call"]
    INNER --> OP2["operator<br/>Name(mul)"]
    INNER --> ARGS2["arguments"]
    ARGS2 --> N2["Number(2)"]
    ARGS2 --> N3["Number(3)"]
{% endmermaid %}

<p class="cp-figure-caption">括号完成使命后退出表示，真正保留下来的是调用之间的父子关系。</p>

AST 没有保存空格，也不需要保存每一对括号。括号在解析阶段决定层级，层级进入树结构后，括号本身就不再是求值必需的信息。

### 4.1 AST 节点比通用字典更适合表达约束

也可以用字典保存节点：

```python
{"type": "call", "operator": "add", "arguments": [1, 2]}
```

但专门的节点类型有几个优势：

- 字段名称和可选范围更明确；
- 静态检查器可以发现漏处理的节点类型；
- 构造节点时更容易验证不变量；
- 调试输出能直接反映程序结构；
- 不同阶段可以使用不同类型，避免“什么都装进一个字典”。

`frozen=True` 只保证这些节点的字段不能重新赋值，不会自动让所有内部对象深度不可变；这里同时使用 tuple 保存参数，才使整棵最小 AST 更接近不可变值。不可变 AST 便于共享、缓存和多次遍历，也减少分析阶段意外修改语法树的可能性。

## 5. Parser 把线性 Token 还原成递归结构

**Parsing（语法分析）** 消费 Token 序列，并按照语法规则创建 AST。

MiniExpr 的递归规则非常直接：

{% mermaid %}
flowchart TD
    START["parse_expression"] --> TOKEN{"查看当前 Token"}
    TOKEN -->|NUMBER| NUMBER["创建 Number"]
    TOKEN -->|NAME| NAME["创建 Name"]
    TOKEN -->|LPAREN| CALL["递归解析 operator 与 arguments"]
    CALL --> ENDING{"遇到 RPAREN？"}
    ENDING -->|否| CALL
    ENDING -->|是| NODE["创建 Call"]
    TOKEN -->|其他| ERROR["抛出 ParseError"]
{% endmermaid %}

核心结构可以写成：

```python
def parse_expression(tokens):
    token = tokens.pop()

    if token.kind == "NUMBER":
        return Number(token.value)

    if token.kind == "NAME":
        return Name(token.value)

    if token.kind == "LPAREN":
        operator = parse_expression(tokens)
        arguments = []

        while tokens.peek().kind != "RPAREN":
            if tokens.peek().kind == "EOF":
                raise ParseError("调用表达式缺少右括号")
            arguments.append(parse_expression(tokens))

        tokens.pop()  # 消费 RPAREN
        return Call(operator, tuple(arguments))

    raise ParseError(f"表达式不能以 {token.kind} 开始")
```

这里的 `tokens` 是一个带有 `peek()` 和 `pop()` 的 TokenStream。它封装当前位置，避免每层递归手动传递数组下标。

### 5.1 为什么 Parser 是递归的

解析外层调用时遇到：

```text
(mul 2 3)
```

它本身就是另一个完整表达式，应该使用同一套规则解析：

{% mermaid %}
flowchart TB
    OUTER["解析外层 add"] --> ONE["解析 Number(1)"]
    OUTER --> INNER["解析内层 mul"]
    INNER --> TWO["解析 Number(2)"]
    INNER --> THREE["解析 Number(3)"]
    TWO --> BUILD["构造 Call(mul, …)"]
    THREE --> BUILD
    ONE --> RESULT["构造 Call(add, …)"]
    BUILD --> RESULT
{% endmermaid %}

代码的递归结构对应语法的递归结构。这与处理 Tree 时的模式相同：每个节点只负责识别当前构造，再递归处理子结构。

### 5.2 顶层 Parser 还要拒绝多余输入

只调用一次 `parse_expression` 还不够：

```text
(add 1 2) (mul 3 4)
```

如果语言规定一次只能输入一个表达式，那么解析完第一个调用后必须确认下一个 Token 是 EOF：

```python
def parse(tokens):
    expression = parse_expression(tokens)
    if tokens.peek().kind != "EOF":
        raise ParseError("表达式结束后存在多余输入")
    return expression
```

“成功构造了一个节点”不代表“完整输入已经通过验证”。协议解析、配置解析和结构化消息处理也有同样的问题。

## 6. Concrete Syntax Tree、AST 与 IR 的分工

真实语言实现中经常出现三种树形表示：

| 表示 | 主要保留什么 | 常见用途 |
|---|---|---|
| CST / Parse Tree | 括号、标点等具体语法结构 | 格式化、源码重写、精确还原 |
| AST | 与程序含义相关的抽象结构 | 静态分析、解释、编译 |
| IR | 为后续处理规范化后的内部表示 | 优化、验证、执行、代码生成 |

AST 已经省略无关语法细节，但仍可能接近用户写法。IR 通常进一步消除等价写法带来的差异。例如：

{% mermaid %}
flowchart TB
    U["用户写法<br/>(+ 1 2)"] -->|parse| A["AST<br/>Call(Name(+), …)"]
    A -->|validate| V["校验：运算符必须已注册<br/>允许：+、-、*、/"]
    V -->|normalize| I["IR<br/>Invoke(add, …)"]
{% endmermaid %}

“已注册”是指解释器提前明确开放了哪些能力。例如，它可以把 `+`、`-`、`*`、`/` 登记到操作表中。校验阶段检查 AST 中的运算符是否在表内；读取文件、执行系统命令等未开放的操作会在这里被拒绝。随后，规范化阶段再把用户写的 `+` 转换为内部统一名称 `add`。

因此，IR 中的 `add` 已经是系统认可的操作编号或规范名称。后续执行器只处理这种受控表示，不需要直接执行用户输入，也不需要反复理解各种外部写法。

这条边界在工程中很实用：

```text
外部表示可以灵活
        ↓ parse + validate + normalize
内部表示必须稳定、明确、容易检查
```

## 7. 程序作为数据，不等于数据会自动执行

当源码被转换成 AST 后，程序就成为普通 Python 对象：可以打印、遍历、比较、缓存和改写。

```python
expression = Call(
    Name("add"),
    (
        Number(1),
        Call(Name("mul"), (Number(2), Number(3))),
    ),
)
```

我们可以统计节点数量：

```python
def count_nodes(expr: Expr) -> int:
    if isinstance(expr, (Number, Name)):
        return 1
    if isinstance(expr, Call):
        return 1 + count_nodes(expr.operator) + sum(
            count_nodes(argument) for argument in expr.arguments
        )
    raise TypeError(f"unknown node: {type(expr).__name__}")
```

也可以在执行前拒绝深度过大的树、收集所有被引用的名字，或者把某些节点替换成规范形式。这些操作处理的是程序的表示，还没有执行程序。

```text
AST 可遍历、可修改、可序列化
                ≠
AST 已经被赋予运行语义
```

下一篇的 Evaluator 才负责回答每种 AST 节点应该得到什么值。

## 8. 与 Python `ast` 的对应关系

Python 标准库可以直接生成 Python 表达式的 AST：

```python
import ast

tree = ast.parse("price * quantity + shipping", mode="eval")
print(ast.dump(tree, indent=2))
```

结果会包含 `Expression`、`BinOp`、`Name` 和 `Constant` 等节点。Python AST 比 MiniExpr 复杂得多，但分层关系相同：源码先被解析成对象树，后续工具再遍历或转换这些节点。

`ast.parse()` 成功只表示输入符合相应的 Python 语法，并不表示它符合某个应用的权限规则。若系统只允许算术表达式，还需要显式拒绝 `Call`、`Attribute`、`Import` 等不应出现的节点。

## 9. 解析边界在工程中的作用

解析器不只是“把字符串拆开”。它承担了外部输入进入核心系统前的第一层边界：

{% mermaid %}
flowchart TB
    INPUT["外部输入<br/>不可信 · 不稳定"] --> TOKENIZE["Tokenize<br/>字符是否合法"]
    TOKENIZE --> PARSE["Parse<br/>结构是否合法"]
    PARSE --> VALIDATE["Validate<br/>节点 · 字段 · 深度 · 权限"]
    VALIDATE --> NORMALIZE["Normalize<br/>统一内部表示"]
    NORMALIZE --> CORE["Core<br/>只处理已验证 IR"]
    TOKENIZE -.失败.-> REJECT["结构化错误"]
    PARSE -.失败.-> REJECT
    VALIDATE -.失败.-> REJECT
{% endmermaid %}

<p class="cp-figure-caption">解析边界的价值，是让核心逻辑不必反复防御原始输入。</p>

工程实现还应考虑：

- 为 Token 和 AST 保存行列位置，错误才能指向源头；
- 限制输入长度、节点数量和最大嵌套深度；
- 不要在 Parser 中访问数据库或执行外部操作；
- 不要把解析失败偷偷转换成空值继续运行；
- Tokenizer、Parser、Validator 和 Evaluator 分层测试；
- 日志记录结构化错误，不把敏感原始输入完整写入日志。

对于已经是 JSON 的输入，JSON Parser 只证明它是合法 JSON；应用仍然要把普通字典验证并转换成自己的命令或 IR 类型。**结构化输入减少了解析歧义，但不会自动提供业务语义和执行权限。**

## 10. 把本篇串起来

{% mermaid %}
mindmap
  root((程序成为数据))
    Source
      原始字符
      保留用户写法
    Token Stream
      线性语法单位
      带类型与位置
    AST
      恢复递归层级
      描述程序结构
    IR
      已验证
      已规范化
      供执行器依赖
{% endmermaid %}

需要保留的几个判断：

1. Tokenizer 识别“这是什么词”，Parser 识别“这些词组成什么结构”；
2. AST 描述程序，不是程序的执行结果；
3. 语法正确只代表能够构造结构，不代表名字存在、类型正确或操作获准执行；
4. Parser 的递归来自语言结构的递归，而不是实现者碰巧选择了递归；
5. 外部数据进入核心逻辑前，应先转换成约束明确的内部表示。

下一篇将在这棵 AST 上实现 Eval 与 Apply，说明解释器怎样真正赋予程序含义。

## 参考

- [Composing Programs 3.1：Introduction](https://www.composingprograms.com/pages/31-introduction.html)
- [Composing Programs 3.2：Functional Programming](https://www.composingprograms.com/pages/32-functional-programming.html)
- [Composing Programs 3.4：Interpreters for Languages with Combination](https://www.composingprograms.com/pages/34-interpreters-for-languages-with-combination.html)
- [Python 文档：`tokenize`](https://docs.python.org/3/library/tokenize.html)
- [Python 文档：`ast`](https://docs.python.org/3/library/ast.html)
