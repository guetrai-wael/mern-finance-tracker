/* Notification model: in-app alerts.
 *
 * dedupeKey is the load-bearing field. Budget checks run on every transaction
 * write, so without it a user who adds ten expenses after crossing their limit
 * would receive ten identical alerts. The key describes the EVENT rather than
 * the moment it was noticed:
 *
 *   budget:exceeded:2026-07:total
 *   budget:warning:2026-07:cat:<categoryId>
 *   goal:reminder:<goalId>:30d
 *   report:monthly:2026-07
 *
 * Dispatch upserts on it, so a repeat trigger is a no-op while a genuinely new
 * event — next month, a different category — yields a new key naturally.
 */
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
        type: String,
        enum: ['budget', 'goal', 'report', 'system'],
        required: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    // Free-form payload: href for click-through, ids, amounts.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    dedupeKey: { type: String, required: true }
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1, createdAt: -1 }); // Unread list
notificationSchema.index({ user: 1, createdAt: -1 }); // Full list
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true }); // Anti-spam

module.exports = mongoose.model('Notification', notificationSchema);
