---
title: Git 笔记
description: Git 日常命令速查：分支管理、提交规范、历史查找与 reflog 救援
date: 2026-05-14
tags: [Git]
order: 4
---

# Git 笔记

## 日常操作速查

```bash
# 状态与差异
git status
git diff                             # 未暂存的改动
git diff --staged                    # 已暂存的改动
git diff HEAD~2 -- file.py           # 指定文件与 2 次前的差异
git log --oneline --graph --all      # 图形化查看所有分支

# 暂存与提交
git add file.py                      # 暂存指定文件
git add -p                           # 交互式选择暂存内容（patch 模式，推荐）
git commit -m "feat: add login API"
git commit --amend --no-edit         # 修改最近一次提交（未推送时才用）

# 撤销
git restore file.py                  # 丢弃工作区修改
git restore --staged file.py         # 取消暂存（从 index 移回工作区）
git revert HEAD                      # 生成一个撤销提交（安全，保留历史）
git reset --soft HEAD~1              # 撤销提交，保留改动在暂存区
git reset --mixed HEAD~1             # 撤销提交，保留改动在工作区（默认）
git reset --hard HEAD~1              # 撤销提交，丢弃所有改动（危险！）
```

---

## 分支管理

```bash
git branch -a                        # 查看所有分支（含远程）
git branch -v                        # 查看各分支最新提交

# 创建与切换
git switch -c feature/login          # 创建并切换（推荐新语法）
git checkout -b hotfix/bug-123       # 等价旧语法

# 合并
git merge feature/login              # 合并（保留分叉历史）
git merge --no-ff feature/login      # 强制生成 merge commit（推荐）
git merge --squash feature/login     # 压缩为单次提交后手动 commit

# rebase（保持线性历史）
git rebase main                      # 将当前分支变基到 main
git rebase -i HEAD~3                 # 交互式整理最近 3 次提交
# 在交互界面：pick 保留 / squash 合并 / reword 修改信息 / drop 删除

# 删除
git branch -d feature/login          # 删除已合并分支
git branch -D feature/login          # 强制删除（未合并也删）
git push origin --delete feature/login   # 删除远程分支
```

### Cherry-pick

```bash
# 将某个提交应用到当前分支（不切换分支）
git cherry-pick abc1234
git cherry-pick abc1234 def5678      # 多个提交
git cherry-pick main~3..main         # 范围（不含左端点）
git cherry-pick --no-commit abc1234  # 应用但不自动提交
```

---

## 远程操作

```bash
git remote -v
git remote add upstream https://github.com/original/repo.git

git fetch origin                     # 拉取所有远程更新（不合并）
git fetch --prune                    # 同时清理已删除的远程分支

git pull --rebase                    # 拉取并用 rebase 代替 merge（推荐）
git push -u origin feature/login     # 推送并关联远程分支
git push --force-with-lease          # 安全强推（确保远端没有新提交）

# 同步 fork 上游
git fetch upstream
git rebase upstream/main
git push origin main
```

---

## Stash 暂存工作

```bash
git stash                            # 暂存当前改动（含未追踪文件需加 -u）
git stash push -m "wip: 登录功能"   # 带注释的 stash
git stash list
git stash pop                        # 恢复最新 stash 并删除
git stash apply stash@{1}            # 恢复指定 stash（不删除）
git stash drop stash@{0}             # 删除指定 stash
git stash branch feature/wip         # 从 stash 创建新分支
```

---

## 标签管理

```bash
git tag v1.0.0                       # 轻量标签
git tag -a v1.0.0 -m "正式发布 1.0"  # 附注标签（推荐）
git tag -a v1.0.0 abc1234 -m "..."   # 给历史提交打标签

git tag                              # 列出所有标签
git show v1.0.0
git push origin v1.0.0              # 推送单个标签
git push origin --tags              # 推送所有标签
git tag -d v1.0.0                   # 删除本地标签
git push origin --delete v1.0.0    # 删除远程标签
```

---

## 提交信息规范（Conventional Commits）

```
<类型>(<范围>): <简短描述>

[可选正文]

[可选脚注]
```

| 类型 | 含义 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 格式调整（不影响逻辑） |
| `refactor` | 重构（不是新功能也不是修 bug） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建、依赖等杂项 |
| `ci` | CI/CD 配置 |
| `revert` | 回滚提交 |

```
feat(auth): add JWT refresh token support

Closes #42

BREAKING CHANGE: refresh token API 路径改为 /auth/refresh
```

---

## .gitignore

```gitignore
# 依赖
node_modules/
.venv/
__pycache__/
*.pyc
*.pyo

# 构建产物
dist/
build/
*.egg-info/
.next/

# 环境变量（绝对不能提交！）
.env
.env.local
.env.*.local

# 编辑器
.vscode/
.idea/
*.swp
*.swo

# 系统文件
.DS_Store
Thumbs.db

# 日志 / 临时文件
*.log
*.tmp
.cache/
```

---

## 查找与排查

### 查看历史

```bash
git log --oneline --graph --all             # 图形化所有分支
git log --author="Alice" --since="1 week"   # 按作者和时间过滤
git log -S "function_name" --all            # 搜索代码变动（pickaxe）
git log -G "regex pattern"                  # 用正则搜索
git log -- deleted_file.py                  # 查看已删除文件的历史
git log main..feature/login                 # feature 上有而 main 没有的提交

# 查看某个文件的修改历史
git log -p -- file.py
git log --follow -- renamed_file.py         # 跟踪重命名前的历史
```

### blame / grep

```bash
git blame file.py                           # 每行最后由谁修改
git blame -L 10,20 file.py                  # 只看 10-20 行
git grep "TODO" -- "*.py"                   # 在工作区搜索
git grep "TODO" HEAD -- "*.py"              # 在提交快照中搜索
```

### bisect 二分定位 bug

```bash
git bisect start
git bisect bad                              # 当前版本有 bug
git bisect good v1.0                        # v1.0 时没有 bug
# Git 自动 checkout 中间版本，测试后标记
git bisect good / bad
# 定位完成后
git bisect reset
```

---

## Reflog 救援

> reflog 记录本地所有 HEAD 变化，删错提交或分支都能找回。

```bash
git reflog                                  # 查看操作历史
git reflog show feature/login               # 查看指定分支的历史

# 恢复被 reset --hard 丢失的提交
git reflog                                  # 找到丢失提交的 hash
git reset --hard abc1234                    # 回到那个提交

# 恢复意外删除的分支
git reflog | grep 'feature/deleted'         # 找到该分支最后一次提交
git checkout -b feature/deleted abc1234    # 重建分支
```

---

## 实用配置

### 别名

```bash
git config --global alias.st   'status'
git config --global alias.co   'checkout'
git config --global alias.sw   'switch'
git config --global alias.br   'branch'
git config --global alias.lg   'log --oneline --graph --all --decorate'
git config --global alias.last 'log -1 HEAD --stat'
git config --global alias.undo 'reset --soft HEAD~1'
```

### 全局 .gitignore

```bash
git config --global core.excludesfile ~/.gitignore_global
# 在 ~/.gitignore_global 里写 .DS_Store / Thumbs.db / *.swp 等
```

### 常用全局配置

```bash
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
git config --global core.editor "vim"
git config --global pull.rebase true         # pull 默认用 rebase
git config --global push.autoSetupRemote true  # push 自动关联远程分支（Git 2.37+）
git config --global init.defaultBranch main
git config --list --global                   # 查看全局配置
```
