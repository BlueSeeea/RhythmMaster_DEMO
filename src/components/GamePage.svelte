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
  const NOTE_GENERATION_INTERVAL = 400; // 音符生成间隔
  const NOTE_SPACING = 200; // 音符间距
  const MAX_NOTES_PER_GENERATION = 2; // 每次生成的最大音符数 - 降低以减少卡顿
  const MAX_NOTES_ON_LANE = 3; // 同一轨道最多音符数
  const INITIAL_NOTES_COUNT = 5; // 初始生成的音符数量 - 减少以提高启动性能
  
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
    // 配置已导入的音频管理器
    if (gameConfig.audioEnabled) {
      audioManager.setBGMVolume(0.8);
    }
    if (gameConfig.sfxEnabled) {
      audioManager.setSFXVolume(0.8);
    }
    
    // 生成游戏音符数据
    generateNotes();
    
    // 等待DOM更新后初始化游戏尺寸
    await tick();
    initializeGameDimensions();
    
    // 添加全局键盘事件监听器
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // 开始游戏
    startGame();
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
  
  // 生成音符 - 优化版本
  function generateNotes() {
    notes = [];
    
    // 基于时间生成音符，确保每个音符都有createdAt属性
    const now = performance.now();
    let noteId = 0;
    
    // 跟踪每个轨道上的音符数量
    const laneNoteCount = new Array(laneCount).fill(0);
    
    // 生成初始音符 - 减少初始音符数量以提高启动性能
    const noteCount = INITIAL_NOTES_COUNT;
    
    for (let i = 0; i < noteCount; i++) {
      // 尝试找到一个符合限制的轨道（每行最多3个音符）
      let lane;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        lane = Math.floor(Math.random() * laneCount);
        if (laneNoteCount[lane] < MAX_NOTES_ON_LANE) {
          break;
        }
        attempts++;
      }
      
      // 增加该轨道的音符计数
      laneNoteCount[lane]++;
      
      // 从对象池获取音符或创建新音符
      let note = getNoteFromPool();
      
      if (!note) {
        // 如果对象池为空，创建新对象
        note = {
          id: `note_${noteId++}`,
          lane: lane,
          position: -noteRadius * 2,
          createdAt: now + i * 500,
          hit: false,
          judgment: null,
          _pool: false
        };
      } else {
        // 重用对象，更新属性
        note.id = `note_${noteId++}`;
        note.lane = lane;
        note.position = -noteRadius * 2;
        note.createdAt = now + i * 500;
      }
      
      notes.push(note);
    }
  }
  
  // 对象池优化 - 减少对象创建和垃圾回收
  let noteObjectPool = [];
  const MAX_POOL_SIZE = 50;
  
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
  
  // 开始游戏 - 优化版本，减少启动时的性能开销
  async function startGame() {
    // 初始化游戏状态
    lastStatusUpdate = 0;
    judgmentDisplay = [];
    
    // 延迟生成初始音符，先让界面渲染完成
    setTimeout(() => {
      if (isPlaying) { // 确保游戏仍然在进行中
        generateNotes();
      }
    }, 100); // 100ms延迟，给浏览器时间渲染UI
    
    // 初始化音频系统（异步但不阻塞游戏启动）
    if (gameConfig.audioEnabled) {
      loadAndPlayAudio().catch(error => {
        console.warn('音频加载失败，继续无音频模式:', error);
      });
    }
    
    // 设置开始时间，使用performance.now()获得更高精度
    startTime = performance.now();
    lastTime = startTime;
    
    // 开始游戏循环
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
      throw error;
    }
    isPlaying = true;
    gameLoop();
  }
  
  // 游戏主循环 - 优化版本，减少不必要的计算
  function gameLoop() {
    if (!isPlaying || isPaused) return;
    
    const currentTime = performance.now(); // 使用更精确的performance.now()
    const deltaTime = currentTime - lastTime;
    gameTime = currentTime - startTime;
    
    // 限制帧率，避免在性能较差设备上过度消耗资源
    if (deltaTime < 16) { // 约60FPS
      animationFrameId = requestAnimationFrame(gameLoop);
      return;
    }
    
    // 只在必要时更新游戏状态
    const updateInterval = 30; // 每30ms更新一次游戏状态
    if (deltaTime >= updateInterval) {
      // 更新音符位置
      updateNotes(deltaTime);
      
      // 检查错过的音符和清理旧音符合并处理，减少遍历次数
      checkMissedAndCleanupNotes();
      
      // 动态生成新音符，确保音符持续出现（减少调用频率）
      if (Math.random() > 0.3) { // 70%的概率生成新音符，减少调用频率
        if (notes.length < 15) { // 进一步减少最大音符数量
          generateAdditionalNotes(currentTime);
        }
      }
      
      // 更新游戏状态 - 减少更新频率
      if (currentTime - lastStatusUpdate >= 100) { // 每100ms更新一次状态
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
    
    // 请求下一帧
    animationFrameId = requestAnimationFrame(gameLoop);
  }
  
  let lastStatusUpdate = 0; // 用于限制状态更新频率
  
  // 合并检查错过的音符和清理旧音符，减少遍历次数 - 优化版本
  function checkMissedAndCleanupNotes() {
    if (!gameArea) return;
    
    const missThreshold = judgmentLinePosition + 150;
    const cleanupThreshold = gameArea.offsetHeight + 100;
    
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
  
  // 动态生成额外的音符 - 优化版本，确保每行最多3个音符
  let nextNoteId = 1000; // 避免ID冲突
  let lastNoteGenTime = 0;
  
  function generateAdditionalNotes(currentTime) {
    // 使用固定的生成间隔
    if (currentTime - lastNoteGenTime < NOTE_GENERATION_INTERVAL) return;
    
    // 限制活跃音符数量，避免过度生成
    const activeNotes = notes.filter(note => !note.hit);
    if (activeNotes.length >= 15) return; // 减少最大活跃音符数
    
    // 随机决定是否生成音符 - 降低生成概率以减少音符数量
    if (Math.random() > 0.4) return;
    
    // 确保同一轨道上的音符数量限制（每行最多3个音符）
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
    
    // 确定生成数量 - 减少每次生成的音符数
    const noteCount = Math.floor(Math.random() * MAX_NOTES_PER_GENERATION) + 1;
    const adjustedNoteCount = Math.min(noteCount, availableLanes.length);
    
    const lanesThisTime = new Set();
    
    // 从可用轨道中随机选择
    while (lanesThisTime.size < adjustedNoteCount) {
      const randomIndex = Math.floor(Math.random() * availableLanes.length);
      lanesThisTime.add(availableLanes[randomIndex]);
    }
    
    // 从对象池获取音符或创建新音符
    lanesThisTime.forEach(lane => {
      let note = getNoteFromPool();
      
      if (!note) {
        // 如果对象池为空，创建新对象
        note = {
          id: `note_${nextNoteId++}`,
          lane: lane,
          position: -noteRadius * 2,
          createdAt: currentTime + 800,
          hit: false,
          judgment: null,
          _pool: false
        };
      } else {
        // 重用对象，更新属性
        note.id = `note_${nextNoteId++}`;
        note.lane = lane;
        note.position = -noteRadius * 2;
        note.createdAt = currentTime + 800;
      }
      
      notes.push(note);
    });
    
    lastNoteGenTime = currentTime;
  }
  
  // 移除难度变化相关功能，简化游戏逻辑
  
  // 已被checkMissedAndCleanupNotes替代
  
  // 更新音符位置 - 优化版本
  function updateNotes(deltaTime) {
    const currentTime = Date.now();
    
    // 计算基于deltaTime的移动距离，确保平滑滚动
    const basePositionDelta = (noteSpeed / 10) * (deltaTime / 16) * 3;
    
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
    if (!isPlaying || isPaused || !gameArea) return;
    
    // 找到该轨道上未击中且在合理范围内的音符
    const currentTime = Date.now();
    const laneNotes = notes.filter(
      note => note.lane === lane && note.createdAt && !note.hit && 
             currentTime >= note.createdAt && // 只考虑已经创建的音符
             Math.abs(note.position - judgmentLinePosition) < hitRange // 只考虑在判定范围内的音符
    );
    
    if (laneNotes.length === 0) {
      // 如果没有可击中的音符，不做处理，避免错误的miss判定
      return;
    }
    
    // 按位置排序，找到最接近判定线的音符
    laneNotes.sort((a, b) => 
      Math.abs(a.position - judgmentLinePosition) - 
      Math.abs(b.position - judgmentLinePosition)
    );
    const targetNote = laneNotes[0];
    
    const distance = Math.abs(targetNote.position - judgmentLinePosition);
    
    // 改进的判定逻辑，确保在范围内的音符都能得到正确判定
    const judgment = calculateJudgment(distance);
    registerHit(targetNote, judgment);
    
    // 播放击中音效
    if (audioManager && gameConfig.sfxEnabled) {
      // 根据判定类型播放不同音效
      const soundName = judgment === 'miss' ? 'miss' : `hit_${judgment}`;
      audioManager.playSoundEffect(soundName);
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
      opacity: 1
    });
    
    // 使用requestAnimationFrame执行动画，避免阻塞主线程
    requestAnimationFrame(() => {
      // 淡入淡出动画
      let opacity = 1;
      const fadeInterval = setInterval(() => {
        opacity -= 0.1;
        
        const index = judgmentDisplay.findIndex(j => j.id === judgmentId);
        if (index !== -1) {
          judgmentDisplay[index].opacity = opacity;
          
          if (opacity <= 0) {
            // 一次性移除，减少响应式更新次数
            judgmentDisplay = judgmentDisplay.filter(j => j.id !== judgmentId);
            clearInterval(fadeInterval);
          }
        } else {
          clearInterval(fadeInterval);
        }
      }, 60);
    });
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
  
  // 处理轨道触摸 - 修复参数类型错误，统一调用handleNoteHit
  function handleLaneTouch(laneIndex) {
    if (!isPlaying || isPaused) return;
    
    // 直接调用handleNoteHit，传入轨道索引而不是音符对象
    // 这样可以复用同一个判定逻辑，避免重复代码和参数不匹配的问题
    handleNoteHit(laneIndex);
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
    
    <!-- 触摸区域 -->
    <div class="touch-areas">
      {#each Array(laneCount) as _, i}
        <div 
          class="touch-area" 
          style="width: calc(100% / {laneCount});"
          on:click={() => handleLaneTouch(i)}
            on:keydown={(e) => handleTouchKeyDown(e, i)}
          role="button" 
          aria-label={`轨道${i + 1}触摸区域`}
          tabindex="0"
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
    height: 100px;
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
  }
  
  .touch-area:active {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .touch-feedback {
    position: absolute;
    width: 100%;
    height: 100%;
    background: var(--accent-color);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.1s ease;
  }
  
  .touch-area:active .touch-feedback {
    opacity: 0.3;
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