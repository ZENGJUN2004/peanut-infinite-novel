const { app, BrowserWindow, Menu, protocol, net, app: electronApp } = require('electron');
const path = require('path');
const url = require('url');
const express = require('./server/index.js');
const fs = require('fs');

// 保持对主窗口的引用
let mainWindow;
let server;

// 确保应用数据目录存在
function ensureAppDirs() {
  const appDataDir = electronApp.getPath('userData');
  const savedNovelsDir = path.join(appDataDir, 'saved-novels');
  
  try {
    if (!fs.existsSync(savedNovelsDir)) {
      fs.mkdirSync(savedNovelsDir, { recursive: true });
    }
    console.log('应用数据目录已准备就绪:', appDataDir);
  } catch (error) {
    console.error('创建应用数据目录失败:', error);
  }
}

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#1a1a1a',
    icon: path.join(__dirname, 'assets', 'images', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false // 允许加载本地文件和跨域请求
    }
  });

  // 加载应用的 index.html
  mainWindow.loadURL('http://localhost:3000/peanut-infinite-enhanced.html');

  // 打开开发者工具
  // mainWindow.webContents.openDevTools();

  // 当窗口关闭时触发
  mainWindow.on('closed', function () {
    // 取消引用主窗口对象，如果你的应用支持多窗口，通常会把所有窗口对象存放在一个数组中，与此同时，你应该删除相应的元素
    mainWindow = null;
  });

  // 创建应用菜单
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Ctrl+Q',
          click() { app.quit(); }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '刷新', accelerator: 'CmdOrCtrl+R', click() { mainWindow.reload(); } },
        { label: '切换开发者工具', accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I', click() { mainWindow.webContents.toggleDevTools(); } },
        { type: 'separator' },
        { label: '全屏', accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11', click() { mainWindow.setFullScreen(!mainWindow.isFullScreen()); } }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click() {
            mainWindow.webContents.executeJavaScript(`
              alert('花生网文无限流小说生成平台\n版本: 1.0.0\n\n一款基于Electron的桌面应用，\n用于生成和阅读无限流小说。');
            `);
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 在 Electron 完成初始化并准备创建浏览器窗口时触发
app.on('ready', function() {
  // 准备应用数据目录
  ensureAppDirs();
  
  // 注册自定义协议，用于安全地加载本地文件
  protocol.registerFileProtocol('app', (request, callback) => {
    const pathname = decodeURIComponent(request.url.replace('app://', ''));
    const filePath = path.join(__dirname, pathname);
    callback(filePath);
  });

  // 启动Express服务器
  const PORT = process.env.PORT || 3000;
  server = express.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    // 服务器启动后创建窗口
    createWindow();
  });
});

// 当所有窗口关闭时触发
app.on('window-all-closed', function () {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，否则应用及其菜单栏会保持活动状态
  if (process.platform !== 'darwin') {
    // 关闭服务器
    if (server) {
      server.close();
    }
    app.quit();
  }
});

// 在 macOS 上，当点击 dock 图标并且没有其他窗口打开时，重新创建一个窗口
app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

// 处理应用退出
app.on('quit', function() {
  // 确保服务器被关闭
  if (server) {
    server.close();
  }
});

// 处理未捕获的异常
process.on('uncaughtException', function (error) {
  console.error('未捕获的异常:', error);
});
