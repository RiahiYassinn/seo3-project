module.exports = function (options, webpack) {
  const lazyImports = [
    '@grpc/grpc-js',
    '@grpc/proto-loader',
    'amqp-connection-manager',
    'amqplib',
    'ioredis',
    'mqtt',
    'nats',
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
  ];

  return {
    ...options,
    externals: [],
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        checkResource(resource) {
          if (lazyImports.some((lib) => resource.includes(lib))) {
            try {
              require.resolve(resource);
            } catch (err) {
              return true;
            }
          }
          return false;
        },
      }),
    ],
  };
};
