# IDP Workflow Prototype

NeosAI IDP 工作流高保真前端原型（規則認定 / kisoku-nintei）。

## 预览

```bash
cd prototypes/kisoku-nintei
python3 -m http.server 8888 --bind 0.0.0.0
```

浏览器打开 http://127.0.0.1:8888/

## PRD 评审站（HTML）

由 `prototypes/kisoku-nintei/PRD.zh-CN.md` 生成侧栏导航式 HTML，样式对齐 [neosai-idp-prd.netlify.app](https://neosai-idp-prd.netlify.app/)。

```bash
cd prototypes/kisoku-nintei
npm run build:prd
npm run serve:prd
```

浏览器打开 http://127.0.0.1:4176/

Netlify 部署（PRD 站点）：

- Base directory：`prototypes/kisoku-nintei`
- Build command：`npm run build:prd`
- Publish directory：`prd-public`
- 配置文件：`prd-netlify.toml`（在 Netlify 站点设置中指定该文件，或重命名为该站点的 `netlify.toml`）

## 目录

- `prototypes/kisoku-nintei/` — 工作流画布、节点 Inspector、业务场景配置原型
- `prototypes/kisoku-nintei/PRD.zh-CN.md` — 工作流配置 PRD 源文件
- `prototypes/kisoku-nintei/prd-public/` — PRD HTML 发布目录（`npm run build:prd` 生成）
