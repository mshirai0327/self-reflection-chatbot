/*
  Warnings:

  - You are about to drop the column `blood_pressure_dia` on the `quantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `blood_pressure_sys` on the `quantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `blood_sugar` on the `quantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `sleep_quality` on the `quantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `sleep_time` on the `quantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `quantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `persona_status_id` on the `quantity_unchange_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `friendliness` on the `semiquantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `health` on the `semiquantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `mood` on the `semiquantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `trust` on the `semiquantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `semiquantity_reversible_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `persona_status_id` on the `semiquantity_unchange_statuses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[persona_id]` on the table `quantity_unchange_statuses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[persona_id]` on the table `semiquantity_unchange_statuses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `value` to the `quantity_reversible_statuses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `persona_id` to the `quantity_unchange_statuses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `semiquantity_reversible_statuses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `persona_id` to the `semiquantity_unchange_statuses` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `quantity_unchange_statuses` DROP FOREIGN KEY `quantity_unchange_statuses_persona_status_id_fkey`;

-- DropForeignKey
ALTER TABLE `semiquantity_unchange_statuses` DROP FOREIGN KEY `semiquantity_unchange_statuses_persona_status_id_fkey`;

-- DropIndex
DROP INDEX `quantity_unchange_statuses_persona_status_id_key` ON `quantity_unchange_statuses`;

-- DropIndex
DROP INDEX `semiquantity_unchange_statuses_persona_status_id_key` ON `semiquantity_unchange_statuses`;

-- AlterTable
ALTER TABLE `quantity_irreversible_statuses` ADD COLUMN `eyesight` DOUBLE NULL,
    ADD COLUMN `grip_strength` DOUBLE NULL,
    ADD COLUMN `hearing_ability` DOUBLE NULL,
    ADD COLUMN `recorded_for_persona` DATETIME(3) NULL,
    ADD COLUMN `voice_pitch` DOUBLE NULL;

-- AlterTable
ALTER TABLE `quantity_reversible_statuses` DROP COLUMN `blood_pressure_dia`,
    DROP COLUMN `blood_pressure_sys`,
    DROP COLUMN `blood_sugar`,
    DROP COLUMN `sleep_quality`,
    DROP COLUMN `sleep_time`,
    DROP COLUMN `weight`,
    ADD COLUMN `value` JSON NOT NULL;

-- AlterTable
ALTER TABLE `quantity_unchange_statuses` DROP COLUMN `persona_status_id`,
    ADD COLUMN `persona_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `reflection_events` ADD COLUMN `prompt` TEXT NULL;

-- AlterTable
ALTER TABLE `semiquantity_reversible_statuses` DROP COLUMN `friendliness`,
    DROP COLUMN `health`,
    DROP COLUMN `mood`,
    DROP COLUMN `trust`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `value` JSON NOT NULL;

-- AlterTable
ALTER TABLE `semiquantity_unchange_statuses` DROP COLUMN `persona_status_id`,
    ADD COLUMN `persona_id` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `quantity_unchange_statuses_persona_id_key` ON `quantity_unchange_statuses`(`persona_id`);

-- CreateIndex
CREATE UNIQUE INDEX `semiquantity_unchange_statuses_persona_id_key` ON `semiquantity_unchange_statuses`(`persona_id`);

-- AddForeignKey
ALTER TABLE `quantity_unchange_statuses` ADD CONSTRAINT `quantity_unchange_statuses_persona_id_fkey` FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semiquantity_unchange_statuses` ADD CONSTRAINT `semiquantity_unchange_statuses_persona_id_fkey` FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
