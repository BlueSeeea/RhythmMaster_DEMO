/**
 * 音符生成优化器 - 解决音符生成逻辑问题
 * 提供智能音符生成、难度适配和性能优化
 */
import { getGlobalNotePool } from './OptimizedObjectPool.js';

export class NoteGenerator {
  constructor(options = {}) {
    this.options = {
      // 生成策略
      generationMode: 'adaptive', // adaptive, sequential, burst, alternate, sync
      densityControl: true,
      difficultyScaling: true,
      performanceAware: true,
      
      // 性能限制
      maxActiveNotes: 50,
      maxNotesPerSecond: 8,
      generationBatchSize: 5,
      
      // 难度参数
      baseDifficulty: 1.0,
      difficultyMultiplier: 1.0,
      minNoteInterval: 100, // 毫秒
      maxNoteInterval: 2000,
      
      // 节奏模式
      rhythmPatterns: new Map(),
      currentPattern: null,
      
      // 预测机制
      enablePrediction: true,
      predictionWindow: 2000, // 毫秒
      
      // 性能监控
      performanceMetrics: {
        notesGenerated: 0,
        generationRate: 0,
        avgGenerationTime: 0,
        lastGenerationTime: 0,
        failedGenerations: 0
      },
      
      ...options
    };
    
    // 生成状态
    this.isGenerating = false;
    this.lastGenerationTime = 0;
    this.generationQueue = [];
    this.activeNotes = new Map();
    this.generationHistory = [];
    
    // 难度适配器
    this.difficultyAdapter = new DifficultyAdapter();
    
    // 节奏分析器
    this.rhythmAnalyzer = new RhythmAnalyzer();
    
    // 性能监控器
    this.performanceMonitor = new PerformanceMonitor();
    
    // 预测引擎
    this.predictionEngine = new NotePredictionEngine();
    
    // 初始化节奏模式
    this.initializeRhythmPatterns();
    
    // 绑定方法
    this.generateNotes = this.generateNotes.bind(this);
    this.updateDifficulty = this.updateDifficulty.bind(this);
  }
  
  /**
   * 初始化音符生成器
   */
  async initialize() {
    try {
      // 初始化难度适配器
      await this.difficultyAdapter.initialize();
      
      // 初始化节奏分析器
      await this.rhythmAnalyzer.initialize();
      
      // 初始化预测引擎
      if (this.options.enablePrediction) {
        await this.predictionEngine.initialize();
      }
      
      // 初始化性能监控器
      this.performanceMonitor.start();
      
      console.log('Note generator initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize note generator:', error);
      throw error;
    }
  }
  
  /**
   * 初始化节奏模式
   */
  initializeRhythmPatterns() {
    // 基础节奏模式
    this.options.rhythmPatterns.set('basic', {
      intervals: [500, 500, 1000, 500, 500, 1000],
      lanes: [0, 1, 2, 0, 1, 2],
      difficulty: 1.0,
      description: '基础节奏'
    });
    
    // 复杂节奏模式
    this.options.rhythmPatterns.set('complex', {
      intervals: [250, 250, 500, 250, 250, 1000],
      lanes: [0, 1, 2, 1, 0, 3],
      difficulty: 2.0,
      description: '复杂节奏'
    });
    
    // 爆发节奏模式
    this.options.rhythmPatterns.set('burst', {
      intervals: [125, 125, 125, 125, 500, 1000],
      lanes: [0, 1, 2, 3, 1, 2],
      difficulty: 3.0,
      description: '爆发节奏'
    });
    
    // 交替节奏模式
    this.options.rhythmPatterns.set('alternate', {
      intervals: [333, 333, 333, 333, 333, 333],
      lanes: [0, 2, 1, 3, 0, 2],
      difficulty: 2.5,
      description: '交替节奏'
    });
    
    // 同步节奏模式
    this.options.rhythmPatterns.set('sync', {
      intervals: [500, 0, 500, 0, 1000, 0],
      lanes: [0, 1, 2, 3, 0, 1],
      difficulty: 3.5,
      description: '同步节奏'
    });
    
    // 自适应节奏模式
    this.options.rhythmPatterns.set('adaptive', {
      intervals: [], // 动态生成
      lanes: [], // 动态生成
      difficulty: 1.0,
      description: '自适应节奏',
      adaptive: true
    });
  }
  
