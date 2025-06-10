import https from 'https';
import http from 'http';

interface KeepAliveConfig {
  url: string;
  interval: number; // in minutes
  enabled: boolean;
}

class KeepAliveService {
  private config: KeepAliveConfig;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: KeepAliveConfig) {
    this.config = config;
  }

  start(): void {
    if (!this.config.enabled) {
      console.log('Keep-alive service is disabled');
      return;
    }

    console.log(`Starting keep-alive service for ${this.config.url}`);
    console.log(`Ping interval: ${this.config.interval} minutes`);

    // Initial ping after 1 minute
    setTimeout(() => {
      this.ping();
    }, 60000);

    // Set up recurring pings
    this.intervalId = setInterval(() => {
      this.ping();
    }, this.config.interval * 60 * 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Keep-alive service stopped');
    }
  }

  private ping(): void {
    const url = new URL(this.config.url);
    const client = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 10000, // 10 seconds timeout
      headers: {
        'User-Agent': 'KeepAlive-Service/1.0',
        'Accept': 'application/json'
      }
    };

    const req = client.request(options, (res) => {
      console.log(`Keep-alive ping: ${res.statusCode} - ${new Date().toISOString()}`);
      
      // Consume response data to free up memory
      res.on('data', () => {});
      res.on('end', () => {});
    });

    req.on('error', (error) => {
      console.error(`Keep-alive ping failed: ${error.message}`);
    });

    req.on('timeout', () => {
      console.error('Keep-alive ping timeout');
      req.destroy();
    });

    req.end();
  }
}

// Export singleton instance
const keepAliveService = new KeepAliveService({
  url: process.env.BACKEND_URL || 'https://green-uni-mind-backend-oxpo.onrender.com/api/health',
  interval: 14, // Ping every 14 minutes (before 15-minute sleep)
  enabled: process.env.NODE_ENV === 'production' && process.env.KEEP_ALIVE_ENABLED === 'true'
});

export default keepAliveService;
