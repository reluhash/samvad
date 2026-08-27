import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Add apiAccess column to users table if not exists
  await conn.execute(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS apiAccess ENUM('none','approved','revoked') NOT NULL DEFAULT 'none'
  `);
  console.log("✓ Added apiAccess column to users");
} catch (e) {
  if (e.code === "ER_DUP_FIELDNAME") {
    console.log("- apiAccess column already exists");
  } else {
    console.error("Error adding apiAccess:", e.message);
  }
}

try {
  // Create access_requests table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      status ENUM('pending','approved','revoked') NOT NULL DEFAULT 'pending',
      message TEXT,
      adminNote TEXT,
      requestedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_userId (userId),
      INDEX idx_status (status)
    )
  `);
  console.log("✓ Created access_requests table");
} catch (e) {
  console.error("Error creating access_requests:", e.message);
}

await conn.end();
console.log("Migration complete.");
