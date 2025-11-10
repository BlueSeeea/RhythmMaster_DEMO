/**
 * 游戏循环优化器 - 解决性能问题和内存泄漏
 * 提供自适应帧率、智能调度和性能监控
 */
export class GameLoopOptimizer {
  constructor(options = {}) {
    this.targetFPS = options.targetFPS || 60;
    this.minFPS = options.minFPS || 30;
    this.maxFrameSkip = options.maxFrameSkip || 5;
    this.enableAdaptive = options.enableAdaptive !== false;
    this.enableMonitoring = options.enableMonitoring !== false;
    this.enableThrottling = options.enableThrottling !== false;
    
    // 性能监控
    this.performanceMetrics = {
      frameCount: 0,
      lastFrameTime: 0,
      avgFrameTime: 0,
      maxFrameTime: 0,
      minFrameTime: Infinity,
      fps: 0,
      targetFrameTime: 1000 / this.targetFPS,
      frameTimeHistory: [],
      maxHistorySize: 60,
      droppedFrames: 0,
      totalFrames: 0
    };
    
    // 任务调度
    this.taskQueue = [];
    this.highPriorityTasks = new Set();
    this.mediumPriorityTasks = new Set();
    this.lowPriorityTasks = new Set();
    
    // 自适应控制
    this.adaptiveSettings = {
      currentFPS: this.targetFPS,
      frameSkip: 0,
      qualityLevel: 1.0, // 1.0 = 最高质量，0.5 = 最低质量
      updateInterval: 1000, // 毫秒
      lastUpdate: 0,
      performanceScore: 1.0
    };
    
    // 节流控制
    this.throttling = {
      enabled: this.enableThrottling,
      threshold: 0.8, // 80% 帧时间使用率
      cooldown: 1000, // 毫秒
      lastThrottle: 0
    };
    
    // 内存管理
    this.memoryManagement = {
      gcInterval: 30000, // 30秒
      lastGC: 0,
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      cleanupScheduled: false
    };
    
    // 运行状态
    this.isRunning = false;
    this.animationId = null;
    this.lastTimestamp = 0;
    this.accumulator = 0;
    this.deltaTime = 0;
    
    // 错误处理
    this.errorCount = 0;
    this.lastErrorTime = 0;
    this.maxErrors = 10;
    this.errorCooldown = 5000;
    
    // 绑定方法
    this.gameLoop = this.gameLoop.bind(this);
    this.handleError = this.handleError.bind(this);
  }
  
  /**
   * 注册任务
   */
  registerTask(name, task, priority = 'medium', options = {}) {
    const taskInfo = {
      name,
      task,
      priority,
      enabled: true,
      lastExecution: 0,
      executionCount: 0,
      avgExecutionTime: 0,
      maxExecutionTime: 0,
      skipCount: 0,
      interval: options.interval || 0,
      maxSkip: options.maxSkip || 3,
      adaptive: options.adaptive !== false,
      quality: options.quality || 1.0
    };
    
    switch (priority) {
      case 'high':
        this.highPriorityTasks.add(taskInfo);
        break;
      case 'medium':
        this.mediumPriorityTasks.add(taskInfo);
        break;
      case 'low':
        this.lowPriorityTasks.add(taskInfo);
        break;
      default:
        this.mediumPriorityTasks.add(taskInfo);
    }
    
    return taskInfo;
  }
  
  /**
   * 注销任务
   */
  unregisterTask(name) {
    const removeFromSet = (set, taskName) => {
      for (const task of set) {
        if (task.name === taskName) {
          set.delete(task);
          return true;
        }
      }
      return false;
    };
    
    return removeFromSet(this.highPriorityTasks, name) ||
           removeFromSet(this.mediumPriorityTasks, name) ||
           removeFromSet(this.lowPriorityTasks, name);
  }
  
  /**
   * 启用/禁用任务
   */
  setTaskEnabled(name, enabled) {
    const findTask = (set, taskName) => {
      for (const task of set) {
        if (task.name === taskName) {
          task.enabled = enabled;
          return true;
        }
      }
      return false;
    };
    
    return findTask(this.highPriorityTasks, name) ||
           findTask(this.mediumPriorityTasks, name) ||
           findTask(this.lowPriorityTasks, name);
  }
  
