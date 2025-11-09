<script>
  // 最简单的音符显示测试页面
  // 直接在组件中定义音符数据，确保立即可见
  let notes = [];
  const laneCount = 4;
  
  // 初始化函数 - 生成立即可见的音符
  function init() {
    // 为每个轨道生成2个音符，分布在不同位置
    for (let i = 0; i < laneCount; i++) {
      for (let j = 0; j < 2; j++) {
        notes.push({
          id: `note_${i}_${j}`,
          lane: i,
          position: 100 + j * 200,
          color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'][i % 4]
        });
      }
    }
    console.log('简单测试页面 - 音符初始化完成:', notes.length, '个音符');
  }
  
  // 组件挂载时初始化
  init();
</script>

<div class="simple-test-container" style="width: 100%; height: 100vh; background-color: #111; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; color: white;">
  <h1 style="color: white; margin-bottom: 20px;">音符显示简单测试</h1>
  <p style="margin-bottom: 30px; color: #aaa;">这是一个非常简单的页面，只用于测试音符渲染功能。如果您看到彩色圆形，表示音符渲染正常。</p>
  
  <!-- 游戏区域容器 -->
  <div style="position: relative; width: 100%; max-width: 800px; height: 500px; background-color: #222; border: 2px solid #555;">
    <!-- 轨道背景 -->
    <div style="display: flex; width: 100%; height: 100%;">
      {#each Array(laneCount) as _, i}
        <div style="flex: 1; border-right: 1px solid #555; position: relative;">
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 30px; background-color: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center;">
            轨道 {i+1}
          </div>
        </div>
      {/each}
    </div>
    
    <!-- 音符显示 - 使用内联样式确保可见性 -->
    {#each notes as note}
      <div 
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
      >
        {note.lane + 1}
      </div>
    {/each}
    
    <!-- 调试信息 -->
    <div style="position: absolute; top: 10px; right: 10px; background-color: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px;">
      <p style="margin: 0; font-size: 12px;">音符数量: {notes.length}</p>
    </div>
  </div>
  
  <!-- 页面信息 -->
  <div style="margin-top: 20px; text-align: center;">
    <p style="color: yellow; font-weight: bold;">如果您看到彩色圆形在轨道中显示，表示音符渲染功能正常工作。</p>
    <p style="color: #aaa; font-size: 14px; margin-top: 10px;">此页面使用最简单的HTML结构和内联样式，应该能够直接显示音符。</p>
  </div>
</div>

<style global>
  /* 全局样式重置 */
  body {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  
  * {
    box-sizing: border-box;
  }
</style>