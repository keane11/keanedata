---
title: Python 笔记
description: Python 语法技巧速查：推导式、解包、装饰器、类型注解、虚拟环境管理
date: 2026-05-14
tags: [Python]
order: 1
---

# Python 笔记

## 常用内置技巧

### 推导式

```python
# 列表推导
squares = [x**2 for x in range(10) if x % 2 == 0]

# 字典推导
word_len = {w: len(w) for w in ['hello', 'world']}

# 集合推导
unique_lens = {len(w) for w in ['hello', 'world', 'hi']}

# 生成器（不立即求值，省内存）
total = sum(x**2 for x in range(1_000_000))
```

### 解包

```python
first, *rest = [1, 2, 3, 4, 5]       # first=1, rest=[2,3,4,5]
*init, last  = [1, 2, 3, 4, 5]       # init=[1,2,3,4], last=5
a, _, b      = (1, 2, 3)             # 忽略中间值

a, b = b, a                          # 交换变量，无需临时变量

# 函数参数解包
def add(x, y): return x + y
args = (1, 2)
add(*args)                           # 等价于 add(1, 2)

kwargs = {'x': 1, 'y': 2}
add(**kwargs)                        # 等价于 add(x=1, y=2)
```

### 字典操作

```python
# 合并（Python 3.9+）
merged = d1 | d2
d1 |= d2            # 原地更新

# 安全取值
value = d.get('key', 'default')

# 按值排序
sorted_d = dict(sorted(d.items(), key=lambda x: x[1], reverse=True))

# defaultdict / Counter
from collections import defaultdict, Counter
dd = defaultdict(list)
dd['a'].append(1)   # 不会 KeyError

c = Counter(['a', 'b', 'a', 'c', 'a'])
c.most_common(2)    # [('a', 3), ('b', 1)]
```

### f-string 技巧

```python
pi = 3.14159
name = 'World'

f'{pi:.2f}'           # '3.14'       保留两位小数
f'{1234567:,}'        # '1,234,567'  千位分隔符
f'{0.85:.1%}'         # '85.0%'      百分比
f'{name!r}'           # "'World'"    repr 输出
f'{name:>10}'         # '     World' 右对齐
f'{"x" * 30}'         # 表达式直接嵌入
f'{value = }'         # Python 3.8+ 调试输出：value = 42
```

---

## 函数技巧

### 装饰器

```python
import functools, time

# 计时装饰器
def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f'{func.__name__} 耗时 {time.perf_counter()-start:.3f}s')
        return result
    return wrapper

@timer
def slow_func():
    time.sleep(1)

# 带参数的装饰器
def retry(times=3, delay=0.5):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for i in range(times):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if i == times - 1: raise
                    time.sleep(delay)
        return wrapper
    return decorator

@retry(times=3, delay=1)
def unstable_api(): ...
```

### 生成器

```python
# 无限序列生成器
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

# 使用
fib = fibonacci()
first_10 = [next(fib) for _ in range(10)]

# yield from（委托子生成器）
def chain(*iterables):
    for it in iterables:
        yield from it
```

### 上下文管理器

```python
from contextlib import contextmanager

@contextmanager
def timer_ctx(label):
    start = time.perf_counter()
    try:
        yield
    finally:
        print(f'{label}: {time.perf_counter()-start:.3f}s')

with timer_ctx('数据处理'):
    process_data()

# 同时管理多个资源
with open('in.txt') as fin, open('out.txt', 'w') as fout:
    fout.write(fin.read())
```

---

## 类型注解

```python
from typing import Optional, Union, Any
from collections.abc import Callable, Iterator, Sequence

def greet(name: str, times: int = 1) -> str:
    return f'Hello, {name}! ' * times

# Optional（可以是 None）
def find_user(uid: int) -> Optional[str]:
    ...

# Union（多种类型）
def process(data: Union[str, bytes]) -> str:
    ...

# Python 3.10+ 简写
def process(data: str | bytes) -> str:
    ...

# 泛型容器
def first(items: list[int]) -> int:
    return items[0]

# Callable
def apply(func: Callable[[int], str], val: int) -> str:
    return func(val)

# TypeAlias（Python 3.10+）
type Vector = list[float]
```

---

## 数据类

