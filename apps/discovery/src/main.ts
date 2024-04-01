import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { DiscoveryModule } from './discovery.module';
import { CustomRpcExceptionFilter } from './rpc-exception.filter';
import { MSType, MicroserviceName, MicroserviceType, getClientConfig } from '@app/common/microservice-client';
import { GET_APP_LOGGER } from '@app/common/logger/logger.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    DiscoveryModule,
    {...getClientConfig(
      {
        type: MicroserviceType.DISCOVERY, 
        name: MicroserviceName.DISCOVERY_SERVICE
      }, 
      MSType[process.env.MICRO_SERVICE_TYPE]),
      bufferLogs: true,
    }
  );
  app.useLogger(app.get(GET_APP_LOGGER))
  app.useGlobalFilters(new CustomRpcExceptionFilter())
  app.listen()
}
bootstrap();
