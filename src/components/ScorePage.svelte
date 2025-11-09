<script>
  import { onMount, createEventDispatcher } from 'svelte';
  
  // 创建事件分发器
  const dispatch = createEventDispatcher();
  
  export let results;
  
  let isNewHighScore = false;
  let totalJudgments = 0;
  let grade = 'F';
  let gradeColor = '#ff0000';
  
  onMount(() => {
    // 计算总判定数
    totalJudgments = Object.values(results.judgments || {}).reduce((a, b) => a + b, 0);
    
    // 检查是否为新的最高分
    checkHighScore();
    
    // 计算等级
    calculateGrade();
  });
  
  // 检查是否为新的最高分
  function checkHighScore() {
    try {
      const highScores = JSON.parse(localStorage.getItem('rhythmMasterHighScores') || '{}');
      const key = `${results.song.id}_${results.difficulty}`;
      isNewHighScore = highScores[key] === results.score;
    } catch (e) {
      console.error('检查最高分失败:', e);
    }
  }
  
  // 计算等级
  function calculateGrade() {
    const accuracy = results.accuracy || 0;
    const perfectRate = results.judgments ? (results.judgments.perfect / totalJudgments * 100) : 0;
    
    if (accuracy >= 98 && perfectRate >= 90) {
      grade = 'SSS';
      gradeColor = '#ffaa00';
    } else if (accuracy >= 95) {
      grade = 'SS';
      gradeColor = '#ff8800';
    } else if (accuracy >= 90) {
      grade = 'S';
      gradeColor = '#ff6600';
    } else if (accuracy >= 80) {
      grade = 'A';
      gradeColor = '#00ff88';
    } else if (accuracy >= 70) {
      grade = 'B';
      gradeColor = '#00bfff';
    } else if (accuracy >= 60) {
      grade = 'C';
      gradeColor = '#ffff00';
    } else if (accuracy >= 50) {
      grade = 'D';
      gradeColor = '#ff8800';
    } else {
      grade = 'F';
      gradeColor = '#ff0000';
    }
  }
  
  // 获取判定百分比
  function getJudgmentPercentage(type) {
    if (!results.judgments || totalJudgments === 0) return 0;
    return Math.round((results.judgments[type] / totalJudgments) * 100);
  }
  
  // 获取判定对应的颜色
  function getJudgmentColor(type) {
    const colors = {
      perfect: 'var(--judgment-perfect)',
      great: 'var(--judgment-great)',
      good: 'var(--judgment-good)',
      bad: 'var(--judgment-bad)',
      miss: 'var(--judgment-miss)'
    };
    return colors[type] || '#ffffff';
  }
  
  // 获取难度名称
  function getDifficultyName(difficulty) {
    const names = {
      easy: '简单',
      medium: '中等',
      hard: '困难'
    };
    return names[difficulty] || difficulty;
  }
  
  // 格式化大数字
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
</script>

