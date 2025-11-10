/**
 * 音频资源池管理器 - 解决音频系统崩溃问题
 * 提供音频资源预加载、错误恢复和性能优化
 */

// Node.js兼容性层
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now()
  };
}

export class AudioResourcePool {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 3;
    this.maxCacheSize = options.maxCacheSize || 10;
    this.preloadTimeout = options.preloadTimeout || 5000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.enableMonitoring = options.enableMonitoring || true;
    
    // 资源池
    this.audioCache = new Map(); // 已加载的音频
    this.loadingQueue = []; // 加载队列
    this.loadingPromises = new Map(); // 正在加载的音频
    this.activeAudio = new Set(); // 正在播放的音频
    
    // 错误追踪
    this.errorCount = new Map();
    this.lastErrorTime = new Map();
    
    // 性能监控
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      loadAttempts: 0,
      loadFailures: 0,
      playAttempts: 0,
      playFailures: 0,
      avgLoadTime: 0,
      totalLoadTime: 0
    };
    
    // 浏览器兼容性
    this.browserInfo = this.detectBrowser();
    this.audioContext = null;
    this.masterGain = null;
    
    // 初始化音频上下文
    this.initializeAudioContext();
    
    // 错误恢复机制
    this.setupErrorRecovery();
  }
  
  /**
   * 初始化音频资源池
   */
  async initialize() {
    console.log('🔊 Initializing Audio Resource Pool...');
    
    // 清理现有的音频缓存
    this.audioCache.clear();
    this.loadingQueue = [];
    this.loadingPromises.clear();
    this.activeAudio.clear();
    
    // 重置错误追踪
    this.errorCount.clear();
    this.lastErrorTime.clear();
    
    // 重置性能指标
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      loadAttempts: 0,
      loadFailures: 0,
      playAttempts: 0,
      playFailures: 0,
      avgLoadTime: 0,
      totalLoadTime: 0
    };
    
    console.log(`✅ Audio Resource Pool initialized with max cache size: ${this.maxCacheSize}`);
    return true;
  }
  
  /**
   * 验证音频资源池状态
   */
  async validate() {
    // 检查基本状态
    if (this.isDestroyed) {
      return false;
    }
    
    // 检查音频上下文状态（如果支持）
    if (this.browserInfo.supportsWebAudio && this.audioContext) {
      if (this.audioContext.state === 'closed') {
        return false;
      }
    }
    
    // 检查错误率是否过高
    const totalOperations = this.metrics.loadAttempts + this.metrics.playAttempts;
    const totalFailures = this.metrics.loadFailures + this.metrics.playFailures;
    
    if (totalOperations > 0) {
      const failureRate = totalFailures / totalOperations;
      if (failureRate > 0.5) { // 失败率超过50%
        console.warn(`Audio pool validation failed: high failure rate (${(failureRate * 100).toFixed(1)}%)`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 检测浏览器类型和版本
   */
  detectBrowser() {
    // Node.js环境检测
    if (typeof window === 'undefined') {
      return {
        isSafari: false,
        isIOS: false,
        isChrome: false,
        isFirefox: false,
        supportsWebAudio: false
      };
    }
    
    const ua = navigator.userAgent;
    return {
      isSafari: /^((?!chrome|android).)*safari/i.test(ua),
      isIOS: /iPad|iPhone|iPod/.test(ua),
      isChrome: /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor),
      isFirefox: /Firefox/.test(ua),
      supportsWebAudio: !!(window.AudioContext || window.webkitAudioContext)
    };
  }
  
  /**
   * 初始化Web Audio API上下文
   */
  async initializeAudioContext() {
    if (!this.browserInfo.supportsWebAudio) {
      console.warn('Web Audio API not supported');
      return;
    }
    
    try {
      // Node.js环境下跳过音频上下文初始化
      if (typeof window === 'undefined') {
        console.log('Running in Node.js - skipping audio context initialization');
        return;
      }
      
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // 创建主增益节点
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      
      // 处理自动播放策略
      if (this.audioContext.state === 'suspended') {
        this.setupAudioContextResume();
      }
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }
  
  /**
   * 设置音频上下文恢复机制
   */
  setupAudioContextResume() {
    // Node.js环境下跳过事件监听器设置
    if (typeof window === 'undefined') {
      console.log('Running in Node.js - skipping audio context resume setup');
      return;
    }
    
    const resumeAudio = async () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          console.log('Audio context resumed');
        } catch (error) {
          console.error('Failed to resume audio context:', error);
        }
      }
    };
    
    // 监听用户交互事件
    ['click', 'touchstart', 'keydown'].forEach(event => {
      document.addEventListener(event, resumeAudio, { once: true, capture: true });
    });
  }

  playSound(key) {
    console.log(`Playing sound: ${key}`);
  }

  getAudio(key) {
    return this.audioCache.get(key) || null;
  }
  
  /**
   * 设置错误恢复机制
   */
  setupErrorRecovery() {
    // Node.js环境下跳过事件监听器设置
    if (typeof window === 'undefined') {
      console.log('Running in Node.js - skipping error recovery setup');
      return;
    }
    
    // 监听音频错误
    window.addEventListener('error', (event) => {
      if (event.message && event.message.includes('audio')) {
        this.handleAudioError(event);
      }
    });
    
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAllAudio();
      } else {
        this.resumeAllAudio();
      }
    });
  }
  
  /**
   * 加载音频资源
   */
  async loadAudio(key, url, options = {}) {
    // 检查缓存
    if (this.audioCache.has(key)) {
      this.metrics.cacheHits++;
      return this.audioCache.get(key);
    }
    
    this.metrics.cacheMisses++;
    
    // 检查是否正在加载
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }
    
    // 创建加载任务
    const loadTask = this.performLoadAudio(key, url, options);
    this.loadingPromises.set(key, loadTask);
    
    try {
      const audio = await loadTask;
      this.audioCache.set(key, audio);
      this.loadingPromises.delete(key);
      
      // 管理缓存大小
      this.manageCacheSize();
      
      return audio;
    } catch (error) {
      this.loadingPromises.delete(key);
      this.trackError(key, error);
      throw error;
    }
  }
  
  /**
   * 执行音频加载
   */
  async performLoadAudio(key, url, options = {}) {
    this.metrics.loadAttempts++;
    const startTime = performance.now();
    
    // 浏览器特定的加载策略
    const loadStrategy = this.selectLoadStrategy();
    
    try {
      let audio;
      
      switch (loadStrategy) {
        case 'fetch':
          audio = await this.loadWithFetch(url, options);
          break;
        case 'audio':
          audio = await this.loadWithAudio(url, options);
          break;
        case 'webaudio':
          audio = await this.loadWithWebAudio(url, options);
          break;
        default:
          audio = await this.loadWithAudio(url, options);
      }
      
      // 更新加载时间指标
      const loadTime = performance.now() - startTime;
      this.updateLoadTimeMetrics(loadTime);
      
      console.log(`Audio loaded successfully: ${key} (${loadTime.toFixed(2)}ms)`);
      return audio;
      
    } catch (error) {
      this.metrics.loadFailures++;
      
      // 重试机制
      if (this.shouldRetry(key)) {
        console.warn(`Retrying audio load: ${key} (attempt ${this.getErrorCount(key) + 1})`);
        await this.delay(this.retryDelay);
        return this.performLoadAudio(key, url, options);
      }
      
      throw new Error(`Failed to load audio: ${key} - ${error.message}`);
    }
  }
  
  /**
   * 选择加载策略
   */
  selectLoadStrategy() {
    if (this.browserInfo.isSafari || this.browserInfo.isIOS) {
      return 'audio'; // Safari对fetch音频支持较差
    }
    
    if (this.audioContext && this.audioContext.state === 'running') {
      return 'webaudio'; // 优先使用Web Audio API
    }
    
    return 'audio'; // 默认使用HTML Audio
  }
  
  /**
   * 使用HTML Audio加载
   */
  loadWithAudio(url, options) {
    return new Promise((resolve, reject) => {
      // Node.js环境下不支持HTML Audio
      if (typeof Audio === 'undefined') {
        console.log('Running in Node.js - Audio not supported, returning mock object');
        resolve({
          src: url,
          preload: options.preload || 'auto',
          crossOrigin: options.crossOrigin || 'anonymous',
          mock: true
        });
        return;
      }
      
      const audio = new Audio();
      
      // 设置音频属性
      audio.preload = options.preload || 'auto';
      audio.crossOrigin = options.crossOrigin || 'anonymous';
      
      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error('Audio load timeout'));
      }, this.preloadTimeout);
      
      // 成功加载
      audio.addEventListener('canplaythrough', () => {
        clearTimeout(timeout);
        resolve(audio);
      }, { once: true });
      
      // 加载错误
      audio.addEventListener('error', (e) => {
        clearTimeout(timeout);
        reject(new Error(`Audio error: ${audio.error?.message || 'Unknown error'}`));
      }, { once: true });
      
      // 开始加载
      audio.src = url;
      audio.load();
    });
  }
  
  /**
   * 使用Fetch API加载
   */
  async loadWithFetch(url, options) {
    const response = await fetch(url, {
      mode: options.cors || 'cors',
      credentials: options.credentials || 'same-origin'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const audio = new Audio();
    audio.src = blobUrl;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Audio load timeout'));
      }, this.preloadTimeout);
      
      audio.addEventListener('canplaythrough', () => {
        clearTimeout(timeout);
        resolve(audio);
      }, { once: true });
      
      audio.addEventListener('error', () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Audio playback error'));
      }, { once: true });
      
      audio.load();
    });
  }
  
  /**
   * 使用Web Audio API加载
   */
  async loadWithWebAudio(url, options) {
    if (!this.audioContext) {
      throw new Error('Web Audio API not available');
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    return {
      type: 'webaudio',
      buffer: audioBuffer,
      context: this.audioContext,
      duration: audioBuffer.duration
    };
  }
  
  /**
   * 播放音频
   */
  async play(key, options = {}) {
    this.metrics.playAttempts++;
    
    try {
      const audio = await this.loadAudio(key, options.url || key);
      
      if (!audio) {
        throw new Error('Audio not found');
      }
      
      // 播放音频
      await this.performPlay(audio, options);
      
      // 添加到活跃音频集合
      this.activeAudio.add(audio);
      
      // 设置清理监听器
      this.setupAudioCleanup(audio, key);
      
      return audio;
      
    } catch (error) {
      this.metrics.playFailures++;
      this.trackError(key, error);
      
      // 尝试恢复
      if (this.shouldRetry(key)) {
        console.warn(`Retrying audio play: ${key}`);
        await this.delay(this.retryDelay);
        return this.play(key, options);
      }
      
      throw error;
    }
  }
  
  /**
   * 执行播放
   */
  async performPlay(audio, options = {}) {
    const volume = options.volume !== undefined ? options.volume : 1.0;
    const loop = options.loop || false;
    
    if (audio.type === 'webaudio') {
      return this.playWebAudio(audio, volume, loop);
    } else {
      return this.playHtmlAudio(audio, volume, loop);
    }
  }
  
  /**
   * 播放HTML Audio
   */
  playHtmlAudio(audio, volume, loop) {
    return new Promise((resolve, reject) => {
      // 重置音频状态
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.loop = loop;
      
      // 播放成功
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          resolve(audio);
        }).catch(error => {
          reject(new Error(`Playback failed: ${error.message}`));
        });
      } else {
        // 旧版浏览器支持
        resolve(audio);
      }
    });
  }
  
  /**
   * 播放Web Audio
   */
  playWebAudio(audioBuffer, volume, loop) {
    if (!this.audioContext) {
      throw new Error('Web Audio API not available');
    }
    
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = audioBuffer.buffer;
    source.loop = loop;
    
    gainNode.gain.value = Math.max(0, Math.min(1, volume));
    
    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    source.start(0);
    
    return {
      type: 'webaudio',
      source,
      gainNode,
      stop: () => source.stop()
    };
  }
  
  /**
   * 停止音频
   */
  stop(audio) {
    if (!audio) return;
    
    try {
      if (audio.type === 'webaudio') {
        if (audio.source) {
          audio.source.stop();
        }
      } else {
        audio.pause();
        audio.currentTime = 0;
      }
      
      this.activeAudio.delete(audio);
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  }
  
  /**
   * 暂停所有音频
   */
  pauseAllAudio() {
    this.activeAudio.forEach(audio => {
      try {
        if (audio.type === 'webaudio') {
          // Web Audio无法暂停，只能停止
          if (audio.source) {
            audio.source.stop();
          }
        } else {
          audio.pause();
        }
      } catch (error) {
        console.error('Error pausing audio:', error);
      }
    });
  }
  
  /**
   * 恢复所有音频
   */
  resumeAllAudio() {
    // HTML5 Audio可以在用户交互后恢复播放
    // Web Audio需要重新创建源节点
  }
  
  /**
   * 设置音频上下文音量
   */
  setMasterVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  
  /**
   * 管理缓存大小
   */
  manageCacheSize() {
    if (this.audioCache.size <= this.maxCacheSize) return;
    
    // LRU缓存淘汰策略
    const entries = Array.from(this.audioCache.entries());
    const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
    
    toRemove.forEach(([key, audio]) => {
      this.audioCache.delete(key);
      
      // 清理音频资源
      if (audio && typeof audio.pause === 'function') {
        audio.pause();
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
      }
    });
  }
  
  /**
   * 错误处理
   */
  handleAudioError(event) {
    console.error('Audio error detected:', event);
    
    // 清理可能损坏的音频资源
    this.cleanupCorruptedAudio();
    
    // 尝试重新初始化音频上下文
    if (this.audioContext && this.audioContext.state !== 'running') {
      this.initializeAudioContext();
    }
  }
  
  /**
   * 清理损坏的音频
   */
  cleanupCorruptedAudio() {
    // 停止所有活跃的音频
    this.activeAudio.forEach(audio => this.stop(audio));
    this.activeAudio.clear();
    
    // 清理缓存
    this.audioCache.clear();
    this.loadingPromises.clear();
  }
  
  /**
   * 错误追踪
   */
  trackError(key, error) {
    const count = this.errorCount.get(key) || 0;
    this.errorCount.set(key, count + 1);
    this.lastErrorTime.set(key, Date.now());
    
    console.error(`Audio error for ${key}:`, error);
  }
  
  /**
   * 获取错误计数
   */
  getErrorCount(key) {
    return this.errorCount.get(key) || 0;
  }
  
  /**
   * 是否应该重试
   */
  shouldRetry(key) {
    const errorCount = this.getErrorCount(key);
    const lastError = this.lastErrorTime.get(key) || 0;
    const timeSinceError = Date.now() - lastError;
    
    return errorCount < this.retryAttempts && timeSinceError > this.retryDelay;
  }
  
  /**
   * 更新加载时间指标
   */
  updateLoadTimeMetrics(loadTime) {
    this.metrics.totalLoadTime += loadTime;
    this.metrics.avgLoadTime = this.metrics.totalLoadTime / this.metrics.loadAttempts;
  }
  
  /**
   * 获取性能统计
   */
  getStats() {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const loadSuccessRate = this.metrics.loadAttempts > 0 
      ? ((this.metrics.loadAttempts - this.metrics.loadFailures) / this.metrics.loadAttempts * 100).toFixed(2)
      : 0;
    
    const playSuccessRate = this.metrics.playAttempts > 0
      ? ((this.metrics.playAttempts - this.metrics.playFailures) / this.metrics.playAttempts * 100).toFixed(2)
      : 0;
    
    return {
      cache: {
        size: this.audioCache.size,
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: totalRequests > 0 ? (this.metrics.cacheHits / totalRequests * 100).toFixed(2) + '%' : '0%'
      },
      loading: {
        attempts: this.metrics.loadAttempts,
        failures: this.metrics.loadFailures,
        successRate: loadSuccessRate + '%',
        avgLoadTime: this.metrics.avgLoadTime.toFixed(2) + 'ms'
      },
      playback: {
        attempts: this.metrics.playAttempts,
        failures: this.metrics.playFailures,
        successRate: playSuccessRate + '%',
        active: this.activeAudio.size
      },
      errors: {
        total: Array.from(this.errorCount.values()).reduce((a, b) => a + b, 0),
        byKey: Object.fromEntries(this.errorCount)
      }
    };
  }
  
  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 清理所有资源
   */
  destroy() {
    // 停止所有音频
    this.activeAudio.forEach(audio => this.stop(audio));
    this.activeAudio.clear();
    
    // 清理缓存
    this.audioCache.forEach((audio, key) => {
      if (audio && typeof audio.pause === 'function') {
        audio.pause();
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
      }
    });
    this.audioCache.clear();
    
    // 清理音频上下文
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // 清理其他资源
    this.loadingQueue = [];
    this.loadingPromises.clear();
    this.errorCount.clear();
    this.lastErrorTime.clear();
  }
}

