<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  // 创建事件分发器
  const dispatch = createEventDispatcher();
  
  export let gameConfig;
  
  // 本地设置状态
  let settings = {
    audioEnabled: true,
    sfxEnabled: true,
    audioVolume: 0.8,
    sfxVolume: 0.8,
    laneCount: 4,
    speed: 10,
    noteRadius: 20,
    difficulty: 'easy',
    fullscreen: false,
    keyBindings: 'default'
  };
  
  // 动画状态
  let isVisible = false;
  
  onMount(() => {
    // 初始化设置
    settings = { ...settings, ...gameConfig };
    
    // 添加入场动画
    setTimeout(() => {
      isVisible = true;
    }, 100);
    
    // 检查全屏状态
    checkFullscreenStatus();
    
    // 监听全屏变化
    document.addEventListener('fullscreenchange', checkFullscreenStatus);
  });
  
  onDestroy(() => {
    // 移除事件监听器
    document.removeEventListener('fullscreenchange', checkFullscreenStatus);
  });
  
  // 检查全屏状态
  function checkFullscreenStatus() {
    settings.fullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || 
                          document.mozFullScreenElement || document.msFullscreenElement);
  }
  
  // 更新设置
  function updateSetting(key, value) {
    settings[key] = value;
    dispatch('updateConfig', settings);
  }
  
  // 切换全屏
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      // 进入全屏
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } else {
      // 退出全屏
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }
  
  // 重置所有设置
  function resetSettings() {
    if (confirm('确定要重置所有设置到默认值吗？')) {
      settings = {
        audioEnabled: true,
        sfxEnabled: true,
        audioVolume: 0.8,
        sfxVolume: 0.8,
        laneCount: 4,
        speed: 10,
        noteRadius: 20,
        difficulty: 'easy',
        fullscreen: settings.fullscreen,
        keyBindings: 'default'
      };
      dispatch('updateConfig', settings);
    }
  }
  
  // 预设难度配置
  function applyDifficultyPreset(preset) {
    let config = {};
    
    switch (preset) {
      case 'easy':
        config = {
          speed: 8,
          noteRadius: 25,
          laneCount: 4
        };
        break;
      case 'normal':
        config = {
          speed: 10,
          noteRadius: 20,
          laneCount: 4
        };
        break;
      case 'hard':
        config = {
          speed: 12,
          noteRadius: 18,
          laneCount: 4
        };
        break;
      case 'expert':
        config = {
          speed: 15,
          noteRadius: 15,
          laneCount: 6
        };
        break;
    }
    
    settings = { ...settings, ...config };
    dispatch('updateConfig', settings);
  }
</script>

