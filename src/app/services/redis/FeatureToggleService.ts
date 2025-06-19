interface FeatureConfig {
  enabled: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  redisUsage: 'heavy' | 'moderate' | 'light' | 'none';
  fallbackAvailable: boolean;
}

interface FeatureToggleState {
  features: Record<string, FeatureConfig>;
  globalOptimizationMode: 'normal' | 'conservative' | 'aggressive';
  redisUsageThreshold: number; // Percentage of Redis usage that triggers feature disabling
}

export class FeatureToggleService {
  private state: FeatureToggleState;
  private listeners: Map<string, ((enabled: boolean) => void)[]> = new Map();

  constructor() {
    this.state = {
      globalOptimizationMode: 'normal',
      redisUsageThreshold: 70, // Disable non-critical features at 70% Redis usage
      features: {
        // Critical features (never disable)
        'auth_caching': {
          enabled: true,
          priority: 'critical',
          description: 'JWT token and session caching',
          redisUsage: 'moderate',
          fallbackAvailable: false
        },
        'otp_storage': {
          enabled: true,
          priority: 'critical',
          description: 'OTP storage and rate limiting',
          redisUsage: 'light',
          fallbackAvailable: false
        },
        'session_management': {
          enabled: true,
          priority: 'critical',
          description: 'User session storage',
          redisUsage: 'moderate',
          fallbackAvailable: false
        },

        // High priority features (disable in aggressive mode)
        'api_response_caching': {
          enabled: true,
          priority: 'high',
          description: 'API response caching',
          redisUsage: 'heavy',
          fallbackAvailable: true
        },
        'query_result_caching': {
          enabled: true,
          priority: 'high',
          description: 'Database query result caching',
          redisUsage: 'heavy',
          fallbackAvailable: true
        },
        'user_profile_caching': {
          enabled: true,
          priority: 'high',
          description: 'User profile data caching',
          redisUsage: 'moderate',
          fallbackAvailable: true
        },

        // Medium priority features (disable in conservative mode)
        'performance_monitoring': {
          enabled: false, // Disabled by default to reduce Redis usage
          priority: 'medium',
          description: 'Performance metrics storage',
          redisUsage: 'heavy',
          fallbackAvailable: true
        },
        'api_metrics_tracking': {
          enabled: false, // Disabled by default to reduce Redis usage
          priority: 'medium',
          description: 'API endpoint metrics tracking',
          redisUsage: 'heavy',
          fallbackAvailable: true
        },
        'cache_statistics': {
          enabled: false, // Disabled by default to reduce Redis usage
          priority: 'medium',
          description: 'Cache hit/miss statistics',
          redisUsage: 'moderate',
          fallbackAvailable: true
        },
        'popular_content_tracking': {
          enabled: false, // Disabled by default to reduce Redis usage
          priority: 'medium',
          description: 'Popular endpoints and queries tracking',
          redisUsage: 'moderate',
          fallbackAvailable: true
        },

        // Low priority features (disable in normal mode when usage is high)
        'detailed_logging': {
          enabled: false, // Disabled by default to reduce Redis usage
          priority: 'low',
          description: 'Detailed operation logging in Redis',
          redisUsage: 'moderate',
          fallbackAvailable: true
        },
        'cache_warming': {
          enabled: false, // Disabled by default to reduce Redis usage
          priority: 'low',
          description: 'Automatic cache warming',
          redisUsage: 'moderate',
          fallbackAvailable: true
        },
        'invalidation_tracking': {
          enabled: false, // Disabled by default to reduce Redis usage
          priority: 'low',
          description: 'Cache invalidation event tracking',
          redisUsage: 'light',
          fallbackAvailable: true
        },
        'connection_metrics': {
          enabled: false, // Disabled by default to reduce Redis usage
          priority: 'low',
          description: 'Redis connection metrics',
          redisUsage: 'light',
          fallbackAvailable: true
        }
      }
    };
  }

  // Check if a feature is enabled
  isFeatureEnabled(featureName: string): boolean {
    const feature = this.state.features[featureName];
    return feature ? feature.enabled : false;
  }

  // Enable/disable a specific feature
  setFeatureEnabled(featureName: string, enabled: boolean): void {
    const feature = this.state.features[featureName];
    if (!feature) {
      console.warn(`Unknown feature: ${featureName}`);
      return;
    }

    if (feature.priority === 'critical' && !enabled) {
      console.warn(`Cannot disable critical feature: ${featureName}`);
      return;
    }

    const wasEnabled = feature.enabled;
    feature.enabled = enabled;

    if (wasEnabled !== enabled) {
      console.log(`🔧 Feature ${enabled ? 'enabled' : 'disabled'}: ${featureName} (${feature.description})`);
      this.notifyListeners(featureName, enabled);
    }
  }

  // Set global optimization mode
  setOptimizationMode(mode: 'normal' | 'conservative' | 'aggressive'): void {
    const previousMode = this.state.globalOptimizationMode;
    this.state.globalOptimizationMode = mode;

    console.log(`🎛️ Optimization mode changed from ${previousMode} to ${mode}`);
    this.applyOptimizationMode();
  }

