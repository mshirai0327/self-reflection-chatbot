-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `personas` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'Reflecta',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `persona_statuses` (
    `id` VARCHAR(191) NOT NULL,
    `status_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `persona_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `persona_statuses_status_id_key`(`status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quantity_unchange_statuses` (
    `id` VARCHAR(191) NOT NULL,
    `persona_status_id` VARCHAR(191) NOT NULL,
    `birth_date` DATETIME(3) NULL,
    `gender` VARCHAR(191) NULL,
    `blood_type` VARCHAR(191) NULL,
    `chronotype` VARCHAR(191) NULL,
    `bitterness_sense` INTEGER NULL,
    `intelligence` INTEGER NULL,

    UNIQUE INDEX `quantity_unchange_statuses_persona_status_id_key`(`persona_status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `semiquantity_unchange_statuses` (
    `id` VARCHAR(191) NOT NULL,
    `persona_status_id` VARCHAR(191) NOT NULL,
    `ethics` INTEGER NOT NULL DEFAULT 50,
    `passion` INTEGER NOT NULL DEFAULT 50,
    `curiosity` INTEGER NOT NULL DEFAULT 50,
    `aggressiveness` INTEGER NOT NULL DEFAULT 50,
    `extroversion` INTEGER NOT NULL DEFAULT 50,

    UNIQUE INDEX `semiquantity_unchange_statuses_persona_status_id_key`(`persona_status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quantity_irreversible_statuses` (
    `id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `persona_status_id` VARCHAR(191) NOT NULL,
    `height` DOUBLE NULL,
    `bone_density` DOUBLE NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `quantity_irreversible_statuses_persona_status_id_key`(`persona_status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quantity_reversible_statuses` (
    `id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `persona_status_id` VARCHAR(191) NOT NULL,
    `weight` DOUBLE NULL,
    `blood_sugar` DOUBLE NULL,
    `blood_pressure_sys` INTEGER NULL,
    `blood_pressure_dia` INTEGER NULL,
    `sleep_time` DOUBLE NULL,
    `sleep_quality` INTEGER NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `quantity_reversible_statuses_persona_status_id_key`(`persona_status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `semiquantity_reversible_statuses` (
    `id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `persona_status_id` VARCHAR(191) NOT NULL,
    `trust` INTEGER NOT NULL DEFAULT 50,
    `friendliness` INTEGER NOT NULL DEFAULT 50,
    `mood` INTEGER NOT NULL DEFAULT 50,
    `health` INTEGER NOT NULL DEFAULT 100,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `semiquantity_reversible_statuses_persona_status_id_key`(`persona_status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chats` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT 'New Chat',
    `userId` VARCHAR(191) NOT NULL,
    `personaId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_logs` (
    `id` VARCHAR(191) NOT NULL,
    `chatId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `personaId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reflection_events` (
    `id` VARCHAR(191) NOT NULL,
    `personaId` VARCHAR(191) NOT NULL,
    `thought` TEXT NOT NULL,
    `statusUpdate` JSON NOT NULL,
    `permanentMemory` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_logs` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `value` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `persona_statuses` ADD CONSTRAINT `persona_statuses_persona_id_fkey` FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quantity_unchange_statuses` ADD CONSTRAINT `quantity_unchange_statuses_persona_status_id_fkey` FOREIGN KEY (`persona_status_id`) REFERENCES `persona_statuses`(`status_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semiquantity_unchange_statuses` ADD CONSTRAINT `semiquantity_unchange_statuses_persona_status_id_fkey` FOREIGN KEY (`persona_status_id`) REFERENCES `persona_statuses`(`status_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quantity_irreversible_statuses` ADD CONSTRAINT `quantity_irreversible_statuses_persona_status_id_fkey` FOREIGN KEY (`persona_status_id`) REFERENCES `persona_statuses`(`status_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quantity_reversible_statuses` ADD CONSTRAINT `quantity_reversible_statuses_persona_status_id_fkey` FOREIGN KEY (`persona_status_id`) REFERENCES `persona_statuses`(`status_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semiquantity_reversible_statuses` ADD CONSTRAINT `semiquantity_reversible_statuses_persona_status_id_fkey` FOREIGN KEY (`persona_status_id`) REFERENCES `persona_statuses`(`status_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chats` ADD CONSTRAINT `chats_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chats` ADD CONSTRAINT `chats_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `personas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_logs` ADD CONSTRAINT `chat_logs_chatId_fkey` FOREIGN KEY (`chatId`) REFERENCES `chats`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_logs` ADD CONSTRAINT `chat_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_logs` ADD CONSTRAINT `chat_logs_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `personas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reflection_events` ADD CONSTRAINT `reflection_events_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `personas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
