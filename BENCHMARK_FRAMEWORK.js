/**
 * RhythmMaster 性能基准测试框架
 * 用于测量和对比优化前后的性能指标
 */

class RhythmMasterBenchmark {
    constructor() {
        this.results = {
            baseline: {},
            optimized: {},
            comparison: {}
        };
        this.isRunning = false;
        this.testConfig = {
            duration: 30000, // 30秒测试
            warmupTime: 5000, // 5秒预热
            sampleRate: 100, // 每秒采样100次
            testScenarios: [
                'easy_song_short',
                'normal_song_medium', 
                'hard_song_long',
                'expert_song_intense'
            ]
        };
    }

    // 初始化测试环境
    async initialize() {
        console.log('🚀 初始化RhythmMaster性能基准测试...');
        
        // 检查浏览器支持
        this.checkBrowserSupport();
        
        // 准备测试数据
        await this.prepareTestData();
        
        // 设置性能监控
        this.setupPerformanceMonitoring();
        
        console.log('✅ 测试环境初始化完成');
    }

    // 检查浏览器支持
    checkBrowserSupport() {
        const support = {
            performance: typeof performance !== 'undefined',
            performanceNow: typeof performance.now === 'function',
            requestAnimationFrame: typeof requestAnimationFrame === 'function',
            memoryInfo: !!(performance.memory),
            webAudio: !!(window.AudioContext || window.webkitAudioContext),
            webWorkers: typeof Worker !== 'undefined',
            offscreenCanvas: typeof OffscreenCanvas !== 'undefined'
        };

        console.log('浏览器功能支持情况:', support);
        return support;
    }

    // 准备测试数据
    async prepareTestData() {
        console.log('📊 准备测试数据...');
        
        this.testData = {
            songs: {
                easy: this.generateSongData('easy', 60, 30), // 60秒，简单难度
                normal: this.generateSongData('normal', 120, 45), // 120秒，中等难度
                hard: this.generateSongData('hard', 180, 60), // 180秒，困难难度
                expert: this.generateSongData('expert', 240, 90) // 240秒，专家难度
            },
            notePatterns: {
                simple: this.generateNotePattern('simple', 100),
                complex: this.generateNotePattern('complex', 500),
                intense: this.generateNotePattern('intense', 1000)
            }
        };
        
        console.log('✅ 测试数据准备完成');
    }

    // 生成歌曲测试数据
    generateSongData(difficulty, duration, noteCount) {
        const bpm = this.getBPMForDifficulty(difficulty);
        const beatInterval = 60000 / bpm;
        const notes = [];
        
        for (let i = 0; i < noteCount; i++) {
            const time = (i * duration * 1000) / noteCount;
            notes.push({
                id: `note_${i}`,
                time: time,
                lane: Math.floor(Math.random() * 4),
                type: Math.random() < 0.8 ? 'tap' : 'hold',
                duration: Math.random() < 0.2 ? Math.random() * 500 + 200 : 0
            });
        }
        
        return {
            id: `test_${difficulty}`,
            title: `Test Song ${difficulty}`,
            duration: duration * 1000,
            bpm: bpm,
            notes: notes,
            difficulty: difficulty
        };
    }

    // 生成音符模式
    generateNotePattern(pattern, count) {
        const patterns = [];
        
        for (let i = 0; i < count; i++) {
            patterns.push({
                time: i * 100, // 每100ms一个音符
                lane: Math.floor(Math.random() * 4),
                speed: 200 + Math.random() * 100,
                size: 30 + Math.random() * 20
            });
        }
        
        return patterns;
    }

    // 获取难度对应的BPM
    getBPMForDifficulty(difficulty) {
        const bpmMap = {
            easy: 80 + Math.random() * 40,     // 80-120 BPM
            normal: 120 + Math.random() * 40,  // 120-160 BPM
            hard: 160 + Math.random() * 40,    // 160-200 BPM
            expert: 200 + Math.random() * 60   // 200-260 BPM
        };
        return Math.floor(bpmMap[difficulty]);
    }

    // 设置性能监控
    setupPerformanceMonitoring() {
        this.metrics = {
            fps: new MetricsCollector('FPS', 60),
            memory: new MetricsCollector('Memory', 60),
            frameTime: new MetricsCollector('FrameTime', 60),
            drawCalls: new MetricsCollector('DrawCalls', 60),
            collisionChecks: new MetricsCollector('CollisionChecks', 60),
            audioLatency: new MetricsCollector('AudioLatency', 60),
            inputDelay: new MetricsCollector('InputDelay', 60)
        };
        
        // 启动监控循环
        this.startMonitoring();
    }

