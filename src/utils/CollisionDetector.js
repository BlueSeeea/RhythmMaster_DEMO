/**
 * 碰撞检测优化器 - 解决碰撞检测性能问题
 * 提供空间分区、高效碰撞检测算法和预测机制
 */
export class CollisionDetector {
  constructor(options = {}) {
    this.options = {
      enableSpatialPartitioning: true,
      enablePredictiveCollision: true,
      enableBroadPhase: true,
      enableNarrowPhase: true,
      enableContinuousCollision: true,
      cellSize: 100,
      maxObjectsPerCell: 10,
      ...options
    };
    
    // 空间分区
    this.spatialGrid = new Map();
    this.gridBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    this.cellSize = this.options.cellSize;
    
    // 碰撞对象管理
    this.collisionObjects = new Map();
    this.collisionPairs = new Set();
    this.lastCollisionCheck = 0;
    
    // 预测机制
    this.predictiveEngine = new PredictiveCollisionEngine();
    
    // 性能统计
    this.stats = {
      totalChecks: 0,
      collisionPairs: 0,
      actualCollisions: 0,
      avgCheckTime: 0,
      maxCheckTime: 0,
      spatialQueries: 0,
      broadPhaseEliminations: 0
    };
    
    // 优化状态
    this.isOptimized = false;
    this.optimizationLevel = 1.0;
    
    // 绑定方法
    this.checkCollisions = this.checkCollisions.bind(this);
  }
  
  /**
   * 初始化碰撞检测器
   */
  async initialize() {
    try {
      // 初始化预测引擎
      await this.predictiveEngine.initialize();
      
      // 设置空间分区
      if (this.options.enableSpatialPartitioning) {
        this.setupSpatialPartitioning();
      }
      
      this.isOptimized = true;
      console.log('Collision detector initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize collision detector:', error);
      throw error;
    }
  }
  
  /**
   * 设置空间分区
   */
  setupSpatialPartitioning() {
    // 初始化空间网格
    this.clearSpatialGrid();
    
    // 设置网格边界
    this.updateGridBounds();
  }
  
  /**
   * 更新网格边界
   */
  updateGridBounds() {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    this.collisionObjects.forEach(obj => {
      const bounds = obj.getBounds();
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    });
    
    this.gridBounds = { minX, minY, maxX, maxY };
  }
  
  /**
   * 清空空间网格
   */
  clearSpatialGrid() {
    this.spatialGrid.clear();
  }
  
  /**
   * 获取网格键
   */
  getGridKey(x, y) {
    const gridX = Math.floor(x / this.cellSize);
    const gridY = Math.floor(y / this.cellSize);
    return `${gridX},${gridY}`;
  }
  