  // Apply optimization mode to all features
  private applyOptimizationMode(): void {
    const mode = this.state.globalOptimizationMode;
    
    Object.entries(this.state.features).forEach(([featureName, feature]) => {
      let shouldEnable = true;

      switch (mode) {
        case 'aggressive':
          // Disable all non-critical features
          shouldEnable = feature.priority === 'critical';
          break;
        case 'conservative':
          // Disable medium and low priority features
          shouldEnable = feature.priority === 'critical' || feature.priority === 'high';
          break;
        case 'normal':
          // Keep all features enabled by default
          shouldEnable = true;
          break;
      }

      if (feature.enabled !== shouldEnable) {
        this.setFeatureEnabled(featureName, shouldEnable);
      }
    });
  }

  // Auto-optimize based on Redis usage - DISABLED to prevent excessive operations
  autoOptimizeBasedOnUsage(redisUsagePercentage: number): void {
    // DISABLED: This was causing excessive Redis operations (121K+ ops/min)
    console.log(`📵 Auto-optimization disabled (Redis usage: ${redisUsagePercentage.toFixed(1)}%)`);

    // No automatic optimization to prevent Redis overload
    return;
  }

  // Register a listener for feature changes
  onFeatureChange(featureName: string, callback: (enabled: boolean) => void): void {
    if (!this.listeners.has(featureName)) {
      this.listeners.set(featureName, []);
    }
    this.listeners.get(featureName)!.push(callback);
  }

  // Notify listeners of feature changes
  private notifyListeners(featureName: string, enabled: boolean): void {
    const callbacks = this.listeners.get(featureName);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(enabled);
        } catch (error) {
          console.error(`Error in feature change callback for ${featureName}:`, error);
        }
      });
    }
  }

  // Get current feature states
  getFeatureStates(): Record<string, boolean> {
    const states: Record<string, boolean> = {};
    Object.entries(this.state.features).forEach(([name, feature]) => {
      states[name] = feature.enabled;
    });
    return states;
  }

  // Get features by priority
  getFeaturesByPriority(priority: 'critical' | 'high' | 'medium' | 'low'): string[] {
    return Object.entries(this.state.features)
      .filter(([, feature]) => feature.priority === priority)
      .map(([name]) => name);
  }

  // Get disabled features with fallbacks
  getDisabledFeaturesWithFallbacks(): string[] {
    return Object.entries(this.state.features)
      .filter(([, feature]) => !feature.enabled && feature.fallbackAvailable)
      .map(([name]) => name);
  }

  // Get Redis usage estimate by feature
  getRedisUsageByFeature(): Record<string, { enabled: boolean; usage: string; priority: string }> {
    const usage: Record<string, { enabled: boolean; usage: string; priority: string }> = {};
    
    Object.entries(this.state.features).forEach(([name, feature]) => {
      usage[name] = {
        enabled: feature.enabled,
        usage: feature.redisUsage,
        priority: feature.priority
      };
    });
    
    return usage;
  }

  // Generate optimization report
  generateOptimizationReport(): {
    currentMode: string;
    enabledFeatures: number;
    disabledFeatures: number;
    criticalFeatures: number;
    heavyUsageFeatures: number;
    recommendations: string[];
  } {
    const enabled = Object.values(this.state.features).filter(f => f.enabled).length;
    const disabled = Object.values(this.state.features).filter(f => !f.enabled).length;
    const critical = Object.values(this.state.features).filter(f => f.priority === 'critical').length;
    const heavyUsage = Object.values(this.state.features).filter(f => f.redisUsage === 'heavy' && f.enabled).length;

    const recommendations: string[] = [];
    
    if (heavyUsage > 3) {
      recommendations.push('Consider disabling some heavy Redis usage features');
    }
    
    if (this.state.globalOptimizationMode === 'normal' && disabled > 0) {
      recommendations.push('Some features are disabled - consider enabling them if Redis usage is low');
    }
    
    if (this.state.globalOptimizationMode === 'aggressive') {
      recommendations.push('Running in aggressive mode - only critical features are enabled');
    }

    return {
      currentMode: this.state.globalOptimizationMode,
      enabledFeatures: enabled,
      disabledFeatures: disabled,
      criticalFeatures: critical,
      heavyUsageFeatures: heavyUsage,
      recommendations
    };
  }

  // Reset all features to default state
  resetToDefaults(): void {
    Object.values(this.state.features).forEach(feature => {
      feature.enabled = true;
    });
    this.state.globalOptimizationMode = 'normal';
    console.log('🔄 All features reset to default state');
  }

  // Export current configuration
  exportConfig(): FeatureToggleState {
    return JSON.parse(JSON.stringify(this.state));
  }

  // Import configuration
  importConfig(config: FeatureToggleState): void {
    this.state = config;
    console.log('📥 Feature configuration imported');
    this.applyOptimizationMode();
  }
}

export const featureToggleService = new FeatureToggleService();
