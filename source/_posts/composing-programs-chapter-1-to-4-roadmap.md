---
title: "从函数到分布式系统：Composing Programs 第一至第四章总路线图"
date: 2026-09-08 10:00:00
top_img: /img/composing-programs-higher-order-functions-nature-cover.jpg
cover: /img/composing-programs-higher-order-functions-nature-cover.jpg
cover_credit: "Ge Xiao · National Geographic Your Shot"
cover_source: "https://www.nationalgeographic.com/photography/article/wildlife-gallery-yourshot"
description: 串联 Composing Programs 第一至第四章：从函数抽象、对象与状态，到解释器、惰性数据流、声明式系统和分布式计算，建立一张完整的程序设计知识地图。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Programming Abstraction
  - Software Engineering
toc: true
toc_number: false
---

<link rel="stylesheet" href="/css/composing-programs-roadmap.css">

这四章围绕程序的组织方式逐步展开：怎样组合函数、管理数据和状态、解释代码，以及协调多个任务。

这些内容通过抽象联系起来。函数封装计算步骤，数据接口隔离内部表示，解释器实现语言规则，执行框架负责调度与协作。调用者通过接口使用这些能力，实现细节则由各自的模块负责。

<div class="cp-series-hero">
  <span class="cp-series-hero__eyebrow">PROGRAMMING ABSTRACTION</span>
  <strong>从函数组合到多机协作</strong>
  <p>按章节梳理知识，再沿着变化、状态和契约回看它们的联系。</p>
</div>

## 1. 先看全局：四章分别扩大了哪一层边界

<div class="cp-series-route" aria-label="Composing Programs 第一至第四章学习路线">
  <a class="cp-series-route__step is-ch1" href="#chapter-1">
    <span>CHAPTER 01</span>
    <strong>行为抽象</strong>
    <small>把函数当作值，组合新的计算规则</small>
  </a>
  <a class="cp-series-route__step is-ch2" href="#chapter-2">
    <span>CHAPTER 02</span>
    <strong>数据与对象</strong>
    <small>通过接口使用数据，隔离内部表示的变化</small>
  </a>
  <a class="cp-series-route__step is-ch3" href="#chapter-3">
    <span>CHAPTER 03</span>
    <strong>程序与语义</strong>
    <small>把源码变成数据，再由运行时赋予含义</small>
  </a>
  <a class="cp-series-route__step is-ch4" href="#chapter-4">
    <span>CHAPTER 04</span>
    <strong>数据流与系统</strong>
    <small>把计算推迟、拆分，并交给多个执行单元</small>
  </a>
</div>

各章的重点和用途如下：

| 章节 | 主要概念 | 设计用途 |
|---|---|---|
| 第一章 | 一等函数、高阶函数与闭包 | 传递和组合行为，复用控制逻辑 |
| 第二章 | 数据契约、对象身份与协议 | 隔离表示变化，管理共享状态 |
| 第三章 | Token、AST、环境与求值规则 | 实现解释器、DSL 与受控执行 |
| 第四章 | 惰性数据流、声明、消息与任务 | 处理大量数据、并发与分布式失败 |

后面的章节会反复用到前面的机制：闭包可以保存状态，用来实现简单对象；解释器用数据结构表示程序；惰性管道通过迭代协议连接各个处理函数；分布式框架把函数交给不同节点执行。

<h2 id="chapter-1">2. 第一章：先学会抽象行为</h2>

普通函数把一组操作封装成一个名字；高阶函数更进一步，把“怎样计算”本身也变成输入或输出。于是程序不必反复复制循环、重试、过滤和转换的控制结构，只需要传入真正会变化的那部分行为。

核心关系是：

```text
函数是一等值
    ↓ 可以作为参数和返回值
高阶函数
    ↓ 返回的函数保留定义环境
闭包
    ↓ 多个小行为连接起来
函数组合、装饰器与可配置流程
```

闭包在这里是连接第一章和后续章节的关键。它既可以保存参数形成新的函数，也可以保存可变状态产生对象身份；第三章的用户函数同样需要把代码与定义环境一起保存，才能实现词法作用域。

<div class="cp-series-chapter is-ch1">
  <div class="cp-series-chapter__intro">
    <span>CHAPTER 01 · BEHAVIOR</span>
    <strong>先把变化的行为从固定流程中抽出来</strong>
    <p>通过 map、filter 和装饰器，理解函数怎样作为参数参与计算，以及多个行为怎样组合。</p>
  </div>
  <div class="cp-series-links">
    <a href="https://littlepyx.github.io/2026/07/28/composing-programs-higher-order-functions/">
      <span>01</span>
      <div><strong>高阶函数：从参数化数据到参数化行为</strong><small>一等函数、高阶函数、闭包、组合、柯里化与装饰器</small></div>
      <em>阅读全文 →</em>
    </a>
  </div>