<div class={`settings-page ${isVisible ? 'fade-in' : ''}`}>
  <header class="settings-header">
    <h1 class="settings-title">游戏设置</h1>
    <button class="back-button" on:click={() => dispatch('back')}>← 返回</button>
  </header>
  
  <div class="settings-container">
    <!-- 音频设置 -->
    <section class="settings-section">
      <h2 class="section-title">🔊 音频设置</h2>
      <div class="settings-group">
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              checked={settings.audioEnabled} 
              on:change={(e) => updateSetting('audioEnabled', e.target.checked)}
            />
            背景音乐
          </label>
        </div>
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              checked={settings.sfxEnabled} 
              on:change={(e) => updateSetting('sfxEnabled', e.target.checked)}
            />
            音效
          </label>
        </div>
        <div class="setting-item slider">
          <label class="setting-label">背景音乐音量</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            value={settings.audioVolume} 
            on:input={(e) => updateSetting('audioVolume', parseFloat(e.target.value))}
          />
          <span class="slider-value">{Math.round(settings.audioVolume * 100)}%</span>
        </div>
        <div class="setting-item slider">
          <label class="setting-label">音效音量</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            value={settings.sfxVolume} 
            on:input={(e) => updateSetting('sfxVolume', parseFloat(e.target.value))}
          />
          <span class="slider-value">{Math.round(settings.sfxVolume * 100)}%</span>
        </div>
      </div>
    </section>
    
    <!-- 游戏设置 -->
    <section class="settings-section">
      <h2 class="section-title">🎮 游戏设置</h2>
      <div class="settings-group">
        <div class="setting-item slider">
          <label class="setting-label">游戏速度 (音符下落速度)</label>
          <input 
            type="range" 
            min="5" 
            max="20" 
            step="1" 
            value={settings.speed} 
            on:input={(e) => updateSetting('speed', parseInt(e.target.value))}
          />
          <span class="slider-value">{settings.speed}</span>
        </div>
        <div class="setting-item slider">
          <label class="setting-label">音符大小</label>
          <input 
            type="range" 
            min="10" 
            max="30" 
            step="1" 
            value={settings.noteRadius} 
            on:input={(e) => updateSetting('noteRadius', parseInt(e.target.value))}
          />
          <span class="slider-value">{settings.noteRadius}</span>
        </div>
        <div class="setting-item select">
          <label class="setting-label">轨道数量</label>
          <select 
            value={settings.laneCount} 
            on:change={(e) => updateSetting('laneCount', parseInt(e.target.value))}
          >
            <option value="4">4轨道 (标准)</option>
            <option value="6">6轨道 (进阶)</option>
          </select>
        </div>
      </div>
    </section>
    
    <!-- 显示设置 --<section class="settings-section">
      <h2 class="section-title">🖥️ 显示设置</h2>
      <div class="settings-group">
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              checked={settings.fullscreen} 
              on:change={toggleFullscreen}
            />
            全屏模式
          <label/
        </div>
      </div>
    </section>
    
    <!-- 预设配置 --<section class="settings-section">
      <h2 class="section-title">⚙️ 预设配置</h2>
      <div class="preset-buttons">
        <button 
          class="preset-button" 
          on:click={() => applyDifficultyPreset('easy')}
        >简单模式 (慢速度)</button>
        <button 
          class="preset-button" 
          on:click={() => applyDifficultyPreset('normal')}
        >标准模式</button>
        <button 
          class="preset-button" 
          on:click={() => applyDifficultyPreset('hard')}
        >困难模式 (快速度)</button>
        <button 
          class="preset-button" 
          on:click={() => applyDifficultyPreset('expert')}
        >专家模式 (6轨道)</button>
      </div>
    </section>
    
    <!-- 重置设置 -->
    <section class="settings-section">
      <button class="reset-button" on:click={resetSettings}>
        🔄 重置所有设置
      </button>
    </section>
    
    <!-- 关于信息 -->
    <section class="settings-section about">
      <h2 class="section-title">📖 关于游戏</h2>
      <div class="about-info">
        <p>节奏大师 (Rhythm Master) v1.0.0</p>
        <p>一个有趣的音乐节奏游戏，考验你的反应速度和节奏感！</p>
        <p>© 2024 Rhythm Master Team</p>
      </div>
    </section>
  </div>
</div>

<style>
  .settings-page {
    width: 100%;
    height: 100%;
    padding: 20px;
    background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);
    overflow-y: auto;
    opacity: 0;
    transition: opacity 0.8s ease;
  }
  
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 30px;
    position: relative;
  }
  
  .settings-title {
    font-size: 2.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-color), var(--secondary-color));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .back-button {
    background: transparent;
    border: 1px solid var(--text-secondary);
    padding: 10px 20px;
    font-size: 1rem;
  }
  
  .settings-container {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .settings-section {
    background: var(--surface-color);
    border-radius: 16px;
    padding: 25px;
    margin-bottom: 25px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    animation: slideInUp 0.6s ease;
  }
  
  .section-title {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .setting-item {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .setting-item.slider {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
  }
  
  .setting-label {
    flex: 1;
    font-size: 1rem;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }
  
  .setting-label input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: var(--accent-color);
    cursor: pointer;
  }
  
  .setting-item input[type="range"] {
    flex: 2;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }
  
  .setting-item input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--accent-color);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 10px var(--accent-color);
  }
  
  .setting-item input[type="range"]::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--accent-color);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 10px var(--accent-color);
    border: none;
  }
  
  .slider-value {
    min-width: 40px;
    text-align: right;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .setting-item select {
    flex: 2;
    padding: 10px 15px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 1rem;
    cursor: pointer;
    outline: none;
  }
  
  .setting-item select:hover {
    border-color: var(--accent-color);
  }
  
  .setting-item select option {
    background: #1a1a3a;
    color: var(--text-primary);
  }
  
  .preset-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }
  
  .preset-button {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 12px;
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .preset-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--accent-color);
    transform: translateY(-2px);
  }
  
  .reset-button {
    width: 100%;
    background: transparent;
    border: 2px solid var(--judgment-miss);
    color: var(--judgment-miss);
    padding: 15px;
    font-size: 1.1rem;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .reset-button:hover {
    background: rgba(255, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  .about-info {
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
  }
  
  .about-info p {
    margin-bottom: 8px;
  }
  
  @media (max-width: 768px) {
    .settings-page {
      padding: 15px;
    }
    
    .settings-title {
      font-size: 2rem;
    }
    
    .settings-section {
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .section-title {
      font-size: 1.2rem;
    }
    
    .setting-item.slider {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    
    .setting-item input[type="range"] {
      width: 100%;
      flex: none;
    }
    
    .setting-item select {
      width: 100%;
      flex: none;
    }
    
    .preset-buttons {
      grid-template-columns: 1fr;
    }
  }
</style>