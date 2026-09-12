---
title: Transformer：注意力、网络结构与自回归推理
date: 2026-09-12 10:10:00
top_img: /img/happy-llm-transformer-natgeo-cover.jpg
cover: /img/happy-llm-transformer-natgeo-cover.jpg
cover_credit: "Jim Richardson · National Geographic"
cover_source: "https://www.nationalgeographic.com/photography/article/secrets-milky-way-richardson"
description: Happy-LLM 第二章笔记：从输入与位置表示出发，推导注意力、多头与完整网络，再理解训练、生成、KV Cache 和服务性能。
categories:
  - Notes
  - AI Agent
tags:
  - Happy-LLM
  - Transformer
  - Attention
  - Inference
toc: true
toc_number: false
katex: false
llm_note: true
updated: 2026-09-12 18:00:00
---

<p class="llm-cover-credit">封面：犹他州 Owachomo 天然石桥与银河 · 摄影 Jim Richardson / <a href="https://www.nationalgeographic.com/photography/article/secrets-milky-way-richardson" target="_blank" rel="noopener noreferrer">National Geographic</a></p>

一段文本经过 tokenizer 和 embedding 查表，得到一个形状为 $[B,T,D]$ 的张量。B 是批量大小，T 是 token 数，D 是每个位置的表示维度。此时每个向量仍来自固定查表；同一个 token 在不同句子里的基础表示相同。

Transformer 的主要工作，是逐层让这些表示结合上下文，再将它们映射为任务需要的输出。理解它既要看单次注意力怎样计算，也要看注意力与其他子层如何组成网络，以及训练、生成时的信息范围如何变化。