</div>

<h2 id="chapter-2">3. 第二章：从值走向有边界的数据与对象</h2>

函数能组织计算，但程序还要长期保存和修改数据。第二章先用构造器与选择器建立抽象屏障，再引入可变状态和对象身份，最后解释 Python 的类系统怎样把这些机制组织成统一的属性访问协议。

理解数据与对象，需要分清四个层次：

1. **表示**决定数据在内部怎样保存，例如 tuple、dict 或实例字段；
2. **接口**规定调用者可以做什么，例如构造、查询、更新；
3. **不变量**规定什么状态始终合法；
4. **协议**让不同类型可以被同一段高层代码使用。

调用者直接读取内部字段，就会依赖具体表示；字段结构变化时，这些调用代码也要跟着修改。多个地方共同修改同一对象，还会引入别名、调用顺序和并发问题。设计接口时，需要明确哪些操作对外开放、哪些操作可以修改状态，以及修改后应满足哪些约束。

<div class="cp-series-chapter is-ch2">
  <div class="cp-series-chapter__intro">
    <span>CHAPTER 02 · DATA &amp; OBJECTS</span>
    <strong>数据的表示、状态与接口</strong>
    <p>先理解数据契约，再看状态怎样保存、类怎样组织属性，以及不同类型怎样共用接口。</p>
  </div>
  <div class="cp-series-links">
    <a href="https://littlepyx.github.io/2026/08/24/composing-programs-data-abstraction/">
      <span>01</span><div><strong>数据抽象：让程序依赖契约而不是表示</strong><small>构造器、选择器、抽象屏障、序列与递归数据</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/08/24/composing-programs-mutable-state/">
      <span>02</span><div><strong>可变状态：对象身份与消息传递从何而来</strong><small>绑定、变异、nonlocal、闭包状态、别名与消息分派</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/08/24/composing-programs-object-system/">
      <span>03</span><div><strong>对象系统：属性查找、方法绑定与类的实现</strong><small>实例、类、MRO、descriptor、bound method 与继承</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/08/24/composing-programs-object-abstraction-efficiency/">
      <span>04</span><div><strong>泛型操作：统一协议、表示选择与效率</strong><small>duck typing、Protocol、ABC、dispatch、coercion 与复杂度</small></div><em>阅读全文 →</em>
    </a>
  </div>
</div>

<h2 id="chapter-3">4. 第三章：把程序本身也变成研究对象</h2>

前两章默认 Python 已经知道每句代码是什么意思。第三章把这个前提拆开：源码最初只是一串字符，它必须先被解析成结构，再由求值器按照语言规则执行。

源码先经过词法分析和语法分析，成为 AST。之后，求值器与环境协作产生运行时结果：

| 部分 | 在这条路径中的职责 |
|---|---|
| Token → AST | 从字符中识别词法单位，再建立表达式的结构 |
| Validate / IR | 执行前可以增加校验，并按需要转换为中间表示；简单解释器也可以直接解释 AST |
| Eval | 按节点形式处理表达式；遇到名字就查询环境，遇到组合表达式就递归求值 |
| Apply | 在需要调用过程时，接收已经得到的过程与参数，执行内建操作或进入用户函数体 |
| Environment | 保存名字绑定，供求值过程查询；调用用户函数时，新建环境并绑定参数 |
| Value / Error | 计算完成后返回值，或在对应边界报告失败 |

Eval、Apply 和 Environment 是相互配合的机制。例如，Eval 处理调用表达式时会用到 Apply，而 Apply 执行用户函数体时又会回到 Eval。

这条链把“结构”和“含义”分开了。AST 只说明代码写成什么形状；Eval、Apply、作用域和运行时规则才决定它做什么。也正因为中间存在这些边界，工程上才可以在执行前做校验、转换、优化、权限限制和错误定位。

第三章还把第一章的闭包讲得更完整：一个用户函数不只有函数体，还必须保存定义时的环境。调用时创建的新 frame 负责本次参数，closure 指向的环境负责自由变量；这就是词法作用域能够成立的原因。

<div class="cp-series-chapter is-ch3">
  <div class="cp-series-chapter__intro">
    <span>CHAPTER 03 · LANGUAGE</span>
    <strong>让语法、语义和运行时各自承担清楚的责任</strong>
    <p>阅读解释器、规则引擎或模板系统时，可以沿着解析、求值和环境查找这条路径分析实现。</p>
  </div>
  <div class="cp-series-links">
    <a href="https://littlepyx.github.io/2026/08/27/composing-programs-source-to-ast/">
      <span>01</span><div><strong>程序如何成为数据：从源码到 Token、AST 与 IR</strong><small>词法分析、语法分析、结构校验与中间表示</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/08/27/composing-programs-evaluator-error-boundary/">
      <span>02</span><div><strong>求值器如何赋予语义：Eval、Apply 与错误边界</strong><small>表达式分派、特殊形式、过程调用、REPL 与错误分层</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/08/27/composing-programs-runtime-abstraction/">
      <span>03</span><div><strong>运行时如何支持抽象：环境、闭包、作用域与安全执行</strong><small>frame、lexical scope、执行预算、能力边界与可观测性</small></div><em>阅读全文 →</em>
    </a>
  </div>
