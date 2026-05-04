CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_user_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`deep_link` text,
	`metadata` text,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_recipient_created` ON `notifications` (`recipient_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_recipient_status_created` ON `notifications` (`recipient_user_id`,`status`,`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_lesson_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`lesson_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_lesson_bookmarks`("id", "user_id", "lesson_id", "created_at") SELECT "id", "user_id", "lesson_id", "created_at" FROM `lesson_bookmarks`;--> statement-breakpoint
DROP TABLE `lesson_bookmarks`;--> statement-breakpoint
ALTER TABLE `__new_lesson_bookmarks` RENAME TO `lesson_bookmarks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_lesson_bookmark` ON `lesson_bookmarks` (`user_id`,`lesson_id`);