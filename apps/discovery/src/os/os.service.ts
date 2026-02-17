import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OSEntity } from '@app/common/database/entities';

@Injectable()
export class OSService {
  private readonly logger = new Logger(OSService.name);

  constructor(
    @InjectRepository(OSEntity) private readonly osRepo: Repository<OSEntity>
  ) {}

  async getAllOperatingSystems(): Promise<OSEntity[]> {
    this.logger.debug('Getting all operating systems');
    return this.osRepo.find({
      order: {
        name: 'ASC'
      }
    });
  }
}
