CREATE TABLE `call_transcripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`callId` int NOT NULL,
	`speaker` enum('ai','human') NOT NULL,
	`text` text NOT NULL,
	`timestamp` int NOT NULL,
	`confidence` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `call_transcripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`twilioCallSid` varchar(64),
	`toNumber` varchar(64) NOT NULL,
	`callType` enum('phone','meet','zoom','teams') NOT NULL DEFAULT 'phone',
	`status` enum('initiated','ringing','in-progress','completed','failed','cancelled') NOT NULL DEFAULT 'initiated',
	`voiceId` varchar(128),
	`voiceName` varchar(128),
	`tone` enum('professional','casual','friendly','formal','empathetic') DEFAULT 'professional',
	`systemPrompt` text,
	`personality` text,
	`responseSpeed` float DEFAULT 1,
	`stability` float DEFAULT 0.5,
	`similarityBoost` float DEFAULT 0.75,
	`speakingRate` float DEFAULT 1,
	`pitch` float DEFAULT 0,
	`volume` float DEFAULT 1,
	`startedAt` timestamp,
	`endedAt` timestamp,
	`durationSeconds` int,
	`summary` text,
	`insights` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`elevenLabsApiKey` text,
	`twilioAccountSid` text,
	`twilioAuthToken` text,
	`twilioPhoneNumber` varchar(32),
	`theme` enum('dark','light') NOT NULL DEFAULT 'dark',
	`accentColor` varchar(16) DEFAULT '#6366f1',
	`defaultTone` enum('professional','casual','friendly','formal','empathetic') DEFAULT 'professional',
	`defaultSystemPrompt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`elevenLabsVoiceId` varchar(128) NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`category` enum('premade','cloned','generated') NOT NULL DEFAULT 'premade',
	`previewUrl` text,
	`stability` float DEFAULT 0.5,
	`similarityBoost` float DEFAULT 0.75,
	`style` float DEFAULT 0,
	`useSpeakerBoost` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `voices_id` PRIMARY KEY(`id`)
);
