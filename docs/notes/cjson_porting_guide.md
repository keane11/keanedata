---
title: cjson porting guide
description: Cjson移植手册
tags: [编程笔记]
date: 2026-05-15
order: 9
---

# arco_cjson 移植手册

版本：v0.1  
作者：arco  
日期：2023-08-19

---

## 目录

1. [概述](#1-概述)
2. [文件清单](#2-文件清单)
3. [移植步骤](#3-移植步骤)
4. [内存池配置](#4-内存池配置)
5. [API 说明](#5-api-说明)
6. [使用示例](#6-使用示例)
7. [注意事项](#7-注意事项)
8. [源码](#8-源码)

---

## 1. 概述

`arco_cjson` 是一个面向嵌入式平台的轻量级 JSON 库，主要特点：

- **零动态堆依赖**：使用静态内存池替代 `malloc`/`free`，适合无 OS 或堆资源受限的 MCU。
- **自定义 vsprintf**：内部实现 `my_vsprintf`，支持 `%d`、`%s`、`%c`、`%f`，规避平台标准库缺失问题。
- **支持类型**：`object`、`array`、`string`、`long`（统一用 `long` 表示整数）。
- **序列化/反序列化**：提供 `json_to_string` 与 `string_to_json` 双向转换。

---

## 2. 文件清单

| 文件 | 说明 |
|------|------|
| `cjson.h` | 类型定义与 API 声明 |
| `cjson.c` | 完整实现（含内存池） |

只需将这两个文件加入工程即可，无其他第三方依赖。

---

## 3. 移植步骤

### 3.1 加入工程

将 `cjson.c` 和 `cjson.h` 复制到目标工程的任意目录，并在编译系统中包含它们。

### 3.2 确认宏开关

`cjson.h` 中默认启用：

```c
#ifndef EXTERN_CJSON_INSTALL_EN
#define EXTERN_CJSON_INSTALL_EN 1
#endif
```

若需要条件编译，可在 `config.h` 或编译选项中显式定义：

```c
#define EXTERN_CJSON_INSTALL_EN 1   // 启用
#define EXTERN_CJSON_INSTALL_EN 0   // 禁用（整个 cjson.c 内容被裁剪）
```

### 3.3 包含头文件

```c
#include "cjson.h"
```

### 3.4 内存池地址修饰（平台相关）

`cjson.c` 中内存池声明使用了平台专属的 section 修饰：

```c
static char memoryPool[MEMORY_POOL_SIZE] AT(.user_data.json_cb);
```

`AT(...)` 宏由目标平台链接脚本提供。若目标平台无此修饰，改为：

```c
static char memoryPool[MEMORY_POOL_SIZE];
```

### 3.5 头文件依赖

`cjson.c` 顶部包含：

```c
#include "include.h"
#include "cjson.h"
```

`include.h` 是平台总头文件（提供 `printf`、`strlen`、`memcpy`、`memset`、`strcmp`、`sprintf`、`va_list` 等）。  
若目标平台无 `include.h`，替换为标准头：

```c
#include <stdio.h>
#include <string.h>
#include <stdarg.h>
#include <stddef.h>
```

### 3.6 初始化

程序启动后、首次使用 JSON 之前，必须调用一次：

```c
my_json_malloc_init();
```

每次 JSON 操作完成、需要回收全部内存时调用：

```c
my_free_all();
```

---

## 4. 内存池配置

```c
#define MEMORY_POOL_SIZE  (1024 + 256)   // 默认 1280 字节
```

内存池为静态数组，采用**首次适配空闲链表**算法。

### 容量估算

| 对象 | 占用（字节）|
|------|------------|
| `arco_json` 结构体 | `sizeof(arco_json)` ≈ 28 |
| `MemoryBlock` 头 | `sizeof(MemoryBlock)` ≈ 8 |
| 每个节点实际消耗 | ~36 + key/value 长度 |

默认 1280 字节大约可容纳 **10 个 long 型 kv 节点**。  
若 JSON 结构更复杂，适当增大 `MEMORY_POOL_SIZE`。

> **注意**：`my_free` 仅将块归还到链表头部，不做合并。长期反复分配/释放单个块会导致碎片。建议每次完整处理完一条 JSON 消息后调用 `my_free_all()` 整体重置。

---

## 5. API 说明

### 5.1 初始化

```c
void my_json_malloc_init(void);
```
初始化内存池，程序启动时调用一次。

```c
void my_free_all(void);
```
释放全部已分配内存（重置内存池），每次 JSON 操作完成后调用。

---

### 5.2 创建节点

```c
arco_json* new_json_object(void);
```
创建一个 `object` 类型节点（对应 `{}`）。

```c
arco_json* new_json_array(void);
```
创建一个 `array` 类型节点（对应 `[]`）。

```c
arco_json* new_json_string(char* value);
```
创建一个字符串类型节点，`value` 会被拷贝进内存池。

```c
arco_json* new_json_long(long value);
```
创建一个整数类型节点，内部以 `long` 存储。

---

### 5.3 组装结构

```c
int json_object_add(arco_json* json, char* key, arco_json* j_add);
```
向 `object` 节点追加一个键值对，`key` 会被拷贝进内存池。  
返回 `0` 成功，`-1` 类型不匹配。

```c
int json_array_add(arco_json* json, arco_json* j_add);
```
向 `array` 节点追加一个元素。  
返回 `0` 成功，`-1` 类型不匹配。

---

### 5.4 序列化 / 反序列化

```c
char* json_to_string(arco_json* json);
```
将 JSON 树序列化为字符串，返回指向内存池中字符串的指针。  
**注意**：返回的指针在调用 `my_free_all()` 后失效。

```c
arco_json* string_to_json(char* str);
```
将 JSON 格式字符串解析为 JSON 树，返回根节点指针。

---

### 5.5 读取数据

```c
char* get_string_from_object(arco_json* json, char* key);
```
从 `object` 中按 key 获取字符串值，失败返回 `NULL`。

```c
long get_long_from_object(arco_json* json, char* key);
```
从 `object` 中按 key 获取整数值，失败返回 `-1`。

```c
arco_json* get_object_from_object(arco_json* json, char* key);
```
从 `object` 中按 key 获取子 `object`，失败返回 `NULL`。

```c
arco_json* get_object_from_array(arco_json* json, int idx);
```
从 `array` 中按索引（从 0 开始）获取 `object`，失败返回 `NULL`。

---

### 5.6 类型查询

```c
int get_json_type(arco_json* json);
```
返回节点类型（`enum json_type`），`json` 为 `NULL` 时返回 `-1`。

```c
enum json_type {
    json_type_empty,
    json_type_object,
    json_type_array,
    json_type_string,
    json_type_long
};
```

---

## 6. 使用示例

### 6.1 构建并序列化 JSON

```c
my_json_malloc_init();

arco_json* root = new_json_object();
json_object_add(root, "cmd",     new_json_string("set_vol"));
json_object_add(root, "volume",  new_json_long(80));
json_object_add(root, "channel", new_json_string("main"));

char* str = json_to_string(root);
// str => {"cmd":"set_vol","volume":80,"channel":"main"}

// 使用完毕后释放
my_free_all();
```

### 6.2 解析 JSON 字符串

```c
my_json_malloc_init();

char buf[] = "{\"cmd\":\"set_vol\",\"volume\":80}";
arco_json* root = string_to_json(buf);

char* cmd    = get_string_from_object(root, "cmd");    // "set_vol"
long  volume = get_long_from_object(root, "volume");   // 80

my_free_all();
```

### 6.3 嵌套 object

```c
my_json_malloc_init();

arco_json* root  = new_json_object();
arco_json* inner = new_json_object();
json_object_add(inner, "x", new_json_long(10));
json_object_add(inner, "y", new_json_long(20));
json_object_add(root, "pos", inner);

char* str = json_to_string(root);
// str => {"pos":{"x":10,"y":20}}

my_free_all();
```

### 6.4 array 使用

```c
my_json_malloc_init();

arco_json* root = new_json_object();
arco_json* arr  = new_json_array();

arco_json* item0 = new_json_object();
json_object_add(item0, "id", new_json_long(1));

arco_json* item1 = new_json_object();
json_object_add(item1, "id", new_json_long(2));

json_array_add(arr, item0);
json_array_add(arr, item1);
json_object_add(root, "list", arr);

char* str = json_to_string(root);
// str => {"list":[{"id":1},{"id":2}]}

my_free_all();
```

---

## 7. 注意事项

1. **内存池是全局唯一的**，不支持多实例并发。在中断中使用时需注意重入问题。
2. **`my_free` 不合并碎片**，频繁单个释放会导致无法分配新块。推荐用完整体 `my_free_all()`。
3. **`json_to_string` 返回的字符串存在内存池中**，不可在 `my_free_all()` 后访问；如需持久保存，请在释放前 `memcpy` 到外部缓冲区。
4. **字符串 key/value 上限**：`calculate_callback` / `tostring_callback` 内使用 `char str[64]` 作中间缓冲，单个格式化片段不得超过 63 字节。
5. **整数范围**：全部数值使用 `long` 类型，平台上 `long` 通常为 32 位，范围 `±2,147,483,647`。
6. **`parse_num_value` 整数解析**：最长支持 15 位数字（`arr[16]`），超出部分截断。

---

## 8. 源码

### 8.1 cjson.h

```c
#ifndef _CJSON_H_
#define _CJSON_H_

#ifndef EXTERN_CJSON_INSTALL_EN
#define EXTERN_CJSON_INSTALL_EN 1
#endif

#define VERSION v0.1

enum json_type {
    json_type_empty,
    json_type_object,
    json_type_array,
    json_type_string,
    json_type_long
};

typedef struct arco_json {
    enum json_type type;
    int child_num;
    int seq;
    char* key;
    void* value;
    struct arco_json* parent;
    struct arco_json* next;
} arco_json;

arco_json* new_json_object(void);
arco_json* new_json_array(void);
arco_json* new_json_string(char* value);
arco_json* new_json_long(long value);

int get_json_type(arco_json* json);

int json_object_add(arco_json* json, char* key, arco_json* j_add);
int json_array_add(arco_json* json, arco_json* j_add);

char* json_to_string(arco_json* json);
arco_json* string_to_json(char* str);

char* get_string_from_object(arco_json* json, char* key);
long  get_long_from_object(arco_json* json, char* key);
arco_json* get_object_from_object(arco_json* json, char* key);
arco_json* get_object_from_array(arco_json* json, int idx);

void my_json_malloc_init(void);
void my_free_all(void);

#endif // _CJSON_H_
```

### 8.2 cjson.c

```c
//
// Created by arco on 2023/8/19.
//
#include "include.h"
#include "cjson.h"

#if EXTERN_CJSON_INSTALL_EN

int g_json_char_num = 0;
char* g_json_str = NULL;

/* -------------------------------------------------------
 * 内存池
 * ------------------------------------------------------- */

typedef struct MemoryBlock {
    size_t size;
    struct MemoryBlock* next;
} MemoryBlock;

#define MEMORY_POOL_SIZE (1024 + 256)
static char memoryPool[MEMORY_POOL_SIZE] AT(.user_data.json_cb);
static MemoryBlock* freeList = NULL;

void initializeMemoryPool(void)
{
    freeList = (MemoryBlock*)memoryPool;
    freeList->size = MEMORY_POOL_SIZE - sizeof(MemoryBlock);
    freeList->next = NULL;
}

void* my_malloc(size_t size)
{
    MemoryBlock* current = freeList;
    MemoryBlock* previous = NULL;

    while (current != NULL) {
        if (current->size >= size) {
            if (current->size - size >= sizeof(MemoryBlock) + 1) {
                MemoryBlock* newBlock = (MemoryBlock*)((char*)current + sizeof(MemoryBlock) + size);
                newBlock->size = current->size - sizeof(MemoryBlock) - size;
                newBlock->next = current->next;
                current->size = size;
                current->next = newBlock;
            }
            if (previous != NULL)
                previous->next = current->next;
            else
                freeList = current->next;
            return (void*)((char*)current + sizeof(MemoryBlock));
        }
        previous = current;
        current = current->next;
    }
    return NULL;
}

void my_free(void* ptr)
{
    if (ptr == NULL) return;
    MemoryBlock* block = (MemoryBlock*)((char*)ptr - sizeof(MemoryBlock));
    block->next = freeList;
    freeList = block;
}

void my_free_all(void)
{
    initializeMemoryPool();
}

/* -------------------------------------------------------
 * 自定义 vsprintf（支持 %d %s %c %f）
 * ------------------------------------------------------- */

int my_vsprintf(char* str, const char* format, va_list args)
{
    if (str == NULL || format == NULL) return -1;

    int length = 0;
    while (*format != '\0') {
        if (*format == '%') {
            format++;
            switch (*format) {
                case 'd': {
                    int num = va_arg(args, int);
                    int n = sprintf(str, "%d", num);
                    if (n < 0) return -2;
                    length += n; str += n;
                    break;
                }
                case 's': {
                    const char* s = va_arg(args, const char*);
                    if (s == NULL) return -3;
                    while (*s) { *str++ = *s++; length++; }
                    break;
                }
                case 'c': {
                    char c = va_arg(args, int);
                    *str++ = c; length++;
                    break;
                }
                case 'f': {
                    double num = va_arg(args, double);
                    int n = sprintf(str, "%f", num);
                    if (n < 0) return -4;
                    length += n; str += n;
                    break;
                }
                default: {
                    *str++ = *format; length++;
                    break;
                }
            }
        } else {
            *str++ = *format; length++;
        }
        format++;
    }
    *str = '\0';
    return length;
}

/* -------------------------------------------------------
 * 内存池初始化入口
 * ------------------------------------------------------- */

void my_json_malloc_init(void)
{
    initializeMemoryPool();
}

/* -------------------------------------------------------
 * 节点创建
 * ------------------------------------------------------- */

int init_new_json(arco_json* json, int json_type)
{
    json->type = json_type;
    json->child_num = 0;
    json->seq = 0;
    json->key = NULL;
    json->value = NULL;
    json->next = NULL;
    return 0;
}

arco_json* new_json_object(void)
{
    arco_json* json = my_malloc(sizeof(arco_json));
    init_new_json(json, json_type_object);
    return json;
}

arco_json* new_json_array(void)
{
    arco_json* json = my_malloc(sizeof(arco_json));
    init_new_json(json, json_type_array);
    return json;
}

arco_json* new_json_string(char* value)
{
    arco_json* json = my_malloc(sizeof(arco_json));
    init_new_json(json, json_type_string);
    json->value = (char*)my_malloc(strlen(value) + 1);
    memcpy(json->value, value, strlen(value) + 1);
    return json;
}

arco_json* new_json_long(long value)
{
    arco_json* json = my_malloc(sizeof(arco_json));
    init_new_json(json, json_type_long);
    json->value = (long*)my_malloc(sizeof(long));
    *(long*)json->value = value;
    return json;
}

arco_json* new_json_empty(void)
{
    arco_json* json = my_malloc(sizeof(arco_json));
    init_new_json(json, json_type_empty);
    return json;
}

int get_json_type(arco_json* json)
{
    if (json != NULL) return json->type;
    else return -1;
}

/* -------------------------------------------------------
 * 节点组装
 * ------------------------------------------------------- */

int json_object_add(arco_json* json, char* key, arco_json* j_add)
{
    if (json->type != json_type_object) {
        printf("json type isn't object, can't add kv\n");
        return -1;
    }
    if (json->value == NULL) {
        json->value = j_add;
        j_add->parent = json;
        j_add->key = my_malloc(strlen(key) + 1);
        memcpy(j_add->key, key, strlen(key) + 1);
        json->child_num++;
    } else {
        arco_json* arco = json->value;
        for (int i = 0; i < json->child_num - 1; i++) arco = arco->next;
        j_add->key = my_malloc(strlen(key) + 1);
        memcpy(j_add->key, key, strlen(key) + 1);
        arco->next = j_add;
        j_add->parent = arco->parent;
        json->child_num++;
    }
    return 0;
}

int json_array_add(arco_json* json, arco_json* j_add)
{
    if (json->type != json_type_array) {
        printf("json type isn't array, can't add object\n");
        return -1;
    }
    if (json->value == NULL) {
        json->value = j_add;
        json->child_num++;
    } else {
        arco_json* arco = json->value;
        for (int i = 0; i < json->child_num - 1; i++) arco = arco->next;
        arco->next = j_add;
        j_add->parent = arco->parent;
        json->child_num++;
    }
    return 0;
}

/* -------------------------------------------------------
 * 序列化
 * ------------------------------------------------------- */

typedef void (*deal_callback)(char*, ...);

void json_depth_expand(arco_json* json, int depth, deal_callback callback)
{
    if (get_json_type(json) == json_type_array) {
        if (json->key != NULL && depth > 0) callback("\"%s\":", json->key);
        callback("[");
        if (json->value != NULL) json_depth_expand(json->value, depth + 1, callback);
    }
    if (get_json_type(json) == json_type_object) {
        if (json->key != NULL && depth > 0) callback("\"%s\":", json->key);
        callback("{");
        if (json->value != NULL) json_depth_expand(json->value, depth + 1, callback);
    }
    if (json->type == json_type_string) {
        callback("\"%s\":", json->key);
        callback("\"%s\"", (char*)json->value);
        if (json->next != NULL) callback(",");
    }
    if (json->type == json_type_long) {
        callback("\"%s\":", json->key);
        callback("%d", *(long*)json->value);
        if (json->next != NULL) callback(",");
    }
    if (get_json_type(json) == json_type_array) {
        callback("]");
        if (json->next != NULL && depth > 0) callback(",");
    }
    if (get_json_type(json) == json_type_object) {
        callback("}");
        if (json->next != NULL && depth > 0) callback(",");
    }
    if (json->next != NULL && depth > 0) {
        json_depth_expand(json->next, depth, callback);
    }
}

void calculate_callback(char* fmt, ...)
{
    va_list args;
    va_start(args, fmt);
    char str[64];
    my_vsprintf(str, fmt, args);
    g_json_char_num += (int)strlen(str);
    va_end(args);
}

void tostring_callback(char* fmt, ...)
{
    va_list args;
    va_start(args, fmt);
    char str[64];
    my_vsprintf(str, fmt, args);
    strcat(g_json_str, str);
    va_end(args);
}

int calculate_json_str_length(arco_json* json)
{
    g_json_char_num = 0;
    json_depth_expand(json, 0, calculate_callback);
    return g_json_char_num;
}

char* json_to_string(arco_json* json)
{
    int size = calculate_json_str_length(json);
    g_json_str = my_malloc(size + 1);
    memset(g_json_str, '\0', size + 1);
    json_depth_expand(json, 0, tostring_callback);
    char* json_str = my_malloc(strlen(g_json_str) + 1);
    memcpy(json_str, g_json_str, strlen(g_json_str) + 1);
    my_free(g_json_str);
    g_json_str = NULL;
    return json_str;
}

/* -------------------------------------------------------
 * 反序列化
 * ------------------------------------------------------- */

char* str_get_here_to_there(char* str, int position, char c)
{
    int i, size = 1;
    for (i = position; i < (int)strlen(str); i++) {
        if (str[i] != c) size++;
        else break;
    }
    char* dst = my_malloc(sizeof(char) * size);
    for (i = position; i < (int)strlen(str); i++) {
        if (str[i] != c) dst[i - position] = str[i];
        else { dst[i - position] = '\0'; return dst; }
    }
    return NULL;
}

int parse_num_value(char* str, void* value)
{
    int i, start = 0, val_len = 0;
    long rate = 1;
    long* num_val = my_malloc(sizeof(long));
    char arr[16];
    memset(arr, '\0', sizeof(arr));

    if (str[0] == '-') start = 1;
    val_len += start;

    for (i = start; i < (int)strlen(str) && i < (int)sizeof(arr) - 1; i++) {
        if (str[i] < '0' || str[i] > '9') break;
        arr[i - start] = str[i];
        val_len++;
    }
    for (i = (int)strlen(arr) - 1; i >= 0; i--) {
        *num_val += (arr[i] - '0') * rate;
        rate *= 10;
    }
    if (start) *num_val *= -1;

    *(long*)value = *num_val;
    return val_len;
}

arco_json* string_to_json(char* str)
{
    int i, str_len = (int)strlen(str), need_new = 0;
    int yh_flag = 0, value_flag = 0;
    arco_json* json = new_json_empty();
    arco_json* p_json = json;

    for (i = 0; i < str_len; i++) {
        if (need_new) {
            arco_json* j_tmp = new_json_empty();
            p_json->value = j_tmp;
            j_tmp->parent = p_json;
            p_json = p_json->value;
            need_new = 0;
        }
        if (str[i] == '"') {
            yh_flag++;
            if (yh_flag == 1)      p_json->key = str_get_here_to_there(str, i + 1, '"');
            else if (yh_flag == 3) { p_json->value = str_get_here_to_there(str, i + 1, '"'); p_json->type = json_type_string; }
            else if (yh_flag == 4)  yh_flag = 0;
        }
        if (value_flag) {
            if ((str[i] >= '0' && str[i] <= '9') || str[i] == '-') {
                p_json->type = json_type_long;
                p_json->value = (long*)my_malloc(sizeof(long));
                i += parse_num_value(&str[i], p_json->value);
                yh_flag = 0;
            }
            value_flag = 0;
        }
        if (str[i] == ':') value_flag = 1;
        if (str[i] == '{') { yh_flag = 0; need_new = 1; p_json->type = json_type_object; }
        if (str[i] == '[') { yh_flag = 0; need_new = 1; p_json->type = json_type_array; }
        if (str[i] == ',') {
            arco_json* j_tmp = new_json_empty();
            j_tmp->seq = p_json->seq + 1;
            p_json->next = j_tmp;
            j_tmp->parent = p_json->parent;
            if (p_json->seq == 0) p_json->parent->value = p_json;
            p_json = p_json->next;
        }
        if (str[i] == '}' || str[i] == ']') p_json = p_json->parent;
    }
    return json;
}

/* -------------------------------------------------------
 * 数据读取
 * ------------------------------------------------------- */

char* get_string_from_object(arco_json* json, char* key)
{
    if (json == NULL || json->type != json_type_object || json->value == NULL) return NULL;
    arco_json* p = json->value;
    while (p != NULL) {
        if (p->type == json_type_string && strcmp((char*)p->key, key) == 0) {
            size_t len = strlen((char*)p->value);
            char* res = my_malloc(len + 1);
            memcpy(res, p->value, len + 1);
            return res;
        }
        p = p->next;
    }
    return NULL;
}

long get_long_from_object(arco_json* json, char* key)
{
    if (json == NULL || json->type != json_type_object || json->value == NULL) return -1;
    arco_json* p = json->value;
    while (p != NULL) {
        if (p->type == json_type_long && strcmp((char*)p->key, key) == 0)
            return *(long*)p->value;
        p = p->next;
    }
    return -1;
}

arco_json* get_object_from_object(arco_json* json, char* key)
{
    if (json == NULL || json->type != json_type_object || json->value == NULL) return NULL;
    arco_json* p = json->value;
    while (p != NULL) {
        if (p->type == json_type_object && strcmp((char*)p->key, key) == 0) {
            arco_json* res = my_malloc(sizeof(arco_json));
            memcpy(res, p, sizeof(arco_json));
            return res;
        }
        p = p->next;
    }
    return NULL;
}

arco_json* get_object_from_array(arco_json* json, int idx)
{
    if (json == NULL || json->type != json_type_array || json->value == NULL) return NULL;
    int i = 0;
    arco_json* p = json->value;
    while (p != NULL) {
        if (p->type == json_type_object) {
            if (i == idx) {
                arco_json* res = my_malloc(sizeof(arco_json));
                memcpy(res, p, sizeof(arco_json));
                return res;
            }
            i++;
        }
        p = p->next;
    }
    return NULL;
}

/* -------------------------------------------------------
 * 工具函数
 * ------------------------------------------------------- */

int getDigitCount(int num)
{
    if (num == 0) return 1;
    int count = 0;
    while (num != 0) { num /= 10; count++; }
    return count;
}

char* dec2str(int num)
{
    if (num == 0) {
        char* str = (char*)my_malloc(2);
        if (!str) return NULL;
        str[0] = '0'; str[1] = '\0';
        return str;
    }
    int isNegative = 0;
    if (num < 0) { isNegative = 1; num = -num; }
    int digitCount = getDigitCount(num);
    int strLength = digitCount + isNegative + 1;
    char* str = (char*)my_malloc(strLength);
    if (!str) return NULL;
    char* cur = str + strLength - 1;
    *cur-- = '\0';
    while (num != 0) { *cur-- = num % 10 + '0'; num /= 10; }
    if (isNegative) *cur = '-';
    return str;
}

#endif /* EXTERN_CJSON_INSTALL_EN */
```