    // 启动性能监控
    startMonitoring() {
        let lastTime = performance.now();
        let frameCount = 0;
        
        const monitor = () => {
            const currentTime = performance.now();
            const deltaTime = currentTime - lastTime;
            
            // 收集FPS数据
            if (deltaTime > 0) {
                const fps = Math.round(1000 / deltaTime);
                this.metrics.fps.add(fps);
                this.metrics.frameTime.add(deltaTime);
            }
            
            // 收集内存数据
            if (performance.memory) {
                this.metrics.memory.add(performance.memory.usedJSHeapSize);
            }
            
            frameCount++;
            lastTime = currentTime;
            
            if (this.isRunning) {
                requestAnimationFrame(monitor);
            }
        };
        
        requestAnimationFrame(monitor);
    }

    // 运行完整基准测试
    async runFullBenchmark(version = 'current') {
        console.log(`🏁 开始${version}版本完整基准测试...`);
        this.isRunning = true;
        
        const results = {
            version: version,
            timestamp: new Date().toISOString(),
            browserInfo: this.getBrowserInfo(),
            deviceInfo: this.getDeviceInfo(),
            scenarios: {}
        };

        // 运行各个场景的测试
        for (const scenario of this.testConfig.testScenarios) {
            console.log(`🎮 测试场景: ${scenario}`);
            const scenarioResult = await this.runScenarioTest(scenario);
            results.scenarios[scenario] = scenarioResult;
        }

        // 运行专项性能测试
        results.specializedTests = await this.runSpecializedTests();
        
        this.isRunning = false;
        
        // 保存结果
        if (version === 'baseline') {
            this.results.baseline = results;
        } else {
            this.results.optimized = results;
        }
        
        console.log('✅ 基准测试完成');
        return results;
    }

    // 运行场景测试
    async runScenarioTest(scenario) {
        const { difficulty, duration, intensity } = this.parseScenario(scenario);
        const songData = this.testData.songs[difficulty];
        
        const metrics = {
            fps: new MetricsCollector(`${scenario}_FPS`, this.testConfig.sampleRate),
            memory: new MetricsCollector(`${scenario}_Memory`, this.testConfig.sampleRate),
            frameTime: new MetricsCollector(`${scenario}_FrameTime`, this.testConfig.sampleRate),
            drawCalls: new MetricsCollector(`${scenario}_DrawCalls`, this.testConfig.sampleRate),
            collisionChecks: new MetricsCollector(`${scenario}_CollisionChecks`, this.testConfig.sampleRate)
        };

        // 预热期
        await this.warmupPeriod(this.testConfig.warmupTime);
        
        // 正式测试
        const testStart = performance.now();
        const testDuration = this.testConfig.duration;
        
        return new Promise((resolve) => {
            const testInterval = setInterval(() => {
                const elapsed = performance.now() - testStart;
                
                if (elapsed >= testDuration) {
                    clearInterval(testInterval);
                    
                    const result = {
                        scenario: scenario,
                        duration: testDuration,
                        metrics: this.compileMetrics(metrics),
                        performanceScore: this.calculatePerformanceScore(metrics)
                    };
                    
                    resolve(result);
                } else {
                    // 模拟游戏负载
                    this.simulateGameLoad(difficulty, intensity);
                    
                    // 收集指标
                    this.collectMetrics(metrics);
                }
            }, 1000 / this.testConfig.sampleRate);
        });
    }

    // 预热期
    async warmupPeriod(duration) {
        console.log(`🔥 预热期: ${duration}ms`);
        const start = performance.now();
        
        while (performance.now() - start < duration) {
            // 执行一些基础操作来预热引擎
            this.simulateBasicOperations();
            await new Promise(resolve => setTimeout(resolve, 16)); // ~60 FPS
        }
    }

    // 模拟游戏负载
    simulateGameLoad(difficulty, intensity) {
        // 根据难度和强度模拟不同的游戏负载
        const noteCount = Math.floor(intensity * 0.1);
        const particleCount = Math.floor(intensity * 0.2);
        
        // 模拟音符更新
        for (let i = 0; i < noteCount; i++) {
            this.simulateNoteUpdate();
        }
        
        // 模拟粒子效果
        for (let i = 0; i < particleCount; i++) {
            this.simulateParticleUpdate();
        }
        
        // 模拟碰撞检测
        this.simulateCollisionDetection(noteCount);
    }