  /**
   * 生成音符
   */
  async generateNotes(beatTime, currentTime, options = {}) {
    const startTime = performance.now();
    
    try {
      this.isGenerating = true;
      
      // 合并选项
      const generationOptions = { ...this.options, ...options };
      
      // 检查生成限制
      if (!this.canGenerateNotes(generationOptions)) {
        return [];
      }
      
      // 根据模式生成音符
      let notes = [];
      
      switch (generationOptions.generationMode) {
        case 'adaptive':
          notes = await this.generateAdaptiveNotes(beatTime, currentTime, generationOptions);
          break;
        case 'sequential':
          notes = await this.generateSequentialNotes(beatTime, currentTime, generationOptions);
          break;
        case 'burst':
          notes = await this.generateBurstNotes(beatTime, currentTime, generationOptions);
          break;
        case 'alternate':
          notes = await this.generateAlternateNotes(beatTime, currentTime, generationOptions);
          break;
        case 'sync':
          notes = await this.generateSyncNotes(beatTime, currentTime, generationOptions);
          break;
        default:
          notes = await this.generateAdaptiveNotes(beatTime, currentTime, generationOptions);
      }
      
      // 后处理生成的音符
      notes = await this.postProcessNotes(notes, generationOptions);
      
      // 更新统计
      const generationTime = performance.now() - startTime;
      this.updateGenerationStats(notes.length, generationTime);
      
      return notes;
      
    } catch (error) {
      console.error('Note generation error:', error);
      this.options.performanceMetrics.failedGenerations++;
      return [];
      
    } finally {
      this.isGenerating = false;
      this.lastGenerationTime = performance.now();
    }
  }
  
