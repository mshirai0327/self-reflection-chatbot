/*
  Warnings:

  - You are about to drop the column `permanentMemory` on the `reflection_events` table. All the data in the column will be lost.
  - You are about to drop the column `statusUpdate` on the `reflection_events` table. All the data in the column will be lost.
  - You are about to drop the column `thought` on the `reflection_events` table. All the data in the column will be lost.
  - Added the required column `response` to the `reflection_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `reflection_events` DROP COLUMN `permanentMemory`,
    DROP COLUMN `statusUpdate`,
    DROP COLUMN `thought`,
    ADD COLUMN `response` JSON NOT NULL;