  /**
   * 启动游戏循环
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.adaptiveSettings.lastUpdate = this.lastTimestamp;
    this.memoryManagement.lastGC = this.lastTimestamp;
    
    // 启动循环
    this.animationId = requestAnimationFrame(this.gameLoop);
    
    console.log(`Game loop started (target FPS: ${this.targetFPS})`);
  }
  
  /**
   * 停止游戏循环
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    console.log('Game loop stopped');
  }
  
  /**
   * 游戏循环主函数
   */
  gameLoop(currentTime) {
    if (!this.isRunning) return;
    
    try {
      // 计算时间差
      this.deltaTime = currentTime - this.lastTimestamp;
      this.lastTimestamp = currentTime;
      
      // 性能监控
      if (this.enableMonitoring) {
        this.updatePerformanceMetrics(currentTime);
      }
      
      // 自适应调整
      if (this.enableAdaptive) {
        this.performAdaptiveAdjustment(currentTime);
      }
      
      // 内存管理
      this.performMemoryManagement(currentTime);
      
      // 执行高优先级任务
      this.executeTaskSet(this.highPriorityTasks, currentTime);
      
      // 帧跳过逻辑
      if (this.shouldSkipFrame(currentTime)) {
        this.performanceMetrics.droppedFrames++;
      } else {
        // 执行中优先级任务
        this.executeTaskSet(this.mediumPriorityTasks, currentTime);
        
        // 执行低优先级任务（可能被跳过）
        if (!this.isThrottled(currentTime)) {
          this.executeTaskSet(this.lowPriorityTasks, currentTime);
        }
      }
      
      // 更新性能指标
      this.performanceMetrics.totalFrames++;
      
      // 继续循环
      this.animationId = requestAnimationFrame(this.gameLoop);
      
    } catch (error) {
      this.handleError(error);
    }
  }
  
  /**
   * 更新性能指标
   */
  updatePerformanceMetrics(currentTime) {
    const frameTime = currentTime - this.performanceMetrics.lastFrameTime;
    this.performanceMetrics.lastFrameTime = currentTime;
    
    // 更新帧时间历史
    this.performanceMetrics.frameTimeHistory.push(frameTime);
    if (this.performanceMetrics.frameTimeHistory.length > this.performanceMetrics.maxHistorySize) {
      this.performanceMetrics.frameTimeHistory.shift();
    }
    
    // 计算平均帧时间
    const avgFrameTime = this.performanceMetrics.frameTimeHistory.reduce((a, b) => a + b, 0) / 
                        this.performanceMetrics.frameTimeHistory.length;
    
    this.performanceMetrics.avgFrameTime = avgFrameTime;
    this.performanceMetrics.fps = 1000 / avgFrameTime;
    
    // 更新最大/最小帧时间
    this.performanceMetrics.maxFrameTime = Math.max(this.performanceMetrics.maxFrameTime, frameTime);
    this.performanceMetrics.minFrameTime = Math.min(this.performanceMetrics.minFrameTime, frameTime);
  }
  
  /**
   * 执行自适应调整
   */
  performAdaptiveAdjustment(currentTime) {
    if (currentTime - this.adaptiveSettings.lastUpdate < this.adaptiveSettings.updateInterval) {
      return;
    }
    
    const currentFPS = this.performanceMetrics.fps;
    const targetFPS = this.targetFPS;
    const minFPS = this.minFPS;
    
    // 计算性能分数
    let performanceScore = 1.0;
    
    if (currentFPS < targetFPS * 0.8) {
      // 性能不足，降低质量
      performanceScore = Math.max(0.5, currentFPS / targetFPS);
    } else if (currentFPS > targetFPS * 1.2) {
      // 性能充足，可以提高质量
      performanceScore = Math.min(1.0, (currentFPS - targetFPS) / targetFPS + 1.0);
    }
    
    this.adaptiveSettings.performanceScore = performanceScore;
    this.adaptiveSettings.qualityLevel = performanceScore;
    
    // 调整任务质量
    this.adjustTaskQuality(performanceScore);
    
    // 调整帧跳过
    if (currentFPS < minFPS) {
      this.adaptiveSettings.frameSkip = Math.min(this.maxFrameSkip, 
        this.adaptiveSettings.frameSkip + 1);
    } else if (currentFPS > targetFPS) {
      this.adaptiveSettings.frameSkip = Math.max(0, this.adaptiveSettings.frameSkip - 1);
    }
    
    this.adaptiveSettings.lastUpdate = currentTime;
    
    // 记录调整信息
    if (this.enableMonitoring) {
      console.log(`Adaptive: FPS=${currentFPS.toFixed(1)}, Score=${performanceScore.toFixed(2)}, Skip=${this.adaptiveSettings.frameSkip}`);
    }
  }
  
