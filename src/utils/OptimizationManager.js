/**
 * 优化管理器 - 整合所有修复方案
 * 提供统一的接口来管理和协调各种优化器
 */
import { OptimizedObjectPool, getGlobalNotePool } from './OptimizedObjectPool.js';
import { AudioResourcePool } from './AudioResourcePool.js';
import { GameLoopOptimizer } from './GameLoopOptimizer.js';
import { PerformanceOptimizer } from './PerformanceOptimizer.js';
import { collisionDetector } from './CollisionDetector.js';
import { noteGenerator } from './NoteGenerator.js';
import { dynamicDifficultySystem } from './DynamicDifficulty.js';

export class OptimizationManager {
  constructor(options = {}) {
    this.options = {
      // 全局配置
      enableAllOptimizations: true,
      optimizationLevel: 1.0, // 0.0 - 1.0
      autoAdjustOptimization: true,
      
      // 性能阈值
      targetFPS: 60,
      minFPS: 30,
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      maxAudioLatency: 50, // 毫秒
      
      // 监控配置
      enablePerformanceMonitoring: true,
      monitoringInterval: 1000, // 毫秒
      logLevel: 'info', // debug, info, warn, error
      
      // 恢复策略
      enableAutoRecovery: true,
      recoveryThreshold: 0.3, // 性能低于30%时触发恢复
      
      // 优化器配置
      optimizers: {
        objectPool: true,
        audioPool: true,
        gameLoop: true,
        performance: true,
        collision: true,
        noteGeneration: true,
        difficulty: true
      },
      
      ...options
    };
    
    // 优化器实例
    this.optimizers = new Map();
    this.isInitialized = false;
    this.isRunning = false;
    
    // 性能监控
    this.performanceMonitor = new GlobalPerformanceMonitor();
    
    // 事件系统
    this.eventEmitter = new EventEmitter();
    
    // 状态管理
    this.systemStatus = {
      health: 'healthy', // healthy, warning, critical
      performance: 1.0,
      memoryUsage: 0,
      fps: 60,
      activeOptimizers: 0,
      totalOptimizers: 0,
      lastCheckTime: 0
    };
    
    // 错误恢复
    this.errorRecovery = new ErrorRecoveryManager();
    
    // 配置验证
    this.validateConfiguration();
    
    // 绑定方法
    this.initialize = this.initialize.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.update = this.update.bind(this);
  }
  
  /**
   * 初始化优化管理器
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Optimization Manager...');
      
      // 初始化性能监控
      await this.performanceMonitor.initialize();
      
      // 初始化错误恢复
      await this.errorRecovery.initialize();
      
      // 初始化各个优化器
      await this.initializeOptimizers();
      
      // 验证优化器状态
      await this.validateOptimizers();
      
      // 设置事件监听
      this.setupEventListeners();
      
      this.isInitialized = true;
      this.systemStatus.totalOptimizers = this.optimizers.size;
      
      console.log('✅ Optimization Manager initialized successfully');
      console.log(`📊 Active optimizers: ${this.systemStatus.totalOptimizers}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Optimization Manager:', error);
      this.systemStatus.health = 'critical';
      throw error;
    }
  }
  
  /**
   * 初始化各个优化器
   */
  async initializeOptimizers() {
    const optimizerConfigs = [
       {
         name: 'objectPool',
         instance: getGlobalNotePool(),
         enabled: this.options.optimizers.objectPool,
         priority: 1
       },
       {
         name: 'audioPool',
         instance: new AudioResourcePool(),
         enabled: this.options.optimizers.audioPool,
         priority: 1
       },
       {
         name: 'gameLoop',
         instance: new GameLoopOptimizer(),
         enabled: this.options.optimizers.gameLoop,
         priority: 2
       },
       {
         name: 'performance',
         instance: new PerformanceOptimizer(),
         enabled: this.options.optimizers.performance,
         priority: 2
       },
       {
         name: 'collision',
         instance: collisionDetector,
         enabled: this.options.optimizers.collision,
         priority: 3
       },
       {
         name: 'noteGeneration',
         instance: noteGenerator,
         enabled: this.options.optimizers.noteGeneration,
         priority: 3
       },
       {
         name: 'difficulty',
         instance: dynamicDifficultySystem,
         enabled: this.options.optimizers.difficulty,
         priority: 4
       }
     ];
     
     // 按优先级排序
     optimizerConfigs.sort((a, b) => a.priority - b.priority);
     
     // 初始化每个优化器
     for (const config of optimizerConfigs) {
       if (config.enabled) {
         try {
           await config.instance.initialize();
           this.optimizers.set(config.name, {
             instance: config.instance,
             status: 'initialized',
             priority: config.priority,
             stats: this.createOptimizerStats()
           });
           
           console.log(`✅ ${config.name} optimizer initialized`);
           
         } catch (error) {
           console.error(`❌ Failed to initialize ${config.name} optimizer:`, error);
           
           if (config.priority === 1) { // 关键优化器
             throw new Error(`Critical optimizer ${config.name} failed to initialize`);
           } else {
             // 非关键优化器可以继续
             this.optimizers.set(config.name, {
               instance: null,
               status: 'failed',
               priority: config.priority,
               error: error.message,
               stats: this.createOptimizerStats()
             });
           }
         }
       }
     }
   }
   
