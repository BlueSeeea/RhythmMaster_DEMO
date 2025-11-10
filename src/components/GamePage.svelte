<script>
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
  import audioManager from '../utils/audioManager';
  import noteManager from '../utils/noteManager';
  import scoreCalculator from '../utils/scoreCalculator';
  import gameDataManager from '../utils/gameDataManager';
  
  // 创建事件分发器
  const dispatch = createEventDispatcher();
  
  export let song;
  export let difficulty;
  export let gameConfig;
  
  // 游戏状态
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let accuracy = 100;
  let judgments = { perfect: 0, great: 0, good: 0, bad: 0, miss: 0 };
  let notes = [];
  let isPlaying = false;
  let isPaused = false;
  let gameTime = 0;
  let gameDuration = 180; // 默认3分钟
  let startTime = null;
  let lastTime = 0;
  
  // 游戏配置参数
  const NOTE_GENERATION_INTERVAL = 300; // 音符生成间隔 - 缩短间隔以增加生成频率
  const NOTE_SPACING = 300; // 音符间距 - 增加间距以延长掉落时间
  const MAX_NOTES_PER_GENERATION = 3; // 每次生成的最大音符数 - 增加以确保足够音符
  const MAX_NOTES_ON_LANE = 4; // 同一轨道最多音符数 - 增加以支持更长时间游戏
  const INITIAL_NOTES_COUNT = 8; // 初始生成的音符数量 - 增加以丰富游戏开始体验
  
  // 音符间隔控制配置
  const NOTE_MIN_SPACING = 150; // 音符最小间隔，防止生成过于密集
  const NOTE_SPACING_VARIATION = 200; // 音符间隔随机变化范围
  
  // 当前激活的生成模式
  let currentGenerationMode = null;
  let modeActivationTime = 0;
  const MODE_DURATION_MIN = 5000; // 每种模式最小持续时间(ms)
  const MODE_DURATION_MAX = 10000; // 每种模式最大持续时间(ms)
  
  // 游戏区域引用
  let gameContainer;
  let gameArea;
  let judgmentLine;
  
  // 游戏配置 - 使用响应式引用
  $: laneCount = gameConfig.laneCount || 4;
  $: noteSpeed = gameConfig.speed || 10;
  $: noteRadius = gameConfig.noteRadius || 20;
  $: judgmentLinePosition = gameArea ? gameArea.offsetHeight * 0.8 : 0;
  $: hitRange = judgmentThresholds.bad * 2; // 统一的命中范围

  // 判定阈值（毫秒） - 降低难度，增大判定窗口
  const judgmentThresholds = {
    perfect: 80,  // 增大完美判定窗口
    great: 150,   // 增大良好判定窗口
    good: 250,    // 增大一般判定窗口
    bad: 350      // 增大可接受判定窗口
  };
  
  // 分数计算配置 - 增加基础分数
  const scoreValues = {
    perfect: 1200,
    great: 800,
    good: 500,
    bad: 200,
    miss: 0
  };
  
  // 音频管理器已从外部导入
  let songAudio = null;
  
  // 游戏循环引用
  let animationFrameId = null;
  
  onMount(async () => {
    // 添加全局键盘事件监听器
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // 等待DOM更新后初始化游戏尺寸
    await tick();
    initializeGameDimensions();
    
    // 配置音频管理器（移到后台执行）
    setTimeout(() => {
      if (gameConfig.audioEnabled) {
        audioManager.setBGMVolume(0.8);
      }
      if (gameConfig.sfxEnabled) {
        audioManager.setSFXVolume(0.8);
      }
    }, 0);
    
    // 延迟启动游戏，给浏览器时间渲染UI
    setTimeout(() => {
      startGame();
    }, 100);
  });
  
  onDestroy(() => {
    // 清理游戏资源
    stopGame();
    if (songAudio) {
      songAudio.pause();
      songAudio = null;
    }
    // 停止所有背景音乐
    audioManager.stopBGM();
    
    // 移除全局键盘事件监听器
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    
    // 清理所有动画定时器，防止内存泄漏
    if (animationTimers && typeof animationTimers.forEach === 'function') {
      // Map对象需要正确遍历
      animationTimers.forEach((timer) => {
        if (timer) clearInterval(timer);
      });
      animationTimers.clear();
    }
    
    // 清理触摸点集合
    if (activeTouches && typeof activeTouches.clear === 'function') {
      activeTouches.clear();
    }
    
    // 清空数组引用，帮助垃圾回收
    notes = [];
    judgmentDisplay = [];
  });
  
  // 初始化游戏尺寸
  function initializeGameDimensions() {
    if (!gameArea || !judgmentLine) return;
    
    // 设置游戏区域尺寸
    const containerWidth = gameContainer.offsetWidth;
    const containerHeight = gameContainer.offsetHeight;
    
    gameArea.style.width = containerWidth + 'px';
    gameArea.style.height = containerHeight * 0.7 + 'px';
    
    // 设置判定线位置
    judgmentLine.style.top = judgmentLinePosition + 'px';
  }
  
  // 生成音符 - 优化版本，支持多种生成模式和音符间隔控制
  function generateNotes() {
    notes = [];
    
    // 基于时间生成音符，确保每个音符都有createdAt属性
    const now = performance.now();
    let noteId = 0;
    
    // 跟踪每个轨道上的音符数量
    const laneNoteCount = new Array(laneCount).fill(0);
    
    // 初始化当前生成模式
    if (!currentGenerationMode) {
      currentGenerationMode = selectRandomGenerationMode();
      modeActivationTime = now;
      // 增加模式持续时间，减少频繁切换导致的性能波动
      currentModeDuration = 8000 + Math.random() * 8000; // 8-16秒，比原来的5-10秒更长
    }
    
    // 生成初始音符 - 增加初始音符数量以支持长时间游戏
    const noteCount = INITIAL_NOTES_COUNT;
    let lastCreatedAt = now;
    
    // 分批次生成音符，模拟不同的生成模式
    for (let batch = 0; batch < Math.ceil(noteCount / MAX_NOTES_PER_GENERATION); batch++) {
      // 确定当前批次生成的音符数量
      const batchSize = Math.min(noteCount - (batch * MAX_NOTES_PER_GENERATION), MAX_NOTES_PER_GENERATION);
      
      // 找到可用的轨道（未满的）
      const availableLanes = [];
      for (let i = 0; i < laneCount; i++) {
        if (laneNoteCount[i] < MAX_NOTES_ON_LANE) {
          availableLanes.push(i);
        }
      }
      
      if (availableLanes.length === 0) break;
      
      // 使用当前生成模式确定轨道（对于初始音符，我们使用简化的可用轨道列表）
      let lanesThisBatch;
      
      // 特殊处理：对于初始音符，我们希望分布更加多样化
      if (currentGenerationMode.name === 'random') {
        // 随机模式直接使用
        lanesThisBatch = currentGenerationMode.generate(now, notes.filter(note => !note.hit), availableLanes);
      } else {
        // 其他模式可能需要调整，这里我们简化处理，确保生成足够的初始音符
        lanesThisBatch = new Set();
        while (lanesThisBatch.size < batchSize && availableLanes.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableLanes.length);
          lanesThisBatch.add(availableLanes[randomIndex]);
        }
      }
      
      // 为当前批次的每个音符生成
      lanesThisBatch.forEach(lane => {
        // 确保不超过音符总数
        if (noteId >= noteCount) return;
        
        // 增加该轨道的音符计数
        laneNoteCount[lane]++;
        
        // 从对象池获取音符或创建新音符
        let note = getNoteFromPool();
        
        // 计算音符之间的间隔，应用间隔控制机制
        const spacing = calculateNoteSpacing();
        const delay = 300 + Math.random() * 400; // 初始音符的间隔略小，以快速进入游戏节奏
        lastCreatedAt += delay;
        
        if (!note) {
          // 如果对象池为空，创建新对象
          note = {
            id: `note_${noteId++}`,
            lane: lane,
            position: -noteRadius * 2,
            createdAt: lastCreatedAt,
            spacing: spacing,
            hit: false,
            judgment: null,
            _pool: false
          };
        } else {
          // 重用对象，更新属性
          note.id = `note_${noteId++}`;
          note.lane = lane;
          note.position = -noteRadius * 2;
          note.createdAt = lastCreatedAt;
          note.spacing = spacing;
        }
        
        notes.push(note);
      });
      
      // 如果当前批次没有生成足够的音符，补充一些随机音符
      while (noteId < noteCount && noteId < (batch + 1) * MAX_NOTES_PER_GENERATION) {
        // 找到可用轨道
        const availableForFill = [];
        for (let i = 0; i < laneCount; i++) {
          if (laneNoteCount[i] < MAX_NOTES_ON_LANE) {
            availableForFill.push(i);
          }
        }
        
        if (availableForFill.length === 0) break;
        
        const lane = availableForFill[Math.floor(Math.random() * availableForFill.length)];
        laneNoteCount[lane]++;
        
        let note = getNoteFromPool();
        const spacing = calculateNoteSpacing();
        const delay = 300 + Math.random() * 400;
        lastCreatedAt += delay;
        
        if (!note) {
          note = {
            id: `note_${noteId++}`,
            lane: lane,
            position: -noteRadius * 2,
            createdAt: lastCreatedAt,
            spacing: spacing,
            hit: false,
            judgment: null,
            _pool: false
          };
        } else {
          note.id = `note_${noteId++}`;
          note.lane = lane;
          note.position = -noteRadius * 2;
          note.createdAt = lastCreatedAt;
          note.spacing = spacing;
        }
        
        notes.push(note);
      }
    }
    
    // 初始化最后生成时间
    lastNoteGenTime = now;
  }
  
  // 对象池优化 - 增加池大小以支持3分钟持续生成
  let noteObjectPool = [];
  const MAX_POOL_SIZE = 100; // 增加对象池大小以支持更长时间的游戏
  
  // 从对象池获取音符对象
  function getNoteFromPool() {
    if (noteObjectPool.length > 0) {
      const note = noteObjectPool.pop();
      // 重置属性
      note.hit = false;
      note.judgment = null;
      note._pool = false;
      return note;
    }
    return null;
  }
  
  // 回收音符对象到对象池
  function returnNoteToPool(note) {
    if (noteObjectPool.length < MAX_POOL_SIZE && !note._pool) {
      note._pool = true;
      noteObjectPool.push(note);
    }
  }
  
  // 重置游戏状态
  function resetGame() {
    // 重置游戏状态变量
    isPlaying = false;
    isPaused = false;
    score = 0;
    combo = 0;
    maxCombo = 0;
    accuracy = 100;
    judgments = { perfect: 0, great: 0, good: 0, bad: 0, miss: 0 };
    notes = [];
    gameTime = 0;
    startTime = null;
    lastTime = 0;
    lastStatusUpdate = 0;
    judgmentDisplay = [];
    
    // 重置生成模式相关变量
    currentGenerationMode = null;
    modeActivationTime = 0;
    currentModeDuration = 0;
    lastNoteGenTime = 0;
  }
  
  // 开始游戏 - 进一步优化版本，减少启动时的性能开销
  function startGame() {
    // 重置游戏状态
    resetGame();
    
    // 立即将isPlaying设为true，确保即使音频加载失败也能生成音符
    isPlaying = true;
    
    // 分批次生成初始音符，避免一次性大量创建对象
    setTimeout(() => {
      // 先生成一小部分音符，让游戏快速开始
      // 创建一个临时函数来生成少量初始音符
      function generateInitialSmallBatch() {
        notes = [];
        
        const now = performance.now();
        let noteId = 0;
        const laneNoteCount = new Array(laneCount).fill(0);
        const smallBatchSize = Math.min(INITIAL_NOTES_COUNT, 4);
        
        // 初始化生成模式
        if (!currentGenerationMode) {
          currentGenerationMode = selectRandomGenerationMode();
          modeActivationTime = now;
          currentModeDuration = MODE_DURATION_MIN + Math.random() * (MODE_DURATION_MAX - MODE_DURATION_MIN);
        }
        
        // 生成少量初始音符
        for (let i = 0; i < smallBatchSize; i++) {
          // 找到可用轨道
          const availableLanes = [];
          for (let j = 0; j < laneCount; j++) {
            if (laneNoteCount[j] < MAX_NOTES_ON_LANE) {
              availableLanes.push(j);
            }
          }
          
          if (availableLanes.length === 0) break;
          
          const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
          laneNoteCount[lane]++;
          
          let note = getNoteFromPool();
          const spacing = calculateNoteSpacing();
          const delay = 300 + Math.random() * 400;
          const createdAt = now + (i * delay);
          
          if (!note) {
            note = {
              id: `note_${noteId++}`,
              lane: lane,
              position: -noteRadius * 2,
              createdAt: createdAt,
              spacing: spacing,
              hit: false,
              judgment: null,
              _pool: false
            };
          } else {
            note.id = `note_${noteId++}`;
            note.lane = lane;
            note.position = -noteRadius * 2;
            note.createdAt = createdAt;
            note.spacing = spacing;
            note.hit = false;
            note.judgment = null;
          }
          
          notes.push(note);
        }
        
        lastNoteGenTime = now;
      }
      
      generateInitialSmallBatch();
      
      // 然后在后台继续生成剩余音符
      setTimeout(() => {
        generateAdditionalNotes(performance.now());
      }, 300);
    }, 50); // 减少延迟，让游戏更快启动
    
    // 初始化音频系统（完全异步，不阻塞任何游戏逻辑）
    if (gameConfig.audioEnabled) {
      loadAndPlayAudio().catch(error => {
        console.warn('音频加载失败，继续无音频模式:', error);
      });
    }
    
    // 设置开始时间，使用performance.now()获得更高精度
    startTime = performance.now();
    lastTime = startTime;
    
    // 立即开始游戏循环，不依赖音频加载
    requestAnimationFrame(gameLoop);
  }
  
  // 分离的音频加载函数，避免阻塞游戏启动
  async function loadAndPlayAudio() {
    // 停止主菜单音乐（如果正在播放）
    audioManager.stopBGM();
    
    try {
      if (song && song.audioUrl) {
        // 使用歌曲自带的音频
        await audioManager.loadBGM('game_music', song.audioUrl);
      } else {
        // 使用默认游戏背景音乐
        await audioManager.loadBGM('game_music', 'https://example.com/game_music.mp3');
      }
      
      if (gameConfig.audioEnabled) {
        audioManager.playBGM('game_music');
      }
    } catch (error) {
      console.warn('音频加载错误:', error);
      // 不再抛出错误，避免阻止游戏循环
    }
    // 即使出错也继续，isPlaying已经在startGame中设置为true
    gameLoop();
  }
  
  // 游戏主循环 - 进一步优化版本，提高启动流畅度和响应性
  function gameLoop() {
    // 确保函数不会执行超过一定时间
    const frameStartTime = performance.now();
    const MAX_FRAME_TIME = 10; // 限制每帧处理时间，防止主线程阻塞
    
    if (!isPlaying || isPaused) return;
    
    try {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      gameTime = currentTime - startTime;
      
      // 优化帧率控制，使用requestAnimationFrame的天然帧率控制
      if (deltaTime >= 16) { // 约60FPS更新频率
        // 检查是否超出最大帧处理时间，如果是则跳过一些非关键更新
        if (currentTime - frameStartTime < MAX_FRAME_TIME) {
          // 只更新活跃音符，避免不必要的计算
          updateNotes(deltaTime);
        }
        
        // 检查是否还有时间执行下一个任务
        if (currentTime - frameStartTime < MAX_FRAME_TIME) {
          // 检查错过的音符和清理旧音符
          checkMissedAndCleanupNotes();
        }
        
        // 检查是否还有时间执行下一个任务
        if (currentTime - frameStartTime < MAX_FRAME_TIME) {
          // 动态生成新音符 - 改进版本，减少不必要的数组过滤
          const activeNotesCount = notes.reduce((count, note) => count + (!note.hit ? 1 : 0), 0);
          if (activeNotesCount < 20) {
            generateAdditionalNotes(currentTime);
          }
        }
        
        // 统一更新所有判定显示的动画，避免定时器累积
        if (currentTime - frameStartTime < MAX_FRAME_TIME) {
          updateJudgmentAnimations();
        }
        
        // 降低状态更新频率，减少响应式开销，提高性能
        if (currentTime - lastStatusUpdate >= 200) { // 每200ms更新一次状态
          updateGameStatus();
          lastStatusUpdate = currentTime;
        }
        
        // 检查游戏是否结束
        if (gameTime >= gameDuration * 1000) {
          endGame();
          return;
        }
        
        lastTime = currentTime;
      }
      
      // 安全请求下一帧，确保不会堆积
      if (isPlaying && !isPaused) {
        animationFrameId = requestAnimationFrame(gameLoop);
      }
    } catch (error) {
      console.error('游戏循环错误:', error);
      // 即使出错也继续请求下一帧，避免游戏完全卡死
      if (isPlaying && !isPaused) {
        animationFrameId = requestAnimationFrame(gameLoop);
      }
    }
  }
  
  let lastStatusUpdate = 0; // 用于限制状态更新频率
  
  // 合并检查错过的音符和清理旧音符，减少遍历次数 - 优化版本
  function checkMissedAndCleanupNotes() {
    if (!gameArea) return;
    
    const missThreshold = judgmentLinePosition + 200; // 增加错过阈值，给玩家更多反应时间
    const cleanupThreshold = gameArea.offsetHeight + 150; // 增加清理阈值，使音符在离开屏幕后稍作停留
    
    // 创建新数组而不是修改原数组，避免在遍历过程中修改数组
    const newNotes = [];
    
    for (const note of notes) {
      if (!note.hit) {
        // 检查是否错过
        if (note.createdAt && note.position > missThreshold) {
          handleMiss(note);
          // 回收错过的音符到对象池
          returnNoteToPool(note);
        } else if (note.position <= cleanupThreshold) {
          newNotes.push(note); // 保留未清理的音符
        } else {
          // 回收离开屏幕的音符到对象池
          returnNoteToPool(note);
        }
      } else if (note.position <= cleanupThreshold) {
        newNotes.push(note); // 保留已击中但未离开屏幕的音符
      } else {
        // 回收已击中且离开屏幕的音符到对象池
        returnNoteToPool(note);
      }
    }
    
    // 一次性更新数组，减少响应式更新次数
    notes = newNotes;
  }
  
  // 动态生成额外的音符 - 优化版本，支持多种生成模式
  let nextNoteId = 1000; // 避免ID冲突
  let lastNoteGenTime = 0;
  let currentModeDuration = 0;
  
  // 音符生成模式定义
  const generationModes = {
    // 模式1：随机分布 - 基础随机生成模式
    random: {
      name: 'random',
      generate: function(currentTime, activeNotes, availableLanes) {
        const noteCount = Math.floor(Math.random() * MAX_NOTES_PER_GENERATION) + 1;
        const adjustedNoteCount = Math.min(noteCount, availableLanes.length);
        
        const lanesThisTime = new Set();
        while (lanesThisTime.size < adjustedNoteCount) {
          const randomIndex = Math.floor(Math.random() * availableLanes.length);
          lanesThisTime.add(availableLanes[randomIndex]);
        }
        
        return lanesThisTime;
      }
    },
    
    // 模式2：顺序生成 - 按轨道顺序依次生成音符
    sequential: {
      name: 'sequential',
      lastLane: -1,
      generate: function(currentTime, activeNotes, availableLanes) {
        // 确保至少有一个音符
        const noteCount = 1 + Math.floor(Math.random() * 2);
        const lanesThisTime = new Set();
        
        // 按顺序选择轨道
        for (let i = 0; i < noteCount && availableLanes.length > 0 && lanesThisTime.size < noteCount; i++) {
          this.lastLane = (this.lastLane + 1) % laneCount;
          if (availableLanes.includes(this.lastLane)) {
            lanesThisTime.add(this.lastLane);
          }
        }
        
        // 如果没找到足够的轨道，随机补充
        while (lanesThisTime.size < noteCount && availableLanes.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableLanes.length);
          lanesThisTime.add(availableLanes[randomIndex]);
        }
        
        return lanesThisTime;
      }
    },
    
    // 模式3：密集爆发 - 短时间内生成较多音符
    burst: {
      name: 'burst',
      generate: function(currentTime, activeNotes, availableLanes) {
        // 生成较多音符，但不超过可用轨道数
        const noteCount = Math.min(2 + Math.floor(Math.random() * 2), availableLanes.length);
        
        // 随机选择轨道，但确保分散在不同轨道
        const lanesThisTime = new Set();
        while (lanesThisTime.size < noteCount && availableLanes.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableLanes.length);
          lanesThisTime.add(availableLanes[randomIndex]);
        }
        
        return lanesThisTime;
      }
    },
    
    // 模式4：交替模式 - 左右交替生成音符
    alternate: {
      name: 'alternate',
      side: 0, // 0: 左, 1: 右
      generate: function(currentTime, activeNotes, availableLanes) {
        const mid = Math.floor(laneCount / 2);
        let targetLanes;
        
        // 切换左右
        this.side = (this.side + 1) % 2;
        
        if (this.side === 0) {
          // 左侧轨道
          targetLanes = availableLanes.filter(lane => lane < mid);
        } else {
          // 右侧轨道
          targetLanes = availableLanes.filter(lane => lane >= mid);
        }
        
        // 如果目标侧没有可用轨道，使用所有可用轨道
        if (targetLanes.length === 0) {
          targetLanes = availableLanes;
        }
        
        // 生成1-2个音符
        const noteCount = 1 + Math.floor(Math.random() * 2);
        const adjustedNoteCount = Math.min(noteCount, targetLanes.length);
        
        const lanesThisTime = new Set();
        while (lanesThisTime.size < adjustedNoteCount) {
          const randomIndex = Math.floor(Math.random() * targetLanes.length);
          lanesThisTime.add(targetLanes[randomIndex]);
        }
        
        return lanesThisTime;
      }
    },
    
    // 模式5：同步生成 - 同时在多个相邻轨道生成音符
    sync: {
      name: 'sync',
      generate: function(currentTime, activeNotes, availableLanes) {
        // 随机选择起始轨道
        if (availableLanes.length === 0) return new Set();
        
        const startLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
        const lanesThisTime = new Set([startLane]);
        
        // 尝试添加相邻轨道
        const directions = [-1, 1]; // 左右
        const noteCount = 1 + Math.floor(Math.random() * 2);
        
        directions.forEach(dir => {
          let currentLane = startLane + dir;
          while (lanesThisTime.size < noteCount && currentLane >= 0 && currentLane < laneCount) {
            if (availableLanes.includes(currentLane)) {
              lanesThisTime.add(currentLane);
              break;
            }
            currentLane += dir;
          }
        });
        
        return lanesThisTime;
      }
    }
  };
  
  // 选择随机生成模式
  function selectRandomGenerationMode() {
    const modes = Object.keys(generationModes);
    const modeName = modes[Math.floor(Math.random() * modes.length)];
    return generationModes[modeName];
  }
  
  // 实现音符间隔控制的工具函数
  function calculateNoteSpacing() {
    // 计算随机间隔，确保最小间隔
    return NOTE_MIN_SPACING + Math.random() * NOTE_SPACING_VARIATION;
  }
  
  function generateAdditionalNotes(currentTime) {
    // 使用固定的生成间隔，保持较短间隔以确保持续生成
    if (currentTime - lastNoteGenTime < NOTE_GENERATION_INTERVAL) return;
    
    // 限制活跃音符数量，但增加上限以支持3分钟游戏
    const activeNotes = notes.filter(note => !note.hit);
    if (activeNotes.length >= 30) return; // 增加最大活跃音符数
    
    // 检查是否需要切换生成模式
    if (!currentGenerationMode || currentTime - modeActivationTime > currentModeDuration) {
      currentGenerationMode = selectRandomGenerationMode();
      modeActivationTime = currentTime;
      // 增加模式持续时间，减少频繁切换导致的性能波动
      currentModeDuration = 8000 + Math.random() * 8000; // 8-16秒，比原来的5-10秒更长
      // 移除console.log以减少性能开销
    }
    
    // 确保同一轨道上的音符数量限制
    const laneCounts = new Array(laneCount).fill(0);
    activeNotes.forEach(note => {
      laneCounts[note.lane]++;
    });
    
    // 找到可用的轨道（未满的）
    const availableLanes = [];
    for (let i = 0; i < laneCount; i++) {
      if (laneCounts[i] < MAX_NOTES_ON_LANE) {
        availableLanes.push(i);
      }
    }
    
    if (availableLanes.length === 0) return;
    
    // 使用当前激活的生成模式来确定生成哪些轨道的音符
    const lanesThisTime = currentGenerationMode.generate(currentTime, activeNotes, availableLanes);
    
    // 从对象池获取音符或创建新音符
    let lastCreatedAt = currentTime;
    lanesThisTime.forEach(lane => {
      let note = getNoteFromPool();
      
      // 计算音符之间的间隔，确保不会太密集
      const spacing = calculateNoteSpacing();
      // 减少基础延迟，确保音符生成更频繁
      const delay = 300 + (Math.random() * 400); // 从1000+500改为300+400，显著增加生成频率
      lastCreatedAt += delay;
      
      if (!note) {
        // 如果对象池为空，创建新对象
        note = {
          id: `note_${nextNoteId++}`,
          lane: lane,
          position: -noteRadius * 2,
          createdAt: lastCreatedAt,
          spacing: spacing,
          hit: false,
          judgment: null,
          _pool: false
        };
      } else {
        // 重用对象，更新属性
        note.id = `note_${nextNoteId++}`;
        note.lane = lane;
        note.position = -noteRadius * 2;
        note.createdAt = lastCreatedAt;
        note.spacing = spacing;
      }
      
      notes.push(note);
    });
    
    lastNoteGenTime = currentTime;
  }
  
  // 移除难度变化相关功能，简化游戏逻辑
  
  // 已被checkMissedAndCleanupNotes替代
  
  // 更新音符位置 - 优化版本，降低速度以延长掉落时间
  function updateNotes(deltaTime) {
    const currentTime = Date.now();
    
    // 计算基于deltaTime的移动距离，降低速度系数以延长音符掉落时间
    const basePositionDelta = (noteSpeed / 10) * (deltaTime / 16) * 1.2; // 从3降低到1.2，显著减慢速度
    
    // 只更新活跃音符，避免不必要的计算
    const activeNotes = notes.filter(note => !note.hit && currentTime >= note.createdAt);
    
    activeNotes.forEach(note => {
      // 更新音符位置
      note.position += basePositionDelta;
      
      // 确保音符在创建时从正确位置开始
      if (note.position < -noteRadius * 2) {
        note.position = -noteRadius * 2;
      }
    });
  }
  
  // 检查错过的音符
  function checkMissedNotes() {
    if (!gameArea) return;
    
    const missThreshold = judgmentLinePosition + 150; // 基于判定线位置的动态阈值
    
    // 性能优化：使用filter而不是forEach，避免重复遍历
    const notesToMiss = notes.filter(note => 
      note.createdAt && !note.hit && note.position > missThreshold
    );
    
    // 批量处理错过的音符
    notesToMiss.forEach(note => handleMiss(note));
  }
  
  // 处理音符点击 - 统一的判定逻辑
  function handleNoteHit(lane) {
    // 添加防御性检查
    if (!isPlaying || isPaused || !gameArea || lane === undefined || lane === null || lane < 0 || lane >= laneCount) {
      return;
    }
    
    try {
      // 找到该轨道上未击中且在合理范围内的音符
      const currentTime = Date.now();
      
      // 优化过滤逻辑：先过滤必要条件，减少计算量
      const laneNotes = notes.filter(
        note => 
          note && // 确保note不是null或undefined
          note.lane === lane && 
          !note.hit && 
          note.createdAt && currentTime >= note.createdAt 
      );
      
      if (laneNotes.length === 0) {
        return;
      }
      
      // 只对候选音符计算距离并找到最接近的
      let minDistance = Infinity;
      let targetNote = null;
      
      for (const note of laneNotes) {
        const distance = Math.abs(note.position - judgmentLinePosition);
        if (distance < hitRange && distance < minDistance) {
          minDistance = distance;
          targetNote = note;
        }
      }
      
      if (!targetNote) {
        return; // 没有找到在判定范围内的音符
      }
      
      // 立即标记为已击中，防止重复处理
      targetNote.hit = true;
      
      // 计算判定结果
      const judgment = calculateJudgment(minDistance);
      
      // 异步处理分数更新和判定显示，避免阻塞主线程
      setTimeout(() => {
        registerHit(targetNote, judgment);
        
        // 异步播放音效，避免阻塞
        if (audioManager && gameConfig.sfxEnabled) {
          try {
            const soundName = judgment === 'miss' ? 'miss' : `hit_${judgment}`;
            audioManager.playSoundEffect(soundName);
          } catch (soundError) {
            // 音效播放失败不应影响游戏流程
            console.warn('音效播放失败:', soundError);
          }
        }
      }, 0);
    } catch (error) {
      console.error('处理音符击中时出错:', error);
    }
  }
  
  // 计算判定结果 - 基于像素距离的精确判定
  function calculateJudgment(distance) {
    // 调整判定阈值，使用像素距离而不是时间，更准确反映视觉位置
    const adjustedThresholds = {
      perfect: noteRadius * 1.5,  // 完美判定：半径1.5倍内
      great: noteRadius * 3,      // 良好判定：半径3倍内
      good: noteRadius * 5,       // 一般判定：半径5倍内
      bad: noteRadius * 7         // 可接受判定：半径7倍内
    };
    
    if (distance <= adjustedThresholds.perfect) return 'perfect';
    if (distance <= adjustedThresholds.great) return 'great';
    if (distance <= adjustedThresholds.good) return 'good';
    if (distance <= adjustedThresholds.bad) return 'bad';
    return 'miss';
  }
  
  // 注册击中 - 优化内存管理和对象回收
  function registerHit(note, judgment) {
    note.hit = true;
    note.judgment = judgment;
    
    // 更新判定统计
    judgments[judgment] = (judgments[judgment] || 0) + 1;
    
    // 更新分数
    const baseScore = scoreValues[judgment];
    const comboMultiplier = Math.min(combo / 10 + 1, 2); // 连击倍数，最高2倍
    const scoreIncrease = judgment !== 'miss' ? Math.floor(baseScore * comboMultiplier) : 0;
    score += scoreIncrease;
    
    // 更新连击
    if (judgment === 'miss') {
      combo = 0;
    } else {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
    }
    
    // 显示判定结果
    showJudgment(judgment, note.lane);
    
    // 标记为待回收，由checkMissedAndCleanupNotes统一处理
    note._toBeRemoved = true;
  }
  
  // 处理错过
  function handleMiss(note) {
    if (note.hit) return;
    
    note.hit = true;
    note.judgment = 'miss';
    judgments.miss++;
    combo = 0;
    
    // 显示Miss判定
    showJudgment('miss', note.lane);
  }
  
  // 显示判定结果 - 使用响应式数组而不是直接DOM操作
  let judgmentDisplay = [];
  let animationTimers = new Map(); // 用于跟踪所有动画定时器
  
  function showJudgment(judgment, lane) {
    if (!gameArea) return;
    
    const laneWidth = gameArea.offsetWidth / laneCount;
    const x = lane * laneWidth + laneWidth / 2;
    
    // 创建判定显示对象
    const judgmentId = Date.now() + Math.random();
    judgmentDisplay.push({
      id: judgmentId,
      judgment,
      x,
      y: judgmentLinePosition,
      text: judgment === 'perfect' ? 'PERFECT!' :
           judgment === 'great' ? 'GREAT!' :
           judgment === 'good' ? 'GOOD' :
           judgment === 'bad' ? 'BAD' : 'MISS',
      opacity: 1,
      createdAt: performance.now()
    });
    
    // 立即返回，不在这里启动动画
  }
  
  // 在游戏循环中统一更新所有判定显示的动画
  function updateJudgmentAnimations() {
    const currentTime = performance.now();
    const newDisplayList = [];
    
    for (const judgment of judgmentDisplay) {
      const age = currentTime - judgment.createdAt;
      const animationDuration = 600; // 总动画时间600ms
      
      if (age < animationDuration) {
        // 计算当前透明度 - 线性衰减
        judgment.opacity = 1 - (age / animationDuration);
        // 添加到新数组
        newDisplayList.push(judgment);
      }
      // 超过动画时间的自动被过滤掉，无需额外清理
    }
    
    // 只在数组变化时更新，减少响应式更新次数
    if (newDisplayList.length !== judgmentDisplay.length) {
      judgmentDisplay = newDisplayList;
    }
  }
  
  // 更新游戏状态
  function updateGameStatus() {
    // 计算准确率
    const totalJudgments = Object.values(judgments).reduce((a, b) => a + b, 0);
    if (totalJudgments > 0) {
      const accurateJudgments = judgments.perfect + judgments.great;
      accuracy = Math.round((accurateJudgments / totalJudgments) * 100);
    }
  }
  
  // 暂停/继续游戏
  function togglePause() {
    isPaused = !isPaused;
    
    if (!isPaused) {
      lastTime = Date.now();
      gameLoop();
    }
  }
  
  // 停止游戏
  function stopGame() {
    isPlaying = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  }
  
  // 计算准确率的辅助函数
  function calculateAccuracy() {
    const totalNotes = Object.values(judgments).reduce((sum, count) => sum + count, 0);
    if (totalNotes > 0) {
      const perfectNotes = judgments.perfect || 0;
      const greatNotes = judgments.great || 0;
      const goodNotes = judgments.good || 0;
      return (perfectNotes * 3 + greatNotes * 2 + goodNotes * 1) / (totalNotes * 3) * 100;
    }
    return 0;
  }
  
  // 结束游戏
  function endGame() {
    stopGame();
    
    // 停止游戏音乐
    if (songAudio) {
      songAudio.pause();
      songAudio = null;
    }
    audioManager.stopBGM('game_music');
    
    // 计算最终准确率（只计算一次）
    const finalAccuracy = calculateAccuracy();
    accuracy = Math.round(finalAccuracy);
    
    // 播放游戏结束音乐（胜利或失败）
    if (gameConfig.audioEnabled) {
      if (finalAccuracy >= 70) {
        // 播放胜利音乐
        audioManager.loadBGM('victory_music', '../Musics/Rainbow - Sia.mp3').then(() => {
          audioManager.playBGM('victory_music');
        });
      } else {
        // 播放失败音乐
        audioManager.loadBGM('defeat_music', '../Musics/Rainbow - Sia.mp3').then(() => {
          audioManager.playBGM('defeat_music');
        });
      }
    }
    
    // 保存高分记录
    try {
      gameDataManager.updateHighScore(song.id, difficulty, score);
    } catch (e) {
      console.warn('保存高分记录失败:', e);
    }
    
    // 通知父组件游戏结束
    dispatch('gameEnd', {
      song,
      difficulty,
      score,
      combo,
      maxCombo,
      accuracy,
      judgments
    });
  }
  
  // 保存最高分
  function saveHighScore(results) {
    try {
      const highScores = JSON.parse(localStorage.getItem('rhythmMasterHighScores') || '{}');
      const key = `${results.song.id}_${results.difficulty}`;
      
      if (!highScores[key] || results.score > highScores[key]) {
        highScores[key] = results.score;
        localStorage.setItem('rhythmMasterHighScores', JSON.stringify(highScores));
      }
    } catch (e) {
      console.error('保存最高分失败:', e);
    }
  }
  
  // 处理键盘输入
  function handleKeyDown(event) {
    // 暂停键
    if (event.key === ' ') {
      event.preventDefault();
      togglePause();
      return;
    }
    
    // 轨道键位映射
    const keyToLane = {
      'd': 0,
      'f': 1,
      'j': 2,
      'k': 3,
      '1': 0,
      '2': 1,
      '3': 2,
      '4': 3
    };
    
    const lane = keyToLane[event.key.toLowerCase()];
    if (lane !== undefined && lane < laneCount) {
      handleNoteHit(lane);
    }
  }
  
  // 处理触摸区域的键盘事件
  function handleTouchKeyDown(event, laneIndex) {
    // 只响应空格键或回车键作为确认键
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handleLaneTouch(laneIndex);
    }
  }
  
  // 处理轨道触摸 - 支持多点触控的改进版本
  function handleLaneTouch(laneIndex) {
    if (!isPlaying || isPaused) return;
    
    // 直接调用handleNoteHit，传入轨道索引
    handleNoteHit(laneIndex);
  }
  
  // 跟踪当前活动的触摸点
  let activeTouches = new Set();
  
  // 处理触摸开始事件，支持多点触控
  function handleTouchStart(event, laneIndex) {
    // 添加防御性检查
    if (!event || !isPlaying || isPaused) return;
    
    try {
      // 阻止事件冒泡和默认行为
      event.preventDefault();
      event.stopPropagation();
      
      // 为每个触摸点单独处理
      const touches = event.touches || [event];
      // 限制处理的触摸点数，避免性能问题
      const limitedTouches = Array.from(touches).slice(0, 5);
      
      for (let i = 0; i < limitedTouches.length; i++) {
        const touch = limitedTouches[i];
        if (!touch) continue;
        
        const touchId = touch.identifier !== undefined ? touch.identifier : Math.random();
        
        // 只处理新的触摸点
        if (activeTouches && !activeTouches.has(touchId)) {
          activeTouches.add(touchId);
          // 异步处理音符击中，避免阻塞主线程
          setTimeout(() => {
            handleNoteHit(laneIndex);
          }, 0);
          
          // 简化触摸反馈，避免复杂DOM操作
          const touchElement = event.currentTarget;
          if (touchElement && touchElement.classList && touchElement.classList.contains('touch-area')) {
            touchElement.classList.add('touching');
            setTimeout(() => {
              if (touchElement && touchElement.classList) {
                touchElement.classList.remove('touching');
              }
            }, 200);
          }
        }
      }
    } catch (error) {
      console.error('触摸事件处理错误:', error);
    }
  }
  
  // 处理触摸结束事件，清理活动触摸点
  function handleTouchEnd(event) {
    // 添加防御性检查
    if (!event || !activeTouches) return;
    
    try {
      // 阻止事件冒泡和默认行为
      event.preventDefault();
      event.stopPropagation();
      
      const changedTouches = event.changedTouches || [event];
      if (!changedTouches || !Array.isArray(changedTouches)) return;
      
      // 限制处理的触摸点数，避免性能问题
      const limitedTouches = Array.from(changedTouches).slice(0, 5);
      
      for (let i = 0; i < limitedTouches.length; i++) {
        const touch = limitedTouches[i];
        if (!touch) continue;
        
        const touchId = touch.identifier !== undefined ? 
                        touch.identifier : Math.random();
        
        // 安全删除触摸点
        if (activeTouches.delete && typeof activeTouches.delete === 'function') {
          activeTouches.delete(touchId);
        }
      }
      
      // 额外的安全检查：如果活动触摸点过多，清理一部分
      if (activeTouches.size && activeTouches.size > 10) {
        // 只保留最新的5个触摸点
        const oldestTouches = Array.from(activeTouches).slice(0, activeTouches.size - 5);
        oldestTouches.forEach(touchId => activeTouches.delete(touchId));
      }
    } catch (error) {
      console.error('触摸结束事件处理错误:', error);
    }
  }
  
  // 处理游戏区域的键盘松开事件
  function handleKeyUp(event) {
    // 可以在这里添加键盘松开时的逻辑
  }
  
  // 获取当前游戏时间格式
  function getFormattedTime(time) {
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
</script>

<div class="game-page" bind:this={gameContainer}>
  {#if isPaused}
    <div class="pause-overlay">
      <h2 class="pause-text">游戏暂停</h2>
      <button class="resume-button" on:click={togglePause}>继续游戏</button>
      <button class="exit-button" on:click={() => dispatch('exit')}>退出游戏</button>
    </div>
  {/if}
  
  <!-- 判定结果显示区域 - 使用Svelte响应式渲染替代手动DOM操作 -->
  {#each judgmentDisplay as display}
    <div 
      class={`judgment ${display.judgment}`}
      style={`
        left: ${display.x}px;
        top: ${display.y}px;
        opacity: ${display.opacity};
        transform: translate(-50%, -50%);
        position: absolute;
        pointer-events: none;
        z-index: 1000;
        font-weight: bold;
        font-size: 24px;
        animation: judgmentFloat 0.6s ease-out;
      `}
    >
      {display.text}
    </div>
  {/each}
  
  <!-- 移除难度变化显示 -->
  
  <!-- 游戏信息区域 -->
  <div class="game-info">
    <div class="song-info">
      <h3 class="current-song">{song.title}</h3>
      <p class="song-artist">{song.artist}</p>
      <span class="difficulty">
        {difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '中等' : '困难'}
      </span>
    </div>
    
    <div class="game-stats">
      <div class="stat-item">
        <span class="stat-label">分数:</span>
        <span class="stat-value score">{score.toLocaleString()}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">连击:</span>
        <span class={`stat-value combo ${combo > 20 ? 'glow' : ''}`}>{combo}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">准确率:</span>
        <span class="stat-value accuracy">{accuracy}%</span>
      </div>
    </div>
    
    <div class="time-display">
      <span class="current-time">{getFormattedTime(gameTime)}</span>
      <span class="separator">/</span>
      <span class="total-time">{getFormattedTime(gameDuration * 1000)}</span>
    </div>
  </div>
  
  <!-- 游戏区域 -->
  <div class="game-area" bind:this={gameArea} role="application" aria-label="节奏游戏主区域">
    <!-- 轨道背景 -->
    <div class="lanes-background">
      {#each Array(laneCount) as _, i}
        <div class="lane" style="width: calc(100% / {laneCount});">
          <div class="lane-indicator" style="position: absolute; top: 10px; left: 0; width: 100%; text-align: center; color: rgba(255,255,255,0.5); font-size: 14px;">
            {['D', 'F', 'J', 'K'][i] || (i + 1)}
          </div>
        </div>
      {/each}
    </div>
    
    <!-- 判定线 -->
    <div class="judgment-line" bind:this={judgmentLine}>
      <div class="judgment-line-glow"></div>
    </div>
    
    <!-- 动态音符渲染 -->
    {#each notes as note}
      {#if !note.hit}
        <div 
          class="note" 
          style="
            left: calc({note.lane} * (100% / {laneCount}) + 50% / {laneCount});
            top: {note.position}px;
            width: {noteRadius * 2}px;
            height: {noteRadius * 2}px;
            --note-color: {['#ff6b6b', '#4ecdc4', '#ffe66d', '#6a0572'][note.lane % 4]};
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          <div class="note-inner"></div>
        </div>
      {/if}
    {/each}
    
    <!-- 触摸区域 - 支持多点触控 -->
    <div class="touch-areas">
      {#each Array(laneCount) as _, i}
        <div 
          class="touch-area" 
          style="width: calc(100% / {laneCount});"
          on:click={() => handleLaneTouch(i)}
          on:keydown={(e) => handleTouchKeyDown(e, i)}
          on:touchstart={(e) => handleTouchStart(e, i)}
          on:touchend={handleTouchEnd}
          on:touchcancel={handleTouchEnd}
          role="button" 
          aria-label={`轨道${i + 1}触摸区域`}
          tabindex="0"
          touch-action="none"
        >
          <div class="touch-feedback"></div>
          <div class="key-hint">{['D', 'F', 'J', 'K'][i] || (i + 1)}</div>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- 暂停按钮 -->
  <button class="pause-button" on:click={togglePause}>
    {isPaused ? '▶' : '❚❚'}
  </button>
  
  <!-- 退出按钮 -->
  <button class="exit-game-button" on:click={() => dispatch('exit')}>
    退出
  </button>
</div>

<style>
  :root {
    --text-primary: #ffffff;
    --text-secondary: #b0b0b0;
    --surface-color: #2a2a4a;
    --accent-color: #ff6b6b;
    --secondary-color: #4ecdc4;
    --judgment-perfect: #ffd700;
    --judgment-line-height: 4px;
  }
  
  .game-page {
    width: 100%;
    height: 100%;
    position: relative;
    background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);
    overflow: hidden;
  }
  
  .game-info {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 20px;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .song-info {
    flex: 1;
    min-width: 200px;
  }
  
  .current-song {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
  }
  
  .song-artist {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 5px;
  }
  
  .difficulty {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 500;
    background: var(--surface-color);
  }
  
  .game-stats {
    display: flex;
    gap: 20px;
    flex: 1;
    justify-content: center;
  }
  
  .stat-item {
    display: flex;
    align-items: baseline;
    gap: 5px;
  }
  
  .stat-label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .stat-value {
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--text-primary);
  }
  
  .stat-value.score {
    color: var(--accent-color);
  }
  
  .stat-value.combo {
    color: var(--secondary-color);
  }
  
  .stat-value.accuracy {
    color: var(--judgment-perfect);
  }
  
  .time-display {
    font-size: 1rem;
    color: var(--text-secondary);
    min-width: 100px;
    text-align: right;
  }
  
  .game-area {
    position: relative;
    margin-top: 120px;
    height: calc(100% - 120px);
    overflow: visible; /* 允许音符显示在游戏区域外 */
    background-color: rgba(0, 0, 0, 0.2);
  }
  
  .lanes-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    display: flex;
  }
  
  .lane {
    height: 100%;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
  }
  
  .lane:last-child {
    border-right: none;
  }
  
  .judgment-line {
    position: absolute;
    left: 0;
    right: 0;
    height: var(--judgment-line-height);
    background: var(--accent-color);
    z-index: 10;
    /* 移除translateY，直接设置位置 */
    top: 80%;
  }
  
  .judgment-line-glow {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 10px;
    background: var(--accent-color);
    filter: blur(10px);
    opacity: 0.5;
    transform: translateY(-50%);
  }
  
  .note {
    position: absolute;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: var(--note-color);
    box-shadow: 
      0 0 20px var(--note-color),
      0 0 30px rgba(255, 255, 255, 0.5),
      inset 0 0 10px rgba(255, 255, 255, 0.3);
    z-index: 100;
    transition: all 0.1s ease;
    border: 2px solid white;
    opacity: 1;
    visibility: visible;
  }
  
  .note-inner {
    width: 60%;
    height: 60%;
    background: white;
    border-radius: 50%;
    margin: 20%;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);
  }
  
  .note.hit {
    animation: hitAnimation 0.3s ease-out forwards;
  }
  
  @keyframes hitAnimation {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.3);
      opacity: 0.8;
    }
    100% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
    }
  }
  
  /* 判定结果样式 */
  .judgment {
    position: absolute;
    font-size: 24px;
    font-weight: bold;
    z-index: 200;
    animation: judgmentFloat 0.6s ease-out forwards;
  }
  
  .judgment.perfect {
    color: #ffd700;
    text-shadow: 0 0 10px #ffd700, 0 0 20px #ffd700;
  }
  
  .judgment.great {
    color: #4ecdc4;
    text-shadow: 0 0 10px #4ecdc4, 0 0 15px #4ecdc4;
  }
  
  .judgment.good {
    color: #ffe66d;
    text-shadow: 0 0 10px #ffe66d;
  }
  
  .judgment.bad {
    color: #ff6b6b;
    text-shadow: 0 0 10px #ff6b6b;
  }
  
  .judgment.miss {
    color: #888;
    text-shadow: 0 0 10px #888;
  }
  
  /* 移除难度变化通知样式 */
  
  @keyframes judgmentFloat {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -100%) scale(1.2);
      opacity: 0;
    }
  }
  
  .touch-areas {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 180px;
    display: flex;
    z-index: 5;
  }
  
  .touch-area {
    height: 100%;
    position: relative;
    cursor: pointer;
    transition: background-color 0.1s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  /* 移除:active伪类，使用JS控制反馈以支持多点触控 */
  .touch-feedback {
    position: absolute;
    width: 100%;
    height: 100%;
    background: var(--accent-color);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.1s ease;
  }
  
  /* 增强触摸区域的样式，使其更易于识别 */
  .touch-area {
    transition: background-color 0.1s ease;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  
  .key-hint {
    position: absolute;
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--text-secondary);
    opacity: 0.7;
  }
  
  .pause-button {
    position: absolute;
    top: 140px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--surface-color);
    border: 2px solid var(--text-secondary);
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }
  
  .exit-game-button {
    position: absolute;
    top: 200px;
    right: 20px;
    background: transparent;
    border: 2px solid var(--judgment-miss);
    padding: 10px 20px;
    z-index: 20;
  }
  
  .exit-game-button:hover {
    background: rgba(255, 0, 0, 0.2);
  }
  
  .pause-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    z-index: 30;
  }
  
  .pause-text {
    font-size: 2.5rem;
    margin-bottom: 30px;
    color: var(--text-primary);
  }
  
  .resume-button,
  .exit-button {
    min-width: 200px;
    padding: 15px 30px;
    font-size: 1.1rem;
  }
  
  .exit-button {
    background: transparent;
    border: 2px solid var(--judgment-miss);
  }
  
  @media (max-width: 768px) {
    .game-info {
      padding: 15px;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    
    .game-stats {
      width: 100%;
      justify-content: space-between;
      gap: 10px;
    }
    
    .time-display {
      align-self: flex-end;
    }
    
    .game-area {
      margin-top: 150px;
      height: calc(100% - 150px);
    }
    
    .pause-button,
    .exit-game-button {
      top: 170px;
    }
    
    .exit-game-button {
      top: 230px;
    }
    
    .key-hint {
      font-size: 1.2rem;
    }
  }
</style>