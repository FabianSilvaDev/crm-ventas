-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(36) NOT NULL,
    `organization_id` VARCHAR(36) NULL,
    `user_id` VARCHAR(36) NULL,
    `action` ENUM('USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT', 'SETUP_COMPLETED', 'PASSWORD_CHANGED', 'REFRESH_TOKEN_REVOKED', 'LEAD_CREATED', 'LEAD_UPDATED', 'LEAD_CONVERTED', 'OTHER') NOT NULL,
    `resource` VARCHAR(64) NULL,
    `resource_id` VARCHAR(36) NULL,
    `metadata` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    INDEX `audit_logs_resource_resource_id_idx`(`resource`, `resource_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbox_events` (
    `id` VARCHAR(36) NOT NULL,
    `organization_id` VARCHAR(36) NULL,
    `type` VARCHAR(64) NOT NULL,
    `aggregate_id` VARCHAR(36) NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `scheduled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `outbox_events_status_scheduled_at_idx`(`status`, `scheduled_at`),
    INDEX `outbox_events_type_aggregate_id_idx`(`type`, `aggregate_id`),
    INDEX `outbox_events_organization_id_created_at_idx`(`organization_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outbox_events` ADD CONSTRAINT `outbox_events_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

