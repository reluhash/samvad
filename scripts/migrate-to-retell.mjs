import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";

const db = drizzle(process.env.DATABASE_URL);

async function run() {
  console.log("Starting Retell migration...");

  // ── user_settings ──────────────────────────────────────────────────────────
  // Rename elevenLabsApiKey → retellApiKey, drop Twilio columns, add retellPhoneNumber
  const settingsMigrations = [
    `ALTER TABLE user_settings 
       CHANGE COLUMN elevenLabsApiKey retellApiKey VARCHAR(255) NULL,
       DROP COLUMN IF EXISTS twilioAccountSid,
       DROP COLUMN IF EXISTS twilioAuthToken,
       DROP COLUMN IF EXISTS twilioPhoneNumber`,
    `ALTER TABLE user_settings 
       ADD COLUMN IF NOT EXISTS retellPhoneNumber VARCHAR(64) NULL`,
  ];

  for (const sql of settingsMigrations) {
    try {
      await db.execute(sql);
      console.log("✓ user_settings:", sql.slice(0, 60) + "...");
    } catch (e) {
      console.warn("  (skipped):", e.message.slice(0, 80));
    }
  }

  // ── voices ─────────────────────────────────────────────────────────────────
  // Rename elevenLabsVoiceId → retellVoiceId, add new columns, drop old ones
  const voicesMigrations = [
    `ALTER TABLE voices 
       CHANGE COLUMN elevenLabsVoiceId retellVoiceId VARCHAR(255) NOT NULL DEFAULT ''`,
    `ALTER TABLE voices 
       ADD COLUMN IF NOT EXISTS provider VARCHAR(64) NULL,
       ADD COLUMN IF NOT EXISTS gender VARCHAR(32) NULL,
       ADD COLUMN IF NOT EXISTS accent VARCHAR(64) NULL,
       ADD COLUMN IF NOT EXISTS age VARCHAR(32) NULL`,
    `ALTER TABLE voices 
       DROP COLUMN IF EXISTS stability,
       DROP COLUMN IF EXISTS similarityBoost,
       DROP COLUMN IF EXISTS style,
       DROP COLUMN IF EXISTS useSpeakerBoost`,
  ];

  for (const sql of voicesMigrations) {
    try {
      await db.execute(sql);
      console.log("✓ voices:", sql.slice(0, 60) + "...");
    } catch (e) {
      console.warn("  (skipped):", e.message.slice(0, 80));
    }
  }

  // ── calls ──────────────────────────────────────────────────────────────────
  // Rename twilioCallSid → retellCallId, add retellAgentId/retellLlmId, add new params
  const callsMigrations = [
    `ALTER TABLE calls 
       CHANGE COLUMN twilioCallSid retellCallId VARCHAR(255) NULL`,
    `ALTER TABLE calls 
       ADD COLUMN IF NOT EXISTS retellAgentId VARCHAR(255) NULL,
       ADD COLUMN IF NOT EXISTS retellLlmId VARCHAR(255) NULL`,
    `ALTER TABLE calls 
       ADD COLUMN IF NOT EXISTS meetingLink TEXT NULL,
       ADD COLUMN IF NOT EXISTS meetingPin VARCHAR(64) NULL,
       ADD COLUMN IF NOT EXISTS agentPrompt TEXT NULL,
       ADD COLUMN IF NOT EXISTS llmTemperature FLOAT NULL,
       ADD COLUMN IF NOT EXISTS voiceSpeed FLOAT NULL,
       ADD COLUMN IF NOT EXISTS voiceTemperature FLOAT NULL,
       ADD COLUMN IF NOT EXISTS userSentiment VARCHAR(64) NULL,
       ADD COLUMN IF NOT EXISTS callSuccessful TINYINT(1) NULL`,
    `ALTER TABLE calls 
       DROP COLUMN IF EXISTS responseSpeed,
       DROP COLUMN IF EXISTS stability,
       DROP COLUMN IF EXISTS similarityBoost,
       DROP COLUMN IF EXISTS speakingRate,
       DROP COLUMN IF EXISTS pitch,
       DROP COLUMN IF EXISTS volume`,
  ];

  for (const sql of callsMigrations) {
    try {
      await db.execute(sql);
      console.log("✓ calls:", sql.slice(0, 60) + "...");
    } catch (e) {
      console.warn("  (skipped):", e.message.slice(0, 80));
    }
  }

  // ── call_transcripts ───────────────────────────────────────────────────────
  // Add words column if missing
  const transcriptMigrations = [
    `ALTER TABLE call_transcripts 
       ADD COLUMN IF NOT EXISTS words TEXT NULL`,
    `ALTER TABLE call_transcripts 
       DROP COLUMN IF EXISTS confidence`,
  ];

  for (const sql of transcriptMigrations) {
    try {
      await db.execute(sql);
      console.log("✓ call_transcripts:", sql.slice(0, 60) + "...");
    } catch (e) {
      console.warn("  (skipped):", e.message.slice(0, 80));
    }
  }

  console.log("\n✅ Migration complete!");
  process.exit(0);
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
