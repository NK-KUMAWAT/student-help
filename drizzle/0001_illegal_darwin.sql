CREATE TABLE `resumes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`extractedSkills` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `resumes_id` PRIMARY KEY(`id`)
);
