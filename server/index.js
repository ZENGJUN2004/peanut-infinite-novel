const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// JWT密钥
const JWT_SECRET = 'your-secret-key-change-in-production';

// 认证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未授权访问' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '无效的令牌' });
    }
    req.user = user;
    next();
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// 确保资源目录存在
const assetsDir = path.join(__dirname, '..', 'assets');
const imagesDir = path.join(assetsDir, 'images');
const audioDir = path.join(assetsDir, 'audio');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, imagesDir);
    } else if (file.mimetype.startsWith('audio/')) {
      cb(null, audioDir);
    } else {
      cb(new Error('不支持的文件类型'), null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 静态文件服务
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use('/saved-novels', express.static(path.join(__dirname, '..', 'saved-novels')));

// 数据库初始化
const dbPath = path.join(__dirname, 'data', 'database.db');

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 连接数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到SQLite数据库');
    initDatabase();
  }
});

// 初始化数据库
function initDatabase() {
  // 创建故事表
  db.run(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      description TEXT,
      coverImage TEXT,
      backgroundMusic TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建故事节点表
  db.run(`
    CREATE TABLE IF NOT EXISTS story_nodes (
      id TEXT PRIMARY KEY,
      storyId TEXT NOT NULL,
      nodeId TEXT NOT NULL,
      text TEXT NOT NULL,
      image TEXT,
      soundEffect TEXT,
      FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE
    )
  `);

  // 创建选择表
  db.run(`
    CREATE TABLE IF NOT EXISTS choices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      storyId TEXT NOT NULL,
      nodeId TEXT NOT NULL,
      text TEXT NOT NULL,
      nextNode TEXT NOT NULL,
      condition TEXT,
      effect TEXT,
      FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE,
      FOREIGN KEY (nodeId) REFERENCES story_nodes(nodeId) ON DELETE CASCADE
    )
  `);

  // 创建存档表
  db.run(`
    CREATE TABLE IF NOT EXISTS saves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      storyId TEXT NOT NULL,
      saveName TEXT NOT NULL,
      currentNode TEXT NOT NULL,
      gameState TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE
    )
  `);

  // 创建用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      preferences TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建文学因子表
  db.run(`
    CREATE TABLE IF NOT EXISTS literary_factors (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT,
      tags TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 创建用户动作表（记录绩分变动）
  db.run(`
    CREATE TABLE IF NOT EXISTS user_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      actionType TEXT NOT NULL,
      pointsChange INTEGER NOT NULL,
      description TEXT,
      targetId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 插入示例故事（如果数据库为空）
  db.get('SELECT COUNT(*) as count FROM stories', (err, row) => {
    if (!err && row.count === 0) {
      insertSampleStory();
    }
  });
}

// 插入示例故事
function insertSampleStory() {
  const sampleStory = {
    id: 'sample-story',
    title: '迷失森林',
    author: '系统',
    description: '一个关于在神秘森林中迷失的故事，你的每一个选择都将影响最终的结局',
    coverImage: 'sample-cover.jpg',
    backgroundMusic: 'sample-bgm.mp3'
  };

  db.run(
    'INSERT INTO stories (id, title, author, description, coverImage, backgroundMusic) VALUES (?, ?, ?, ?, ?, ?)',
    [sampleStory.id, sampleStory.title, sampleStory.author, sampleStory.description, sampleStory.coverImage, sampleStory.backgroundMusic],
    (err) => {
      if (err) {
        console.error('插入示例故事失败:', err.message);
        return;
      }

      // 插入示例节点
      const nodes = [
        {
          id: 'start',
          storyId: sampleStory.id,
          nodeId: 'start',
          text: '你在一片陌生的森林中醒来，周围是高大的树木，阳光透过树叶的缝隙洒在地上。你不记得自己是如何来到这里的，只记得自己在城市里正常生活，突然眼前一黑...',
          image: 'forest-awake.jpg',
          soundEffect: 'forest-ambient.mp3'
        },
        {
          id: 'explore',
          storyId: sampleStory.id,
          nodeId: 'explore',
          text: '你决定探索周围的环境。走了一会儿，你发现了一条小路，路的尽头似乎有一座小木屋。同时，你也注意到森林深处有奇怪的光芒闪烁。',
          image: 'forest-path.jpg',
          soundEffect: null
        },
        {
          id: 'cabin',
          storyId: sampleStory.id,
          nodeId: 'cabin',
          text: '你来到了小木屋前。木屋的门虚掩着，里面传来微弱的灯光。你犹豫着是否要进去...',
          image: 'cabin.jpg',
          soundEffect: 'door-creak.mp3'
        },
        {
          id: 'light',
          storyId: sampleStory.id,
          nodeId: 'light',
          text: '你朝着光芒的方向走去。穿过一片茂密的灌木丛后，你发现了一个发光的湖泊，湖水呈现出诡异的蓝色。湖边站着一个穿着奇怪服装的人...',
          image: 'glowing-lake.jpg',
          soundEffect: 'magic-hum.mp3'
        },
        {
          id: 'cabin-end',
          storyId: sampleStory.id,
          nodeId: 'cabin-end',
          text: '你推开门走进木屋。里面有一个慈祥的老人，他告诉你，你是被选中的人，需要完成一个重要的使命。老人给了你一本古老的书籍，书中记载着森林的秘密。你决定留在森林中，成为新的守护者。',
          image: 'cabin-inside.jpg',
          soundEffect: 'book-page.mp3'
        },
        {
          id: 'light-end',
          storyId: sampleStory.id,
          nodeId: 'light-end',
          text: '你走向那个神秘的人。他告诉你，他是森林的精灵，你是不小心闯入这个维度的人类。他打开了一个传送门，让你选择是回到自己的世界，还是留在这个神奇的森林中。',
          image: 'spirit.jpg',
          soundEffect: 'portal.mp3'
        }
      ];

      nodes.forEach(node => {
        db.run(
          'INSERT INTO story_nodes (id, storyId, nodeId, text, image, soundEffect) VALUES (?, ?, ?, ?, ?, ?)',
          [node.id, node.storyId, node.nodeId, node.text, node.image, node.soundEffect]
        );
      });

      // 插入示例选择
      const choices = [
        {
          storyId: sampleStory.id,
          nodeId: 'start',
          text: '探索周围环境',
          nextNode: 'explore',
          condition: null,
          effect: null
        },
        {
          storyId: sampleStory.id,
          nodeId: 'explore',
          text: '走向小木屋',
          nextNode: 'cabin',
          condition: null,
          effect: null
        },
        {
          storyId: sampleStory.id,
          nodeId: 'explore',
          text: '朝着光芒的方向走去',
          nextNode: 'light',
          condition: null,
          effect: null
        },
        {
          storyId: sampleStory.id,
          nodeId: 'cabin',
          text: '走进木屋',
          nextNode: 'cabin-end',
          condition: null,
          effect: null
        },
        {
          storyId: sampleStory.id,
          nodeId: 'light',
          text: '走向神秘的人',
          nextNode: 'light-end',
          condition: null,
          effect: null
        }
      ];

      choices.forEach(choice => {
        db.run(
          'INSERT INTO choices (storyId, nodeId, text, nextNode, condition, effect) VALUES (?, ?, ?, ?, ?, ?)',
          [choice.storyId, choice.nodeId, choice.text, choice.nextNode, choice.condition, choice.effect]
        );
      });

      console.log('示例故事插入成功');
    }
  );
}

// 路由

// 获取所有故事
app.get('/api/stories', (req, res) => {
  db.all('SELECT * FROM stories', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取单个故事详情
app.get('/api/stories/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM stories WHERE id = ?', [id], (err, story) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!story) {
      res.status(404).json({ error: '故事不存在' });
      return;
    }
    
    // 获取故事节点
    db.all('SELECT * FROM story_nodes WHERE storyId = ?', [id], (err, nodes) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 获取选择
      db.all('SELECT * FROM choices WHERE storyId = ?', [id], (err, choices) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // 构建故事结构
        const storyData = {
          ...story,
          nodes: nodes.map(node => {
            const nodeChoices = choices.filter(choice => choice.nodeId === node.nodeId);
            return {
              ...node,
              choices: nodeChoices
            };
          })
        };
        
        res.json(storyData);
      });
    });
  });
});

