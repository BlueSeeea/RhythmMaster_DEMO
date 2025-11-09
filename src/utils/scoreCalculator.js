/**
 * 分数计算器
 * 负责计算游戏分数、评级和连击
 */
class ScoreCalculator {
  constructor() {
    this.reset();
    this.scoreMultiplier = 1.0;   // 分数倍率
    this.comboMultiplier = 0.1;   // 连击倍率增长
    this.difficultyMultiplier = { // 难度倍率
      easy: 0.8,
      normal: 1.0,
      hard: 1.5,
      expert: 2.0
    };
  }

  /**
   * 重置所有分数数据
   */
  reset() {
    this.score = 0;              // 总分数
    this.combo = 0;              // 当前连击数
    this.maxCombo = 0;           // 最大连击数
    this.perfectCount = 0;       // Perfect判定数量
    this.greatCount = 0;         // Great判定数量
    this.goodCount = 0;          // Good判定数量
    this.missCount = 0;          // Miss判定数量
    this.accuracy = 100;         // 准确率
    this.totalNotes = 0;         // 总音符数
    this.hitNotes = 0;           // 击中音符数
    this.lastHitTime = 0;        // 最后击中时间
  }

  /**
   * 处理音符击中
   * @param {string} accuracy - 判定结果 (perfect, great, good, miss)
   * @param {number} baseScore - 基础分数
   * @param {string} difficulty - 难度级别
   */
  handleHit(accuracy, baseScore = 1000, difficulty = 'normal') {
    const difficultyFactor = this.difficultyMultiplier[difficulty] || 1.0;
    let points = 0;
    
    // 根据判定给予不同分数
    switch (accuracy) {
      case 'perfect':
        points = baseScore * 1.0;
        this.perfectCount++;
        this.combo++;
        this.hitNotes++;
        break;
      case 'great':
        points = baseScore * 0.8;
        this.greatCount++;
        this.combo++;
        this.hitNotes++;
        break;
      case 'good':
        points = baseScore * 0.5;
        this.goodCount++;
        this.combo++;
        this.hitNotes++;
        break;
      case 'miss':
      default:
        points = 0;
        this.missCount++;
        this.combo = 0; // Miss重置连击
        break;
    }
    
    // 更新总音符数
    this.totalNotes++;
    
    // 计算连击倍率
    const comboMultiplier = 1 + (this.combo - 1) * this.comboMultiplier;
    
    // 计算最终分数
    const finalPoints = Math.floor(points * this.scoreMultiplier * comboMultiplier * difficultyFactor);
    this.score += finalPoints;
    
    // 更新最大连击
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }
    
    // 更新准确率
    this.updateAccuracy();
    
    return {
      points: finalPoints,
      totalScore: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo
    };
  }

  /**
   * 更新准确率
   */
  updateAccuracy() {
    if (this.totalNotes === 0) {
      this.accuracy = 100;
      return;
    }
    
    const totalScore = 
      this.perfectCount * 3 +
      this.greatCount * 2 +
      this.goodCount * 1 +
      this.missCount * 0;
    
    const maxPossibleScore = this.totalNotes * 3;
    
    this.accuracy = maxPossibleScore > 0 
      ? Math.min(100, (totalScore / maxPossibleScore) * 100)
      : 100;
  }

  /**
   * 获取当前评级
   * 根据分数、准确率和最大连击综合评定
   */
  getRank() {
    if (this.totalNotes === 0) {
      return 'F';
    }
    
    const scoreRatio = this.score / (this.totalNotes * 1000 * 2); // 假设最大可能分数
    const accuracyRatio = this.accuracy / 100;
    const comboRatio = this.maxCombo / Math.max(1, this.totalNotes);
    
    // 综合评分
    const finalScore = (scoreRatio * 0.5) + (accuracyRatio * 0.3) + (comboRatio * 0.2);
    
    if (finalScore >= 0.95) return 'S';
    if (finalScore >= 0.85) return 'A';
    if (finalScore >= 0.75) return 'B';
    if (finalScore >= 0.65) return 'C';
    if (finalScore >= 0.50) return 'D';
    return 'F';
  }

  /**
   * 设置分数倍率
   * @param {number} multiplier - 倍率值
   */
  setScoreMultiplier(multiplier) {
    this.scoreMultiplier = Math.max(0.1, Math.min(5.0, multiplier));
  }

  /**
   * 增加连击倍率
   * @param {number} increment - 增加量
   */
  addComboMultiplier(increment) {
    this.comboMultiplier = Math.min(0.5, this.comboMultiplier + increment);
  }

  /**
   * 获取统计数据
   */
  getStats() {
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      perfectCount: this.perfectCount,
      greatCount: this.greatCount,
      goodCount: this.goodCount,
      missCount: this.missCount,
      accuracy: this.accuracy,
      totalNotes: this.totalNotes,
      hitNotes: this.hitNotes,
      rank: this.getRank()
    };
  }

  /**
   * 比较是否为新的最高分
   * @param {number} savedHighScore - 保存的最高分
   */
  isNewHighScore(savedHighScore) {
    return this.score > savedHighScore;
  }

  /**
   * 计算连击奖励分数
   * @param {number} comboMilestone - 连击里程碑
   */
  calculateComboBonus(comboMilestone) {
    const bonuses = {
      10: 1000,
      50: 5000,
      100: 10000,
      200: 25000,
      300: 50000,
      500: 100000
    };
    
    return bonuses[comboMilestone] || 0;
  }

  /**
   * 处理连击里程碑
   * @param {number} combo - 当前连击数
   */
  handleComboMilestone(combo) {
    const bonus = this.calculateComboBonus(combo);
    if (bonus > 0) {
      this.score += bonus;
      return bonus;
    }
    return 0;
  }
}

// 导出单例实例
export default new ScoreCalculator();