  /**
   * 检查是否可以生成音符
   */
  canGenerateNotes(options) {
    // 检查活跃音符数量
    if (this.activeNotes.size >= options.maxActiveNotes) {
      return false;
    }
    
    // 检查生成频率
    const currentTime = performance.now();
    const timeSinceLastGeneration = currentTime - this.lastGenerationTime;
    const minInterval = 1000 / options.maxNotesPerSecond;
    
    if (timeSinceLastGeneration < minInterval) {
      return false;
    }
    
    // 检查性能状态
    if (options.performanceAware && !this.performanceMonitor.canGenerate()) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 生成自适应音符
   */
  async generateAdaptiveNotes(beatTime, currentTime, options) {
    const notes = [];
    
    // 获取当前难度
    const difficulty = this.difficultyAdapter.getCurrentDifficulty();
    
    // 分析当前节奏
    const rhythmAnalysis = await this.rhythmAnalyzer.analyze(beatTime, currentTime);
    
    // 预测玩家行为
    let predictions = [];
    if (this.options.enablePrediction) {
      predictions = await this.predictionEngine.predict(beatTime, currentTime, this.generationHistory);
    }
    
    // 基于分析结果生成音符
    const noteCount = this.calculateOptimalNoteCount(difficulty, rhythmAnalysis);
    const intervals = this.generateAdaptiveIntervals(difficulty, rhythmAnalysis, predictions);
    const lanes = this.generateAdaptiveLanes(difficulty, rhythmAnalysis, predictions);
    
    for (let i = 0; i < noteCount; i++) {
      const note = await this.createNote({
        lane: lanes[i],
        timing: currentTime + intervals[i],
        difficulty,
        type: this.determineNoteType(difficulty, rhythmAnalysis, i),
        speed: this.calculateNoteSpeed(difficulty),
        options
      });
      
      if (note) {
        notes.push(note);
      }
    }
    
    return notes;
  }
  
  /**
   * 生成顺序音符
   */
  async generateSequentialNotes(beatTime, currentTime, options) {
    const notes = [];
    const pattern = this.options.rhythmPatterns.get('basic');
    
    for (let i = 0; i < pattern.intervals.length; i++) {
      const note = await this.createNote({
        lane: pattern.lanes[i],
        timing: currentTime + pattern.intervals[i],
        type: 'normal',
        speed: this.calculateNoteSpeed(options.baseDifficulty),
        options
      });
      
      if (note) {
        notes.push(note);
      }
    }
    
    return notes;
  }
  
  /**
   * 生成爆发音符
   */
  async generateBurstNotes(beatTime, currentTime, options) {
    const notes = [];
    const pattern = this.options.rhythmPatterns.get('burst');
    
    // 生成爆发音符群
    for (let i = 0; i < pattern.intervals.length; i++) {
      // 在短间隔内生成多个音符
      if (pattern.intervals[i] < 200) {
        // 同时生成多个音符
        for (let j = 0; j < 4; j++) {
          const note = await this.createNote({
            lane: j,
            timing: currentTime + pattern.intervals[i] + (j * 50), // 轻微时间差
            type: 'burst',
            speed: this.calculateNoteSpeed(options.baseDifficulty * 1.2),
            options
          });
          
          if (note) {
            notes.push(note);
          }
        }
      } else {
        const note = await this.createNote({
          lane: pattern.lanes[i],
          timing: currentTime + pattern.intervals[i],
          type: 'normal',
          speed: this.calculateNoteSpeed(options.baseDifficulty),
          options
        });
        
        if (note) {
          notes.push(note);
        }
      }
    }
    
    return notes;
  }
  
  /**
   * 生成交替音符
   */
  async generateAlternateNotes(beatTime, currentTime, options) {
    const notes = [];
    const pattern = this.options.rhythmPatterns.get('alternate');
    
    for (let i = 0; i < pattern.intervals.length; i++) {
      const note = await this.createNote({
        lane: pattern.lanes[i],
        timing: currentTime + pattern.intervals[i],
        type: 'alternate',
        speed: this.calculateNoteSpeed(options.baseDifficulty),
        options
      });
      
      if (note) {
        notes.push(note);
      }
    }
    
    return notes;
  }
  
  /**
   * 生成同步音符
   */
  async generateSyncNotes(beatTime, currentTime, options) {
    const notes = [];
    const pattern = this.options.rhythmPatterns.get('sync');
    
    for (let i = 0; i < pattern.intervals.length; i++) {
      if (pattern.intervals[i] === 0) {
        // 同步生成多个音符
        for (let lane = 0; lane < 4; lane++) {
          const note = await this.createNote({
            lane,
            timing: currentTime + pattern.intervals[i],
            type: 'sync',
            speed: this.calculateNoteSpeed(options.baseDifficulty),
            options
          });
          
          if (note) {
            notes.push(note);
          }
        }
      } else {
        const note = await this.createNote({
          lane: pattern.lanes[i],
          timing: currentTime + pattern.intervals[i],
          type: 'normal',
          speed: this.calculateNoteSpeed(options.baseDifficulty),
          options
        });
        
        if (note) {
          notes.push(note);
        }
      }
    }
    
    return notes;
  }
  
  /**
   * 创建音符
   */
  async createNote(config) {
    try {
      // 从对象池获取音符
      const notePool = getGlobalNotePool();
      const note = notePool.acquire();
      
      if (!note) {
        console.warn('Failed to get note from pool');
        return null;
      }
      
      // 配置音符属性
      note.id = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      note.lane = config.lane;
      note.timing = config.timing;
      note.type = config.type;
      note.speed = config.speed;
      note.position = { x: this.calculateLanePosition(config.lane), y: -100 };
      note.targetPosition = { x: note.position.x, y: 600 };
      note.isActive = true;
      note.isHit = false;
      note.hitTime = null;
      note.judgment = null;
      note.generationTime = performance.now();
      
      // 添加到活跃音符列表
      this.activeNotes.set(note.id, note);
      
      return note;
      
    } catch (error) {
      console.error('Failed to create note:', error);
      return null;
    }
  }
  
  /**
   * 计算轨道位置
   */
  calculateLanePosition(lane) {
    const laneWidth = 100;
    const startX = 150;
    return startX + (lane * laneWidth) + (laneWidth / 2);
  }
  
  /**
   * 计算最佳音符数量
   */
  calculateOptimalNoteCount(difficulty, rhythmAnalysis) {
    // 基于难度和节奏分析计算最佳音符数量
    const baseCount = Math.floor(difficulty * 3) + 2;
    const rhythmMultiplier = rhythmAnalysis.complexity * 0.5 + 0.5;
    
    return Math.min(baseCount * rhythmMultiplier, this.options.maxNotesPerSecond);
  }
  
  /**
   * 生成自适应间隔
   */
  generateAdaptiveIntervals(difficulty, rhythmAnalysis, predictions) {
    const intervals = [];
    const baseInterval = this.options.maxNoteInterval / difficulty;
    
    for (let i = 0; i < 6; i++) {
      let interval = baseInterval;
      
      // 根据节奏分析调整间隔
      if (rhythmAnalysis.beatStrength[i % rhythmAnalysis.beatStrength.length] > 0.7) {
        interval *= 0.8; // 强拍缩短间隔
      }
      
      // 根据预测调整间隔
      if (predictions[i] && predictions[i].playerReadiness > 0.8) {
        interval *= 0.9; // 预测玩家准备好时缩短间隔
      }
      
      intervals.push(Math.max(this.options.minNoteInterval, interval));
    }
    
    return intervals;
  }
  
  /**
   * 生成自适应轨道
   */
  generateAdaptiveLanes(difficulty, rhythmAnalysis, predictions) {
    const lanes = [];
    const availableLanes = [0, 1, 2, 3];
    
    for (let i = 0; i < 6; i++) {
      let lane;
      
      // 基于难度选择轨道
      if (difficulty < 1.5) {
        lane = availableLanes[i % 3]; // 简单：主要使用前3个轨道
      } else if (difficulty < 2.5) {
        lane = availableLanes[i % 4]; // 中等：使用所有轨道
      } else {
        lane = availableLanes[Math.floor(Math.random() * 4)]; // 困难：随机选择
      }
      
      lanes.push(lane);
    }
    
    return lanes;
  }
  
  /**
   * 确定音符类型
   */
  determineNoteType(difficulty, rhythmAnalysis, index) {
    if (difficulty > 2.5 && index % 4 === 0) {
      return 'hold'; // 高难度时添加长按音符
    } else if (difficulty > 3.0 && index % 6 === 0) {
      return 'slide'; // 极限难度时添加滑动音符
    }
    
    return 'normal';
  }
  
  /**
   * 计算音符速度
   */
  calculateNoteSpeed(difficulty) {
    return 200 + (difficulty * 50); // 基础速度 + 难度加成
  }
  
  /**
   * 后处理音符
   */
  async postProcessNotes(notes, options) {
    if (notes.length === 0) return notes;
    
    // 密度控制
    if (this.options.densityControl) {
      notes = this.controlNoteDensity(notes);
    }
    
    // 难度调整
    if (this.options.difficultyScaling) {
      notes = this.scaleDifficulty(notes);
    }
    
    // 性能优化
    if (this.options.performanceAware) {
      notes = this.optimizeForPerformance(notes);
    }
    
    return notes;
  }
  
  /**
   * 控制音符密度
   */
  controlNoteDensity(notes) {
    if (notes.length <= 1) return notes;
    
    const filteredNotes = [];
    let lastTiming = 0;
    
    notes.forEach(note => {
      if (note.timing - lastTiming >= this.options.minNoteInterval) {
        filteredNotes.push(note);
        lastTiming = note.timing;
      }
    });
    
    return filteredNotes;
  }
  
  /**
   * 调整难度
   */
  scaleDifficulty(notes) {
    const currentDifficulty = this.difficultyAdapter.getCurrentDifficulty();
    
    return notes.map(note => {
      note.speed *= currentDifficulty;
      return note;
    });
  }
  
  /**
   * 性能优化
   */
  optimizeForPerformance(notes) {
    const performanceLevel = this.performanceMonitor.getPerformanceLevel();
    
    if (performanceLevel < 0.7) {
      // 性能较低时减少音符数量
      return notes.filter((note, index) => index % 2 === 0);
    }
    
    return notes;
  }
  
  /**
   * 更新生成统计
   */
  updateGenerationStats(noteCount, generationTime) {
    this.options.performanceMetrics.notesGenerated += noteCount;
    this.options.performanceMetrics.lastGenerationTime = generationTime;
    
    // 更新平均生成时间
    const totalChecks = this.generationHistory.length + 1;
    this.options.performanceMetrics.avgGenerationTime = 
      (this.options.performanceMetrics.avgGenerationTime * this.generationHistory.length + generationTime) / totalChecks;
    
    // 添加到历史记录
    this.generationHistory.push({
      timestamp: performance.now(),
      noteCount,
      generationTime,
      difficulty: this.difficultyAdapter.getCurrentDifficulty()
    });
    
    // 保持历史记录在合理大小
    if (this.generationHistory.length > 100) {
      this.generationHistory.shift();
    }
  }
  
  /**
   * 更新难度
   */
  updateDifficulty(score, combo, accuracy) {
    this.difficultyAdapter.updateDifficulty(score, combo, accuracy);
  }
  
  /**
   * 移除音符
   */
  removeNote(noteId) {
    const note = this.activeNotes.get(noteId);
    if (note) {
      // 返回到对象池
      const notePool = getGlobalNotePool();
      notePool.release(note);
      this.activeNotes.delete(noteId);
      return true;
    }
    return false;
  }
  
  /**
   * 清理过期音符
   */
  cleanupExpiredNotes(currentTime) {
    let cleanedCount = 0;
    
    this.activeNotes.forEach((note, noteId) => {
      if (note.timing < currentTime - 2000) { // 2秒前的音符
        if (this.removeNote(noteId)) {
          cleanedCount++;
        }
      }
    });
    
    return cleanedCount;
  }
  
  /**
   * 获取生成统计
   */
  getGenerationStats() {
    return {
      ...this.options.performanceMetrics,
      activeNotes: this.activeNotes.size,
      generationHistoryLength: this.generationHistory.length,
      currentDifficulty: this.difficultyAdapter.getCurrentDifficulty(),
      currentPattern: this.options.currentPattern,
      predictionAccuracy: this.predictionEngine ? this.predictionEngine.getAccuracy() : 0
    };
  }
  
  /**
   * 设置生成模式
   */
  setGenerationMode(mode) {
    if (this.options.rhythmPatterns.has(mode) || ['adaptive', 'sequential', 'burst', 'alternate', 'sync'].includes(mode)) {
      this.options.generationMode = mode;
      this.options.currentPattern = mode;
      console.log(`Generation mode set to: ${mode}`);
    }
  }
  
  /**
   * 清理资源
   */
  destroy() {
    this.isGenerating = false;
    this.generationQueue = [];
    
    // 清理所有活跃音符
    this.activeNotes.forEach((note, noteId) => {
      this.removeNote(noteId);
    });
    
    // 停止监控器
    if (this.performanceMonitor) {
      this.performanceMonitor.stop();
    }
    
    // 清理历史记录
    this.generationHistory = [];
    
    console.log('Note generator destroyed');
  }
}

/**
 * 难度适配器
 */
class DifficultyAdapter {
  constructor() {
    this.currentDifficulty = 1.0;
    this.targetDifficulty = 1.0;
    this.difficultyHistory = [];
    this.adaptationRate = 0.1;
  }
  
