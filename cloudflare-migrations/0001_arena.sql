CREATE TABLE IF NOT EXISTS `debates` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`matchup` text NOT NULL,
	`body` text NOT NULL,
	`parent` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `follows` (
	`user` text NOT NULL,
	`target` text NOT NULL,
	PRIMARY KEY(`user`, `target`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `likes` (
	`user` text NOT NULL,
	`debate` text NOT NULL,
	PRIMARY KEY(`user`, `debate`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `predictions` (
	`user` text NOT NULL,
	`matchup` text NOT NULL,
	`winner` text NOT NULL,
	`method` text NOT NULL,
	`round` integer NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`user`, `matchup`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rankings` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`competitors` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `results` (
	`user` text NOT NULL,
	`matchup` text NOT NULL,
	`winner` text NOT NULL,
	`method` text NOT NULL,
	`round` integer NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`user`, `matchup`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`favorites` text NOT NULL,
	`created` integer NOT NULL,
	`active` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `votes` (
	`user` text NOT NULL,
	`matchup` text NOT NULL,
	`competitor` text NOT NULL,
	PRIMARY KEY(`user`, `matchup`)
);