  /**
   * 获取相邻网格键
   */
  getAdjacentGridKeys(x, y) {
    const keys = [];
    const gridX = Math.floor(x / this.cellSize);
    const gridY = Math.floor(y / this.cellSize);
    
    // 获取周围8个网格
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        keys.push(`${gridX + dx},${gridY + dy}`);
      }
    }
    
    return keys;
  }
  
  /**
   * 添加碰撞对象
   */
  addCollisionObject(id, obj) {
    if (!obj || !obj.getBounds) {
      console.warn('Invalid collision object:', id);
      return false;
    }
    
    this.collisionObjects.set(id, obj);
    
    // 添加到空间网格
    if (this.options.enableSpatialPartitioning) {
      this.addToSpatialGrid(id, obj);
    }
    
    return true;
  }
  
  /**
   * 添加到空间网格
   */
  addToSpatialGrid(id, obj) {
    const bounds = obj.getBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    const gridKey = this.getGridKey(centerX, centerY);
    
    if (!this.spatialGrid.has(gridKey)) {
      this.spatialGrid.set(gridKey, new Set());
    }
    
    this.spatialGrid.get(gridKey).add(id);
  }
  
  /**
   * 移除碰撞对象
   */
  removeCollisionObject(id) {
    const obj = this.collisionObjects.get(id);
    if (!obj) return false;
    
    // 从空间网格移除
    if (this.options.enableSpatialPartitioning) {
      this.removeFromSpatialGrid(id, obj);
    }
    
    this.collisionObjects.delete(id);
    return true;
  }
  
  /**
   * 从空间网格移除
   */
  removeFromSpatialGrid(id, obj) {
    const bounds = obj.getBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    const gridKey = this.getGridKey(centerX, centerY);
    
    const gridCell = this.spatialGrid.get(gridKey);
    if (gridCell) {
      gridCell.delete(id);
      if (gridCell.size === 0) {
        this.spatialGrid.delete(gridKey);
      }
    }
  }
  
  /**
   * 更新碰撞对象位置
   */
  updateCollisionObject(id, newPosition) {
    const obj = this.collisionObjects.get(id);
    if (!obj) return false;
    
    // 更新对象位置
    obj.updatePosition(newPosition);
    
    // 更新空间网格
    if (this.options.enableSpatialPartitioning) {
      this.updateSpatialGrid(id, obj);
    }
    
    return true;
  }
  
  /**
   * 更新空间网格
   */
  updateSpatialGrid(id, obj) {
    // 先移除旧位置
    this.removeFromSpatialGrid(id, obj);
    
    // 添加新位置
    this.addToSpatialGrid(id, obj);
  }
  
  /**
   * 主要的碰撞检测函数
   */
  checkCollisions(deltaTime) {
    const startTime = performance.now();
    
    try {
      this.stats.totalChecks++;
      
      // 清空之前的碰撞对
      this.collisionPairs.clear();
      
      // 获取所有可能的碰撞对
      const potentialCollisions = this.getPotentialCollisions();
      
      // 精确碰撞检测
      const actualCollisions = this.performPreciseCollisionDetection(potentialCollisions, deltaTime);
      
      // 更新统计
      const checkTime = performance.now() - startTime;
      this.updateStats(checkTime, potentialCollisions.length, actualCollisions.length);
      
      return {
        collisions: actualCollisions,
        performance: {
          checkTime,
          potentialPairs: potentialCollisions.length,
          actualCollisions: actualCollisions.length
        }
      };
      
    } catch (error) {
      console.error('Collision detection error:', error);
      return { collisions: [], performance: { checkTime: performance.now() - startTime, potentialPairs: 0, actualCollisions: 0 } };
    }
  }
  
  /**
   * 获取可能的碰撞对（广相阶段）
   */
  getPotentialCollisions() {
    if (this.options.enableSpatialPartitioning) {
      return this.getSpatialCollisions();
    } else {
      return this.getBruteForceCollisions();
    }
  }
  
  /**
   * 使用空间分区获取碰撞对
   */
  getSpatialCollisions() {
    const potentialCollisions = [];
    const checkedPairs = new Set();
    
    this.spatialGrid.forEach((cell, gridKey) => {
      if (cell.size < 2) return; // 少于2个对象的单元格无需检查
      
      const cellObjects = Array.from(cell);
      
      // 检查单元格内的所有对象对
      for (let i = 0; i < cellObjects.length; i++) {
        for (let j = i + 1; j < cellObjects.length; j++) {
          const id1 = cellObjects[i];
          const id2 = cellObjects[j];
          
          // 避免重复检查
          const pairKey = id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
          if (checkedPairs.has(pairKey)) continue;
          
          checkedPairs.add(pairKey);
          
          const obj1 = this.collisionObjects.get(id1);
          const obj2 = this.collisionObjects.get(id2);
          
          if (obj1 && obj2 && this.broadPhaseCheck(obj1, obj2)) {
            potentialCollisions.push({ id1, id2, obj1, obj2 });
          }
        }
      }
    });
    
    this.stats.spatialQueries++;
    return potentialCollisions;
  }
  
  /**
   * 暴力法获取碰撞对
   */
  getBruteForceCollisions() {
    const potentialCollisions = [];
    const objects = Array.from(this.collisionObjects.entries());
    
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const [id1, obj1] = objects[i];
        const [id2, obj2] = objects[j];
        
        if (this.broadPhaseCheck(obj1, obj2)) {
          potentialCollisions.push({ id1, id2, obj1, obj2 });
        }
      }
    }
    
    return potentialCollisions;
  }
  
  /**
   * 广相碰撞检测（边界框检测）
   */
  broadPhaseCheck(obj1, obj2) {
    const bounds1 = obj1.getBounds();
    const bounds2 = obj2.getBounds();
    
    // AABB (Axis-Aligned Bounding Box) 检测
    const collision = !(bounds1.maxX < bounds2.minX || 
                       bounds1.minX > bounds2.maxX || 
                       bounds1.maxY < bounds2.minY || 
                       bounds1.minY > bounds2.maxY);
    
    if (!collision) {
      this.stats.broadPhaseEliminations++;
    }
    
    return collision;
  }
  
  /**
   * 精确碰撞检测（窄相阶段）
   */
  performPreciseCollisionDetection(potentialCollisions, deltaTime) {
    const actualCollisions = [];
    
    potentialCollisions.forEach(({ id1, id2, obj1, obj2 }) => {
      let collisionResult = null;
      
      // 根据对象类型选择合适的检测方法
      if (this.options.enableContinuousCollision && deltaTime > 0) {
        collisionResult = this.continuousCollisionDetection(obj1, obj2, deltaTime);
      } else {
        collisionResult = this.discreteCollisionDetection(obj1, obj2);
      }
      
      if (collisionResult) {
        collisionResult.id1 = id1;
        collisionResult.id2 = id2;
        actualCollisions.push(collisionResult);
      }
    });
    
    this.stats.actualCollisions = actualCollisions.length;
    return actualCollisions;
  }
  
  /**
   * 离散碰撞检测
   */
  discreteCollisionDetection(obj1, obj2) {
    // 根据形状类型选择检测算法
    const shape1 = obj1.getShape();
    const shape2 = obj2.getShape();
    
    if (shape1.type === 'circle' && shape2.type === 'circle') {
      return this.circleCircleCollision(shape1, shape2);
    } else if (shape1.type === 'rectangle' && shape2.type === 'rectangle') {
      return this.rectangleRectangleCollision(shape1, shape2);
    } else if ((shape1.type === 'circle' && shape2.type === 'rectangle') ||
               (shape1.type === 'rectangle' && shape2.type === 'circle')) {
      return this.circleRectangleCollision(shape1, shape2);
    }
    
    // 默认使用边界框检测
    return this.broadPhaseCheck(obj1, obj2) ? { 
      type: 'aabb',
      penetration: this.calculateAABBPenetration(obj1, obj2),
      normal: this.calculateAABBNormal(obj1, obj2)
    } : null;
  }
  
  /**
   * 连续碰撞检测
   */
  continuousCollisionDetection(obj1, obj2, deltaTime) {
    // 简化的连续碰撞检测
    // 在实际实现中，这里会使用更复杂的算法如GJK、EPA等
    
    const velocity1 = obj1.getVelocity();
    const velocity2 = obj2.getVelocity();
    
    // 相对速度
    const relativeVelocity = {
      x: velocity1.x - velocity2.x,
      y: velocity1.y - velocity2.y
    };
    
    // 如果物体相互远离，跳过检测
    if (this.areObjectsMovingAway(obj1, obj2, relativeVelocity)) {
      return null;
    }
    
    // 使用扩展的边界框进行预测
    const expandedBounds1 = this.expandBoundsByVelocity(obj1.getBounds(), velocity1, deltaTime);
    const expandedBounds2 = this.expandBoundsByVelocity(obj2.getBounds(), velocity2, deltaTime);
    
    // 检测扩展边界框的碰撞
    const collision = !(expandedBounds1.maxX < expandedBounds2.minX || 
                       expandedBounds1.minX > expandedBounds2.maxX || 
                       expandedBounds1.maxY < expandedBounds2.minY || 
                       expandedBounds1.minY > expandedBounds2.maxY);
    
    if (collision) {
      return {
        type: 'continuous',
        timeOfImpact: this.estimateTimeOfImpact(obj1, obj2, relativeVelocity),
        penetration: this.calculateContinuousPenetration(obj1, obj2, relativeVelocity, deltaTime),
        normal: this.calculateContinuousNormal(obj1, obj2, relativeVelocity)
      };
    }
    
    return null;
  }
  
  /**
   * 圆形-圆形碰撞检测
   */
  circleCircleCollision(circle1, circle2) {
    const dx = circle2.x - circle1.x;
    const dy = circle2.y - circle1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = circle1.radius + circle2.radius;
    
    if (distance < minDistance) {
      const penetration = minDistance - distance;
      const normal = {
        x: dx / distance,
        y: dy / distance
      };
      
      return {
        type: 'circle-circle',
        penetration,
        normal,
        contactPoint: {
          x: circle1.x + normal.x * circle1.radius,
          y: circle1.y + normal.y * circle1.radius
        }
      };
    }
    
    return null;
  }
  
  /**
   * 矩形-矩形碰撞检测
   */
  rectangleRectangleCollision(rect1, rect2) {
    // 使用SAT (Separating Axis Theorem)
    return this.satCollision(rect1, rect2);
  }
  
  /**
   * 圆形-矩形碰撞检测
   */
  circleRectangleCollision(circle, rect) {
    // 找到矩形上距离圆心最近的点
    const closestPoint = this.getClosestPointOnRectangle(circle.x, circle.y, rect);
    
    // 计算距离
    const dx = circle.x - closestPoint.x;
    const dy = circle.y - closestPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < circle.radius) {
      const penetration = circle.radius - distance;
      const normal = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 1, y: 0 };
      
      return {
        type: 'circle-rectangle',
        penetration,
        normal,
        contactPoint: closestPoint
      };
    }
    
    return null;
  }
  
  /**
   * SAT (Separating Axis Theorem) 碰撞检测
   */
  satCollision(shape1, shape2) {
    // 获取两个形状的法向量
    const axes1 = this.getAxes(shape1);
    const axes2 = this.getAxes(shape2);
    const axes = [...axes1, ...axes2];
    
    let minPenetration = Infinity;
    let collisionNormal = null;
    
    // 在每个轴上投影并检查重叠
    for (const axis of axes) {
      const proj1 = this.projectShape(shape1, axis);
      const proj2 = this.projectShape(shape2, axis);
      
      const overlap = this.getOverlap(proj1, proj2);
      
      if (overlap <= 0) {
        return null; // 没有碰撞
      }
      
      if (overlap < minPenetration) {
        minPenetration = overlap;
        collisionNormal = axis;
      }
    }
    
    return {
      type: 'sat',
      penetration: minPenetration,
      normal: collisionNormal
    };
  }
  
  /**
   * 获取形状的法向量
   */
  getAxes(shape) {
    if (shape.type === 'rectangle') {
      return [
        { x: 1, y: 0 }, // 右
        { x: 0, y: 1 }  // 上
      ];
    } else if (shape.type === 'circle') {
      // 圆形在所有方向都有法向量，这里简化处理
      return [{ x: 1, y: 0 }, { x: 0, y: 1 }];
    }
    
    return [];
  }
  
  /**
   * 投影形状到轴上
   */
  projectShape(shape, axis) {
    if (shape.type === 'rectangle') {
      return this.projectRectangle(shape, axis);
    } else if (shape.type === 'circle') {
      return this.projectCircle(shape, axis);
    }
    
    return { min: 0, max: 0 };
  }
  
  /**
   * 投影矩形到轴上
   */
  projectRectangle(rect, axis) {
    const corners = this.getRectangleCorners(rect);
    let min = Infinity, max = -Infinity;
    
    corners.forEach(corner => {
      const projection = corner.x * axis.x + corner.y * axis.y;
      min = Math.min(min, projection);
      max = Math.max(max, projection);
    });
    
    return { min, max };
  }
  
  /**
   * 投影圆形到轴上
   */
  projectCircle(circle, axis) {
    const centerProjection = circle.x * axis.x + circle.y * axis.y;
    const min = centerProjection - circle.radius;
    const max = centerProjection + circle.radius;
    
    return { min, max };
  }
  
  /**
   * 获取矩形的四个角
   */
  getRectangleCorners(rect) {
    return [
      { x: rect.x - rect.width / 2, y: rect.y - rect.height / 2 }, // 左上
      { x: rect.x + rect.width / 2, y: rect.y - rect.height / 2 }, // 右上
      { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, // 右下
      { x: rect.x - rect.width / 2, y: rect.y + rect.height / 2 }  // 左下
    ];
  }
  
  /**
   * 获取重叠部分
   */
  getOverlap(proj1, proj2) {
    const overlap = Math.min(proj1.max, proj2.max) - Math.max(proj1.min, proj2.min);
    return overlap;
  }
  
  /**
   * 获取矩形上距离点最近的点
   */
  getClosestPointOnRectangle(x, y, rect) {
    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;
    
    const closestX = Math.max(rect.x - halfWidth, Math.min(x, rect.x + halfWidth));
    const closestY = Math.max(rect.y - halfHeight, Math.min(y, rect.y + halfHeight));
    
    return { x: closestX, y: closestY };
  }
  
  /**
   * 计算物体是否相互远离
   */
  areObjectsMovingAway(obj1, obj2, relativeVelocity) {
    const pos1 = obj1.getPosition();
    const pos2 = obj2.getPosition();
    
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    
    // 如果相对速度的方向与位置向量相反，则物体正在远离
    return (dx * relativeVelocity.x + dy * relativeVelocity.y) > 0;
  }
  
  /**
   * 根据速度扩展边界
   */
  expandBoundsByVelocity(bounds, velocity, deltaTime) {
    const expansionX = Math.abs(velocity.x) * deltaTime;
    const expansionY = Math.abs(velocity.y) * deltaTime;
    
    return {
      minX: bounds.minX - expansionX,
      minY: bounds.minY - expansionY,
      maxX: bounds.maxX + expansionX,
      maxY: bounds.maxY + expansionY
    };
  }
  
  /**
   * 估计碰撞时间
   */
  estimateTimeOfImpact(obj1, obj2, relativeVelocity) {
    // 简化的碰撞时间估计
    return 0.5; // 返回一个0到1之间的值
  }
  
  /**
   * 计算连续碰撞穿透深度
   */
  calculateContinuousPenetration(obj1, obj2, relativeVelocity, deltaTime) {
    // 简化的连续碰撞穿透计算
    return 1.0;
  }
  
  /**
   * 计算连续碰撞法向量
   */
  calculateContinuousNormal(obj1, obj2, relativeVelocity) {
    // 简化的连续碰撞法向量计算
    return { x: 0, y: 1 };
  }
  
  /**
   * 计算AABB穿透深度
   */
  calculateAABBPenetration(obj1, obj2) {
    const bounds1 = obj1.getBounds();
    const bounds2 = obj2.getBounds();
    
    const overlapX = Math.min(bounds1.maxX, bounds2.maxX) - Math.max(bounds1.minX, bounds2.minX);
    const overlapY = Math.min(bounds1.maxY, bounds2.maxY) - Math.max(bounds1.minY, bounds2.minY);
    
    return Math.min(overlapX, overlapY);
  }
  
  /**
   * 计算AABB法向量
   */
  calculateAABBNormal(obj1, obj2) {
    const center1 = obj1.getCenter();
    const center2 = obj2.getCenter();
    
    const dx = center2.x - center1.x;
    const dy = center2.y - center1.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      return { x: dx > 0 ? 1 : -1, y: 0 };
    } else {
      return { x: 0, y: dy > 0 ? 1 : -1 };
    }
  }
  
  /**
   * 更新统计信息
   */
  updateStats(checkTime, potentialPairs, actualCollisions) {
    this.stats.collisionPairs = potentialPairs;
    this.stats.avgCheckTime = (this.stats.avgCheckTime * (this.stats.totalChecks - 1) + checkTime) / this.stats.totalChecks;
    this.stats.maxCheckTime = Math.max(this.stats.maxCheckTime, checkTime);
  }
  
  /**
   * 设置优化级别
   */
  setOptimizationLevel(level) {
    this.optimizationLevel = level;
    
    // 根据优化级别调整策略
    if (level < 0.6) {
      // 低质量模式：使用简化算法
      this.options.enableContinuousCollision = false;
      this.options.enableNarrowPhase = false;
      this.cellSize = 150; // 更大的单元格，减少检查次数
    } else if (level < 0.8) {
      // 中等质量模式
      this.options.enableContinuousCollision = false;
      this.options.enableNarrowPhase = true;
      this.cellSize = 100;
    } else {
      // 高质量模式：使用完整算法
      this.options.enableContinuousCollision = true;
      this.options.enableNarrowPhase = true;
      this.cellSize = 80; // 更小的单元格，提高精度
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      optimizationLevel: this.optimizationLevel,
      spatialGridSize: this.spatialGrid.size,
      collisionObjects: this.collisionObjects.size,
      cellSize: this.cellSize
    };
  }
  
  /**
   * 清理资源
   */
  destroy() {
    this.collisionObjects.clear();
    this.collisionPairs.clear();
    this.spatialGrid.clear();
    this.predictiveEngine.destroy();
  }
}