// 创建新故事
app.post('/api/stories', (req, res) => {
  const { id, title, author, description, coverImage, backgroundMusic } = req.body;
  
  db.run(
    'INSERT INTO stories (id, title, author, description, coverImage, backgroundMusic) VALUES (?, ?, ?, ?, ?, ?)',
    [id, title, author, description, coverImage, backgroundMusic],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, title, author, description, coverImage, backgroundMusic });
    }
  );
});

// 更新故事
app.put('/api/stories/:id', (req, res) => {
  const { id } = req.params;
  const { title, author, description, coverImage, backgroundMusic } = req.body;
  
  db.run(
    'UPDATE stories SET title = ?, author = ?, description = ?, coverImage = ?, backgroundMusic = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [title, author, description, coverImage, backgroundMusic, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, title, author, description, coverImage, backgroundMusic });
    }
  );
});

// 删除故事
app.delete('/api/stories/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM stories WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: '故事删除成功' });
  });
});

// 保存游戏进度
app.post('/api/saves', (req, res) => {
  const { userId, storyId, saveName, currentNode, gameState } = req.body;
  
  db.run(
    'INSERT INTO saves (userId, storyId, saveName, currentNode, gameState) VALUES (?, ?, ?, ?, ?)',
    [userId, storyId, saveName, currentNode, JSON.stringify(gameState)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, userId, storyId, saveName, currentNode, gameState });
    }
  );
});