  /**
   * 调整任务质量
   */
  adjustTaskQuality(qualityScore) {
    const adjustTaskSet = (taskSet) => {
      for (const task of taskSet) {
        if (task.adaptive) {
          task.quality = Math.max(0.1, Math.min(1.0, qualityScore * task.quality));
        }
      }
    };
    
    adjustTaskSet(this.mediumPriorityTasks);
    adjustTaskSet(this.lowPriorityTasks);
  }
  
  /**
   * 是否应该跳过帧
   */
  shouldSkipFrame(currentTime) {
    if (this.adaptiveSettings.frameSkip <= 0) return false;
    
    return this.performanceMetrics.totalFrames % (this.adaptiveSettings.frameSkip + 1) !== 0;
  }
  
  /**
   * 是否节流
   */
  isThrottled(currentTime) {
    if (!this.throttling.enabled) return false;
    
    const frameTime = this.performanceMetrics.avgFrameTime;
    const targetFrameTime = this.performanceMetrics.targetFrameTime;
    const utilization = frameTime / targetFrameTime;
    
    if (utilization > this.throttling.threshold) {
      if (currentTime - this.throttling.lastThrottle > this.throttling.cooldown) {
        this.throttling.lastThrottle = currentTime;
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 执行任务集合
   */
  executeTaskSet(taskSet, currentTime) {
    for (const taskInfo of taskSet) {
      if (!taskInfo.enabled) continue;
      
      // 检查间隔
      if (taskInfo.interval > 0) {
        if (currentTime - taskInfo.lastExecution < taskInfo.interval) continue;
      }
      
      // 检查跳过次数
      if (taskInfo.skipCount > taskInfo.maxSkip) {
        // 强制执行，重置跳过计数
        taskInfo.skipCount = 0;
      }
      
      try {
        const startTime = performance.now();
        
        // 执行任务
        taskInfo.task(taskInfo.quality, currentTime);
        
        const executionTime = performance.now() - startTime;
        
        // 更新任务指标
        taskInfo.lastExecution = currentTime;
        taskInfo.executionCount++;
        taskInfo.maxExecutionTime = Math.max(taskInfo.maxExecutionTime, executionTime);
        
        // 更新平均执行时间
        taskInfo.avgExecutionTime = (taskInfo.avgExecutionTime * (taskInfo.executionCount - 1) + executionTime) / taskInfo.executionCount;
        
        // 检查执行时间是否过长
        if (executionTime > this.performanceMetrics.targetFrameTime * 0.5) {
          // 任务执行时间过长，增加跳过计数
          taskInfo.skipCount++;
          
          if (this.enableMonitoring) {
            console.warn(`Task ${taskInfo.name} took ${executionTime.toFixed(2)}ms (quality: ${taskInfo.quality})`);
          }
        } else {
          taskInfo.skipCount = 0; // 重置跳过计数
        }
        
      } catch (error) {
        this.handleError(error);
        taskInfo.skipCount++; // 出错时增加跳过计数
      }
    }
  }
  
  /**
   * 内存管理
   */
  performMemoryManagement(currentTime) {
    // 定期垃圾回收
    if (currentTime - this.memoryManagement.lastGC > this.memoryManagement.gcInterval) {
      this.scheduleGarbageCollection();
      this.memoryManagement.lastGC = currentTime;
    }
    
    // 内存使用监控
    if (performance.memory) {
      const usedMemory = performance.memory.usedJSHeapSize;
      if (usedMemory > this.memoryManagement.memoryThreshold) {
        this.performMemoryCleanup();
      }
    }
  }
  
  /**
   * 调度垃圾回收
   */
  scheduleGarbageCollection() {
    if (this.memoryManagement.cleanupScheduled) return;
    
    this.memoryManagement.cleanupScheduled = true;
    
    // 在下一帧空闲时执行垃圾回收
    requestIdleCallback(() => {
      if (window.gc) {
        try {
          window.gc();
          console.log('Manual garbage collection performed');
        } catch (error) {
          console.warn('Garbage collection not available');
        }
      }
      this.memoryManagement.cleanupScheduled = false;
    }, { timeout: 100 });
  }
  
  /**
   * 执行内存清理
   */
  performMemoryCleanup() {
    // 清理低优先级任务
    for (const task of this.lowPriorityTasks) {
      if (task.skipCount > task.maxSkip * 2) {
        task.enabled = false;
        console.warn(`Disabled task ${task.name} due to memory pressure`);
      }
    }
    
    // 清理历史数据
    if (this.performanceMetrics.frameTimeHistory.length > 30) {
      this.performanceMetrics.frameTimeHistory = this.performanceMetrics.frameTimeHistory.slice(-30);
    }
  }
  
  /**
   * 错误处理
   */
  handleError(error) {
    this.errorCount++;
    this.lastErrorTime = performance.now();
    
    console.error('Game loop error:', error);
    
    // 如果错误过多，停止游戏循环
    if (this.errorCount > this.maxErrors) {
      console.error('Too many errors, stopping game loop');
      this.stop();
    }
    
    // 错误冷却
    if (performance.now() - this.lastErrorTime < this.errorCooldown) {
      return;
    }
    
    this.errorCount = 0;
  }
  
  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      fps: {
        current: this.performanceMetrics.fps.toFixed(1),
        target: this.targetFPS,
        min: this.minFPS
      },
      frameTime: {
        avg: this.performanceMetrics.avgFrameTime.toFixed(2) + 'ms',
        max: this.performanceMetrics.maxFrameTime.toFixed(2) + 'ms',
        min: this.performanceMetrics.minFrameTime === Infinity ? 'N/A' : this.performanceMetrics.minFrameTime.toFixed(2) + 'ms',
        target: this.performanceMetrics.targetFrameTime.toFixed(2) + 'ms'
      },
      quality: {
        level: (this.adaptiveSettings.qualityLevel * 100).toFixed(0) + '%',
        score: this.adaptiveSettings.performanceScore.toFixed(2),
        frameSkip: this.adaptiveSettings.frameSkip
      },
      tasks: {
        high: this.highPriorityTasks.size,
        medium: this.mediumPriorityTasks.size,
        low: this.lowPriorityTasks.size
      },
      errors: {
        count: this.errorCount,
        threshold: this.maxErrors
      },
      frames: {
        total: this.performanceMetrics.totalFrames,
        dropped: this.performanceMetrics.droppedFrames,
        dropRate: this.performanceMetrics.totalFrames > 0 
          ? (this.performanceMetrics.droppedFrames / this.performanceMetrics.totalFrames * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }
  
  /**
   * 获取任务统计
   */
  getTaskStats() {
    const getTaskSetStats = (taskSet) => {
      const stats = [];
      for (const task of taskSet) {
        stats.push({
          name: task.name,
          priority: task.priority,
          enabled: task.enabled,
          executions: task.executionCount,
          avgTime: task.avgExecutionTime.toFixed(2) + 'ms',
          maxTime: task.maxExecutionTime.toFixed(2) + 'ms',
          skipCount: task.skipCount,
          quality: (task.quality * 100).toFixed(0) + '%'
        });
      }
      return stats;
    };
    
    return {
      high: getTaskSetStats(this.highPriorityTasks),
      medium: getTaskSetStats(this.mediumPriorityTasks),
      low: getTaskSetStats(this.lowPriorityTasks)
    };
  }
  
  /**
   * 清理资源
   */
  destroy() {
    this.stop();
    
    this.highPriorityTasks.clear();
    this.mediumPriorityTasks.clear();
    this.lowPriorityTasks.clear();
    
    this.performanceMetrics.frameTimeHistory = [];
  }
}

/**
 * 节奏大师专用的游戏循环管理器
 */
export class RhythmMasterGameLoop extends GameLoopOptimizer {
  constructor(options = {}) {
    super({
      targetFPS: 60,
      minFPS: 30,
      enableAdaptive: true,
      enableMonitoring: true,
      enableThrottling: true,
      ...options
    });
    
    // 节奏大师特定的任务
    this.noteUpdateTask = null;
    this.collisionDetectionTask = null;
    this.animationUpdateTask = null;
    this.difficultyAdjustmentTask = null;
    this.scoreUpdateTask = null;
    this.uiUpdateTask = null;
    
    this.setupRhythmMasterTasks();
  }
  
  /**
   * 设置节奏大师特定的任务
   */
  setupRhythmMasterTasks() {
    // 音符更新（高优先级）
    this.noteUpdateTask = this.registerTask(
      'noteUpdate',
      this.updateNotes.bind(this),
      'high',
      { interval: 16, maxSkip: 1 } // 60fps，不能跳过太多
    );
    
    // 碰撞检测（高优先级）
    this.collisionDetectionTask = this.registerTask(
      'collisionDetection',
      this.detectCollisions.bind(this),
      'high',
      { interval: 16, maxSkip: 2 }
    );
    
    // 动画更新（中优先级）
    this.animationUpdateTask = this.registerTask(
      'animationUpdate',
      this.updateAnimations.bind(this),
      'medium',
      { interval: 33, maxSkip: 3 } // 30fps
    );
    
    // 难度调整（低优先级）
    this.difficultyAdjustmentTask = this.registerTask(
      'difficultyAdjustment',
      this.adjustDifficulty.bind(this),
      'low',
      { interval: 1000, maxSkip: 5 } // 1秒一次
    );
    
    // 分数更新（中优先级）
    this.scoreUpdateTask = this.registerTask(
      'scoreUpdate',
      this.updateScore.bind(this),
      'medium',
      { interval: 100, maxSkip: 2 } // 10fps
    );
    
    // UI更新（低优先级）
    this.uiUpdateTask = this.registerTask(
      'uiUpdate',
      this.updateUI.bind(this),
      'low',
      { interval: 200, maxSkip: 5 } // 5fps
    );
  }
  
  /**
   * 更新音符
   */
  updateNotes(quality, timestamp) {
    // 这里应该调用实际的音符更新逻辑
    // 质量参数可以用来调整更新的精度
    const updateQuality = Math.round(quality * 10) / 10;
    
    // 示例：根据质量调整更新频率
    if (updateQuality < 0.7) {
      // 低质量模式：减少音符数量或更新频率
      this.performEfficientNoteUpdate();
    } else {
      // 正常模式：完整更新
      this.performFullNoteUpdate();
    }
  }
  
  /**
   * 高效音符更新（低质量模式）
   */
  performEfficientNoteUpdate() {
    // 只更新关键音符
    // 减少计算量
    // 使用近似算法
  }
  
  /**
   * 完整音符更新（高质量模式）
   */
  performFullNoteUpdate() {
    // 更新所有音符
    // 精确计算
    // 完整物理模拟
  }
  
  /**
   * 碰撞检测
   */
  detectCollisions(quality, timestamp) {
    const detectionQuality = Math.round(quality * 10) / 10;
    
    if (detectionQuality < 0.8) {
      // 低质量模式：使用简单碰撞检测
      this.performEfficientCollisionDetection();
    } else {
      // 高质量模式：使用精确碰撞检测
      this.performFullCollisionDetection();
    }
  }
  
  /**
   * 高效碰撞检测
   */
  performEfficientCollisionDetection() {
    // 使用边界框检测
    // 减少检测频率
    // 近似算法
  }
  
  /**
   * 完整碰撞检测
   */
  performFullCollisionDetection() {
    // 精确碰撞检测
    // 像素级检测
    // 复杂形状检测
  }
  
  /**
   * 更新动画
   */
  updateAnimations(quality, timestamp) {
    const animationQuality = Math.round(quality * 10) / 10;
    
    if (animationQuality < 0.6) {
      // 低质量模式：跳过复杂动画
      this.performEfficientAnimationUpdate();
    } else {
      // 高质量模式：完整动画更新
      this.performFullAnimationUpdate();
    }
  }
  
  /**
   * 高效动画更新
   */
  performEfficientAnimationUpdate() {
    // 只更新关键动画
    // 减少粒子效果
    // 简化过渡效果
  }
  
  /**
   * 完整动画更新
   */
  performFullAnimationUpdate() {
    // 更新所有动画
    // 完整粒子系统
    // 复杂过渡效果
  }
  
  /**
   * 调整难度
   */
  adjustDifficulty(quality, timestamp) {
    // 根据性能调整游戏难度
    const performance = this.getPerformanceStats();
    
    if (performance.fps.current < 45) {
      // 性能不足，降低难度
      this.reduceGameComplexity();
    } else if (performance.fps.current > 55) {
      // 性能充足，可以增加难度
      this.increaseGameComplexity();
    }
  }
  
  /**
   * 降低游戏复杂度
   */
  reduceGameComplexity() {
    // 减少同时出现的音符数量
    // 降低特效复杂度
    // 简化背景动画
  }
  
  /**
   * 增加游戏复杂度
   */
  increaseGameComplexity() {
    // 增加音符数量
    // 添加更多特效
    // 启用高级动画
  }
  
  /**
   * 更新分数
   */
  updateScore(quality, timestamp) {
    // 分数更新逻辑
    // 质量参数可以用来调整更新频率
  }
  
  /**
   * 更新UI
   */
  updateUI(quality, timestamp) {
    const uiQuality = Math.round(quality * 10) / 10;
    
    if (uiQuality < 0.5) {
      // 低质量模式：减少UI更新
      this.performEfficientUIUpdate();
    } else {
      // 高质量模式：完整UI更新
      this.performFullUIUpdate();
    }
  }
  
  /**
   * 高效UI更新
   */
  performEfficientUIUpdate() {
    // 只更新关键UI元素
    // 减少DOM操作
    // 使用CSS变换代替重绘
  }
  
  /**
   * 完整UI更新
   */
  performFullUIUpdate() {
    // 更新所有UI元素
    // 完整动画效果
    // 实时数据更新
  }
  
  /**
   * 设置音符更新函数
   */
  setNoteUpdateFunction(updateFunction) {
    this.updateNotes = updateFunction;
  }
  
  /**
   * 设置碰撞检测函数
   */
  setCollisionDetectionFunction(detectionFunction) {
    this.detectCollisions = detectionFunction;
  }
  
  /**
   * 设置动画更新函数
   */
  setAnimationUpdateFunction(updateFunction) {
    this.updateAnimations = updateFunction;
  }
  
  /**
   * 获取节奏大师特定的统计
   */
  getRhythmMasterStats() {
    const baseStats = this.getPerformanceStats();
    const taskStats = this.getTaskStats();
    
    return {
      ...baseStats,
      tasks: taskStats,
      gameSpecific: {
        noteUpdateRate: this.getTaskExecutionRate('noteUpdate'),
        collisionDetectionRate: this.getTaskExecutionRate('collisionDetection'),
        animationUpdateRate: this.getTaskExecutionRate('animationUpdate'),
        uiUpdateRate: this.getTaskExecutionRate('uiUpdate')
      }
    };
  }
  
  /**
   * 获取任务执行率
   */
  getTaskExecutionRate(taskName) {
    const findTask = (set, name) => {
      for (const task of set) {
        if (task.name === name) {
          return task;
        }
      }
      return null;
    };
    
    let task = findTask(this.highPriorityTasks, taskName);
    if (!task) task = findTask(this.mediumPriorityTasks, taskName);
    if (!task) task = findTask(this.lowPriorityTasks, taskName);
    
    if (!task) return 0;
    
    const totalFrames = this.performanceMetrics.totalFrames;
    const expectedExecutions = totalFrames / (task.interval / 16.67); // 假设60fps
    
    return task.executionCount / expectedExecutions;
  }
}

// 导出单例实例
export const gameLoop = new RhythmMasterGameLoop();