CREATE TABLE `referralRewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerUserId` int NOT NULL,
	`referredName` varchar(160) NOT NULL,
	`event` varchar(120) NOT NULL,
	`amount` int NOT NULL,
	`status` enum('pending','credited','reversed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referralRewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `withdrawalRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`payoutMethod` varchar(80) NOT NULL,
	`status` enum('requested','processing','paid','rejected') NOT NULL DEFAULT 'requested',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `withdrawalRequests_id` PRIMARY KEY(`id`)
);
