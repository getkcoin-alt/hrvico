import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export async function recordAuditLog({ tenantId = null, userId = null, action, entityType = null, entityId = null, metadata = {}, ip = null }) {
  try {
    const safeMetadata = { ...metadata };
    delete safeMetadata.password;
    delete safeMetadata.confirmPassword;
    delete safeMetadata.token;
    delete safeMetadata.password_hash;
    delete safeMetadata.token_hash;

    await db.prepare(`
      INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, metadata, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
