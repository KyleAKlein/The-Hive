CREATE TABLE `locked_texts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`invoice` text NOT NULL,
	`payment_hash` text NOT NULL,
	`sats` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locked_texts_payment_hash_unique` ON `locked_texts` (`payment_hash`);