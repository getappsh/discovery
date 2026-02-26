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

  async ensureOSExists(osName: string): Promise<void> {
    const id = osName.trim().toLowerCase().substring(0, 50);
    const exists = await this.osRepo.findOne({ where: { id } });
    if (!exists) {
      try {
        await this.osRepo.insert({ id, name: osName.trim() });
        this.logger.log(`Added new OS to os table: '${osName}'`);
      } catch (err) {
        // Ignore duplicate key errors (race condition between concurrent requests)
        this.logger.debug(`OS '${osName}' already exists or insert failed: ${err}`);
      }
    }
  }
}
