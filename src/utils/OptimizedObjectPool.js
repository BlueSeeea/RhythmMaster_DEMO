/**
 * 优化的对象池管理器 - 解决内存泄漏问题
 * 提供自动清理、内存监控和高效的对象复用机制
 */
export class OptimizedObjectPool {
  constructor(options = {}) {
    // 配置选项
    this.maxSize = options.maxSize || 100;
    this.minSize = options.minSize || 10;
    this.cleanupInterval = options.cleanupInterval || 30000; // 30秒清理一次
    this.maxIdleTime = options.maxIdleTime || 60000; // 60秒空闲后清理
    this.enableMonitoring = options.enableMonitoring || true;
    
    // 内部状态
    this.available = []; // 可用对象池
    this.inUse = new WeakSet(); // 正在使用的对象（使用WeakSet避免内存泄漏）
    this.objectMetadata = new WeakMap(); // 对象元数据（创建时间、最后使用时间等）
    this.totalCreated = 0;
    this.totalReused = 0;
    this.totalReleased = 0;
    
    // 清理定时器
    this.cleanupTimer = null;
    this.isDestroyed = false;
    
    // 性能监控
    this.metrics = {
      hitRate: 0,
      missRate: 0,
      avgPoolSize: 0,
      peakPoolSize: 0,
      memorySavings: 0
    };
    
    // 启动自动清理
    this.startAutoCleanup();
  }
  
  /**
   * 从池中获取对象
   */
  acquire() {
    if (this.isDestroyed) {
      throw new Error('Object pool has been destroyed');
    }
    
    let obj;
    let fromPool = false;
    
    // 从可用池中获取对象
    if (this.available.length > 0) {
      obj = this.available.pop();
      fromPool = true;
      this.totalReused++;
    } else {
      // 创建新对象
      obj = this.createObject();
      this.totalCreated++;
    }
    
    // 标记为正在使用
    this.inUse.add(obj);
    
    // 记录元数据
    const now = Date.now();
    this.objectMetadata.set(obj, {
      acquiredAt: now,
      lastUsed: now,
      reuseCount: (this.objectMetadata.get(obj)?.reuseCount || 0) + 1
    });
    
    // 重置对象状态
    this.resetObject(obj);
    
    // 更新指标
    this.updateMetrics(fromPool);
    
    return obj;
  }
  
  /**
   * 将对象释放回池中
   */
  release(obj) {
    if (this.isDestroyed || !obj) return false;
    
    // 检查对象是否正在使用
    if (!this.inUse.has(obj)) {
      console.warn('Attempting to release an object not in use');
      return false;
    }
    
    // 清理对象状态
    this.cleanupObject(obj);
    
    // 更新元数据
    const metadata = this.objectMetadata.get(obj);
    if (metadata) {
      metadata.lastUsed = Date.now();
    }
    
    // 从使用中移除
    this.inUse.delete(obj);
    
    // 如果池未满，回收对象
    if (this.available.length < this.maxSize) {
      this.available.push(obj);
      this.totalReleased++;
    } else {
      // 池已满，销毁对象以帮助垃圾回收
      this.destroyObject(obj);
    }
    
    return true;
  }
  
  /**
   * 批量释放对象
   */
  releaseAll(objects) {
    if (!Array.isArray(objects)) return;
    
    // 批量处理以提高性能
    const toRelease = objects.filter(obj => this.inUse.has(obj));
    toRelease.forEach(obj => this.release(obj));
  }
  
  /**
   * 创建新对象（子类可重写）
   */
  createObject() {
    // 默认实现，子类应重写此方法
    return {};
  }
  