   /**
    * 创建优化器统计对象
    */
   createOptimizerStats() {
     return {
       totalOperations: 0,
       successfulOperations: 0,
       failedOperations: 0,
       avgOperationTime: 0,
       lastOperationTime: 0,
       performanceImprovement: 0,
       memorySaved: 0,
       errors: []
     };
   }
   
   /**
    * 验证优化器
    */
   async validateOptimizers() {
     const validationResults = new Map();
     
     for (const [name, optimizer] of this.optimizers) {
       try {
         if (optimizer.instance && typeof optimizer.instance.validate === 'function') {
           const isValid = await optimizer.instance.validate();
           validationResults.set(name, isValid);
           
           if (!isValid) {
             console.warn(`⚠️ ${name} optimizer validation failed`);
             optimizer.status = 'warning';
           }
         } else {
           validationResults.set(name, true);
         }
         
       } catch (error) {
         console.error(`❌ ${name} optimizer validation error:`, error);
         validationResults.set(name, false);
         optimizer.status = 'error';
       }
     }
     
     return validationResults;
   }
   
   /**
    * 设置事件监听器
    */
   setupEventListeners() {
     // 监听性能警告
     this.performanceMonitor.on('performance-warning', (data) => {
       console.warn('⚠️ Performance warning:', data);
       this.handlePerformanceWarning(data);
     });
     
     // 监听性能下降
     this.performanceMonitor.on('performance-degraded', (data) => {
       console.error('🚨 Performance degraded:', data);
       this.handlePerformanceDegradation(data);
     });
     
     // 监听错误
     this.errorRecovery.on('error-detected', (error) => {
       console.error('💥 Error detected:', error);
       this.handleError(error);
     });
   }
   
   /**
    * 启动优化管理器
    */
   async start() {
     if (!this.isInitialized) {
       throw new Error('Optimization Manager must be initialized before starting');
     }
     
     try {
       console.log('🚀 Starting Optimization Manager...');
       
       // 启动各个优化器
       await this.startOptimizers();
       
       // 启动性能监控
       if (this.options.enablePerformanceMonitoring) {
         this.performanceMonitor.start();
       }
       
       // 启动错误恢复
       if (this.options.enableAutoRecovery) {
         this.errorRecovery.start();
       }
       
       this.isRunning = true;
       this.systemStatus.health = 'healthy';
       
       console.log('✅ Optimization Manager started successfully');
       
       return true;
       
     } catch (error) {
       console.error('❌ Failed to start Optimization Manager:', error);
       this.systemStatus.health = 'critical';
       throw error;
     }
   }
   
   /**
    * 启动各个优化器
    */
   async startOptimizers() {
     const startPromises = [];
     
     for (const [name, optimizer] of this.optimizers) {
       if (optimizer.instance && optimizer.status !== 'failed') {
         try {
           const startPromise = this.startOptimizer(name, optimizer);
           startPromises.push(startPromise);
           
         } catch (error) {
           console.error(`❌ Failed to start ${name} optimizer:`, error);
           optimizer.status = 'error';
         }
       }
     }
     
     await Promise.allSettled(startPromises);
   }
   