/**
 * 音频管理器单例 - 集成资源池
 */
export class AudioManager {
  constructor() {
    if (AudioManager.instance) {
      return AudioManager.instance;
    }
    
    this.resourcePool = new AudioResourcePool({
      maxConcurrent: 3,
      maxCacheSize: 15,
      enableMonitoring: true
    });
    
    this.bgmVolume = 0.7;
    this.sfxVolume = 0.8;
    this.bgmMuted = false;
    this.sfxMuted = false;
    
    this.currentBGM = null;
    this.bgmLoop = true;
    
    // 预定义的音效
    this.soundEffects = {
      hit_perfect: null,
      hit_great: null,
      hit_good: null,
      hit_bad: null,
      hit_miss: null,
      button_click: null
    };
    
    AudioManager.instance = this;
  }
  
  static getInstance() {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
  
  /**
   * 加载背景音乐
   */
  async loadBGM(key, url) {
    try {
      this.currentBGM = await this.resourcePool.loadAudio(key, url);
      return this.currentBGM;
    } catch (error) {
      console.error('Failed to load BGM:', error);
      throw error;
    }
  }
  
  /**
   * 播放背景音乐
   */
  async playBGM(key, options = {}) {
    try {
      const volume = this.bgmMuted ? 0 : this.bgmVolume;
      const loop = options.loop !== undefined ? options.loop : this.bgmLoop;
      
      this.currentBGM = await this.resourcePool.play(key, {
        volume,
        loop,
        ...options
      });
      
      return this.currentBGM;
    } catch (error) {
      console.error('Failed to play BGM:', error);
      throw error;
    }
  }
  
  /**
   * 停止背景音乐
   */
  stopBGM() {
    if (this.currentBGM) {
      this.resourcePool.stop(this.currentBGM);
      this.currentBGM = null;
    }
  }
  
  /**
   * 播放音效
   */
  async playSoundEffect(soundName, options = {}) {
    try {
      const volume = this.sfxMuted ? 0 : this.sfxVolume * (options.volume || 1);
      
      return await this.resourcePool.play(soundName, {
        volume,
        loop: false,
        ...options
      });
    } catch (error) {
      console.error('Failed to play sound effect:', error);
      // 音效失败不抛出错误，避免影响游戏
    }
  }
  
  /**
   * 设置音量
   */
  setBGMVolume(volume) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    this.resourcePool.setMasterVolume(this.bgmMuted ? 0 : this.bgmVolume);
  }
  
  setSFXVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }
  
  /**
   * 静音控制
   */
  toggleBGMMute() {
    this.bgmMuted = !this.bgmMuted;
    this.resourcePool.setMasterVolume(this.bgmMuted ? 0 : this.bgmVolume);
    return this.bgmMuted;
  }
  
  toggleSFXMute() {
    this.sfxMuted = !this.sfxMuted;
    return this.sfxMuted;
  }
  
  /**
   * 获取音频状态
   */
  getAudioStats() {
    return this.resourcePool.getStats();
  }
  
  /**
   * 清理所有音频资源
   */
  cleanup() {
    this.stopBGM();
    this.resourcePool.destroy();
  }
}

// 导出单例实例
export const audioManager = AudioManager.getInstance();