  /**
   * 重置对象状态（子类可重写）
   */
  resetObject(obj) {
    // 默认实现，子类应重写此方法
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        if (key !== '_pool' && key !== '_toBeRemoved') {
          delete obj[key];
        }
      });
    }
  }
  
  /**
   * 清理对象（子类可重写）
   */
  cleanupObject(obj) {
    // 默认实现，子类应重写此方法
    this.resetObject(obj);
  }
  
  /**
   * 销毁对象（子类可重写）
   */
  destroyObject(obj) {
    // 默认实现，子类可重写此方法
    if (obj && typeof obj === 'object') {
      this.objectMetadata.delete(obj);
      Object.keys(obj).forEach(key => delete obj[key]);
    }
  }
  
  /**
   * 获取池状态信息
   */
  getStats() {
    const total = this.available.length + this.inUse.length;
    const hitRate = this.totalCreated > 0 ? (this.totalReused / (this.totalReused + this.totalCreated)) * 100 : 0;
    
    return {
      available: this.available.length,
      inUse: this.inUse.length,
      total: total,
      hitRate: hitRate.toFixed(2) + '%',
      totalCreated: this.totalCreated,
      totalReused: this.totalReused,
      totalReleased: this.totalReleased,
      maxSize: this.maxSize,
      minSize: this.minSize,
      peakSize: this.metrics.peakPoolSize,
      memorySavings: this.calculateMemorySavings()
    };
  }
  
  /**
   * 计算内存节省
   */
  calculateMemorySavings() {
    // 估算每个对象平均占用内存（字节）
    const avgObjectSize = 128; // 音符对象平均大小
    const bytesSaved = this.totalReused * avgObjectSize;
    
    // 转换为更友好的单位
    if (bytesSaved > 1024 * 1024) {
      return (bytesSaved / (1024 * 1024)).toFixed(2) + ' MB';
    } else if (bytesSaved > 1024) {
      return (bytesSaved / 1024).toFixed(2) + ' KB';
    }
    
    return bytesSaved + ' B';
  }
  
  /**
   * 更新性能指标
   */
  updateMetrics(fromPool) {
    const totalRequests = this.totalCreated + this.totalReused;
    if (totalRequests === 0) return;
    
    this.metrics.hitRate = (this.totalReused / totalRequests) * 100;
    this.metrics.missRate = 100 - this.metrics.hitRate;
    
    const currentSize = this.available.length + this.inUse.length;
    this.metrics.peakPoolSize = Math.max(this.metrics.peakPoolSize, currentSize);
  }
  
  /**
   * 自动清理机制
   */
  startAutoCleanup() {
    if (this.cleanupTimer || this.isDestroyed) return;
    
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);
  }
  
  /**
   * 执行清理操作
   */
  performCleanup() {
    if (this.isDestroyed) return;
    
    const now = Date.now();
    const toRemove = [];
    
    // 检查可用池中的对象
    for (let i = this.available.length - 1; i >= 0; i--) {
      const obj = this.available[i];
      const metadata = this.objectMetadata.get(obj);
      
      if (metadata && (now - metadata.lastUsed) > this.maxIdleTime) {
        toRemove.push(i);
      }
    }
    
    // 移除过期对象
    toRemove.forEach(index => {
      const obj = this.available.splice(index, 1)[0];
      this.destroyObject(obj);
    });
    
    // 确保池大小不低于最小值
    if (this.available.length < this.minSize) {
      this.preallocate(this.minSize - this.available.length);
    }
    
    // 如果池过大，释放多余对象
    if (this.available.length > this.maxSize) {
      const excess = this.available.splice(this.maxSize);
      excess.forEach(obj => this.destroyObject(obj));
    }
  }
  
  /**
   * 预分配对象
   */
  preallocate(count) {
    for (let i = 0; i < count; i++) {
      const obj = this.createObject();
      this.available.push(obj);
    }
  }
  
  /**
   * 销毁池并清理所有资源
   */
  destroy() {
    this.isDestroyed = true;
    
    // 停止自动清理
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // 清理所有对象
    this.available.forEach(obj => this.destroyObject(obj));
    this.available = [];
    
    // 清理WeakSet和WeakMap
    this.inUse = new WeakSet();
    this.objectMetadata = new WeakMap();
    
    // 重置统计
    this.totalCreated = 0;
    this.totalReused = 0;
    this.totalReleased = 0;
  }
}

/**
 * 音符对象池 - 专门用于管理音符对象
 */
export class NoteObjectPool extends OptimizedObjectPool {
  constructor(options = {}) {
    super({
      maxSize: 150, // 音符池最大容量
      minSize: 20,   // 最小预分配数量
      cleanupInterval: 20000, // 20秒清理一次
      maxIdleTime: 45000, // 45秒空闲后清理
      enableMonitoring: true,
      ...options
    });
    
    // 预分配一些音符对象
    this.preallocate(this.minSize);
  }
  