   /**
    * 启动单个优化器
    */
   async startOptimizer(name, optimizer) {
     try {
       if (typeof optimizer.instance.start === 'function') {
         await optimizer.instance.start();
       }
       
       optimizer.status = 'running';
       this.systemStatus.activeOptimizers++;
       
       console.log(`🚀 ${name} optimizer started`);
       
     } catch (error) {
       console.error(`❌ Failed to start ${name} optimizer:`, error);
       optimizer.status = 'error';
       optimizer.error = error.message;
     }
   }
   
   /**
    * 停止优化管理器
    */
   async stop() {
     if (!this.isRunning) {
       return;
     }
     
     try {
       console.log('⏹️ Stopping Optimization Manager...');
       
       // 停止性能监控
       this.performanceMonitor.stop();
       
       // 停止错误恢复
       this.errorRecovery.stop();
       
       // 停止各个优化器
       await this.stopOptimizers();
       
       this.isRunning = false;
       this.systemStatus.health = 'stopped';
       
       console.log('⏹️ Optimization Manager stopped');
       
     } catch (error) {
       console.error('❌ Error stopping Optimization Manager:', error);
       throw error;
     }
   }
   
   /**
    * 停止各个优化器
    */
   async stopOptimizers() {
     const stopPromises = [];
     
     for (const [name, optimizer] of this.optimizers) {
       if (optimizer.instance && optimizer.status === 'running') {
         try {
           const stopPromise = this.stopOptimizer(name, optimizer);
           stopPromises.push(stopPromise);
           
         } catch (error) {
           console.error(`❌ Error stopping ${name} optimizer:`, error);
         }
       }
     }
     
     await Promise.allSettled(stopPromises);
   }
   
   /**
    * 停止单个优化器
    */
   async stopOptimizer(name, optimizer) {
     try {
       if (typeof optimizer.instance.stop === 'function') {
         await optimizer.instance.stop();
       }
       
       optimizer.status = 'stopped';
       this.systemStatus.activeOptimizers--;
       
       console.log(`⏹️ ${name} optimizer stopped`);
       
     } catch (error) {
       console.error(`❌ Error stopping ${name} optimizer:`, error);
     }
   }
   
   /**
    * 更新优化管理器
    */
   async update(deltaTime) {
     if (!this.isRunning) {
       return;
     }
     
     try {
       // 更新性能监控
       await this.performanceMonitor.update(deltaTime);
       
       // 更新系统状态
       await this.updateSystemStatus();
       
       // 更新各个优化器
       await this.updateOptimizers(deltaTime);
       
       // 自动调整优化级别
       if (this.options.autoAdjustOptimization) {
         await this.autoAdjustOptimization();
       }
       
     } catch (error) {
       console.error('❌ Error updating Optimization Manager:', error);
       await this.errorRecovery.handleError(error);
     }
   }
   
   /**
    * 更新系统状态
    */
   async updateSystemStatus() {
     const performance = this.performanceMonitor.getPerformanceMetrics();
     
     this.systemStatus = {
       ...this.systemStatus,
       performance: performance.overall,
       memoryUsage: performance.memoryUsage,
       fps: performance.fps,
       lastCheckTime: Date.now()
     };
     
     // 更新健康状态
     if (performance.overall < this.options.recoveryThreshold) {
       this.systemStatus.health = 'critical';
     } else if (performance.overall < 0.6) {
       this.systemStatus.health = 'warning';
     } else {
       this.systemStatus.health = 'healthy';
     }
   }
   
   /**
    * 更新各个优化器
    */
   async updateOptimizers(deltaTime) {
     const updatePromises = [];
     
     for (const [name, optimizer] of this.optimizers) {
       if (optimizer.instance && optimizer.status === 'running') {
         try {
           const updatePromise = this.updateOptimizer(name, optimizer, deltaTime);
           updatePromises.push(updatePromise);
           
         } catch (error) {
           console.error(`❌ Error updating ${name} optimizer:`, error);
           optimizer.status = 'error';
         }
       }
     }
     
     await Promise.allSettled(updatePromises);
   }
   
