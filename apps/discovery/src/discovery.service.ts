import { MicroserviceClient, MicroserviceName } from '@app/common/microservice-client';
import { OfferingTopics } from '@app/common/microservice-client/topics';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class DiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    @Inject(MicroserviceName.OFFERING_SERVICE) private readonly offeringClient: MicroserviceClient,

  ) { }

  async subscribeToDeviceClient() {
    this.offeringClient.subscribeToResponseOf(Object.values(OfferingTopics));
    await this.offeringClient.connect();
  }

  async onModuleInit() {
    await this.subscribeToDeviceClient()
  }

}
