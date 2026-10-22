// ==UserScript==
// @name         SteamDB 简体中文汉化
// @namespace    https://steamdb.info/
// @version      1.2.0
// @description  将 SteamDB 的固定界面字段汉化为简体中文，并将游戏名称替换为 Steam 简体中文商店中的官方中文名
// @author       Cherry Assistant
// @match        https://steamdb.info/*
// @match        https://*.steamdb.info/*
// @run-at       document-idle
// @homepageURL  https://github.com/y1ngq1ang/steamdb-zh-cn
// @supportURL   https://github.com/y1ngq1ang/steamdb-zh-cn/issues
// @downloadURL  https://raw.githubusercontent.com/y1ngq1ang/steamdb-zh-cn/main/steamdb-zh-cn.user.js
// @updateURL    https://raw.githubusercontent.com/y1ngq1ang/steamdb-zh-cn/main/steamdb-zh-cn.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      store.steampowered.com
// @noframes
// @license      MIT
// ==/UserScript==

/*
 * 工作原理
 * ----------
 * 1. 界面字段：用「整段文本精确匹配」的词典替换文本节点，不改动 DOM 结构，因此不会破坏
 *    SteamDB 的链接、数值、排序与复制按钮。动态加载的内容由 MutationObserver 增量处理。
 * 2. 游戏名称：抓取 /app/<id>/ 链接，按可见性排队调用 Steam 商店接口
 *    （appdetails + filters=basic + l=schinese）取简体中文商店里的官方中文名，带本地缓存。
 * 3. 所有替换都记录了原文，关闭开关可以完整还原。
 */