   /**
    * 更新单个优化器
    */
   async updateOptimizer(name, optimizer, deltaTime) {
     try {
       const startTime = performance.now();
       
       if (typeof optimizer.instance.update === 'function') {
         await optimizer.instance.update(deltaTime);
       }
       
       const operationTime = performance.now() - startTime;
       
       // 更新统计
       optimizer.stats.totalOperations++;
       optimizer.stats.lastOperationTime = operationTime;
       optimizer.stats.avgOperationTime = 
         (optimizer.stats.avgOperationTime * (optimizer.stats.totalOperations - 1) + operationTime) / 
         optimizer.stats.totalOperations;
       
     } catch (error) {
       console.error(`❌ Error in ${name} optimizer:`, error);
       optimizer.stats.failedOperations++;
       optimizer.stats.errors.push({
         timestamp: Date.now(),
         error: error.message
       });
       
       // 保持错误记录在合理大小
       if (optimizer.stats.errors.length > 10) {
         optimizer.stats.errors.shift();
       }
     }
   }
   
   /**
    * 自动调整优化级别
    */
   async autoAdjustOptimization() {
     const performance = this.systemStatus.performance;
     
     if (performance < 0.5) {
       // 性能较差，降低优化级别
       this.options.optimizationLevel = Math.max(0.1, this.options.optimizationLevel - 0.1);
       
     } else if (performance > 0.8) {
       // 性能良好，可以提高优化级别
       this.options.optimizationLevel = Math.min(1.0, this.options.optimizationLevel + 0.05);
     }
     
     // 应用优化级别到各个优化器
     for (const [name, optimizer] of this.optimizers) {
       if (optimizer.instance && typeof optimizer.instance.setOptimizationLevel === 'function') {
         try {
           await optimizer.instance.setOptimizationLevel(this.options.optimizationLevel);
         } catch (error) {
           console.warn(`⚠️ Failed to set optimization level for ${name}:`, error);
         }
       }
     }
   }
   
   /**
    * 处理性能警告
    */
   handlePerformanceWarning(data) {
     console.warn('🔄 Handling performance warning...');
     
     // 降低优化级别
     this.options.optimizationLevel = Math.max(0.3, this.options.optimizationLevel - 0.2);
     
     // 触发优化器调整
     this.eventEmitter.emit('optimization-adjustment', {
       reason: 'performance-warning',
       level: this.options.optimizationLevel,
       data
     });
   }
   
   /**
    * 处理性能下降
    */
   handlePerformanceDegradation(data) {
     console.error('🚨 Handling performance degradation...');
     
     // 大幅降低优化级别
     this.options.optimizationLevel = Math.max(0.1, this.options.optimizationLevel - 0.4);
     
     // 触发紧急优化
     this.eventEmitter.emit('emergency-optimization', {
       reason: 'performance-degradation',
       level: this.options.optimizationLevel,
       data
     });
   }
   
    /**
    * 处理错误
    */
   handleError(error) {
     console.error('💥 Handling error:', error);
     
     // 尝试恢复
     if (this.options.enableAutoRecovery) {
       this.errorRecovery.attemptRecovery(error);
     }
   }
   
   /**
    * 获取优化器
    */
   getOptimizer(name) {
     const optimizer = this.optimizers.get(name);
     return optimizer ? optimizer.instance : null;
   }
   
   /**
    * 获取系统状态
    */
   getSystemStatus() {
     return {
       ...this.systemStatus,
       optimizationLevel: this.options.optimizationLevel,
       uptime: this.isRunning ? Date.now() - this.systemStatus.lastCheckTime : 0,
       optimizers: this.getOptimizersStatus()
     };
   }
   
   /**
    * 获取优化器状态
    */
   getOptimizersStatus() {
     const status = {};
     
     for (const [name, optimizer] of this.optimizers) {
       status[name] = {
         status: optimizer.status,
         stats: optimizer.stats,
         error: optimizer.error || null
       };
     }
     
     return status;
   }
   
   /**
    * 获取性能报告
    */
   getPerformanceReport() {
     const systemStatus = this.getSystemStatus();
     const performanceMetrics = this.performanceMonitor.getPerformanceMetrics();
     
     return {
       system: systemStatus,
       performance: performanceMetrics,
       optimizers: this.generateOptimizerReport(),
       recommendations: this.generateRecommendations(),
       timestamp: Date.now()
     };
   }
   