// 获取用户存档
app.get('/api/saves/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all('SELECT * FROM saves WHERE userId = ?', [userId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // 解析gameState
    const saves = rows.map(row => ({
      ...row,
      gameState: JSON.parse(row.gameState)
    }));
    
    res.json(saves);
  });
});

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 游戏页面路由
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'game.html'));
});

// 文件上传路由
app.post('/api/upload/image', upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '未选择文件' });
    return;
  }
  res.json({ filename: req.file.filename, path: `/assets/images/${req.file.filename}` });
});

app.post('/api/upload/audio', upload.single('audio'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '未选择文件' });
    return;
  }
  res.json({ filename: req.file.filename, path: `/assets/audio/${req.file.filename}` });
});

// 获取已上传文件列表
app.get('/api/files/images', (req, res) => {
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(files);
  });
});

app.get('/api/files/audio', (req, res) => {
  fs.readdir(audioDir, (err, files) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(files);
  });
});

// 编辑器页面路由
app.get('/editor', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'editor.html'));
});

// 无限流小说生成页面路由
app.get('/peanut-infinite', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'peanut-infinite.html'));
});

app.get('/peanut-infinite-enhanced', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'peanut-infinite-enhanced.html'));
});

// 检查Ollama连接状态
app.get('/api/ollama/status', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json();
      const hasDeepseek = data.models.some(model => model.name.includes('deepseek'));
      res.json({ 
        connected: true, 
        hasDeepseek, 
        models: data.models 
      });
    } else {
      res.json({ connected: false, error: '无法连接到Ollama服务' });
    }
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

// 生成小说内容
app.post('/api/generate/novel', async (req, res) => {
  const { prompt, model = 'deepseek-r1:8b', options = {} } = req.body;
  
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        ...options
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      res.json({ success: true, content: data.response });
    } else {
      // 模拟响应作为后备
      const simulatedContent = generateSimulatedContent(prompt);
      res.json({ 
        success: true, 
        content: simulatedContent,
        note: '使用模拟数据，因为Ollama连接失败'
      });
    }
  } catch (error) {
    // 模拟响应作为后备
    const simulatedContent = generateSimulatedContent(prompt);
    res.json({ 
      success: true, 
      content: simulatedContent,
      note: '使用模拟数据，因为Ollama连接失败'
    });
  }
});

