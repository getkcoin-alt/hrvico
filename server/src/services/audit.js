import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export function recordAuditLog({ tenantId = null, userId = null, action, entityType = null, entityId = null, metadata = {}, ip = null }) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, metadata, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Ensure sensitive details like password, tokens, etc are never in metadata
    const safeMetadata = { ...metadata };
    delete safeMetadata.password;
    delete safeMetadata.confirmPassword;
    delete safeMetadata.token;
    delete safeMetadata.password_hash;
    delete safeMetadata.token_hash;

    stmt.run(
      uuidv4(),
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      JSON.stringify(safeMetadata),
      ip
    );
  } catch (err) {
    console.error('Failed to record audit log:', err.message);
  }
}
