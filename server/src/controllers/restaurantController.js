import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { recordAuditLog } from '../services/audit.js';

async function generateRestaurantCode() {
  const countRow = await db.prepare('SELECT COUNT(*) as count FROM restaurants').get();
  const nextNum = (countRow ? parseInt(countRow.count, 10) : 0) + 1;
  let code = `RV-R${String(nextNum).padStart(4, '0')}`;

  let existing = await db.prepare('SELECT id FROM restaurants WHERE restaurant_code = ?').get(code);
  let attempts = 1;
  while (existing) {
    code = `RV-R${String(nextNum + attempts).padStart(4, '0')}`;
    existing = await db.prepare('SELECT id FROM restaurants WHERE restaurant_code = ?').get(code);
    attempts++;
  }
  return code;
}

export async function listRestaurants(req, res) {
  try {
    const { search, status } = req.query;
    const tenantId = req.user.tenant_id;

    let query = 'SELECT * FROM restaurants WHERE tenant_id = ?';
    const params = [tenantId];

    if (status && ['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(status.toUpperCase())) {
      query += ' AND status = ?';
      params.push(status.toUpperCase());
    } else if (!status || status.toUpperCase() === 'ALL') {
      query += " AND status != 'ARCHIVED'";
    }

    if (search && search.trim()) {
      query += ' AND (name LIKE ? OR city LIKE ? OR restaurant_code LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY created_at DESC';

    const restaurants = await db.prepare(query).all(...params);

    const totalCountRow = await db.prepare('SELECT COUNT(*) as c FROM restaurants WHERE tenant_id = ?').get(tenantId);
    const activeCountRow = await db.prepare("SELECT COUNT(*) as c FROM restaurants WHERE tenant_id = ? AND status = 'ACTIVE'").get(tenantId);
    const inactiveCountRow = await db.prepare("SELECT COUNT(*) as c FROM restaurants WHERE tenant_id = ? AND status = 'INACTIVE'").get(tenantId);
    const archivedCountRow = await db.prepare("SELECT COUNT(*) as c FROM restaurants WHERE tenant_id = ? AND status = 'ARCHIVED'").get(tenantId);

    return res.json({
      success: true,
      message: 'Restaurants retrieved.',
      data: {
        restaurants,
        summary: {
          total: totalCountRow ? parseInt(totalCountRow.c, 10) : 0,
          active: activeCountRow ? parseInt(activeCountRow.c, 10) : 0,
          inactive: inactiveCountRow ? parseInt(inactiveCountRow.c, 10) : 0,
          archived: archivedCountRow ? parseInt(archivedCountRow.c, 10) : 0
        }
      },
      request_id: req.requestId
    });
  } catch (err) {
    console.error('List restaurants error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error listing restaurants.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function createRestaurant(req, res) {
  try {
    const {
      name,
      businessType = 'Restaurant',
      mobile,
      email,
      addressLine,
      city,
      state,
      country = 'IN',
      pincode,
      gstin,
      fssaiNo,
      openingTime,
      closingTime
    } = req.body;

    const tenantId = req.user.tenant_id;

    if (!name || !name.trim()) {
      return res.status(422).json({
        success: false,
        message: 'Restaurant / Outlet name is required.',
        data: null,
        request_id: req.requestId
      });
    }

    const validBusinessTypes = ['Restaurant', 'Cafe', 'QSR', 'Cloud Kitchen', 'Food Court', 'Other'];
    if (!validBusinessTypes.includes(businessType)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid business type specified.',
        data: null,
        request_id: req.requestId
      });
    }

    if (!mobile || !mobile.trim()) {
      return res.status(422).json({
        success: false,
        message: 'Restaurant mobile number is required.',
        data: null,
        request_id: req.requestId
      });
    }

    if (!addressLine || !addressLine.trim()) {
      return res.status(422).json({
        success: false,
        message: 'Address line is required.',
        data: null,
        request_id: req.requestId
      });
    }

    if (!city || !city.trim()) {
      return res.status(422).json({
        success: false,
        message: 'City is required.',
        data: null,
        request_id: req.requestId
      });
    }

    if (!state || !state.trim()) {
      return res.status(422).json({
        success: false,
        message: 'State is required.',
        data: null,
        request_id: req.requestId
      });
    }

    if (!pincode || !/^\d{6}$/.test(pincode.trim())) {
      return res.status(422).json({
        success: false,
        message: 'PIN code must be a 6-digit number.',
        data: null,
        request_id: req.requestId
      });
    }

    const id = uuidv4();
    const restaurantCode = await generateRestaurantCode();

    await db.prepare(`
      INSERT INTO restaurants (
        id, tenant_id, restaurant_code, name, business_type, mobile, email,
        address_line, city, state, country, pincode, gstin, fssai_no,
        opening_time, closing_time, status, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, tenantId, restaurantCode, name.trim(), businessType, mobile.trim(), email ? email.trim() : null,
      addressLine.trim(), city.trim(), state.trim(), country.trim(), pincode.trim(), gstin ? gstin.trim().toUpperCase() : null, fssaiNo ? fssaiNo.trim() : null,
      openingTime || null, closingTime || null, 'ACTIVE', req.user.id, req.user.id
    );

    await recordAuditLog({
      tenantId,
      userId: req.user.id,
      action: 'Restaurant Create',
      entityType: 'Restaurant',
      entityId: id,
      metadata: { restaurantCode, name: name.trim(), businessType, city: city.trim() },
      ip: req.ip
    });

    const newRecord = await db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);

    return res.status(201).json({
      success: true,
      message: 'Restaurant created successfully.',
      data: newRecord,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Create restaurant error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error creating restaurant.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function getRestaurantById(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;

    const restaurant = await db.prepare('SELECT * FROM restaurants WHERE id = ? AND tenant_id = ?').get(id, tenantId);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or access denied.',
        data: null,
        request_id: req.requestId
      });
    }

    return res.json({
      success: true,
      message: 'Restaurant retrieved.',
      data: restaurant,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Get restaurant by id error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving restaurant.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function updateRestaurant(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;

    const existing = await db.prepare('SELECT * FROM restaurants WHERE id = ? AND tenant_id = ?').get(id, tenantId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or access denied.',
        data: null,
        request_id: req.requestId
      });
    }

    const {
      name,
      businessType,
      mobile,
      email,
      addressLine,
      city,
      state,
      country,
      pincode,
      gstin,
      fssaiNo,
      openingTime,
      closingTime
    } = req.body;

    const updates = [];
    const params = [];
    const changedFields = [];

    if (name !== undefined && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
      changedFields.push('name');
    }

    if (businessType !== undefined) {
      const validBusinessTypes = ['Restaurant', 'Cafe', 'QSR', 'Cloud Kitchen', 'Food Court', 'Other'];
      if (validBusinessTypes.includes(businessType)) {
        updates.push('business_type = ?');
        params.push(businessType);
        changedFields.push('business_type');
      }
    }

    if (mobile !== undefined && mobile.trim()) {
      updates.push('mobile = ?');
      params.push(mobile.trim());
      changedFields.push('mobile');
    }

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email ? email.trim() : null);
      changedFields.push('email');
    }

    if (addressLine !== undefined && addressLine.trim()) {
      updates.push('address_line = ?');
      params.push(addressLine.trim());
      changedFields.push('address_line');
    }

    if (city !== undefined && city.trim()) {
      updates.push('city = ?');
      params.push(city.trim());
      changedFields.push('city');
    }

    if (state !== undefined && state.trim()) {
      updates.push('state = ?');
      params.push(state.trim());
      changedFields.push('state');
    }

    if (country !== undefined && country.trim()) {
      updates.push('country = ?');
      params.push(country.trim());
      changedFields.push('country');
    }

    if (pincode !== undefined) {
      if (!/^\d{6}$/.test(pincode.trim())) {
        return res.status(422).json({
          success: false,
          message: 'PIN code must be a 6-digit number.',
          data: null,
          request_id: req.requestId
        });
      }
      updates.push('pincode = ?');
      params.push(pincode.trim());
      changedFields.push('pincode');
    }

    if (gstin !== undefined) {
      updates.push('gstin = ?');
      params.push(gstin ? gstin.trim().toUpperCase() : null);
      changedFields.push('gstin');
    }

    if (fssaiNo !== undefined) {
      updates.push('fssai_no = ?');
      params.push(fssaiNo ? fssaiNo.trim() : null);
      changedFields.push('fssai_no');
    }

    if (openingTime !== undefined) {
      updates.push('opening_time = ?');
      params.push(openingTime || null);
      changedFields.push('opening_time');
    }

    if (closingTime !== undefined) {
      updates.push('closing_time = ?');
      params.push(closingTime || null);
      changedFields.push('closing_time');
    }

    if (updates.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'No fields provided for update.',
        data: null,
        request_id: req.requestId
      });
    }

    updates.push('updated_by = ?');
    params.push(req.user.id);
    updates.push('updated_at = CURRENT_TIMESTAMP');

    params.push(id, tenantId);

    await db.prepare(`UPDATE restaurants SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);

    await recordAuditLog({
      tenantId,
      userId: req.user.id,
      action: 'Restaurant Update',
      entityType: 'Restaurant',
      entityId: id,
      metadata: { changedFields },
      ip: req.ip
    });

    const updatedRecord = await db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);

    return res.json({
      success: true,
      message: 'Restaurant details updated successfully.',
      data: updatedRecord,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Update restaurant error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error updating restaurant.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function updateRestaurantStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user.tenant_id;

    const validStatuses = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(422).json({
        success: false,
        message: 'Invalid status. Must be ACTIVE, INACTIVE, or ARCHIVED.',
        data: null,
        request_id: req.requestId
      });
    }

    const existing = await db.prepare('SELECT status FROM restaurants WHERE id = ? AND tenant_id = ?').get(id, tenantId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or access denied.',
        data: null,
        request_id: req.requestId
      });
    }

    const newStatus = status.toUpperCase();
    const oldStatus = existing.status;

    await db.prepare(`
      UPDATE restaurants
      SET status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).run(newStatus, req.user.id, id, tenantId);

    await recordAuditLog({
      tenantId,
      userId: req.user.id,
      action: 'Restaurant Status Change',
      entityType: 'Restaurant',
      entityId: id,
      metadata: { oldStatus, newStatus },
      ip: req.ip
    });

    const updatedRecord = await db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);

    return res.json({
      success: true,
      message: `Restaurant status updated to ${newStatus}.`,
      data: updatedRecord,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Update restaurant status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error updating restaurant status.',
      data: null,
      request_id: req.requestId
    });
  }
}