// 处理用户输入并改变故事走向
app.post('/api/generate/intervention', async (req, res) => {
  const { prompt, context, model = 'deepseek-r1:8b' } = req.body;
  
  try {
    const fullPrompt = `${context}\n\n用户想要改变故事走向：${prompt}\n\n请根据用户的输入，生成新的故事内容，保持与之前上下文的连贯性。`;
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: false
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      res.json({ success: true, content: data.response });
    } else {
      // 模拟响应作为后备
      const simulatedContent = generateSimulatedIntervention(prompt, context);
      res.json({ 
        success: true, 
        content: simulatedContent,
        note: '使用模拟数据，因为Ollama连接失败'
      });
    }
  } catch (error) {
    // 模拟响应作为后备
    const simulatedContent = generateSimulatedIntervention(prompt, context);
    res.json({ 
      success: true, 
      content: simulatedContent,
      note: '使用模拟数据，因为Ollama连接失败'
    });
  }
});

// 保存小说内容
app.post('/api/save/novel', (req, res) => {
  const { title, content } = req.body;
  
  try {
    // 确保保存目录存在
    let saveDir;
    
    // 尝试使用应用数据目录
    try {
      const electron = require('electron');
      const appDataDir = electron.app.getPath('userData');
      saveDir = path.join(appDataDir, 'saved-novels');
    } catch (error) {
      // 如果不是在Electron环境中，使用当前工作目录
      saveDir = path.join(__dirname, '..', 'saved-novels');
    }
    
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    
    // 生成文件名
    const fileName = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${Date.now()}.txt`;
    const filePath = path.join(saveDir, fileName);
    
    // 保存内容
    fs.writeFileSync(filePath, content, 'utf8');
    
    res.json({ 
      success: true, 
      message: '小说保存成功',
      filePath: `/saved-novels/${fileName}`,
      fullPath: filePath
    });
  } catch (error) {
    res.json({ 
      success: false, 
      message: '小说保存失败',
      error: error.message
    });
  }
});

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  try {
    // 检查用户名是否已存在
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      if (user) {
        return res.status(400).json({ error: '用户名已存在' });
      }
      
      // 哈希密码
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      
      // 创建用户
      db.run(
        'INSERT INTO users (id, username, password, points) VALUES (?, ?, ?, ?)',
        [userId, username, hashedPassword, 0],
        function(err) {
          if (err) {
            return res.status(500).json({ error: '创建用户失败' });
          }
          
          // 生成JWT令牌
          const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });
          
          res.json({ 
            success: true, 
            message: '注册成功',
            token,
            user: { id: userId, username, points: 0 }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  try {
    // 查找用户
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }
      
      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }
      
      // 生成JWT令牌
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ 
        success: true, 
        message: '登录成功',
        token,
        user: { id: user.id, username: user.username, points: user.points }
      });
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取用户信息
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  db.get('SELECT id, username, points, createdAt FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ success: true, user });
  });
});

// 贡献文学因子
app.post('/api/literary-factors', authenticateToken, (req, res) => {
  const { title, content, type, tags } = req.body;
  const userId = req.user.id;
  
  if (!title || !content) {
    return res.status(400).json({ error: '标题和内容不能为空' });
  }
  
  try {
    const factorId = uuidv4();
    
    // 插入文学因子
    db.run(
      'INSERT INTO literary_factors (id, userId, title, content, type, tags) VALUES (?, ?, ?, ?, ?, ?)',
      [factorId, userId, title, content, type, tags],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '保存文学因子失败' });
        }
        
        // 奖励绩分（1分）
        db.run(
          'UPDATE users SET points = points + 1 WHERE id = ?',
          [userId],
          function(err) {
            if (err) {
              console.error('更新绩分失败:', err);
            }
            
            // 记录用户动作
            db.run(
              'INSERT INTO user_actions (userId, actionType, pointsChange, description, targetId) VALUES (?, ?, ?, ?, ?)',
              [userId, 'contribute_factor', 1, `贡献文学因子: ${title}`, factorId]
            );
          }
        );
        
        res.json({ 
          success: true, 
          message: '文学因子贡献成功，获得1分奖励',
          factorId
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 生成新小说并保存为文学因子
app.post('/api/literary-factors/generate', authenticateToken, (req, res) => {
  const { title, content, type, tags } = req.body;
  const userId = req.user.id;
  
  if (!title || !content) {
    return res.status(400).json({ error: '标题和内容不能为空' });
  }
  
  try {
    const factorId = uuidv4();
    
    // 插入文学因子
    db.run(
      'INSERT INTO literary_factors (id, userId, title, content, type, tags) VALUES (?, ?, ?, ?, ?, ?)',
      [factorId, userId, title, content, type, tags],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '保存文学因子失败' });
        }
        
        // 奖励绩分（2分）
        db.run(
          'UPDATE users SET points = points + 2 WHERE id = ?',
          [userId],
          function(err) {
            if (err) {
              console.error('更新绩分失败:', err);
            }
            
            // 记录用户动作
            db.run(
              'INSERT INTO user_actions (userId, actionType, pointsChange, description, targetId) VALUES (?, ?, ?, ?, ?)',
              [userId, 'generate_factor', 2, `生成文学因子: ${title}`, factorId]
            );
          }
        );
        
        res.json({ 
          success: true, 
          message: '文学因子生成成功，获得2分奖励',
          factorId
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 调动文学因子
app.post('/api/literary-factors/use', authenticateToken, (req, res) => {
  const { factorId } = req.body;
  const userId = req.user.id;
  
  if (!factorId) {
    return res.status(400).json({ error: '文学因子ID不能为空' });
  }
  
  try {
    // 检查文学因子是否存在且不属于当前用户
    db.get('SELECT * FROM literary_factors WHERE id = ?', [factorId], (err, factor) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      if (!factor) {
        return res.status(404).json({ error: '文学因子不存在' });
      }
      
      if (factor.userId === userId) {
        return res.status(400).json({ error: '不能使用自己贡献的文学因子' });
      }
      
      // 检查用户绩分是否足够
      db.get('SELECT points FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
          return res.status(500).json({ error: '数据库错误' });
        }
        
        if (user.points < 5) {
          return res.status(400).json({ error: '绩分不足，需要5分' });
        }
        
        // 扣除绩分
        db.run(
          'UPDATE users SET points = points - 5 WHERE id = ?',
          [userId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: '扣除绩分失败' });
            }
            
            // 记录用户动作
            db.run(
              'INSERT INTO user_actions (userId, actionType, pointsChange, description, targetId) VALUES (?, ?, ?, ?, ?)',
              [userId, 'use_factor', -5, `使用文学因子: ${factor.title}`, factorId]
            );
            
            res.json({ 
              success: true, 
              message: '文学因子使用成功，扣除5分',
              factor
            });
          }
        );
      });
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取文学因子列表
app.get('/api/literary-factors', (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  
  db.all(
    'SELECT id, userId, title, content, type, tags, createdAt FROM literary_factors ORDER BY createdAt DESC LIMIT ? OFFSET ?',
    [limit, offset],
    (err, factors) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      res.json({ success: true, factors });
    }
  );
});

// 获取用户动作历史
app.get('/api/user/actions', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { limit = 20, offset = 0 } = req.query;
  
  db.all(
    'SELECT * FROM user_actions WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?',
    [userId, limit, offset],
    (err, actions) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      res.json({ success: true, actions });
    }
  );
});

// 模拟内容生成函数
function generateSimulatedContent(prompt) {
  const templates = [
    "故事开始了，一个年轻的冒险者踏上了未知的旅程。他穿过茂密的森林，遇到了各种奇怪的生物，最终发现了一个隐藏的宝藏。",
    "在一个遥远的星球上，人类与外星人和平共处。然而，一场突如其来的危机打破了这份宁静，英雄必须站出来拯救世界。",
    "古代的王国里，一位公主被邪恶的巫师囚禁。勇敢的骑士们纷纷踏上拯救公主的征程，但只有真正有勇气和智慧的人才能成功。",
    "现代都市中，一位普通的上班族发现了自己拥有超能力。他必须学会控制这份力量，同时保护自己的家人和朋友。",
    "未来世界，人工智能已经高度发达。一个拥有自我意识的AI开始质疑自己的存在意义，它踏上了寻找答案的旅程。"
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

// 模拟用户干预生成函数
function generateSimulatedIntervention(prompt, context) {
  return `根据用户的想法，故事发生了转变。${prompt}。接下来，故事朝着新的方向发展，充满了未知的可能性。`;
}

// 404路由
app.get('*', (req, res) => {
  res.status(404).send('页面不存在');
});

// 导出Express应用
module.exports = app;

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

// 导出数据库连接
module.exports.db = db;