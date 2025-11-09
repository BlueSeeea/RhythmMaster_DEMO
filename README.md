# Rhythm Master - 节奏大师

一个基于浏览器的节奏游戏，让玩家随着音乐节拍点击下落的音符。

## 功能特点

- 🎵 多首不同风格和难度的歌曲
- 🎮 四个难度级别：简单、普通、困难、专家
- 🎯 精确的音符判定系统（Perfect、Great、Good、Miss）
- 🔥 连击系统和分数计算
- 🎨 响应式设计，支持桌面和移动设备
- 🔊 可自定义的音频设置
- ⚙️ 丰富的游戏设置选项
- 💾 本地数据存储（高分记录、游戏配置等）

## 技术栈

- **前端框架**: Svelte
- **构建工具**: Vite
- **样式**: CSS3 (响应式设计)
- **存储**: localStorage
- **部署**: Netlify

## 项目结构

```
RhythmMaster/
├── public/                 # 静态资源
│   └── assets/             # 游戏素材
│       ├── images/         # 图片资源
│       └── sounds/         # 音频资源
├── src/                    # 源代码
│   ├── components/         # 页面组件
│   │   ├── HomePage.svelte # 首页
│   │   ├── GamePage.svelte # 游戏页面
│   │   ├── ScorePage.svelte # 分数页面
│   │   └── SettingsPage.svelte # 设置页面
│   ├── utils/              # 工具类
│   │   ├── audioManager.js # 音频管理
│   │   ├── noteManager.js  # 音符管理
│   │   ├── scoreCalculator.js # 分数计算
│   │   ├── gameDataManager.js # 游戏数据管理
│   │   └── songsData.js    # 歌曲数据
│   ├── assets/             # 资源文件
│   │   └── styles/         # 样式文件
│   ├── App.svelte          # 主应用组件
│   └── main.js             # 入口文件
├── index.html              # HTML模板
├── package.json            # 项目依赖
├── vite.config.js          # Vite配置
├── netlify.toml            # Netlify部署配置
└── README.md               # 项目说明
```

## 安装和运行

### 前置要求

- Node.js 16 或更高版本
- npm 或 yarn

### 安装步骤

1. 克隆或下载项目

2. 安装依赖
   ```bash
   npm install
   ```

3. 开发模式运行
   ```bash
   npm run dev
   ```
   应用将在 http://localhost:5173 启动

4. 构建生产版本
   ```bash
   npm run build
   ```
   构建结果将输出到 `dist` 目录

5. 预览生产版本
   ```bash
   npm run preview
   ```

## 部署到Netlify

### 自动部署

1. 将代码推送到GitHub、GitLab或Bitbucket仓库

2. 在Netlify上创建新站点并连接到你的仓库

3. Netlify将自动识别 `netlify.toml` 文件并使用配置进行构建和部署

### 手动部署

1. 构建应用
   ```bash
   npm run build
   ```

2. 使用Netlify CLI部署
   ```bash
   netlify deploy --prod
   ```

## 游戏操作

### 键盘控制
- **D/F/J/K** 或 **A/S/D/F** - 对应四个轨道的音符
- **空格键** - 开始游戏/暂停
- **ESC** - 返回主菜单

### 触摸控制（移动设备）
- 点击屏幕上对应的轨道区域来击打音符

## 游戏设置

- **音频设置**: 调整背景音乐和音效音量，开关音频
- **游戏设置**: 调整音符速度、大小和轨道数量
- **显示设置**: 切换全屏模式
- **难度设置**: 选择游戏难度（影响音符速度和生成频率）

## 分数系统

- **Perfect**: 最高分数，完美击中
- **Great**: 高分数，良好击中
- **Good**: 中等分数，基本击中
- **Miss**: 零分，未击中

连击数会增加分数倍率，连续击中相同判定会获得额外奖励。

## 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建你的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 许可证

本项目采用MIT许可证 - 详情请查看 LICENSE 文件

## 开发说明

### 添加新歌曲

1. 在 `src/utils/songsData.js` 中添加新的歌曲对象
2. 准备歌曲音频文件并放入 `public/assets/sounds/`
3. 准备歌曲封面图片并放入 `public/assets/images/`
4. 生成或手动创建音符数据

### 自定义主题

可以通过修改 `src/assets/styles/global.css` 中的CSS变量来自定义游戏主题颜色和样式。

## 故障排除

### 音频问题
- 确保浏览器允许自动播放音频
- 尝试调整浏览器的音频设置
- 检查系统音量设置

### 性能问题
- 降低游戏设置中的音符速度和轨道数量
- 关闭不必要的浏览器标签
- 确保设备满足基本性能要求

### 部署问题
- 检查 `netlify.toml` 配置是否正确
- 确保构建命令能够成功执行
- 查看Netlify构建日志以获取详细错误信息