(function () {
  'use strict';

  /* ==========================================================================
   * 一、设置与本地存储
   * ========================================================================== */

  const LS_SETTINGS = 'sdbcn.settings.v1';
  const LS_NAMES = 'sdbcn.names.v1';

  const DEFAULTS = {
    enabled: true,      // 总开关
    names: true,        // 翻译游戏名称
    relativeTime: true, // 翻译“3 hours ago”这类相对时间
    attrs: true         // 翻译 placeholder / title 提示文字
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 隐私模式下可能写不进去，忽略 */
    }
  }

  const settings = Object.assign({}, DEFAULTS, readJSON(LS_SETTINGS, {}));

  function saveSettings() {
    writeJSON(LS_SETTINGS, settings);
  }

  /* ==========================================================================
   * 二、界面词条词典
   * ========================================================================== */

  const RAW_DICT = [
    /* —— 顶部导航 / 通用 —— */
    ['Home', '首页'],
    ['Apps', '应用'],
    ['App', '应用'],
    ['Packages', '包'],
    ['Package', '包'],
    ['Bundles', '捆绑包'],
    ['Bundle', '捆绑包'],
    ['Sales', '特惠'],
    ['Free Packages', '免费包'],
    ['Charts', '图表'],
    ['Statistics', '统计'],
    ['Tools', '工具'],
    ['Patchnotes', '更新日志'],
    ['Patch notes', '更新日志'],
    ['Watchlist', '关注列表'],
    ['Account', '账户'],
    ['Login', '登录'],
    ['Logout', '退出登录'],
    ['Log out', '退出登录'],
    ['Sign in', '登录'],
    ['Sign up', '注册'],
    ['Register', '注册'],
    ['Settings', '设置'],
    ['About', '关于'],
    ['Contact', '联系'],
    ['FAQ', '常见问题'],
    ['Docs', '文档'],
    ['Documentation', '文档'],
    ['Donate', '捐赠'],
    ['Search', '搜索'],
    ['Instant Search', '即时搜索'],
    ['Search results', '搜索结果'],
    ['Search apps, packages, bundles…', '搜索应用、包、捆绑包…'],
    ['Search apps, packages, bundles...', '搜索应用、包、捆绑包…'],

    /* —— 应用页分区 / 标签页 —— */
    ['App Info', '应用信息'],
    ['Info', '信息'],
    ['History', '历史'],
    ['Depots', '仓库'],
    ['Depot', '仓库'],
    ['Builds', '构建'],
    ['Build', '构建'],
    ['Manifests', '清单'],
    ['Manifest', '清单'],
    ['Branches', '分支'],
    ['Branch', '分支'],
    ['Achievements', '成就'],
    ['Stats', '统计'],
    ['Leaderboards', '排行榜'],
    ['Media', '媒体'],
    ['Related', '相关'],
    ['Community', '社区'],
    ['Store', '商店'],
    ['Prices', '价格'],
    ['Price', '价格'],
    ['Price History', '价格历史'],
    ['Reviews', '评测'],
    ['Review', '评测'],
    ['News', '新闻'],
    ['Guides', '指南'],
    ['Workshop', '创意工坊'],
    ['Screenshots', '截图'],
    ['Videos', '视频'],

    /* —— 应用信息表 —— */
    ['App ID', '应用 ID'],
    ['Package ID', '包 ID'],
    ['Bundle ID', '捆绑包 ID'],
    ['Sub ID', '订阅 ID'],
    ['App Type', '应用类型'],
    ['Developer', '开发商'],
    ['Developers', '开发商'],
    ['Publisher', '发行商'],
    ['Publishers', '发行商'],
    ['Last Record Update', '最后记录更新'],
    ['Last Change Number', '最后变更编号'],
    ['Change Number', '变更编号'],
    ['Release Date', '发行日期'],
    ['Store Release Date', '商店发行日期'],
    ['Supported Systems', '支持平台'],
    ['Store Price', '商店价格'],
    ['SteamDB Rating', 'SteamDB 评分'],
    ['Rating', '评分'],
    ['Followers', '关注者'],
    ['Peak Players', '峰值玩家'],
    ['All-time Peak', '历史最高'],
    ['24-hour Peak', '24 小时峰值'],
    ['Current Players', '当前玩家'],
    ['Player Count', '玩家数'],
    ['Genres', '游戏类型'],
    ['Genre', '游戏类型'],
    ['Categories', '分类'],
    ['Category', '分类'],
    ['Tags', '标签'],
    ['Tag', '标签'],
    ['Languages', '语言'],
    ['Supported Languages', '支持的语言'],
    ['Full Audio', '完整音频'],
    ['Subtitles', '字幕'],
    ['Interface', '界面'],
    ['Anti-cheat', '反作弊'],
    ['Release State', '发行状态'],
    ['Discount', '折扣'],
    ['Original Price', '原价'],
    ['Final Price', '现价'],

    /* —— 发行状态 / 应用类型取值 —— */
    ['Coming soon', '即将推出'],
    ['Released', '已发行'],
    ['Early Access', '抢先体验'],
    ['Delisted', '已下架'],
    ['Free', '免费'],
    ['Free to Play', '免费游玩'],
    ['Paid', '付费'],
    ['Demo', '演示版'],
    ['Playtest', '测试'],
    ['Game', '游戏'],
    ['Games', '游戏'],
    ['DLC', 'DLC'],
    ['Application', '应用程序'],
    ['Tool', '工具'],
    ['Music', '音乐'],
    ['Video', '视频'],
    ['Hardware', '硬件'],
    ['Series', '系列'],
    ['Config', '配置'],
    ['Driver', '驱动'],
    ['Beta', '测试'],
    ['Soundtrack', '原声带'],

    /* —— 历史 / 构建表格 —— */
    ['Build ID', '构建 ID'],
    ['Time Updated', '更新时间'],
    ['Last Updated', '最后更新'],
    ['Time', '时间'],
    ['Date', '日期'],
    ['Description', '说明'],
    ['Password', '密码'],
    ['Depot ID', '仓库 ID'],
    ['Manifest ID', '清单 ID'],
    ['Size', '大小'],
    ['Size on Disk', '磁盘占用'],
    ['Download Size', '下载大小'],
    ['Status', '状态'],
    ['Parent', '父级'],
    ['Notes', '备注'],
    ['Note', '备注'],
    ['Name', '名称'],
    ['Type', '类型'],
    ['Value', '值'],
    ['Actions', '操作'],
    ['Action', '操作'],
    ['Added', '添加'],
    ['Removed', '移除'],
    ['Modified', '修改'],
    ['Changes', '变更'],
    ['Change', '变更'],
    ['Total', '总计'],
    ['Average', '平均'],
    ['Minimum', '最小'],
    ['Maximum', '最大'],
    ['Count', '数量'],

    /* —— 通用取值 —— */
    ['Yes', '是'],
    ['No', '否'],
    ['Unknown', '未知'],
    ['None', '无'],
    ['N/A', '无'],
    ['Enabled', '已启用'],
    ['Disabled', '已禁用'],
    ['Public', '公开'],
    ['Private', '私有'],
    ['Active', '活跃'],
    ['Inactive', '不活跃'],
    ['Default', '默认'],
    ['Available', '可用'],
    ['Not available', '不可用'],
    ['Loading…', '加载中…'],
    ['Loading...', '加载中…'],
    ['Loading', '加载中'],
    ['No results found.', '未找到结果。'],
    ['No results.', '无结果。'],

    /* —— 功能 / 特性标签 —— */
    ['Single-player', '单人'],
    ['Multiplayer', '多人'],
    ['Co-op', '合作'],
    ['Online PvP', '在线 PvP'],
    ['Online Co-op', '在线合作'],
    ['Shared/Split Screen', '共享/分屏'],
    ['Cross-Platform Multiplayer', '跨平台多人'],
    ['Full controller support', '完全支持控制器'],
    ['Partial Controller Support', '部分支持控制器'],
    ['VR Supported', '支持 VR'],
    ['VR Only', '仅支持 VR'],
    ['Steam Deck Compatibility', 'Steam Deck 兼容性'],
    ['Verified', '已验证'],
    ['Playable', '可玩'],
    ['Unsupported', '不支持'],
    ['Trading Cards', '集换式卡牌'],
    ['Steam Workshop', '创意工坊'],
    ['Steam Cloud', 'Steam 云'],
    ['Remote Play', '远程同乐'],
    ['Family Sharing', '家庭共享'],
    ['In-App Purchases', '应用内购买'],
    ['Captions available', '提供字幕'],
    ['Commentary available', '提供解说'],
    ['Includes level editor', '包含关卡编辑器'],

    /* —— 登录 / 关注 —— */
    ['Username', '用户名'],
    ['Remember me', '记住我'],
    ['Forgot password?', '忘记密码？'],
    ['Two-factor code', '两步验证码'],
    ['Sign in through Steam', '通过 Steam 登录'],
    ['Add to watchlist', '添加到关注列表'],
    ['Remove from watchlist', '从关注列表移除'],
    ['Watching', '关注中'],

    /* —— 操作按钮 —— */
    ['Show more', '显示更多'],
    ['Show less', '收起'],
    ['Show all', '显示全部'],
    ['View all', '查看全部'],
    ['View', '查看'],
    ['Open', '打开'],
    ['More', '更多'],
    ['Less', '收起'],
    ['Filter', '筛选'],
    ['Filters', '筛选'],
    ['Sort by', '排序方式'],
    ['Apply', '应用'],
    ['Reset', '重置'],
    ['Clear', '清除'],
    ['Close', '关闭'],
    ['Cancel', '取消'],
    ['Save', '保存'],
    ['Copy', '复制'],
    ['Copied!', '已复制！'],
    ['Next', '下一页'],
    ['Previous', '上一页'],
    ['First', '首页'],
    ['Last', '末页'],
    ['Download', '下载'],

    /* —— 图表 / 列表页 —— */
    ['Most played', '最多游玩'],
    ['Most Played Games', '最多游玩'],
    ['Trending Games', '热门游戏'],
    ['Players Now', '当前玩家'],
    ['24h Peak', '24 小时峰值'],
    ['Last 7 days', '最近 7 天'],
    ['Popular Releases', '热门新品'],
    ['Hot Releases', '热销新品'],
    ['AppID', '应用 ID'],
    ['Last Update', '最后更新'],
    ['Wishlist', '愿望单'],
    ['Top rated', '最高评分'],
    ['Trending', '热门'],
    ['New releases', '新品'],
    ['Upcoming', '即将推出'],
    ['Release date', '发行日期'],
    ['Review score', '评测分数'],
    ['Metacritic score', 'Metacritic 评分'],

    /* —— 侧边导航 / 页脚 —— */
    ['Calculator', '计算器'],
    ['Blog', '博客'],
    ['Discord Bot', 'Discord 机器人'],
    ['help', '帮助'],
    ['Help', '帮助'],
    ['contribute', '参与贡献'],
    ['Browser extension', '浏览器扩展'],
    ['Discovery', '发现'],
    ['Deals', '优惠'],
    ['Upcoming releases', '即将发售'],
    ['Release calendar', '发售日历'],
    ['Free promotions', '免费福利'],
    ['Price changes', '价格变动'],
    ['When is next sale?', '下次特惠是什么时候？'],
    ['Steam Status', 'Steam 状态'],
    ['Database', '数据库'],
    ['Game tags', '游戏标签'],
    ['Profile badges', '个人资料徽章'],
    ['Engines', '引擎'],
    ['technologies', '技术'],
    ['Game releases by year', '按年份发布的游戏'],
    ['Change history', '变更历史'],
    ['Rankings', '排行'],
    ['Top rated games', '评分最高的游戏'],
    ['Global top sellers', '全球畅销榜'],
    ['Weekly top sellers', '每周畅销榜'],
    ['Most followed games', '关注最多的游戏'],
    ['Most wishlisted games', '愿望单最多的游戏'],
    ['Wishlist activity', '愿望单动态'],
    ['Daily active users', '日活跃用户'],
    ['Top game owners', '游戏库最多的用户'],
    ['Top profile levels', '等级最高的用户'],
    ['Sign in via Steam', '通过 Steam 登录'],
    ['Patches', '补丁'],
    ['New on store:', '商店新增：'],
    ['New on store', '商店新增'],
    ['Removed from store:', '商店下架：'],
    ['Removed from store', '商店下架'],
    ['Renamed on store:', '商店改名：'],
    ['Renamed on store', '商店改名'],
    ['New:', '新增：'],

    /* —— 页脚 —— */
    ['Privacy Policy', '隐私政策'],
    ['Terms of Service', '服务条款'],
    ['Cookies', 'Cookie'],
    ['Copyright', '版权'],
    ['All rights reserved', '保留所有权利']
  ];

  const DICT = new Map();
  for (const pair of RAW_DICT) {
    const key = pair[0].toLowerCase();
    if (!DICT.has(key)) DICT.set(key, pair[1]);
  }

  /* 带数量的短语规则（整段匹配，不做逐词替换） */
  const RULES = [
    [/^([\d,]+)\s+apps?$/i, '$1 个应用'],
    [/^([\d,]+)\s+packages?$/i, '$1 个包'],
    [/^([\d,]+)\s+bundles?$/i, '$1 个捆绑包'],
    [/^([\d,]+)\s+games?$/i, '$1 款游戏'],
    [/^([\d,]+)\s+results?$/i, '$1 个结果'],
    [/^([\d,]+)\s+players?$/i, '$1 名玩家'],
    [/^([\d,]+)\s+followers?$/i, '$1 位关注者'],
    [/^([\d,]+)\s+items?$/i, '$1 个项目'],
    [/^([\d,]+)\s+achievements?$/i, '$1 个成就'],
    [/^([\d,]+)\s+depots?$/i, '$1 个仓库'],
    [/^page\s+(\d+)\s+of\s+(\d+)$/i, '第 $1 页，共 $2 页']
  ];

  /* 相对时间 / 时长 */
  const UNIT_SRC = 'seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?';
  const AGO_RE = new RegExp('^(?:(less than|about|over)\\s+)?(an?|one|\\d+(?:[.,]\\d+)?)\\s+(' + UNIT_SRC + ')\\s+ago$', 'i');
  const IN_RE = new RegExp('^in\\s+(an?|one|\\d+(?:[.,]\\d+)?)\\s+(' + UNIT_SRC + ')$', 'i');
  const DUR_RE = new RegExp('^(an?|one|\\d+(?:[.,]\\d+)?)\\s+(' + UNIT_SRC + ')$', 'i');

  function unitCN(unit) {
    const u = unit.toLowerCase();
    if (u.startsWith('sec')) return '秒';
    if (u.startsWith('min')) return '分钟';
    if (u.startsWith('mo')) return '个月';
    if (u.startsWith('h')) return '小时';
    if (u.startsWith('d')) return '天';
    if (u.startsWith('w')) return '周';
    if (u.startsWith('y')) return '年';
    return '';
  }

  function numCN(value) {
    if (/^(a|an|one)$/i.test(value)) return '1';
    return value.replace(',', '.');
  }

  function relTime(text) {
    const s = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (s === 'just now' || s === 'a moment ago' || s === 'moments ago' || s === 'seconds ago') return '刚刚';
    if (s === 'yesterday') return '昨天';
    if (s === 'today') return '今天';

    let m = AGO_RE.exec(s);
    if (m) {
      const qualifier = m[1] ? ({ 'less than': '不到 ', about: '约 ', over: '超过 ' })[m[1].toLowerCase()] : '';
      return qualifier + numCN(m[2]) + ' ' + unitCN(m[3]) + '前';
    }
    m = IN_RE.exec(s);
    if (m) return numCN(m[1]) + ' ' + unitCN(m[2]) + '后';
    m = DUR_RE.exec(s);
    if (m) return numCN(m[1]) + ' ' + unitCN(m[2]);
    return null;
  }

  const hasCJK = (s) => /[㐀-鿿豈-﫿]/.test(s);

  const MONTHS = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
    sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
  };
  const ENDS_DATE_RE = /^ends\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)$/i;
  const ENDS_IN_RE = new RegExp('^ends\\s+in\\s+(an?|one|\\d+)\\s+(' + UNIT_SRC + ')$', 'i');

  /* 特惠倒计时：Ends 5th January / Ends in 3 days */
  function endsText(text) {
    const s = text.trim();
    let m = ENDS_DATE_RE.exec(s);
    if (m) {
      const month = MONTHS[m[2].toLowerCase()];
      if (month) return month + ' 月 ' + parseInt(m[1], 10) + ' 日结束';
    }
    m = ENDS_IN_RE.exec(s);
    if (m) return numCN(m[1]) + ' ' + unitCN(m[2]) + '后结束';
    return null;
  }

  function translateString(text) {
    const t = text.trim();
    if (!t || t.length > 80) return null;

    const hit = DICT.get(t.toLowerCase());
    if (hit !== undefined) return hit;

    if (settings.relativeTime) {
      const r = relTime(t);
      if (r) return r;
      const e = endsText(t);
      if (e) return e;
    }

    for (const rule of RULES) {
      if (rule[0].test(t)) return t.replace(rule[0], rule[1]);
    }
    return null;
  }

  /* ==========================================================================
   * 三、文本节点替换（可还原）
   * ========================================================================== */

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE',
    'CODE', 'PRE', 'KBD', 'SAMP', 'VAR',
    'TEXTAREA', 'INPUT', 'IFRAME', 'OBJECT', 'EMBED',
    'SVG', 'CANVAS', 'MATH'
  ]);

  const SKIP_HOST_SELECTOR = '[data-sdbcn-skip]';

  /* 把链接解析成站内路径；外链返回 null */
  function sitePath(href) {
    if (!href || href === '#' || href.charAt(0) === '#') return null;
    let url;
    try {
      url = new URL(href, location.href);
    } catch (e) {
      return null;
    }
    const host = url.hostname.replace(/^www\./, '');
    const here = location.hostname.replace(/^www\./, '');
    return host === here ? url.pathname : null;
  }

  /* 名称链接：/app/730/、/app/730、/app/730/charts/（首页榜单用的就是 charts） */
  function appIdFromHref(href) {
    const path = sitePath(href);
    if (!path) return null;
    const m = /^\/app\/(\d+)(?:\/charts)?\/?$/i.exec(path);
    return m ? m[1] : null;
  }

  /* 指向“实体名称”的链接：正文是名词，不能按词典翻译 */
  function isProtectedAnchor(a) {
    const path = sitePath(a.getAttribute('href'));
    if (!path) return false;
    if (/^\/(package|bundle|depot|manifest|curator|developer|publisher|franchise|tag|genre|category|stats)\//i.test(path)) {
      return true;
    }
    if (/^\/app\/\d+(?:\/charts)?\/?$/i.test(path)) return true;
    return false;
  }

  const textRecords = [];

  function setText(node, value) {
    const rec = node.__sdbcn;
    if (!rec) {
      node.__sdbcn = { orig: node.nodeValue, applied: value };
      textRecords.push(node);
    } else {
      rec.applied = value;
    }
    node.nodeValue = value;
  }

  function translateTextNode(node) {
    const raw = node.nodeValue;
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;

    const replaced = translateString(trimmed);
    if (replaced === null || replaced === trimmed) return;

    const start = raw.indexOf(trimmed);
    setText(node, raw.slice(0, start) + replaced + raw.slice(start + trimmed.length));
  }

  /* SteamDB 常把一句标签拆进多个 span（如 Most Played<span> Games</span>），
     整段匹配到这里，命中的话合并成一个文本节点，保留图标等非文本子元素 */
  const PHRASE_SELECTOR = 'th, th a, .table-title, .table-title a, h1, h2, h3, h4, .tab, .tab a';
  const PHRASE_BLOCKED = 'a,button,input,select,textarea,img,pre,code,canvas,table';

  function translatePhrase(el) {
    if (!el || el.children.length === 0 || el.children.length > 4) return;
    if (el.closest(SKIP_HOST_SELECTOR)) return;
    if (el.querySelector(PHRASE_BLOCKED)) return;

    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text || text.length > 60) return;

    const zh = translateString(text);
    if (!zh || zh === text) return;

    const nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    if (!nodes.length) return;

    let first = true;
    for (const node of nodes) {
      setText(node, first ? zh : '');
      first = false;
    }
  }

  function translatePhrases(root) {
    const candidates = [];
    if (root.matches && root.matches(PHRASE_SELECTOR)) candidates.push(root);
    if (root.querySelectorAll) {
      const list = root.querySelectorAll(PHRASE_SELECTOR);
      for (const el of list) candidates.push(el);
    }
    for (const el of candidates) translatePhrase(el);
  }

  function isTranslatableText(node) {
    const parent = node.parentElement;
    if (!parent) return false;
    if (SKIP_TAGS.has(parent.tagName)) return false;
    if (parent.closest(SKIP_HOST_SELECTOR)) return false;

    const text = node.nodeValue;
    if (!text || !text.trim() || text.length > 200) return false;

    const anchor = parent.closest('a');
    if (anchor && isProtectedAnchor(anchor)) {
      // 只有导航文字（词典里有的）才翻译，否则视为实体名称，交给名称模块处理
      return DICT.has(text.trim().toLowerCase());
    }
    return true;
  }

  function translateTree(root) {
    if (!settings.enabled || !root) return;

    if (root.nodeType === 3) {
      if (isTranslatableText(root)) translateTextNode(root);
      return;
    }
    if (root.nodeType !== 1) return;
    if (root.closest(SKIP_HOST_SELECTOR)) return;

    translatePhrases(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isTranslatableText(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) translateTextNode(node);

    if (settings.attrs) translateAttrs(root);
  }

  /* ==========================================================================
   * 四、placeholder / title 属性
   * ========================================================================== */

  const attrRecords = [];

  function translateAttrs(root) {
    const targets = [];
    if (root.nodeType === 1) {
      if (root.hasAttribute('placeholder') || root.hasAttribute('title')) targets.push(root);
      if (root.querySelectorAll) {
        const list = root.querySelectorAll('[placeholder],[title]');
        for (const el of list) targets.push(el);
      }
    }

    for (const el of targets) {
      if (el.closest(SKIP_HOST_SELECTOR)) continue;
      for (const attr of ['placeholder', 'title']) {
        const value = el.getAttribute(attr);
        if (!value) continue;
        const t = value.trim();
        if (!t || t.length > 80) continue;
        const zh = DICT.get(t.toLowerCase());
        if (!zh || zh === t) continue;
        attrRecords.push({ el, attr, orig: value, applied: zh });
        el.setAttribute(attr, zh);
      }
    }
  }

  /* ==========================================================================
   * 五、游戏名称汉化
   * ========================================================================== */

  const NAME_TTL = 30 * 24 * 60 * 60 * 1000; // 30 天
  let nameCache = readJSON(LS_NAMES, {});

  /**
   * 返回：字符串 = 有中文名；null = 已知没有；undefined = 未知，需要请求
   */
  function getName(id) {
    const rec = nameCache[id];
    if (!rec) return undefined;
    if (rec.n === null) {
      if (!rec.t || Date.now() - rec.t > NAME_TTL) {
        delete nameCache[id];
        return undefined;
      }
      return null;
    }
    return typeof rec.n === 'string' ? rec.n : undefined;
  }

  let saveNamesTimer = null;
  function saveNamesLater() {
    clearTimeout(saveNamesTimer);
    saveNamesTimer = setTimeout(() => {
      const keys = Object.keys(nameCache);
      if (keys.length > 4000) {
        keys.sort((a, b) => (nameCache[a].t || 0) - (nameCache[b].t || 0));
        for (let i = 0; i < keys.length - 4000; i++) delete nameCache[keys[i]];
      }
      writeJSON(LS_NAMES, nameCache);
      refreshStat();
    }, 800);
  }

  const pending = new Map();   // appId -> Set<Element>
  const inFlight = new Set();  // 正在请求的 appId
  const visibleIds = new Set(); // 已经进入视口的 appId
  const retries = new Map();   // appId -> 失败次数

  const nameRecords = [];

  function pickTextNode(el) {
    if (!el.firstChild) return null;
    if (el.children.length === 0) {
      return el.firstChild.nodeType === 3 ? el.firstChild : null;
    }
    let best = null;
    let bestLen = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement && node.parentElement.closest(SKIP_HOST_SELECTOR)) continue;
      const len = node.nodeValue.trim().length;
      if (len > bestLen) {
        best = node;
        bestLen = len;
      }
    }
    return bestLen > 0 ? best : null;
  }

  function applyName(el, name) {
    if (!el || !name) return;
    if (el.hasAttribute('data-sdbcn-name')) return;
    if (hasCJK(el.textContent)) return;

    const node = pickTextNode(el);
    if (!node) return;

    const raw = node.nodeValue;
    const trimmed = raw.trim();
    if (!trimmed) return;

    const start = raw.indexOf(trimmed);
    const applied = raw.slice(0, start) + name + raw.slice(start + trimmed.length);
    if (applied === raw) return;

    node.nodeValue = applied;
    nameRecords.push({ node, orig: raw, applied });
    el.setAttribute('data-sdbcn-name', name);
  }

  const appIdFromPath = () => {
    const m = /^\/app\/(\d+)/.exec(location.pathname);
    return m ? m[1] : null;
  };

  function considerAnchor(a) {
    if (!a || a.hasAttribute('data-sdbcn-name')) return;
    if (a.closest(SKIP_HOST_SELECTOR)) return;

    const id = appIdFromHref(a.getAttribute('href'));
    if (!id) return;
    const text = a.textContent.trim();
    if (!text || text.length > 120) return;
    if (hasCJK(text)) return;
    if (/^\d+$/.test(text)) return;
    if (DICT.has(text.toLowerCase())) return; // 这是导航文字，不是名称

    const cached = getName(id);
    if (typeof cached === 'string') {
      applyName(a, cached);
      return;
    }
    if (cached === null) return;
    enqueue(id, a);
  }

  function considerHeading(h1, id) {
    if (!h1 || h1.hasAttribute('data-sdbcn-name')) return;
    if (h1.closest(SKIP_HOST_SELECTOR)) return;
    if (h1.querySelector('a, button, input')) return; // 有交互元素时不动

    const text = h1.textContent.trim();
    if (!text || text.length > 120) return;
    if (hasCJK(text)) return;
    if (DICT.has(text.toLowerCase())) return;

    // 名称必须是标题里唯一的文本（允许旁边有图标），否则可能是「名称 + 徽章」
    const node = pickTextNode(h1);
    if (!node || node.nodeValue.trim() !== text) return;

    const cached = getName(id);
    if (typeof cached === 'string') {
      applyName(h1, cached);
      return;
    }
    if (cached === null) return;
    enqueue(id, h1);
  }

  const io = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        let hit = false;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.__sdbcnId;
          io.unobserve(entry.target);
          if (id) {
            visibleIds.add(id);
            hit = true;
          }
        }
        if (hit) scheduleFlush();
      }, { rootMargin: '300px 0px' })
    : null;

  function enqueue(id, el) {
    el.__sdbcnId = id;
    let set = pending.get(id);
    if (!set) {
      set = new Set();
      pending.set(id, set);
    }
    set.add(el);

    if (io) io.observe(el);
    else {
      visibleIds.add(id);
      scheduleFlush();
    }
  }

  function localizeNamesIn(root) {
    if (!settings.enabled || !settings.names) return;
    if (!root || root.nodeType !== 1) return;

    const anchors = [];
    if (root.matches && root.matches('a[href*="/app/"]')) anchors.push(root);
    if (root.querySelectorAll) {
      const list = root.querySelectorAll('a[href*="/app/"]');
      for (const a of list) anchors.push(a);
    }
    for (const a of anchors) considerAnchor(a);

    const id = appIdFromPath();
    if (id) {
      const headings = [];
      if (root.matches && root.matches('h1')) headings.push(root);
      if (root.querySelectorAll) {
        const list = root.querySelectorAll('h1');
        for (const h of list) headings.push(h);
      }
      for (const h of headings) considerHeading(h, id);
    }
  }

  /* —— 网络请求 —— */

  function gmFetchJSON(url) {
    return new Promise((resolve, reject) => {
      const finish = (text) => {
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          reject(new Error('返回内容不是 JSON'));
        }
      };
      const fail = (err) => reject(err instanceof Error ? err : new Error(String(err)));

      const request = (typeof GM_xmlhttpRequest === 'function')
        ? GM_xmlhttpRequest
        : ((typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') ? GM.xmlHttpRequest : null);

      if (request) {
        try {
          request({
            method: 'GET',
            url,
            timeout: 15000,
            headers: { Accept: 'application/json' },
            onload: (res) => {
              if (res.status >= 200 && res.status < 300) finish(res.responseText);
              else fail(new Error('HTTP ' + res.status));
            },
            onerror: () => fail(new Error('网络错误')),
            ontimeout: () => fail(new Error('请求超时'))
          });
        } catch (e) {
          fail(e);
        }
        return;
      }

      fetch(url, { credentials: 'omit', headers: { Accept: 'application/json' } })
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(finish, fail);
    });
  }

  /* 名称统一取自 Steam 简体中文商店（l=schinese）。
     注意：接口已不支持 appids=1,2,3 这种批量写法（会返回 400），必须逐个请求 */
  function buildUrl(id) {
    return 'https://store.steampowered.com/api/appdetails?appids=' + id + '&filters=basic&l=schinese';
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function nameOf(entry) {
    if (entry && entry.success && entry.data && typeof entry.data.name === 'string') {
      return entry.data.name;
    }
    return null;
  }

  const NAME_CONCURRENCY = 3;

  async function fetchNames(ids) {
    const names = {}; // appId -> 中文名 | null
    let anySuccess = false;

    const queue = ids.slice();
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          const json = await gmFetchJSON(buildUrl(id));
          if (!json || typeof json !== 'object') throw new Error('返回格式异常');
          names[id] = nameOf(json[id]);
          anySuccess = true;
        } catch (e) {
          /* 单个应用失败不影响其他，缺失的 ID 会进入重试 */
        }
        await sleep(120); // 控制请求频率
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(NAME_CONCURRENCY, ids.length); i++) workers.push(worker());
    await Promise.all(workers);

    if (!anySuccess) throw new Error('名称接口不可用');
    return names;
  }

  let flushTimer = null;
  let consecutiveFailures = 0;

  function scheduleFlush(delay) {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushNames();
    }, typeof delay === 'number' ? delay : 400);
  }

  async function flushNames() {
    if (!settings.enabled || !settings.names) return;
    if (!visibleIds.size) return;

    const ids = [];
    for (const id of visibleIds) {
      if (inFlight.has(id)) continue;
      ids.push(id);
      if (ids.length >= 30) break;
    }
    for (const id of ids) visibleIds.delete(id);
    if (!ids.length) return;

    for (const id of ids) inFlight.add(id);

    let result = null;
    try {
      result = await fetchNames(ids);
      consecutiveFailures = 0;
    } catch (e) {
      consecutiveFailures++;
      for (const id of ids) {
        inFlight.delete(id);
        visibleIds.add(id); // 放回去，稍后重试
      }
      // 连续失败 3 次就暂停，避免离线时反复请求
      if (consecutiveFailures < 3) scheduleFlush(8000);
      return;
    }

    const now = Date.now();
    const retry = [];

    for (const id of ids) {
      inFlight.delete(id);

      // 没有拿到明确结果（接口挂了 / 被跳过）时不要写进缓存，留给下次重试
      if (!(id in result)) {
        const tries = (retries.get(id) || 0) + 1;
        if (tries < 3) {
          retries.set(id, tries);
          retry.push(id);
          continue;
        }
        retries.delete(id);
      } else {
        retries.delete(id);
      }

      const name = (typeof result[id] === 'string') ? result[id] : null;
      nameCache[id] = { n: name, t: now };

      const els = pending.get(id);
      pending.delete(id);
      if (name && els) {
        for (const el of els) applyName(el, name);
      }
    }

    saveNamesLater();

    if (visibleIds.size) scheduleFlush(300);
    if (retry.length) {
      setTimeout(() => {
        for (const id of retry) visibleIds.add(id);
        scheduleFlush();
      }, 5000);
    }
  }

  /* ==========================================================================
   * 六、增量扫描
   * ========================================================================== */

  let scanTimer = null;
  const scanRoots = new Set();
  let internalChange = false;

  function scheduleScan(roots) {
    if (roots) {
      for (const r of roots) scanRoots.add(r);
      if (scanRoots.size > 200) {
        scanRoots.clear();
        scanRoots.add(document.body);
      }
    }
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      const list = Array.from(scanRoots);
      scanRoots.clear();

      internalChange = true;
      try {
        if (!list.length) {
          translateTree(document.body);
          localizeNamesIn(document.body);
        } else {
          for (const root of list) {
            if (!root.isConnected) continue;
            translateTree(root);
            localizeNamesIn(root.nodeType === 1 ? root : root.parentElement);
          }
        }
      } finally {
        internalChange = false;
      }

      if (visibleIds.size) scheduleFlush();
    }, 250);
  }

  const observer = new MutationObserver((mutations) => {
    if (internalChange || !settings.enabled) return;
    const roots = [];
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1 || node.nodeType === 3) roots.push(node);
        }
      } else if (mutation.type === 'characterData') {
        if (mutation.target.nodeType === 3) roots.push(mutation.target);
      }
    }
    if (roots.length) scheduleScan(roots);
  });

  /* ==========================================================================
   * 七、还原
   * ========================================================================== */

  function revertTexts() {
    for (const node of textRecords) {
      const rec = node.__sdbcn;
      if (rec && node.nodeValue === rec.applied) node.nodeValue = rec.orig;
      delete node.__sdbcn;
    }
    textRecords.length = 0;
  }

  function revertNames() {
    for (const rec of nameRecords) {
      if (rec.node.nodeValue === rec.applied) rec.node.nodeValue = rec.orig;
    }
    nameRecords.length = 0;
    for (const el of document.querySelectorAll('[data-sdbcn-name]')) {
      el.removeAttribute('data-sdbcn-name');
    }
    pending.clear();
    visibleIds.clear();
  }

  function revertAttrs() {
    for (const rec of attrRecords) {
      if (rec.el.getAttribute(rec.attr) === rec.applied) rec.el.setAttribute(rec.attr, rec.orig);
    }
    attrRecords.length = 0;
  }

  function revertAll() {
    revertTexts();
    revertNames();
    revertAttrs();
  }

  function rescan() {
    revertAll();
    if (!settings.enabled) return;
    translateTree(document.body);
    localizeNamesIn(document.body);
    if (visibleIds.size || pending.size) scheduleFlush();
  }

  /* ==========================================================================
   * 八、浮动设置面板
   * ========================================================================== */

  const PANEL_HTML = `
    <style>
      :host { all: initial; }
      .wrap { font: 12px/1.6 system-ui, -apple-system, "Microsoft YaHei", sans-serif; }
      .fab {
        position: fixed; right: 18px; bottom: 18px; width: 44px; height: 44px;
        border-radius: 50%; background: #1b2838; color: #c7d5e0;
        border: 1px solid #2a475e; cursor: pointer; font-size: 16px; font-weight: 600;
        box-shadow: 0 4px 14px rgba(0,0,0,.35); transition: background .15s, color .15s;
      }
      .fab:hover { background: #2a475e; color: #fff; }
      .fab[data-on="false"] { opacity: .55; }
      .panel {
        position: fixed; right: 18px; bottom: 74px; width: 258px; display: none;
        background: #16202d; color: #c7d5e0; border: 1px solid #2a475e;
        border-radius: 10px; padding: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.45);
      }
      .panel.open { display: block; }
      .head {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 8px;
      }
      .head .x { cursor: pointer; color: #8f98a0; font-weight: 400; padding: 0 2px; }
      .head .x:hover { color: #fff; }
      label { display: flex; align-items: center; gap: 8px; padding: 3px 0; cursor: pointer; }
      label input { width: 14px; height: 14px; accent-color: #66c0f4; cursor: pointer; }
      .row { display: flex; gap: 6px; margin-top: 8px; }
      .act {
        flex: 1; padding: 6px 4px; background: #2a475e; color: #c7d5e0;
        border: 1px solid #3d6c8f; border-radius: 6px; cursor: pointer;
        font-size: 11px; font-family: inherit;
      }
      .act:hover { background: #3d6c8f; color: #fff; }
      .stat { margin-top: 8px; color: #8f98a0; font-size: 11px; min-height: 16px; }
    </style>
    <div class="wrap">
      <button class="fab" type="button" title="SteamDB 汉化设置（Alt + T）">中</button>
      <div class="panel">
        <div class="head"><span>SteamDB 汉化</span><span class="x" data-act="close">✕</span></div>
        <label><input type="checkbox" data-k="enabled"> 启用汉化</label>
        <label><input type="checkbox" data-k="names"> 翻译游戏名称</label>
        <label><input type="checkbox" data-k="relativeTime"> 翻译相对时间</label>
        <label><input type="checkbox" data-k="attrs"> 翻译输入框提示</label>
        <div class="row">
          <button class="act" type="button" data-act="rescan">重新汉化</button>
          <button class="act" type="button" data-act="clear">清除名称缓存</button>
        </div>
        <div class="row">
          <button class="act" type="button" data-act="missing">复制未翻译词条</button>
        </div>
        <div class="stat"></div>
      </div>
    </div>
  `;

  let shadow = null;
  let panel = null;
  let fab = null;
  let statEl = null;

  function cachedNameCount() {
    let n = 0;
    for (const key of Object.keys(nameCache)) {
      if (typeof nameCache[key].n === 'string') n++;
    }
    return n;
  }

  function refreshStat(message) {
    if (!statEl) return;
    statEl.textContent = message || ('已缓存名称 ' + cachedNameCount() + ' 条');
  }

  function syncUI() {
    if (!shadow) return;
    for (const input of shadow.querySelectorAll('input[data-k]')) {
      input.checked = !!settings[input.dataset.k];
    }
    if (fab) fab.dataset.on = String(!!settings.enabled);
  }

  function togglePanel(force) {
    if (!panel) return;
    const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    if (open) {
      syncUI();
      refreshStat();
    }
  }

  function collectMissing() {
    const counter = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest(SKIP_HOST_SELECTOR)) return NodeFilter.FILTER_REJECT;
        const t = node.nodeValue.trim();
        if (t.length < 2 || t.length > 40) return NodeFilter.FILTER_REJECT;
        if (!/^[A-Za-z]/.test(t)) return NodeFilter.FILTER_REJECT;
        if (hasCJK(t)) return NodeFilter.FILTER_REJECT;
        if (!/[A-Za-z]{2}/.test(t)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      const t = walker.currentNode.nodeValue.trim();
      counter.set(t, (counter.get(t) || 0) + 1);
    }

    const lines = Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 400)
      .map(([text, count]) => text + '\t' + count);

    return lines.join('\n');
  }

  async function copyMissing() {
    const text = collectMissing();
    if (!text) {
      refreshStat('没有发现未翻译的英文词条');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      refreshStat('已复制 ' + text.split('\n').length + ' 条未翻译词条');
    } catch (e) {
      refreshStat('复制失败，请检查剪贴板权限');
    }
  }

  function handleAction(action) {
    if (action === 'close') {
      togglePanel(false);
    } else if (action === 'rescan') {
      rescan();
      refreshStat('已重新汉化');
    } else if (action === 'clear') {
      nameCache = {};
      writeJSON(LS_NAMES, nameCache);
      pending.clear();
      visibleIds.clear();
      rescan();
      refreshStat('缓存已清除');
    } else if (action === 'missing') {
      copyMissing();
    }
  }

  function buildUI() {
    const host = document.createElement('div');
    host.setAttribute('data-sdbcn-skip', '');
    host.style.cssText = 'position:fixed;z-index:2147483647;';

    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = PANEL_HTML;

    fab = shadow.querySelector('.fab');
    panel = shadow.querySelector('.panel');
    statEl = shadow.querySelector('.stat');

    fab.addEventListener('click', () => togglePanel());
    shadow.addEventListener('click', (event) => {
      const target = event.target.closest('[data-act]');
      if (target) handleAction(target.dataset.act);
    });
    shadow.addEventListener('change', (event) => {
      const input = event.target;
      if (!input.dataset || !input.dataset.k) return;
      settings[input.dataset.k] = input.checked;
      saveSettings();
      syncUI();
      if (!settings.enabled) {
        revertAll();
        refreshStat('汉化已关闭');
      } else {
        rescan();
        refreshStat();
      }
    });

    document.documentElement.appendChild(host);
    syncUI();
    refreshStat();
  }

  /* ==========================================================================
   * 九、启动
   * ========================================================================== */

  function boot() {
    buildUI();

    translateTree(document.body);
    localizeNamesIn(document.body);
    if (visibleIds.size) scheduleFlush();

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    window.addEventListener('popstate', () => scheduleScan([document.body]));

    document.addEventListener('keydown', (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== 't' && event.key !== 'T') return;
      const el = event.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      event.preventDefault();
      settings.enabled = !settings.enabled;
      saveSettings();
      syncUI();
      if (settings.enabled) {
        rescan();
        refreshStat('汉化已开启');
      } else {
        revertAll();
        refreshStat('汉化已关闭');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();