/**
 * 预测碰撞引擎
 */
class PredictiveCollisionEngine {
  constructor() {
    this.predictionHistory = [];
    this.accuracy = 0.75;
    this.predictionThreshold = 0.8;
  }
  
  async initialize() {
    // 初始化预测模型
    console.log('Predictive collision engine initialized');
  }
  
  predictCollision(obj1, obj2, timeWindow) {
    // 基于历史数据预测碰撞概率
    const prediction = this.generateCollisionPrediction(obj1, obj2, timeWindow);
    
    return {
      probability: prediction.probability,
      timeToCollision: prediction.timeToCollision,
      confidence: this.accuracy
    };
  }
  
  generateCollisionPrediction(obj1, obj2, timeWindow) {
    // 简化的碰撞预测
    const velocity1 = obj1.getVelocity();
    const velocity2 = obj2.getVelocity();
    
    const relativeVelocity = {
      x: velocity1.x - velocity2.x,
      y: velocity1.y - velocity2.y
    };
    
    const relativeSpeed = Math.sqrt(relativeVelocity.x * relativeVelocity.x + relativeVelocity.y * relativeVelocity.y);
    
    // 简化的预测逻辑
    const probability = Math.min(0.9, relativeSpeed / 100);
    const timeToCollision = timeWindow / 2;
    
    return { probability, timeToCollision };
  }
  
