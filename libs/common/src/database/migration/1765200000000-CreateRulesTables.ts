import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRulesTables1765200000000 implements MigrationInterface {
    name = 'CreateRulesTables1765200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable uuid-ossp extension if not already enabled
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        // Create rule_type enum
        await queryRunner.query(`CREATE TYPE "public"."rule_type_enum" AS ENUM('policy', 'restriction')`);

        // Create rules table
        await queryRunner.query(`
            CREATE TABLE "rules" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "description" text,
                "type" "public"."rule_type_enum" NOT NULL,
                "version" integer NOT NULL DEFAULT '1',
                "isActive" boolean NOT NULL DEFAULT true,
                "rule" jsonb NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_rules" PRIMARY KEY ("id")
            )
        `);

        // Create index on type and isActive
        await queryRunner.query(`CREATE INDEX "IDX_rules_type_isActive" ON "rules" ("type", "isActive")`);

        // Create rule_fields table
        await queryRunner.query(`
            CREATE TABLE "rule_fields" (
                "id" SERIAL NOT NULL,
                "name" character varying(255) NOT NULL,
                "type" character varying(50) NOT NULL,
                "label" character varying(255) NOT NULL,
                "description" text,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_rule_fields" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_rule_fields_name" UNIQUE ("name")
            )
        `);

        // Create index on name
        await queryRunner.query(`CREATE INDEX "IDX_rule_fields_name" ON "rule_fields" ("name")`);

        // Create rule_releases junction table (for policies)
        await queryRunner.query(`
            CREATE TABLE "rule_releases" (
                "id" SERIAL NOT NULL,
                "rule_id" uuid NOT NULL,
                "release_catalog_id" character varying NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_rule_releases" PRIMARY KEY ("id"),
                CONSTRAINT "FK_rule_releases_rule" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_rule_releases_release" FOREIGN KEY ("release_catalog_id") REFERENCES "release"("catalog_id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create unique index on rule_releases
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_rule_releases_rule_release" ON "rule_releases" ("rule_id", "release_catalog_id")`);

        // Create rule_device_types junction table (for restrictions)
        await queryRunner.query(`
            CREATE TABLE "rule_device_types" (
                "id" SERIAL NOT NULL,
                "rule_id" uuid NOT NULL,
                "device_type_id" integer NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_rule_device_types" PRIMARY KEY ("id"),
                CONSTRAINT "FK_rule_device_types_rule" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_rule_device_types_device_type" FOREIGN KEY ("device_type_id") REFERENCES "device_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create unique index on rule_device_types
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_rule_device_types_rule_device_type" ON "rule_device_types" ("rule_id", "device_type_id")`);

        // Create rule_devices junction table (for restrictions)
        await queryRunner.query(`
            CREATE TABLE "rule_devices" (
                "id" SERIAL NOT NULL,
                "rule_id" uuid NOT NULL,
                "device_id" character varying NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_rule_devices" PRIMARY KEY ("id"),
                CONSTRAINT "FK_rule_devices_rule" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_rule_devices_device" FOREIGN KEY ("device_id") REFERENCES "device"("ID") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create unique index on rule_devices
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_rule_devices_rule_device" ON "rule_devices" ("rule_id", "device_id")`);

        // Create rule_os table (for restrictions)
        await queryRunner.query(`
            CREATE TABLE "rule_os" (
                "id" SERIAL NOT NULL,
                "rule_id" uuid NOT NULL,
                "osType" character varying(100) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_rule_os" PRIMARY KEY ("id"),
                CONSTRAINT "FK_rule_os_rule" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create unique index on rule_os
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_rule_os_rule_osType" ON "rule_os" ("rule_id", "osType")`);

        // Insert default rule fields
        await queryRunner.query(`
            INSERT INTO "rule_fields" ("name", "type", "label", "description") VALUES
            ('$.battery.level', 'number', 'Battery Level', 'Device battery level percentage'),
            ('$.battery.isCharging', 'boolean', 'Is Charging', 'Whether device is currently charging'),
            ('$.os.name', 'string', 'OS Name', 'Operating system name'),
            ('$.os.version', 'string', 'OS Version', 'Operating system version'),
            ('$.location.latitude', 'number', 'Latitude', 'Device location latitude'),
            ('$.location.longitude', 'number', 'Longitude', 'Device location longitude'),
            ('$.device.type', 'string', 'Device Type', 'Type of device')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order
        await queryRunner.query(`DROP INDEX "public"."IDX_rule_os_rule_osType"`);
        await queryRunner.query(`DROP TABLE "rule_os"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_rule_devices_rule_device"`);
        await queryRunner.query(`DROP TABLE "rule_devices"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_rule_device_types_rule_device_type"`);
        await queryRunner.query(`DROP TABLE "rule_device_types"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_rule_releases_rule_release"`);
        await queryRunner.query(`DROP TABLE "rule_releases"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_rule_fields_name"`);
        await queryRunner.query(`DROP TABLE "rule_fields"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_rules_type_isActive"`);
        await queryRunner.query(`DROP TABLE "rules"`);

        await queryRunner.query(`DROP TYPE "public"."rule_type_enum"`);
    }
}