   /**
    * 生成优化器报告
    */
   generateOptimizerReport() {
     const report = {};
     
     for (const [name, optimizer] of this.optimizers) {
       report[name] = {
         status: optimizer.status,
         efficiency: optimizer.stats.totalOperations > 0 ? 
           optimizer.stats.successfulOperations / optimizer.stats.totalOperations : 0,
         avgOperationTime: optimizer.stats.avgOperationTime,
         performanceImprovement: optimizer.stats.performanceImprovement,
         memorySaved: optimizer.stats.memorySaved,
         errorRate: optimizer.stats.totalOperations > 0 ? 
           optimizer.stats.failedOperations / optimizer.stats.totalOperations : 0
       };
     }
     
     return report;
   }
   
   /**
    * 生成优化建议
    */
   generateRecommendations() {
     const recommendations = [];
     const performance = this.systemStatus.performance;
     
     if (performance < 0.5) {
       recommendations.push({
         type: 'performance',
         priority: 'high',
         message: 'Performance is critically low. Consider reducing optimization level or disabling non-essential features.',
         action: 'reduce-optimization'
       });
     }
     
     if (this.systemStatus.memoryUsage > this.options.maxMemoryUsage) {
       recommendations.push({
         type: 'memory',
         priority: 'high',
         message: 'Memory usage is high. Consider running garbage collection or reducing object pool sizes.',
         action: 'memory-optimization'
       });
     }
     
     if (this.systemStatus.fps < this.options.minFPS) {
       recommendations.push({
         type: 'fps',
         priority: 'medium',
         message: 'FPS is below minimum threshold. Consider reducing visual complexity or disabling animations.',
         action: 'fps-optimization'
       });
     }
     
     return recommendations;
   }
   
   /**
    * 验证配置
    */
   validateConfiguration() {
     // 检查必要的依赖
     if (!this.options.optimizers.objectPool) {
       console.warn('⚠️ Object pool optimization is disabled. This may impact memory usage.');
     }
     
     if (!this.options.optimizers.audioPool) {
       console.warn('⚠️ Audio pool optimization is disabled. This may impact audio performance.');
     }
     
     // 验证性能阈值
     if (this.options.targetFPS < this.options.minFPS) {
       throw new Error('Target FPS must be greater than or equal to minimum FPS');
     }
   }
   
   /**
    * 清理资源
    */
   async destroy() {
     try {
       console.log('🧹 Cleaning up Optimization Manager...');
       
       // 停止运行
       await this.stop();
       
       // 销毁各个优化器
       for (const [name, optimizer] of this.optimizers) {
         if (optimizer.instance && typeof optimizer.instance.destroy === 'function') {
           try {
             await optimizer.instance.destroy();
           } catch (error) {
             console.error(`❌ Error destroying ${name} optimizer:`, error);
           }
         }
       }
       
       // 清理资源
       this.optimizers.clear();
       this.performanceMonitor.destroy();
       this.errorRecovery.destroy();
       
       console.log('🧹 Optimization Manager cleaned up');
       
     } catch (error) {
       console.error('❌ Error destroying Optimization Manager:', error);
     }
   }
}

/**
 * 全局性能监控器
 */
class GlobalPerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: 60,
      frameTime: 16.67,
      memoryUsage: 0,
      overall: 1.0,
      lastUpdate: 0
    };
    
    this.isMonitoring = false;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    
    // 事件发射器
    this.events = new Map();
  }
  
  async initialize() {
    console.log('📊 Global Performance Monitor initialized');
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
    
    this.updateMetrics();
    this.checkPerformanceThresholds();
    
    requestAnimationFrame(() => this.monitorLoop());
  }
  
  updateMetrics() {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    // 计算FPS
    this.frameCount++;
    if (this.frameCount % 60 === 0) { // 每秒更新一次
      this.metrics.fps = Math.round(1000 / deltaTime);
      this.metrics.frameTime = deltaTime;
    }
    
    // 估算内存使用（简化版）
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
    }
    
    // 计算总体性能
    const fpsScore = Math.min(1.0, this.metrics.fps / 60);
    const memoryScore = Math.min(1.0, (100 * 1024 * 1024) / Math.max(1, this.metrics.memoryUsage));
    
    this.metrics.overall = (fpsScore + memoryScore) / 2;
    this.metrics.lastUpdate = currentTime;
    this.lastFrameTime = currentTime;
  }
  
  checkPerformanceThresholds() {
    if (this.metrics.overall < 0.3) {
      this.emit('performance-degraded', this.metrics);
    } else if (this.metrics.overall < 0.6) {
      this.emit('performance-warning', this.metrics);
    }
  }
  
  update(deltaTime) {
    // 更新监控器状态
  }
  
  getPerformanceMetrics() {
    return { ...this.metrics };
  }
  
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(callback);
  }
  
  emit(event, data) {
    if (this.events.has(event)) {
      this.events.get(event).forEach(callback => callback(data));
    }
  }
  
  destroy() {
    this.stop();
    this.events.clear();
  }
}