<div class="score-page">
  <div class="score-container">
    <!-- 新纪录提示 -->
    {#if isNewHighScore}
      <div class="new-record-banner">
        <span class="new-record-text">🎉 新纪录！</span>
      </div>
    {/if}
    
    <!-- 分数卡片 -->
    <div class="score-card">
      <div class="grade-section">
        <div class="grade" style="color: {gradeColor}">{grade}</div>
        <div class="song-info">
          <h2 class="song-title">{results.song.title}</h2>
          <p class="song-details">{results.song.artist} · {getDifficultyName(results.difficulty)}</p>
        </div>
      </div>
      
      <div class="main-stats">
        <div class="stat-row">
          <div class="stat-item score">
            <span class="stat-label">总分</span>
            <span class="stat-value">{formatNumber(results.score)}</span>
          </div>
          <div class="stat-item accuracy">
            <span class="stat-label">准确率</span>
            <span class="stat-value">{results.accuracy}%</span>
          </div>
          <div class="stat-item combo">
            <span class="stat-label">最大连击</span>
            <span class="stat-value">{results.maxCombo}</span>
          </div>
        </div>
      </div>
      
      <!-- 判定统计 -->
      <div class="judgment-stats">
        <h3 class="section-title">判定统计</h3>
        <div class="judgment-list">
          {#each ['perfect', 'great', 'good', 'bad', 'miss'] as type}
            <div class="judgment-item">
              <div class="judgment-info">
                <span class="judgment-name" style="color: {getJudgmentColor(type)}">
                  {type === 'perfect' ? 'PERFECT' :
                   type === 'great' ? 'GREAT' :
                   type === 'good' ? 'GOOD' :
                   type === 'bad' ? 'BAD' : 'MISS'}
                </span>
                <span class="judgment-count">{results.judgments ? results.judgments[type] : 0}</span>
              </div>
              <div class="judgment-bar">
                <div 
                  class="judgment-fill" 
                  style="width: {getJudgmentPercentage(type)}%; background-color: {getJudgmentColor(type)}"
                ></div>
              </div>
              <span class="judgment-percentage">{getJudgmentPercentage(type)}%</span>
            </div>
          {/each}
        </div>
      </div>
      
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button class="play-again-button" on:click={() => dispatch('playAgain')}>
          再玩一次
        </button>
        <button class="back-home-button" on:click={() => dispatch('backHome')}>
          返回主页
        </button>
      </div>
    </div>
    
    <!-- 排名提示（可选） -->
    <div class="ranking-tip">
      <span>分享你的成绩，挑战全球玩家！</span>
    </div>
  </div>
</div>

<style>
  .score-page {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);
    padding: 20px;
  }
  
  .score-container {
    width: 100%;
    max-width: 800px;
    position: relative;
  }
  
  .new-record-banner {
    position: absolute;
    top: -50px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(45deg, #ffaa00, #ff6600);
    padding: 10px 30px;
    border-radius: 30px;
    box-shadow: 0 10px 30px rgba(255, 170, 0, 0.4);
    animation: glow 2s infinite;
    z-index: 10;
  }
  
  .new-record-text {
    font-size: 1.2rem;
    font-weight: bold;
    color: white;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }
  
  .score-card {
    background: var(--surface-color);
    border-radius: 20px;
    padding: 30px;
    box-shadow: 0 15px 60px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    animation: scaleIn 0.8s ease;
  }
  
  .grade-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .grade {
    font-size: 4rem;
    font-weight: 900;
    text-shadow: 0 0 30px currentColor;
    line-height: 1;
  }
  
  .song-info {
    text-align: right;
  }
  
  .song-title {
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 5px;
  }
  
  .song-details {
    font-size: 1rem;
    color: var(--text-secondary);
  }
  
  .main-stats {
    margin-bottom: 30px;
  }
  
  .stat-row {
    display: flex;
    justify-content: space-around;
    gap: 20px;
  }
  
  .stat-item {
    text-align: center;
    flex: 1;
  }
  
  .stat-label {
    display: block;
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 10px;
  }
  
  .stat-value {
    display: block;
    font-size: 2rem;
    font-weight: bold;
  }
  
  .stat-item.score .stat-value {
    color: var(--accent-color);
    text-shadow: 0 0 10px var(--accent-color);
  }
  
  .stat-item.accuracy .stat-value {
    color: var(--judgment-perfect);
    text-shadow: 0 0 10px var(--judgment-perfect);
  }
  
  .stat-item.combo .stat-value {
    color: var(--secondary-color);
    text-shadow: 0 0 10px var(--secondary-color);
  }
  
  .section-title {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 20px;
  }
  
  .judgment-stats {
    margin-bottom: 30px;
  }
  
  .judgment-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .judgment-item {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .judgment-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 150px;
  }
  
  .judgment-name {
    font-size: 1rem;
    font-weight: 600;
  }
  
  .judgment-count {
    font-size: 1rem;
    color: var(--text-secondary);
  }
  
  .judgment-bar {
    flex: 1;
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .judgment-fill {
    height: 100%;
    transition: width 1s ease-out;
  }
  
  .judgment-percentage {
    min-width: 40px;
    text-align: right;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .action-buttons {
    display: flex;
    gap: 20px;
    justify-content: center;
  }
  
  .play-again-button,
  .back-home-button {
    padding: 12px 30px;
    font-size: 1.1rem;
    font-weight: 600;
  }
  
  .back-home-button {
    background: transparent;
    border: 2px solid var(--text-secondary);
  }
  
  .back-home-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .ranking-tip {
    text-align: center;
    margin-top: 30px;
    font-size: 0.9rem;
    color: var(--text-secondary);
    opacity: 0.7;
  }
  
  @media (max-width: 768px) {
    .score-page {
      padding: 10px;
    }
    
    .new-record-banner {
      top: -40px;
      padding: 8px 20px;
    }
    
    .new-record-text {
      font-size: 1rem;
    }
    
    .score-card {
      padding: 20px;
    }
    
    .grade-section {
      flex-direction: column;
      text-align: center;
      gap: 20px;
    }
    
    .grade {
      font-size: 3rem;
    }
    
    .song-info {
      text-align: center;
    }
    
    .song-title {
      font-size: 1.5rem;
    }
    
    .stat-row {
      flex-direction: column;
      gap: 15px;
    }
    
    .stat-value {
      font-size: 1.5rem;
    }
    
    .judgment-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    
    .judgment-info {
      min-width: auto;
    }
    
    .action-buttons {
      flex-direction: column;
    }
    
    .play-again-button,
    .back-home-button {
      width: 100%;
    }
  }
</style>