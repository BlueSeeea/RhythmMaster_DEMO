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
  
  // 游戏区域引用
  let gameContainer;
  let gameArea;
  let judgmentLine;
  
  // 游戏配置
  const laneCount = gameConfig.laneCount || 4;
  const noteSpeed = gameConfig.speed || 10;
  const noteRadius = gameConfig.noteRadius || 20;
  
  // 判定阈值（毫秒）
  const judgmentThresholds = {
    perfect: 50,
    great: 100,
    good: 150,
    bad: 200
  };
  
  // 分数计算配置
  const scoreValues = {
    perfect: 1000,
    great: 700,
    good: 400,
    bad: 100,
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
    // 停止背景音乐
    audioManager.stopBGM();
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
    const judgmentLineY = gameArea.offsetHeight * 0.8;
    judgmentLine.style.top = judgmentLineY + 'px';
  }
  
  // 生成音符数据
  function generateNotes() {
    notes = [];
    const noteCount = song.difficulty[difficulty].notes;
    const beatInterval = 1000; // 每1秒一个节拍（示例值）
    
    for (let i = 0; i < noteCount; i++) {
      const lane = Math.floor(Math.random() * laneCount);
      const timing = (i + 1) * beatInterval;
      
      notes.push({
        id: i,
        lane,
        timing,
        hit: false,
        judgment: null,
        position: 0,
        createdAt: null
      });
    }
  }
  
  // 开始游戏
  function startGame() {
    // 模拟音频加载
    simulateAudioPlayback();
    
    // 设置开始时间
    startTime = Date.now();
    lastTime = startTime;
    
    // 开始游戏循环
    isPlaying = true;
    gameLoop();
  }
  
  // 模拟音频播放（实际项目中使用真实音频）
  function simulateAudioPlayback() {
    // 这里只是模拟，实际应该使用真实音频文件
    console.log('开始播放歌曲:', song.title);
  }
  
  // 游戏主循环
  function gameLoop() {
    if (!isPlaying || isPaused) return;
    
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    gameTime = currentTime - startTime;
    
    // 更新音符位置
    updateNotes(deltaTime);
    
    // 检查错过的音符
    checkMissedNotes();
    
    // 更新游戏状态
    updateGameStatus();
    
    // 检查游戏是否结束
    if (gameTime >= gameDuration * 1000) {
      endGame();
      return;
    }
    
    lastTime = currentTime;
    animationFrameId = requestAnimationFrame(gameLoop);
  }
  
  // 更新音符位置
  function updateNotes(deltaTime) {
    const gameAreaHeight = gameArea.offsetHeight;
    const spawnTime = 2000; // 音符从生成到判定线的时间
    
    // 激活应该出现的音符
    notes.forEach(note => {
      if (!note.createdAt && gameTime >= note.timing - spawnTime) {
        note.createdAt = gameTime;
      }
      
      if (note.createdAt && !note.hit) {
        // 计算音符位置
        const elapsedTime = gameTime - note.createdAt;
        note.position = (elapsedTime / spawnTime) * gameAreaHeight;
      }
    });
  }
  
  // 检查错过的音符
  function checkMissedNotes() {
    const judgmentLineY = gameArea.offsetHeight * 0.8;
    const missThreshold = judgmentLineY + 50;
    
    notes.forEach(note => {
      if (note.createdAt && !note.hit && note.position > missThreshold) {
        handleMiss(note);
      }
    });
  }
  
  // 处理音符点击
  function handleNoteHit(lane) {
    if (!isPlaying || isPaused) return;
    
    // 找到该轨道上最接近判定线的未击中音符
    const judgmentLineY = gameArea.offsetHeight * 0.8;
    const laneNotes = notes.filter(
      note => note.lane === lane && note.createdAt && !note.hit
    );
    
    if (laneNotes.length === 0) return;
    
    // 按位置排序，找到最接近判定线的音符
    laneNotes.sort((a, b) => Math.abs(a.position - judgmentLineY) - Math.abs(b.position - judgmentLineY));
    const targetNote = laneNotes[0];
    
    const distance = Math.abs(targetNote.position - judgmentLineY);
    
    // 判断是否在可击中范围内
    if (distance < judgmentThresholds.bad + 50) {
      const judgment = calculateJudgment(distance);
      registerHit(targetNote, judgment);
      
      // 播放击中音效
      if (audioManager) {
        // 根据判定类型播放不同音效
        const soundName = `hit_${judgment}`;
        audioManager.playSoundEffect(soundName);
      }
    }
  }
  
  // 计算判定结果
  function calculateJudgment(distance) {
    if (distance <= judgmentThresholds.perfect) return 'perfect';
    if (distance <= judgmentThresholds.great) return 'great';
    if (distance <= judgmentThresholds.good) return 'good';
    if (distance <= judgmentThresholds.bad) return 'bad';
    return 'miss';
  }
  
  // 注册击中
  function registerHit(note, judgment) {
    note.hit = true;
    note.judgment = judgment;
    
    // 更新判定统计
    judgments[judgment]++;
    
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
  
  // 显示判定结果
  function showJudgment(judgment, lane) {
    const judgmentLineY = gameArea.offsetHeight * 0.8;
    const laneWidth = gameArea.offsetWidth / laneCount;
    const x = lane * laneWidth + laneWidth / 2;
    const y = judgmentLineY;
    
    // 创建判定结果元素
    const judgmentEl = document.createElement('div');
    judgmentEl.className = `judgment ${judgment}`;
    judgmentEl.textContent = judgment === 'perfect' ? 'PERFECT!' :
                          judgment === 'great' ? 'GREAT!' :
                          judgment === 'good' ? 'GOOD' :
                          judgment === 'bad' ? 'BAD' : 'MISS';
    judgmentEl.style.left = `${x}px`;
    judgmentEl.style.top = `${y}px`;
    judgmentEl.style.transform = 'translate(-50%, -50%)';
    
    gameArea.appendChild(judgmentEl);
    
    // 动画结束后移除
    setTimeout(() => {
      if (gameArea.contains(judgmentEl)) {
        gameArea.removeChild(judgmentEl);
      }
    }, 600);
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
  
  // 结束游戏
  function endGame() {
    stopGame();
    
    // 计算最终准确率
    const totalNotes = Object.values(judgments).reduce((sum, count) => sum + count, 0);
    if (totalNotes > 0) {
      const perfectNotes = judgments.perfect || 0;
      const greatNotes = judgments.great || 0;
      const goodNotes = judgments.good || 0;
      const accuracyScore = (perfectNotes * 3 + greatNotes * 2 + goodNotes * 1) / (totalNotes * 3) * 100;
      accuracy = Math.round(accuracyScore);
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
  
  // 处理触摸输入
  function handleLaneTouch(lane) {
    handleNoteHit(lane);
  }
  
  // 获取当前游戏时间格式
  function getFormattedTime(time) {
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
</script>

<div class="game-page" bind:this={gameContainer} on:keydown={handleKeyDown}>
  {#if isPaused}
    <div class="pause-overlay">
      <h2 class="pause-text">游戏暂停</h2>
      <button class="resume-button" on:click={togglePause}>继续游戏</button>
      <button class="exit-button" on:click={() => dispatch('exit')}>退出游戏</button>
    </div>
  {/if}
  
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
  <div class="game-area" bind:this={gameArea}>
    <!-- 轨道背景 --<div class="lanes-background">
      {#each Array(laneCount) as _, i}
        <div class="lane" style="width: {100 / laneCount}%"></div>
      {/each}
    </div>
    
    <!-- 判定线 -->
    <div class="judgment-line" bind:this={judgmentLine}>
      <div class="judgment-line-glow"></div>
    </div>
    >
    <!-- 音符 -->
    {#each notes as note}
      {#if note.createdAt && !note.hit}
        <div 
          class={`note lane-${note.lane} ${note.judgment ? note.judgment : ''}`}
          style={`
            left: ${(note.lane / laneCount) * 100}%;
            top: ${note.position}px;
            width: ${noteRadius * 2}px;
            height: ${noteRadius * 2}px;
          `}
        >
          <div class="note-inner"></div>
        </div>
      {/if}
    {/each}
    >
    <!-- 触摸区域 -->
    <div class="touch-areas">
      {#each Array(laneCount) as _, i}
        <div 
          class="touch-area" 
          style="width: {100 / laneCount}%"
          on:touchstart={() => handleLaneTouch(i)}
          on:click={() => handleLaneTouch(i)}
        >
          <div class="touch-feedback"></div>
          <span class="key-hint">
            {i === 0 ? 'D/1' : i === 1 ? 'F/2' : i === 2 ? 'J/3' : 'K/4'}
          </span>
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
    overflow: hidden;
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
    transform: translateY(-50%);
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
    box-shadow: 0 0 20px var(--note-color);
    z-index: 5;
    transition: all 0.1s ease;
  }
  
  .note-inner {
    width: 80%;
    height: 80%;
    background: white;
    border-radius: 50%;
    margin: 10%;
  }
  
  .note.perfect {
    background: var(--judgment-perfect);
    box-shadow: 0 0 20px var(--judgment-perfect);
    transform: translate(-50%, -50%) scale(1.2);
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