```python
from dataclasses import dataclass, field

@dataclass
class User:
    name: str
    email: str
    age: int = 0
    tags: list[str] = field(default_factory=list)

    def __post_init__(self):
        self.email = self.email.lower()

u = User('Alice', 'Alice@example.com')
# 自动生成 __init__, __repr__, __eq__

# frozen=True 使实例不可变（可作为字典键）
@dataclass(frozen=True)
class Point:
    x: float
    y: float
```

---

## 错误处理

```python
# 捕获多种异常
try:
    result = risky_operation()
except (ValueError, TypeError) as e:
    print(f'类型错误: {e}')
except OSError as e:
    print(f'IO 错误: {e.strerror}')
except Exception:
    raise          # 重新抛出，不吞掉异常
else:
    process(result)   # 无异常时执行
finally:
    cleanup()         # 总是执行

# 自定义异常
class AppError(Exception):
    def __init__(self, msg: str, code: int = 500):
        super().__init__(msg)
        self.code = code

raise AppError('未授权', code=401)
```

---

## 常用标准库速查

### pathlib

```python
from pathlib import Path

p = Path('docs/notes/python.md')
p.exists()           # True/False
p.suffix             # '.md'
p.stem               # 'python'
p.parent             # Path('docs/notes')
p.read_text()        # 读文件内容
p.write_text('...')  # 写文件

# 遍历
for f in Path('.').rglob('*.py'):
    print(f)

# 拼接路径
config = Path.home() / '.config' / 'app' / 'settings.json'
config.parent.mkdir(parents=True, exist_ok=True)
```

### datetime

```python
from datetime import datetime, timedelta, timezone

now = datetime.now()
utc_now = datetime.now(timezone.utc)

# 格式化
now.strftime('%Y-%m-%d %H:%M:%S')      # '2026-05-14 10:30:00'
datetime.strptime('2026-05-14', '%Y-%m-%d')

# 计算
tomorrow = now + timedelta(days=1)
diff = datetime(2027, 1, 1) - now
diff.days          # 剩余天数
```

### json / csv

```python
import json, csv

# JSON
data = json.loads('{"key": 1}')
text = json.dumps(data, ensure_ascii=False, indent=2)

with open('data.json') as f:
    data = json.load(f)

# CSV
with open('data.csv', newline='') as f:
    reader = csv.DictReader(f)
    rows = list(reader)      # [{'col1': '...', ...}, ...]
```

### itertools

```python
import itertools

list(itertools.chain([1,2], [3,4]))           # [1,2,3,4]
list(itertools.islice(range(100), 5))         # [0,1,2,3,4]
list(itertools.groupby([1,1,2,3,3], lambda x:x))
list(itertools.combinations('ABC', 2))        # AB AC BC
list(itertools.product([0,1], repeat=3))      # 笛卡尔积
list(itertools.batched(range(10), 3))         # Python 3.12
```

### logging

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler(),
    ]
)

log = logging.getLogger(__name__)
log.debug('调试信息')
log.info('启动服务 port=%d', 8080)
log.warning('内存使用率 %.1f%%', 85.3)
log.error('请求失败', exc_info=True)   # 自动附上 traceback
```

---

## 异步编程

```python
import asyncio
import httpx   # pip install httpx

async def fetch(url: str) -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.text

async def fetch_many(urls: list[str]) -> list[str]:
    # 并发执行所有请求
    return await asyncio.gather(*[fetch(u) for u in urls])

asyncio.run(fetch_many(['https://example.com'] * 5))

# 带超时
async def with_timeout():
    try:
        result = await asyncio.wait_for(fetch('...'), timeout=5)
    except asyncio.TimeoutError:
        print('超时')
```

---

## 虚拟环境

### venv（内置）

```bash
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
.venv\Scripts\activate           # Windows

pip install -r requirements.txt
pip freeze > requirements.txt    # 导出当前环境
```

### uv（推荐，速度快 10-100x）

```bash
# 安装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 初始化项目
uv init my-project && cd my-project

# 添加依赖
uv add fastapi uvicorn httpx
uv add --dev pytest ruff

# 运行
uv run python main.py
uv run pytest

# 同步依赖（从 pyproject.toml）
uv sync
```

### 常用 pip 技巧

```bash
pip install package==1.2.3       # 指定版本
pip install 'package>=1.0,<2.0'  # 版本范围
pip install -e .                 # 可编辑安装（开发时）
pip list --outdated              # 查看可更新的包
pip show httpx                   # 查看包信息
```
