import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { DiscoveryModule } from './discovery.module';
import { CustomRpcExceptionFilter } from './rpc-exception.filter';
import { MSType, MicroserviceName, MicroserviceType, getClientConfig } from '@app/common/microservice-client';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    DiscoveryModule,
    getClientConfig(
      {
        type: MicroserviceType.DISCOVERY, 
        name: MicroserviceName.DISCOVERY_SERVICE
      }, 
      MSType[process.env.MICRO_SERVICE_TYPE])
  );
  app.useGlobalFilters(new CustomRpcExceptionFilter())
  app.listen()
}
bootstrap();