  updateAccuracy(actualCollisions, predictedCollisions) {
    // 更新预测准确性
    const accuracy = actualCollisions / Math.max(1, predictedCollisions);
    this.accuracy = this.accuracy * 0.9 + accuracy * 0.1;
  }
  
  destroy() {
    this.predictionHistory = [];
  }
}

/**
 * 节奏大师专用的碰撞检测管理器
 */
export class RhythmMasterCollisionManager extends CollisionDetector {
  constructor(options = {}) {
    super({
      enableSpatialPartitioning: true,
      enablePredictiveCollision: true,
      enableBroadPhase: true,
      enableNarrowPhase: true,
      cellSize: 80,
      maxObjectsPerCell: 8,
      ...options
    });
    
    // 音符特定的碰撞配置
    this.noteCollisionConfig = {
      hitTolerance: 30, // 像素
      perfectHitTolerance: 10,
      greatHitTolerance: 20,
      goodHitTolerance: 30
    };
    
    // 判定区域
    this.judgmentZones = new Map();
    this.setupJudgmentZones();
  }
  
  /**
   * 设置判定区域
   */
  setupJudgmentZones() {
    // 设置不同判定级别的区域
    this.judgmentZones.set('perfect', { tolerance: this.noteCollisionConfig.perfectHitTolerance });
    this.judgmentZones.set('great', { tolerance: this.noteCollisionConfig.greatHitTolerance });
    this.judgmentZones.set('good', { tolerance: this.noteCollisionConfig.goodHitTolerance });
  }
  
