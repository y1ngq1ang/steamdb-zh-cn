# SteamDB 简体中文汉化

一个用于 [steamdb.info](https://steamdb.info/) 的油猴脚本：把界面上的固定字段换成简体中文，并把游戏名称换成 Steam 简体中文商店里的官方中文名。

## 功能

- **界面字段汉化**：应用信息表（App ID、最后记录更新、发行日期…）、标签页、历史与构建表格、首页榜单表头、侧边导航与页脚，共 360+ 个词条。
- **游戏名称汉化**：不管是 `/app/<id>/` 还是首页榜单用的 `/app/<id>/charts/` 链接，只要正文是游戏名，就会替换为 Steam 简体中文名。
- **相对时间汉化**：`3 hours ago` → `3 小时前`，`in 2 days` → `2 天后`，`2 months` → `2 个月`。
- **输入框提示汉化**：搜索框等 `placeholder` / `title` 提示。
- **可随时关闭**：所有替换都记录了原文，关掉开关后页面完全恢复英文，不需要刷新。
- **本地缓存**：名称缓存 30 天，重复访问不会重复请求。

## 安装

**一键安装**：先装好下面的用户脚本管理器，然后点这里 →

<https://raw.githubusercontent.com/y1ngq1ang/steamdb-zh-cn/main/steamdb-zh-cn.user.js>

管理器会弹出安装页面，确认即可。脚本头部带了 `@updateURL`，之后我更新仓库里的版本时，你的管理器会自动提示升级。

手动安装：

1. 先装一个用户脚本管理器：
   - Chrome / Edge：[Tampermonkey](https://www.tampermonkey.net/) 或 [脚本猫](https://scriptcat.org/)
   - Firefox：[Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. 打开管理器的「添加新脚本」，把 `steamdb-zh-cn.user.js` 的内容整个粘贴进去，保存。
   （Tampermonkey 用户也可以直接把 `.user.js` 文件拖进浏览器窗口。）
3. 访问 https://steamdb.info/ ，页面右下角会出现一个「中」字悬浮球。

> 首次运行时 Tampermonkey 会询问是否允许跨域请求 `store.steampowered.com`，请点「总是允许」，否则游戏名称无法汉化。

## 使用

- 点右下角悬浮球打开设置面板；`Alt + T` 可以把汉化一键开 / 关。
- 面板选项：
  - **启用汉化**：总开关。
  - **翻译游戏名称**：只翻界面、保留英文游戏名时关掉它。
  - **翻译相对时间**：`3 hours ago` 这类文本。
  - **翻译输入框提示**：`placeholder` / `title` 属性。
- **重新汉化**：页面内容异常时手动重扫一遍。
- **清除名称缓存**：名称有更新或想重新拉取时用。
- **复制未翻译词条**：把当前页面还没翻译的英文词条复制到剪贴板，方便补充词典。

## 名称是怎么来的

名称取自 Steam 简体中文商店（`l=schinese`），请求形如：

```
https://store.steampowered.com/api/appdetails?appids=730&filters=basic&l=schinese
```

- 该接口已不支持 `appids=1,2,3` 这种批量写法（会返回 400），所以脚本逐个请求，最多 3 个并发、每次间隔 120ms。
- 只请求**进入视口**的名称，每轮最多 30 个，避免列表页一次打几百个请求。
- 带上 `l=schinese` 就能拿到 `艾尔登法环` 这类官方中文名；不加 `cc` 参数，避免被区域锁定的游戏取不到名字。
- 没有官方中文名的游戏（例如部分独立游戏）会保持英文原名。
- 名称与应用信息里的「开发商 / 发行商 / 标签」等专有名词不会被词典误翻。

## 扩展词典

打开脚本，找到 `RAW_DICT` 数组，按 `['English', '中文']` 的格式追加即可：

```js
['Some New Label', '某个新词条'],
```

键是**整段文本**（大小写不敏感，首尾空白会忽略），不做逐词替换，所以长句里的英文不会被误伤。加完保存，刷新页面生效。

## 已知限制

- SteamDB 的页面结构由它自己维护，改版后可能出现个别字段漏翻；此时点「复制未翻译词条」就能拿到清单。
- 只在整段文本完全匹配时替换，所以「Game Name · SteamDB」这类拼接字符串里的英文不会被替换（这是有意为之，避免破坏游戏名和数字）。
- 脚本只改变页面显示，不改变 SteamDB 的任何数据与链接。
- 若浏览器处于隐私模式，名称缓存可能无法写入，每次打开都会重新请求。

## 文件

| 文件 | 说明 |
| --- | --- |
| `steamdb-zh-cn.user.js` | 油猴脚本本体，直接安装即可 |
| `README.md` | 本说明 |
| `LICENSE` | MIT 许可证 |

仓库：<https://github.com/y1ngq1ang/steamdb-zh-cn>