/**
 * 简单的事件发射器
 */
class EventEmitter {
  constructor() {
    this.events = new Map();
  }
  
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(callback);
  }
  
  emit(event, data) {
    if (this.events.has(event)) {
      this.events.get(event).forEach(callback => callback(data));
    }
  }
  
  off(event, callback) {
    if (this.events.has(event)) {
      const callbacks = this.events.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
}

/**
 * 错误恢复管理器
 */
class ErrorRecoveryManager extends EventEmitter {
  constructor() {
    super();
    this.recoveryStrategies = new Map();
    this.errorHistory = [];
    this.isRecovering = false;
  }
  
  async initialize() {
    console.log('🔧 Error Recovery Manager initialized');
    this.setupRecoveryStrategies();
  }
  
  start() {
    // 启动错误监控
  }
  
  stop() {
    // 停止错误监控
  }
  
  setupRecoveryStrategies() {
    // 设置各种错误恢复策略
    this.recoveryStrategies.set('memory-error', this.handleMemoryError);
    this.recoveryStrategies.set('performance-error', this.handlePerformanceError);
    this.recoveryStrategies.set('audio-error', this.handleAudioError);
    this.recoveryStrategies.set('collision-error', this.handleCollisionError);
  }
  
  async handleError(error) {
    console.error('🔧 Handling error:', error);
    
    // 记录错误
    this.errorHistory.push({
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack
    });
    
    // 尝试恢复
    await this.attemptRecovery(error);
  }
  
  async attemptRecovery(error) {
    if (this.isRecovering) {
      return; // 避免重复恢复
    }
    
    this.isRecovering = true;
    
    try {
      // 根据错误类型选择恢复策略
      const errorType = this.classifyError(error);
      const recoveryStrategy = this.recoveryStrategies.get(errorType);
      
      if (recoveryStrategy) {
        await recoveryStrategy.call(this, error);
      } else {
        await this.defaultRecovery(error);
      }
      
    } catch (recoveryError) {
      console.error('❌ Recovery failed:', recoveryError);
    } finally {
      this.isRecovering = false;
    }
  }
  
  classifyError(error) {
    // 分类错误类型
    if (error.message.includes('memory')) {
      return 'memory-error';
    } else if (error.message.includes('performance')) {
      return 'performance-error';
    } else if (error.message.includes('audio')) {
      return 'audio-error';
    } else if (error.message.includes('collision')) {
      return 'collision-error';
    }
    
    return 'unknown-error';
  }
  
  async handleMemoryError(error) {
    console.log('🧹 Attempting memory recovery...');
    // 执行内存清理
  }
  
  async handlePerformanceError(error) {
    console.log('⚡ Attempting performance recovery...');
    // 执行性能恢复
  }
  
  async handleAudioError(error) {
    console.log('🔊 Attempting audio recovery...');
    // 执行音频恢复
  }
  
  async handleCollisionError(error) {
    console.log('💥 Attempting collision recovery...');
    // 执行碰撞恢复
  }
  
  async defaultRecovery(error) {
    console.log('🔧 Attempting default recovery...');
    // 执行默认恢复策略
  }
  
  destroy() {
    this.recoveryStrategies.clear();
    this.errorHistory = [];
  }
}

// 导出单例实例
export const optimizationManager = new OptimizationManager();