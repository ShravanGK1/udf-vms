-- VMS Clean Database Schema DDL
-- Enterprise Visitor Management System
-- Idempotent, Production-Ready Schema Definition
-- Contains ZERO dummy users, test credentials, or mock visitor records.

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Customers Table (Multi-tenant root)
CREATE TABLE IF NOT EXISTS `customers` (
    `customer_id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_name` VARCHAR(255) NOT NULL UNIQUE,
    `code` VARCHAR(50) DEFAULT 'MAIN',
    `status` VARCHAR(50) DEFAULT 'Active',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Sites Table (Physical Facility / Location)
CREATE TABLE IF NOT EXISTS `sites` (
    `site_id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) UNIQUE NOT NULL,
    `code` VARCHAR(50) DEFAULT NULL,
    `address` VARCHAR(255) NOT NULL,
    `status` VARCHAR(50) DEFAULT 'Active',
    `lat` DECIMAL(10, 6) DEFAULT NULL,
    `lng` DECIMAL(10, 6) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `customer_id` INT DEFAULT 1,
    CONSTRAINT `fk_sites_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Users Table (Super Admin, Admin, Host, Security)
CREATE TABLE IF NOT EXISTS `users` (
    `user_id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `name` VARCHAR(100),
    `department` VARCHAR(100),
    `status` VARCHAR(20) DEFAULT 'Active',
    `profile_photo` VARCHAR(255),
    `remote_login_token` VARCHAR(512) DEFAULT NULL,
    `customer_id` INT DEFAULT 1,
    INDEX `idx_users_role` (`role`),
    INDEX `idx_users_email` (`email`),
    CONSTRAINT `fk_users_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. User-Sites Junction Table (Multi-site access allocation)
CREATE TABLE IF NOT EXISTS `user_sites` (
    `user_id` INT NOT NULL,
    `site_id` INT NOT NULL,
    PRIMARY KEY (`user_id`, `site_id`),
    CONSTRAINT `fk_user_sites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_sites_site` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Visitors Table (Visitor biometric, identity, and personal records)
CREATE TABLE IF NOT EXISTS `visitors` (
    `visitor_id` INT AUTO_INCREMENT PRIMARY KEY,
    `visitor_name` VARCHAR(150) NOT NULL,
    `company_name` VARCHAR(100),
    `email` VARCHAR(100) NOT NULL,
    `mobile_number` VARCHAR(15) NOT NULL,
    `id_proof_type` VARCHAR(50),
    `id_proof_number` VARCHAR(50),
    `employee_id` VARCHAR(50),
    `full_name` VARCHAR(150),
    `pabx_number` VARCHAR(20),
    `unit` VARCHAR(100),
    `department` VARCHAR(100),
    `location` VARCHAR(100),
    `access_level` VARCHAR(50),
    `reason_of_visit` VARCHAR(150),
    `status` VARCHAR(20) DEFAULT 'active',
    `photo` TEXT,
    `person_to_visit` VARCHAR(150),
    `vehicle_type` VARCHAR(50) DEFAULT NULL,
    `vehicle_number` VARCHAR(50) DEFAULT NULL,
    `vehicle_photo_front` VARCHAR(255) DEFAULT NULL,
    `vehicle_photo_side` VARCHAR(255) DEFAULT NULL,
    `has_device` BOOLEAN DEFAULT FALSE,
    `device_type` VARCHAR(100),
    `device_make` VARCHAR(100),
    `device_serial_number` VARCHAR(100),
    `has_material` BOOLEAN DEFAULT FALSE,
    `material_name` TEXT DEFAULT NULL,
    `material_quantity` VARCHAR(100) DEFAULT NULL,
    `material_serial_number` VARCHAR(100) DEFAULT NULL,
    INDEX `idx_visitors_email` (`email`),
    INDEX `idx_visitors_mobile` (`mobile_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Visitor Requests Table (Check-in, check-out, approval, and audit logs)
CREATE TABLE IF NOT EXISTS `visitor_requests` (
    `request_id` INT AUTO_INCREMENT PRIMARY KEY,
    `visitor_id` INT,
    `host_id` INT,
    `purpose` VARCHAR(100),
    `scheduled_date` DATE,
    `scheduled_time` TIME,
    `status` VARCHAR(50) DEFAULT 'PENDING',
    `approved_by` INT,
    `approved_at` DATETIME,
    `check_in_time` DATETIME,
    `check_out_time` DATETIME,
    `manual_check_out_time` DATETIME DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `has_device` BOOLEAN DEFAULT FALSE,
    `device_type` VARCHAR(100),
    `device_make` VARCHAR(100),
    `device_serial_number` VARCHAR(100),
    `has_material` BOOLEAN DEFAULT FALSE,
    `material_name` TEXT DEFAULT NULL,
    `material_quantity` VARCHAR(100) DEFAULT NULL,
    `material_serial_number` VARCHAR(100) DEFAULT NULL,
    `is_temp_out` BOOLEAN DEFAULT FALSE,
    `temp_out_time` DATETIME DEFAULT NULL,
    `temp_in_time` DATETIME DEFAULT NULL,
    `parent_request_id` INT DEFAULT NULL,
    `transfer_from_host_id` INT DEFAULT NULL,
    `physical_badge_no` VARCHAR(50) DEFAULT NULL,
    `signature_path` VARCHAR(255) DEFAULT NULL,
    `checkout_signature_path` VARCHAR(255) DEFAULT NULL,
    `checked_in_by` INT DEFAULT NULL,
    `site_id` INT DEFAULT NULL,
    INDEX `idx_vr_status` (`status`),
    INDEX `idx_vr_check_in` (`check_in_time`),
    INDEX `idx_vr_site` (`site_id`),
    CONSTRAINT `fk_vr_visitor` FOREIGN KEY (`visitor_id`) REFERENCES `visitors` (`visitor_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_vr_host` FOREIGN KEY (`host_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_vr_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_vr_checked_in_by` FOREIGN KEY (`checked_in_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_vr_site` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. System License Table (Offline token storage and enforcement)
CREATE TABLE IF NOT EXISTS `system_license` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `license_key` TEXT NOT NULL,
    `activation_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `will_terminate` BOOLEAN DEFAULT FALSE,
    `terminated_early` BOOLEAN DEFAULT FALSE,
    `extension_requested` BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. System Settings Table (Configuration and branding key-values)
CREATE TABLE IF NOT EXISTS `system_settings` (
    `setting_key` VARCHAR(255) PRIMARY KEY,
    `setting_value` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Superadmin Audit Logs Table (Operational action trails)
CREATE TABLE IF NOT EXISTS `superadmin_audit_logs` (
    `log_id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(255) NOT NULL,
    `action` VARCHAR(255) NOT NULL,
    `target` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Role Permissions Table (Feature matrices for each role)
CREATE TABLE IF NOT EXISTS `role_permissions` (
    `role_name` VARCHAR(50) PRIMARY KEY,
    `reports` TINYINT(1) DEFAULT 0,
    `config` TINYINT(1) DEFAULT 0,
    `purge` TINYINT(1) DEFAULT 0,
    `users` TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Initial System Defaults (Operational defaults only - NO user/customer/visitor records)
INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`) VALUES
    ('session_timeout', '30'),
    ('data_purge_days', '90'),
    ('alert_sound', 'Enabled'),
    ('mfa_status', 'Disabled');

INSERT IGNORE INTO `role_permissions` (`role_name`, `reports`, `config`, `purge`, `users`) VALUES
    ('superadmin', 1, 1, 1, 1),
    ('admin', 1, 1, 0, 1),
    ('host', 0, 0, 0, 0),
    ('security', 0, 0, 0, 0);

SET FOREIGN_KEY_CHECKS = 1;