</div>

<h2 id="chapter-4">5. 第四章：让计算跨越时间、数据规模与机器</h2>

第四章进一步考虑数据量和执行条件：数据可能放不进内存，结果可能晚些才需要，任务也可能交给其他线程、进程或机器。程序需要控制数据的产生速度、安排执行顺序，并处理协作过程中的失败。

四篇笔记分别讨论：

- **按需处理数据**：Iterator 与 Generator 让数据按需产生，消费端驱动整条 Pipeline；
- **声明计算目标**：SQL、Fact 与 Rule 描述目标，执行器选择扫描、连接或搜索路径；
- **跨机器协作**：本地调用变成消息后，需要处理超时、重试、重复和部分失败；
- **拆分与聚合任务**：并发组织等待，并行利用多个执行单元，MapReduce 按 key 拆分并重新聚合工作。

这些机制延续了前三章的设计方法。惰性 Pipeline 结合函数组合与迭代协议，声明式系统使用解析与求值机制；跨机器执行则进一步要求明确数据契约、状态更新方式和错误处理责任。

<div class="cp-series-chapter is-ch4">
  <div class="cp-series-chapter__intro">
    <span>CHAPTER 04 · SYSTEMS</span>
    <strong>安排执行时间、位置与失败恢复</strong>
    <p>接口之外还要设计时间、容量、失败语义和状态所有权。</p>
  </div>
  <div class="cp-series-links">
    <a href="https://littlepyx.github.io/2026/09/02/composing-programs-lazy-pipeline/">
      <span>01</span><div><strong>数据如何按需流动：Iterator、Generator 与惰性 Pipeline</strong><small>迭代协议、yield、惰性转换、终止操作与背压</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/09/02/composing-programs-declarative-unification/">
      <span>02</span><div><strong>从“怎样执行”到“满足什么”：SQL、逻辑规则与 Unification</strong><small>声明式接口、Fact、Rule、变量绑定、搜索与查询计划</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/09/02/composing-programs-distributed-reliability/">
      <span>03</span><div><strong>机器之间如何协作：消息、协议与分布式失败</strong><small>schema、deadline、timeout、retry、idempotency 与 tracing</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/09/02/composing-programs-parallel-mapreduce/">
      <span>04</span><div><strong>计算如何同时展开：并发、并行、MapReduce 与共享状态</strong><small>I/O 与 CPU、race、lock、queue、Map–Shuffle–Reduce</small></div><em>阅读全文 →</em>
    </a>
  </div>
</div>

## 6. 三条贯穿四章的主线

变化、状态和契约在四章中反复出现。沿着这三条线索，可以看清不同机制之间的联系。

<div class="cp-series-threads">
  <section>
    <span>THREAD 01</span>
    <strong>变化应该被放在哪里？</strong>
    <p><b>高阶函数</b>把变化放进函数参数，<b>数据抽象</b>把变化限制在接口实现，<b>解释器</b>把变化放进节点规则，<b>声明式与分布式系统</b>把执行策略交给运行时或框架。</p>
  </section>
  <section>
    <span>THREAD 02</span>
    <strong>状态由谁拥有？</strong>
    <p><b>闭包</b>保存局部环境，<b>对象</b>形成持久身份，<b>Environment</b>管理语言中的名字绑定，<b>并发与分布式系统</b>进一步要求锁、队列、事务、分区所有权和幂等更新。</p>
  </section>
  <section>
    <span>THREAD 03</span>
    <strong>调用双方依赖什么？</strong>
    <p>从<b>函数签名</b>到<b>对象协议</b>，再到<b>语言语义</b>和<b>网络 Schema</b>，依赖越来越正式。边界越远、失败成本越高，契约就越需要显式、可验证和可演进。</p>
  </section>
</div>

### 6.1 主线一：从复用代码到控制变化

函数可以复用一组语句，高阶函数还可以复用循环、过滤等控制结构，把具体行为留给参数决定。类似地，数据抽象允许替换内部表示，对象协议允许接入不同类型，解释器按节点规则处理表达式，声明式系统根据查询选择执行计划。

判断抽象是否有效，可以看一次具体的需求变更：**哪些代码需要修改，修改是否集中在负责这项功能的模块中。**

