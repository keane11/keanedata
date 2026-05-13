---
title: Git 笔记
description: Git 日常命令速查：分支管理、提交规范、历史查找与 reflog 救援
date: 2026-05-13
tags: [Git]
order: 4
---

# Git 笔记

## 日常操作速查

```bash
# 状态与差异
git status
git diff                   # 未暂存的改动
git diff --staged          # 已暂存的改动
git log --oneline -10      # 最近 10 条提交（简洁版）

# 暂存与提交
git add file.py            # 暂存指定文件
git add -p                 # 交互式选择暂存内容（推荐）
git commit -m "feat: add login API"
git commit --amend         # 修改最近一次提交（未推送时才用）

# 撤销
git restore file.py        # 丢弃工作区修改
git restore --staged file.py  # 取消暂存
git revert HEAD            # 生成一个撤销提交（安全）
git reset --hard HEAD~1    # 回退到上一个提交（危险，会丢失改动）
```

## 分支管理

```bash
git branch -a              # 查看所有分支（含远程）
git checkout -b feature/login   # 创建并切换分支
git switch main            # 切换分支（新语法）

git merge feature/login    # 合并分支
git rebase main            # 变基（保持线性历史）

git branch -d feature/login     # 删除已合并分支
git push origin --delete feature/login  # 删除远程分支
```

## 远程操作

```bash
git remote -v              # 查看远程地址
git fetch origin           # 拉取远程更新（不合并）
git pull                   # 拉取并合并
git push -u origin main    # 推送并关联远程分支

git push --force-with-lease   # 强推（比 --force 安全）
```

## Stash 暂存工作

```bash
git stash                  # 暂存当前改动
git stash pop              # 恢复最近的 stash
git stash list             # 查看所有 stash
git stash drop stash@{0}   # 删除指定 stash
```

## 提交信息规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<类型>(<范围>): <简短描述>

类型：
feat     新功能
fix      修复 bug
docs     文档更新
style    格式调整（不影响逻辑）
refactor 重构（不是新功能也不是修 bug）
test     测试相关
chore    构建、依赖等杂项
```

示例：
```
feat(auth): add JWT refresh token support
fix(upload): handle file size limit exceeded error
docs: update API authentication guide
```

## .gitignore 常用规则

```gitignore
# 依赖
node_modules/
.venv/
__pycache__/

# 构建产物
dist/
build/
*.egg-info/

# 环境变量（绝对不能提交）
.env
.env.local

# 编辑器
.vscode/
.idea/
*.swp

# 系统文件
.DS_Store
Thumbs.db
```

## 查找问题

```bash
# 找是哪次提交引入了 bug
git bisect start
git bisect bad             # 当前版本有 bug
git bisect good v1.0       # v1.0 没有 bug
# Git 自动二分查找，测试后标记 good/bad 直到定位

# 找某行代码最后是谁改的
git blame file.py

# 搜索所有提交历史中的字符串
git log -S "function_name" --all
```

## 常用别名配置

```bash
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.lg "log --oneline --graph --all"
```
