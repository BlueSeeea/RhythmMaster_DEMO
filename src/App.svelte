<script>
  import { onMount, onDestroy } from 'svelte';
  import HomePage from './components/HomePage.svelte';
  import GamePage from './components/GamePage.svelte';
  import ScorePage from './components/ScorePage.svelte';
  import SettingsPage from './components/SettingsPage.svelte';
  import SimpleNoteTest from './components/SimpleNoteTest.svelte';
  import audioManager from './utils/audioManager';
  
  // 游戏状态管理
  let currentPage = 'home'; // home, game, score, settings, test
  let selectedSong = null;
  let selectedDifficulty = 'easy';
  let gameResults = null;
  // audioManager已从模块导入，不需要再次声明
  
  // 游戏配置 - 轨道数量固定为4条
  let gameConfig = {
    laneCount: 4,
    speed: 10,
    noteRadius: 20,
    audioEnabled: true,
    sfxEnabled: true,
    difficulty: 'easy'
  };
  
  // 生命周期钩子
  onMount(() => {
    // 使用导入的音频管理器实例
    
    // 检测浏览器是否支持Web Audio API
    if (!audioManager.isSupported) {
      console.warn('浏览器不支持Web Audio API，游戏体验可能受限');
    }
    
    // 监听键盘事件
    window.addEventListener('keydown', handleKeyDown);
    
    // 尝试恢复游戏配置
    const savedConfig = localStorage.getItem('rhythmMasterConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        gameConfig = { ...gameConfig, ...parsed };
        // 强制设置轨道数量为4条
        gameConfig.laneCount = 4;
      } catch (e) {
        console.error('加载配置失败:', e);
      }
    }
  });
  
  onDestroy(() => {
    // 清理事件监听器
    window.removeEventListener('keydown', handleKeyDown);
    
    // 保存游戏配置
    localStorage.setItem('rhythmMasterConfig', JSON.stringify(gameConfig));
    
    // 清理音频管理器
    if (audioManager) {
      audioManager.cleanup();
    }
  });
  
  // 页面导航函数
  function navigateTo(page) {
    currentPage = page;
  }
  
  // 开始游戏
  function startGame(song, difficulty) {
    selectedSong = song;
    selectedDifficulty = difficulty;
    gameConfig.difficulty = difficulty;
    gameResults = null;
    navigateTo('game');
  }
  
  // 处理游戏结束
  function handleGameEnd(results) {
    gameResults = results;
    navigateTo('score');
  }
  
  // 更新游戏配置
  function updateGameConfig(newConfig) {
    // 创建新配置，但强制设置轨道数量为4条
    gameConfig = { ...gameConfig, ...newConfig, laneCount: 4 };
    localStorage.setItem('rhythmMasterConfig', JSON.stringify(gameConfig));
    
    // 更新音频设置
    if (audioManager) {
      audioManager.setVolume(newConfig.audioVolume || 1);
      audioManager.setSfxEnabled(newConfig.sfxEnabled);
    }
  }
  
  // 键盘事件处理
  function handleKeyDown(event) {
    // ESC键返回主页
    if (event.key === 'Escape' && currentPage !== 'home') {
      if (currentPage === 'game') {
        // 确认退出游戏
        if (confirm('确定要退出游戏吗？当前进度将会丢失。')) {
          navigateTo('home');
        }
      } else {
        navigateTo('home');
      }
    }
    
    // 按T键进入测试页面
    if (event.key === 't' && event.ctrlKey) {
      navigateTo('test');
    }
  }
</script>

<div class="app-container">
  {#if currentPage === 'home'}
    <HomePage 
      on:startGame={({ detail: { song, difficulty } }) => startGame(song, difficulty)} 
      on:settings={() => navigateTo('settings')}
      gameConfig={gameConfig}
    />
  {:else if currentPage === 'game'}
    <GamePage 
      song={selectedSong}
      difficulty={selectedDifficulty}
      gameConfig={gameConfig}
      on:gameEnd={({ detail }) => handleGameEnd(detail)}
      on:exit={() => navigateTo('home')}
    />
  {:else if currentPage === 'score'}
    <ScorePage 
      results={gameResults}
      on:playAgain={() => startGame(selectedSong, selectedDifficulty)}
      on:backHome={() => navigateTo('home')}
    />
  {:else if currentPage === 'settings'}
    <SettingsPage 
      gameConfig={gameConfig}
      on:updateConfig={({ detail }) => updateGameConfig(detail)}
      on:back={() => navigateTo('home')}
    />
  {:else if currentPage === 'test'}
    <SimpleNoteTest />
  {/if}
</div>

<style>
  .app-container {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>