### 6.2 主线二：状态让时间进入程序

纯函数的结果只由输入决定；一旦引入可变状态，同一个调用在不同时刻可能得到不同结果。对象身份、迭代器位置、生成器暂停点、解释器环境、并发队列和分布式任务状态，本质上都在记录“系统已经走到哪里”。

这也解释了为什么后续章节不断强调状态边界：状态越多、拥有者越分散，程序越容易受到调用顺序、别名、竞争条件、重复消息和部分失败的影响。

### 6.3 主线三：距离越远，契约越重要

同一函数里的局部调用失败，调用栈通常足以定位问题；两个对象之间协作，需要清楚的公开 API；解释器执行用户输入，需要语法校验、资源预算和能力限制；跨机器发送消息，则还要定义版本、超时、重试和幂等语义。

跨进程、跨机器后，双方无法直接共享内存和调用栈，原先隐含的信息需要写进协议，例如参数含义、错误类型和超时后的处理方式。

## 7. 用一条完整路径把概念接起来

假设系统要持续接收文本请求，解析其中的规则，调用相应操作，并把结果可靠地交付出去。四章知识会自然落在同一条路径上：

<div class="cp-series-pipeline" aria-label="四章知识在一个请求处理系统中的连接方式">
  <div><span>01</span><strong>组合行为</strong><small>用函数与装饰器组织校验、转换和重试策略</small></div>
  <i>→</i>
  <div><span>02</span><strong>建立对象边界</strong><small>用协议表达请求、结果、工具与状态存储</small></div>
  <i>→</i>
  <div><span>03</span><strong>解析并赋予语义</strong><small>把文本变成 AST，校验后在受控环境中求值</small></div>
  <i>→</i>
  <div><span>04</span><strong>按需并可靠执行</strong><small>流式消费、并发调度，通过消息跨服务协作</small></div>
</div>

在这条路径里：

- 高阶函数让处理步骤可以独立替换和组合；
- 数据抽象与 Protocol 让上层只依赖能力，不绑定某个具体实现；
- AST、Eval 与 Environment 让外部规则先成为可检查的数据，再进入运行时；
- Generator 控制内存与消费速度，并发执行提高资源利用率；
- timeout、retry、idempotency 和 trace 让跨服务调用在失败时仍可恢复、可解释。

这些模块各自承担一部分工作，通过接口协作。例如，更换规则语法主要影响解析层，更换消息传输方式主要影响通信层；处理函数可以继续复用。

## 8. 容易混淆的概念，放在一起区分

| 容易混淆的概念 | 应该保留的区别 |
|---|---|
| 函数对象与函数调用 | 前者是可传递的行为，后者是一次执行产生的结果 |
| 闭包与对象 | 都能保存状态；闭包通过词法环境保存，对象通过实例身份和属性协议组织 |
| 接口与表示 | 接口描述允许怎样使用，表示决定内部怎样存储 |
| 类型注解与运行时校验 | 注解主要服务静态分析，运行时数据仍需显式验证 |
| AST 与执行结果 | AST 保存程序结构，求值器才根据语义产生结果 |
| Eval 与 Apply | Eval 解释表达式，Apply 调用已经求值得到的过程 |
| 惰性与异步 | 惰性决定何时产生值，异步决定等待期间是否让出执行权 |
| 并发与并行 | 并发关注多个任务推进，并行关注多个任务同时执行 |
| 超时与失败 | 超时只说明没有及时收到结果，远端可能未执行、正在执行或已经完成 |
| Retry 与幂等 | Retry 负责再次尝试，幂等负责让重复尝试不产生重复业务效果 |

## 9. 最后形成的程序设计判断

设计程序时，可以按以下顺序考虑：

1. 先找到会变化的部分，再决定把它放进函数、对象、规则还是执行策略；
2. 先定义调用者需要的最小能力，再选择内部数据结构和具体类型；
3. 一旦存在可变状态，就明确所有者、合法状态、修改入口和并发边界；
4. 面对外部输入，先解析成结构化数据，校验后再赋予执行能力；
5. 面对大量或持续数据，优先考虑按需产生、流式转换和背压；
6. 面对等待与计算，先区分 I/O-bound 和 CPU-bound，再选择并发或并行模型；
7. 一旦跨越进程或机器，就显式设计 schema、deadline、retry、idempotency 与 observability；
8. 评估抽象本身的成本，包括额外调用、内存占用、序列化和维护负担。

从第一章到第四章，程序设计的视角完成了一次扩展：

```text
组合函数
  → 组织数据与状态
    → 定义语言和运行时
      → 协调数据流、任务与机器
```

复习时可以从一个具体功能出发，依次追踪它调用了哪些函数、修改了哪些状态、经过哪些接口，以及失败后由谁处理，再回到对应文章查看细节。