  /**
   * 创建音符对象
   */
  createObject() {
    return {
      id: '',
      lane: 0,
      position: 0,
      createdAt: 0,
      spacing: 0,
      hit: false,
      judgment: null,
      _pool: false,
      _toBeRemoved: false
    };
  }
  
  /**
   * 重置音符对象状态
   */
  resetObject(note) {
    if (!note) return;
    
    // 重置所有属性到默认值
    note.id = '';
    note.lane = 0;
    note.position = 0;
    note.createdAt = 0;
    note.spacing = 0;
    note.hit = false;
    note.judgment = null;
    note._pool = false;
    note._toBeRemoved = false;
  }
  
  /**
   * 清理音符对象
   */
  cleanupObject(note) {
    if (!note) return;
    
    // 清理内部引用
    note._pool = true;
    note._toBeRemoved = false;
    
    // 清理其他属性但不完全重置，因为对象可能还在使用
    if (note.hit) note.hit = false;
    if (note.judgment) note.judgment = null;
  }
  
  /**
   * 销毁音符对象
   */
  destroyObject(note) {
    if (!note) return;
    
    // 清理所有引用
    this.objectMetadata.delete(note);
    
    // 清理对象属性
    Object.keys(note).forEach(key => {
      if (typeof note[key] === 'object' && note[key] !== null) {
        note[key] = null; // 清理对象引用
      } else {
        delete note[key];
      }
    });
  }
  
  /**
   * 批量释放音符数组
   */
  releaseNotes(notesArray) {
    if (!Array.isArray(notesArray)) return;
    
    // 过滤出可以释放的音符
    const releasable = notesArray.filter(note => 
      note && !note._pool && this.inUse.has(note)
    );
    
    // 批量释放
    this.releaseAll(releasable);
  }
  
  /**
   * 获取池健康状态
   */
  getHealthStatus() {
    const stats = this.getStats();
    const issues = [];
    
    // 检查潜在问题
    if (stats.hitRate < 70) {
      issues.push('Low hit rate - consider increasing pool size');
    }
    
    if (stats.inUse > stats.total * 0.8) {
      issues.push('High usage rate - pool may be undersized');
    }
    
    if (this.available.length < this.minSize) {
      issues.push('Pool size below minimum threshold');
    }
    
    return {
      healthy: issues.length === 0,
      issues: issues,
      recommendations: this.getRecommendations(issues)
    };
  }
  
  /**
   * 获取优化建议
   */
  getRecommendations(issues) {
    const recommendations = [];
    
    issues.forEach(issue => {
      if (issue.includes('hit rate')) {
        recommendations.push('Increase maxSize to improve object reuse');
      }
      if (issue.includes('usage rate')) {
        recommendations.push('Consider increasing maxSize or reducing object creation rate');
      }
      if (issue.includes('minimum')) {
        recommendations.push('Increase minSize for better performance');
      }
    });
    
    return recommendations;
  }
  
  /**
   * 初始化对象池
   */
  async initialize() {
    console.log('🎵 Initializing Note Object Pool...');
    
    // 确保池已预分配最小数量的对象
    if (this.available.length < this.minSize) {
      this.preallocate(this.minSize - this.available.length);
    }
    
    console.log(`✅ Note Object Pool initialized with ${this.available.length} available objects`);
    return true;
  }
  
  /**
   * 验证对象池状态
   */
  async validate() {
    const healthStatus = this.getHealthStatus();
    return healthStatus.healthy;
  }
}

/**
 * 全局音符池实例
 */
let globalNotePool = null;

/**
 * 获取全局音符池实例（单例模式）
 */
export function getGlobalNotePool() {
  if (!globalNotePool) {
    globalNotePool = new NoteObjectPool();
  }
  return globalNotePool;
}

/**
 * 销毁全局音符池
 */
export function destroyGlobalNotePool() {
  if (globalNotePool) {
    globalNotePool.destroy();
    globalNotePool = null;
  }
}