    // 模拟基础操作
    simulateBasicOperations() {
        // 模拟一些基础的对象创建和操作
        const tempObjects = [];
        for (let i = 0; i < 10; i++) {
            tempObjects.push({
                id: Math.random(),
                data: new Array(100).fill(Math.random())
            });
        }
        tempObjects.length = 0; // 清理
    }

    // 模拟音符更新
    simulateNoteUpdate() {
        const note = {
            x: Math.random() * 800,
            y: Math.random() * 600,
            speed: 200 + Math.random() * 100,
            rotation: Math.random() * Math.PI * 2
        };
        
        // 模拟物理更新
        note.y += note.speed * 0.016; // 假设60 FPS
        note.rotation += 0.1;
    }

    // 模拟粒子更新
    simulateParticleUpdate() {
        const particle = {
            x: Math.random() * 800,
            y: Math.random() * 600,
            vx: (Math.random() - 0.5) * 100,
            vy: (Math.random() - 0.5) * 100,
            life: Math.random(),
            size: Math.random() * 10 + 2
        };
        
        // 模拟粒子物理
        particle.x += particle.vx * 0.016;
        particle.y += particle.vy * 0.016;
        particle.life -= 0.02;
        particle.size *= 0.98;
    }

    // 模拟碰撞检测
    simulateCollisionDetection(noteCount) {
        const playerX = 400;
        const playerY = 500;
        const playerRadius = 25;
        
        for (let i = 0; i < noteCount; i++) {
            const noteX = Math.random() * 800;
            const noteY = Math.random() * 600;
            const noteRadius = 15;
            
            // 简单的圆形碰撞检测
            const dx = playerX - noteX;
            const dy = playerY - noteY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < playerRadius + noteRadius) {
                // 碰撞发生
                this.handleCollision(i);
            }
        }
    }

    // 处理碰撞
    handleCollision(noteId) {
        // 模拟碰撞处理
        const hitEffect = {
            noteId: noteId,
            accuracy: Math.random(),
            combo: Math.floor(Math.random() * 10),
            score: Math.floor(Math.random() * 1000)
        };
        
        // 触发效果
        this.triggerHitEffect(hitEffect);
    }

    // 触发击中效果
    triggerHitEffect(effect) {
        // 模拟视觉效果和音频效果
        const visualEffect = {
            type: 'hit',
            position: { x: Math.random() * 800, y: Math.random() * 600 },
            intensity: effect.accuracy,
            duration: 500
        };
        
        // 模拟音频播放
        this.playHitSound(effect.accuracy);
    }

    // 播放击中音效
    playHitSound(accuracy) {
        // 模拟音频延迟
        const audioLatency = 50 + Math.random() * 100; // 50-150ms
        this.metrics.audioLatency.add(audioLatency);
    }

    // 收集指标
    collectMetrics(metrics) {
        // FPS
        const fps = this.metrics.fps.getLatest();
        metrics.fps.add(fps);
        
        // 内存
        if (performance.memory) {
            metrics.memory.add(performance.memory.usedJSHeapSize);
        }
        
        // 帧时间
        metrics.frameTime.add(this.metrics.frameTime.getLatest());
        
        // 绘制调用（模拟）
        const drawCalls = 50 + Math.random() * 100;
        metrics.drawCalls.add(drawCalls);
        
        // 碰撞检测次数
        const collisionChecks = 100 + Math.random() * 200;
        metrics.collisionChecks.add(collisionChecks);
    }

    // 编译指标数据
    compileMetrics(metrics) {
        const compiled = {};
        
        Object.keys(metrics).forEach(key => {
            compiled[key] = metrics[key].getStatistics();
        });
        
        return compiled;
    }

    // 计算性能评分
    calculatePerformanceScore(metrics) {
        const fps = metrics.fps.getAverage();
        const memoryGrowth = metrics.memory.getGrowthRate();
        const frameTime = metrics.frameTime.getAverage();
        
        // 评分算法（0-100）
        let score = 0;
        
        // FPS评分 (0-40分)
        score += Math.min(fps / 60 * 40, 40);
        
        // 内存评分 (0-30分)
        score += Math.max(0, 30 - memoryGrowth * 10);
        
        // 帧时间评分 (0-30分)
        score += Math.max(0, 30 - (frameTime - 16.67) / 16.67 * 30);
        
        return Math.max(0, Math.min(100, score));
    }

    // 运行专项测试
    async runSpecializedTests() {
        console.log('🔬 运行专项性能测试...');
        
        return {
            objectPool: await this.testObjectPoolPerformance(),
            audioSystem: await this.testAudioSystemPerformance(),
            collisionDetection: await this.testCollisionDetectionPerformance(),
            memoryUsage: await this.testMemoryUsage(),
            startupTime: await this.testStartupTime()
        };
    }

    // 测试对象池性能
    async testObjectPoolPerformance() {
        console.log('🎯 测试对象池性能...');
        
        const iterations = 10000;
        const start = performance.now();
        
        // 模拟对象池操作
        const pool = [];
        const active = new Set();
        
        for (let i = 0; i < iterations; i++) {
            if (Math.random() < 0.5 && pool.length > 0) {
                // 获取对象
                const obj = pool.pop();
                active.add(obj);
            } else if (active.size > 0) {
                // 释放对象
                const obj = Array.from(active)[0];
                active.delete(obj);
                pool.push(obj);
            }
        }
        
        const duration = performance.now() - start;
        
        return {
            iterations: iterations,
            duration: duration,
            opsPerSecond: Math.round(iterations / (duration / 1000)),
            averageTime: duration / iterations
        };
    }

    // 测试音频系统性能
    async testAudioSystemPerformance() {
        console.log('🎵 测试音频系统性能...');
        
        const testCount = 100;
        const latencies = [];
        
        for (let i = 0; i < testCount; i++) {
            const start = performance.now();
            
            // 模拟音频播放
            await this.simulateAudioPlayback();
            
            const latency = performance.now() - start;
            latencies.push(latency);
        }
        
        return {
            testCount: testCount,
            averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            minLatency: Math.min(...latencies),
            maxLatency: Math.max(...latencies),
            p95Latency: this.percentile(latencies, 0.95)
        };
    }

    // 模拟音频播放
    async simulateAudioPlayback() {
        return new Promise(resolve => {
            // 模拟音频初始化延迟
            setTimeout(() => {
                resolve();
            }, Math.random() * 50 + 10); // 10-60ms延迟
        });
    }

    // 测试碰撞检测性能
    async testCollisionDetectionPerformance() {
        console.log('💥 测试碰撞检测性能...');
        
        const testCases = [50, 100, 200, 500, 1000]; // 不同数量的音符
        const results = {};
        
        for (const noteCount of testCases) {
            const notes = this.createTestNotes(noteCount);
            const iterations = 1000;
            
            const start = performance.now();
            
            for (let i = 0; i < iterations; i++) {
                this.performCollisionDetection(notes);
            }
            
            const duration = performance.now() - start;
            
            results[`${noteCount}_notes`] = {
                noteCount: noteCount,
                iterations: iterations,
                totalDuration: duration,
                averageTime: duration / iterations,
                checksPerSecond: Math.round((noteCount * iterations) / (duration / 1000))
            };
        }
        
        return results;
    }

    // 创建测试音符
    createTestNotes(count) {
        const notes = [];
        for (let i = 0; i < count; i++) {
            notes.push({
                id: i,
                x: Math.random() * 800,
                y: Math.random() * 600,
                radius: 15 + Math.random() * 10,
                active: true
            });
        }
        return notes;
    }

    // 执行碰撞检测
    performCollisionDetection(notes) {
        const player = { x: 400, y: 500, radius: 25 };
        let collisionCount = 0;
        
        for (const note of notes) {
            const dx = player.x - note.x;
            const dy = player.y - note.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < player.radius + note.radius) {
                collisionCount++;
            }
        }
        
        return collisionCount;
    }

    // 测试内存使用
    async testMemoryUsage() {
        console.log('🧠 测试内存使用情况...');
        
        const samples = [];
        const testDuration = 10000; // 10秒
        const sampleInterval = 100; // 每100ms采样
        
        const start = performance.now();
        let lastSample = start;
        
        return new Promise(resolve => {
            const sampleMemory = () => {
                const now = performance.now();
                
                if (now - start >= testDuration) {
                    // 测试结束
                    resolve(this.analyzeMemoryUsage(samples));
                } else {
                    if (now - lastSample >= sampleInterval) {
                        if (performance.memory) {
                            samples.push({
                                time: now - start,
                                usedJSHeapSize: performance.memory.usedJSHeapSize,
                                totalJSHeapSize: performance.memory.totalJSHeapSize
                            });
                        }
                        lastSample = now;
                    }
                    
                    // 模拟内存分配
                    this.simulateMemoryAllocation();
                    
                    setTimeout(sampleMemory, 10);
                }
            };
            
            sampleMemory();
        });
    }

    // 模拟内存分配
    simulateMemoryAllocation() {
        // 创建一些临时对象来模拟内存使用
        const tempArray = new Array(1000).fill(0).map(() => ({
            data: Math.random(),
            timestamp: Date.now(),
            id: Math.random().toString(36)
        }));
        
        // 清理（但可能留下一些引用）
        tempArray.length = 0;
    }

    // 分析内存使用
    analyzeMemoryUsage(samples) {
        if (samples.length === 0) return null;
        
        const initialMemory = samples[0].usedJSHeapSize;
        const finalMemory = samples[samples.length - 1].usedJSHeapSize;
        const peakMemory = Math.max(...samples.map(s => s.usedJSHeapSize));
        
        return {
            initialMemory: initialMemory,
            finalMemory: finalMemory,
            peakMemory: peakMemory,
            memoryGrowth: finalMemory - initialMemory,
            growthRate: (finalMemory - initialMemory) / initialMemory * 100,
            samples: samples.length
        };
    }

    // 测试启动时间
    async testStartupTime() {
        console.log('⚡ 测试启动时间...');
        
        const iterations = 10;
        const startupTimes = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            
            // 模拟应用启动过程
            await this.simulateAppStartup();
            
            const startupTime = performance.now() - start;
            startupTimes.push(startupTime);
        }
        
        return {
            iterations: iterations,
            averageStartupTime: startupTimes.reduce((a, b) => a + b, 0) / startupTimes.length,
            minStartupTime: Math.min(...startupTimes),
            maxStartupTime: Math.max(...startupTimes),
            p95StartupTime: this.percentile(startupTimes, 0.95)
        };
    }

    // 模拟应用启动
    async simulateAppStartup() {
        // 模拟各个启动阶段
        await this.delay(Math.random() * 100 + 50); // 初始化阶段
        await this.delay(Math.random() * 200 + 100); // 资源加载阶段
        await this.delay(Math.random() * 150 + 50);  // 引擎初始化阶段
        await this.delay(Math.random() * 100 + 50);  // 场景加载阶段
    }

    // 辅助方法
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    percentile(arr, p) {
        if (arr.length === 0) return 0;
        const sorted = arr.slice().sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)];
    }

    parseScenario(scenario) {
        const parts = scenario.split('_');
        return {
            difficulty: parts[0],
            duration: parts[1],
            intensity: parts[2]
        };
    }

    getBrowserInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        };
    }

    getDeviceInfo() {
        return {
            screenWidth: screen.width,
            screenHeight: screen.height,
            screenColorDepth: screen.colorDepth,
            devicePixelRatio: window.devicePixelRatio || 1,
            hardwareConcurrency: navigator.hardwareConcurrency || 1,
            memoryGB: navigator.deviceMemory || 'unknown'
        };
    }

    // 生成对比报告
    generateComparisonReport() {
        if (!this.results.baseline || !this.results.optimized) {
            throw new Error('需要运行baseline和optimized测试后才能生成对比报告');
        }

        console.log('📈 生成性能对比报告...');
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: this.generateSummary(),
            detailedComparison: this.generateDetailedComparison(),
            recommendations: this.generateRecommendations(),
            exportFormats: {
                json: () => JSON.stringify(report, null, 2),
                csv: () => this.exportAsCSV(),
                markdown: () => this.exportAsMarkdown()
            }
        };
        
        return report;
    }

    // 生成总结
    generateSummary() {
        const baselineScore = this.results.baseline.scenarios.normal_song_medium.performanceScore;
        const optimizedScore = this.results.optimized.scenarios.normal_song_medium.performanceScore;
        
        return {
            overallImprovement: ((optimizedScore - baselineScore) / baselineScore * 100).toFixed(2) + '%',
            fpsImprovement: this.calculateMetricImprovement('fps'),
            memoryImprovement: this.calculateMetricImprovement('memory'),
            frameTimeImprovement: this.calculateMetricImprovement('frameTime'),
            keyFindings: this.identifyKeyFindings()
        };
    }

    // 计算指标改进
    calculateMetricImprovement(metric) {
        const baseline = this.getAverageMetric(this.results.baseline, metric);
        const optimized = this.getAverageMetric(this.results.optimized, metric);
        
        return {
            before: baseline,
            after: optimized,
            improvement: ((optimized - baseline) / baseline * 100).toFixed(2) + '%'
        };
    }

    // 获取平均指标
    getAverageMetric(results, metric) {
        let total = 0;
        let count = 0;
        
        Object.values(results.scenarios).forEach(scenario => {
            if (scenario.metrics[metric]) {
                total += scenario.metrics[metric].average;
                count++;
            }
        });
        
        return count > 0 ? total / count : 0;
    }

    // 识别关键发现
    identifyKeyFindings() {
        const findings = [];
        
        // 分析FPS改进
        const fpsImprovement = parseFloat(this.calculateMetricImprovement('fps').improvement);
        if (fpsImprovement > 20) {
            findings.push(`FPS显著提升 ${fpsImprovement.toFixed(1)}%`);
        }
        
        // 分析内存改进
        const memoryImprovement = parseFloat(this.calculateMetricImprovement('memory').improvement);
        if (memoryImprovement > 10) {
            findings.push(`内存使用优化 ${memoryImprovement.toFixed(1)}%`);
        }
        
        return findings;
    }

    // 生成详细对比
    generateDetailedComparison() {
        const comparison = {};
        
        Object.keys(this.results.baseline.scenarios).forEach(scenario => {
            comparison[scenario] = {
                fps: this.compareMetric(scenario, 'fps'),
                memory: this.compareMetric(scenario, 'memory'),
                frameTime: this.compareMetric(scenario, 'frameTime'),
                performanceScore: this.comparePerformanceScore(scenario)
            };
        });
        
        return comparison;
    }

    // 对比指标
    compareMetric(scenario, metric) {
        const baseline = this.results.baseline.scenarios[scenario].metrics[metric];
        const optimized = this.results.optimized.scenarios[scenario].metrics[metric];
        
        return {
            before: baseline,
            after: optimized,
            improvement: ((optimized.average - baseline.average) / baseline.average * 100).toFixed(2) + '%'
        };
    }

    // 对比性能评分
    comparePerformanceScore(scenario) {
        const baseline = this.results.baseline.scenarios[scenario].performanceScore;
        const optimized = this.results.optimized.scenarios[scenario].performanceScore;
        
        return {
            before: baseline,
            after: optimized,
            improvement: optimized - baseline
        };
    }

    // 生成建议
    generateRecommendations() {
        return [
            "继续监控内存使用情况，确保优化效果持续",
            "定期进行性能测试，及时发现性能回归",
            "考虑实施更多高级优化技术",
            "建立性能基准测试自动化流程"
        ];
    }

    // 导出为CSV
    exportAsCSV() {
        // 实现CSV导出逻辑
        return "CSV format export - implementation needed";
    }

    // 导出为Markdown
    exportAsMarkdown() {
        // 实现Markdown导出逻辑
        return "Markdown format export - implementation needed";
    }
}

// 指标收集器类
class MetricsCollector {
    constructor(name, maxSamples = 100) {
        this.name = name;
        this.samples = [];
        this.maxSamples = maxSamples;
    }
    
    add(value) {
        this.samples.push(value);
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }
    
    getAverage() {
        if (this.samples.length === 0) return 0;
        return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    }
    
    getMin() {
        return this.samples.length > 0 ? Math.min(...this.samples) : 0;
    }
    
    getMax() {
        return this.samples.length > 0 ? Math.max(...this.samples) : 0;
    }
    
    getStatistics() {
        return {
            average: this.getAverage(),
            min: this.getMin(),
            max: this.getMax(),
            samples: this.samples.length,
            latest: this.samples[this.samples.length - 1] || 0
        };
    }
    
    getGrowthRate() {
        if (this.samples.length < 2) return 0;
        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];
        return (last - first) / first;
    }
}

// 导出基准测试框架
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RhythmMasterBenchmark;
} else if (typeof window !== 'undefined') {
    window.RhythmMasterBenchmark = RhythmMasterBenchmark;
}