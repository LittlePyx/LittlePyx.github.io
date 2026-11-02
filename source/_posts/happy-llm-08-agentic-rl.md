---
title: Agentic RL：GRPO、OPD 与工具轨迹训练
date: 2026-11-02 10:10:00
updated: 2026-11-02 10:10:00
top_img: /img/happy-llm-agentic-rl-natgeo-cover.jpg
cover: /img/happy-llm-agentic-rl-natgeo-cover.jpg
cover_credit: "Jansen Wong · National Geographic My Shot"
cover_source: "https://www.nationalgeographic.com/photo-of-the-day/photo/mountain-reflection-tibet-pod"
description: Happy-LLM 第八章笔记：从轨迹和策略梯度出发，讲清 GRPO、OPD、Search-R1、ReTool，以及 observation mask、logprob 对齐和可复现评测。
categories:
  - Notes
  - AI Agent
tags:
  - Happy-LLM
  - Transformer
  - Inference
toc: true
toc_number: false
katex: false
llm_note: true
---

<p class="llm-cover-credit">封面：珠峰营地附近的山峰倒影 · 摄影 Jansen Wong / <a href="https://www.nationalgeographic.com/photo-of-the-day/photo/mountain-reflection-tibet-pod" target="_blank" rel="noopener noreferrer">National Geographic My Shot</a></p>

第七章把模型接到了检索和工具环境中，参数仍然可以保持不变。本章进一步讨论：保存模型实际走过的轨迹，用结果或教师反馈判断哪些动作值得鼓励，再通过梯度更新模型。环境执行循环和参数更新循环由此连接起来。

