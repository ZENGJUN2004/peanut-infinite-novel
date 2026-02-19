# 互动小说游戏平台

一个功能完整、界面美观的互动小说游戏平台，支持多故事管理、多结局系统、角色互动等功能。

## 功能特性

- 📚 **多故事管理**：支持添加、编辑、删除多个互动小说故事
- 🎮 **互动选择**：每个故事节点都有多个选择分支
- 🔄 **多结局系统**：根据玩家选择触发不同结局
- 🭼 **角色系统**：支持多个角色，每个角色有不同的属性和对话风格
- 🎨 **美观界面**：现代化的响应式设计，支持PC和移动端
- 🔊 **音效系统**：为不同场景添加背景音效和特效音
- 💾 **数据持久化**：自动保存游戏进度，支持多存档
- 📝 **故事编辑器**：内置可视化故事编辑器，支持拖拽式编辑
- 📱 **响应式设计**：适配不同屏幕尺寸

## 技术栈

- **前端**：HTML5, CSS3, JavaScript, Tailwind CSS, Font Awesome
- **后端**：Node.js, Express.js
- **数据库**：SQLite (本地存储)
- **音频**：Howler.js
- **动画**：CSS Animations, GSAP

## 目录结构

```
互动小说游戏平台/
├── public/             # 静态资源
│   ├── assets/         # 游戏资源
│   │   ├── audio/      # 音效和背景音乐
│   │   ├── images/     # 图片资源
│   │   └── stories/    # 故事数据
│   ├── css/            # 样式文件
│   ├── js/             # JavaScript文件
│   └── editor/         # 故事编辑器
├── server/             # 后端代码
│   ├── routes/         # 路由
│   ├── models/         # 数据模型
│   └── utils/          # 工具函数
├── index.html          # 平台首页
├── game.html           # 游戏页面
├── editor.html         # 编辑器页面
├── package.json        # 项目配置
└── README.md           # 项目说明
```

## 快速开始

1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动开发服务器**
   ```bash
   npm run dev
   ```

3. **访问平台**
   打开浏览器，访问 `http://localhost:3000`

## 如何使用

### 1. 浏览故事
- 在首页浏览可用的互动小说故事
- 点击故事封面进入游戏

### 2. 开始游戏
- 阅读故事内容
- 在每个选择节点做出选择
- 观察故事的发展和结局

### 3. 编辑故事
- 点击首页的"编辑器"按钮
- 使用可视化编辑器创建新故事
- 保存故事后，在首页即可看到并游玩

### 4. 管理存档
- 游戏过程中自动保存进度
- 在游戏菜单中查看和管理存档

## 故事格式

故事数据使用JSON格式存储，示例：

```json
{
  "id": "sample-story",
  "title": "示例故事",
  "author": "匿名",
  "description": "一个简单的示例故事",
  "coverImage": "cover.jpg",
  "backgroundMusic": "bgm.mp3",
  "nodes": [
    {
      "id": "start",
      "text": "你醒来发现自己在一个陌生的房间里...",
      "image": "room.jpg",
      "soundEffect": "wakeup.mp3",
      "choices": [
        {
          "text": "查看房间",
          "nextNode": "explore-room",
          "condition": null,
          "effect": null
        },
        {
          "text": "继续睡觉",
          "nextNode": "sleep-again",
          "condition": null,
          "effect": null
        }
      ]
    },
    {
      "id": "explore-room",
      "text": "你发现房间里有一扇门和一个窗户...",
      "image": "room-details.jpg",
      "soundEffect": null,
      "choices": [
        {
          "text": "开门",
          "nextNode": "open-door",
          "condition": null,
          "effect": null
        },
        {
          "text": "开窗",
          "nextNode": "open-window",
          "condition": null,
          "effect": null
        }
      ]
    }
  ]
}
```

## 自定义主题

平台支持自定义主题，在 `public/css/themes/` 目录下创建新的主题文件即可。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个平台！

## 许可证

MIT License