本篇对应 [Happy-LLM 第二章](https://datawhalechina.github.io/happy-llm/#/./chapter2/第二章%20Transformer架构)，以稠密 Transformer 为主，并延伸到自回归推理与缓存。

<div class="llm-intro"><strong>贯穿全文的数据结构</strong><p>输入是 token ID；embedding 将它变为逐位置向量；注意力混合位置之间的信息；前馈层变换每个位置的特征；堆叠后的表示再通过输出层产生标签或词表分布。</p></div>

<!-- more -->

## 1. 输入表示与位置

### 1.1 token ID 如何进入网络

令输入 ID 张量为 $I\in\{0,\ldots,V_{\mathrm{vocab}}-1\}^{B\times T}$，embedding 参数为 $E\in\mathbb R^{V_{\mathrm{vocab}}\times D}$。查表后得到 $X=E[I]\in\mathbb R^{B\times T\times D}$。

ID 只是词表索引，不携带有意义的大小关系；向量才是参与线性投影的数值表示。相同位置编号与相同 token ID 也是两回事：前者告诉模型符号出现在哪里，后者告诉模型输入了什么。

原始 Transformer 在输入 embedding 上叠加位置编码，并使用其规定的 embedding 缩放。现代模型的位置处理可能位于注意力内部，例如 RoPE，因此不能把一种实现的输入公式套到所有模型上。

### 1.2 顺序信息为什么需要单独处理
“设备连接电脑”和“电脑连接设备”包含相同的词，顺序却改变了关系。输入查表本身只识别 token，不能为同一个 token 区分它所在的位置。网络需要额外利用顺序信息。

原始 Transformer 将与 embedding 同维度的位置向量加到输入上。正弦编码按公式生成；可学习绝对位置编码则把位置表示作为参数表训练。下面先看正弦编码，介绍注意力后再讨论它的排列性质与 RoPE。

### 1.3 逐对看正弦与余弦

正弦编码可以正式写成：

$$
\begin{aligned}
\operatorname{PE}(p,2i)&=\sin(p\omega_i),\\
\operatorname{PE}(p,2i+1)&=\cos(p\omega_i),\\
\omega_i&=10000^{-2i/D}.
\end{aligned}
$$

设 D=8，前几对的角频率分别是 1、0.1、0.01。位置每增加 1，高频分量变化明显，低频分量变化较慢。一对 sin/cos 可以看作圆上的一个点：位置增加相当于按这个频率转动。

{% llm_demo position %}

把位置拖到 0，所有 sin 都是 0，cos 都是 1；移到 8，三组变化速度明显不同。多种频率共同编码位置，而不是把一个位置编号简单复制 D 次。

使用 sin/cos 还有相对位移的代数结构，例如 $\sin(p+\Delta)=\sin p\cos\Delta+\cos p\sin\Delta$。对固定偏移 Δ，新的 sin/cos 对可由原来的一对线性组合得到。这说明编码提供了可供网络利用的相对位移关系，但不保证训练出的网络一定能完美外推任意长度。

## 2. 自注意力：按内容读取其他位置

### 2.1 从独立向量到信息汇总

第一章的 embedding 查表得到一个向量，但它还没有结合当前句子。比如“仪器接入交换机后，它仍然无法联网”，“它”的含义要从前面的设备和句子结构判断；单独查“它”的 embedding 无法确定指代。

一种思路是按时间顺序维护隐藏状态，像 RNN 那样让后一个位置接收前一个位置的状态。但单个序列内的状态更新具有先后依赖，而且相距很远的两个位置需要经过多次传播。Attention 让当前位置直接对可见位置计算匹配权重，再按权重读取信息。

这里“直接”说的是一层内的信息路径，不意味着模型一定会找到正确关系。权重怎么计算、读回什么内容，都要通过训练学习；模型仍可能漏读重要信息或错误关联。

### 2.2 Query、Key、Value 与张量形状

设输入 `X` 的形状是 `[B, T, D]`：B 为 batch 大小，T 为序列长度，D 为模型隐藏维度。先忽略 batch 和多头，得到三个投影：

| 张量 | 单头形状 | 在计算中的职责 |
| --- | --- | --- |
| Q · Query | $T\times d_k$ | 当前每个位置如何发起匹配 |
| K · Key | $T\times d_k$ | 每个位置如何被匹配 |
| V · Value | $T\times d_v$ | 真正被加权汇总的信息 |
| S · Score | $T\times T$ | 每个 query 对每个 key 的匹配分数 |
| A · Weight | $T\times T$ | 沿 key 轴归一化后的权重 |
| O · Output | $T\times d_v$ | 汇总后得到的新表示 |

`Wq/Wk/Wv` 是训练得到的参数，Q/K/V 是每次前向传播的中间结果。Self-attention 的 Q/K/V 来自同一输入，但投影参数不同，因此三者通常不相等。

忽略 batch 的单头定义可以正式写成：

$$
\begin{aligned}
X&\in\mathbb{R}^{T\times D},\\
W_Q,W_K&\in\mathbb{R}^{D\times d_k},\quad W_V\in\mathbb{R}^{D\times d_v},\\
Q&=XW_Q,\quad K=XW_K,\quad V=XW_V.
\end{aligned}
$$

为什么 $Q$ 与 $K$ 的最后一维必须相同？因为每个分数是两个向量的点积，需要逐项相乘再求和。为什么 $V$ 可以使用不同的 $d_v$？因为它不是拿来和 Q 点积，而是在权重已确定后被做线性组合。

最终的注意力公式是：

$$
\operatorname{Attention}(Q,K,V)=\underbrace{\operatorname{softmax}_{\mathrm{key}}\!\left(\frac{QK^{\top}}{\sqrt{d_k}}+M\right)}_{A\in\mathbb{R}^{T\times T}}V.
$$

这个公式里有两个矩阵乘法，含义不同。第一个 $QK^\top$ 产生“每个 query 对每个 key 的分数”；第二个 $AV$ 用这些分数归一化后的权重汇总 value。<strong>权重矩阵不是输出表示，它只是决定如何混合信息。</strong>

Q 与 K 决定权重，V 决定汇总的内容。把它类比成“查资料”有助于入门，但网络没有被强制要求把某个头训练成语法分析器，注意力热图也不是完整的因果解释。

如果只看一个 query 位置 $i$：

$$
s_{ij}=\frac{q_i^\top k_j}{\sqrt{d_k}},\qquad
a_{ij}=\frac{e^{s_{ij}+m_{ij}}}{\sum_{r=1}^{T}e^{s_{ir}+m_{ir}}},\qquad
o_i=\sum_{j=1}^{T}a_{ij}v_j.
$$

$i$ 固定、$j$ 遍历可读取的位置。对每个 i 单独归一化，因此每一行的权重和为 1；并不要求每一列的和也为 1。这个轴的选择是手写 attention 时最常见的错误之一。

### 2.3 一个 query 的完整计算

取 `q=[1,0]`，三个 key 为 `[1,0]、[0,1]、[1,1]`，`dₖ=2`。

```text
点积：     [1, 0, 1]
缩放分数： [0.7071, 0, 0.7071]
softmax：  [0.4011, 0.1978, 0.4011]
```

若三个 value 为 `[1,0]、[0,2]、[2,1]`，输出约为 `[1.2033, 0.7967]`。它是向量的加权和，不是挑出一个词复制出来。

逐项展开可以看得更清楚：

$$
\begin{aligned}
o_{i,1}&=0.4011\times1+0.1978\times0+0.4011\times2\approx1.2033,\\
o_{i,2}&=0.4011\times0+0.1978\times2+0.4011\times1\approx0.7967.
\end{aligned}
$$

同一组权重作用在 V 的每个特征维度上。因此 softmax 的长度是可读取的位置数，输出向量的长度是 $d_v$。两者不一定相同。

### 2.4 分数缩放与数值稳定性

在 q、k 分量相互独立、均值 0、方差 1 的简化假设下，dₖ 项乘积之和的方差约为 dₖ。维度越高，未经缩放的点积容易过大，让 softmax 过于尖锐。除以 √dₖ 是控制尺度的方法，不是把点积变成余弦相似度。[Attention Is All You Need](https://arxiv.org/html/1706.03762v7)

实现 softmax 时先减去行最大值：`exp(s − max(s)) / sum(exp(s − max(s)))`。这是等价变换，可减少指数溢出。

等价性的原因是，分子分母都乘了同一个正数 $e^{-c}$：

$$
\frac{e^{s_j-c}}{\sum_r e^{s_r-c}}=\frac{e^{s_j}}{\sum_r e^{s_r}}.
$$

取 $c=\max_r s_r$ 时，最大的指数输入变成 0，其余不大于 0。对半精度推理，这种数值处理尤其值得关注；不过手写稳定 softmax 还不能替代对所有中间矩阵溢出情况的检查。

进一步理解缩放：假设每项乘积 $q_rk_r$ 方差为 1，且不同 r 的乘积独立，则求和后的方差是 $d_k$，标准差是 $\sqrt{d_k}$。所以除以的是平方根，不是 $d_k$。真实网络不完全满足这些独立分布假设，但它提供了一个有用的尺度设计依据。

### 2.5 位置编码与排列等变性

假设没有位置编码、没有因果等位置相关 mask，令 P 是一个排列矩阵，把 X 的 token 行打乱。自注意力满足 $\operatorname{SA}(PX)=P\operatorname{SA}(X)$：输出跟着输入位置一起打乱，这叫排列等变，不是所有输出都变成同一个向量。

因此模型知道“这些 token 是什么”，却缺少明确的“它们在什么位置”的额外坐标。如果还把所有输出做无序平均，打乱顺序甚至可能得到相同的整体结果。位置编码把“内容”和“位置”共同送入网络。

## 3. 可见性约束：因果与填充遮罩

自回归模型在位置 i 用已知前缀预测下一个 token。因此位置 i 可访问 `j ≤ i`，不能访问未来 `j > i`。通常 mask 在允许处为 0，禁止处为负无穷：

$$
M=\begin{bmatrix}0&-\infty&-\infty\\0&0&-\infty\\0&0&0\end{bmatrix},\qquad
M_{ij}=\begin{cases}0,&j\le i,\\-\infty,&j>i.\end{cases}
$$

矩阵的行是 query 位置，列是 key 位置；位置编号从 0 开始。

softmax 后禁止位置的权重为 0，其余位置重新归一化。<strong>先算 softmax 再简单把未来权重置零是不完整的</strong>，因为剩余权重之和通常不再等于 1。

Padding mask 解决不同长度样本补齐后的无效位置问题，与 causal mask 的目的不同。一个 batch 可能两者都需要。要避免某行所有 key 都被屏蔽，否则朴素 softmax 可能产生 NaN。

不同 API 对布尔 mask 的含义可能相反。PyTorch 的 `scaled_dot_product_attention` 将布尔 True 解释为允许参与注意力；不要将另一个 API 中“True 表示屏蔽”的 mask 直接复制过来。[PyTorch SDPA 文档](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html)

### 3.1 为什么允许看到自己，不算泄漏答案

这里的位置 $i$ 已经拿到了当前 token $x_i$，预测的是下一个 token $x_{i+1}$。因此它看到自己是合法的；不能看到的是标签对应的未来 token。如果某份材料把目标位置编号定义成“正在预测的位置”，写法可能看起来差一位，判断时要先检查输入和标签的对齐约定。

本例中位置 A 是第 0 个输入位置。开启因果遮罩后，它只能读取 A，权重从 `[0.4011, 0.1978, 0.4011]` 变成 `[1, 0, 0]`，输出自然等于 $V_A=[1,0]$。位置 C 已处于序列最后，可以读取 A/B/C，因此切换遮罩不会改变它这一行的结果。

{% llm_demo attention %}

建议做三次观察：第一次选择 A 并保留遮罩，从点积走到加权汇总；第二次关闭遮罩，比较 A 的输出；第三次选择 C，验证遮罩开关不改变最后一行。这样能同时检查“未来确实被阻止”和“历史没有被误屏蔽”。

### 3.2 Padding mask 与 loss mask 不能互相替代

假设一个 batch 里有长度 3 和长度 5 的两条文本。为了拼成一个张量，短文本会补两个 padding token。Key padding mask 阻止有效位置读取这些填充内容；loss mask 则让填充位置不贡献训练损失。

如果只忽略 padding 的损失，却允许有效 token 读取 padding，表示仍然可能被无效输入污染；如果只遮住 padding key，却计算 padding 位置的损失，就会训练模型去拟合不需要的目标。二者解决的是不同层的问题。

实践中可以用一个 `[B,1,1,T]` 的 key 有效性 mask 与 `[1,1,T,T]` 的因果 mask 广播组合，得到适用于 `[B,H,T,T]` 分数的可见性约束。需要单独考虑 padding query 行以及“整行都被屏蔽”的数值行为，不能只盯住三角形是否画对。

## 4. 多头注意力与张量布局

在常见实现中，头数 H 整除 D，令 `dₕ = D/H`：

| 操作 | 张量形状 | 容易写错的地方 |
| --- | --- | --- |
| 输入 X | `[B,T,D]` | T 是 token 数，不是字符数 |
| QKV 联合投影 | `[B,T,3D]` | 最后一维切分成三份 |
| 每份拆头并转置 | `[B,H,T,dₕ]` | 不是直接 reshape 成目标顺序 |
| Q @ K.transpose(-2,-1) | `[B,H,T,T]` | 只转置最后两个维度 |
| 权重乘 V | `[B,H,T,dₕ]` | softmax 应沿 key 轴 |
| 转回并合并头 | `[B,T,D]` | 非连续内存需要处理 |
| 输出投影 Wo | `[B,T,D]` | 多头结果需要再次混合 |

多个头通过不同的投影学习不同关系，但不能保证“第一个头只看语法，第二个头只看语义”。在固定 D 时，多头通常拆分每头维度，而不是给每个头完整复制一份 D 维计算。

### 4.1 多头公式与参数量

第 h 个头使用自己的投影：

$$
\mathrm{head}_h=\operatorname{Attention}(XW_Q^{(h)},XW_K^{(h)},XW_V^{(h)}).
$$

将各头输出在特征维拼接，再乘输出矩阵：

$$
\operatorname{MHA}(X)=\operatorname{Concat}(\mathrm{head}_1,\ldots,\mathrm{head}_H)W_O.
$$

常见设定是各头 $d_k=d_v=d_h=D/H$，所以拼接后恢复 D 维。在代码里，将全部头的 Q 投影合成一个 `Linear(D,D)`，再 reshape 拆分，可以与分别写 H 个投影实现同样的线性映射组织。Q/K/V 还常进一步合成 `Linear(D,3D)`，减少调用与便于优化。

在不计 bias 的普通 MHA 中，Q/K/V 三个投影加输出投影共有 $4D^2$ 个参数。固定 D 改变 H，通常不改变这部分参数量，但会改变每头维度和分数矩阵的形状。头数更多不是没有代价，也不自动保证效果更好。

{% llm_demo heads %}

### 4.2 为什么 reshape 后还要 transpose

`[B,T,D] → [B,T,H,d_h]` 是把每个 token 的特征切成 H 份；随后交换 T 与 H，才得到按头批量计算所需的 `[B,H,T,d_h]`。如果直接从 `[B,T,D]` reshape 成 `[B,H,T,d_h]`，虽然元素总数对得上，却重新解释了存储顺序，token 与头的对应关系可能错位。

合并时反过来：先从 `[B,H,T,d_h]` 转回 `[B,T,H,d_h]`，再合并最后两维。`transpose` 往往只改变视图的 stride，不重新排数据，所以后面接 `view` 前常需要 `contiguous()`。这是“公式一样、代码结果却不对”的典型来源。

### 4.3 RoPE：把位置关系引入匹配分数

绝对位置相加通常在输入阶段做 $X=E+P$；RoPE 则对 Q/K 的成对通道施加位置相关旋转。用二维旋转 $R_p$ 表示，有：

$$
(R_pq)^\top(R_sk)=q^\top R_{s-p}k.
$$

右边出现的是位置差 $s-p$，这帮助解释 RoPE 为什么与相对位置有关。实际实现使用多组频率，并要遵循模型具体的通道配对、旋转范围和位置索引约定。[RoFormer 原论文](https://arxiv.org/abs/2104.09864)

<strong>缓存复用时，token 内容与位置都要对齐。</strong>如果缓存中的 K 已按旧位置旋转，而新请求的位置编号不同，直接复用就可能改变点积。不能只检查“文本看起来差不多”。

因果遮罩也会带来结构上的顺序信息，但不能据此把位置处理从所有模型中随意删掉。

## 5. 组成一个 Transformer 层

### 5.1 FFN：每个位置独立做非线性变换

经典形式为 `FFN(x) = ReLU(xW₁ + b₁)W₂ + b₂`，形状走向为 `D → Dff → D`。同一层对所有 token 使用同一套 FFN 参数。Attention 混合位置之间的信息，FFN 变换每个位置的特征。现代模型可能采用门控激活；不能把 ReLU 当作所有模型的固定配置。

$$
\operatorname{FFN}(x)=\sigma(xW_1+b_1)W_2+b_2,\quad
W_1\in\mathbb{R}^{D\times D_{\mathrm{ff}}},\ W_2\in\mathbb{R}^{D_{\mathrm{ff}}\times D}.
$$

为什么中间要激活函数？如果两个线性层之间没有非线性，它们可以合并为一个线性变换，扩大中间维度不会带来同样的表达能力。为什么再降回 D？一方面使层与层接口一致，另一方面才能与原输入做残差相加。

“每个位置独立”不代表输出与其他 token 毫无关系：FFN 的输入通常已经经过 attention，包含上下文信息。它表示这一个子层本身不再沿 token 轴交换信息。

如果 $D_{\mathrm{ff}}=4D$，不计 bias 的两层 FFN 大约有 $8D^2$ 个参数，甚至多于 MHA 的 $4D^2$。所以理解 Transformer 不能只关注注意力热图；FFN 也是模型参数和计算的重要部分。

### 5.2 Residual：保留直接的信息和梯度通路

残差写成 `x + F(x)`，要求两边形状兼容。它让子层学习对已有表示的修正，并提供较直接的梯度传播路径，但不能保证任意深度训练都稳定。

从梯度看，$y=x+F(x)$ 的局部导数包含恒等项 $I+\partial F/\partial x$，提供了不完全依赖子层变换的通路。不要把它理解成“底层输出跳过所有计算，直接复制成最终答案”；残差和后续子层仍会一起改变表示。

### 5.3 LayerNorm：沿一个 token 的特征维度归一化

对于 `[B,T,D]` 使用 `LayerNorm(D)`，每个 `(b,t)` 独立统计 D 个特征：

γ、β 通常是 D 维可学习参数，不是跨所有层求均值，也不是强制把数据变成正态分布。手写时注意 population variance 与默认样本标准差的区别，以及 ε 应位于根号内。工程上优先使用框架实现。[PyTorch LayerNorm](https://docs.pytorch.org/docs/stable/generated/torch.nn.LayerNorm.html)

$$
\mu=\frac1D\sum_{r=1}^{D}x_r,\quad
\sigma^2=\frac1D\sum_{r=1}^{D}(x_r-\mu)^2,\quad
y_r=\gamma_r\frac{x_r-\mu}{\sqrt{\sigma^2+\epsilon}}+\beta_r.
$$

手算 $x=[1,2,3]$，有 $\mu=2$、$\sigma^2=2/3$。若暂时忽略 ε 并设 γ=1、β=0，输出约为 `[-1.2247,0,1.2247]`。它的均值为 0、方差为 1，但只有三个点，不能据此宣称它服从正态分布。再乘 γ、加 β 后，最终均值和方差也不必继续是 0 和 1。

对 `[B,T,D]` 使用 `LayerNorm(D)` 时，每个 token 自己统计这 D 个值，不依赖同 batch 的其他样本。这是理解它与 BatchNorm 区别的关键，比泛泛地说“让数据分布稳定”更有用。

### 5.4 归一化在子层前还是子层后

$$
\begin{aligned}
\text{Post-Norm:}\quad y&=\operatorname{LN}(x+F(x)),\\
\text{Pre-Norm:}\quad y&=x+F(\operatorname{LN}(x)).
\end{aligned}
$$

原始 Transformer 使用 Post-Norm；Pre-Norm 是另一种常见布局。

Happy-LLM 中的部分教学代码使用 Pre-Norm。对照原论文的图时，不能因归一化位置不同就认定代码完全等同于原始实现。本文后面的代码只实现注意力子层，不假装是完整 Transformer。

一层不带 cross-attention 的 Pre-Norm block 可以整理成：

$$
\begin{aligned}
H&=X+\operatorname{MHA}(\operatorname{LN}_1(X)),\\
Y&=H+\operatorname{FFN}(\operatorname{LN}_2(H)).
\end{aligned}
$$

两个 LN 通常有各自的参数。这张公式也能用来检查代码顺序：先保存残差支路，再归一化送入子层，最后相加。完整网络是否还在堆叠末尾添加最终归一化，要看具体架构，不能从一个 block 的局部公式自行推断。

## 6. 从子层到完整网络

| 架构 | 信息流 | 典型使用方式 |
| --- | --- | --- |
| Encoder-only | 输入内部双向注意力，仍需屏蔽 padding | 表示学习、分类、检索编码器 |
| Encoder–Decoder | 编码器读源文本；解码器做因果自注意力，再 cross-attention | 翻译等条件生成 |
| Decoder-only | 统一序列上的因果自注意力 | 自回归续写、对话与工具调用文本生成 |

原始 Transformer 是 Encoder–Decoder；它的 decoder 包含 cross-attention。这里 Q 来自 decoder，K/V 来自 encoder。常见 Decoder-only LLM 不带这组 encoder cross-attention。

六层 encoder 加六层 decoder 是原论文的一种配置，不是 Transformer 的定义。

### 6.1 Cross-attention 的长度可以不同

设源文本有 $T_s$ 个 token，目标侧当前有 $T_t$ 个 token。Cross-attention 的 Q 来自目标侧，K/V 来自源侧，所以单头分数形状是 $[T_t,T_s]$，不必是方阵。

每个目标位置是在问“为了产生这个位置的内容，应该从哪些源文本位置读取信息”。源文本在条件生成前就已给定，因此通常不需要对源侧施加目标自回归那种未来遮罩，但仍需要屏蔽源侧 padding。Decoder 的 causal self-attention 与 cross-attention 因此不能直接共用同一张方形 mask。

在 RAG 中把资料拼进 Decoder-only 模型的提示，并不会自动把它变成原始 Encoder–Decoder 架构。资料与问题通常只是同一序列里的不同片段，内部依然按照该模型的注意力结构处理。


### 6.2 层堆叠与输出头

原始 Transformer 的 encoder layer 包含 self-attention 与 FFN；decoder layer 在因果 self-attention 之外，还包含读取 encoder 输出的 cross-attention。每个子层配合残差与归一化。重复若干层以后，网络产生更深的上下文表示，而不是每层都直接输出一个词。

一个采用 Pre-Norm 的常见 Decoder-only 计算流程可以写为：

<div class="llm-network-map" aria-label="Decoder-only 网络的数据流"><div><span>输入</span><strong>Token ID → Embedding</strong><small>[B, T] → [B, T, D]</small></div><div class="llm-network-block"><span>重复 L 层</span><strong>Norm → 因果多头注意力 → 残差相加</strong><strong>Norm → 前馈网络 → 残差相加</strong><small>每层输入与输出都为 [B, T, D]；位置处理依具体架构加入</small></div><div><span>输出</span><strong>最终 Norm → 词表投影</strong><small>[B, T, D] → [B, T, Vocab]</small></div></div>

最终归一化与位置处理的具体形式依模型而定；上图用来说明一类完整计算流，不是原始 Encoder–Decoder 图的复刻。词表投影将隐藏维 D 转成候选 token 数 $V_{\mathrm{vocab}}$，输出每个位置的 logits。

若模型用于分类，可以在表示之后接分类头；若用于文本向量，可采用与训练目标匹配的池化。网络骨架与输出任务应分开理解，同一类骨架不只服务于下一 token 预测。

### 6.3 原始结构与常见变体

| 组件 | 原始 Transformer 的典型配置 | 后续常见变化 |
| --- | --- | --- |
| 网络组织 | Encoder–Decoder | Encoder-only、Decoder-only |
| 归一化 | Post-LayerNorm | Pre-LayerNorm、RMSNorm 等 |
| 前馈层 | 两个线性层与 ReLU | GELU、门控前馈层、专家结构等 |
| 位置 | 输入相加的正弦编码 | 可学习位置、相对位置、RoPE 等 |
| 注意力头 | MHA | MQA、GQA 等 |

这些变化不一定成套出现。读模型配置时应逐项确认，不能把“Transformer”视为唯一固定实现。本文的手写代码采用普通 MHA 与显式因果分数矩阵，未包含上述全部变体。


## 7. 从训练目标到自回归生成


### 7.1 标签右移、teacher forcing 与损失

考虑已经 token 化的序列 `[BOS, 设备, 无法, 联网, EOS]`。一次训练前向可以用前四个位置作为输入，后四个位置作为标签：

| 位置 | 当前输入 | 因果可见前缀 | 预测标签 |
| --- | --- | --- | --- |
| 0 | BOS | BOS | 设备 |
| 1 | 设备 | BOS, 设备 | 无法 |
| 2 | 无法 | BOS, 设备, 无法 | 联网 |
| 3 | 联网 | BOS, 设备, 无法, 联网 | EOS |

训练时把真实前缀提供给模型，称为 teacher forcing。因果 mask 使每个位置虽然与其他位置同时计算，却只能使用允许的信息，因此不等于泄漏下一 token 的标签。

对有效标签位置集合 $\mathcal T$，交叉熵可以写为：

$$
\mathcal L=-\frac1{|\mathcal T|}\sum_{t\in\mathcal T}\log P_\theta(x_{t+1}\mid x_{\le t}).
$$

推理时没有真实后继 token，必须使用自己刚选出的结果继续生成。于是早期输出错误可能改变后续上下文。训练和推理在这一点上的差别，也是为什么单次 token 预测损失不能完整描述多步生成的表现。


### 7.2 并行训练与顺序生成

训练时完整目标文本已经给定，通过右移标签和因果遮罩，可以同时计算各位置的下一个 token 预测。推理时下一个 token 尚未产生，需要先选择一个 token，追加到上下文，再继续。

最后的 hidden state 经词表投影得到 logits，再通过概率分布选取 token。贪心解码取最大值；采样可以先用 `logits / temperature` 调整分布。低温更集中，高温更分散；temperature 不等于事实准确度。停止条件可能是 EOS、停止串或输出长度上限。

### 7.3 从隐藏表示到下一个 token

输出层把最后位置的 $h_t\in\mathbb R^D$ 映射到词表大小 $|\mathcal V|$：

$$
z_t=h_tW_{\mathrm{vocab}}+b,\quad
P(x_{t+1}=v\mid x_{\le t})=\frac{\exp(z_{t,v}/\tau)}{\sum_u\exp(z_{t,u}/\tau)}.
$$

logit 可以为负，也不要求和为 1；概率经过 softmax 后才满足归一化。温度 τ 在这个公式中必须为正，贪心选择可以直接取 argmax，而不是把 τ=0 代入除法。Top-k 与 top-p 则是在词表分布上筛选候选的解码策略，和 attention 里对输入位置的权重不是同一个分布。

这也解释了工具调用的一层本质：模型首先产生表示工具名、参数等内容的 token；外部运行时再解析为结构化调用，校验并执行。Transformer 本身的矩阵乘法不会因为出现了工具名字，就直接访问设备报修系统。

{% llm_demo generation %}

Prefill 后已经预测出“检查”，但缓存里还只有三个输入位置；下一次把“检查”送入模型，才计算它的 K/V。这个“序列长度可能比已计算缓存长度多 1”的细节，能解释很多手写生成循环里的错位问题。

## 8. 实现与验证

下列实现保留显式分数矩阵，便于学习和检查；不包含位置编码、FFN、残差、padding、KV Cache 或完整语言模型。使用时输入是已经得到的 hidden states。

```python
import torch
from torch import nn

class CausalSelfAttention(nn.Module):
    def __init__(self, dim=32, heads=4):
        super().__init__()
        if heads <= 0 or dim <= 0 or dim % heads:
            raise ValueError("dim 必须是 heads 的正整数倍")
        self.heads = heads
        self.head_dim = dim // heads
        self.qkv = nn.Linear(dim, 3 * dim, bias=False)
        self.out = nn.Linear(dim, dim, bias=False)

    def forward(self, x):
        b, t, d = x.shape
        q, k, v = self.qkv(x).chunk(3, dim=-1)
        q, k, v = [z.reshape(b, t, self.heads, self.head_dim)
                    .transpose(1, 2) for z in (q, k, v)]
        scores = q @ k.transpose(-2, -1) / self.head_dim ** 0.5
        blocked = torch.ones(t, t, device=x.device,
                             dtype=torch.bool).triu(1)
        scores = scores.masked_fill(blocked, float("-inf"))
        weights = scores.softmax(dim=-1)
        y = (weights @ v).transpose(1, 2).contiguous().view(b, t, d)
        return self.out(y)

torch.manual_seed(7)
model = CausalSelfAttention().eval()
x = torch.randn(2, 5, 32)
with torch.no_grad():
    y = model(x)
    altered = x.clone()
    altered[:, 3:] += torch.randn_like(altered[:, 3:]) * 10
    y_altered = model(altered)
assert y.shape == (2, 5, 32)
# 修改未来输入，不应影响前 3 个位置的输出。
torch.testing.assert_close(y[:, :3], y_altered[:, :3])
print("shape and causal isolation: passed")
```

这项检查能发现反向遮罩或漏遮罩，而不只是检查输出形状。下载版本：[attention_demo.py](/labs/happy-llm/attention_demo.py)。需要安装 PyTorch；正文中的交互不依赖 Python。

### 8.1 沿着 forward 逐行检查

`self.qkv(x)` 将每个位置从 D 维投影成 3D 维，`chunk(3, dim=-1)` 沿特征轴拆成 Q、K、V。这里没有改变 token 顺序，也没有把三个投影分到不同 batch。

随后 `reshape(...).transpose(1,2)` 让张量进入 `[B,H,T,d_h]`。PyTorch 的批量矩阵乘法会对前面的 B、H 维分别计算，最后两维执行普通矩阵乘法，所以 `q @ k.transpose(-2,-1)` 自然得到 `[B,H,T,T]`。

`triu(1)` 选中主对角线上方的未来位置；对角线本身没有屏蔽。`masked_fill` 在 softmax 前填入负无穷，使未来权重变成 0。最后 `weights @ v` 完成信息读取，合并头并经 `self.out` 混合各头信息。

这里没有设置 dropout，是为了把因果隔离测试做成可重复的最小示例。如果加了随机 dropout，即使两个输入的可见前缀相同，两次前向也可能因为不同随机掩码而产生不同输出；测试时要固定随机过程或关闭 dropout。

### 8.2 除了形状，还应该测什么

| 检查 | 为什么有用 | 失败通常说明什么 |
| --- | --- | --- |
| 改未来 token，过去输出不变 | 验证因果信息隔离 | mask 缺失、方向反了、标签约定混乱 |
| 第一行开启因果 mask 后权重为 `[1,0,…]` | 验证边界与对角线 | 对角线误屏蔽、softmax 轴错误 |
| 与框架 SDPA 在相同配置下数值接近 | 对照独立实现 | 缩放、转置、mask 语义不同 |
| backward 后梯度有限 | 检查训练路径 | NaN、全屏蔽行、数值溢出 |
| 改 B/T 后仍然工作 | 排除硬编码尺寸 | reshape、广播或设备创建错误 |

数值对比应使用容差，不要求所有后端逐比特一致。低精度与融合核的计算顺序可能不同；但明显超过容差的差异不能简单归为“浮点误差”。

工程实现可考虑框架的 scaled dot-product attention，以便使用可用的优化后端。评估模式下，调用该函数仍应显式设置 `dropout_p=0.0`；不要假设函数自动读取模块的 `eval()` 状态。[SDPA 文档](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html)

在支持 SDPA 的 PyTorch 2.x 环境中，将已经拆头的 Q/K/V 传入时，等价的注意力核心可以写成以下片段。它省略了输入投影与输出合并，仅替换显式分数矩阵那几行：

```python
y_heads = torch.nn.functional.scaled_dot_product_attention(
    q, k, v,
    dropout_p=0.0,
    is_causal=True,
)
```

这段对应本节<strong>等长 Q/K 的完整序列自注意力</strong>。有 KV Cache 时 Q 长度可能为 1，K 长度却是整个历史；不要机械沿用同一个 `is_causal=True`。非方阵因果对齐需要按具体 API 行为与绝对位置构造可见范围，第 9 节给出缓存情况下的可见性分析。

本地验证环境为 PyTorch 1.12.1：上面的显式实现通过了因果隔离检查、三组形状的独立 NumPy 数值对照和有限梯度检查；该环境没有 SDPA API，因此没有把 SDPA 片段标作已在本地运行。使用优化接口前，应核对安装版本与设备支持情况。

可下载 [验证脚本 verify_attention.py](/labs/happy-llm/verify_attention.py)，与 `attention_demo.py` 放在同一目录，运行 `python verify_attention.py`。它用逐位置的 NumPy 参考计算对照批量矩阵实现，适合在你修改维度或代码后检查结果；需安装 NumPy 与 PyTorch。

## 9. 长序列计算与 KV Cache

稠密注意力的 `QKᵀ` 和 `AV` 计算约为 `O(BT²D)`；投影和 FFN 还包含约 `O(BTD²)` 的项，不能把整层成本简单全部写成 T²。

显式存储注意力分数需要 `[B,H,T,T]` 的空间。FlashAttention 等精确注意力实现通过分块与融合减少中间矩阵的显存读写，并不把一般稠密注意力的理论计算量变成线性。[FlashAttention 原论文](https://arxiv.org/abs/2205.14135)

### 9.1 计算量与临时显存

这三者经常被混成一句“attention 是平方复杂度”。对于一个普通稠密注意力层，忽略常数：

$$
\begin{aligned}
\text{QK}^{\top}\text{ 与 AV 的计算}&:\quad O(BT^2D),\\
\text{投影与常见 FFN 的计算}&:\quad O(BTD^2),\\
\text{显式分数张量的元素数}&:\quad BHT^2.
\end{aligned}
$$

假设 B=1、H=32、T=4096，单层一个显式分数矩阵就有 536,870,912 个元素；若每元素 2 字节，约为 1 GiB。这里还没有计算 softmax 的其他临时张量，也不是说所有优化实现都必须真的分配这块矩阵。这个数字解释了为什么减少中间张量读写如此重要。

当 T 翻倍，分数矩阵元素数增加到四倍；模型参数量则不因本次输入长度改变。KV Cache 又是另一类张量，下面会看到它通常沿 T 线性增长。

### 9.2 Prefill 与 decode

Prefill 对已知提示进行前向计算，并可建立各层 K/V 缓存。Decode 每步处理新增 token；它的 Q 仍要读取历史 K/V，但历史 token 的 K/V 可以复用。[Hugging Face 缓存说明](https://huggingface.co/docs/transformers/en/cache_explanation)

这里复用的是中间张量。KV Cache 不会修改模型权重，也不是保存业务知识的长期记忆数据库。缓存能否复用依赖模型、token 前缀、位置等条件。

### 9.3 为什么历史 K/V 可以复用，Q 通常不用缓存

在确定性的因果模型推理中，旧位置的表示只依赖它自己及更早的 token。追加一个新 token 不会改变旧位置可见的前缀，所以旧位置经过每层投影产生的 K/V 也不会因这个追加动作改变。缓存正是利用了这条不变性。

第 $t+1$ 步只需要最新位置的 query 去读取已有 key/value：

$$
\begin{aligned}
K_{\le t+1}&=[K_{\le t};k_{t+1}],\\
V_{\le t+1}&=[V_{\le t};v_{t+1}],\\
o_{t+1}&=\operatorname{softmax}\!\left(\frac{q_{t+1}K_{\le t+1}^{\top}}{\sqrt{d_k}}\right)V_{\le t+1}.
\end{aligned}
$$

旧 query 已经完成过其位置的输出计算，未来 token 读取的是旧 key/value，不需要再用旧 query 发起匹配。因此常规生成缓存存 K/V，而不是把过去所有 Q 一并保存。

注意，这些缓存存在于<strong>每一层</strong>，并不只有输入层一份。新 token 仍要依次经过模型各层的投影、attention 与 FFN；KV Cache 没有省掉新 token 的整个前向，也没有免掉读取历史 K/V 的开销。

### 9.4 带缓存的 mask 为什么容易错一位

完整序列训练时，Q 和 K 都长 T，用下三角 mask 即可。但单 token decode 时，Q 长度为 1，K 可能已经长 4097。这个 query 的真实位置是最后一个位置，它应当能读取所有历史以及自己的 key。

如果某个 API 的非方阵因果 mask 按左上角对齐，一张 `[1,4097]` 的下三角矩阵就只放行第一个 key，显然不符合这个 query 的绝对位置。对“仅一个最新 query、全部 key 都是合法历史且没有 padding”的情况，本次计算可以不再加三角遮罩；若有分块 decode、padding 或滑动窗口，则要根据真实位置构造 mask。

这就是代码不能只看到 `is_causal` 这个参数名就照搬的原因：<strong>因果性约束的是绝对位置之间的关系，不是任何长方形张量上机械画一个三角形。</strong>[PyTorch SDPA 非方阵因果说明](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html)

### 9.5 KV Cache 的体积

对所有层形状一致、未压缩、未分片的常规缓存：

| 因子 | 含义 | 本例取值 |
| --- | --- | --- |
| 2 | K 与 V 两份张量 | 2 |
| L | 模型层数 | 32 |
| B | 缓存的序列数 | 1 |
| T | 每条序列缓存 token 数 | 4096 |
| $H_{\mathrm{KV}}$ | 每层 KV 头数 | 8 |
| $d_h$ | 每头特征维度 | 128 |
| s | 每个元素所占字节数 | 2 |

例如 L=32、B=1、T=4096、Hkv=8、dₕ=128、s=2，理论值为 536,870,912 字节，即 0.5 GiB。若 Hkv=32 则为 2 GiB。MHA 中 Q 头与 KV 头数相同；GQA 让一组 Q 头共享 K/V，以减少缓存体积。[GQA 原论文](https://arxiv.org/abs/2305.13245)

这不是整张显卡的占用：还需要模型权重、临时激活、运行时缓冲与分配开销；量化缓存还有元数据，滑动窗口、前缀共享和分片也会改变实际占用。

从一个位置开始计算：一层、一个序列、一个 token 的 K 有 $H_{\mathrm{KV}}d_h$ 个元素，V 也有同样多，因此先乘 2；保留 T 个位置乘 T；B 条同长度序列乘 B；L 层乘 L；最后乘每元素 s 字节。

$$
M_{\mathrm{KV}}=2\times L\times B\times T\times H_{\mathrm{KV}}\times d_h\times s.
$$

如果每条序列长度不同，更准确的未填充估计是把 $BT$ 替换成 $\sum_b T_b$；实际服务是否按最大长度预分配、按页管理或共享前缀，会影响真实占用，必须结合实现观测。

{% llm_demo cache %}

先保持默认参数，把 token 数从 4096 调到 8192，观察 0.5 GiB 变成 1 GiB；再把 B 从 1 调到 2，变成 2 GiB。最后切换到 32 个 KV 头，此时变为 8 GiB。这三个变化对应长度、并发与模型架构三个不同的资源维度。

模型训练时确定的 KV 头结构不是通常可以在服务时随便拖动的参数。这里的下拉框是在比较不同架构的理论结果；实际选择 GQA/MQA 模型还要评估任务质量，不能只看缓存更小。

## 10. 多步调用中的性能与状态

一次多步应用请求通常包括模型等待与生成、工具调用、结果解析及后续模型调用。多轮把历史、工具 schema 和结果不断追加，输入 token 数可能持续增长；顺序依赖也会累计端到端延迟。

应分别记录：输入/输出 token 数、首 token 延迟 TTFT、后续生成速度、每个工具的耗时和错误，以及完成整个任务的总耗时。模型接口测到的 TTFT 还可能包含排队、网络和服务调度，不能全部归因于 prefill。

| 现象 | 首先验证 | 可尝试的工程改进 |
| --- | --- | --- |
| 首字等待明显变长 | 提示是否变长，是否在排队 | 去重上下文、压缩工具结果、利用服务支持的前缀缓存 |
| 长回答慢 | 输出 token 数和单 token 时间 | 精简必要输出、设合理上限、流式返回 |
| 并发增加后显存不足 | KV Cache、batch、权重占用 | 控制并发/长度，选合适 KV 架构与服务配置 |
| 工具调用反复循环 | 停止条件、错误处理、重复动作 | 限制步数，保留执行状态，使用幂等键 |

压缩上下文也有代价：摘要可能丢掉条件，检索可能漏掉证据。因此优化报告必须同时给出任务成功率、延迟分位数和资源指标，避免只展示“更快了”。

### 10.1 端到端耗时的分解

假设有 R 次顺序依赖的模型调用，端到端时间可以粗略拆成：

$$
T_{\mathrm{task}}\approx\sum_{r=1}^{R}\left(T_{\mathrm{queue},r}+T_{\mathrm{prefill},r}+T_{\mathrm{decode},r}+T_{\mathrm{tool},r}\right)+T_{\mathrm{other}}.
$$

真实系统中可能有网络与计算重叠、工具并行等情况，这个式子用来建立测量边界，不是精确调度模拟。若某次工具调用等待了 4 秒，而模型生成只用 1 秒，把 attention 加速 20% 也不可能让整项任务快一倍。

TTFT 是请求发出到首 token 到达的时间；服务端纯 prefill 时间只是其中可能的一部分。后续生成可用 tokens/s 或 token 间延迟描述，报告时要声明是否包含首 token 等待、是否含网络、输出 token 数如何计算。否则两个看似相同的“吞吐量”指标可能并不在比较同一件事。

### 10.2 上下文保留与外部状态

设备助手每轮若原样附带一大段设备日志，历史会迅速增长。删除日志可以降低预算，却可能丢失唯一的错误码；摘要可以压缩长度，却可能删掉“先别报修”这样的约束。比较合理的设计是分层保存：原始日志留在外部存储，当前上下文保留关键事件、可追溯引用与已确认状态，必要时再取回详细证据。

还应把“长期记忆”和“推理缓存”分开。用户偏好、设备维修历史属于业务数据，需要存储、检索、更新与访问控制；KV Cache 属于一次或可复用前缀的模型计算状态。丢掉缓存通常影响速度，丢掉业务事实则可能影响正确性。

### 10.3 测量口径与对照实验

先固定模型、硬件、服务版本、生成策略和输出长度策略，在相同并发下比较 512、2048、8192 token 的输入。输入长度用真实 tokenizer 测量，不能用重复多少段中文来近似。记录请求实际 usage；若模型提前输出 EOS，不能把不同输出长度的总耗时直接当作纯输入长度效应。

每组先预热，再进行多次请求，保存每次原始数据，而不只抄一个均值。缓存命中与未命中的请求分开统计，明确服务是否复用了前缀。对于小样本的高分位数要谨慎解释，不要用三次请求声称稳定的 p99。

建议最少保存这些字段：`run_id、input_tokens、output_tokens、concurrency、ttft_ms、total_ms、cache_hit、peak_memory、task_success`。最后将曲线变化与本节的假设对照：输入更长是否主要影响首 token，输出更长是否累积 decode 时间，并发更高是否首先触发缓存或调度瓶颈。这些观测用于区分长度、调度与计算本身带来的变化。


## 11. 常见追问

<details><summary>为什么 Q、K、V 需要不同投影？可以令它们相同吗？</summary><p>三者承担匹配发起、匹配索引和内容汇总的不同角色。不同投影让模型分别学习这些表示；相同输入来源不要求投影相同。令投影相同也能定义一种运算，但会限制参数化方式，通常不再是所讨论的标准结构。</p></details>

<details><summary>注意力分数为什么除以维度的平方根，而不是维度本身？</summary><p>在分量独立、零均值、单位方差的简化条件下，点积方差与维度成正比，标准差与维度平方根成正比。该缩放用于控制分数尺度，并不把点积变成余弦相似度。</p></details>

<details><summary>多头与单个更宽的头有什么区别？</summary><p>多头分别投影并分别做 softmax，再拼接与输出投影；一个宽头只产生一套位置权重。由于归一化独立且包含非线性，两者通常不能仅通过重排维度视为相同。固定 D 时，常规多头投影参数量可以不变，但分数矩阵体积随头数变化。</p></details>

<details><summary>Attention 后为什么还需要 FFN？</summary><p>Attention 主要按输入相关的权重混合位置信息，FFN 对每个位置做非线性特征变换。FFN 中间扩大特征维度，随后恢复 D 维以保持残差接口；它本身不沿 token 轴交换信息，但输入已包含上下文。</p></details>

<details><summary>LayerNorm 与 BatchNorm 的统计轴有什么区别？</summary><p>对 [B,T,D] 使用 LayerNorm(D)，均值和方差在每个 token 的 D 个特征上计算，不依赖其他 batch 样本。BatchNorm 则按指定通道组织跨样本等维度的统计。不能只记“一个按层，一个按批次”，应先明确张量布局。</p></details>

<details><summary>KV Cache 为什么不缓存 Q？哪些情况下不能复用旧缓存？</summary><p>未来 query 读取的是历史 K/V，旧 query 已完成自己位置的输出计算。常规追加式因果推理可复用历史缓存；修改前缀、模型参数、位置编号或其他影响计算的条件后，原缓存通常不能直接沿用。</p></details>

<details><summary>FlashAttention 是否近似 attention，是否消除了平方计算量？</summary><p>它属于精确注意力算法，通过分块、融合和在线 softmax 减少中间存储与显存读写。浮点计算顺序可以产生数值差异，但其目标不是删掉部分 key 或近似稀疏化；一般稠密注意力的计算量仍有平方项。</p></details>

<details><summary>怎样区分模型慢、上下文太长与工具慢？</summary><p>分别记录排队或网络边界、首 token 延迟、后续 token 时间、输入输出长度及工具耗时。再控制变量比较。总耗时是多个阶段共同作用的结果，不能仅凭一次请求变慢就认定 attention 是瓶颈。</p></details>

上一篇：[NLP 基础：文本编码、表示学习与语言模型](/2026/09/12/happy-llm-01-nlp-for-agent/)。