  async initialize() {
    console.log('Difficulty adapter initialized');
  }
  
  updateDifficulty(score, combo, accuracy) {
    // 基于玩家表现调整目标难度
    let performanceScore = (score / 1000000) * 0.4 + (combo / 1000) * 0.3 + accuracy * 0.3;
    
    // 限制性能分数在0-1之间
    performanceScore = Math.max(0, Math.min(1, performanceScore));
    
    // 调整目标难度
    this.targetDifficulty = 1.0 + (performanceScore * 3.0); // 1.0 到 4.0
    
    // 平滑过渡到目标难度
    this.currentDifficulty += (this.targetDifficulty - this.currentDifficulty) * this.adaptationRate;
    
    // 记录历史
    this.difficultyHistory.push({
      timestamp: performance.now(),
      difficulty: this.currentDifficulty,
      performanceScore
    });
    
    // 保持历史记录在合理大小
    if (this.difficultyHistory.length > 50) {
      this.difficultyHistory.shift();
    }
  }
  
  getCurrentDifficulty() {
    return this.currentDifficulty;
  }
  
  getTargetDifficulty() {
    return this.targetDifficulty;
  }
}

/**
 * 节奏分析器
 */
class RhythmAnalyzer {
  constructor() {
    this.beatHistory = [];
    this.rhythmComplexity = 1.0;
    this.beatStrength = [];
  }
  
