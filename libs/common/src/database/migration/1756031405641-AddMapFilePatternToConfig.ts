import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMapFilePatternToConfig1756031405641 implements MigrationInterface {
    name = 'AddMapFilePatternToConfig1756031405641'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "map_configs" ADD "ortophoto_map_pattern" character varying`);
        await queryRunner.query(`ALTER TABLE "map_configs" ADD "control_map_pattern" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "map_configs" DROP COLUMN "control_map_pattern"`);
        await queryRunner.query(`ALTER TABLE "map_configs" DROP COLUMN "ortophoto_map_pattern"`);
    }

}
