---
title: DeepSeek TUI / CodeWhale WSL 安装完整指南
description: Ubuntu 22.04 / WSL2 环境下 glibc 版本不兼容导致 npm 安装 CodeWhale 失败的根因与 Cargo 编译安装解决方案
date: 2026-05-28
order: 20
tags: [DeepSeek, CodeWhale, WSL, Rust, Cargo, TUI]
---

# DeepSeek TUI / CodeWhale WSL 安装完整指南

> 适用场景：WSL2 / Ubuntu 22.04 / glibc 2.35，`npm install -g codewhale` 失败，提示 glibc 版本不兼容。
>
> **核心方案**：放弃 npm 预编译包，用 Cargo 本机编译，生成完全适配当前系统的二进制文件。

---

## 目录

1. [问题原因](#一问题原因)
2. [不推荐的做法](#二不推荐的做法)
3. [安装步骤](#三安装步骤)
4. [配置与使用](#四配置与使用)
5. [常见问题](#五常见问题)
6. [一键安装脚本](#六一键安装脚本)

---

## 一、问题原因

Ubuntu 22.04 默认 glibc 是 **2.35**，而 npm 下载的 CodeWhale 预编译二进制依赖 **glibc 2.39**。

典型报错：

```text
codewhale install failed: Prebuilt DeepSeek TUI binary requires GLIBC_2.39
but this system has glibc 2.35.
```

确认你的环境：

```bash
ldd --version    # 查看 glibc 版本
node -v
npm -v
```

### deepseek-tui 包的额外问题

`npm install -g deepseek-tui` 虽然安装成功，但运行 `deepseek` 会报 `command not found`，因为该 npm 包的 `package.json` 没有声明可执行命令（`bin` 字段为 `undefined`）。**这个包已不再适合作为安装入口，应改用 `codewhale`。**

---

## 二、不推荐的做法

**❌ 不要手动升级 glibc：**

```bash
# 不要执行！
sudo dpkg -i glibc_xxx.deb
```

glibc 是 Linux 系统核心库，强行升级会导致 apt、bash、ssh、编译工具链等大量程序异常。

**❌ 不要用 `SKIP_GLIBC_CHECK` 跳过检查：**

```bash
# 不要执行！
DEEPSEEK_TUI_SKIP_GLIBC_CHECK=1 npm install -g codewhale
```

这只跳过安装阶段检查，实际运行时仍会报 `GLIBC_2.39 not found`。

---

## 三、安装步骤

### 步骤1：清理 npm 残留

```bash
npm uninstall -g codewhale deepseek-tui
rm -rf ~/.nvm/versions/node/*/lib/node_modules/codewhale
rm -rf ~/.nvm/versions/node/*/lib/node_modules/deepseek-tui
hash -r
```

确认旧命令已消失（无输出为正常）：

```bash
which deepseek
which codewhale
```

### 步骤2：安装系统编译依赖

```bash
sudo apt update
sudo apt install -y \
  build-essential \
  pkg-config \
  libssl-dev \
  libdbus-1-dev \
  libxcb1-dev \
  libx11-dev \
  libxi-dev \
  libxtst-dev \
  libxrandr-dev \
  libxkbcommon-dev \
  curl git ca-certificates
```

> ⚠️ **踩坑：必须装 `libdbus-1-dev`**。CodeWhale 依赖 `libdbus-sys`，编译时需要 DBus 开发库。如果只装了 `build-essential`，编译会报错：
> ```text
> error: failed to run custom build command for `libdbus-sys v0.2.7`
> pkg_config failed: Could not run `pkg-config --libs --cflags dbus-1`
> ```

确认 DBus 依赖安装成功：

```bash
pkg-config --modversion dbus-1    # 应输出版本号，如 1.12.x
```

### 步骤3：安装 Rust / Cargo

```bash
cd ~
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# 选择：1) Proceed with standard installation
```

安装完成后加载环境变量：

```bash
source "$HOME/.cargo/env"
```

确认版本（需要 Rust 1.88+）：

```bash
rustc --version
cargo --version
```

如版本偏低，更新：

```bash
rustup update stable
```

### 步骤4：配置 Cargo 国内源（可选，网络慢时用）

```bash
mkdir -p ~/.cargo
cat > ~/.cargo/config.toml <<'EOF'
[source.crates-io]
replace-with = "tuna"

[source.tuna]
registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"
EOF
```

或者设置代理：

```bash
export HTTP_PROXY=http://127.0.0.1:10809
export HTTPS_PROXY=http://127.0.0.1:10809
```

### 步骤5：Cargo 编译安装 CodeWhale

```bash
cargo install codewhale-cli --locked
cargo install codewhale-tui --locked
```

这一步需要几分钟到十几分钟（取决于 CPU 和网速）。中途失败可以重复执行，Cargo 会复用已下载的缓存。

### 步骤6：配置 PATH

```bash
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
hash -r
```

验证安装成功：

```bash
which codewhale       # 应输出 /home/用户名/.cargo/bin/codewhale
which codewhale-tui
codewhale --version
codewhale-tui --version
```

---

## 四、配置与使用

### 配置 DeepSeek API Key

**方式一：命令配置（推荐）**

```bash
codewhale auth set --provider deepseek --api-key "你的DeepSeek_API_KEY"
```

**方式二：环境变量**

```bash
echo 'export DEEPSEEK_API_KEY="你的DeepSeek_API_KEY"' >> ~/.bashrc
source ~/.bashrc
```

检查配置状态：

```bash
codewhale auth status
codewhale doctor
```

### 启动方式

```bash
codewhale        # CLI 模式
codewhale-tui    # TUI 交互界面
```

> ⚠️ **踩坑：正确命令是 `codewhale-tui`，不是 `codewhale tui`。**
>
> `codewhale tui` 不是有效子命令，`tui` 会被当作普通对话内容发给模型，它会回复"TUI stands for Terminal User Interface..."。

### 添加快捷别名（可选）

```bash
echo 'alias deepseek="codewhale"' >> ~/.bashrc
echo 'alias deepseek-tui="codewhale-tui"' >> ~/.bashrc
echo 'alias cw="codewhale"' >> ~/.bashrc
echo 'alias cwt="codewhale-tui"' >> ~/.bashrc
source ~/.bashrc
```

以后可以用：

| 命令 | 实际作用 |
|------|---------|
| `cw` | 启动 CLI |
| `cwt` | 启动 TUI |
| `deepseek` | 同 `codewhale` |
| `deepseek-tui` | 同 `codewhale-tui` |

---

## 五、常见问题

### command not found

```bash
# 检查文件是否存在
ls -la ~/.cargo/bin | grep codewhale

# 检查 PATH
echo $PATH | tr ':' '\n' | grep cargo

# 修复
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc && hash -r
```

### Cargo 下载极慢

配置清华源（见步骤4），或开启代理后重新安装。

### 编译报 OpenSSL 错误

```bash
sudo apt install -y pkg-config libssl-dev
cargo install codewhale-cli --locked
cargo install codewhale-tui --locked
```

### 编译报 DBus / pkg-config 错误

```bash
sudo apt install -y pkg-config libdbus-1-dev
cargo install codewhale-cli --locked
```

### Rust 版本太低

```bash
rustup update stable
source "$HOME/.cargo/env"
cargo install codewhale-cli --locked
```

### npm 残留导致命令冲突

```bash
npm list -g --depth=0 | grep -E 'codewhale|deepseek'
npm uninstall -g codewhale deepseek-tui
hash -r
which codewhale    # 确认指向 ~/.cargo/bin/
```

---

## 六、一键安装脚本

可直接复制在 WSL 终端执行：

```bash
#!/usr/bin/env bash
set -e

echo "[1/6] 清理 npm 残留..."
npm uninstall -g codewhale deepseek-tui 2>/dev/null || true
hash -r 2>/dev/null || true

echo "[2/6] 安装系统依赖（含 DBus）..."
sudo apt update
sudo apt install -y \
  build-essential pkg-config libssl-dev libdbus-1-dev \
  libxcb1-dev libx11-dev libxi-dev libxtst-dev \
  libxrandr-dev libxkbcommon-dev curl git ca-certificates

echo "[3/6] 安装 Rust..."
if ! command -v cargo >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
source "$HOME/.cargo/env"
rustup update stable

echo "[4/6] 写入 PATH..."
if ! grep -q 'cargo/bin' ~/.bashrc; then
    echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
fi
export PATH="$HOME/.cargo/bin:$PATH"

echo "[5/6] Cargo 安装 CodeWhale..."
cargo install codewhale-cli --locked
cargo install codewhale-tui --locked

echo "[6/6] 验证安装..."
hash -r
codewhale --version
codewhale-tui --version

echo ""
echo "安装完成！后续步骤："
echo "  codewhale doctor"
echo "  codewhale auth set --provider deepseek --api-key \"你的API_KEY\""
echo "  codewhale-tui"
```

---

## 总结

| 问题 | 原因 | 解决 |
|------|------|------|
| npm 安装报 glibc 版本错误 | Ubuntu 22.04 的 glibc 2.35 低于预编译包要求的 2.39 | 改用 Cargo 本机编译 |
| deepseek 命令不存在 | `deepseek-tui` npm 包未声明 bin 入口 | 改装 `codewhale` |
| Cargo 编译报 DBus 错误 | 缺少 `libdbus-1-dev` 和 `pkg-config` | `sudo apt install pkg-config libdbus-1-dev` |
| `codewhale tui` 不进入 TUI | 不是有效子命令，被当作对话内容 | 用 `codewhale-tui` 命令 |

**最简安装路径（已有 Rust 环境）：**

```bash
sudo apt install -y build-essential pkg-config libssl-dev libdbus-1-dev
cargo install codewhale-cli --locked
cargo install codewhale-tui --locked
codewhale auth set --provider deepseek --api-key "你的API_KEY"
codewhale-tui
```
