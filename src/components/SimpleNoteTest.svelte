<script>
  import { onMount } from 'svelte';
  
  // 最简单的音符显示测试页面
  // 直接在组件中定义音符数据，确保立即可见
  let notes = [];
  const laneCount = 4;
  const laneColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
  
  // 初始化函数 - 生成立即可见的音符
  function generateNotes() {
    const newNotes = [];
    
    // 为每个轨道生成2个音符，分布在不同位置
    for (let i = 0; i < laneCount; i++) {
      for (let j = 0; j < 2; j++) {
        newNotes.push({
          id: `note_${i}_${j}`,
          lane: i,
          position: 100 + j * 200,
          color: laneColors[i % laneColors.length]
        });
      }
    }
    
    return newNotes;
  }
  
  // 使用onMount钩子在组件挂载时初始化，符合Svelte最佳实践
  onMount(() => {
    notes = generateNotes();
    console.log('简单测试页面 - 音符初始化完成:', notes.length, '个音符');
  });
</script>

<div class="simple-test-container">
  <h1 class="test-title">音符显示简单测试</h1>
  <p class="test-description">这是一个非常简单的页面，只用于测试音符渲染功能。如果您看到彩色圆形，表示音符渲染正常。</p>
  
  <!-- 游戏区域容器 -->
  <div class="game-area-container">
    <!-- 轨道背景 -->
    <div class="lanes-container">
      {#each Array(laneCount) as _, i}
        <div class="lane">
          <div class="lane-header">
            轨道 {i+1}
          </div>
        </div>
      {/each}
    </div>
    
    <!-- 音符显示 -->
    <!-- 使用keyed each块提高渲染性能 -->
    {#each notes as note (note.id)}
      <div 
        class="note"
        style={`
          position: absolute;
          left: ${(note.lane + 0.5) * (100 / laneCount)}%;
          top: ${note.position}px;
          width: 60px;
          height: 60px;
          background-color: ${note.color};
          border: 3px solid white;
          border-radius: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          color: black;
          font-weight: bold;
          font-size: 18px;
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
          opacity: 1;
          visibility: visible;
        `}
        aria-label={`轨道${note.lane + 1}的音符`}
      >
        {note.lane + 1}
      </div>
    {/each}
    
    <!-- 调试信息 -->
    <div class="debug-info">
      <p style="margin: 0;">音符数量: {notes.length}</p>
    </div>
  </div>
  
  <!-- 页面信息 -->
  <div style="margin-top: 20px; text-align: center;">
    <p class="success-message">如果您看到彩色圆形在轨道中显示，表示音符渲染功能正常工作。</p>
    <p class="additional-info">此页面使用优化的CSS类和Svelte最佳实践，提供更好的渲染性能和可维护性。</p>
  </div>
</div>

<style global>
  /* 全局样式重置 */
  * {
    box-sizing: border-box;
  }
  
  /* 确保应用默认字体 */
  :root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }
  
  /* 组件特定样式 */
  .simple-test-container {
    width: 100%;
    height: 100vh;
    background-color: #111;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: white;
  }
  
  .test-title {
    color: white;
    margin-bottom: 20px;
  }
  
  .test-description {
    margin-bottom: 30px;
    color: #aaa;
  }
  
  .game-area-container {
    position: relative;
    width: 100%;
    max-width: 800px;
    height: 500px;
    background-color: #222;
    border: 2px solid #555;
  }
  
  .lanes-container {
    display: flex;
    width: 100%;
    height: 100%;
  }
  
  .lane {
    flex: 1;
    border-right: 1px solid #555;
    position: relative;
  }
  
  .lane:last-child {
    border-right: none;
  }
  
  .lane-header {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 30px;
    background-color: rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }
  
  .note {
    transition: transform 0.1s ease;
  }
  
  .note:hover {
    transform: translateX(-50%) scale(1.05);
  }
  
  .debug-info {
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: rgba(0,0,0,0.7);
    padding: 10px;
    border-radius: 5px;
    font-size: 12px;
  }
  
  .success-message {
    color: yellow;
    font-weight: bold;
    margin-bottom: 10px;
  }
  
  .additional-info {
    color: #aaa;
    font-size: 14px;
  }
</style>