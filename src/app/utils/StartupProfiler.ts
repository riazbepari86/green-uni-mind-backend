/**
 * Professional Startup Performance Profiler
 * Measures and tracks server startup performance
 */

import { Logger } from '../config/logger';

interface StartupMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'completed' | 'failed';
  error?: any;
}

interface StartupProfile {
  totalStartupTime: number;
  metrics: StartupMetric[];
  environment: string;
  timestamp: string;
  memoryUsage: {
    initial: NodeJS.MemoryUsage;
    final?: NodeJS.MemoryUsage;
  };
}

/**
 * Startup Performance Profiler
 */
export class StartupProfiler {
  private static instance: StartupProfiler;
  private profile: StartupProfile;
  private startupStartTime: number;

  private constructor() {
    this.startupStartTime = Date.now();
    this.profile = {
      totalStartupTime: 0,
      metrics: [],
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      memoryUsage: {
        initial: process.memoryUsage(),
      },
    };

    console.log('🚀 Startup profiler initialized');
  }

  public static getInstance(): StartupProfiler {
    if (!StartupProfiler.instance) {
      StartupProfiler.instance = new StartupProfiler();
    }
    return StartupProfiler.instance;
  }

  /**
   * Start measuring a startup phase
   */
  public startPhase(name: string): void {
    const metric: StartupMetric = {
      name,
      startTime: Date.now(),
      status: 'started',
    };

    this.profile.metrics.push(metric);
    console.log(`⏱️  Starting: ${name}`);
  }

  /**
   * Complete measuring a startup phase
   */
  public completePhase(name: string): void {
    const metric = this.profile.metrics.find(m => m.name === name && m.status === 'started');
    
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.status = 'completed';
      
      console.log(`✅ Completed: ${name} (${metric.duration}ms)`);
    } else {
      Logger.warn(`Phase '${name}' not found or already completed`);
    }
  }

  /**
   * Mark a startup phase as failed
   */
  public failPhase(name: string, error: any): void {
    const metric = this.profile.metrics.find(m => m.name === name && m.status === 'started');
    
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.status = 'failed';
      metric.error = error;
      
      console.log(`❌ Failed: ${name} (${metric.duration}ms) - ${error.message || error}`);
    }
  }

  /**
   * Complete the entire startup process
   */
  public completeStartup(): void {
    this.profile.totalStartupTime = Date.now() - this.startupStartTime;
    this.profile.memoryUsage.final = process.memoryUsage();

    this.logStartupSummary();
  }

  /**
   * Get startup profile
   */
  public getProfile(): StartupProfile {
    return { ...this.profile };
  }

  /**
   * Log startup performance summary
   */
  private logStartupSummary(): void {
    const completedPhases = this.profile.metrics.filter(m => m.status === 'completed');
    const failedPhases = this.profile.metrics.filter(m => m.status === 'failed');
    const totalPhaseTime = completedPhases.reduce((sum, m) => sum + (m.duration || 0), 0);

    console.log('\n🎯 ===== STARTUP PERFORMANCE SUMMARY =====');
    console.log(`📊 Total Startup Time: ${this.profile.totalStartupTime}ms`);
    console.log(`📈 Total Phase Time: ${totalPhaseTime}ms`);
    console.log(`✅ Completed Phases: ${completedPhases.length}`);
    console.log(`❌ Failed Phases: ${failedPhases.length}`);
    console.log(`🧠 Memory Usage: ${this.formatMemoryUsage()}`);
    console.log(`🌍 Environment: ${this.profile.environment}`);

    // Log phase breakdown
    if (completedPhases.length > 0) {
      console.log('\n📋 Phase Breakdown:');
      completedPhases
        .sort((a, b) => (b.duration || 0) - (a.duration || 0))
        .forEach(phase => {
          const percentage = ((phase.duration || 0) / totalPhaseTime * 100).toFixed(1);
          console.log(`   ${phase.name}: ${phase.duration}ms (${percentage}%)`);
        });
    }

    // Log failed phases
    if (failedPhases.length > 0) {
      console.log('\n⚠️  Failed Phases:');
      failedPhases.forEach(phase => {
        console.log(`   ${phase.name}: ${phase.error?.message || 'Unknown error'}`);
      });
    }

    // Performance recommendations
    this.logPerformanceRecommendations();

    console.log('==========================================\n');
  }

  /**
   * Format memory usage for display
   */
  private formatMemoryUsage(): string {
    const initial = this.profile.memoryUsage.initial;
    const final = this.profile.memoryUsage.final;

    if (!final) {
      return `${(initial.heapUsed / 1024 / 1024).toFixed(2)}MB heap`;
    }

    const heapDiff = final.heapUsed - initial.heapUsed;
    const heapDiffSign = heapDiff >= 0 ? '+' : '';
    
    return `${(final.heapUsed / 1024 / 1024).toFixed(2)}MB heap (${heapDiffSign}${(heapDiff / 1024 / 1024).toFixed(2)}MB)`;
  }

  /**
   * Log performance recommendations
   */
  private logPerformanceRecommendations(): void {
    const slowPhases = this.profile.metrics
      .filter(m => m.status === 'completed' && (m.duration || 0) > 1000)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));

    if (slowPhases.length > 0) {
      console.log('\n💡 Performance Recommendations:');
      slowPhases.forEach(phase => {
        console.log(`   ⚡ Optimize '${phase.name}' (${phase.duration}ms)`);
      });
    }

    if (this.profile.totalStartupTime > 5000) {
      console.log('   🚀 Consider implementing more lazy loading');
      console.log('   🔧 Review middleware loading order');
      console.log('   📦 Check for unnecessary synchronous operations');
    }
  }

  /**
   * Export profile for analysis
   */
  public exportProfile(): string {
    return JSON.stringify(this.profile, null, 2);
  }

  /**
   * Reset profiler (for testing)
   */
  public reset(): void {
    this.startupStartTime = Date.now();
    this.profile = {
      totalStartupTime: 0,
      metrics: [],
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      memoryUsage: {
        initial: process.memoryUsage(),
      },
    };
  }
}

// Export singleton instance
export const startupProfiler = StartupProfiler.getInstance();

// Convenience functions
export const startPhase = (name: string) => startupProfiler.startPhase(name);
export const completePhase = (name: string) => startupProfiler.completePhase(name);
export const failPhase = (name: string, error: any) => startupProfiler.failPhase(name, error);
export const completeStartup = () => startupProfiler.completeStartup();
