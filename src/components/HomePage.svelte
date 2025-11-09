<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { songs } from '../utils/songsData';
  
  // 创建事件分发器
  const dispatch = createEventDispatcher();
  
  export let gameConfig;
  
  // 使用导入的歌曲数据
  let songList = songs;
  
  // 确保安全访问第一个歌曲
  let selectedSong = songList.length > 0 ? songList[0] : null;
  let selectedDifficulty = 'easy';
  let showDifficultySelect = false;
  
  // 动画效果
  let isVisible = false;
  
  onMount(() => {
    // 添加入场动画
    setTimeout(() => {
      isVisible = true;
    }, 100);
  });
  
  // 选择歌曲
  function handleSongSelect(song) {
    selectedSong = song;
    showDifficultySelect = true;
  }
  
  // 选择难度并开始游戏
  function handleDifficultySelect(difficulty) {
    selectedDifficulty = difficulty;
    // 触发开始游戏事件
    dispatch('startGame', { song: selectedSong, difficulty });
  }
  
  // 返回歌曲选择
  function backToSongSelect() {
    showDifficultySelect = false;
  }
  
  // 计算难度星星显示
  function getDifficultyStars(level) {
    return '★'.repeat(Math.min(level, 10));
  }
</script>

<div class={`home-container ${isVisible ? 'fade-in' : ''}`}>
  <header class="game-header">
    <h1 class="game-title">节奏大师</h1>
    <h2 class="game-subtitle">Rhythm Master</h2>
  </header>
  
  {#if !showDifficultySelect}
    <section class="song-selection">
      <h3 class="section-title">选择歌曲</h3>
      <div class="songs-grid">
        {#each songList as song}
          <div 
            class={`song-card ${selectedSong.id === song.id ? 'selected' : ''}`}
            on:click={() => handleSongSelect(song)}
          >
            <div class="song-cover">
              <!-- 歌曲封面将通过CSS或SVG实现 -->
              <div class="cover-placeholder">{song.title ? song.title.charAt(0) : '?'}</div>
            </div>
            <div class="song-info">
              <h4 class="song-title">{song.title}</h4>
              <p class="song-artist">{song.artist}</p>
              <div class="song-difficulty">
                <span class="difficulty-label">难度范围:</span>
                <span class="difficulty-stars">
                  {song.difficulty.easy ? getDifficultyStars(3) : 'N/A'} ~ {song.difficulty.expert ? getDifficultyStars(6) : song.difficulty.hard ? getDifficultyStars(5) : song.difficulty.normal ? getDifficultyStars(4) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <section class="difficulty-selection">
      <button class="back-button" on:click={backToSongSelect}>← 返回歌曲选择</button>
      <h3 class="section-title">选择难度 - {selectedSong.title}</h3>
      <div class="difficulty-options">
        {#each ['easy', 'normal', 'hard'] as difficulty}
          {#if selectedSong.difficulty[difficulty]}
          <button
            class={`difficulty-button ${difficulty}`}
            on:click={() => handleDifficultySelect(difficulty)}
          >
            <div class="difficulty-header">
              <span class="difficulty-name">
                {difficulty === 'easy' ? '简单' : difficulty === 'normal' ? '中等' : difficulty === 'hard' ? '困难' : '专家'}
              </span>
              <span class="difficulty-level">{getDifficultyStars(difficulty === 'easy' ? 3 : difficulty === 'normal' ? 4 : difficulty === 'hard' ? 5 : 6)}</span>
            </div>
            <div class="difficulty-info">
              <span>音符数量: {selectedSong.notes[difficulty] ? selectedSong.notes[difficulty].length : 'N/A'}</span>
            </div>
          </button>
          {/if}
        {/each}
      </div>
    </section>
  {/if}
  
  <footer class="home-footer">
    <button class="settings-button" on:click={() => dispatch('settings')}>设置</button>
    <p class="copyright">© 2024 节奏大师 - Rhythm Master</p>
  </footer>
</div>

<style>
  .home-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    opacity: 0;
    transition: opacity 0.8s ease;
  }
  
  .game-header {
    text-align: center;
    margin-bottom: 40px;
  }
  
  .game-title {
    font-size: 4rem;
    font-weight: 900;
    background: linear-gradient(135deg, var(--accent-color), var(--secondary-color));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 10px;
    text-shadow: 0 0 30px rgba(122, 0, 255, 0.3);
  }
  
  .game-subtitle {
    font-size: 1.5rem;
    color: var(--text-secondary);
    font-weight: 300;
  }
  
  .section-title {
    font-size: 2rem;
    margin-bottom: 30px;
    color: var(--text-primary);
    text-align: center;
  }
  
  .song-selection {
    width: 100%;
    max-width: 900px;
  }
  
  .songs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }
  
  .song-card {
    background: var(--surface-color);
    border-radius: 16px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .song-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 48px rgba(122, 0, 255, 0.2);
    border-color: var(--primary-color);
  }
  
  .song-card.selected {
    border-color: var(--accent-color);
    box-shadow: 0 0 30px rgba(255, 0, 170, 0.3);
  }
  
  .song-cover {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    margin-bottom: 15px;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  }
  
  .cover-placeholder {
    font-size: 3rem;
    font-weight: bold;
    color: white;
  }
  
  .song-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 5px;
    color: var(--text-primary);
  }
  
  .song-artist {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 10px;
  }
  
  .song-difficulty {
    font-size: 0.8rem;
    color: var(--secondary-color);
  }
  
  .difficulty-stars {
    color: var(--accent-color);
  }
  
  .difficulty-selection {
    width: 100%;
    max-width: 600px;
    text-align: center;
  }
  
  .back-button {
    position: absolute;
    top: 20px;
    left: 20px;
    background: transparent;
    border: 1px solid var(--text-secondary);
    padding: 8px 16px;
    font-size: 0.9rem;
  }
  
  .difficulty-options {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .difficulty-button {
    width: 100%;
    text-align: left;
    padding: 20px;
    border-radius: 12px;
    transition: all 0.3s ease;
    background: var(--surface-color);
    border: 2px solid transparent;
  }
  
  .difficulty-button.easy:hover {
    border-color: var(--judgment-perfect);
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
  }
  
  .difficulty-button.medium:hover {
    border-color: var(--judgment-great);
    box-shadow: 0 0 20px rgba(0, 191, 255, 0.3);
  }
  
  .difficulty-button.hard:hover {
    border-color: var(--judgment-bad);
    box-shadow: 0 0 20px rgba(255, 136, 0, 0.3);
  }
  
  .difficulty-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .difficulty-name {
    font-size: 1.2rem;
    font-weight: 600;
  }
  
  .difficulty-level {
    color: var(--accent-color);
    font-size: 1rem;
  }
  
  .difficulty-info {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .home-footer {
    position: absolute;
    bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
  }
  
  .settings-button {
    background: transparent;
    border: 1px solid var(--text-secondary);
    padding: 10px 20px;
    font-size: 0.9rem;
  }
  
  .copyright {
    font-size: 0.8rem;
    color: var(--text-secondary);
    opacity: 0.7;
  }
  
  @media (max-width: 768px) {
    .game-title {
      font-size: 3rem;
    }
    
    .game-subtitle {
      font-size: 1.2rem;
    }
    
    .section-title {
      font-size: 1.5rem;
    }
    
    .songs-grid {
      grid-template-columns: 1fr;
    }
    
    .song-cover {
      width: 100px;
      height: 100px;
    }
    
    .cover-placeholder {
      font-size: 2.5rem;
    }
  }
</style>