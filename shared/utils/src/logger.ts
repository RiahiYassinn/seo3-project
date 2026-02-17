export class Logger {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  info(message: string, meta?: any) {
    console.log(JSON.stringify({
      level: 'info',
      service: this.serviceName,
      message,
      meta,
      timestamp: new Date().toISOString(),
    }));
  }

  error(message: string, error?: any) {
    console.error(JSON.stringify({
      level: 'error',
      service: this.serviceName,
      message,
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    }));
  }

  warn(message: string, meta?: any) {
    console.warn(JSON.stringify({
      level: 'warn',
      service: this.serviceName,
      message,
      meta,
      timestamp: new Date().toISOString(),
    }));
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({
        level: 'debug',
        service: this.serviceName,
        message,
        meta,
        timestamp: new Date().toISOString(),
      }));
    }
  }
}

export const createLogger = (serviceName: string) => new Logger(serviceName);