本篇对应 [Happy-LLM 第八章的固定快照](https://github.com/datawhalechina/happy-llm/blob/1e0b3a1e6f8936b8ba4bbd0673e8e2227d196c96/docs/chapter8/第八章%20大模型强化学习.md)，覆盖 GRPO、OPD、Search-R1 与 ReTool。沿用第四章的策略、概率比和参考模型概念，补清多轮轨迹中的信号来源、token 归属和实现约定。计算器和检查脚本使用人工数据，没有运行远程训练或报告模型效果。

<!-- more -->

## 1. 先把一次交互写成训练样本

### 1.1 状态、动作、观察与奖励

对自回归模型，给定历史 $h_t$，下一个 token 是动作 $a_t$，策略为 $\pi_\theta(a_t\mid h_t)$。若生成了一段工具请求，应用解析并执行它，再把环境观察 $o$ 加入后续历史。

| 内容 | 来源 | 在训练中的角色 |
| --- | --- | --- |
| 问题和系统约束 | 数据集或应用 | 初始条件 |
| 查询词、代码、回答 token | 模型策略 | 需要计算动作概率的部分 |
| 检索结果、运行输出、错误消息 | 环境 | 后续决策的条件 |
| 正确性、任务完成度、成本反馈 | 判题器或环境 | 奖励信号 |

一条完整轨迹 $\tau$ 可以交替包含模型生成片段和环境观察。设 $\mathcal A(\tau)$ 是模型动作 token 的位置集合，则用于策略更新的模型部分 log 概率为：

$$
\log\pi_\theta^{\mathrm{act}}(\tau)=\sum_{t\in\mathcal A(\tau)}\log\pi_\theta(a_t\mid h_t).
$$

环境转移同样属于完整轨迹分布，但在固定环境下不由模型参数控制。计算策略梯度时，只对模型生成动作的概率求导；环境返回的文字不能伪装成模型采样。

### 1.2 SFT 与 RL 的样本来源

SFT 通常提供期望回答，让模型模仿。RL 则从当前策略采样轨迹，再根据结果计算训练信号；模型会遇到自身产生的错误路径，包括错误查询、代码异常和无效重试。

对于固定环境和可积奖励，一个基本的 score-function 梯度形式为：

$$
\nabla_\theta J(\theta)=
\mathbb E_{\tau\sim\pi_\theta}\left[
(R(\tau)-b)\sum_{t\in\mathcal A(\tau)}\nabla_\theta\log\pi_\theta(a_t\mid h_t)
\right].
$$

这里 $b$ 是与采样动作无关的基线，用于降低方差。正系数倾向于提高相应动作概率，负系数倾向于降低它。GRPO 的同组样本基线和标准化是具体估计方案，不应直接当作上式严格无偏的同义替换。

RL 并不要求先有一份逐 token 标准轨迹，但必须有可用的反馈。若初始策略几乎无法产生合法动作或得到任何正奖励，通常需要更合适的起点、cold-start 样本或任务难度，而不是只增加训练步数。

## 2. GRPO：用同题样本构造相对优势

### 2.1 从奖励到优势

对同一个问题，使用冻结的 rollout 策略 $\pi_{\mathrm{old}}$ 采样 $G$ 条轨迹，得到奖励 $r_1,\ldots,r_G$：

$$
\bar r=\frac1G\sum_{i=1}^{G}r_i,\qquad
s_r=\sqrt{\frac1G\sum_{i=1}^{G}(r_i-\bar r)^2}.
$$

本文采用总体标准差，即分母为 $G$。经典的 outcome-supervision GRPO 使用组内标准化优势，整条回答的动作 token 共享同一个 $A_i$：

$$
A_i=\frac{r_i-\bar r}{s_r+\varepsilon}.
$$

它以同题样本为比较基准，省去独立训练的价值网络。[DeepSeekMath](https://arxiv.org/abs/2402.03300) 系统提出了 GRPO；这里主要讨论终局奖励版本，过程奖励可有不同的 token 级优势构造。

教材该快照的基础代码默认只做中心化 $A_i=r_i-\bar r$。两种写法符号一致，但尺度和跨组权重不同；论文目标与代码配置应分别记录，不能都只标记为“用了 GRPO”。

### 2.2 改变一组奖励，看优势怎样变化

下方假设同题生成 4 条回答，每条奖励只能为 0 或 1。勾选表示判题正确；可切换中心化与标准化。初始奖励为 $[1,0,0,1]$，中心化优势为 $[0.5,-0.5,-0.5,0.5]$，标准化后约为 $[1,-1,-1,1]$。

<div id="llm-grpo-lab" class="llm-grpo-lab">
<fieldset><legend>同一道题的四条回答 · 勾选为奖励 1</legend><div class="grpo-rewards"><label><input type="checkbox" name="reward" checked>回答 A</label><label><input type="checkbox" name="reward">回答 B</label><label><input type="checkbox" name="reward">回答 C</label><label><input type="checkbox" name="reward" checked>回答 D</label></div></fieldset>
<label class="grpo-normalize"><input type="checkbox" name="normalize" checked>除以组内标准差（不勾选则只减均值）</label>
<div class="grpo-scroll" tabindex="0" role="region" aria-label="奖励与优势对照表，可横向滚动"><table><thead><tr><th>回答</th><th>奖励</th><th>减去均值</th><th>最终优势</th></tr></thead><tbody><tr><th>A</th><td>1</td><td>+0.500</td><td>+1.000</td></tr><tr><th>B</th><td>0</td><td>−0.500</td><td>−1.000</td></tr><tr><th>C</th><td>0</td><td>−0.500</td><td>−1.000</td></tr><tr><th>D</th><td>1</td><td>+0.500</td><td>+1.000</td></tr></tbody></table></div>
<p class="grpo-stats" aria-live="polite" aria-atomic="true">均值 0.500，标准差 0.500。A、D 获得正优势，B、C 获得负优势。</p>
<p class="grpo-caption">人工构造，固定 G＝4，标准差分母为 G，ε＝10⁻⁸。只计算优势，不模拟模型训练或真实性能。</p><noscript>当前显示默认示例；启用 JavaScript 后可修改奖励。</noscript></div>
<link rel="stylesheet" href="/css/llm-grpo-lab.css">
<script src="/js/llm-grpo-lab.js" defer></script>

全对或全错时，中心化结果都为 0，这组数据没有奖励驱动的相对策略信号；如果训练另含 KL 正则，正则项仍可能产生梯度。加 $\varepsilon$ 只能避免除零，不能创造区分度。

应记录退化组比例。组内标准化可能放大方差很小的组，也会影响不同难度问题的权重；组大小、采样温度和任务分布都需一起观察。

## 3. 从优势到参数更新

### 3.1 当前策略、旧策略与参考策略

| 策略 | 作用 | 什么时候变化 |
| --- | --- | --- |
| $\pi_\theta$ | 计算当前概率、接收梯度 | 优化器更新时 |
| $\pi_{\mathrm{old}}$ | 产生本批 rollout，提供行为概率 | 收集新批次时刷新 |
| $\pi_{\mathrm{ref}}$ | 提供 KL 约束基准 | 通常固定，具体取决于训练方案 |

旧 logprob 必须绑定真实 token 和采样策略版本。更新后重新计算的概率不是 old logprob。温度、top-p 等改变采样分布时，也要明确框架记录的是原始分布还是采样分布的 logprob，并按实现的修正约定处理，不能混用两者。

对动作位置定义概率比：

$$
\rho_{i,t}(\theta)=\exp\left[
\log\pi_\theta(a_{i,t}\mid h_{i,t})-
\log\pi_{\mathrm{old}}(a_{i,t}\mid h_{i,t})\right].
$$

### 3.2 Clipping 与 KL 分别约束什么

令 $m_{i,t}\in\{0,1\}$ 标记模型动作位置，$L_i=\sum_t m_{i,t}$。一种按轨迹平均的截断目标写为：

$$
J_{\mathrm{clip}}=
\frac1G\sum_i\frac1{L_i}\sum_t m_{i,t}
\min\left(\rho_{i,t}A_i,
\operatorname{clip}(\rho_{i,t},1-\epsilon,1+\epsilon)A_i\right).
$$

$\epsilon$ 控制概率比截断范围，与优势分母中的 $\varepsilon$ 不是同一参数。优化时最大化 $J$，实现为 loss 时通常取负号。按轨迹平均会让长短轨迹具有相同总权重；按所有有效动作 token 平均则是另一种归约，不能只改分母却假定实验不变。

Clipping 限制继续朝特定方向改变概率比的收益，不是把参数或概率硬锁在某区间。另加参考 KL 正则时，优化 $J_{\mathrm{clip}}-\beta\overline{D}_{\mathrm{KL}}$，其中 $\beta\ge0$；它约束相对 reference 的分布偏移。裁剪与 KL 的基准和作用不同。[PPO 原始论文](https://arxiv.org/abs/1707.06347)

教材基础示例还可选择未裁剪的 importance-sampling 代理目标。组内优势、PPO clipping、参考 KL 是不同配置项；只有确认实现后，才能判断它是否完整复现原始 GRPO。

### 3.3 什么不应进入梯度

对固定批次，reward、old logprob、组内均值与优势通常作为常量。梯度经过当前策略的 logprob 回传，而不是通过离散判题过程、工具输出或已冻结的参考模型回传。

先检查一条短轨迹：初始新旧权重相同且概率计算条件一致时，$\rho$ 应接近 1；若训练尚未开始就大量偏离，优先查模型版本、模板、dropout／精度、采样变换和 token 位移，而不是立即调学习率。

## 4. OPD：在 Student 自己走到的前缀上学习

### 4.1 谁生成，谁评价

离线蒸馏常使用固定的 Teacher 输出，Student 主要学习那些轨迹。但 Student 自己生成时可能很早就偏离，进入训练数据未覆盖的前缀。

On-Policy Distillation 让 Student 先采样，再由 Teacher 对这些前缀提供反馈。Teacher 只前向计算，Student 接收梯度；Teacher 不必重新生成一份答案。[On-Policy Distillation／GKD](https://arxiv.org/abs/2306.13649)

| 问题 | GRPO 的终局奖励示例 | 本章 OPD 示例 |
| --- | --- | --- |
| 谁产生轨迹 | 当前策略 | 当前 Student |
| 谁提供反馈 | 判题器或环境 | Teacher 的 token 概率 |
| 反馈粒度 | 每条轨迹一个 reward | 每个动作 token 一个信号 |
| 关键依赖 | 有效且可靠的判题 | 同前缀、同 token 的概率可比较 |

OPD 是一类训练方式，不只包含一种 KL 或一种优化器；以下专门解释教材采用的 sampled reverse-KL 信号。

### 4.2 Reverse KL 与采样 token 的信号

在一个固定前缀 $h$ 上，设 Student 为 $p_\theta$，Teacher 为 $p_T$：

$$
D_{\mathrm{KL}}(p_\theta\|p_T)
=\sum_v p_\theta(v\mid h)
\log\frac{p_\theta(v\mid h)}{p_T(v\mid h)}.
$$

Student 从旧策略采到 token $a_t$ 后，教材用局部信号：

$$
d_t=\log p_{\mathrm{old}}(a_t\mid h_t)-\log p_T(a_t\mid h_t),\qquad
A_t=-\lambda d_t,
$$

其中 $\lambda>0$ 控制强度，并将 $A_t$ 视为停止梯度的训练权重。Teacher 相对更偏好的 token 获得正信号，Student 相对过度偏好的 token 获得负信号。

单个 $d_t$ 可以为负；KL 非负是对完整分布求期望后的性质。在固定前缀、按 Student 分布采样的条件下，log 概率比可以估计局部 reverse KL。<strong>把每个位置的局部差直接作为优势，是具体训练代理；它不自动等于包含所有未来状态分布变化的完整序列 KL 梯度。</strong>

Reverse KL 的拟合倾向与 forward KL 不同，Student 容量不足时也会影响保留哪些 Teacher 行为。不能只凭 KL 下降断言任务性能提高，仍需独立答案或执行评测。

### 4.3 对齐比公式更容易出错

Teacher 必须在同一前缀下评价同一目标 token。两边独立生成、独立套不同聊天模板后再逐位置相减，没有上述语义。

直接比较 token logprob 要求 token ID、词表含义和序列化兼容。Tokenizer 不兼容时，需要专门的跨词表或序列级方法，不能靠 padding 或长度裁剪修补。读取 SDK logprob 时还要确认它对应当前位置 token 还是下一 token；第一个 completion token 应作为边界测试。

教材快照使用 PyTRIO 0.2.6。接口会演进，笔记只保留算法和数据约束；具体字段应对照[该版本依赖](https://github.com/datawhalechina/happy-llm/blob/1e0b3a1e6f8936b8ba4bbd0673e8e2227d196c96/docs/chapter8/requirements.txt)与[官方损失说明](https://docs.pytrio.com/docs/guide/loss_fn)，不能仅凭 `loss_mean` 等名字猜测归约方式。

## 5. Search-R1：把检索放进可学习的轨迹

### 5.1 从固定 RAG 到搜索策略

固定 RAG 通常预先规定检索时机。Search-R1 将查询生成、检索结果和继续生成组织为多轮轨迹，让策略从任务结果学习何时搜索、搜什么以及何时结束。[Search-R1 论文](https://arxiv.org/abs/2503.09516)

在教学表示中，一条轨迹可以是：

| 次序 | 内容 | 来源 |
| --- | --- | --- |
| 1 | 问题与工具协议 | 应用 |
| 2 | 查询“设备 A 错误 E17 的处理条件” | 模型 |
| 3 | 文档片段、来源 ID 或空结果 | 搜索环境 |
| 4 | 补充查询，或根据证据回答 | 模型 |
| 5 | 判定答案或任务是否正确 | 评测环境 |

模型生成符合协议的搜索请求后暂停；应用解析、检索并将 observation 写回，再恢复生成。解析器必须处理不完整请求、超限查询、空结果和重复搜索，并规定步数、token 与时间预算。

### 5.2 搜索文本能被读取，但不作为动作训练

设拼接序列是“prompt、查询、搜索结果、最终回答”。查询与最终回答是策略动作，搜索结果是环境观察。Observation mask 将环境 token 排除在策略目标之外，但后续回答仍能通过注意力读取它们。

此处使用的是<strong>损失位置 mask</strong>，不是把搜索结果从输入删除，也不是禁止对其注意力访问。Observation token 的输入表示仍可能沿后续动作损失的依赖路径获得梯度。

工具协议中由程序插入的分隔符、工具结果和由模型真实生成的协议 token 应分别记录来源。不能解码所有内容后再用字符串搜索猜来源；同样的文本可能出现在不同角色中。

### 5.3 Reward 与环境快照

若最终答案评分不可靠，模型可能优化格式、答案抽取漏洞或容易得分的措辞。先保存基础策略 rollout，人工检查“回答、抽取结果、reward”，再扩大训练。

检索环境也需要版本：语料、索引、embedding、top-k、过滤和截断规则都能改变轨迹。比较两个 checkpoint 时若顺便更新了索引，就无法把结果差异只归因于策略训练。

搜索调用次数可以作为预算或代价，但惩罚过强可能让策略放弃必要检索。应同时测答案正确率、证据支持、无效查询、调用数量与延迟。

## 6. ReTool：从调用代码到利用执行反馈

### 6.1 训练的是工具使用策略

ReTool 将代码执行嵌入推理轨迹，先用 cold-start 数据帮助模型掌握协议，再通过结果反馈调整工具使用策略。[ReTool 论文](https://arxiv.org/abs/2504.11536)

写出合法代码只是一步：还要判断何时调用、如何把问题转为计算、如何阅读输出，以及报错后是否修正。原论文强调推理与代码解释器交互，不应直接等同于任意复杂软件工程 Agent。

| 场景 | 有用的反馈 | 需要避免的误判 |
| --- | --- | --- |
| 代码执行成功 | stdout、结构化结果 | 无异常不等于算对问题 |
| 语法或运行错误 | 错误类型与有限长度信息 | 不应把异常文本当成模型动作 |
| 超时或资源超限 | 明确终止状态 | 不应无限等候或自动重跑 |
| 最终答案错误 | 结果判题 | 不能仅凭调用了工具就给主要奖励 |

### 6.2 执行隔离是环境的一部分

生成代码应在受限环境运行：控制网络、文件系统、凭据、进程、CPU／内存、执行时长与输出大小。不要让训练脚本直接 `exec` 模型代码并共享宿主权限。

跨轮变量是否保留必须明确。状态式执行器可以复用变量，但会带来污染和不可复现风险；无状态执行器更容易隔离，却需要每次显式提供依赖。每条轨迹之间应隔离，评测也要使用相同约定。

容器本身不是完整的隔离策略，还需要资源限制、最小权限与网络策略。失败日志要能区分策略错误和环境故障：环境服务崩溃，不宜不加区分地当作模型能力低下的负样本。

### 6.3 Search-R1 与 ReTool 共用什么

两者都可以沿用分组 rollout、结果奖励、组内优势与策略更新，差别主要在动作协议、环境和判题。搜索返回资料，代码环境返回执行结果；两类 observation 都用于后续决策，但不作为策略生成目标。

同样的最终奖励分配给整条轨迹，只能提供粗粒度信用。答对不表示每次工具调用都必要；增加过程奖励则需要可靠的过程判定。应先用轨迹分析确认学到了什么，再解释奖励上升的原因。

## 7. Token 对齐：一张表把 mask 放对位置

### 7.1 Mask 应对齐目标 token

构造一个极短序列：prompt 为 $p_1,p_2$，模型生成查询 token $a$，环境返回 $o_1,o_2$，模型再生成回答 token $b$。训练输入右移后的配对是：

| 训练输入位置 | 要预测的 target | target 来源 | 策略 loss mask |
| --- | --- | --- | --- |
| $p_1$ | $p_2$ | prompt | 0 |
| $p_2$ | $a$ | 模型动作 | 1 |
| $a$ | $o_1$ | observation | 0 |
| $o_1$ | $o_2$ | observation | 0 |
| $o_2$ | $b$ | 模型动作 | 1 |

最后一行尤其重要：输入位置来自 observation，但它预测的是模型动作，因此 mask 为 1。应先标记完整序列中每个 token 的来源，再与 `target = tokens[1:]` 对齐；不能把输入位置的来源直接用作目标 mask。

### 7.2 一个可运行的对齐检查

下面代码只做数据检查，不调用模型、不执行生成代码。真实项目还需要记录每段生成的 old logprob、策略版本和停止原因。

```python
def align_targets(tokens, owners):
    if len(tokens) != len(owners) or len(tokens) < 2:
        raise ValueError("token 与来源必须等长，且至少两个位置")
    allowed = {"prompt", "action", "observation"}
    if any(owner not in allowed for owner in owners):
        raise ValueError("未知 token 来源")
    inputs = tokens[:-1]
    targets = tokens[1:]
    loss_mask = [int(owner == "action") for owner in owners[1:]]
    return inputs, targets, loss_mask

tokens = [11, 12, 21, 31, 32, 22]  # 人工 ID，不对应真实词表
owners = ["prompt", "prompt", "action", "observation", "observation", "action"]
inputs, targets, mask = align_targets(tokens, owners)
assert targets == [12, 21, 31, 32, 22]
assert mask == [0, 1, 0, 0, 1]
```

[下载完整的本地检查脚本](/labs/happy-llm/agentic_rl_checks.py)，其中还包含组内优势和 Pass@k 估计检查。运行它只能验证教学计算约定，不能证明远程 SDK 的对齐或训练实现正确。

### 7.3 拼接轨迹的实现约束

生成时就保存 token ID 和来源边界，避免解码再编码引起 token 数变化。程序插入的环境文本应以确定规则编码；续写请求实际使用的 token 前缀必须与训练重放一致。

Padding、prompt 和 observation 要从相应策略项中排除；KL 和归约分母也要使用约定的位置集合。不能仅令 observation 的 advantage 为 0，却仍让其计入有效 token 数或另一项损失，导致长工具输出改变训练尺度。

## 8. 从一次更新到稳定训练

### 8.1 先跑同步闭环，再谈吞吐

一个最小更新单元包含：固定 rollout 策略版本；生成同题轨迹组；保存动作 logprob；执行判题；构造优势和 mask；当前策略重放并反向；优化器更新；刷新下一轮采样权重。

同一 batch 内并发多个环境请求，只是执行并发，不必然造成 off-policy。若采样与训练重叠，旧采样器持续产出数据，就需要记录 policy lag、拒收过旧轨迹或采用相应校正。Clipping 不会自动修复任意陈旧数据。

### 8.2 有效训练量与失败恢复

一次“训练 step”可能含不同数量的题、group size、轨迹长度和有效动作 token。比较实验时记录实际更新量、丢弃组数量、rollout 总量与工具耗时，而不只比较 step 数。

检查点至少要保存策略权重、优化器、数据位置、随机状态和关键配置。训练权重、用于采样的权重及其版本号应能对应；中断后重试更新要避免同一批样本被无意执行两次优化。

教材使用远程采样与训练服务，调用未来对象或异步接口时，应等待前向反向和优化完成，再按版本创建采样器。不要把“请求已提交”当作“权重已更新”。复现代码见[第八章快照目录](https://github.com/datawhalechina/happy-llm/tree/1e0b3a1e6f8936b8ba4bbd0673e8e2227d196c96/docs/chapter8)。

### 8.3 训练日志怎样读

| 指标 | 主要用来发现什么 |
| --- | --- |
| 平均 reward、独立正确率 | 训练信号是否对应实际任务 |
| 全对／全错组比例 | 奖励是否缺乏区分度 |
| ratio 分布、clip fraction、参考 KL | 更新幅度、旧策略错配 |
| 生成长度、有效动作 token、截断率 | 长度偏移与有效监督变化 |
| 工具调用数、成功率、超时率 | 策略行为与环境故障 |
| 第一次失败后的恢复成功率 | 是否真正利用了反馈 |
| rollout／工具／训练各阶段耗时 | 实际吞吐瓶颈 |

只看 loss 不够。优势被重标定、归约改变或环境输出变长，都可能改变 loss 数值而不代表能力改进。

## 9. 评测：把采样收益与训练收益分开

同题生成 $n$ 条回答，其中 $c$ 条正确，平均正确率为 $c/n$；至少一条正确是另一个指标。若从这 $n$ 条中不放回选 $k$ 条，常用 Pass@k 估计为：

$$
\widehat{\operatorname{Pass@}k}=1-\frac{\binom{n-c}{k}}{\binom nk},\qquad 1\le k\le n.
$$

当 $n-c<k$ 时分子为 0。对所有题分别计算后再平均。这个估计依赖候选采样与评测协议，不能用相关性很强的人工挑选答案冒充独立采样；且它隐含知道哪条正确的判定能力，不代表线上系统一定能选中正确答案。[HumanEval／Pass@k 来源](https://arxiv.org/abs/2107.03374)

至少做以下对照：

| 对照 | 控制条件 |
| --- | --- |
| 训练前 vs 训练后 | 相同题集、环境、采样数、温度与预算 |
| 无工具 vs 有工具 | 固定生成设置，额外报告工具调用与延迟 |
| 固定 RAG vs 搜索策略 | 相同可访问语料及检索环境 |
| 中心化 vs 标准化优势 | 固定 reward、采样和归约，记录有效更新量 |

训练题与评测题应隔离，工具环境不能泄露答案。用多次运行或合适置信区间展示波动；更多样本、更长回答或更多工具调用带来的改进，应作为额外推理预算报告。

## 10. 常见追问

<details><summary>GRPO 为什么能不训练 Critic？</summary><p>它用同一道题多条轨迹的奖励构造相对基线和优势，不再单独拟合状态价值。代价是需要组内多样化采样；全同奖励时缺乏相对信号。</p></details>

<details><summary>全对组没有优势，是否意味着模型已经不需要训练？</summary><p>只能说明当前这组样本没有奖励差异。其他题、不同采样和分布外任务仍可能失败；独立评测与退化组统计需要同时看。</p></details>

<details><summary>Old policy 与 reference 是一回事吗？</summary><p>Old policy 负责生成当前批次，reference 提供约束基准。它们可能在初始化时相同，但后续更新节奏与用途不同。</p></details>

<details><summary>OPD 是让 Student 学 Teacher 新生成的答案吗？</summary><p>本章 OPD 让 Student 先生成，再让 Teacher 对 Student 的同一条轨迹评分。直接模仿预生成 Teacher 答案属于另一种蒸馏数据组织方式。</p></details>

<details><summary>为什么某个 token 的 reverse-KL 样本值可以是负数？</summary><p>它只是一个 log 概率比。KL 的非负性属于完整分布的期望，不适用于每个单独采样 token。</p></details>

<details><summary>工具结果被 mask 后，模型还能利用它吗？</summary><p>可以。它仍在上下文里，只是不作为策略动作计入对应损失。后续动作依赖它，所以相关计算仍可能收到梯度。</p></details>

<details><summary>能否只按“调用过工具”奖励 Agent？</summary><p>这样容易鼓励无效调用。应围绕正确结果和实际任务目标设计奖励，再用预算或代价约束无必要的执行。</p></details>

<details><summary>异步 rollout 一定是 off-policy 吗？</summary><p>不是。固定同一策略版本并发采样仍可保持一致；当训练更新与旧采样器重叠，才需要重点处理策略滞后及概率校正。</p></details>

上一篇：[大模型应用：评测、RAG 与 Agent 的工程闭环](/2026/11/02/happy-llm-07-evaluation-rag-agent/)。相关基础：[第四章的 PPO 与 DPO](/2026/10/12/happy-llm-04-training-and-alignment/)。