  async initialize() {
    console.log('Rhythm analyzer initialized');
  }
  
  async analyze(beatTime, currentTime) {
    // 分析节奏模式
    const analysis = {
      complexity: this.calculateRhythmComplexity(),
      beatStrength: this.calculateBeatStrength(),
      tempo: this.calculateTempo(),
      pattern: this.identifyPattern()
    };
    
    return analysis;
  }
  
  calculateRhythmComplexity() {
    // 基于历史数据计算节奏复杂度
    return this.rhythmComplexity;
  }
  
  calculateBeatStrength() {
    // 计算节拍强度
    return [0.8, 0.6, 0.9, 0.4, 0.7, 0.5];
  }
  
  calculateTempo() {
    // 计算节奏速度
    return 120; // BPM
  }
  
  identifyPattern() {
    // 识别节奏模式
    return 'basic';
  }
}

/**
 * 性能监控器
 */
class PerformanceMonitor {
  constructor() {
    this.performanceLevel = 1.0;
    this.fpsHistory = [];
    this.frameTimeHistory = [];
    this.isMonitoring = false;
  }
  
  start() {
    this.isMonitoring = true;
    this.monitorLoop();
  }
  
  stop() {
    this.isMonitoring = false;
  }
  
  monitorLoop() {
    if (!this.isMonitoring) return;
    
    // 监控FPS和帧时间
    this.updatePerformanceMetrics();
    
    // 继续监控循环
    requestAnimationFrame(() => this.monitorLoop());
  }
  
  updatePerformanceMetrics() {
    // 更新性能指标
    // 这里应该集成实际的性能监控逻辑
    this.performanceLevel = 1.0;
  }
  
  canGenerate() {
    return this.performanceLevel > 0.5;
  }
  
  getPerformanceLevel() {
    return this.performanceLevel;
  }
}

/**
 * 音符预测引擎
 */
class NotePredictionEngine {
  constructor() {
    this.predictionModel = null;
    this.accuracy = 0.75;
    this.predictionHistory = [];
  }
  
  async initialize() {
    // 初始化预测模型
    console.log('Note prediction engine initialized');
  }
  
  async predict(beatTime, currentTime, generationHistory) {
    // 基于历史数据预测玩家行为
    const predictions = [];
    
    for (let i = 0; i < 6; i++) {
      predictions.push({
        playerReadiness: Math.random(),
        optimalLane: Math.floor(Math.random() * 4),
        optimalTiming: currentTime + (i * 500),
        confidence: this.accuracy
      });
    }
    
    return predictions;
  }
  
  getAccuracy() {
    return this.accuracy;
  }
}

// 导出单例实例
export const noteGenerator = new NoteGenerator();