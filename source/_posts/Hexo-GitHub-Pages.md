---
title: Hexo + GitHub 博客搭建教程
date: 2026-01-20 17:32:53
categories:
  - Tutorial
tags:
  - Technology
cover: /img/hexo-github-pages-natgeo-cover.jpg
cover_credit: "Keith Ladzinski · National Geographic"
cover_source: "https://www.nationalgeographic.com/photography/article/how-to-take-photos-at-night"
toc: true
katex: true
---

# 创建项目

本博客基于 **Hexo + GitHub Pages** 构建，Hexo 是一个快速、简洁且高效的静态博客框架，适合用于技术笔记、科研记录与个人博客。

在开始之前，请确保本地已安装：

- Node.js（建议 LTS 版本）
- npm
- Git

在任意工作目录下创建 Hexo 项目：

```sh
npm install -g hexo-cli
hexo init blog
cd blog
npm install
```

启动本地预览，确认环境正常：

```sh
hexo s
```

浏览器访问 `http://localhost:4000`，若能看到默认页面，说明项目创建成功。

------

# 克隆 Hexo 主题（以 Butterfly 为例）

本文选用 **Butterfly** 主题，原因是：

- 配置灵活，文档完善
- 原生支持 MathJax / KaTeX
- 社区活跃，长期维护

在博客根目录执行：

```sh
git clone https://github.com/jerryc127/hexo-theme-butterfly.git themes/Butterfly
```

然后在博客根目录的 `_config.yml` 中修改主题配置：

```yaml
theme: Butterfly
```

安装主题依赖（如果有）：

```sh
npm install
```

此时重新运行：

```sh
hexo s
```

若页面样式变为 Butterfly 主题，说明主题安装成功。

------

# 写配置文件

Hexo 的配置主要分为两部分：

- **站点配置**：`_config.yml`
- **主题配置**：`_config.Butterfly.yml`

推荐做法是：
👉 **将主题配置从主题目录复制到根目录进行覆盖式配置**

```sh
cp themes/Butterfly/_config.yml _config.Butterfly.yml
```

之后所有主题相关配置，统一写在 `_config.Butterfly.yml` 中。

常用基础配置示例（修改为自己的）：

```yaml
title: 小P的猫舍
subtitle: 爱玩毛线爱贴贴
description: 小P的学习、研究、生活记录
language: zh-CN
timezone: Asia/Shanghai

author:
  name: LittlePyx
  link: https://github.com/LittlePyx
```

这样可以避免后续主题更新时配置被覆盖，其余美化配置可到模板官网进行查看。

------

# 图片存放

推荐将图片放在 `source/img/` 目录下，例如：

```text
source/
├── img/
│   ├── avatar.jpg
│   ├── cover.jpg
│   └── post/
│       └── example.png
```

在文章中使用图片时：

```markdown
![示例图片](/img/post/example.png)
```

Butterfly 主题对图片支持良好，配合懒加载、缩放效果，体验较佳。

------

# 新建文章（正式笔记）

Hexo 使用命令行创建文章，生成的文件会被视为**正式发布内容**。

在博客根目录下执行：

```sh
hexo new "文章标题"
```

该命令会在以下路径生成 Markdown 文件：

```text
source/_posts/文章标题.md
```

新建的文章会自动包含默认的 front-matter，例如：

```yaml
---
title: 文章标题
date: 2025-03-08 10:00:00
---
```

文章内容编辑完成后，可通过以下命令本地预览：

```sh
hexo s
```

并在部署后同步发布到线上站点。

------

# 草稿（Draft）

对于尚未完成、暂不希望发布的内容，可使用 Hexo 的草稿机制。

## 新建草稿

在博客根目录执行：

```sh
hexo new draft "草稿标题"
```

草稿会被生成在：

```text
source/_drafts/草稿标题.md
```

位于 `_drafts` 目录下的文件**默认不会被渲染或部署**。

## 本地预览草稿

若需要在本地查看草稿内容，可使用：

```sh
hexo s --draft
```

或：

```sh
hexo g --draft
```

此时草稿仅在本地参与渲染，不会影响正式发布内容。

## 草稿转为正式文章

草稿完成后，只需将文件移动至正式文章目录：

```text
source/_drafts/草稿标题.md
→ source/_posts/草稿标题.md
```

无需修改文章内容或配置，即可作为正式文章发布。

---

# 公式渲染

Butterfly 主题支持 **MathJax** 与 **KaTeX** 两种公式渲染引擎。
本文选择 **KaTeX**，原因是 **更快、更轻量**，适合以技术笔记为主的博客。

------

## 1. 主题中启用 KaTeX

在 `_config.Butterfly.yml` 中配置：

```yaml
math:
  use: katex
  per_page: false

  katex:
    copy_tex: true
```

`per_page: false` 表示只在文章中声明时才加载公式脚本。

------

## 2. 安装所需插件

在博客根目录执行：

```sh
npm un hexo-renderer-marked --save
npm un hexo-renderer-kramed --save

npm i hexo-renderer-markdown-it --save
npm install katex @renbaoshuo/markdown-it-katex
```

然后在 `_config.yml` 中添加：

```yaml
markdown:
  plugins:
    - '@renbaoshuo/markdown-it-katex'
```

------

## 3. 在文章中使用公式

在文章 front-matter 中启用 KaTeX：

```yaml
---
title: 示例文章
katex: true
---
```

行间公式示例：

```markdown
$$
H_n = \sum_{i=1}^{n} \frac{1}{i}
$$
```

渲染效果：
$$
H_n = \sum_{i=1}^{n} \frac{1}{i}
$$

------

# 部署到 GitHub

本文采用 **GitHub Pages + hexo-deployer-git** 的方式进行部署，这是目前最常见、最稳定的方案。

------

## 1. 安装部署插件

```sh
npm install hexo-deployer-git --save
```

------

## 2. 配置部署信息

在博客根目录 `_config.yml` 中配置：

```yaml
url: https://yourname.github.io

deploy:
  type: git
  repo: https://github.com/yourname/yourname.github.io.git
  branch: main
```

------

## 3. 一键部署

每次更新博客内容后，只需执行：

```sh
hexo clean
hexo g
hexo d
```

或简写为：

```sh
hexo cl && hexo g && hexo d
```

部署完成后，访问：

```
https://yourname.github.io
```

即可看到最新内容，旧内容会被自动覆盖。

------

## 小结

- Hexo + Butterfly 适合长期维护的技术博客
- 配置与内容完全分离，安全可控
- KaTeX 足够应对绝大多数数学公式需求
- GitHub Pages 部署简单、免费、稳定
