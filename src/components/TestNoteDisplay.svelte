<script>
  // 简单的音符显示测试组件
  export let laneCount = 4;
  
  // 直接定义测试音符数据
  let notes = [];
  
  // 初始化函数
  function initNotes() {
    notes = [];
    // 为每个轨道生成2个音符，分布在不同位置
    for (let i = 0; i < laneCount; i++) {
      for (let j = 0; j < 2; j++) {
        notes.push({
          id: `test_note_${i}_${j}`,
          lane: i,
          position: 100 + j * 200,
          color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'][i % 4]
        });
      }
    }
    console.log('测试音符初始化完成，数量:', notes.length);
  }
  
  // 组件挂载时初始化
  initNotes();
</script>

<div class="test-note-container">
  <h3>音符显示测试</h3>
  <div class="test-game-area" style="position: relative; width: 100%; height: 500px; background-color: #222; border: 2px solid white;">
    <!-- 轨道背景 -->
    <div class="test-lanes" style="display: flex; width: 100%; height: 100%;">
      {#each Array(laneCount) as _, i}
        <div class="test-lane" style="flex: 1; border-right: 1px solid #555;"></div>
      {/each}
    </div>
    
    <!-- 测试音符 -->
    {#each notes as note}
      <div 
        class="test-note"
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
        `}
      >
        {note.lane + 1}
      </div>
    {/each}
  </div>
  
  <p>如果您看到彩色圆形在轨道中显示，表示音符渲染功能正常工作。</p>
</div>

<style>
  .test-note-container {
    padding: 20px;
    color: white;
  }
  
  h3 {
    color: white;
    margin-bottom: 20px;
  }
</style>