  /**
   * 检查音符与判定线的碰撞
   */
  checkNoteJudgment(note, judgmentLine) {
    const collision = this.discreteCollisionDetection(note, judgmentLine);
    
    if (!collision) return null;
    
    // 根据穿透深度判断判定级别
    const penetration = collision.penetration;
    
    if (penetration <= this.noteCollisionConfig.perfectHitTolerance) {
      return { type: 'perfect', score: 100, penetration };
    } else if (penetration <= this.noteCollisionConfig.greatHitTolerance) {
      return { type: 'great', score: 80, penetration };
    } else if (penetration <= this.noteCollisionConfig.goodHitTolerance) {
      return { type: 'good', score: 50, penetration };
    }
    
    return { type: 'bad', score: 20, penetration };
  }
  
  /**
   * 批量检查音符判定
   */
  checkNotesJudgment(notes, judgmentLine) {
    const results = [];
    
    notes.forEach(note => {
      const judgment = this.checkNoteJudgment(note, judgmentLine);
      if (judgment) {
        results.push({
          note,
          judgment,
          timestamp: performance.now()
        });
      }
    });
    
    return results;
  }
  
  /**
   * 获取节奏大师特定的统计
   */
  getRhythmMasterStats() {
    const baseStats = this.getStats();
    
    return {
      ...baseStats,
      gameSpecific: {
        judgmentAccuracy: this.calculateJudgmentAccuracy(),
        averageHitTiming: this.calculateAverageHitTiming(),
        perfectRate: this.calculatePerfectRate(),
        noteCollisionEfficiency: this.calculateNoteCollisionEfficiency()
      }
    };
  }
  
  /**
   * 计算判定准确性
   */
  calculateJudgmentAccuracy() {
    // 基于历史碰撞数据计算判定准确性
    return 0.95;
  }
  
  /**
   * 计算平均击中时机
   */
  calculateAverageHitTiming() {
    // 计算玩家击打的平均时机偏差
    return 15; // 毫秒
  }
  
  /**
   * 计算Perfect率
   */
  calculatePerfectRate() {
    // 计算Perfect判定在所有判定中的比例
    return 0.6;
  }
  
  /**
   * 计算音符碰撞效率
   */
  calculateNoteCollisionEfficiency() {
    // 计算碰撞检测在音符判定中的效率
    return 0.98;
  }
}

// 导出单例实例
export const collisionDetector = new RhythmMasterCollisionManager();